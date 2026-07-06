 * ============================================================================
 * IMPORT LOGIGO — Fast Rental (Sheet1) + Orcha (orcha rentals) → Supabase
 * ============================================================================
 * PRÉREQUIS : lancer le SQL de l'étape A dans Supabase AVANT lancerImport
 * (colonnes locataire + contrainte UNIQUE sur sheet_row_id).
 *
 * UTILISATION :
 *   1. Renseigne SUPABASE_SERVICE_KEY dans CONFIG.
 *   2. testerImport → Exécuter : lit les sheets, affiche l'aperçu, N'ÉCRIT RIEN.
 *   3. Si l'aperçu est bon → lancerImport → écrit dans Supabase.
 *   (diagFast : affiche les lignes brutes de Fast si besoin de debug.)
 * ============================================================================
 */

const CONFIG = {
  SUPABASE_URL: 'https://twkqsaupojldddclgpqj.supabase.co',
  SUPABASE_SERVICE_KEY: 'COLLE_TA_CLE_SERVICE_ROLE_ICI', // ⚠️ service_role, PAS la clé publique

  FAST_ID:  '1FbQ7VTOE0muIUSfIh3fdBq7Hdle9MgxhmAUrB_Dy4jk',
  FAST_TAB: 'Sheet1',
  FAST_HEADER_ROW: 2,          // ← en-têtes en ligne 2 (ligne 1 vide) — découvert via Make.com

  ORCHA_ID:  '1hnNYOxxiObjBfaNRRlUH6j8AolUaBbmaaRLzt6d2UdA',
  ORCHA_TAB: 'orcha rentals',
  ORCHA_HEADER_ROW: 1,
};


// ============================================================================
// POINTS D'ENTRÉE
// ============================================================================

function testerImport() {
  const rows = collecterTout_();
  Logger.log('===== APERÇU (aucune écriture Supabase) =====');
  Logger.log('Total à importer : ' + rows.length);
  Logger.log('--- 6 exemples : ---');
  rows.slice(0, 6).forEach((r, i) => Logger.log('#' + (i+1) + ' ' + JSON.stringify(r)));
  const parSource = {}, parStatut = {};
  rows.forEach(r => {
    parSource[r.source] = (parSource[r.source] || 0) + 1;
    parStatut[r.statut] = (parStatut[r.statut] || 0) + 1;
  });
  Logger.log('Répartition source : ' + JSON.stringify(parSource));
  Logger.log('Répartition statut : ' + JSON.stringify(parStatut));
}

function lancerImport() {
  if (CONFIG.SUPABASE_SERVICE_KEY.indexOf('COLLE_TA_CLE') === 0) {
    Logger.log('❌ Renseigne d\'abord SUPABASE_SERVICE_KEY dans CONFIG.');
    return;
  }
  const rows = collecterTout_();
  Logger.log('===== IMPORT RÉEL : ' + rows.length + ' logements =====');
  const LOT = 100;
  let ok = 0, err = 0;
  for (let i = 0; i < rows.length; i += LOT) {
    const lot = rows.slice(i, i + LOT);
    const res = upsertLot_(lot);
    if (res.success) { ok += lot.length; Logger.log('✅ Lot ' + (Math.floor(i/LOT)+1) + ' : ' + lot.length); }
    else { err += lot.length; Logger.log('❌ Lot ' + (Math.floor(i/LOT)+1) + ' : ' + res.error); }
    Utilities.sleep(400);
  }
  Logger.log('===== TERMINÉ : ' + ok + ' ok, ' + err + ' erreurs =====');
}

// Test connexion Supabase seul (pratique avant lancerImport)
function testerConnexionSupabase() {
  const resp = UrlFetchApp.fetch(CONFIG.SUPABASE_URL + '/rest/v1/logements?select=id&limit=1', {
    method: 'get',
    headers: { 'apikey': CONFIG.SUPABASE_SERVICE_KEY, 'Authorization': 'Bearer ' + CONFIG.SUPABASE_SERVICE_KEY },
    muteHttpExceptions: true
  });
  Logger.log(resp.getResponseCode() === 200 ? '✅ Connexion Supabase OK' : '❌ HTTP ' + resp.getResponseCode() + ' : ' + resp.getContentText().slice(0,200));
}

