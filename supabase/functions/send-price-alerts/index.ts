import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PriceAlert {
  tripId: string;
  tripName: string;
  destination: string;
  userEmail: string;
  userName: string;
  priceChange: {
    type: "flight" | "hotel" | "both";
    previousPrice: number;
    currentPrice: number;
    savings: number;
    percentChange: number;
  };
  flightDetails?: {
    airline: string;
    departure: string;
    arrival: string;
  };
  hotelDetails?: {
    name: string;
    checkIn: string;
    checkOut: string;
  };
}

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[PRICE-ALERTS] ${step}`, details ? JSON.stringify(details) : "");
};

// Generate email HTML for price drop alert
function generatePriceAlertEmailHtml(alert: PriceAlert): string {
  const savingsFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(alert.priceChange.savings);
  
  const previousPriceFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(alert.priceChange.previousPrice);
  
  const currentPriceFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(alert.priceChange.currentPrice);

  const priceChangeType = alert.priceChange.type === 'flight' 
    ? '✈️ Flight' 
    : alert.priceChange.type === 'hotel' 
    ? '🏨 Hotel' 
    : '✈️ Flight & 🏨 Hotel';

  const detailsSection = `
    ${alert.flightDetails ? `
      <tr>
        <td style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
          <p style="margin: 0 0 4px; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Flight Details</p>
          <p style="margin: 0; color: #374151; font-size: 14px;">
            ${alert.flightDetails.airline} · ${alert.flightDetails.departure} → ${alert.flightDetails.arrival}
          </p>
        </td>
      </tr>
    ` : ''}
    ${alert.hotelDetails ? `
      <tr>
        <td style="padding: 16px; ${alert.flightDetails ? '' : 'border-bottom: 1px solid #e5e7eb;'}">
          <p style="margin: 0 0 4px; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Hotel Details</p>
          <p style="margin: 0; color: #374151; font-size: 14px;">
            ${alert.hotelDetails.name} · ${alert.hotelDetails.checkIn} - ${alert.hotelDetails.checkOut}
          </p>
        </td>
      </tr>
    ` : ''}
  `;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <!-- Header with price drop highlight -->
              <tr>
                <td style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 40px; text-align: center;">
                  <p style="margin: 0 0 8px; color: rgba(255,255,255,0.9); font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Price Drop Alert 🎉</p>
                  <h1 style="margin: 0; color: #ffffff; font-size: 36px; font-weight: 700;">Save ${savingsFormatted}</h1>
                  <p style="margin: 15px 0 0; color: rgba(255,255,255,0.85); font-size: 16px;">on your trip to ${alert.destination}</p>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px;">
                  <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                    Hi ${alert.userName || 'Traveler'},
                  </p>
                  <p style="margin: 0 0 25px; color: #374151; font-size: 16px; line-height: 1.7;">
                    Great news! The ${priceChangeType} price for your upcoming trip to <strong>${alert.destination}</strong> just dropped by <strong>${Math.abs(alert.priceChange.percentChange).toFixed(0)}%</strong>!
                  </p>
                  
                  <!-- Price Comparison Card -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 12px; margin-bottom: 25px; border: 2px solid #86efac;">
                    <tr>
                      <td style="padding: 24px;">
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td width="45%" style="text-align: center;">
                              <p style="margin: 0 0 4px; color: #6b7280; font-size: 12px; text-transform: uppercase;">Was</p>
                              <p style="margin: 0; color: #9ca3af; font-size: 24px; text-decoration: line-through;">${previousPriceFormatted}</p>
                            </td>
                            <td width="10%" style="text-align: center; color: #10b981; font-size: 24px;">→</td>
                            <td width="45%" style="text-align: center;">
                              <p style="margin: 0 0 4px; color: #059669; font-size: 12px; text-transform: uppercase; font-weight: 600;">Now</p>
                              <p style="margin: 0; color: #059669; font-size: 28px; font-weight: 700;">${currentPriceFormatted}</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- Trip Details Card -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background: #f9fafb; border-radius: 12px; margin-bottom: 25px; overflow: hidden;">
                    <tr>
                      <td style="padding: 16px; background: #1a1a2e;">
                        <h2 style="margin: 0; color: #ffffff; font-size: 16px; font-weight: 600;">
                          📍 ${alert.tripName || `Trip to ${alert.destination}`}
                        </h2>
                      </td>
                    </tr>
                    ${detailsSection}
                  </table>

                  <!-- Urgency Notice -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 0 8px 8px 0; margin-bottom: 25px;">
                    <tr>
                      <td style="padding: 16px 20px;">
                        <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.5;">
                          ⏰ <strong>Act fast!</strong> Travel prices change frequently. Lock in this rate before it goes back up.
                        </p>
                      </td>
                    </tr>
                  </table>
                  
                  <!-- CTA Button -->
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="padding-top: 10px;">
                        <a href="https://voyance-travel-planner.lovable.app/trip/planner/${alert.tripId}/summary" 
                           style="display: inline-block; background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: white; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                          Book Now & Save ${savingsFormatted}
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 24px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;">
                    Sent with ❤️ by <a href="https://voyance-travel-planner.lovable.app" style="color: #6366f1; text-decoration: none;">Voyance</a>
                  </p>
                  <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                    <a href="https://voyance-travel-planner.lovable.app/settings" style="color: #9ca3af;">Manage price alerts</a> · 
                    <a href="https://voyance-travel-planner.lovable.app/trip/dashboard" style="color: #9ca3af;">View all trips</a>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

// Generate plain text version
function generatePriceAlertTextContent(alert: PriceAlert): string {
  const savingsFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(alert.priceChange.savings);

  return `
