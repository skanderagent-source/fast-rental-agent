import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockSend = vi.fn();

vi.mock('resend', () => ({
  Resend: vi.fn(() => ({
    emails: { send: (...args: unknown[]) => mockSend(...args) },
  })),
}));

vi.mock('../src/config/env.js', () => ({
  env: {
    EMAIL_ENABLED: false,
    EMAIL_FROM: 'test@example.com',
    EMAIL_REPLY_TO: '',
    RESEND_API_KEY: 're_test',
    FRONTEND_ORIGIN: 'http://localhost:5173',
  },
}));

import { logger } from '../src/config/logger.js';
import { emailService, sendEmail } from '../src/modules/email/email.service.js';
import * as templates from '../src/modules/email/templates.js';

describe('email templates', () => {
  it('exports one function per template with subject/html/text', () => {
    for (const fn of [
      templates.leadReceivedAdmin,
      templates.leadConfirmationClient,
      templates.leadAssignedAgent,
      templates.mediaApproved,
      templates.mediaRejected,
      templates.accountCreated,
    ]) {
      const content = fn({
        nom: 'Jean',
        lead: { nom: 'Jean' },
        agentNom: 'Marie',
        email: 'a@test.com',
        originalFilename: 'a.jpg',
        listingAdresse: '123 Rue',
      } as never);
      expect(content.subject).toBeTruthy();
      expect(content.html).toBeTruthy();
      expect(content.text).toBeTruthy();
    }
  });

  it('account created email contains login URL not password', () => {
    const content = templates.accountCreated({ nom: 'Skander', email: 's@test.com' });
    expect(content.text).toContain('/agent-login');
    expect(content.text.toLowerCase()).not.toContain('secret123');
  });
});

describe('email service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(logger, 'info').mockImplementation(() => undefined);
    vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
  });

  it('logs and skips when EMAIL_ENABLED=false', async () => {
    await emailService.sendTestEmail('agent@test.com');
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'agent@test.com' }),
      'Email skipped (EMAIL_ENABLED=false)',
    );
  });

  it('notifyLeadConfirmationClient skips when disabled', async () => {
    emailService.notifyLeadConfirmationClient('client@test.com', { nom: 'Jean' });
    await new Promise((r) => setTimeout(r, 10));
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'client@test.com' }),
      'Email skipped (EMAIL_ENABLED=false)',
    );
  });

  it('notifyLeadAssignedAgent does not block caller', async () => {
    emailService.notifyLeadAssignedAgent('agent@test.com', {
      agentNom: 'Marie',
      lead: { nom: 'Jean' },
      deleteAfter: '2030-01-01',
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(logger.info).toHaveBeenCalled();
  });

  it('sendEmail never throws when Resend fails', async () => {
    const envMod = await import('../src/config/env.js');
    (envMod.env as { EMAIL_ENABLED: boolean }).EMAIL_ENABLED = true;
    mockSend.mockRejectedValueOnce(new Error('Resend down'));
    await expect(sendEmail({
      to: 'x@test.com',
      subject: 'Test',
      html: '<p>x</p>',
      text: 'x',
    })).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
    (envMod.env as { EMAIL_ENABLED: boolean }).EMAIL_ENABLED = false;
  });
});
