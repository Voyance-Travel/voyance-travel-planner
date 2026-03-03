import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-BOOKING-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const { sessionId } = await req.json();
    if (!sessionId) throw new Error("sessionId is required");

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Verify payment with Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    logStep("Session retrieved", { status: session.payment_status, tripId: session.metadata?.trip_id });

    if (session.payment_status !== 'paid') {
      return new Response(JSON.stringify({ 
        success: false, 
        status: session.payment_status,
        error: 'Payment not completed' 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const tripId = session.metadata?.trip_id;
    if (!tripId) throw new Error("Trip ID not found in session metadata");

    // Get trip details - MUST verify user owns this trip for security
    const { data: trip, error: tripError } = await supabaseClient
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .eq('user_id', user.id) // Security: verify trip ownership
      .single();

    if (tripError || !trip) {
      logStep("Trip ownership verification failed", { tripId, userId: user.id });
      throw new Error("Trip not found or access denied");
    }
    logStep("Trip ownership verified", { tripId, userId: user.id });

    // Generate booking reference if not already present
    const existingMetadata = trip.metadata as Record<string, any> || {};
    const bookingReference = existingMetadata.booking_reference || `VOY-${tripId.slice(0, 8).toUpperCase()}`;

    // Update trip status to booked with full payment details
    await supabaseClient
      .from('trips')
      .update({ 
        status: 'booked',
        metadata: {
          ...existingMetadata,
          payment_status: 'paid',
          payment_completed_at: new Date().toISOString(),
          stripe_session_id: sessionId,
          stripe_payment_intent_id: session.payment_intent,
          amount_paid: session.amount_total,
          booking_reference: bookingReference,
          booking_confirmed_at: new Date().toISOString(),
        },
      })
      .eq('id', tripId);

    logStep("Trip updated to booked", { bookingReference });

    // Update all pending payment records to paid
    const { data: updatedPayments, error: paymentUpdateError } = await supabaseClient
      .from('trip_payments')
      .update({ 
        status: 'paid',
        paid_at: new Date().toISOString(),
        stripe_payment_intent_id: session.payment_intent as string || null,
      })
      .eq('trip_id', tripId)
      .eq('stripe_checkout_session_id', sessionId)
      .eq('status', 'pending')
      .select();

    if (paymentUpdateError) {
      logStep("Warning: Failed to update payment records", { error: paymentUpdateError.message });
    } else {
      logStep("Payment records updated to paid", { count: updatedPayments?.length || 0 });
    }

    // Save itinerary snapshot at booking time (if exists in context but not saved)
    if (trip.itinerary_data) {
      logStep("Itinerary already saved", { dayCount: Array.isArray(trip.itinerary_data) ? trip.itinerary_data.length : 'n/a' });
    }

    // Send confirmation email
    if (SENDGRID_API_KEY) {
      try {
        const startDate = new Date(trip.start_date).toLocaleDateString('en-US', { 
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        });
        const endDate = new Date(trip.end_date).toLocaleDateString('en-US', { 
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        });
        const amountPaid = session.amount_total ? (session.amount_total / 100).toFixed(2) : '0.00';

        const emailResponse = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${SENDGRID_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: user.email }] }],
            from: { email: "contact@travelwithvoyance.com", name: "Voyance Travel" },
            subject: `🎉 Your trip to ${trip.destination} is confirmed!`,
            content: [
              {
                type: "text/html",
                value: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                      <h1 style="color: #1a1a1a; margin-bottom: 10px;">Trip Confirmed! 🎉</h1>
                      <p style="color: #666; font-size: 18px;">Get ready for an amazing adventure</p>
                    </div>
                    
                    <div style="background: linear-gradient(135deg, #1a1a1a, #333); color: white; padding: 30px; border-radius: 12px; margin-bottom: 20px;">
                      <h2 style="margin: 0 0 20px 0; font-size: 24px;">${trip.destination}</h2>
                      <div style="display: grid; gap: 15px;">
                        <div>
                          <p style="margin: 0; color: #aaa; font-size: 12px;">DATES</p>
                          <p style="margin: 5px 0 0 0; font-size: 16px;">${startDate} - ${endDate}</p>
                        </div>
                        <div>
                          <p style="margin: 0; color: #aaa; font-size: 12px;">TRAVELERS</p>
                          <p style="margin: 5px 0 0 0; font-size: 16px;">${trip.travelers || 1} ${trip.travelers === 1 ? 'guest' : 'guests'}</p>
                        </div>
                        <div>
                          <p style="margin: 0; color: #aaa; font-size: 12px;">BOOKING REFERENCE</p>
                          <p style="margin: 5px 0 0 0; font-size: 16px; font-family: monospace;">${bookingReference}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                      <h3 style="margin: 0 0 10px 0; color: #1a1a1a;">Payment Summary</h3>
                      <p style="margin: 0; font-size: 24px; font-weight: bold; color: #1a1a1a;">$${amountPaid}</p>
                      <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">Payment successful</p>
                    </div>
                    
                    <div style="text-align: center; margin-top: 30px;">
                      <a href="https://voyance-travel-planner.lovable.app/trip/${tripId}" 
                         style="display: inline-block; background: #1a1a1a; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                        View Your Itinerary
                      </a>
                    </div>
                    
                    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #999; font-size: 12px;">
                      <p>Questions? Reply to this email or contact us at contact@travelwithvoyance.com</p>
                      <p>© ${new Date().getFullYear()} Voyance. All rights reserved.</p>
                    </div>
                  </div>
                `,
              },
            ],
          }),
        });

        if (emailResponse.ok) {
          logStep("Confirmation email sent");
        } else {
          logStep("Email send failed", { status: emailResponse.status });
        }
      } catch (emailError) {
        logStep("Email error (non-critical)", { error: String(emailError) });
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      status: 'paid',
      tripId,
      destination: trip.destination,
      amountPaid: session.amount_total,
      bookingReference,
      paymentsUpdated: updatedPayments?.length || 0,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ success: false, error: "Payment verification failed", code: "PAYMENT_VERIFY_ERROR" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
