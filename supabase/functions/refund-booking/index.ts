import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";
import Stripe from "npm:stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization" }, 401);

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabaseAuth.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const { bookingId, paymentIntentId, amountCents, reason } = body ?? {};
    if (
      !bookingId ||
      typeof bookingId !== "string" ||
      !paymentIntentId ||
      typeof paymentIntentId !== "string" ||
      typeof amountCents !== "number" ||
      !Number.isFinite(amountCents) ||
      amountCents <= 0
    ) {
      return json(
        { error: "bookingId, paymentIntentId, and positive amountCents are required" },
        400,
      );
    }

    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: booking, error: bErr } = await (service as any)
      .from("bookings")
      .select("id, user_id, stripe_payment_intent_id, total_amount_cents, status")
      .eq("id", bookingId)
      .maybeSingle();
    if (bErr) {
      console.error("[refund-booking] booking lookup failed", bErr);
      return json({ error: "Booking lookup failed" }, 500);
    }
    if (!booking) return json({ error: "Booking not found" }, 404);
    if (booking.user_id !== user.id) return json({ error: "Forbidden" }, 403);
    if (booking.stripe_payment_intent_id !== paymentIntentId) {
      return json({ error: "paymentIntentId mismatch" }, 400);
    }
    if (amountCents > (booking.total_amount_cents ?? 0)) {
      return json({ error: "amountCents exceeds booking total" }, 400);
    }
    if (booking.status === "refunded" || booking.status === "cancelled") {
      return json({ ok: true, already: true }, 200);
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2025-08-27.basil",
    });

    const refund = await stripe.refunds.create(
      {
        payment_intent: paymentIntentId,
        amount: amountCents,
        reason: "requested_by_customer",
        metadata: {
          booking_id: bookingId,
          source: "refund-booking",
          user_reason: String(reason ?? "").slice(0, 200),
        },
      },
      { idempotencyKey: `booking-cancel:${bookingId}:${amountCents}` },
    );

    return json(
      { ok: true, refundId: refund.id, amount: refund.amount, status: refund.status },
      200,
    );
  } catch (err) {
    console.error("[refund-booking]", err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
