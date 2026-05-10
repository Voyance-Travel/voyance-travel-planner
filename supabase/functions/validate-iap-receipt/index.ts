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

// Apple status code → user-friendly message + retryability hint for the FE
const APPLE_STATUS_MESSAGES: Record<number, { msg: string; userActionable: boolean }> = {
  21000: { msg: 'Receipt could not be read by Apple. Please try again.', userActionable: true },
  21002: { msg: 'Receipt data was malformed. Please contact support.', userActionable: false },
  21003: { msg: 'Receipt authentication failed. Please try restoring your purchases.', userActionable: true },
  21004: { msg: 'Shared secret mismatch. Please contact support.', userActionable: false },
  21005: { msg: 'Apple is temporarily unavailable. Please try again in a few minutes.', userActionable: true },
  21006: { msg: 'This subscription has expired.', userActionable: false },
  21007: { msg: 'Sandbox receipt sent to production — should auto-retry.', userActionable: false },
  21008: { msg: 'Production receipt sent to sandbox — should auto-retry.', userActionable: false },
  21010: { msg: 'Apple cannot find this user account. Please contact support.', userActionable: false },
};

function appleStatusError(status: number) {
  const friendly = APPLE_STATUS_MESSAGES[status] || {
    msg: `Apple receipt validation returned status ${status}. Please contact support.`,
    userActionable: false,
  };
  return jsonResponse(
    {
      success: false,
      error: friendly.msg,
      code: `APPLE_STATUS_${status}`,
      userActionable: friendly.userActionable,
      appleStatus: status,
    },
    400,
  );
}

