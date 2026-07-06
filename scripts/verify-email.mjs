#!/usr/bin/env node
/**
 * Phase 26: Verify email configuration (dev skip + optional live send).
 */
import { backendEnv } from './lib/env.mjs';

const env = { ...backendEnv(), ...process.env };

if (env.EMAIL_ENABLED !== 'true') {
  console.log('✓ EMAIL_ENABLED=false — emails log only (local dev default)');
  process.exit(0);
}

if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
  console.error('EMAIL_ENABLED=true requires RESEND_API_KEY and EMAIL_FROM');
  process.exit(1);
}

const to = process.env.EMAIL_TEST_TO ?? env.EMAIL_REPLY_TO;
if (!to) {
  console.log('✓ Resend configured. Set EMAIL_TEST_TO to send a live test.');
  process.exit(0);
}

const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${env.RESEND_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    from: env.EMAIL_FROM,
    to: [to],
    subject: 'LogiGo verify-email',
    html: '<p>Email verification OK.</p>',
  }),
});

if (!res.ok) {
  console.error('✗ Resend API error:', await res.text());
  process.exit(1);
}
console.log('✓ Live test email sent to', to);
