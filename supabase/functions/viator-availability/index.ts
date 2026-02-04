/**
 * Viator Availability Check
 * Check real-time availability for a product on specific dates
 * 
 * Viator Partner API v2.0 - POST /partner/availability/check
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { trackCost } from "../_shared/cost-tracker.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  console.log(`[VIATOR-AVAILABILITY] ${step}`, details ? JSON.stringify(details) : '');
};

interface AvailabilityRequest {
  productCode: string;
  travelDate: string; // YYYY-MM-DD
  travelers: {
    adults: number;
    children?: number;
    infants?: number;
  };
  currency?: string;
}

interface AvailabilitySlot {
  startTime: string;
  endTime?: string;
  available: boolean;
  pricingRecord?: {
    bookableItems: Array<{
      ageBand: string;
      numberOfTravelers: number;
      subtotalPrice: {
        amount: number;
        currency: string;
      };
    }>;
    totalPrice: {
      amount: number;
      currency: string;
    };
  };
  productOptionCode?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const costTracker = trackCost('viator_availability', 'viator');

  try {
    log("Function started");

    const apiKey = Deno.env.get("VIATOR_API_KEY");
    if (!apiKey) {
      throw new Error("VIATOR_API_KEY not configured");
    }

    const body: AvailabilityRequest = await req.json();
    const { productCode, travelDate, travelers, currency = 'USD' } = body;

    if (!productCode || !travelDate || !travelers?.adults) {
      throw new Error("Missing required fields: productCode, travelDate, travelers.adults");
    }

    log("Checking availability", { productCode, travelDate, travelers });

    // Build traveler mix for Viator API
    const paxMix = [];
    if (travelers.adults > 0) {
      paxMix.push({ ageBand: 'ADULT', numberOfTravelers: travelers.adults });
    }
    if (travelers.children && travelers.children > 0) {
      paxMix.push({ ageBand: 'CHILD', numberOfTravelers: travelers.children });
    }
    if (travelers.infants && travelers.infants > 0) {
      paxMix.push({ ageBand: 'INFANT', numberOfTravelers: travelers.infants });
    }

    // Call Viator availability check endpoint
    const response = await fetch('https://api.viator.com/partner/availability/check', {
      method: 'POST',
      headers: {
        'Accept': 'application/json;version=2.0',
        'Content-Type': 'application/json',
        'exp-api-key': apiKey,
      },
      body: JSON.stringify({
        productCode,
        travelDate,
        paxMix,
        currency,
      }),
    });

    const data = await response.json();

    // Track Viator API call
    costTracker.addMetadata('productCode', productCode);
    await costTracker.save();

    if (!response.ok) {
      log("Viator API error", { status: response.status, data });
      return new Response(
        JSON.stringify({
          success: false,
          error: data.message || `Viator API error: ${response.status}`,
          code: data.code,
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    log("Availability response received", { slotsCount: data.bookableItems?.length || 0 });

    // Transform Viator response to our format
    const slots: AvailabilitySlot[] = (data.bookableItems || []).map((item: any) => ({
      startTime: item.startTime || '00:00',
      endTime: item.endTime,
      available: item.available !== false,
      pricingRecord: item.pricingRecord,
      productOptionCode: item.productOptionCode,
    }));

    // Calculate lowest price from available slots
    let lowestPrice: { amount: number; currency: string } | null = null;
    for (const slot of slots) {
      if (slot.available && slot.pricingRecord?.totalPrice) {
        if (!lowestPrice || slot.pricingRecord.totalPrice.amount < lowestPrice.amount) {
          lowestPrice = slot.pricingRecord.totalPrice;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        productCode,
        travelDate,
        available: slots.some(s => s.available),
        slots,
        lowestPrice,
        currency,
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
