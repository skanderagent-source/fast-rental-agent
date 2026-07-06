# Database

Migrations in `supabase/migrations/`:

| File | Purpose |
|------|---------|
| 0001_init.sql | Tables, views, media reservation function |
| 0002_rls.sql | Row level security policies |
| 0003_functions_and_triggers.sql | updated_at, lead archive trigger |
| 0004_seed_admin.sql | app_settings defaults |
| 0005_backfill_assigned_leads.sql | Legacy lead archive backfill |
| 0006_lockdown_legacy_policies.sql | Cutover only — lock anon direct access |

Backup before applying:

```bash
npx supabase db dump --linked -f backup_before_split.sql
```
