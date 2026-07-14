# Cloudflare R2 setup (Phase 11)

R2 is Cloudflare’s object storage. The backend talks to it through the **S3-compatible API** — same protocol many tools use, but your files stay in **R2**, not Amazon S3.

## Bucket

1. Create private bucket (e.g. `fast-rental-media`)
2. Do not enable public access

## API token

Create token with **Object Read & Write** on this bucket. You need the **S3-compatible** access key pair (Access Key ID + Secret Access Key), not a general Cloudflare `cfat_` API token.

Record:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`

## CORS (exact JSON)

Allow PUT from frontend origins (only needed if uploading directly to R2 signed URLs).
When using the API proxy upload (`PUT /api/listings/:id/media/:mediaId/file`), CORS on R2 is optional.

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

Upload a listing photo from the agent app (phone or computer). The file goes through the API and is stored in R2. It appears immediately after upload — no admin approval.

Optional — apply CORS for direct-to-R2 uploads: `npm run configure-r2-cors` (or paste `deploy/r2-cors.json` in the Cloudflare dashboard).
