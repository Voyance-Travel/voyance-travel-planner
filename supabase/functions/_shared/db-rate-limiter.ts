/**
 * Database-backed rate limiter using the existing `rate_limits` table.
 *
 * Survives cold starts because state is stored in the database, not in-memory.
 * Uses a sliding-window count: "how many rows exist for this key in the last N ms?"
 *
 * The existing `cleanup_rate_limits()` DB function already purges rows older than 24 h.
 */

import { SupabaseClient } from "npm:@supabase/supabase-js@2.90.1";

export interface RateLimitRule {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  count: number;
}

/**
 * Check and record a rate-limited action against the `rate_limits` table.
 *
 * @param supabaseAdmin - A service-role Supabase client (bypasses RLS).
 * @param key           - A stable identifier (user ID, IP address, email, etc.)
 * @param endpoint      - Logical action name stored alongside each row.
 * @param rule          - { maxRequests, windowMs } defining the limit.
 * @param userId        - Optional user UUID (written to the `user_id` column).
 */
export async function checkDbRateLimit(
  supabaseAdmin: SupabaseClient,
  key: string,
  endpoint: string,
  rule: RateLimitRule,
  userId?: string,
): Promise<RateLimitResult> {
  const windowStart = new Date(Date.now() - rule.windowMs).toISOString();

  // Count existing requests in window
  const { count, error: countError } = await supabaseAdmin
    .from("rate_limits")
    .select("id", { count: "exact", head: true })
    .eq("ip_address", key) // reusing ip_address column as the generic key
    .eq("endpoint", endpoint)
    .gte("created_at", windowStart);

  if (countError) {
    // On DB error, fail open but log
    console.error("[db-rate-limiter] Count query failed:", countError.message);
    return { allowed: true, remaining: rule.maxRequests, count: 0 };
  }

  const currentCount = count ?? 0;

  if (currentCount >= rule.maxRequests) {
    return { allowed: false, remaining: 0, count: currentCount };
  }

  // Record this request
  const { error: insertError } = await supabaseAdmin
    .from("rate_limits")
    .insert({
      ip_address: key,
      endpoint,
      user_id: userId ?? null,
    });

  if (insertError) {
    console.error("[db-rate-limiter] Insert failed:", insertError.message);
  }

  const newCount = currentCount + 1;
  return {
    allowed: true,
    remaining: Math.max(0, rule.maxRequests - newCount),
    count: newCount,
  };
}
