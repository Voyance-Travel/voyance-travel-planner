import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";
import { sendEmail, isConfigured } from "../_shared/zoho-smtp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TripReminder {
  tripId: string;
  tripName: string;
  destination: string;
  startDate: string;
  daysUntil: number;
  reminderType: "daily" | "weekly" | "monthly";
  userEmail: string;
  userName: string;
}

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[TRIP-REMINDERS] ${step}`, details ? JSON.stringify(details) : "");
};

function getReminderType(daysUntil: number): "daily" | "weekly" | "monthly" | null {
  if (daysUntil <= 0) return null;
  if (daysUntil <= 7) return "daily";
  if (daysUntil <= 30) return "weekly";
  return "monthly";
}

function shouldSendReminder(daysUntil: number, reminderType: "daily" | "weekly" | "monthly"): boolean {
  if (reminderType === "daily") {
    return daysUntil > 0 && daysUntil <= 7;
  }
  if (reminderType === "weekly") {
    return [28, 21, 14, 8].includes(daysUntil);
  }
  if (reminderType === "monthly") {
    return [60, 45, 30].includes(daysUntil);
  }
  return false;
}

// Daily messages (week of trip)
const dailyMessages = [
  {
    subject: "🎉 Only {{days}} days until {{destination}}!",
    headline: "The countdown is ON!",
    body: "Your adventure to {{destination}} is just around the corner. Have you started packing? Here's a quick mental checklist to get you excited.",
    tip: "Pro tip: Roll your clothes instead of folding – you'll fit more and avoid wrinkles!",
    cta: "Double-check your itinerary and make sure everything is set for the trip of a lifetime.",
  },
  {
    subject: "✈️ {{days}} days to go – {{destination}} awaits!",
    headline: "Adventure is calling!",
    body: "Can you feel the excitement building? {{destination}} is ready to welcome you. Take a moment to review your travel documents and confirmations.",
    tip: "Don't forget to download offline maps of {{destination}} – they're a lifesaver!",
    cta: "Need last-minute inspiration? Check out our destination guides for hidden gems.",
  },
  {
    subject: "🌟 T-minus {{days}} days to {{destination}}!",
    headline: "Your journey begins soon!",
    body: "The anticipation is the best part, right? Well, almost. {{destination}} has so much waiting for you. Make sure your camera is charged!",
    tip: "Consider arriving at the airport 3 hours early for international flights – peace of mind is worth it.",
    cta: "Share your upcoming trip with friends and family right from Voyance!",
  },
  {
    subject: "🗺️ {{destination}} in {{days}} days – Ready?",
    headline: "Almost time to explore!",
    body: "Weather forecasts, local customs, emergency numbers – have you done your pre-trip research? Don't worry, we've got your back with everything you need.",
    tip: "Notify your bank about your travel dates to avoid card blocks abroad!",
    cta: "Review your personalized itinerary one more time – we've crafted it just for you.",
  },
  {
    subject: "⏰ {{days}} days until takeoff to {{destination}}!",
    headline: "Final countdown mode: ON",
    body: "This is really happening! {{destination}} is about to become your reality. Time to finalize those last-minute details.",
    tip: "Pack a small bag with essentials in your carry-on – just in case your luggage takes a detour!",
    cta: "Create a packing list with our travel checklist feature – never forget anything again.",
  },
  {
    subject: "🎒 Packing for {{destination}}? {{days}} days left!",
    headline: "Time to pack smart!",
    body: "The bags won't pack themselves! But we can help make sure you don't forget anything important for your {{destination}} adventure.",
    tip: "Leave room in your suitcase for souvenirs – you know you'll find something amazing!",
    cta: "Invite travel companions to collaborate on your trip plans with Voyance.",
  },
  {
    subject: "✨ {{destination}} is calling – {{days}} days away!",
    headline: "Your dream trip is almost here!",
    body: "From planning to reality – you've made it this far! {{destination}} is going to be incredible. Trust your preparation and get ready for memories that last a lifetime.",
    tip: "Take photos of your passport, ID, and confirmations – store them in the cloud for backup!",
    cta: "After your trip, share your experience and help other travelers discover {{destination}}!",
  },
];

// Weekly messages (month before)
const weeklyMessages = [
  {
    subject: "📅 {{destination}} in {{weeks}} weeks – Time to plan!",
    headline: "Your trip is taking shape!",
    body: "With {{weeks}} weeks to go, now's the perfect time to fine-tune your plans. Have you thought about what experiences you absolutely can't miss in {{destination}}?",
    tip: "Book popular restaurants and attractions now – the best spots fill up fast!",
    cta: "Discover curated experiences for {{destination}} that match your travel style on Voyance.",
  },
  {
    subject: "🌍 {{weeks}} weeks until {{destination}} – Getting excited?",
    headline: "The best trips start with great planning!",
    body: "Your {{destination}} adventure is {{weeks}} weeks away. This is the sweet spot for finalizing accommodations, activities, and building anticipation!",
    tip: "Check if you need any vaccinations or visas – some take weeks to process!",
    cta: "Share your trip plans with friends and see who wants to join your adventure!",
  },
  {
    subject: "✈️ Countdown: {{weeks}} weeks to {{destination}}!",
    headline: "Making travel dreams come true!",
    body: "Every great adventure starts with a first step – and you've already taken yours by planning your trip to {{destination}}. Let's make sure you're fully prepared!",
    tip: "Start a travel fund for spending money – even small daily savings add up!",
    cta: "Explore similar destinations you might love for your next trip on Voyance.",
  },
  {
    subject: "🎯 {{destination}} countdown: {{weeks}} weeks out!",
    headline: "Stay organized, travel better!",
    body: "With {{weeks}} weeks until your {{destination}} trip, you're in the perfect window to handle logistics without stress. Flights confirmed? Hotel ready? Itinerary set?",
    tip: "Download your airline's app – digital boarding passes make everything smoother!",
    cta: "Plan your next adventure while you're at it – dream trips don't plan themselves!",
  },
];

// Monthly messages (more than a month out)
const monthlyMessages = [
  {
    subject: "🗓️ {{destination}} is {{months}} month(s) away!",
    headline: "Good things come to those who plan!",
    body: "Your trip to {{destination}} is {{months}} month(s) out – perfect timing to start getting organized. The best travelers plan ahead and enjoy the journey stress-free.",
    tip: "Set up price alerts for flights and hotels – early planning often means better deals!",
    cta: "Take our Travel DNA quiz to get even more personalized recommendations for your trip!",
  },
  {
    subject: "✨ {{destination}} dreams – {{months}} month(s) to go!",
    headline: "Let the anticipation build!",
    body: "Sometimes the excitement of planning is almost as good as the trip itself! With {{months}} month(s) until {{destination}}, you have time to craft the perfect experience.",
    tip: "Research local festivals and events happening during your visit – they're often the best memories!",
    cta: "Invite friends to Voyance and plan group trips together – adventures are better shared!",
  },
  {
    subject: "🌟 Your {{destination}} adventure – {{months}} month(s) away!",
    headline: "Every epic journey starts here!",
    body: "We're keeping your {{destination}} trip on our radar! Use this time to learn about local culture, cuisine, and hidden gems. The more you know, the richer your experience.",
    tip: "Start learning a few local phrases – locals love it when travelers make the effort!",
    cta: "Explore our destination guides and travel tips to become a {{destination}} expert!",
  },
];

function getRandomMessage(messages: typeof dailyMessages, daysUntil: number, destination: string): typeof dailyMessages[0] {
  const index = daysUntil % messages.length;
  const message = messages[index];
  
  const weeks = Math.ceil(daysUntil / 7);
  const months = Math.ceil(daysUntil / 30);
  
  return {
    subject: message.subject
      .replace(/{{days}}/g, String(daysUntil))
      .replace(/{{weeks}}/g, String(weeks))
      .replace(/{{months}}/g, String(months))
      .replace(/{{destination}}/g, destination),
    headline: message.headline,
    body: message.body
      .replace(/{{days}}/g, String(daysUntil))
      .replace(/{{weeks}}/g, String(weeks))
      .replace(/{{months}}/g, String(months))
      .replace(/{{destination}}/g, destination),
    tip: message.tip.replace(/{{destination}}/g, destination),
    cta: message.cta.replace(/{{destination}}/g, destination),
  };
}

function generateEmailHtml(reminder: TripReminder, message: ReturnType<typeof getRandomMessage>): string {
  const tripDate = new Date(reminder.startDate).toLocaleDateString('en-US', { 
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' 
  });
  
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
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 40px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">${message.headline}</h1>
                  <p style="margin: 15px 0 0; color: #a0aec0; font-size: 16px;">Your ${reminder.destination} adventure awaits</p>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px;">
                  <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                    Hi ${reminder.userName || 'Traveler'},
                  </p>
                  <p style="margin: 0 0 25px; color: #374151; font-size: 16px; line-height: 1.7;">
                    ${message.body}
                  </p>
                  
                  <!-- Trip Card -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%); border-radius: 12px; margin-bottom: 25px;">
                    <tr>
                      <td style="padding: 24px;">
                        <h2 style="margin: 0 0 16px; color: #1a1a2e; font-size: 20px; font-weight: 600;">
                          ${reminder.tripName || `Trip to ${reminder.destination}`}
                        </h2>
                        <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;">
                          📍 <strong>Destination:</strong> ${reminder.destination}
                        </p>
                        <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;">
                          📅 <strong>Departure:</strong> ${tripDate}
                        </p>
                        <p style="margin: 0; color: #6366f1; font-size: 16px; font-weight: 600;">
                          ⏰ ${reminder.daysUntil} day${reminder.daysUntil !== 1 ? 's' : ''} to go!
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- Tip Box -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 0 8px 8px 0; margin-bottom: 25px;">
                    <tr>
                      <td style="padding: 16px 20px;">
                        <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.5;">
                          💡 <strong>Travel Tip:</strong> ${message.tip}
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- CTA Section -->
                  <p style="margin: 0 0 20px; color: #374151; font-size: 15px; line-height: 1.6;">
                    ${message.cta}
                  </p>
                  
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="padding-top: 10px;">
                        <a href="https://voyance-travel-planner.lovable.app/trip/dashboard" 
                           style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                          View My Trip
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Promo Section -->
              <tr>
                <td style="background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%); padding: 24px 40px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td>
                        <h3 style="margin: 0 0 8px; color: #4338ca; font-size: 16px; font-weight: 600;">✨ Love planning with Voyance?</h3>
                        <p style="margin: 0; color: #6366f1; font-size: 14px; line-height: 1.5;">
                          Share Voyance with friends and plan your next adventure together! Personalized itineraries, smart recommendations, and stress-free travel planning await.
                        </p>
                      </td>
                      <td width="120" style="text-align: right;">
                        <a href="https://voyance-travel-planner.lovable.app" 
                           style="display: inline-block; background: #4f46e5; color: white; padding: 10px 16px; border-radius: 6px; text-decoration: none; font-weight: 500; font-size: 13px;">
                          Invite Friends
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
                    <a href="https://voyance-travel-planner.lovable.app/settings" style="color: #9ca3af;">Manage notifications</a> · 
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

async function sendReminderEmail(reminder: TripReminder): Promise<boolean> {
  const messages = reminder.reminderType === "daily" 
    ? dailyMessages 
    : reminder.reminderType === "weekly" 
    ? weeklyMessages 
    : monthlyMessages;
    
  const message = getRandomMessage(messages, reminder.daysUntil, reminder.destination);
  const html = generateEmailHtml(reminder, message);
  
  const textContent = `
