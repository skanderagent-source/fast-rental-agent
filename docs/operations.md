# Operations

## Security checklist

- [ ] Service role key only on backend/VPS
- [ ] Public signup disabled in Supabase
- [ ] R2 bucket private, signed URLs only
- [ ] CORS limited to frontend origin
- [ ] `.env` files not committed
- [ ] 0006 lockdown applied at cutover
- [ ] Legacy Edge Functions removed after cutover

## Cron jobs (backend)

- Archive lead deletion: daily 03:00 America/Toronto
- Sheet sync: every 6 hours
- Stale media cleanup: daily 03:30

## Geocoding (Nominatim)

After sheet import, new listings are geocoded in the background (1 req / 1.1s, Supabase cache).

For a full batch run (e.g. ~690 addresses after first import):

```bash
npm run geocode
```

Or trigger from admin API (runs in background, returns 202):

`POST /api/admin/geocode/run`

Required env (`apps/backend/.env`):

```env
GEOCODING_PROVIDER=nominatim
GEOCODING_BASE_URL=https://nominatim.openstreetmap.org/search
GEOCODING_USER_AGENT=FastRental/1.0 votre-email@domaine.com
```

Failed addresses stay `latitude = NULL` with `geocoding_status = failed` — fix in admin, then re-run `npm run geocode`.

## Monitoring

- `GET /health` → `{ ok: true }`
- PM2: `pm2 logs fast-rental-api`