/**
 * Fetch with exponential backoff retry on transient failures.
 * Apple's verifyReceipt can return 500/503 under load, or the connection
 * can drop entirely. We retry up to 3 times with 250ms / 750ms / 2250ms backoff.
 *
 * Apple-validation status codes (e.g. 21007) are NOT network failures — those
 * come back with HTTP 200 and a status field in the body. The caller still
 * handles those.
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  maxAttempts = 3,
): Promise<Response> {
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, init);
      // Treat 5xx as transient and retry; any other status returns to the caller.
      if (res.status >= 500 && attempt < maxAttempts) {
        const body = await res.text().catch(() => '');
        console.warn(`[fetchWithRetry] attempt ${attempt} got ${res.status}, retrying`, { url, body: body.slice(0, 200) });
      } else {
        return res;
      }
    } catch (err) {
      lastErr = err;
      console.warn(`[fetchWithRetry] attempt ${attempt} threw, retrying`, {
        url,
        err: err instanceof Error ? err.message : String(err),
      });
      if (attempt === maxAttempts) break;
    }
    // Backoff: 250ms, 750ms, 2250ms (3x growth)
    await new Promise(r => setTimeout(r, 250 * Math.pow(3, attempt - 1)));
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error(`fetchWithRetry exhausted ${maxAttempts} attempts to ${url}`);
}

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

    const { receiptData, productId } = await req.json();

    if (!productId) {
      return errorResponse('Missing productId', 400);
    }
    if (!receiptData || typeof receiptData !== 'string') {
      return errorResponse('Missing receiptData', 400);
    }

    const config = PRODUCT_CONFIG[productId];
    if (!config) {
      return errorResponse(`Unknown product: ${productId}`, 400);
    }

    // ── Validate receipt with Apple (FAIL-CLOSED — no dev bypass) ──
    const sharedSecret = Deno.env.get('APPLE_SHARED_SECRET');
    if (!sharedSecret) {
      console.error('[validate-iap-receipt] APPLE_SHARED_SECRET not configured');
      return errorResponse('IAP not configured', 500);
    }

    const isSandbox = Deno.env.get('APPLE_IAP_SANDBOX') === 'true';
    const prodUrl = 'https://buy.itunes.apple.com/verifyReceipt';
    const sandboxUrl = 'https://sandbox.itunes.apple.com/verifyReceipt';
    const firstUrl = isSandbox ? sandboxUrl : prodUrl;

    const verifyBody = JSON.stringify({
      'receipt-data': receiptData,
      'password': sharedSecret,
      'exclude-old-transactions': true,
    });

    let verifiedData: any;
    try {
      const appleResponse = await fetchWithRetry(firstUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: verifyBody,
      });
      verifiedData = await appleResponse.json();

      // 21007 = sandbox receipt sent to prod → retry against sandbox
      if (verifiedData.status === 21007 && !isSandbox) {
        const sbResp = await fetchWithRetry(sandboxUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: verifyBody,
        });
        verifiedData = await sbResp.json();
      }
    } catch (err) {
      console.error('[validate-iap-receipt] Apple verifyReceipt network failure:', err);
      return errorResponse('Receipt verification failed', 502);
    }

    if (verifiedData.status !== 0) {
      console.error('[validate-iap-receipt] Apple validation failed:', verifiedData.status);
      return appleStatusError(verifiedData.status);
    }

    // ── Extract verified transaction (NEVER trust client-supplied transactionId) ──
    const txn = verifiedData.latest_receipt_info?.[0]
      ?? verifiedData.receipt?.in_app?.[0];

    if (!txn?.transaction_id || !txn?.product_id) {
      console.error('[validate-iap-receipt] No transaction in verified receipt');
      return errorResponse('No transaction in receipt', 400);
    }

    // Cross-check: client-claimed productId must match what Apple says was purchased.
    if (txn.product_id !== productId) {
      console.error(`[validate-iap-receipt] Product mismatch: client=${productId} apple=${txn.product_id}`);
      return errorResponse('Product mismatch with receipt', 400);
    }

    const verifiedTxnId: string = txn.transaction_id;
    const totalCredits = config.credits + config.bonusCredits;

    // ── Idempotency: dedupe on VERIFIED transaction_id ──
    const { data: existing } = await supabaseAdmin
      .from('iap_transactions')
      .select('id, credits_granted')
      .eq('transaction_id', verifiedTxnId)
      .maybeSingle();

    if (existing) {
      console.log(`[validate-iap-receipt] Duplicate verified txn ${verifiedTxnId}`);
      return jsonResponse({
        success: true,
        duplicate: true,
        credits: existing.credits_granted ?? totalCredits,
      });
    }

    // ── Record verified IAP transaction (UNIQUE constraint = concurrent dedupe) ──
    const { error: insertErr } = await supabaseAdmin.from('iap_transactions').insert({
      user_id: user.id,
      transaction_id: verifiedTxnId,
      product_id: productId,
      status: 'completed',
      verified_at: new Date().toISOString(),
      credits_granted: totalCredits,
      raw_receipt: verifiedData,
    });
    if (insertErr) {
      // Race: another request inserted the same verified txn first → treat as duplicate.
      if ((insertErr as any).code === '23505') {
        console.log(`[validate-iap-receipt] Concurrent duplicate ${verifiedTxnId}`);
        return jsonResponse({ success: true, duplicate: true, credits: totalCredits });
      }
      console.error('[validate-iap-receipt] Insert failed:', insertErr);
      return errorResponse('Failed to record transaction', 500);
    }

    // ── Fulfill credits using the same RPC as Stripe ──
    const sessionId = `apple_iap_${verifiedTxnId}`;

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
      console.log(`[validate-iap-receipt] Already fulfilled for ${verifiedTxnId}`);
      return jsonResponse({ success: true, credits: totalCredits, duplicate: true });
    }

    console.log(`[validate-iap-receipt] ✅ Fulfilled ${totalCredits} credits for user ${user.id} (txn: ${verifiedTxnId})`);

    return jsonResponse({ success: true, credits: totalCredits });
  } catch (error) {
    console.error('[validate-iap-receipt] Error:', error);
    return errorResponse(error instanceof Error ? error.message : 'Internal error', 500);
  }
});
