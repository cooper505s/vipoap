# Remote-support recordings

Remote-support media is stored in a private Cloudflare R2 bucket. VIPOAP KV stores only consent, lifecycle, retention and object-reference metadata.

Production setup:

1. Create a private R2 bucket, recommended name `vipoap-remote-recordings`.
2. Add the bucket to the Pages project as the `REMOTE_RECORDINGS` binding.
3. Set `RECORDING_RETENTION_DAYS` to the approved retention period (the application defaults to 90 days and limits configuration to 30–365 days).
4. Do not enable an `r2.dev` address or public custom domain for this bucket.
5. Verify with a test remote appointment: record consent, start, pause, resume, stop, upload and permission-protected download.

Recordings are rejected without consent, a known content length, an approved WebM/MP4 media type, or when larger than 100 MB. Customer passwords, PINs, recovery codes and payment details must never be captured. Pause recording before sensitive information is shown.
