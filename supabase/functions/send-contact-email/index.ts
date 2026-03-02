import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { sendEmail, isConfigured } from "../_shared/zoho-smtp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ContactRequest {
  name: string;
  email: string;
  subject?: string;
  message: string;
  type?: "general" | "support" | "feedback" | "bug_report" | "feature_request";
  website?: string; // Honeypot field
}

// Database-backed rate limiting (survives cold starts)
import { checkDbRateLimit } from "../_shared/db-rate-limiter.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS_PER_WINDOW = 5;

async function isRateLimited(key: string): Promise<boolean> {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );
  const result = await checkDbRateLimit(
    supabaseAdmin,
    key,
    "send-contact-email",
    { maxRequests: MAX_REQUESTS_PER_WINDOW, windowMs: RATE_LIMIT_WINDOW_MS },
  );
  return !result.allowed;
}

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

function sanitizeInput(input: string, maxLength: number): string {
  if (!input || typeof input !== 'string') return '';
  return input.replace(/<[^>]*>/g, '').trim().slice(0, maxLength);
}

const handler = async (req: Request): Promise<Response> => {
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  try {
    if (!isConfigured()) {
      throw new Error("Email service not configured");
    }

    const rawBody = await req.json();
    
    // Honeypot check
    if (rawBody.website && rawBody.website.trim() !== '') {
      console.warn('[send-contact-email] Honeypot triggered - likely bot submission');
      return new Response(
        JSON.stringify({ success: true, message: "Message sent successfully" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    // Sanitize and validate inputs
    const name = sanitizeInput(rawBody.name, 100);
    const email = sanitizeInput(rawBody.email, 255);
    const subject = sanitizeInput(rawBody.subject || '', 200);
    const message = sanitizeInput(rawBody.message, 5000);
    const type = ['general', 'support', 'feedback', 'bug_report', 'feature_request'].includes(rawBody.type) 
      ? rawBody.type 
      : 'general';

    if (!name || !email || !message) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: name, email, message" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!validateEmail(email)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid email address format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (message.length < 10) {
      return new Response(
        JSON.stringify({ success: false, error: "Message must be at least 10 characters" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (await isRateLimited(`email:${email}`)) {
      console.warn(`[send-contact-email] Rate limited: ${email}`);
      return new Response(
        JSON.stringify({ success: false, error: "Too many requests. Please try again later." }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('cf-connecting-ip') || 
                     'unknown';
    
    if (clientIP !== 'unknown' && await isRateLimited(`ip:${clientIP}`)) {
      console.warn(`[send-contact-email] Rate limited IP: ${clientIP}`);
      return new Response(
        JSON.stringify({ success: false, error: "Too many requests. Please try again later." }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`[send-contact-email] Processing: type=${type}, from=${email}`);

    const emailSubject = subject || `[Voyance ${type}] New message from ${name}`;

    // Escape HTML entities
    const escapeHtml = (str: string) => str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeSubject = escapeHtml(subject);
    const safeMessage = escapeHtml(message);
    const safeType = escapeHtml(type);

    // Send notification to support team
    const supportEmailResult = await sendEmail({
      to: "contact@travelwithvoyance.com",
      subject: emailSubject,
      replyTo: email,
      fromName: "Voyance Contact Form",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a1a;">New Contact Form Submission</h2>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Name:</strong> ${safeName}</p>
            <p><strong>Email:</strong> ${safeEmail}</p>
            <p><strong>Type:</strong> ${safeType}</p>
            ${safeSubject ? `<p><strong>Subject:</strong> ${safeSubject}</p>` : ""}
            <p><strong>IP:</strong> ${clientIP}</p>
          </div>
          <div style="background: #fff; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
            <h3 style="margin-top: 0;">Message:</h3>
            <p style="white-space: pre-wrap;">${safeMessage}</p>
          </div>
        </div>
      `,
    });

    if (!supportEmailResult.success) {
      console.error("Failed to send support email:", supportEmailResult.error);
      throw new Error("Failed to send email to support");
    }

    // Send confirmation to user
    const confirmationResult = await sendEmail({
      to: email,
      subject: "We received your message!",
      fromName: "Voyance",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a1a;">Thank you for reaching out, ${safeName}!</h2>
          <p>We've received your message and will get back to you as soon as possible, typically within 24-48 hours.</p>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Your message:</h3>
            <p style="white-space: pre-wrap; color: #666;">${safeMessage}</p>
          </div>
          <p>Best regards,<br>The Voyance Team</p>
        </div>
      `,
    });

    if (!confirmationResult.success) {
      console.warn("Failed to send confirmation email to user");
    }

    console.log("Contact email sent successfully");

    return new Response(
      JSON.stringify({ success: true, message: "Message sent successfully" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in send-contact-email function:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
