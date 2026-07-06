# Cloudflare R2 setup (Phase 11)

## Bucket

1. Create private bucket (e.g. `fast-rental-media`)
2. Do not enable public access

## API token

Create token with Object Read & Write on this bucket only. Record:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`

## CORS (exact JSON)

Allow PUT from frontend origins:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:5173",
      "https://YOUR_FRONTEND_DOMAIN"
    ],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

After Vercel deploy, add production URL and redeploy backend CORS if needed.

## Verification

Upload a listing photo from the agent app. Confirm object appears in R2 and status is `pending` until admin approves.
