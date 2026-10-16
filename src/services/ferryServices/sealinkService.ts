// src/services/ferryServices/sealinkService.ts
import { FerryCache } from "@/utils/ferryCache";
import {
  FerrySearchParams,
  UnifiedFerryResult,
  FerryClass,
  SeatLayout,
} from "@/types/FerryBookingSession.types";
import { LocationMappingService } from "./locationMappingService";
import { createHmac, randomUUID } from "node:crypto";

export interface GoNautikaSeat {
  seatId: string;
  seatNumber: string;
  deck: string;
  isAvailable: boolean;
  isBooked: boolean;
  isBlocked: boolean;
}

export interface GoNautikaSeatClass {
  seatClassId: string;
  seatClassName: string;
  baseFare: number;
  infantFare: number;
  availableSeatCount: number;
  seats: GoNautikaSeat[];
}

export interface GoNautikaTrip {
  tripId: string;
  origin: string;
  destination: string;
  tripDate: string;
  departureTime: string;
  arrivalTime: string;
  departsAt: string;
  vesselId: string;
  vesselName: string;
  seatClasses: GoNautikaSeatClass[];

  // Compatibility aliases for legacy consumers
  id?: string;
  vesselID?: string | number;
  from?: string;
  to?: string;
}

export interface GoNautikaAgencyInfo {
  agencyId: string;
  agencyName: string;
  phoneNumber?: string;
  email?: string;
  walletBalance: number;
  overdraftLimit?: number;
  availableFunds?: number;
}

export interface GoNautikaHoldResponse {
  tripId: string;
  expiresAt: string;
  seats: Array<{
    reservationId: string;
    seatId: string;
    seatNumber: string;
    isSelected: boolean;
  }>;
}

export interface GoNautikaBookingResponse {
  bookingReference: string;
  status: string;
  tickets: Array<{
    pnr: string;
    tripId: string;
    status: string;
  }>;
  charge: {
    totalFare: number;
    totalPassengerLevy: number;
    totalFuelSurcharge: number;
    tradeDiscountAmount: number;
    amountCharged: number;
  };
}

export type SealinkTripData = GoNautikaTrip;

export interface SealinkBookingRequest {
  id?: string;
  tripId: string | number;
  vesselID?: string | number;
  from: string;
  to: string;
  date?: string;
  bookingTS?: number;
  paxDetail: {
    email: string;
    phone: string;
    gstin?: string;
    pax: Array<{
      name: string;
      age: string | number;
      gender: string;
      nationality?: string;
      photoId?: string;
      passport?: string;
      expiry?: string;
      seat: string;
      tier?: string;
    }>;
    infantPax?: Array<{
      name: string;
      dob?: string;
      dobTS?: number;
      gender?: string;
      age?: string | number;
      nationality?: string;
    }>;
  };
  userData?: {
    apiUser?: {
      userName?: string;
      agency?: string;
      token?: string;
      walletBalance?: number;
    };
  };
  paymentData?: {
    gstin?: string;
  };
}

export class SealinkService {
  /**
   * Root API Base URL normalized without trailing slashes or subpaths
   */
  private static get BASE_URL(): string {
    const raw = process.env.SEALINK_API_URL || "https://apitest.gonautika.com";
    return raw.replace(/\/+$/, "").replace(/\/api\/v2\/?$/, "");
  }

  /**
   * Agency Client ID (used as HMAC signing key)
   */
  private static get USERNAME(): string {
    return process.env.SEALINK_USERNAME || "";
  }

  /**
   * Agency API Key (used as Bearer token)
   */
  private static get TOKEN(): string {
    return process.env.SEALINK_TOKEN || "";
  }

  private static readonly tripDataCache = new Map<string, GoNautikaTrip>();

