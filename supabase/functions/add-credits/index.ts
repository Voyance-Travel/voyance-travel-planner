import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";
import { corsResponse, okResponse, errorResponse, unauthorizedResponse, exceptionResponse } from "../_shared/edge-response.ts";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADD-CREDITS] ${step}${detailsStr}`);
};

// Minimum top-up is $5 (500 cents), maximum is $500 (50000 cents)
const MIN_TOPUP_CENTS = 500;
const MAX_TOPUP_CENTS = 50000;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsResponse();
  }

  try {
    logStep("Function started");

    const { amount_cents } = await req.json();
    
    if (!amount_cents || typeof amount_cents !== 'number' || !Number.isInteger(amount_cents)) {
      return errorResponse("amount_cents must be an integer", "INVALID_INPUT");
    }
    if (amount_cents < MIN_TOPUP_CENTS) {
      return errorResponse(`Minimum top-up is $${MIN_TOPUP_CENTS / 100}`, "BELOW_MINIMUM", 400, { min: MIN_TOPUP_CENTS });
    }
    if (amount_cents > MAX_TOPUP_CENTS) {
      return errorResponse(`Maximum top-up is $${MAX_TOPUP_CENTS / 100}`, "ABOVE_MAXIMUM", 400, { max: MAX_TOPUP_CENTS });
    }

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return unauthorizedResponse();
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } }
    );

    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return unauthorizedResponse("Invalid token", "INVALID_TOKEN");
    }

    const userId = claimsData.claims.sub as string;
    let email = claimsData.claims.email as string | undefined;
    
    if (!email) {
      const { data: userData } = await supabaseClient.auth.getUser(token);
      email = userData.user?.email;
    }

    if (!email) return errorResponse("Could not get user email", "NO_EMAIL");
    logStep("User authenticated", { userId, email });

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check for existing Stripe customer
    const customers = await stripe.customers.list({ email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const origin = req.headers.get("origin") || "https://voyance-travel-planner.lovable.app";

    // Create a one-time payment session for credits
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Voyance Credits',
              description: `Add $${(amount_cents / 100).toFixed(2)} to your wallet`,
            },
            unit_amount: amount_cents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/profile?credits_added=true&amount=${amount_cents}`,
      cancel_url: `${origin}/profile?credits_canceled=true`,
      metadata: {
        user_id: userId,
        type: 'credit_topup',
        amount_cents: amount_cents.toString(),
      },
    });

    logStep("Checkout session created", { sessionId: session.id, amount: amount_cents });

    return okResponse({ url: session.url });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return exceptionResponse(error);
  }
});
