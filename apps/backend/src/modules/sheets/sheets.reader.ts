import { google } from 'googleapis';
import { env } from '../../config/env.js';
import {
  SHEET_SOURCES,
  type ParsedSheetRow,
  type SheetSourceKey,
  buildColumnIndex,
  dedupeParsedSheetRows,
  getColumnValue,
  mapFastRentalRow,
  mapOrchaRow,
  normalizeHeader,
} from './sheetMappings.js';

function getSheetsClient() {
  if (!env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
    throw new Error('Google service account not configured');
  }
  const auth = new google.auth.JWT({
    email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return google.sheets({ version: 'v4', auth });
}

function detectHeaderRow(values: string[][], hint: string, fallbackRow: number) {
  const scanLimit = Math.min(6, values.length);
  for (let r = 0; r < scanLimit; r++) {
    const keys = (values[r] ?? []).map(normalizeHeader);
    if (keys.includes(normalizeHeader(hint))) return r;
  }
  return Math.max(0, fallbackRow - 1);
}

export type SheetReadStats = {
  source: string;
  tabName: string;
  headerRow: number;
  rowsSeen: number;
  rowsValid: number;
};

export async function readSheetRows(sourceKey: SheetSourceKey): Promise<{ rows: ParsedSheetRow[]; stats: SheetReadStats }> {
  const config = SHEET_SOURCES[sourceKey];
  const spreadsheetId = env[config.spreadsheetIdEnv as keyof typeof env] as string;
  if (!spreadsheetId) throw new Error(`Missing env ${config.spreadsheetIdEnv}`);

  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const tab = meta.data.sheets?.find((s) => s.properties?.title === config.tabName);
  if (!tab?.properties?.title) {
    throw new Error(`Sheet tab not found: ${config.tabName}`);
  }

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tab.properties.title}'!A:Z`,
  });
  const values = (response.data.values ?? []) as string[][];
  if (values.length < 2) {
    return {
      rows: [],
      stats: {
        source: config.source,
        tabName: config.tabName,
        headerRow: config.headerRow,
        rowsSeen: 0,
        rowsValid: 0,
      },
    };
  }

  const headerRowIndex = detectHeaderRow(values, config.addressHeaderHint, config.headerRow);
  const headers = values[headerRowIndex] ?? [];
  const col = buildColumnIndex(headers);
  const mapper = sourceKey === 'fastRental' ? mapFastRentalRow : mapOrchaRow;
  const rows: ParsedSheetRow[] = [];
  let rowsSeen = 0;

  for (let i = headerRowIndex + 1; i < values.length; i++) {
    const line = values[i] ?? [];
    rowsSeen++;
    const rowGet = (name: string) => getColumnValue(line, col, name);
    const parsed = mapper(rowGet, config.source, config.rowIdSource);
    if (parsed) rows.push(parsed);
  }

  return {
    rows,
    stats: {
      source: config.source,
      tabName: config.tabName,
      headerRow: headerRowIndex + 1,
      rowsSeen,
      rowsValid: rows.length,
    },
  };
}

export async function collectAllSheetRows() {
  const fast = await readSheetRows('fastRental');
  const orcha = await readSheetRows('orcha');
  return {
    rows: dedupeParsedSheetRows([...fast.rows, ...orcha.rows]),
    stats: [fast.stats, orcha.stats],
  };
}

export { getSheetsClient };
