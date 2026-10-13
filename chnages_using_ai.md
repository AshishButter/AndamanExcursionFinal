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
- **Investigated "Booking Pending" on Live Production (`andamanexcursion.com`)**:
  - Investigated MongoDB booking `ACXA0S6465` created at `2026-10-12 15:17 IST`.
  - Root cause: The live production server was deployed from the `production` git remote (`AshishButter/AndamanExcursionFinal.git`), which was still running the pre-v2 code (`06171bd`). The old code sent `Content-Type: text/plain` to `bookSeats`, resulting in `HTTP 415 Unsupported Media Type`, causing `booking.status` to remain `"pending"` and disabling the ticket download button on the checkout step.
  - Enhanced `ferryBookingService.ts` to pass `date: request.date` into `bookingData`.
  - Enhanced `sealinkService.ts` to use `bookingData.date` and `preferredRoute` during trip re-fetching (ensuring serverless cold starts never fail to locate the trip), added auto-assign seat fallback, and improved passenger name handling.

