/**
 * Viator Booking Submission
 * Submit actual reservation to Viator Partner API
 * 
 * Viator Partner API v2.0 - POST /partner/bookings/book
 * 
 * IMPORTANT: This should only be called AFTER Stripe payment is confirmed
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  console.log(`[VIATOR-BOOK] ${step}`, details ? JSON.stringify(details) : '');
};

interface TravelerInfo {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string; // YYYY-MM-DD
  ageBand: 'ADULT' | 'CHILD' | 'INFANT' | 'YOUTH' | 'SENIOR';
  leadTraveler?: boolean;
}

interface BookingRequest {
  // Internal references
  tripId: string;
  activityId: string;
  paymentId: string; // Reference to trip_payments record
  
  // Viator booking details
  productCode: string;
  productOptionCode?: string;
  travelDate: string; // YYYY-MM-DD
  startTime?: string; // HH:MM
  
  // Travelers
  travelers: TravelerInfo[];
  
  // Booking questions answers
  bookingQuestionAnswers?: Array<{
    questionId: string;
    answer: string;
  }>;
  
  // Pickup info (if required)
  pickupLocationRef?: string;
  pickupHotelName?: string;
  
  // Communication
  communication: {
    email: string;
    phone?: string;
  };
  
  // Language preference
  languageGuide?: {
    type: string;
    language: string;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    log("Function started");

    const apiKey = Deno.env.get("VIATOR_API_KEY");
    if (!apiKey) {
      throw new Error("VIATOR_API_KEY not configured");
    }

    // Auth check
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("User not authenticated");

    log("User authenticated", { userId: user.id });

    const body: BookingRequest = await req.json();
    const {
      tripId,
      activityId,
      paymentId,
      productCode,
      productOptionCode,
      travelDate,
      startTime,
      travelers,
      bookingQuestionAnswers,
      pickupLocationRef,
      pickupHotelName,
      communication,
      languageGuide,
    } = body;

    // Validate required fields
    if (!tripId || !activityId || !paymentId || !productCode || !travelDate || !travelers?.length) {
      throw new Error("Missing required fields");
    }

    // Verify payment is confirmed before booking
    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: payment, error: paymentError } = await serviceSupabase
      .from("trip_payments")
      .select("*")
      .eq("id", paymentId)
      .single();

    if (paymentError || !payment) {
      throw new Error("Payment record not found");
    }

    if (payment.status !== 'paid') {
      throw new Error(`Payment not confirmed. Current status: ${payment.status}`);
    }

    log("Payment verified", { paymentId, status: payment.status });

    // Build Viator booking request
    const viatorBooking = {
      productCode,
      productOptionCode: productOptionCode || undefined,
      travelDate,
      startTime: startTime || undefined,
      paxMix: buildPaxMix(travelers),
      communication: {
        email: communication.email,
        phone: communication.phone,
      },
      travelers: travelers.map((t, index) => ({
        firstName: t.firstName,
        lastName: t.lastName,
        email: t.email,
        phone: t.phone,
        dateOfBirth: t.dateOfBirth,
        ageBand: t.ageBand,
        leadTraveler: index === 0 || t.leadTraveler,
      })),
      bookingQuestionAnswers: bookingQuestionAnswers?.map(qa => ({
        questionId: qa.questionId,
        answer: qa.answer,
      })),
      languageGuide,
      pickup: pickupLocationRef ? {
        locationRef: pickupLocationRef,
        hotelName: pickupHotelName,
      } : undefined,
      // Partner reference for tracking
      partnerBookingRef: `VOY-${tripId.slice(0, 8)}-${activityId.slice(0, 8)}`,
    };

    log("Submitting booking to Viator", { productCode, travelDate, travelers: travelers.length });

    // Call Viator booking endpoint
    const response = await fetch('https://api.viator.com/partner/bookings/book', {
      method: 'POST',
      headers: {
        'Accept': 'application/json;version=2.0',
        'Content-Type': 'application/json',
        'exp-api-key': apiKey,
      },
      body: JSON.stringify(viatorBooking),
    });

    const data = await response.json();

    if (!response.ok) {
      log("Viator booking error", { status: response.status, data });
      
      // Update payment record with failure
      await serviceSupabase
        .from("trip_payments")
        .update({
          status: 'failed',
          metadata: {
            ...payment.metadata,
            viator_error: data.message || 'Booking failed',
            viator_error_code: data.code,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentId);

      return new Response(
        JSON.stringify({
          success: false,
          error: data.message || `Viator booking failed: ${response.status}`,
          code: data.code,
          refundRequired: true, // Signal that Stripe refund may be needed
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    log("Booking successful", { 
      bookingRef: data.bookingRef,
      viatorRef: data.viatorRef,
      status: data.status,
    });

    // Extract confirmation details
    const viatorConfirmation = {
      bookingRef: data.bookingRef,
      viatorRef: data.viatorRef,
      status: data.status,
      voucherUrl: data.voucher?.url,
      voucherKey: data.voucher?.key,
      confirmationDetails: data.confirmationDetails,
      cancellationPolicy: data.cancellationPolicy,
    };

    // Update payment record with Viator confirmation
    await serviceSupabase
      .from("trip_payments")
      .update({
        external_confirmation_number: data.viatorRef || data.bookingRef,
        metadata: {
          ...payment.metadata,
          viator_booking_ref: data.bookingRef,
          viator_ref: data.viatorRef,
          viator_status: data.status,
          viator_voucher_url: data.voucher?.url,
          booked_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentId);

    // Update activity booking state to confirmed
    await serviceSupabase.rpc('transition_booking_state', {
      p_activity_id: activityId,
      p_new_state: 'booked_confirmed',
      p_trigger_source: 'viator_api',
      p_trigger_reference: data.viatorRef || data.bookingRef,
      p_metadata: viatorConfirmation,
    });

    return new Response(
      JSON.stringify({
        success: true,
        booking: {
          bookingRef: data.bookingRef,
          viatorRef: data.viatorRef,
          status: data.status,
          voucherUrl: data.voucher?.url,
        },
        message: 'Booking confirmed successfully',
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    log("Error", { message: error instanceof Error ? error.message : String(error) });
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper to build paxMix from travelers array
function buildPaxMix(travelers: TravelerInfo[]): Array<{ ageBand: string; numberOfTravelers: number }> {
  const counts: Record<string, number> = {};
  
  for (const t of travelers) {
    counts[t.ageBand] = (counts[t.ageBand] || 0) + 1;
  }
  
  return Object.entries(counts).map(([ageBand, numberOfTravelers]) => ({
    ageBand,
    numberOfTravelers,
  }));
}
