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

## Monitoring

- `GET /health` → `{ ok: true }`
- PM2: `pm2 logs fast-rental-api`