// Diagnostic : affiche les 5 premières lignes brutes de Fast Sheet1 pour repérer
// où sont vraiment les en-têtes et comment "Address" est écrit exactement.
function diagFast() {
  const ss = SpreadsheetApp.openById(CONFIG.FAST_ID);
  const sheet = ss.getSheetByName(CONFIG.FAST_TAB);
  const data = sheet.getRange(1, 1, 5, sheet.getLastColumn()).getValues();
  for (let r = 0; r < 5; r++) Logger.log('LIGNE ' + (r+1) + ' : ' + JSON.stringify(data[r]));
}


// ============================================================================
// COLLECTE
// ============================================================================

function collecterTout_() {
  let rows = [];
  rows = rows.concat(lireOnglet_(CONFIG.FAST_ID,  CONFIG.FAST_TAB,  CONFIG.FAST_HEADER_ROW,  'fast_rental', mapperFast_,  'address'));
  rows = rows.concat(lireOnglet_(CONFIG.ORCHA_ID, CONFIG.ORCHA_TAB, CONFIG.ORCHA_HEADER_ROW, 'orcha',       mapperOrcha_, 'eft form'));
  return rows;
}

function lireOnglet_(fichierId, nomOnglet, headerRow, source, mapper, headerHint) {
  const ss = SpreadsheetApp.openById(fichierId);
  const sheet = ss.getSheetByName(nomOnglet);
  if (!sheet) { Logger.log('⚠️ Onglet introuvable : ' + nomOnglet); return []; }

  const lastRow = sheet.getLastRow(), lastCol = sheet.getLastColumn();
  if (lastRow < 2) return [];

  // Auto-détection de la ligne d'en-tête : on cherche dans les 6 premières lignes
  // celle qui contient le mot-clé attendu (ex "address" / "eft form"). Si trouvée,
  // elle prime sur headerRow. Robuste aux lignes vides intercalées.
  let hRow = headerRow;
  const scan = sheet.getRange(1, 1, Math.min(6, lastRow), lastCol).getValues();
  for (let r = 0; r < scan.length; r++) {
    const keys = scan[r].map(normHeader_);
    if (keys.indexOf(normHeader_(headerHint)) >= 0) { hRow = r + 1; break; }
  }

  const headersRaw = sheet.getRange(hRow, 1, 1, lastCol).getValues()[0];
  const col = {};
  headersRaw.forEach((h, i) => {
    const key = normHeader_(h);
    if (key && col[key] === undefined) col[key] = i;
  });

  const data = sheet.getRange(hRow + 1, 1, lastRow - hRow, lastCol).getValues();
  const out = [];
  for (const ligne of data) {
    const get = (nom) => { const idx = col[normHeader_(nom)]; return idx === undefined ? '' : ligne[idx]; };
    const obj = mapper(get, source);
    if (obj && obj.adresse && obj.adresse.length > 2) out.push(obj);
  }
  Logger.log('Lu ' + nomOnglet + ' (en-têtes ligne ' + hRow + ') : ' + out.length + ' valides / ' + data.length + ' lignes');
  return out;
}

