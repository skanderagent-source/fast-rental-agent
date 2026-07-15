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
