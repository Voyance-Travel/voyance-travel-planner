import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TripReminder {
  tripId: string;
  userId: string;
  userEmail: string;
  userName: string;
  destination: string;
  tripName: string;
  startDate: string;
  daysUntil: number;
}

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[TRIP-REMINDERS] ${step}`, details ? JSON.stringify(details) : "");
};

async function sendReminderEmail(
  reminder: TripReminder,
  sendgridApiKey: string
): Promise<boolean> {
  const daysText = reminder.daysUntil === 1 
    ? "tomorrow" 
    : reminder.daysUntil === 0 
    ? "today" 
    : `in ${reminder.daysUntil} days`;

  const emailHtml = `
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
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 40px 40px 30px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">✈️ Trip Reminder</h1>
                  <p style="margin: 10px 0 0; color: #a0aec0; font-size: 16px;">Your adventure awaits!</p>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px;">
                  <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                    Hi ${reminder.userName || 'Traveler'},
                  </p>
                  <p style="margin: 0 0 30px; color: #374151; font-size: 16px; line-height: 1.6;">
                    Your trip to <strong style="color: #1a1a2e;">${reminder.destination}</strong> starts <strong style="color: #6366f1;">${daysText}</strong>! 
                    Make sure you have everything ready for your adventure.
                  </p>
                  
                  <!-- Trip Card -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 12px; padding: 24px; margin-bottom: 30px;">
                    <tr>
                      <td>
                        <h2 style="margin: 0 0 16px; color: #1a1a2e; font-size: 20px; font-weight: 600;">
                          ${reminder.tripName || reminder.destination}
                        </h2>
                        <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;">
                          📍 <strong>Destination:</strong> ${reminder.destination}
                        </p>
                        <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;">
                          📅 <strong>Departure:</strong> ${new Date(reminder.startDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>
                        <p style="margin: 0; color: #6b7280; font-size: 14px;">
                          ⏰ <strong>Days until departure:</strong> ${reminder.daysUntil}
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- Checklist -->
                  <h3 style="margin: 0 0 16px; color: #1a1a2e; font-size: 16px; font-weight: 600;">Quick Checklist:</h3>
                  <ul style="margin: 0 0 30px; padding-left: 20px; color: #374151; font-size: 14px; line-height: 2;">
                    <li>✅ Passport and travel documents ready</li>
                    <li>✅ Flights and hotel confirmations printed/saved</li>
                    <li>✅ Travel insurance arranged</li>
                    <li>✅ Phone charger and adapters packed</li>
                    <li>✅ Check weather forecast for ${reminder.destination}</li>
                  </ul>

                  <p style="margin: 0; color: #374151; font-size: 16px; line-height: 1.6;">
                    Have an amazing trip! 🌟
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 24px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;">
                    Sent with ❤️ by Voyance
                  </p>
                  <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                    You can manage your notification preferences in your <a href="https://voyance-travel-planner.lovable.app/settings" style="color: #6366f1;">account settings</a>.
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

  const emailText = `
Trip Reminder - Your adventure awaits!

Hi ${reminder.userName || 'Traveler'},

Your trip to ${reminder.destination} starts ${daysText}!

Trip Details:
- Destination: ${reminder.destination}
- Departure: ${new Date(reminder.startDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
- Days until departure: ${reminder.daysUntil}

Quick Checklist:
✅ Passport and travel documents ready
✅ Flights and hotel confirmations printed/saved
✅ Travel insurance arranged
✅ Phone charger and adapters packed
✅ Check weather forecast for ${reminder.destination}

Have an amazing trip!

---
Sent by Voyance
Manage notifications: https://voyance-travel-planner.lovable.app/settings
  `;

  try {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${sendgridApiKey}`,
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: reminder.userEmail }] }],
        from: { email: "no-reply@voyancetravel.com", name: "Voyance Travel" },
        subject: `✈️ Trip Reminder: Your ${reminder.destination} adventure starts ${daysText}!`,
        content: [
          { type: "text/plain", value: emailText },
          { type: "text/html", value: emailHtml },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logStep("SendGrid error", { status: response.status, error: errorText });
      return false;
    }

    return true;
  } catch (error) {
    logStep("Email send failed", { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Starting trip reminder check");

    const sendgridApiKey = Deno.env.get("SENDGRID_API_KEY");
    if (!sendgridApiKey) {
      throw new Error("SENDGRID_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get trips starting in 1, 3, or 7 days
    const today = new Date();
    const reminderDays = [1, 3, 7];
    const targetDates = reminderDays.map(days => {
      const date = new Date(today);
      date.setDate(date.getDate() + days);
      return date.toISOString().split('T')[0];
    });

    logStep("Checking for trips", { targetDates });

    // Fetch trips with matching start dates
    const { data: trips, error: tripsError } = await supabase
      .from("trips")
      .select(`
        id,
        user_id,
        name,
        destination,
        start_date,
        status
      `)
      .in("start_date", targetDates)
      .in("status", ["draft", "planning", "booked"]);

    if (tripsError) {
      throw new Error(`Failed to fetch trips: ${tripsError.message}`);
    }

    if (!trips || trips.length === 0) {
      logStep("No trips found for reminder dates");
      return new Response(
        JSON.stringify({ success: true, message: "No trips to remind", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Found trips for reminders", { count: trips.length });

    // Get user IDs to check preferences
    const userIds = [...new Set(trips.map(t => t.user_id))];

    // Fetch user preferences (trip_reminders must be true)
    const { data: preferences, error: prefsError } = await supabase
      .from("user_preferences")
      .select("user_id, trip_reminders")
      .in("user_id", userIds)
      .eq("trip_reminders", true);

    if (prefsError) {
      logStep("Error fetching preferences", { error: prefsError.message });
    }

    const usersWithReminders = new Set(preferences?.map(p => p.user_id) || []);
    logStep("Users with reminders enabled", { count: usersWithReminders.size });

    // Filter trips to only those users who want reminders
    const tripsToRemind = trips.filter(t => usersWithReminders.has(t.user_id));

    if (tripsToRemind.length === 0) {
      logStep("No users have reminders enabled for upcoming trips");
      return new Response(
        JSON.stringify({ success: true, message: "No users have reminders enabled", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch user emails from auth.users (via profiles)
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", [...usersWithReminders]);

    // Get emails from auth
    const userEmails: Record<string, string> = {};
    for (const userId of usersWithReminders) {
      const { data: userData } = await supabase.auth.admin.getUserById(userId);
      if (userData?.user?.email) {
        userEmails[userId] = userData.user.email;
      }
    }

    const profileMap = new Map(profiles?.map(p => [p.id, p.display_name]) || []);

    // Send reminders
    let sentCount = 0;
    const results: { tripId: string; success: boolean; error?: string }[] = [];

    for (const trip of tripsToRemind) {
      const userEmail = userEmails[trip.user_id];
      if (!userEmail) {
        results.push({ tripId: trip.id, success: false, error: "No email found" });
        continue;
      }

      const startDate = new Date(trip.start_date);
      const daysUntil = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      const reminder: TripReminder = {
        tripId: trip.id,
        userId: trip.user_id,
        userEmail,
        userName: profileMap.get(trip.user_id) || "",
        destination: trip.destination,
        tripName: trip.name,
        startDate: trip.start_date,
        daysUntil,
      };

      const success = await sendReminderEmail(reminder, sendgridApiKey);
      results.push({ tripId: trip.id, success });
      
      if (success) {
        sentCount++;
        logStep("Reminder sent", { tripId: trip.id, destination: trip.destination, daysUntil });
      }
    }

    logStep("Reminder job complete", { total: tripsToRemind.length, sent: sentCount });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent ${sentCount} reminder emails`,
        sent: sentCount,
        total: tripsToRemind.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    logStep("Error in trip reminders", { error: error instanceof Error ? error.message : String(error) });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
