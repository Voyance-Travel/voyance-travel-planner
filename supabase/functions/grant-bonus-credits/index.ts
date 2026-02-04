/**
 * Grant Bonus Credits Edge Function
 * Grants one-time credit bonuses for various actions:
 * - welcome: 150 credits on email verification (2-month expiry)
 * - launch: 500 credits during launch period (2-week window)
 * - quiz_completion: 100 credits for first quiz completion
 * - preferences_completion: 50 credits for completing preferences
 * - first_share: 50 credits for sharing first trip
 * - second_itinerary: 50 credits for creating second itinerary
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Bonus configurations
const BONUS_CONFIG: Record<string, { 
  credits: number; 
  expirationMonths: number;
  description: string;
  requiresLaunchPeriod?: boolean;
}> = {
  welcome: {
    credits: 150,
    expirationMonths: 2,
    description: 'Welcome bonus - Thanks for joining Voyance!',
  },
  launch: {
    credits: 500,
    expirationMonths: 6,
    description: 'Early adopter bonus - Thank you for being part of our launch!',
    requiresLaunchPeriod: true,
  },
  quiz_completion: {
    credits: 100,
    expirationMonths: 6,
    description: 'Quiz completion bonus - Your Travel DNA has been revealed!',
  },
  preferences_completion: {
    credits: 50,
    expirationMonths: 6,
    description: 'Preferences bonus - Your travel style is now personalized!',
  },
  first_share: {
    credits: 50,
    expirationMonths: 6,
    description: 'First share bonus - Thanks for spreading the word!',
  },
  second_itinerary: {
    credits: 50,
    expirationMonths: 6,
    description: 'Second trip bonus - You\'re becoming a travel pro!',
  },
};

// Launch period configuration (2 weeks from deployment)
const LAUNCH_START = new Date('2026-02-04T00:00:00Z'); // Current date
const LAUNCH_DURATION_DAYS = 14;
const LAUNCH_END = new Date(LAUNCH_START.getTime() + LAUNCH_DURATION_DAYS * 24 * 60 * 60 * 1000);

interface GrantRequest {
  bonusType: keyof typeof BONUS_CONFIG;
  metadata?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request
    const body: GrantRequest = await req.json();
    const { bonusType, metadata } = body;

    // Validate bonus type
    if (!bonusType || !(bonusType in BONUS_CONFIG)) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid bonus type',
          validTypes: Object.keys(BONUS_CONFIG),
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const config = BONUS_CONFIG[bonusType];
    const now = new Date();

    // Check launch period for launch bonus
    if (config.requiresLaunchPeriod && (now < LAUNCH_START || now > LAUNCH_END)) {
      return new Response(
        JSON.stringify({ 
          granted: false,
          reason: 'Launch period has ended',
          launchEnd: LAUNCH_END.toISOString(),
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if bonus already claimed
    const { data: existingBonus, error: checkError } = await supabaseAdmin
      .from('user_credit_bonuses')
      .select('id, granted_at')
      .eq('user_id', user.id)
      .eq('bonus_type', bonusType)
      .maybeSingle();

    if (checkError) {
      console.error('[grant-bonus-credits] Error checking existing bonus:', checkError);
      return new Response(
        JSON.stringify({ error: 'Failed to check bonus status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (existingBonus) {
      return new Response(
        JSON.stringify({ 
          granted: false,
          reason: 'Bonus already claimed',
          claimedAt: existingBonus.granted_at,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate expiration
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + config.expirationMonths);

    // Get current balance
    const { data: balance } = await supabaseAdmin
      .from('credit_balances')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    const currentFreeCredits = balance?.free_credits || 0;
    const currentPurchasedCredits = balance?.purchased_credits || 0;
    const newFreeCredits = currentFreeCredits + config.credits;

    // Update the longer expiration if this bonus has a longer expiration
    let newExpiresAt = expiresAt;
    if (balance?.free_credits_expires_at) {
      const existingExpiry = new Date(balance.free_credits_expires_at);
      if (existingExpiry > expiresAt) {
        newExpiresAt = existingExpiry;
      }
    }

    // Record the bonus claim
    const { error: insertError } = await supabaseAdmin
      .from('user_credit_bonuses')
      .insert({
        user_id: user.id,
        bonus_type: bonusType,
        credits_granted: config.credits,
        expires_at: expiresAt.toISOString(),
        metadata: metadata || {},
      });

    if (insertError) {
      console.error('[grant-bonus-credits] Error recording bonus:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to record bonus' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update credit balance
    const { error: updateError } = await supabaseAdmin
      .from('credit_balances')
      .upsert({
        user_id: user.id,
        free_credits: newFreeCredits,
        purchased_credits: currentPurchasedCredits,
        free_credits_expires_at: newExpiresAt.toISOString(),
        updated_at: now.toISOString(),
      }, { onConflict: 'user_id' });

    if (updateError) {
      console.error('[grant-bonus-credits] Error updating balance:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update balance' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log in credit ledger
    await supabaseAdmin
      .from('credit_ledger')
      .insert({
        user_id: user.id,
        amount: config.credits,
        credit_type: 'free',
        action: `bonus_${bonusType}`,
        description: config.description,
      });

    console.log(`[grant-bonus-credits] Granted ${config.credits} credits to ${user.id} for ${bonusType}`);

    return new Response(
      JSON.stringify({
        granted: true,
        bonusType,
        credits: config.credits,
        description: config.description,
        expiresAt: expiresAt.toISOString(),
        newBalance: {
          free: newFreeCredits,
          purchased: currentPurchasedCredits,
          total: newFreeCredits + currentPurchasedCredits,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[grant-bonus-credits] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
