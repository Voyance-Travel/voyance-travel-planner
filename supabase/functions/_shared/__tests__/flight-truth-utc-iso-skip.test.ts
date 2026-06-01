// Locks the fix in generate-itinerary/flight-hotel-context.ts: when
// flight_intelligence.destinationSchedule[0].arrivalDatetime is a UTC ISO
// (or carries a numeric offset), the cross-source sanity check MUST skip
// it so picker's already-local time isn't falsely flagged as disagreeing.
// Closes Barcelona QA "Day 1 shows arrival at 8:30 PM" vs actual 22:30.

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { getFlightHotelContext } from "../../generate-itinerary/flight-hotel-context.ts";

function mockSupabase(trip: Record<string, unknown>) {
  return {
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, _val: string) => ({
          maybeSingle: async () => ({ data: trip, error: null }),
        }),
      }),
    }),
  };
}

const baseTrip = {
  flight_selection: {
    legs: [
      {
        isDestinationArrival: true,
        departure: { airport: "JFK", time: "14:30" },
        arrival: { airport: "BCN", time: "22:30" },
      },
    ],
    arrivalAirport: "BCN",
  },
  hotel_selection: null,
  is_multi_city: false,
};

function capturedWarns(): { logs: string[]; restore: () => void } {
  const logs: string[] = [];
  const orig = console.warn;
  console.warn = (...args: unknown[]) => {
    logs.push(args.map(String).join(" "));
  };
  return { logs, restore: () => { console.warn = orig; } };
}

Deno.test("UTC ISO intel arrival is skipped — no FLIGHT_TRUTH_DISAGREE", async () => {
  const trip = {
    ...baseTrip,
    flight_intelligence: {
      destinationSchedule: [
        {
          isFirstDestination: true,
          arrivalAirport: "BCN",
          arrivalDatetime: "2026-06-15T20:30:00Z", // UTC, picker is 22:30 local
        },
      ],
    },
  };
  const cap = capturedWarns();
  try {
    const ctx = await getFlightHotelContext(mockSupabase(trip) as any, "t1");
    assertEquals(ctx.arrivalTime24, "22:30");
    assert(
      !cap.logs.some((l) => l.includes("FLIGHT_TRUTH_DISAGREE")),
      `expected no disagree log; got:\n${cap.logs.join("\n")}`,
    );
  } finally {
    cap.restore();
  }
});

Deno.test("Numeric-offset ISO intel arrival is also skipped", async () => {
  const trip = {
    ...baseTrip,
    flight_intelligence: {
      destinationSchedule: [
        {
          isFirstDestination: true,
          arrivalAirport: "BCN",
          arrivalDatetime: "2026-06-15T20:30:00+00:00",
        },
      ],
    },
  };
  const cap = capturedWarns();
  try {
    const ctx = await getFlightHotelContext(mockSupabase(trip) as any, "t1");
    assertEquals(ctx.arrivalTime24, "22:30");
    assert(!cap.logs.some((l) => l.includes("FLIGHT_TRUTH_DISAGREE")));
  } finally {
    cap.restore();
  }
});

Deno.test("Naive ISO intel arrival is treated as local and compared", async () => {
  const trip = {
    ...baseTrip,
    flight_intelligence: {
      destinationSchedule: [
        {
          isFirstDestination: true,
          arrivalAirport: "BCN",
          arrivalDatetime: "2026-06-15T22:30:00", // naive, matches picker
        },
      ],
    },
  };
  const cap = capturedWarns();
  try {
    const ctx = await getFlightHotelContext(mockSupabase(trip) as any, "t1");
    assertEquals(ctx.arrivalTime24, "22:30");
    assert(!cap.logs.some((l) => l.includes("FLIGHT_TRUTH_DISAGREE")));
  } finally {
    cap.restore();
  }
});

Deno.test("Naive ISO intel that truly disagrees still logs (sanity)", async () => {
  const trip = {
    ...baseTrip,
    flight_intelligence: {
      destinationSchedule: [
        {
          isFirstDestination: true,
          arrivalAirport: "BCN",
          arrivalDatetime: "2026-06-15T18:00:00", // naive 18:00 vs picker 22:30
        },
      ],
    },
  };
  const cap = capturedWarns();
  try {
    await getFlightHotelContext(mockSupabase(trip) as any, "t1");
    assert(
      cap.logs.some((l) => l.includes("FLIGHT_TRUTH_DISAGREE")),
      `expected disagree log; got:\n${cap.logs.join("\n")}`,
    );
  } finally {
    cap.restore();
  }
});
