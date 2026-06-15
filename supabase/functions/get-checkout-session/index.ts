import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18.5.0";
import { okResponse, errorResponse, corsResponse, exceptionResponse } from "../_shared/edge-response.ts";
import { parseAuth } from "../_shared/require-auth.ts";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GET-CHECKOUT-SESSION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsResponse();
  }

  try {
    logStep("Function started");

    // AUTH GATE (IDOR fix): previously unauthenticated — anyone with a session ID
    // could read its customer email / amount / metadata. Require a valid token,
    // and bind the session to the caller (sessions carry metadata.user_id).
    const auth = await parseAuth(req);
    if (auth instanceof Response) return auth;

    const body = await req.json().catch(() => ({}));
    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId.trim() : '';

    if (!sessionId || sessionId.length > 200) {
      return errorResponse("sessionId is required", "INVALID_INPUT");
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

    // Bind the session to the caller — checkout sessions carry metadata.user_id
    // (set in create-checkout / create-embedded-checkout). A real user may only
    // read their own session; internal/service-role callers are trusted.
    if (auth.userId !== 'service_role' && session.metadata?.user_id !== auth.userId) {
      logStep("Forbidden — session does not belong to caller", { caller: auth.userId });
      return errorResponse("Forbidden", "FORBIDDEN", 403);
    }

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

    return okResponse({
      status: session.status,
      paymentStatus: session.payment_status,
      customerEmail: session.customer_details?.email,
      amountTotal: session.amount_total,
      currency: session.currency,
      products,
      metadata: session.metadata,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return errorResponse("Failed to retrieve checkout session", "CHECKOUT_SESSION_ERROR", 500);
  }
});
