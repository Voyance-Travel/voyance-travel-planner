/**
 * validate-iap-receipt — Validates Apple IAP receipts and fulfills credits.
 * 
 * Uses the same fulfill_credit_purchase RPC as the Stripe webhook for
 * consistent credit fulfillment and idempotency.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleCorsPreflightRequest, jsonResponse, errorResponse } from '../_shared/cors.ts';

// Map Apple product IDs to credit amounts and types
const PRODUCT_CONFIG: Record<string, {
  credits: number;
  bonusCredits: number;
  type: 'flexible' | 'club';
  tier?: string;
}> = {
  'com.voyancetravel.credits.flex100': { credits: 100, bonusCredits: 0, type: 'flexible' },
  'com.voyancetravel.credits.flex300': { credits: 300, bonusCredits: 0, type: 'flexible' },
  'com.voyancetravel.credits.flex500': { credits: 500, bonusCredits: 0, type: 'flexible' },
  'com.voyancetravel.club.voyager':    { credits: 500, bonusCredits: 100, type: 'club', tier: 'voyager' },
  'com.voyancetravel.club.explorer':   { credits: 1200, bonusCredits: 400, type: 'club', tier: 'explorer' },
  'com.voyancetravel.club.adventurer': { credits: 2400, bonusCredits: 800, type: 'club', tier: 'adventurer' },
};

Deno.serve(async (req) => {
  const corsResp = handleCorsPreflightRequest(req);
  if (corsResp) return corsResp;

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return errorResponse('Unauthorized', 401);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) return errorResponse('Unauthorized', 401);

    const { receiptData, productId, transactionId } = await req.json();

    if (!productId || !transactionId) {
      return errorResponse('Missing productId or transactionId', 400);
    }

    const config = PRODUCT_CONFIG[productId];
    if (!config) {
      return errorResponse(`Unknown product: ${productId}`, 400);
    }

    // ── Check for duplicate transaction (idempotency) ──
    const { data: existing } = await supabaseAdmin
      .from('iap_transactions')
      .select('id')
      .eq('transaction_id', transactionId)
      .maybeSingle();

    if (existing) {
      console.log(`[validate-iap-receipt] Duplicate transaction ${transactionId}, returning success`);
      return jsonResponse({ success: true, credits: config.credits + config.bonusCredits, duplicate: true });
    }

    // ── Validate receipt with Apple ──
    const isSandbox = Deno.env.get('APPLE_IAP_SANDBOX') === 'true';
    const appleVerifyUrl = isSandbox
      ? 'https://sandbox.itunes.apple.com/verifyReceipt'
      : 'https://buy.itunes.apple.com/verifyReceipt';

    const sharedSecret = Deno.env.get('APPLE_SHARED_SECRET');

    if (receiptData && sharedSecret) {
      const appleResponse = await fetch(appleVerifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          'receipt-data': receiptData,
          'password': sharedSecret,
          'exclude-old-transactions': true,
        }),
      });

      const appleResult = await appleResponse.json();

      // Status 21007 means sandbox receipt sent to production; retry with sandbox
      if (appleResult.status === 21007 && !isSandbox) {
        const sandboxResponse = await fetch('https://sandbox.itunes.apple.com/verifyReceipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            'receipt-data': receiptData,
            'password': sharedSecret,
            'exclude-old-transactions': true,
          }),
        });
        const sandboxResult = await sandboxResponse.json();
        if (sandboxResult.status !== 0) {
          console.error('[validate-iap-receipt] Apple validation failed:', sandboxResult.status);
          return errorResponse(`Apple receipt validation failed: ${sandboxResult.status}`, 400);
        }
      } else if (appleResult.status !== 0) {
        console.error('[validate-iap-receipt] Apple validation failed:', appleResult.status);
        return errorResponse(`Apple receipt validation failed: ${appleResult.status}`, 400);
      }
    } else {
      console.warn('[validate-iap-receipt] No receipt data or shared secret - proceeding with trust (dev mode)');
    }

    // ── Record the IAP transaction ──
    await supabaseAdmin.from('iap_transactions').insert({
      user_id: user.id,
      transaction_id: transactionId,
      product_id: productId,
      status: 'completed',
    });

    // ── Fulfill credits using the same RPC as Stripe ──
    const totalCredits = config.credits + config.bonusCredits;
    const sessionId = `apple_iap_${transactionId}`;

    const { data: fulfillResult, error: fulfillErr } = await supabaseAdmin.rpc('fulfill_credit_purchase', {
      p_user_id: user.id,
      p_credits: config.credits,
      p_bonus_credits: config.bonusCredits,
      p_credit_type: config.type === 'club' ? 'club_base' : 'flex',
      p_stripe_session_id: sessionId, // Reuse this field for idempotency
      p_amount_cents: 0, // Apple handles the payment
      p_club_tier: config.tier || null,
      p_product_id: productId,
      p_price_id: null,
    });

    if (fulfillErr) {
      console.error('[validate-iap-receipt] fulfill_credit_purchase failed:', fulfillErr);
      return errorResponse(`Credit fulfillment failed: ${fulfillErr.message}`, 500);
    }

    // Check if it was already fulfilled (idempotency in the RPC)
    if (fulfillResult?.skipped) {
      console.log(`[validate-iap-receipt] Already fulfilled for ${transactionId}`);
      return jsonResponse({ success: true, credits: totalCredits, duplicate: true });
    }

    console.log(`[validate-iap-receipt] ✅ Fulfilled ${totalCredits} credits for user ${user.id} (txn: ${transactionId})`);

    return jsonResponse({ success: true, credits: totalCredits });
  } catch (error) {
    console.error('[validate-iap-receipt] Error:', error);
    return errorResponse(error instanceof Error ? error.message : 'Internal error', 500);
  }
});
