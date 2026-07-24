import { primaryFrontendOrigin } from '../../config/env.js';

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!
  ));
}

export function safeEmailHeader(value: unknown): string {
  return String(value ?? '')
    .replace(/[\r\n\u0000-\u001f\u007f]+/g, ' ')
    .trim()
    .slice(0, 200);
}

function frontendUrl(path: string) {
  return `${primaryFrontendOrigin()}${path}`;
}

export type EmailContent = { subject: string; html: string; text: string };

type LeadLike = {
  nom: string;
  telephone?: string | null;
  email?: string | null;
  revenu_mensuel?: number | null;
  score_credit?: number | null;
  date_demenagement?: string | null;
  message?: string | null;
  type_demande?: string | null;
};

function leadFieldsText(lead: LeadLike) {
  const lines: string[] = [];
  if (lead.telephone) lines.push(`Téléphone: ${lead.telephone}`);
  if (lead.email) lines.push(`Email: ${lead.email}`);
  if (lead.revenu_mensuel != null) lines.push(`Revenu mensuel: ${lead.revenu_mensuel}$`);
  if (lead.score_credit != null) lines.push(`Score crédit: ${lead.score_credit}`);
  if (lead.date_demenagement) lines.push(`Date déménagement: ${lead.date_demenagement}`);
  if (lead.message) lines.push(`Message: ${lead.message}`);
  return lines.join('\n');
}

export function leadAssignedAgent(input: {
  agentNom: string;
  lead: LeadLike;
  listingAdresse?: string | null;
}): EmailContent {
  const subject = safeEmailHeader(`Nouvelle demande assignée — ${input.lead.nom}`);
  const link = frontendUrl('/app/dashboard');
  const text = [
    `Bonjour ${input.agentNom},`,
    ...leadFieldsText(input.lead).split('\n').filter(Boolean),
    input.listingAdresse ? `Logement: ${input.listingAdresse}` : '',
    `Tableau de bord: ${link}`,
  ].filter(Boolean).join('\n');
  const html = `<p>Bonjour ${escapeHtml(input.agentNom)},</p><p>${escapeHtml(input.lead.nom)}</p>${input.listingAdresse ? `<p>Logement: ${escapeHtml(input.listingAdresse)}</p>` : ''}<p><a href="${escapeHtml(link)}">Ouvrir mon tableau de bord</a></p>`;
  return { subject, html, text };
}

export function mediaApproved(input: {
  agentNom: string;
  originalFilename: string;
  listingAdresse: string;
}): EmailContent {
  const subject = safeEmailHeader(`Média approuvé — ${input.listingAdresse}`);
  const text = `Bonjour ${input.agentNom},\nFichier: ${input.originalFilename}\nLogement: ${input.listingAdresse}\nCe média est maintenant visible publiquement.`;
  const html = `<p>Bonjour ${escapeHtml(input.agentNom)},</p><p>Fichier: ${escapeHtml(input.originalFilename)}</p><p>Logement: ${escapeHtml(input.listingAdresse)}</p><p>Ce média est maintenant visible publiquement.</p>`;
  return { subject, html, text };
}

export function mediaRejected(input: {
  agentNom: string;
  originalFilename: string;
  listingAdresse: string;
  reason?: string | null;
}): EmailContent {
  const subject = safeEmailHeader(`Média refusé — ${input.listingAdresse}`);
  const reasonLine = input.reason ? `Raison : ${input.reason}` : 'Aucune raison fournie.';
  const text = `Bonjour ${input.agentNom},\nFichier: ${input.originalFilename}\nLogement: ${input.listingAdresse}\n${reasonLine}`;
  const html = `<p>Bonjour ${escapeHtml(input.agentNom)},</p><p>Fichier: ${escapeHtml(input.originalFilename)}</p><p>Logement: ${escapeHtml(input.listingAdresse)}</p><p>${escapeHtml(reasonLine)}</p>`;
  return { subject, html, text };
}

export function accountCreated(input: { nom: string; email: string }): EmailContent {
  const loginUrl = frontendUrl('/agent-login');
  const subject = safeEmailHeader('Ton compte LogiGo Agent a été créé');
  const text = [
    `Bonjour ${input.nom},`,
    `Email de connexion: ${input.email}`,
    'Tu recevras un courriel d’invitation séparé pour choisir ton mot de passe.',
    `Ensuite, connecte-toi ici: ${loginUrl}`,
  ].join('\n');
  const html = `<p>Bonjour ${escapeHtml(input.nom)},</p><p>Email de connexion: ${escapeHtml(input.email)}</p><p>Tu recevras un courriel d’invitation séparé pour choisir ton mot de passe.</p><p><a href="${escapeHtml(loginUrl)}">${escapeHtml(loginUrl)}</a></p>`;
  return { subject, html, text };
}

export function testEmail(): EmailContent {
  return {
    subject: safeEmailHeader('Test LogiGo'),
    html: '<p>Email de test LogiGo Agent.</p>',
    text: 'Email de test LogiGo Agent.',
  };
}