${message.headline}

Hi ${reminder.userName || 'Traveler'},

${message.body}

Trip Details:
- Destination: ${reminder.destination}
- Departure: ${new Date(reminder.startDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
- Days until departure: ${reminder.daysUntil}

💡 Travel Tip: ${message.tip}

${message.cta}

View your trip: https://voyance-travel-planner.lovable.app/trip/dashboard

---
Love Voyance? Share it with friends and plan adventures together!
https://voyance-travel-planner.lovable.app

Manage notifications: https://voyance-travel-planner.lovable.app/settings
  `;

  try {
    const result = await sendEmail({
      to: reminder.userEmail,
      subject: message.subject,
      html: html,
      text: textContent,
      fromName: "Voyance Travel",
    });

    if (!result.success) {
      logStep("Email send failed", { error: result.error });
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
    logStep("Starting smart trip reminder check");

    if (!isConfigured()) {
      throw new Error("Email service not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + 90);
    
    const { data: trips, error: tripsError } = await supabase
      .from("trips")
      .select(`id, user_id, name, destination, start_date, status`)
      .gte("start_date", today.toISOString().split('T')[0])
      .lte("start_date", futureDate.toISOString().split('T')[0])
      .in("status", ["draft", "planning", "booked"]);

    if (tripsError) {
      throw new Error(`Failed to fetch trips: ${tripsError.message}`);
    }

    if (!trips || trips.length === 0) {
      logStep("No upcoming trips found");
      return new Response(
        JSON.stringify({ success: true, message: "No upcoming trips", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Found upcoming trips", { count: trips.length });

    const tripsToRemind: Array<typeof trips[0] & { daysUntil: number; reminderType: "daily" | "weekly" | "monthly" }> = [];
    
    for (const trip of trips) {
      const startDate = new Date(trip.start_date);
      startDate.setHours(0, 0, 0, 0);
      const daysUntil = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      const reminderType = getReminderType(daysUntil);
      if (reminderType && shouldSendReminder(daysUntil, reminderType)) {
        tripsToRemind.push({ ...trip, daysUntil, reminderType });
      }
    }

    logStep("Trips qualifying for reminders today", { count: tripsToRemind.length });

    if (tripsToRemind.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No reminders scheduled for today", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userIds = [...new Set(tripsToRemind.map(t => t.user_id))];

    const { data: preferences } = await supabase
      .from("user_preferences")
      .select("user_id, trip_reminders")
      .in("user_id", userIds)
      .eq("trip_reminders", true);

    const usersWithReminders = new Set(preferences?.map(p => p.user_id) || []);
    
    const filteredTrips = tripsToRemind.filter(t => usersWithReminders.has(t.user_id));
    
    if (filteredTrips.length === 0) {
      logStep("No users have reminders enabled");
      return new Response(
        JSON.stringify({ success: true, message: "No users with reminders enabled", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", [...usersWithReminders]);

    const profileMap = new Map(profiles?.map(p => [p.id, p.display_name]) || []);

    const userEmails: Record<string, string> = {};
    for (const userId of usersWithReminders) {
      const { data: userData } = await supabase.auth.admin.getUserById(userId);
      if (userData?.user?.email) {
        userEmails[userId] = userData.user.email;
      }
    }

    let sentCount = 0;
    const results: { tripId: string; reminderType: string; success: boolean; error?: string }[] = [];

    for (const trip of filteredTrips) {
      const userEmail = userEmails[trip.user_id];
      if (!userEmail) {
        results.push({ tripId: trip.id, reminderType: trip.reminderType, success: false, error: "No email" });
        continue;
      }

      const reminder: TripReminder = {
        tripId: trip.id,
        tripName: trip.name,
        destination: trip.destination,
        startDate: trip.start_date,
        daysUntil: trip.daysUntil,
        reminderType: trip.reminderType,
        userEmail,
        userName: profileMap.get(trip.user_id) || "",
      };

      const success = await sendReminderEmail(reminder);
      results.push({ tripId: trip.id, reminderType: trip.reminderType, success });
      
      if (success) {
        sentCount++;
        logStep("Reminder sent", { 
          tripId: trip.id, 
          destination: trip.destination, 
          daysUntil: trip.daysUntil,
          reminderType: trip.reminderType 
        });
      }
    }

    logStep("Reminder job complete", { total: filteredTrips.length, sent: sentCount });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent ${sentCount} reminder emails`,
        sent: sentCount,
        total: filteredTrips.length,
        breakdown: {
          daily: results.filter(r => r.reminderType === "daily").length,
          weekly: results.filter(r => r.reminderType === "weekly").length,
          monthly: results.filter(r => r.reminderType === "monthly").length,
        },
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    logStep("Error in trip reminders", { error: error instanceof Error ? error.message : String(error) });
    return new Response(
      JSON.stringify({ success: false, error: "Reminder processing failed", code: "REMINDER_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
