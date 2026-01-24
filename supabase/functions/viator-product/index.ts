/**
 * Viator Product Details
 * Fetch booking requirements, options, and traveler fields for a product
 * 
 * Viator Partner API v2.0 - GET /partner/products/{productCode}
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  console.log(`[VIATOR-PRODUCT] ${step}`, details ? JSON.stringify(details) : '');
};

interface ProductOption {
  productOptionCode: string;
  description: string;
  title: string;
  languageGuides?: Array<{
    type: string;
    language: string;
  }>;
}

interface BookingQuestion {
  id: string;
  question: string;
  required: boolean;
  type: 'STRING' | 'NUMBER' | 'DATE' | 'LOCATION_REF' | 'UNIT';
  units?: string[];
  allowedAnswers?: string[];
}

interface PickupLocation {
  locationRef: string;
  name: string;
  address?: string;
  pickupType: 'HOTEL' | 'AIRPORT' | 'PORT' | 'MEETING_POINT' | 'OTHER';
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

    const url = new URL(req.url);
    const productCode = url.searchParams.get('productCode');

    if (!productCode) {
      // Try body for POST requests
      const body = await req.json().catch(() => ({}));
      if (!body.productCode) {
        throw new Error("Missing productCode parameter");
      }
    }

    const code = productCode || (await req.json()).productCode;
    log("Fetching product details", { productCode: code });

    // Fetch product details from Viator
    const response = await fetch(`https://api.viator.com/partner/products/${code}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json;version=2.0',
        'exp-api-key': apiKey,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      log("Viator API error", { status: response.status, data });
      return new Response(
        JSON.stringify({
          success: false,
          error: data.message || `Product not found: ${response.status}`,
          code: data.code,
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    log("Product details received", { title: data.title });

    // Extract booking requirements
    const bookingQuestions: BookingQuestion[] = (data.bookingQuestions || []).map((q: any) => ({
      id: q.id,
      question: q.label || q.message,
      required: q.required || false,
      type: q.type || 'STRING',
      units: q.units,
      allowedAnswers: q.allowedAnswers,
    }));

    // Extract product options (time slots, language options, etc.)
    const productOptions: ProductOption[] = (data.productOptions || []).map((opt: any) => ({
      productOptionCode: opt.productOptionCode,
      description: opt.description,
      title: opt.title,
      languageGuides: opt.languageGuides,
    }));

    // Extract pickup locations if applicable
    const pickupLocations: PickupLocation[] = (data.logistics?.travelerPickup?.locations || []).map((loc: any) => ({
      locationRef: loc.location?.ref,
      name: loc.location?.name || loc.description,
      address: loc.location?.address,
      pickupType: loc.pickupType || 'MEETING_POINT',
    }));

    // Determine required traveler info
    const travelerRequirements = {
      requiresLeadTraveler: data.bookingRequirements?.requiresLeadTraveler !== false,
      requiresAllTravelerDetails: data.bookingRequirements?.requiresAllTravelerDetails || false,
      requiredPerTraveler: data.bookingRequirements?.perTravelerDetails || ['FULL_NAME'],
      minTravelers: data.pricingInfo?.minTravelers || 1,
      maxTravelers: data.pricingInfo?.maxTravelers || 99,
    };

    // Extract cancellation policy
    const cancellationPolicy = {
      type: data.cancellationPolicy?.type || 'STANDARD',
      description: data.cancellationPolicy?.description,
      refundEligibility: data.cancellationPolicy?.refundEligibility || [],
    };

    return new Response(
      JSON.stringify({
        success: true,
        product: {
          productCode: data.productCode,
          title: data.title,
          description: data.description,
          duration: data.duration,
          images: data.images?.slice(0, 5) || [],
          reviewInfo: {
            rating: data.reviews?.combinedAverageRating,
            totalReviews: data.reviews?.totalReviews,
          },
        },
        bookingRequirements: {
          questions: bookingQuestions,
          travelerRequirements,
          pickupRequired: pickupLocations.length > 0,
          pickupLocations,
        },
        productOptions,
        cancellationPolicy,
        inclusions: data.inclusions || [],
        exclusions: data.exclusions || [],
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