PRICE DROP ALERT 🎉

Hi ${alert.userName || 'Traveler'},

Great news! The price for your trip to ${alert.destination} just dropped!

SAVINGS: ${savingsFormatted} (${Math.abs(alert.priceChange.percentChange).toFixed(0)}% off!)

Was: $${alert.priceChange.previousPrice.toFixed(2)}
Now: $${alert.priceChange.currentPrice.toFixed(2)}

Trip: ${alert.tripName || `Trip to ${alert.destination}`}
${alert.flightDetails ? `Flight: ${alert.flightDetails.airline} · ${alert.flightDetails.departure} → ${alert.flightDetails.arrival}` : ''}
${alert.hotelDetails ? `Hotel: ${alert.hotelDetails.name} · ${alert.hotelDetails.checkIn} - ${alert.hotelDetails.checkOut}` : ''}

⏰ Act fast! Travel prices change frequently. Lock in this rate before it goes back up.

Book now: https://voyance-travel-planner.lovable.app/trip/planner/${alert.tripId}/summary

---
Manage price alerts: https://voyance-travel-planner.lovable.app/settings
  `;
}

async function sendPriceAlertEmail(
  alert: PriceAlert,
  sendgridApiKey: string
): Promise<boolean> {
  const savingsFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(alert.priceChange.savings);
  
  const subject = `💰 Price Drop! Save ${savingsFormatted} on your ${alert.destination} trip`;
  const html = generatePriceAlertEmailHtml(alert);
  const text = generatePriceAlertTextContent(alert);

  try {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${sendgridApiKey}`,
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: alert.userEmail }] }],
        from: { email: "no-reply@voyancetravel.com", name: "Voyance Price Alerts" },
        subject,
        content: [
          { type: "text/plain", value: text },
          { type: "text/html", value: html },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logStep("SendGrid error", { status: response.status, error: errorText });
      return false;
    }

    logStep("Price alert email sent successfully", { 
      tripId: alert.tripId, 
      destination: alert.destination,
      savings: alert.priceChange.savings 
    });
    return true;
  } catch (error) {
    logStep("Error sending price alert email", { error: String(error) });
    return false;
  }
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Starting price alerts check");

    const sendgridApiKey = Deno.env.get("SENDGRID_API_KEY");
    if (!sendgridApiKey) {
      throw new Error("SENDGRID_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for manual triggers or specific trip checks
    let requestBody: { tripId?: string; priceChange?: PriceAlert['priceChange'] } = {};
    try {
      requestBody = await req.json();
    } catch {
      // No body - running as scheduled job
    }

    const alerts: PriceAlert[] = [];

    // If triggered for a specific trip with price change data
    if (requestBody.tripId && requestBody.priceChange) {
      logStep("Processing specific trip price alert", { tripId: requestBody.tripId });

      // Get trip details
      const { data: trip, error: tripError } = await supabase
        .from("trips")
        .select("*")
        .eq("id", requestBody.tripId)
        .single();

      if (tripError || !trip) {
        throw new Error(`Trip not found: ${requestBody.tripId}`);
      }

      // Check user preferences for price alerts
      const { data: prefs } = await supabase
        .from("user_preferences")
        .select("price_alerts")
        .eq("user_id", trip.user_id)
        .single();

      if (!prefs?.price_alerts) {
        logStep("User has price alerts disabled", { userId: trip.user_id });
        return new Response(
          JSON.stringify({ ok: true, skipped: true, reason: "price_alerts_disabled" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get user email and profile
      const { data: authData } = await supabase.auth.admin.getUserById(trip.user_id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", trip.user_id)
        .single();

      if (!authData?.user?.email) {
        throw new Error("User email not found");
      }

      // Build flight/hotel details from trip data
      let flightDetails: PriceAlert['flightDetails'];
      let hotelDetails: PriceAlert['hotelDetails'];

      if (trip.flight_selection) {
        const flight = trip.flight_selection as any;
        flightDetails = {
          airline: flight.airline || flight.carrier || 'Multiple Airlines',
          departure: flight.departureAirport || trip.origin_city || 'Origin',
          arrival: flight.arrivalAirport || trip.destination || 'Destination',
        };
      }

      if (trip.hotel_selection) {
        const hotel = trip.hotel_selection as any;
        hotelDetails = {
          name: hotel.name || hotel.hotelName || 'Selected Hotel',
          checkIn: trip.start_date,
          checkOut: trip.end_date,
        };
      }

      alerts.push({
        tripId: trip.id,
        tripName: trip.name,
        destination: trip.destination,
        userEmail: authData.user.email,
        userName: profile?.display_name || authData.user.email.split('@')[0],
        priceChange: requestBody.priceChange,
        flightDetails,
        hotelDetails,
      });
    } else {
      // Scheduled job: check all trips with price monitoring enabled
      logStep("Running scheduled price alert check");

      // Get trips with price monitoring (stored in metadata)
      const { data: monitoredTrips, error: tripsError } = await supabase
        .from("trips")
        .select("*")
        .eq("status", "planning")
        .not("metadata->price_monitor_enabled", "is", null);

      if (tripsError) {
        throw new Error(`Error fetching monitored trips: ${tripsError.message}`);
      }

      logStep("Found monitored trips", { count: monitoredTrips?.length || 0 });

      // For each monitored trip, check if price has changed
      for (const trip of monitoredTrips || []) {
        const metadata = trip.metadata as any || {};
        
        // Skip if no previous price recorded
        if (!metadata.last_checked_price) {
          continue;
        }

        // Check user preferences
        const { data: prefs } = await supabase
          .from("user_preferences")
          .select("price_alerts")
          .eq("user_id", trip.user_id)
          .single();

        if (!prefs?.price_alerts) {
          continue;
        }

        // Get current price from flight/hotel selection
        let currentPrice = 0;
        if (trip.flight_selection) {
          currentPrice += (trip.flight_selection as any).price || 0;
        }
        if (trip.hotel_selection) {
          currentPrice += (trip.hotel_selection as any).totalPrice || 0;
        }

        const previousPrice = metadata.last_checked_price;
        const priceDiff = previousPrice - currentPrice;

        // Only alert if price dropped by at least 5%
        if (priceDiff > 0 && (priceDiff / previousPrice) >= 0.05) {
          const { data: authData } = await supabase.auth.admin.getUserById(trip.user_id);
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("id", trip.user_id)
            .single();

          if (authData?.user?.email) {
            alerts.push({
              tripId: trip.id,
              tripName: trip.name,
              destination: trip.destination,
              userEmail: authData.user.email,
              userName: profile?.display_name || authData.user.email.split('@')[0],
              priceChange: {
                type: trip.flight_selection && trip.hotel_selection ? 'both' : 
                      trip.flight_selection ? 'flight' : 'hotel',
                previousPrice,
                currentPrice,
                savings: priceDiff,
                percentChange: -((priceDiff / previousPrice) * 100),
              },
            });

            // Update last checked price
            await supabase
              .from("trips")
              .update({
                metadata: {
                  ...metadata,
                  last_checked_price: currentPrice,
                  last_price_check: new Date().toISOString(),
                },
              })
              .eq("id", trip.id);
          }
        }
      }
    }

    // Send all alerts
    let sentCount = 0;
    let failedCount = 0;

    for (const alert of alerts) {
      const success = await sendPriceAlertEmail(alert, sendgridApiKey);
      if (success) {
        sentCount++;
        
        // Record that we sent an alert
        const { data: trip } = await supabase
          .from("trips")
          .select("metadata")
          .eq("id", alert.tripId)
          .single();
          
        const metadata = (trip?.metadata as any) || {};
        await supabase
          .from("trips")
          .update({
            metadata: {
              ...metadata,
              last_price_alert_sent: new Date().toISOString(),
              price_alerts_sent: (metadata.price_alerts_sent || 0) + 1,
            },
          })
          .eq("id", alert.tripId);
      } else {
        failedCount++;
      }
    }

    logStep("Price alerts complete", { 
      totalAlerts: alerts.length,
      sent: sentCount, 
      failed: failedCount 
    });

    return new Response(
      JSON.stringify({ 
        ok: true, 
        alertsProcessed: alerts.length,
        sent: sentCount,
        failed: failedCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    logStep("Error in price alerts", { error: String(error) });
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
