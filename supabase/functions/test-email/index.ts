import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";
import { sendEmail, isConfigured } from "../_shared/zoho-smtp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TestEmailRequest {
  to?: string;
  template?: "welcome" | "booking-confirmation" | "trip-reminder" | "test";
}

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[TEST-EMAIL] ${step}`, details ? JSON.stringify(details) : "");
};

const templates = {
  test: {
    subject: "🧪 Voyance Test Email - Zoho SMTP is Working!",
    html: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="margin: 0; padding: 40px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5;">
        <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center;">
            <h1 style="margin: 0; color: white; font-size: 24px;">✅ Email Test Successful</h1>
          </div>
          <div style="padding: 30px;">
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">
              Great news! Your Zoho SMTP integration is working correctly.
            </p>
            <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
              Sent at: ${new Date().toISOString()}
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Email Test Successful!\n\nYour Zoho SMTP integration is working correctly.\n\nSent at: ${new Date().toISOString()}`,
  },
  welcome: {
    subject: "🌟 Welcome to Voyance - Your Journey Begins!",
    html: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="margin: 0; padding: 40px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 40px; text-align: center;">
            <h1 style="margin: 0; color: white; font-size: 28px;">Welcome to Voyance ✨</h1>
            <p style="margin: 10px 0 0; color: #a0aec0;">Your personalized travel companion</p>
          </div>
          <div style="padding: 40px;">
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">
              We're thrilled to have you join the Voyance community! Get ready for personalized travel experiences crafted just for you.
            </p>
            <h3 style="color: #1a1a2e; margin-top: 30px;">What's Next?</h3>
            <ul style="color: #374151; font-size: 14px; line-height: 2;">
              <li>Complete your Travel DNA quiz for personalized recommendations</li>
              <li>Explore destinations matched to your style</li>
              <li>Start planning your first adventure</li>
            </ul>
            <div style="text-align: center; margin-top: 30px;">
              <a href="https://voyance-travel-planner.lovable.app/quiz" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">Take the Quiz</a>
            </div>
          </div>
          <div style="background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; color: #9ca3af; font-size: 12px;">Voyance - Travel Your Way</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Welcome to Voyance!\n\nWe're thrilled to have you join us. Get ready for personalized travel experiences.\n\nNext steps:\n- Complete your Travel DNA quiz\n- Explore destinations\n- Start planning!\n\nVisit: https://voyance-travel-planner.lovable.app/quiz`,
  },
  "booking-confirmation": {
    subject: "🎉 Booking Confirmed - Your Trip is Set!",
    html: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="margin: 0; padding: 40px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px; text-align: center;">
            <h1 style="margin: 0; color: white; font-size: 28px;">Booking Confirmed! 🎉</h1>
          </div>
          <div style="padding: 40px;">
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">
              Your trip has been successfully booked. This is a test template showing what a booking confirmation email would look like.
            </p>
            <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin: 20px 0;">
              <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;"><strong>Confirmation #:</strong> TEST-12345</p>
              <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;"><strong>Destination:</strong> Sample Destination</p>
              <p style="margin: 0; color: #6b7280; font-size: 14px;"><strong>Dates:</strong> TBD</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Booking Confirmed!\n\nYour trip has been successfully booked.\n\nConfirmation #: TEST-12345\nDestination: Sample Destination\nDates: TBD`,
  },
  "trip-reminder": {
    subject: "✈️ Trip Reminder - Your Adventure Awaits!",
    html: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="margin: 0; padding: 40px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 40px; text-align: center;">
            <h1 style="margin: 0; color: white; font-size: 28px;">Trip Reminder ✈️</h1>
          </div>
          <div style="padding: 40px;">
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">
              This is a test of the trip reminder email template. In production, this would include specific trip details.
            </p>
            <h3 style="color: #1a1a2e;">Sample Checklist:</h3>
            <ul style="color: #374151; font-size: 14px; line-height: 2;">
              <li>✅ Passport ready</li>
              <li>✅ Confirmations saved</li>
              <li>✅ Bags packed</li>
            </ul>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Trip Reminder!\n\nYour adventure awaits. Make sure you're prepared!\n\nChecklist:\n✅ Passport ready\n✅ Confirmations saved\n✅ Bags packed`,
  },
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Test email request received");

    if (!isConfigured()) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Zoho SMTP not configured",
          hint: "Add ZOHO_SMTP_USER and ZOHO_SMTP_PASSWORD secrets in your Lovable Cloud settings"
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let targetEmail: string | undefined;
    let templateName: keyof typeof templates = "test";

    try {
      const body: TestEmailRequest = await req.json();
      targetEmail = body.to;
      if (body.template && templates[body.template]) {
        templateName = body.template;
      }
    } catch {
      // No body provided, will try to get user email
    }

    // If no email provided, try to get from authenticated user
    if (!targetEmail) {
      const authHeader = req.headers.get("authorization");
      if (authHeader) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader } }
        });
        
        const { data: { user } } = await supabase.auth.getUser();
        targetEmail = user?.email;
      }
    }

    if (!targetEmail) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No email address provided",
          hint: "Either authenticate or provide 'to' in request body"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Sending test email", { to: targetEmail, template: templateName });

    const template = templates[templateName];
    const result = await sendEmail({
      to: targetEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      fromName: "Voyance Travel",
    });

    if (!result.success) {
      logStep("Email send failed", { error: result.error });
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Failed to send email",
          details: result.error
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Test email sent successfully", { to: targetEmail, template: templateName });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Test email sent to ${targetEmail}`,
        template: templateName,
        sentAt: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    logStep("Error", { error: error instanceof Error ? error.message : String(error) });
    return new Response(
      JSON.stringify({ success: false, error: "Email test failed", code: "EMAIL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
