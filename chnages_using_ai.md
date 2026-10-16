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
- **Fixed Nautika / Sealink Seat Layout Missing on Booking Page**:
  - **Layout Key Mismatch in `FerryVesselLayout.tsx`**: `SimplifiedSeatSelectionSection` outputs `vesselClass = "luxury"` or `"royal"`, resulting in `layoutKey = "sealink-luxury"` or `"sealink-royal"`. `FerryVesselLayout` previously only matched `"sealink-premium"` and `"sealink-economy"`, causing all Nautika bookings to fall through to `default: return <div>Default Ferry Layout</div>` (an empty div without seats). Added normalization and resilient handling for Nautika/Sealink so `"luxury"`, `"premium"`, `"deluxe"` render `UpdatedSealinkLuxuryLayout`, and `"royal"`, `"business"`, `"economy"` render `UpdatedSealinkRoyalLayout`.
  - **Class Resolution in `sealinkService.ts: extractSeatLayoutFromTripData`**: Fixed flawed character matching (`.includes("r")` / `.includes("b")`) on UUID IDs that always forced Royal class. Rewrote class matching to use clean class slugs (`-business`, `-royal`, `-premium`, `-luxury`) and exact `seatClassId`s.
  - **Seat Transformer Prioritization in `seatLayoutTransformer.ts`**: Prioritized `seatLayout.seats` in `transformSeatLayoutToSeats` so the selected class's exact seats are used directly with clean seat numbers (e.g. `"1E"`, `"2A"`), avoiding legacy deck mixing.
  - **Defensive Seat Rendering in `UpdatedSealinkLuxuryLayout` and `UpdatedSealinkRoyalLayout`**: Added fallback to `(seat.displayNumber || seat.number || "")` to prevent runtime crashes if `displayNumber` is null or undefined.
  - **API Route Support in `/api/ferry/route.ts`**: Added `case "nautika":` operator alias and supported stripping `nautika-` prefix in `sealinkService.getSeatLayout`.

