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

function securityNotificationEmail(input: {
  title: string;
  subject: string;
  body: string;
  warning: string;
}): EmailContent {
  const subject = safeEmailHeader(input.subject);
  const title = escapeHtml(input.title);
  const body = escapeHtml(input.body);
  const warning = escapeHtml(input.warning);
  const text = [input.title, input.body, input.warning, 'Si c’était bien toi, aucune action n’est requise.'].join('\n\n');
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#111111;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#111111;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:400px;background-color:#1c1c1e;border:1px solid #3a3a3c;border-radius:20px;">
          <tr>
            <td align="center" style="padding:36px 32px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
              <img
                src="https://www.logigo-agent.ca/icon-192.png"
                width="52"
                height="52"
                alt="Logigo"
                style="display:block;border:0;border-radius:12px;margin:0 auto 20px;"
              >
              <h1 style="margin:0 0 8px;font-size:26px;font-weight:800;line-height:1.2;letter-spacing:-0.02em;color:#f2f2f7;">
                ${title}
              </h1>
              <p style="margin:0 0 24px;font-size:14px;font-weight:500;line-height:1.45;color:#aeaeb2;">
                ${body}
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;">
                <tr>
                  <td style="padding:14px 16px;background-color:#3d2e00;border:1px solid rgba(255,214,10,0.25);border-radius:8px;text-align:left;">
                    <p style="margin:0;font-size:13px;line-height:1.45;color:#ffd60a;">
                      ${warning}
                    </p>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:12px;line-height:1.45;color:#6e6e73;">
                Si c’était bien toi, aucune action n’est requise. Réservé aux agents autorisés.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  return { subject, html, text };
}

export function phoneChanged(input: { phone?: string | null }): EmailContent {
  const phoneLine = input.phone?.trim()
    ? ` Nouveau numéro : ${input.phone.trim()}.`
    : '';
  return securityNotificationEmail({
    title: 'Numéro de téléphone modifié',
    subject: 'Ton numéro Logigo a été modifié',
    body: `Le numéro de téléphone de ton compte Logigo Agent vient d’être changé.${phoneLine}`,
    warning: 'Si tu n’as pas fait ce changement, contacte un administrateur tout de suite.',
  });
}

export function emailChanged(input: { oldEmail: string; newEmail: string }): EmailContent {
  return securityNotificationEmail({
    title: 'Adresse email modifiée',
    subject: 'Ton email Logigo a été modifié',
    body: `L’email de ton compte Logigo Agent a été changé de ${input.oldEmail} vers ${input.newEmail}.`,
    warning: 'Si tu n’as pas fait ce changement, réinitialise ton mot de passe tout de suite et contacte un administrateur.',
  });
}

export function testEmail(): EmailContent {
  return {
    subject: safeEmailHeader('Test Logigo'),
    html: '<p>Email de test Logigo Agent.</p>',
    text: 'Email de test Logigo Agent.',
  };
}
