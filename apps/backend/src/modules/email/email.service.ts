import { Resend } from 'resend';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import * as templates from './templates.js';

let resend: Resend | null = null;

function getResend() {
  if (!resend && env.RESEND_API_KEY) {
    resend = new Resend(env.RESEND_API_KEY);
  }
  return resend;
}

export type EmailInput = { to: string; subject: string; html: string; text?: string };

export async function sendEmail(input: EmailInput): Promise<void> {
  if (!env.EMAIL_ENABLED) {
    logger.info({ to: input.to, subject: input.subject }, 'Email skipped (EMAIL_ENABLED=false)');
    return;
  }
  const client = getResend();
  if (!client || !env.EMAIL_FROM) {
    logger.warn('Email not configured');
    return;
  }
  try {
    await client.emails.send({
      from: env.EMAIL_FROM,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: env.EMAIL_REPLY_TO || undefined,
    });
  } catch (err) {
    logger.error({ err, to: input.to, subject: input.subject }, 'Email send failed');
  }
}

export async function sendEmailToMany(
  recipients: string[],
  build: (to: string) => EmailInput,
): Promise<void> {
  await Promise.allSettled(recipients.map((to) => sendEmail(build(to))));
}

async function sendTemplate(to: string, content: templates.EmailContent) {
  await sendEmail({ to, ...content });
}

export const emailService = {
  notifyLeadAssignedAgent: (
    to: string,
    input: Parameters<typeof templates.leadAssignedAgent>[0],
  ) => void sendTemplate(to, templates.leadAssignedAgent(input)),

  notifyMediaApproved: (
    to: string,
    input: Parameters<typeof templates.mediaApproved>[0],
  ) => void sendTemplate(to, templates.mediaApproved(input)),

  notifyMediaRejected: (
    to: string,
    input: Parameters<typeof templates.mediaRejected>[0],
  ) => void sendTemplate(to, templates.mediaRejected(input)),

  notifyAccountCreated: (
    to: string,
    input: Parameters<typeof templates.accountCreated>[0],
  ) => void sendTemplate(to, templates.accountCreated(input)),

  sendTestEmail: (to: string) => void sendTemplate(to, templates.testEmail()),
};
