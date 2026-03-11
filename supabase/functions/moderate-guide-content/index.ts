import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BLOCKED_PATTERNS = [
  // Violence / self-harm
  /\b(kill\s+(yourself|myself|them|him|her)|murder|suicide\s+(guide|howto|method)|self[- ]?harm|bomb\s+threat|terrorist\s+attack)\b/i,
  // Explicit sexual content
  /\b(porn(ography)?|xxx|nsfw|nude\s+photo|explicit\s+sex)\b/i,
  // Hard drugs
  /\b(buy\s+(cocaine|heroin|meth|fentanyl)|drug\s+dealer)\b/i,
  // Hate speech (broad patterns)
  /\b(white\s+supremac|ethnic\s+cleansing|genocide\s+is\s+good)\b/i,
  // Scam/phishing
  /\b(phishing|malware\s+download|scam\s+link)\b/i,
];

const WARNED_PATTERNS = [
  // Phone numbers (US format)
  { pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, type: 'phone number' },
  // Email addresses
  { pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, type: 'email address' },
  // SSN-like
  { pattern: /\b\d{3}[-]\d{2}[-]\d{4}\b/, type: 'possible SSN' },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { texts } = await req.json();

    if (!texts || !Array.isArray(texts)) {
      return new Response(
        JSON.stringify({ error: 'texts array required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const allText = texts.join(' ');
    const blocked_reasons: string[] = [];
    const warnings: string[] = [];

    // Check blocked patterns
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(allText)) {
        blocked_reasons.push('Content contains prohibited material that violates community guidelines.');
        break;
      }
    }

    // Check warning patterns
    for (const { pattern, type } of WARNED_PATTERNS) {
      if (pattern.test(allText)) {
        warnings.push(`Your guide appears to contain a ${type}. Community guides are public — are you sure you want to include this?`);
      }
    }

    const approved = blocked_reasons.length === 0;

    return new Response(
      JSON.stringify({ approved, warnings, blocked_reasons }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Internal error', details: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
