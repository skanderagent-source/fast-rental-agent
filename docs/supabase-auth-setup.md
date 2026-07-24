# Supabase Auth dashboard setup (Phase 4)

Project ref: `twkqsaupojldddclgpqj`

## Before cutover

1. **Backup**: `npx supabase db dump -f backup-$(date +%F).sql`
2. **Authentication → Providers**: Email enabled; disable public sign-ups
3. **Authentication → URL Configuration**:
   - Site URL: production agent frontend (e.g. `https://www.logigo-agent.ca`)
   - Redirect URLs (add all — exact paths required; otherwise Supabase falls back to Site URL `/` and reset/invite flows break):
     - `http://localhost:5173/auth/reset-password`
     - `http://localhost:5173/auth/accept-invite`
     - `http://localhost:5173/auth/force-password-change`
     - `https://www.logigo-agent.ca/auth/reset-password`
     - `https://www.logigo-agent.ca/auth/accept-invite`
     - `https://www.logigo-agent.ca/auth/force-password-change`
   - After saving, a password-reset email’s `redirect_to` must include `/auth/reset-password` (not only the domain root).
4. **Authentication → Sign In / Providers → Email**:
   - Keep **public sign-ups disabled**. Agents are created only via admin invite (`inviteUserByEmail`).
   - Require email confirmation for any future self-service signup flow (public signup remains disabled).
   - Set **Email OTP expiration to 900 seconds (15 minutes)**. This same signed, single-use expiry applies to confirmation, recovery, invitation, magic-link, and email-change links.
   - Keep the per-user resend/recovery cooldown at **60 seconds or longer**.
5. **Invite onboarding**:
   - Admin panel → **Inviter un agent** sends a Supabase invite email.
   - Invitees open `/auth/accept-invite`, set their password, and enter the app.
   - There is no public signup button or open registration route.
6. **Authentication → Rate Limits**:
   - Keep Supabase's IP limits enabled for password/token verification.
   - With Custom SMTP, set a conservative project email-send budget suitable for the small internal workforce (start at 20/hour and raise only from observed demand).
   - Do not weaken OTP verification or token-refresh limits.
7. **Authentication → Security and Protection**:
   - Enable **Require current password to change password**.
   - Enable secure password-change reauthentication for sessions that are not recent.
   - Keep leaked-password protection enabled when available on the project plan.
8. **Authentication → Sessions**:
   - Keep refresh-token rotation enabled and the reuse interval at the provider default or lower.
   - Set JWT expiry to **1 hour**.
   - Set inactivity timeout to **30 minutes**.
   - Set absolute/time-box session lifetime to **8 hours**.
   - Reassess these values if agents must remain signed in during longer field work; do not disable both lifetime controls.
9. Record keys in `apps/backend/.env` and `apps/frontend/.env`:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (backend only)

## After cutover (Phase 26)

Configure Custom SMTP via Resend in Supabase Auth → SMTP Settings.

## Security ownership

- Supabase Auth issues, signs, expires, consumes, and revokes email verification and password recovery tokens. The application does not implement a second token format.
- Supabase Auth stores password hashes using bcrypt with a random salt. Passwords and password hashes are never stored in application tables.
- The frontend revokes all sessions after password recovery and revokes other sessions after an authenticated password change.
- Password reset responses remain generic so account existence is not disclosed.
- Supabase's rate limits are the security boundary for login, recovery, email verification, OTP, and resend because these requests go directly from the browser to Supabase Auth.
- Password login creates a fresh Supabase session, and email/password changes refresh the current session. Password changes revoke other sessions and recovery revokes all sessions.
- Logout calls Supabase Auth's global sign-out. Session state and refresh-token revocation are stored by Supabase, never in Node process memory.
- The SPA sends access tokens in the `Authorization` header and does not authenticate with cookies. Session-cookie flags, cookie signing, and CSRF tokens are therefore not applicable. If authentication moves to cookies, `HttpOnly`, `Secure`, `SameSite`, `__Host-` naming, and CSRF protection become mandatory before deployment.
- Avoid automatic hard account lockout: it permits an attacker to deny access to a known agent. Investigate repeated failures and deactivate an account administratively when compromise is suspected.
- Checkout, payment, and customer reservation endpoints do not exist in Fast Rental.

## Verification

```bash
npm run verify-env
npm run create-initial-admin
curl -s http://localhost:4000/health
```

Attempt sign-up via Supabase client should fail when sign-ups are disabled.

Manually verify with a test admin:

1. Admin API routes succeed with a valid admin session and named permissions.
2. A recovery link expires after 15 minutes and fails after first use.
3. Repeated recovery requests are throttled without revealing whether the email exists.