  /**
   * Validate presence of credentials
   */
  private static validateCredentials(): { clientId: string; apiKey: string } {
    if (!this.USERNAME || !this.TOKEN) {
      throw new Error(
        "Sealink/GoNautika credentials not found. Please set SEALINK_USERNAME and SEALINK_TOKEN in your .env file"
      );
    }
    return {
      clientId: this.USERNAME,
      apiKey: this.TOKEN,
    };
  }

  /**
   * Signs and sends a request conforming to GoNautika Agency API v2 specification
   * String to sign: {METHOD}\n{pathAndQuery}\n{timestamp}\n{rawBody}
   */
  private static async sendV2Request<T = any>(
    method: string,
    pathAndQuery: string,
    body?: any,
    idempotencyKey?: string,
    timeoutMs: number = 30000
  ): Promise<{ status: number; body: T }> {
    const { clientId, apiKey } = this.validateCredentials();

    const raw = body === undefined ? "" : JSON.stringify(body);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = `${method.toUpperCase()}\n${pathAndQuery}\n${timestamp}\n${raw}`;
    const signature = createHmac("sha256", clientId).update(payload).digest("hex");

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "X-Nautika-Timestamp": timestamp,
      "X-Nautika-Signature": signature,
      Accept: "application/json",
    };

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    if (idempotencyKey) {
      headers["Idempotency-Key"] = idempotencyKey;
    }

    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${this.BASE_URL}${pathAndQuery}`, {
        method: method.toUpperCase(),
        headers,
        body: body === undefined ? undefined : raw,
        signal: controller.signal,
      });

      const responseText = await response.text();
      let responseBody: any = null;

      if (responseText) {
        try {
          responseBody = JSON.parse(responseText);
        } catch {
          responseBody = responseText;
        }
      }

      return {
        status: response.status,
        body: responseBody,
      };
    } finally {
      clearTimeout(timeoutTimer);
    }
  }

  /**
   * Test authentication against GoNautika API v2
   */
  static async testAuthentication(): Promise<boolean> {
    try {
      console.log("Sealink: Testing GoNautika API v2 authentication...");
      const { status, body } = await this.sendV2Request<GoNautikaAgencyInfo>(
        "GET",
        "/api/v2/agency"
      );

      if (status === 200 && body) {
        console.log("Sealink authentication successful:", {
          agencyName: body.agencyName,
          walletBalance: body.walletBalance,
          availableFunds: body.availableFunds,
        });
        return true;
      }

      console.error("Sealink authentication rejected:", { status, body });
      return false;
    } catch (error) {
      console.error("Sealink authentication error:", error);
      return false;
    }
  }

  /**
   * Search trips on GoNautika API v2
   */
  static async searchTrips(
    params: FerrySearchParams
  ): Promise<UnifiedFerryResult[]> {
    console.log(
      `Sealink Service: Starting v2 search for ${params.from} → ${params.to} on ${params.date}`
    );

    this.validateCredentials();

    if (
      !LocationMappingService.isRouteSupported(
        "sealink",
        params.from,
        params.to
      )
    ) {
      console.log(
        `Sealink does not support route: ${params.from} → ${params.to}`
      );
      return [];
    }

    const cacheKey = FerryCache.generateKey(params, "sealink");
    const cached = FerryCache.get(cacheKey);
    if (cached) {
      console.log(`Sealink: Using cached results for ${cacheKey}`);
      return cached;
    }

    const fromLocation = LocationMappingService.getSealinkLocation(params.from);
    const toLocation = LocationMappingService.getSealinkLocation(params.to);
    const formattedDate = this.formatDateForSealink(params.date);

    console.log(`Sealink location mapping:`, {
      originalFrom: params.from,
      mappedFrom: fromLocation,
      originalTo: params.to,
      mappedTo: toLocation,
      date: formattedDate,
    });

    const pathAndQuery = `/api/v2/trips?origin=${encodeURIComponent(
      fromLocation
    )}&destination=${encodeURIComponent(toLocation)}&date=${formattedDate}`;

    try {
      const { status, body } = await this.sendV2Request<GoNautikaTrip[]>(
        "GET",
        pathAndQuery
      );

      if (status !== 200) {
        console.error("Sealink search API error:", { status, body });
        return [];
      }

      if (!Array.isArray(body) || body.length === 0) {
        console.log("No trips found for Sealink on date:", formattedDate);
        return [];
      }

      // Cache raw trips
      body.forEach((trip) => {
        // Populate backward-compatible properties
        trip.id = trip.tripId;
        trip.vesselID = trip.vesselId;
        trip.from = trip.origin;
        trip.to = trip.destination;

        this.tripDataCache.set(trip.tripId, trip);
        this.tripDataCache.set(`sealink-${trip.tripId}`, trip);
      });

      const unifiedResults = body.map((trip) =>
        this.transformToUnifiedFormat(trip, params)
      );

      FerryCache.set(cacheKey, unifiedResults);
      console.log(`Sealink: Found ${unifiedResults.length} trips`);
      return unifiedResults;
    } catch (error) {
      console.error("Sealink search error:", error);
      return [];
    }
  }

  /**
   * Format date into ISO YYYY-MM-DD format as required by GoNautika v2
   */
  private static formatDateForSealink(dateString: string): string {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      const day = date.getDate().toString().padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
    return dateString;
  }

  /**
   * Transform GoNautika v2 trip to UnifiedFerryResult
   */
  private static transformToUnifiedFormat(
    trip: GoNautikaTrip,
    params: FerrySearchParams
  ): UnifiedFerryResult {
    const fuelSurcharge = 350;
    const passengerLevy = 50;
    const feesAndSurcharges = fuelSurcharge + passengerLevy;

    const classes: FerryClass[] = [];
    let totalSeatsAcrossClasses = 0;
    let availableSeatsAcrossClasses = 0;
    let minBaseFare = Number.MAX_SAFE_INTEGER;

    for (const sc of trip.seatClasses || []) {
      const isRoyal =
        sc.seatClassName.toLowerCase().includes("royal") ||
        sc.seatClassName.toLowerCase().includes("business");
      const classSlug = isRoyal ? "business" : "premium";
      const tier: "B" | "P" = isRoyal ? "B" : "P";

      const totalClassPrice = sc.baseFare + feesAndSurcharges;
      if (sc.baseFare < minBaseFare) {
        minBaseFare = sc.baseFare;
      }

      totalSeatsAcrossClasses += sc.seats?.length || 0;
      availableSeatsAcrossClasses += sc.availableSeatCount || 0;

      classes.push({
        id: `${trip.tripId}-${classSlug}`,
        name: sc.seatClassName,
        className: sc.seatClassName,
        price: totalClassPrice,
        availableSeats: sc.availableSeatCount,
        amenities: isRoyal
          ? ["Royal Seating", "Air Conditioning", "Priority Boarding"]
          : ["Air Conditioning", "Comfortable Seating"],
        seatLayout: this.createSeatLayout(sc.seats, tier, trip),
        pricing: {
          basePrice: sc.baseFare,
          taxes: 0,
          fees: passengerLevy,
          fuelSurcharge: fuelSurcharge,
          total: totalClassPrice,
        },
      });
    }

    if (minBaseFare === Number.MAX_SAFE_INTEGER) {
      minBaseFare = 0;
    }

    const departureHHmm = trip.departureTime?.substring(0, 5) || "00:00";
    const arrivalHHmm = trip.arrivalTime?.substring(0, 5) || "00:00";

    return {
      id: `sealink-${trip.tripId}`,
      operator: "sealink",
      operatorFerryId: trip.tripId,
      ferryName: trip.vesselName || "Nautika",
      route: {
        from: { name: trip.origin, code: this.getLocationCode(trip.origin) },
        to: { name: trip.destination, code: this.getLocationCode(trip.destination) },
        fromCode: this.getLocationCode(trip.origin),
        toCode: this.getLocationCode(trip.destination),
      },
      schedule: {
        departureTime: departureHHmm,
        arrivalTime: arrivalHHmm,
        duration: this.calculateDuration(trip.departureTime, trip.arrivalTime),
        date: params.date,
      },
      classes,
      availability: {
        totalSeats: totalSeatsAcrossClasses,
        availableSeats: availableSeatsAcrossClasses,
        lastUpdated: new Date().toISOString(),
      },
      pricing: {
        baseFare: minBaseFare,
        taxes: 0,
        portFee: passengerLevy,
        total: minBaseFare + feesAndSurcharges,
        currency: "INR",
      },
      features: {
        supportsSeatSelection: true,
        supportsAutoAssignment: true,
        hasWiFi: false,
        hasAC: true,
        mealIncluded: false,
      },
      operatorData: {
        originalResponse: {
          ...trip,
          id: trip.tripId,
          tripId: trip.tripId,
          vesselID: trip.vesselId,
        },
        bookingEndpoint: "bookSeats",
      },
      isActive: true,
    };
  }

  /**
   * Book seats using GoNautika API v2
   * Step 1: POST /api/v2/seat-holds
   * Step 2: POST /api/v2/bookings (with Idempotency-Key)
   */
  static async bookSeats(bookingData: SealinkBookingRequest): Promise<any> {
    let heldReservationIds: string[] = [];

    try {
      console.log("Sealink: Starting GoNautika v2 seat booking...", {
        tripId: bookingData.tripId || bookingData.id,
        passengersCount: bookingData.paxDetail?.pax?.length,
        seats: bookingData.paxDetail?.pax?.map((p) => p.seat),
      });

      const rawTripId = String(bookingData.tripId || bookingData.id || "");
      const cleanTripId = rawTripId.replace("sealink-", "");

      // 1. Resolve trip data from cache or refetch
      let trip = this.tripDataCache.get(cleanTripId);
      if (!trip) {
        console.warn(`Trip data not in cache for ${cleanTripId}, attempting refetch...`);
        const travelDate =
          bookingData.date ||
          (bookingData.bookingTS
            ? new Date(bookingData.bookingTS * 1000).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0]);

        const preferredRoute =
          bookingData.from && bookingData.to
            ? { from: bookingData.from, to: bookingData.to }
            : undefined;

        const refetched = await this.refetchTripDataForSeatLayout(
          cleanTripId,
          travelDate,
          preferredRoute
        );
        if (refetched) {
          trip = refetched;
        }
      }

      if (!trip) {
        throw new Error(
          `Trip data not found for ID: ${cleanTripId}. Cannot locate seats for booking.`
        );
      }

      // 2. Map requested seat numbers to seatIds (UUIDs)
      const seatNumberToId = new Map<string, string>();
      for (const sc of trip.seatClasses || []) {
        for (const s of sc.seats || []) {
          seatNumberToId.set(s.seatNumber.toUpperCase().trim(), s.seatId);
        }
      }

      const allSeats = (trip.seatClasses || []).flatMap((sc) => sc.seats || []);
      const ticketedPassengers = bookingData.paxDetail?.pax || [];
      const seatIdsToHold: string[] = [];

      for (const p of ticketedPassengers) {
        const rawSeat = (p.seat || "").toUpperCase().trim();
        let seatId = rawSeat ? seatNumberToId.get(rawSeat) : undefined;

        // Fallback: If seat not found or was auto-assigned/empty, pick first available seat
        if (!seatId) {
          const availableSeat = allSeats.find(
            (s) => s.isAvailable && !s.isBooked && !s.isBlocked && !seatIdsToHold.includes(s.seatId)
          );
          if (availableSeat) {
            seatId = availableSeat.seatId;
            p.seat = availableSeat.seatNumber;
            console.log(
              `Sealink v2: Auto-assigned available seat ${availableSeat.seatNumber} for passenger ${p.name}`
            );
          } else {
            throw new Error(
              `Seat number "${p.seat}" could not be found or held on trip ${trip.tripId}. Available seats may have changed.`
            );
          }
        }
        seatIdsToHold.push(seatId);
      }

      // 3. Step 1: Hold seats via POST /api/v2/seat-holds
      console.log("Sealink v2: Holding seats...", {
        tripId: trip.tripId,
        seatIds: seatIdsToHold,
      });

      const holdRes = await this.sendV2Request<GoNautikaHoldResponse>(
        "POST",
        "/api/v2/seat-holds",
        {
          tripId: trip.tripId,
          seatIds: seatIdsToHold,
        }
      );

      if (holdRes.status !== 201 || !holdRes.body?.seats) {
        const errorDetail =
          (holdRes.body as any)?.detail ||
          (holdRes.body as any)?.title ||
          JSON.stringify(holdRes.body);
        throw new Error(`Failed to hold seats: ${errorDetail}`);
      }

      heldReservationIds = holdRes.body.seats.map((s) => s.reservationId);
      console.log("Sealink v2: Seats held successfully:", {
        heldCount: heldReservationIds.length,
        expiresAt: holdRes.body.expiresAt,
      });

      // 4. Step 2: Prepare passengers with reservationIds
      const seatIdToResId = new Map<string, string>();
      const seatNumToResId = new Map<string, string>();
      for (const s of holdRes.body.seats) {
        seatIdToResId.set(s.seatId, s.reservationId);
        if (s.seatNumber) {
          seatNumToResId.set(s.seatNumber.toUpperCase().trim(), s.reservationId);
        }
      }

      const bookingPassengers = ticketedPassengers.map((p, idx) => {
        const seatNum = (p.seat || "").toUpperCase().trim();
        const seatId = seatNumberToId.get(seatNum);
        const reservationId =
          (seatId ? seatIdToResId.get(seatId) : undefined) ||
          seatNumToResId.get(seatNum);

        if (!reservationId) {
          throw new Error(`No reservation ID found for seat ${p.seat}`);
        }

        const fullName = (p.name || "").trim();
        const nameParts = fullName.split(/\s+/);
        const firstName = nameParts[0] || `Passenger${idx + 1}`;
        const lastName = nameParts.slice(1).join(" ") || nameParts[0] || "Guest";

        const genderNormalized =
          p.gender === "Female" || p.gender === "F" || p.gender === "female"
            ? "F"
            : "M";

        const ageNum =
          typeof p.age === "number" ? p.age : parseInt(String(p.age), 10) || 30;

        const nationalityNorm =
          p.nationality === "Indian" || !p.nationality
            ? "India"
            : p.nationality;

        const passengerObj: any = {
          reservationId,
          firstName,
          lastName,
          gender: genderNormalized,
          age: ageNum,
          nationality: nationalityNorm,
        };

        if (p.passport || p.photoId) {
          passengerObj.passportNumber = p.passport || p.photoId;
        }

        return passengerObj;
      });

      // Add infant passengers (infants take no seat and carry no reservationId)
      for (const infant of bookingData.paxDetail.infantPax || []) {
        const infantFullName = (infant.name || "").trim();
        const nameParts = infantFullName.split(/\s+/);
        const firstName = nameParts[0] || "Infant";
        const lastName = nameParts.slice(1).join(" ") || ".";
        const genderNorm =
          infant.gender === "Female" || infant.gender === "F" ? "F" : "M";

        bookingPassengers.push({
          firstName,
          lastName,
          gender: genderNorm,
          age: infant.age ? parseInt(String(infant.age), 10) : 1,
          nationality: "India",
        });
      }

      // Format contact phone (digits only)
      let phone = (bookingData.paxDetail.phone || "").replace(/\D/g, "");
      if (phone.length === 12 && phone.startsWith("91")) {
        phone = phone.substring(2);
      }
      if (!phone) {
        phone = "9999999999";
      }

      const bookingPayload = {
        reservationIds: heldReservationIds,
        passengers: bookingPassengers,
        contact: {
          email: bookingData.paxDetail.email || "support@andamanexcursion.com",
          phone: phone,
        },
        remarks: `Booking via Andaman Excursion (${bookingData.from} to ${bookingData.to})`,
      };

      const idempotencyKey = randomUUID();

      console.log("Sealink v2: Submitting booking...", {
        idempotencyKey,
        reservationCount: heldReservationIds.length,
        passengersCount: bookingPassengers.length,
      });

      const bookRes = await this.sendV2Request<GoNautikaBookingResponse>(
        "POST",
        "/api/v2/bookings",
        bookingPayload,
        idempotencyKey,
        60000
      );

      if (bookRes.status !== 201 || !bookRes.body) {
        const problem = bookRes.body as any;
        const errorMsg =
          problem?.detail ||
          problem?.title ||
          `HTTP ${bookRes.status}: Booking failed`;

        console.error("Sealink v2 booking failed:", {
          status: bookRes.status,
          problem,
        });

        // Release holds cleanly on failure
        await this.releaseHolds(heldReservationIds);

        throw new Error(`Sealink booking failed: ${errorMsg}`);
      }

      const result = bookRes.body;
      const primaryPnr =
        result.tickets?.[0]?.pnr || result.bookingReference || "";

      console.log("Sealink v2 booking SUCCESSFUL:", {
        bookingReference: result.bookingReference,
        pnr: primaryPnr,
        status: result.status,
        charge: result.charge,
      });

      // Return unified response compatible with ferryBookingService
      return {
        seatStatus: true,
        pnr: primaryPnr,
        bookingReference: result.bookingReference,
        tickets: result.tickets,
        charge: result.charge,
        status: result.status,
      };
    } catch (error) {
      console.error("Sealink booking process error:", error);
      // Attempt cleanup if any holds remain
      if (heldReservationIds.length > 0) {
        await this.releaseHolds(heldReservationIds).catch(() => {});
      }
      throw error;
    }
  }

  /**
   * Release seat holds immediately via DELETE /api/v2/seat-holds
   */
  private static async releaseHolds(reservationIds: string[]): Promise<void> {
    if (!reservationIds || reservationIds.length === 0) return;
    try {
      console.log(`Sealink v2: Releasing ${reservationIds.length} seat hold(s)...`);
      const res = await this.sendV2Request(
        "DELETE",
        "/api/v2/seat-holds",
        { reservationIds }
      );
      if (res.status === 204) {
        console.log("Sealink v2: Holds released cleanly.");
      } else {
        console.warn("Sealink v2: Release holds response:", res.status);
      }
    } catch (err) {
      console.warn("Sealink v2: Error releasing holds:", err);
    }
  }

  /**
   * Get seat layout for a ferry trip and class
   */
  static async getSeatLayout(
    ferryId: string,
    classId: string,
    travelDate: string
  ): Promise<SeatLayout> {
    console.log(
      `SealinkService: Getting seat layout for ferry ${ferryId}, class ${classId}`
    );

    const cleanTripId = ferryId.startsWith("sealink-")
      ? ferryId.replace("sealink-", "")
      : ferryId.startsWith("nautika-")
      ? ferryId.replace("nautika-", "")
      : ferryId;

    let tripData = this.tripDataCache.get(cleanTripId);

    if (!tripData) {
      console.log(`SealinkService: Trip data not in cache for ${cleanTripId}, refetching...`);
      const refetched = await this.refetchTripDataForSeatLayout(
        cleanTripId,
        travelDate
      );
      if (refetched) {
        tripData = refetched;
      }
    }

    if (!tripData) {
      throw new Error(
        `Trip data not found for ferry ID: ${ferryId} (original: ${cleanTripId}). Unable to reconstruct seat layout.`
      );
    }

    return this.extractSeatLayoutFromTripData(tripData, classId);
  }

  /**
   * Refetch trip data by searching common routes for a date
   */
  private static async refetchTripDataForSeatLayout(
    tripId: string,
    travelDate: string,
    preferredRoute?: { from: string; to: string }
  ): Promise<GoNautikaTrip | null> {
    try {
      const formattedDate = this.formatDateForSealink(travelDate);
      const routesToCheck = preferredRoute
        ? [preferredRoute]
        : [
            { from: "Port Blair", to: "Swaraj Dweep" },
            { from: "Port Blair", to: "Shaheed Dweep" },
            { from: "Swaraj Dweep", to: "Port Blair" },
            { from: "Shaheed Dweep", to: "Port Blair" },
            { from: "Swaraj Dweep", to: "Shaheed Dweep" },
            { from: "Shaheed Dweep", to: "Swaraj Dweep" },
          ];

      for (const route of routesToCheck) {
        try {
          const pathAndQuery = `/api/v2/trips?origin=${encodeURIComponent(
            route.from
          )}&destination=${encodeURIComponent(route.to)}&date=${formattedDate}`;

          const { status, body } = await this.sendV2Request<GoNautikaTrip[]>(
            "GET",
            pathAndQuery
          );

          if (status === 200 && Array.isArray(body)) {
            for (const t of body) {
              t.id = t.tripId;
              t.vesselID = t.vesselId;
              t.from = t.origin;
              t.to = t.destination;
              this.tripDataCache.set(t.tripId, t);
              this.tripDataCache.set(`sealink-${t.tripId}`, t);
            }

            const match = body.find((t) => t.tripId === tripId);
            if (match) {
              return match;
            }
          }
        } catch {
          continue;
        }
      }
      return null;
    } catch (err) {
      console.error("Sealink refetch error:", err);
      return null;
    }
  }

  /**
   * Extract seat layout from GoNautika trip data for a given class
   */
  private static extractSeatLayoutFromTripData(
    tripData: GoNautikaTrip,
    classId: string
  ): SeatLayout {
    const cleanId = (classId || "").toLowerCase();

    // 1. Direct match on seatClassId
    let matchedClass = tripData.seatClasses?.find(
      (sc) => sc.seatClassId?.toLowerCase() === cleanId
    );

    // 2. Slug or name match
    if (!matchedClass) {
      const isRoyal =
        cleanId.endsWith("-business") ||
        cleanId.endsWith("-royal") ||
        cleanId.includes("business") ||
        cleanId.includes("royal");

      const isLuxury =
        cleanId.endsWith("-premium") ||
        cleanId.endsWith("-luxury") ||
        cleanId.includes("luxury") ||
        cleanId.includes("premium");

      matchedClass = tripData.seatClasses?.find((sc) => {
        const name = sc.seatClassName.toLowerCase();
        if (isRoyal && !isLuxury) {
          return name.includes("royal") || name.includes("business");
        }
        if (isLuxury && !isRoyal) {
          return name.includes("luxury") || name.includes("premium");
        }
        return false;
      });
    }

    // Fallback to first class if none matched
    if (!matchedClass) {
      matchedClass = tripData.seatClasses?.[0];
    }

    const isRoyalClass =
      matchedClass?.seatClassName.toLowerCase().includes("royal") ||
      matchedClass?.seatClassName.toLowerCase().includes("business");

    const tier: "B" | "P" = isRoyalClass ? "B" : "P";
    const seats = matchedClass?.seats || [];
    return this.createSeatLayout(seats, tier, tripData);
  }

  /**
   * Construct standard SeatLayout structure
   */
  private static createSeatLayout(
    seats: GoNautikaSeat[],
    tier: "B" | "P",
    trip?: GoNautikaTrip
  ): SeatLayout {
    // Populate bClass and pClass maps so components expecting legacy structures have full seat data
    const bClassMap: Record<string, any> = {};
    const pClassMap: Record<string, any> = {};

    let pBaseFare = 0;
    let bBaseFare = 0;

    for (const sc of trip?.seatClasses || []) {
      const isRoyal =
        sc.seatClassName.toLowerCase().includes("royal") ||
        sc.seatClassName.toLowerCase().includes("business");
      const targetMap = isRoyal ? bClassMap : pClassMap;
      const t: "B" | "P" = isRoyal ? "B" : "P";

      if (isRoyal) {
        bBaseFare = sc.baseFare || 0;
      } else {
        pBaseFare = sc.baseFare || 0;
      }

      for (const s of sc.seats || []) {
        targetMap[s.seatNumber] = {
          tier: t,
          number: s.seatNumber,
          isBooked: s.isBooked ? 1 : 0,
          isBlocked: s.isBlocked ? 1 : 0,
        };
      }
    }

    return {
      rows: 0,
      seatsPerRow: 0,
      seats: (seats || []).map((seat) => ({
        id: seat.seatNumber,
        number: seat.seatNumber,
        seat_numbering: seat.seatNumber,
        status: seat.isAvailable
          ? "available"
          : seat.isBooked
          ? "booked"
          : "blocked",
        tier: tier,
      })),
      operatorData: {
        sealink: {
          id: trip?.tripId || "",
          tripId: (trip?.tripId as any) || 0,
          from: trip?.origin || "",
          to: trip?.destination || "",
          dTime: { hour: 0, minute: 0 },
          aTime: { hour: 0, minute: 0 },
          vesselID: (trip?.vesselId as any) || 0,
          fares: {
            pBaseFare: pBaseFare,
            bBaseFare: bBaseFare,
            pBaseFarePBHLNL: 0,
            bBaseFarePBHLNL: 0,
            pIslanderFarePBHLNL: 0,
            bIslanderFarePBHLNL: 0,
            infantFare: 0,
          },
          bClass: bClassMap,
          pClass: pClassMap,
        },
      },
    };
  }

  private static calculateDuration(departureTime: string, arrivalTime: string): string {
    if (!departureTime || !arrivalTime) return "1h 30m";
    const [depH, depM] = departureTime.split(":").map(Number);
    const [arrH, arrM] = arrivalTime.split(":").map(Number);

    let diffMinutes = arrH * 60 + (arrM || 0) - (depH * 60 + (depM || 0));
    if (diffMinutes < 0) diffMinutes += 24 * 60;

    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    return `${hours}h ${minutes}m`;
  }

  private static getLocationCode(locationName: string): string {
    const codeMap: Record<string, string> = {
      "Port Blair": "PB",
      "Swaraj Dweep": "HL",
      "Shaheed Dweep": "NL",
    };
    return codeMap[locationName] || "??";
  }

  /**
   * Get cached trip data by ID
   */
  static getCachedTripData(tripId: string): GoNautikaTrip | undefined {
    const clean = tripId.replace("sealink-", "");
    return this.tripDataCache.get(clean) || this.tripDataCache.get(tripId);
  }

  /**
   * Check if trip data is cached
   */
  static hasCachedTripData(tripId: string): boolean {
    const clean = tripId.replace("sealink-", "");
    return this.tripDataCache.has(clean) || this.tripDataCache.has(tripId);
  }

  /**
   * Get all cached trip IDs (for debugging)
   */
  static getCachedTripIds(): string[] {
    return Array.from(this.tripDataCache.keys());
  }

  /**
   * In GoNautika Agency API v2, tickets are electronic PNRs confirmed directly
   * via booking reference and PNR.
   */
  static async getTicketPDF(pnr: string): Promise<{
    success: boolean;
    pdfBase64?: string;
    error?: string;
  }> {
    console.log(`Sealink: E-ticket confirmation checked for PNR/Reference: ${pnr}`);
    return {
      success: false,
      error: "GoNautika Agency API v2 issues electronic PNR tickets directly.",
    };
  }
}
