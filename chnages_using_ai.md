# Changes using AI

- Investigated disk space issue (`ENOSPC`) and cleared Next.js cache.
- Investigated Sealink Ferry API timeout issues and Makruzz credential errors.
- Added and subsequently removed temporary test API route and frontend page for Sealink API.
- Included prior pending fixes for PhonePe integration and PDF generation to be merged into production main repo.
- Fixed environment variable initialization order in `sealinkService.ts`, `makruzzService.ts`, and `greenOceanService.ts` by using getters instead of static fields.
- Updated `SEALINK_API_URL` in `.env` to the correct working endpoint (`https://api.gonautika.com/`).
