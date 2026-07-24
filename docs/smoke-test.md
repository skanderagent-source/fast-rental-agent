# Manual smoke test checklist (Phase 20)

Run locally after `npm run verify-env`, migrations, and `npm run create-initial-admin`.

## Auth

- [ ] `/` redirects to `/agent-login` (no public login button elsewhere)
- [ ] Login works with admin credentials
- [ ] Forgot password sends reset email (or Supabase log in dev)
- [ ] Forced password change clears `must_change_password`
- [ ] Inactive account cannot access API (403)

## Agent portal

- [ ] Agent cannot see Admin / Ajouter tabs
- [ ] Search filters work; URL reflects filters (`?q=&quartier=`)
- [ ] Listings with approved photos sort first
- [ ] Listing card modals copy WhatsApp/FB messages
- [ ] Referral link uses `VITE_PUBLIC_SITE_URL` (Union Rental URL)
- [ ] Agent can upload photo/video → status `pending`
- [ ] Download button on approved media works
- [ ] Enregistrer une location creates rental row
- [ ] Map shows markers; approximate quartier fallback labeled
- [ ] Demandes: agent sees assigned leads + progress select
- [ ] Profil: profile photo, immediate email/password/phone change (no email-confirm link), calls list, rentals, media statuses
- [ ] Email change sends only “Ton email Logigo a été modifié” (no confirm-new-email messages)
- [ ] Phone change sends “Ton numéro Logigo a été modifié” (not password-changed)

## Admin

- [ ] Admin tab visible
- [ ] Create agent account
- [ ] Deactivate / reactivate / delete agent
- [ ] Add listing + geocoding status shown
- [ ] Edit listing works
- [ ] Demandes badge clears on open; assign archives lead
- [ ] Media approval queue shows previews
- [ ] Sheet sync manual button runs (with Google SA configured)
- [ ] Email test button (`POST /api/admin/email/test`)

## Backend automated

```bash
npm run test
curl http://localhost:4000/health
```

## Union Rental (sister app)

Public lead form and public listing pages are tested on Union Rental (`localhost:5174`), not this app.
