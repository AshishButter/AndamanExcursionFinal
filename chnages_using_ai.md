# Changes using AI

- Investigated disk space issue (`ENOSPC`) and cleared Next.js cache.
- Investigated Sealink Ferry API timeout issues and Makruzz credential errors.
- Added and subsequently removed temporary test API route and frontend page for Sealink API.
- Included prior pending fixes for PhonePe integration and PDF generation to be merged into production main repo.
- Fixed environment variable initialization order in `sealinkService.ts`, `makruzzService.ts`, and `greenOceanService.ts` by using getters instead of static fields.
- Updated `SEALINK_API_URL` in `.env` to `https://apitest.gonautika.com`.
- **Migrated Sealink integration to GoNautika Agency API v2**:
  - Replaced legacy endpoints (`getProfile`, `getTripData`, `bookSeats`) with official RESTful GoNautika v2 endpoints (`/api/v2/agency`, `/api/v2/trips`, `/api/v2/seat-holds`, `/api/v2/bookings`).
  - Implemented HMAC-SHA256 request signing protocol (`X-Nautika-Timestamp` and `X-Nautika-Signature`) with `clientId` as key and `Authorization: Bearer <apiKey>`.
  - Implemented the 2-step booking workflow: holds seats first via `POST /api/v2/seat-holds` to get `reservationId`s, then calls `POST /api/v2/bookings` with `Idempotency-Key` and passenger reservations. If booking encounters an error (e.g., wallet funds), active holds are cleaned up immediately with `DELETE /api/v2/seat-holds`.
  - **Fixed PNR Extraction**: In v2, the booking response returns `{ bookingReference: string, tickets: [{ pnr: string, ... }] }`. Corrected extraction so `pnr` is read from `tickets[0].pnr` rather than the root level, resolving the incorrect/undefined PNR issue.
  - Updated `FerryAggregationService.checkSealinkHealth()` to query `SealinkService.testAuthentication()` directly against `/api/v2/agency`.
