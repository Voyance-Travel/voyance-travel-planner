import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GET-CHECKOUT-SESSION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const { sessionId } = await req.json();
    
    if (!sessionId) {
      throw new Error("sessionId is required");
    }

    logStep("Retrieving session", { sessionId });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items', 'line_items.data.price.product'],
    });

    logStep("Session retrieved", { 
      status: session.status, 
      paymentStatus: session.payment_status 
    });

    // Extract product info
    const lineItems = session.line_items?.data || [];
    const products = lineItems.map((item: Stripe.LineItem) => {
      const product = item.price?.product as Stripe.Product | undefined;
      return {
        name: product?.name || 'Unknown Product',
        description: product?.description || '',
        quantity: item.quantity,
        amount: item.amount_total,
        currency: session.currency,
      };
    });

    return new Response(JSON.stringify({
      status: session.status,
      paymentStatus: session.payment_status,
      customerEmail: session.customer_details?.email,
      amountTotal: session.amount_total,
      currency: session.currency,
      products,
      metadata: session.metadata,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
