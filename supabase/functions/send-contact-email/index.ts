import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");
const CONTACT_EMAIL = "hello@voyance.travel"; // Change to your support email

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ContactRequest {
  name: string;
  email: string;
  subject?: string;
  message: string;
  type?: "general" | "support" | "feedback" | "bug_report" | "feature_request";
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!SENDGRID_API_KEY) {
      throw new Error("SendGrid API key not configured");
    }

    const { name, email, subject, message, type = "general" }: ContactRequest = await req.json();

    // Validate required fields
    if (!name || !email || !message) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: name, email, message" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const emailSubject = subject || `[Voyance ${type}] New message from ${name}`;

    // Send notification to support team
    const supportEmailResponse = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: CONTACT_EMAIL }] }],
        from: { email: "noreply@voyance.travel", name: "Voyance Contact Form" },
        reply_to: { email, name },
        subject: emailSubject,
        content: [
          {
            type: "text/html",
            value: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1a1a1a;">New Contact Form Submission</h2>
                <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <p><strong>Name:</strong> ${name}</p>
                  <p><strong>Email:</strong> ${email}</p>
                  <p><strong>Type:</strong> ${type}</p>
                  ${subject ? `<p><strong>Subject:</strong> ${subject}</p>` : ""}
                </div>
                <div style="background: #fff; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
                  <h3 style="margin-top: 0;">Message:</h3>
                  <p style="white-space: pre-wrap;">${message}</p>
                </div>
              </div>
            `,
          },
        ],
      }),
    });

    if (!supportEmailResponse.ok) {
      const errorText = await supportEmailResponse.text();
      console.error("SendGrid error:", errorText);
      throw new Error("Failed to send email to support");
    }

    // Send confirmation to user
    const confirmationResponse = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email }] }],
        from: { email: "noreply@voyance.travel", name: "Voyance" },
        subject: "We received your message!",
        content: [
          {
            type: "text/html",
            value: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1a1a1a;">Thank you for reaching out, ${name}!</h2>
                <p>We've received your message and will get back to you as soon as possible, typically within 24-48 hours.</p>
                <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="margin-top: 0;">Your message:</h3>
                  <p style="white-space: pre-wrap; color: #666;">${message}</p>
                </div>
                <p>Best regards,<br>The Voyance Team</p>
              </div>
            `,
          },
        ],
      }),
    });

    if (!confirmationResponse.ok) {
      console.warn("Failed to send confirmation email to user");
    }

    console.log("Contact email sent successfully");

    return new Response(
      JSON.stringify({ success: true, message: "Message sent successfully" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-contact-email function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
