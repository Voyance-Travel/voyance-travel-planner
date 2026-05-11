import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";
import { sendEmail, isConfigured } from "../_shared/zoho-smtp.ts";
import { parseAuth } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PostTripEmailRequest {
  tripId: string;
  forceResend?: boolean;
}

async function triggerSummarization(supabase: any, tripId: string, source: string) {
  try {
    const { error } = await supabase.functions.invoke('summarize-trip-learnings', {
      body: { tripId },
    });
    if (error) console.error(`[post-trip-email] Summarization invoke failed (${source})`, error);
    else console.log(`[post-trip-email] Summarization invoked (${source}) for trip ${tripId}`);
  } catch (err) {
    console.error(`[post-trip-email] Summarization invoke threw (${source})`, err);
  }
}

interface TripMemory {
  title: string;
  date: string;
  category: string;
  rating?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // JWT auth: derive caller identity from the validated token.
  // parseAuth allows service-role bypass (returns userId === 'service_role')
  // for internal cron callers; user JWTs return their auth.uid().
  const auth = await parseAuth(req);
  if (auth instanceof Response) return auth;

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase configuration");
    }

    if (!isConfigured()) {
      throw new Error("Email service not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body: PostTripEmailRequest & { userId?: string } = await req.json();
    const { tripId, forceResend } = body;

    if (!tripId) {
      return new Response(
        JSON.stringify({ error: "tripId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get trip details
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('id, name, destination, start_date, end_date, user_id')
      .eq('id', tripId)
      .single();

    if (tripError || !trip) {
      throw new Error("Trip not found");
    }

    // Derive trip-owner userId for downstream queries. For user JWTs, the
    // caller MUST own the trip. Service-role callers (internal cron) trust
    // the trip's stored owner.
    const userId = auth.userId === "service_role" ? trip.user_id : auth.userId;
    if (auth.userId !== "service_role" && trip.user_id !== auth.userId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Preference gate: respect user's email opt-out before doing any work.
    // Both `email_notifications` (master switch) and `trip_reminders` (specific
    // gate for trip-related emails) must be true. Defaults are true/true so
    // users who never visited preferences still receive these emails.
    const { data: prefs } = await supabase
      .from('user_preferences')
      .select('email_notifications, trip_reminders')
      .eq('user_id', userId)
      .maybeSingle();

    if (prefs && (prefs.email_notifications === false || prefs.trip_reminders === false)) {
      console.log(`[post-trip-email] Skipped — user ${userId} opted out`, {
        email_notifications: prefs.email_notifications,
        trip_reminders: prefs.trip_reminders,
      });
      // Mark as "sent" in the log so we don't retry forever.
      await supabase.from('trip_notifications').upsert(
        {
          trip_id: tripId,
          user_id: userId,
          notification_type: 'post_trip_followup',
          sent: true,
          sent_at: new Date().toISOString(),
          metadata: { skipped_reason: 'user_opted_out' },
        },
        { onConflict: 'trip_id,notification_type' }
      );
      await triggerSummarization(supabase, tripId, 'opt_out');
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'user_opted_out' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if email already sent (unless forced)
    const { data: existingNotif } = await supabase
      .from('trip_notifications')
      .select('id')
      .eq('trip_id', tripId)
      .eq('notification_type', 'post_trip_followup')
      .eq('sent', true)
      .maybeSingle();

    if (existingNotif && !forceResend) {
      await triggerSummarization(supabase, tripId, 'already_sent');
      return new Response(
        JSON.stringify({ success: true, message: "Email already sent" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user profile and email
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, first_name')
      .eq('id', userId)
      .single();

    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    const userEmail = authUser?.user?.email;
    const userName = profile?.first_name || profile?.display_name || 'Traveler';

    if (!userEmail) {
      throw new Error("User email not found");
    }

    // Get completed activities (memories)
    const { data: activities } = await supabase
      .from('trip_activities')
      .select('id, title, category, scheduled_date, user_rating')
      .eq('trip_id', tripId)
      .eq('is_completed', true)
      .order('scheduled_date', { ascending: true })
      .limit(10);

    // Get any feedback already given
    const { data: feedback } = await supabase
      .from('activity_feedback')
      .select('activity_id, rating')
      .eq('trip_id', tripId);

    const feedbackMap = new Map(feedback?.map(f => [f.activity_id, f.rating]) || []);

    // Build memories list
    const memories: TripMemory[] = (activities || []).map(a => ({
      title: a.title,
      date: a.scheduled_date || '',
      category: a.category || 'activity',
      rating: feedbackMap.get(a.id) || a.user_rating,
    }));

    // Calculate trip stats
    const tripDuration = trip.start_date && trip.end_date
      ? Math.ceil((new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1
      : null;

    // Resolve site URL from env, falling back to SITE_DOMAIN, then production domain.
    const SITE_URL = Deno.env.get('SITE_URL')
      ?? `https://${Deno.env.get('SITE_DOMAIN') ?? 'travelwithvoyance.com'}`;

    // Generate email HTML
    const emailHtml = generatePostTripEmailHtml({
      userName,
      destination: trip.destination,
      tripName: trip.name,
      tripDuration,
      memories,
      feedbackUrl: `${SITE_URL}/trips/${tripId}/feedback`,
      archivesUrl: `${SITE_URL}/trips/${tripId}`,
    });

    // Send the email via Zoho SMTP
    const result = await sendEmail({
      to: userEmail,
      subject: `Your ${trip.destination} memories await 📸`,
      html: emailHtml,
      fromName: "Voyance",
    });

    if (!result.success) {
      console.error(`[PostTripEmail] Failed to send email to ${userEmail}:`, result.error);
      throw new Error(`Failed to send email: ${result.error}`);
    }

    console.log(`[PostTripEmail] Email sent successfully to ${userEmail}`);

    // Record that we sent the notification
    await supabase
      .from('trip_notifications')
      .upsert({
        trip_id: tripId,
        user_id: userId,
        notification_type: 'post_trip_followup',
        sent: true,
        sent_at: new Date().toISOString(),
        metadata: { memories: memories.length, destination: trip.destination },
      }, { onConflict: 'trip_id,notification_type' });

    await triggerSummarization(supabase, tripId, 'after_email');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Post-trip email sent",
        memories: memories.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("post-trip-email error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Email delivery failed", code: "EMAIL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

interface EmailTemplateData {
  userName: string;
  destination: string;
  tripName: string;
  tripDuration: number | null;
  memories: TripMemory[];
  feedbackUrl: string;
  archivesUrl: string;
}

function generatePostTripEmailHtml(data: EmailTemplateData): string {
  const { userName, destination, tripName, tripDuration, memories, feedbackUrl, archivesUrl } = data;

  const memoriesHtml = memories.slice(0, 5).map(m => `
    <tr>
      <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
        <div style="font-weight: 500; color: #1a1a1a;">${m.title}</div>
        <div style="font-size: 13px; color: #666; margin-top: 4px;">
          ${m.category} ${m.rating ? `• ${m.rating === 'loved' ? '❤️' : m.rating === 'liked' ? '👍' : '👎'}` : ''}
        </div>
      </td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your ${destination} Memories</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8f9fa;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f8f9fa; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
          
          <!-- Hero -->
          <tr>
            <td style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 48px 32px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 16px;">✨</div>
              <h1 style="color: #ffffff; font-size: 24px; font-weight: 600; margin: 0 0 8px 0;">
                Welcome back, ${userName}
              </h1>
              <p style="color: rgba(255,255,255,0.8); font-size: 16px; margin: 0;">
                One week since ${destination}. Time flies.
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="color: #1a1a1a; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
                ${tripDuration ? `${tripDuration} days, ` : ''}${memories.length} experiences, countless moments.
                <br><br>
                We've saved your highlights from <strong>${tripName || destination}</strong>. 
                Want to see them again? Or help us make your next trip even better?
              </p>
              
              ${memories.length > 0 ? `
              <!-- Memories Preview -->
              <div style="background-color: #f8f9fa; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <h3 style="color: #1a1a1a; font-size: 14px; font-weight: 600; margin: 0 0 16px 0; text-transform: uppercase; letter-spacing: 0.5px;">
                  Your Highlights
                </h3>
                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                  ${memoriesHtml}
                </table>
                ${memories.length > 5 ? `
                <p style="color: #666; font-size: 13px; margin: 16px 0 0 0;">
                  + ${memories.length - 5} more experiences
                </p>
                ` : ''}
              </div>
              ` : ''}
              
              <!-- CTAs -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="padding-right: 8px;">
                    <a href="${archivesUrl}" style="display: block; background-color: #1a1a2e; color: #ffffff; text-decoration: none; padding: 14px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; text-align: center;">
                      View Trip Archives
                    </a>
                  </td>
                  <td style="padding-left: 8px;">
                    <a href="${feedbackUrl}" style="display: block; background-color: #f0f0f0; color: #1a1a1a; text-decoration: none; padding: 14px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; text-align: center;">
                      Share Feedback
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #666; font-size: 13px; line-height: 1.6; margin: 24px 0 0 0; text-align: center;">
                Your feedback helps us learn what you love—so your next trip is even more "you."
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 24px 32px; text-align: center; border-top: 1px solid #e8e8e8;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                Until the next adventure,<br>
                <strong style="color: #666;">The Voyance Team</strong>
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

serve(handler);
