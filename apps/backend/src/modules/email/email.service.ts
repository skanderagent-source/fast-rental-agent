import { Resend } from 'resend';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { redactedEmailRecipient } from '../../utils/logRedaction.js';
import * as templates from './templates.js';
import {
  parseConfiguredReplyTo,
  parseRecipientEmail,
  sanitizeEmailSubject,
} from './emailValidation.js';

let resend: Resend | null = null;

function getResend() {
  if (!resend && env.RESEND_API_KEY) {
    resend = new Resend(env.RESEND_API_KEY);
  }
  return resend;
}

export type EmailInput = { to: string; subject: string; html: string; text?: string };

export async function sendEmail(input: EmailInput): Promise<void> {
  const to = parseRecipientEmail(input.to);
  const subject = sanitizeEmailSubject(input.subject);
  if (!subject) {
    logger.warn({ ...redactedEmailRecipient(to) }, 'Email skipped — empty subject after sanitization');
    return;
  }

  if (!env.EMAIL_ENABLED) {
    logger.info({ ...redactedEmailRecipient(to), subject }, 'Email skipped (EMAIL_ENABLED=false)');
    return;
  }
  const client = getResend();
  if (!client || !env.EMAIL_FROM) {
    logger.warn('Email not configured');
    return;
  }
  const replyTo = parseConfiguredReplyTo(env.EMAIL_REPLY_TO);
  try {
    await client.emails.send({
      from: env.EMAIL_FROM,
      to,
      subject,
      html: input.html,
      text: input.text,
      replyTo,
    });
  } catch (err) {
    logger.error({ err, ...redactedEmailRecipient(to), subject }, 'Email send failed');
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

  notifyPhoneChanged: (
    to: string,
    input: Parameters<typeof templates.phoneChanged>[0] = {},
  ) => void sendTemplate(to, templates.phoneChanged(input)),

  notifyEmailChanged: (
    to: string,
    input: Parameters<typeof templates.emailChanged>[0],
  ) => void sendTemplate(to, templates.emailChanged(input)),

  sendTestEmail: (to: string) => void sendTemplate(to, templates.testEmail()),
};
