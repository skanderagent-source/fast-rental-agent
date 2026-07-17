export function esc(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

export function formatPrice(value: number | null | undefined) {
  if (!value) return 'Prix à confirmer';
  return `${Number(value).toLocaleString('fr-CA')} $/mois`;
}

/** e.g. MER. (15)/07/26 - 20:55 */
export function formatEventDate(iso: string) {
  const date = new Date(iso);
  const weekday = date.toLocaleDateString('fr-FR', { weekday: 'short' }).toUpperCase();
  const day = date.getDate();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${weekday} (${day})/${month}/${year} - ${time}`;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Normalize sheet/free-text dates to YYYY-MM-DD for `<input type="date">`. */
export function parseIsoDateInput(value: string | null | undefined): string {
  if (!value?.trim()) return '';
  const trimmed = value.trim();
  if (ISO_DATE_RE.test(trimmed)) return trimmed;
  const ms = Date.parse(trimmed);
  if (Number.isNaN(ms)) return '';
  const d = new Date(ms);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/** Human-readable French date for copied messages/ads (from calendar YYYY-MM-DD). */
export function formatMessageDate(isoDate: string): string {
  if (!ISO_DATE_RE.test(isoDate)) return isoDate.trim();
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString('fr-CA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const STATUS_LABELS: Record<string, string> = {
  Available: 'Dispo',
  'On Hold': 'Attente',
  'Not Available': 'Non dispo',
  'In Reno': 'Réno',
  Rented: 'Loué',
};

const STATUS_CLASSES: Record<string, string> = {
  Available: 'badge-g',
  'On Hold': 'badge-a',
  'Not Available': 'badge-r',
  'In Reno': 'badge-x',
  Rented: 'badge-admin',
};

export function statusLabel(statut: string) {
  return STATUS_LABELS[statut] ?? statut;
}

export function statusClass(statut: string) {
  return STATUS_CLASSES[statut] ?? 'badge-x';
}
