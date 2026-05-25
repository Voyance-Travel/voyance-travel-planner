/**
 * useReadTimeAudit — fire-and-forget invocation of the read-time timing
 * auditor. Runs once per trip when the persisted audit timestamp is
 * older than the trip's `updated_at` (or absent). Never mutates the
 * itinerary, never charges credits. Result is read from
 * `metadata.quality.read_time_audit` by dashboard surfaces.
 */
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Args {
  tripId: string | null | undefined;
  updatedAt?: string | null;
  /** Persisted audit timestamp at the time of mount. */
  lastAuditAt?: string | null;
  /** Pass false while the itinerary is still mid-generation. */
  enabled?: boolean;
}

export function useReadTimeAudit({ tripId, updatedAt, lastAuditAt, enabled = true }: Args) {
  const firedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!enabled || !tripId) return;
    if (firedRef.current === tripId) return;

    const stale = !lastAuditAt
      || (updatedAt && new Date(updatedAt).getTime() > new Date(lastAuditAt).getTime());
    if (!stale) return;

    firedRef.current = tripId;
    (async () => {
      try {
        await supabase.functions.invoke("audit-trip-timing", {
          body: { tripId },
        });
      } catch (err) {
        // Best-effort observability — never warn loudly on transient failures.
        console.warn("[useReadTimeAudit] invoke failed:", (err as Error)?.message);
      }
    })();
  }, [tripId, updatedAt, lastAuditAt, enabled]);
}