// Normalise un libellé de colonne pour un matching tolérant (emoji, accents, casse, espaces).
function normHeader_(h) {
  return String(h || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')      // accents
    .replace(/[^\x00-\x7F]/g, '')                          // emojis / non-ASCII
    .toLowerCase()
    .replace(/[^a-z0-9$'\s]/g, ' ')                        // garde lettres, chiffres, $, apostrophe
    .replace(/\s+/g, ' ').trim();
}


// ============================================================================
// MAPPINGS
// ============================================================================

// Villes hors-Montréal reconnues dans "Area" — sinon tout finit étiqueté
// "Montréal" par défaut, ce qui est faux pour du Gatineau/Laval/etc.
const VILLES_CONNUES = ['gatineau','laval','longueuil','terrebonne','brossard',
  'repentigny','saint-jerome','st-jerome','blainville','mirabel','chateauguay',
  'greenfield park','valleyfield'];

function separerQuartierVille_(area) {
  const a = txt_(area);
  const norm = a.toLowerCase();
  for (const v of VILLES_CONNUES) {
    if (norm.indexOf(v) >= 0) return { quartier: a, ville: v.replace(/\b\w/g, c => c.toUpperCase()) };
  }
  return { quartier: a, ville: 'Montréal' };
}

function mapperFast_(get, source) {
  const adresse = txt_(get('address'));
  if (!adresse) return null;
  const qv = separerQuartierVille_(get('area'));
  return {
    adresse:            adresse,
    quartier:           qv.quartier,
    ville:              qv.ville,
    prix:               parsePrix_(get('price')),
    taille:             parseTaille_(get('size')),
    electromenagers:    txt_(get('appliances')),
    code_entree:        txt_(get('entrance code')),
    concierge_tel:      txt_(get('janitor number')),
    notes:              txt_(get('notes')),
    statut:             mapStatut_(get('availability')),
    date_disponibilite: dateTxt_(get('available on')),
    locataire_nom:      '',   // Fast n'a pas de colonne locataire
    locataire_tel:      '',
    source:             source,
    sheet_row_id:       rowId_(source, adresse),
  };
}

function mapperOrcha_(get, source) {
  const adresse = txt_(get('eft form'));   // ← l'adresse est dans "Eft form" chez Orcha
  if (!adresse) return null;
  const qv = separerQuartierVille_(get('area'));

  return {
    adresse:            adresse,
    quartier:           qv.quartier,
    ville:              qv.ville,
    prix:               parsePrix_(get('$')),
    taille:             parseTaille_(get('size')),
    electromenagers:    txt_(get('appliances')),
    code_entree:        txt_(get('entrance code')),
    concierge_tel:      txt_(get('janitor number')),
    // SÉCURITÉ : le vrai champ "Notes" reste seul ici — notes est PUBLIQUE sur
    // le site client. Le nom/tél du locataire va dans locataire_nom/tel
    // (colonnes réservées à l'app agent), jamais mélangés à notes — sinon on
    // publie le téléphone personnel d'un locataire sur le site public.
    notes:              txt_(get('notes')),
    statut:             mapStatut_(get('status')),
    date_disponibilite: dateTxt_(get('available')),
    locataire_nom:      txt_(get("tenant's name")),
    locataire_tel:      txt_(get("tenant's number")),
    source:             source,
    sheet_row_id:       rowId_(source, adresse),
  };
}


// ============================================================================
// HELPERS
// ============================================================================

function txt_(v) { return (v === null || v === undefined) ? '' : String(v).trim(); }

function dateTxt_(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]')
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v).trim();
}

// La table logements a prix en TEXT → on renvoie une chaîne propre (chiffres only) ou ''.
function parsePrix_(v) {
  if (!v && v !== 0) return '';
  const s = String(v).replace(/[^0-9.]/g, '');
  const n = parseFloat(s);
  return (isNaN(n) || n <= 0) ? '' : String(Math.round(n));
}

function parseTaille_(v) {
  if (!v && v !== 0) return '';
  const s = String(v).replace(',', '.').replace('½', '.5').replace('¼', '.25').replace('¾', '.75').replace(/[^0-9.]/g, '');
  const n = parseFloat(s);
  return (isNaN(n) || n <= 0) ? '' : String(n);
}

// Statuts sheet variés → valeurs autorisées : Available, On Hold, Not Available, In Reno, Rented
function mapStatut_(v) {
  const s = String(v || '').trim().toLowerCase();
  if (!s) return 'Available';
  if (s.indexOf('rent') >= 0 || s.indexOf('lou') >= 0) return 'Rented';
  if (s.indexOf('reno') >= 0 || s.indexOf('rénov') >= 0) return 'In Reno';
  if (s.indexOf('not ') >= 0 || s.indexOf('unavail') >= 0 || s.indexOf('pas dispo') >= 0) return 'Not Available';
  if (s.indexOf('hold') >= 0 || s.indexOf('wait') >= 0 || s.indexOf('pending') >= 0 ||
      s.indexOf('lease') >= 0 || s.indexOf('soon') >= 0 || s.indexOf('tal') >= 0) return 'On Hold';
  if (s.indexOf('avail') >= 0 || s.indexOf('dispo') >= 0) return 'Available';
  return 'Available';
}

function rowId_(source, adresse) {
  const slug = String(adresse).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                 .toLowerCase().replace(/[^a-z0-9]/g, '');
  return source + '|' + slug;
}


// ============================================================================
// ÉCRITURE SUPABASE — UPSERT (relançable sans doublons)
// ============================================================================

function upsertLot_(lot) {
  const url = CONFIG.SUPABASE_URL + '/rest/v1/logements?on_conflict=sheet_row_id';
  const resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'apikey': CONFIG.SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + CONFIG.SUPABASE_SERVICE_KEY,
      'Prefer': 'resolution=merge-duplicates,return=minimal'
    },
    payload: JSON.stringify(lot),
    muteHttpExceptions: true
  });
  const code = resp.getResponseCode();
  if (code >= 200 && code < 300) return { success: true };
  return { success: false, error: 'HTTP ' + code + ' : ' + resp.getContentText().slice(0, 300) };
