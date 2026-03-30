/**
 * Context Audit — Preflight validator for generation pipeline.
 *
 * Inspects all required and optional data paths BEFORE the day chain starts.
 * Outputs a structured completeness report that is:
 *   1. Logged to console for immediate visibility
 *   2. Stored in trips.metadata.context_audit for post-mortem debugging
 *
 * Required fields cause a hard diagnostic warning (not a stop — the pool
 * generation step can still produce them). Optional fields log info-level.
 */

export interface ContextAuditField {
  field: string;
  present: boolean;
  source: string;
  /** Number of items if array/object, or 1/0 for scalar */
  count: number;
  severity: 'required' | 'recommended' | 'optional';
  notes?: string;
}

export interface ContextAuditResult {
  timestamp: string;
  tripId: string;
  totalFields: number;
  presentCount: number;
  missingRequiredCount: number;
  missingRecommendedCount: number;
  fields: ContextAuditField[];
  /** Summary for quick log scanning */
  summary: string;
}

/**
 * Run the preflight context audit against the trip record + related data.
 */
export async function runContextAudit(
  supabase: any,
  tripId: string,
  userId: string,
  params: {
    destination: string;
    isMultiCity: boolean;
    totalDays: number;
    budgetTier?: string;
    /** Already-computed restaurant pool (may have just been generated) */
    restaurantPool?: Record<string, any[]>;
  },
): Promise<ContextAuditResult> {
  const fields: ContextAuditField[] = [];

  // ── 1. Fetch trip record ──
  const { data: trip } = await supabase
    .from('trips')
    .select('flight_selection, hotel_selection, metadata, is_multi_city, flight_intelligence, blended_dna_snapshot')
    .eq('id', tripId)
    .single();

  const meta = (trip?.metadata as Record<string, unknown>) || {};

  // ── 2. Restaurant pool ──
  const pool = params.restaurantPool || (meta.restaurant_pool as Record<string, any[]>) || {};
  const poolCount = Object.values(pool).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
  fields.push({
    field: 'restaurant_pool',
    present: poolCount > 0,
    source: 'metadata.restaurant_pool',
    count: poolCount,
    severity: 'required',
    notes: poolCount > 0
      ? `${poolCount} venues across ${Object.keys(pool).length} city/cities`
      : 'EMPTY — meal guard will fall through to generic fallbacks',
  });

  // ── 3. Flight selection ──
  const flightSel = trip?.flight_selection;
  const hasFlightSel = !!flightSel && Object.keys(flightSel).length > 0;
  fields.push({
    field: 'flight_selection',
    present: hasFlightSel,
    source: 'trips.flight_selection',
    count: hasFlightSel ? 1 : 0,
    severity: 'recommended',
    notes: hasFlightSel ? undefined : 'No flight data — arrival/departure constraints will be weak',
  });

  // ── 4. Flight intelligence ──
  const flightIntel = trip?.flight_intelligence;
  fields.push({
    field: 'flight_intelligence',
    present: !!flightIntel,
    source: 'trips.flight_intelligence',
    count: flightIntel ? 1 : 0,
    severity: 'optional',
  });

  // ── 5. Hotel selection ──
  const hotelSel = trip?.hotel_selection;
  const hasHotel = !!hotelSel && (Array.isArray(hotelSel) ? hotelSel.length > 0 : Object.keys(hotelSel).length > 0);
  fields.push({
    field: 'hotel_selection',
    present: hasHotel,
    source: 'trips.hotel_selection',
    count: hasHotel ? (Array.isArray(hotelSel) ? hotelSel.length : 1) : 0,
    severity: 'recommended',
    notes: hasHotel ? undefined : 'No hotel — check-in/out cards will be absent',
  });

  // ── 6. Per-city hotels (multi-city) ──
  if (params.isMultiCity) {
    const { data: tripCities } = await supabase
      .from('trip_cities')
      .select('city_name, hotel_selection')
      .eq('trip_id', tripId)
      .order('city_order', { ascending: true });

    const citiesWithHotel = (tripCities || []).filter((c: any) => {
      const hs = c.hotel_selection;
      if (!hs) return false;
      if (Array.isArray(hs)) return hs.length > 0 && hs[0]?.name;
      return hs.name;
    });

    fields.push({
      field: 'city_hotel_coverage',
      present: citiesWithHotel.length > 0,
      source: 'trip_cities.hotel_selection',
      count: citiesWithHotel.length,
      severity: 'recommended',
      notes: `${citiesWithHotel.length}/${(tripCities || []).length} cities have hotel data`,
    });
  }

  // ── 7. Travel DNA ──
  const { data: dnaProfile } = await supabase
    .from('travel_dna_profiles')
    .select('primary_archetype_name, trait_scores')
    .eq('user_id', userId)
    .maybeSingle();

  fields.push({
    field: 'travel_dna',
    present: !!dnaProfile?.primary_archetype_name,
    source: 'travel_dna_profiles',
    count: dnaProfile ? 1 : 0,
    severity: 'recommended',
    notes: dnaProfile?.primary_archetype_name
      ? `archetype: ${dnaProfile.primary_archetype_name}`
      : 'No DNA profile — will use default archetype',
  });

  // ── 8. Must-do activities ──
  const mustDos = meta.mustDoActivities;
  const hasMustDos = Array.isArray(mustDos) ? mustDos.length > 0 : !!mustDos;
  fields.push({
    field: 'must_do_activities',
    present: hasMustDos,
    source: 'metadata.mustDoActivities',
    count: Array.isArray(mustDos) ? mustDos.length : (mustDos ? 1 : 0),
    severity: 'optional',
  });

  // ── 9. Must-haves ──
  const mustHaves = meta.mustHaves as any[] | undefined;
  fields.push({
    field: 'must_haves',
    present: Array.isArray(mustHaves) && mustHaves.length > 0,
    source: 'metadata.mustHaves',
    count: Array.isArray(mustHaves) ? mustHaves.length : 0,
    severity: 'optional',
  });

  // ── 10. User constraints ──
  const constraints = meta.userConstraints as any[] | undefined;
  fields.push({
    field: 'user_constraints',
    present: Array.isArray(constraints) && constraints.length > 0,
    source: 'metadata.userConstraints',
    count: Array.isArray(constraints) ? constraints.length : 0,
    severity: 'optional',
  });

  // ── 11. Pre-booked commitments ──
  const prebooked = meta.preBookedCommitments as any[] | undefined;
  fields.push({
    field: 'pre_booked_commitments',
    present: Array.isArray(prebooked) && prebooked.length > 0,
    source: 'metadata.preBookedCommitments',
    count: Array.isArray(prebooked) ? prebooked.length : 0,
    severity: 'optional',
  });

  // ── 12. Generation context (enrichment) ──
  const genCtx = meta.generation_context as Record<string, unknown> | undefined;
  fields.push({
    field: 'generation_context',
    present: !!genCtx && Object.keys(genCtx).length > 0,
    source: 'metadata.generation_context',
    count: genCtx ? Object.keys(genCtx).length : 0,
    severity: 'recommended',
    notes: genCtx ? `${Object.keys(genCtx).length} enrichment fields` : 'No enrichment context',
  });

  // ── 13. Group blending ──
  const hasBlend = !!trip?.blended_dna_snapshot || !!(genCtx?.blendedDnaSnapshot);
  fields.push({
    field: 'group_blending',
    present: hasBlend,
    source: 'trips.blended_dna_snapshot / generation_context',
    count: hasBlend ? 1 : 0,
    severity: 'optional',
  });

  // ── 14. First-time per city ──
  const firstTimePerCity = meta.firstTimePerCity;
  fields.push({
    field: 'first_time_per_city',
    present: !!firstTimePerCity,
    source: 'metadata.firstTimePerCity',
    count: firstTimePerCity ? Object.keys(firstTimePerCity as object).length : 0,
    severity: 'optional',
  });

  // ── 15. Flight details (chat planner) ──
  const flightDetails = meta.flightDetails;
  fields.push({
    field: 'flight_details_chat',
    present: !!flightDetails,
    source: 'metadata.flightDetails',
    count: flightDetails ? 1 : 0,
    severity: 'optional',
    notes: flightDetails ? 'Chat-planner flight details present' : undefined,
  });

  // ── Compute summary ──
  const presentCount = fields.filter(f => f.present).length;
  const missingRequired = fields.filter(f => !f.present && f.severity === 'required');
  const missingRecommended = fields.filter(f => !f.present && f.severity === 'recommended');

  const summaryParts: string[] = [
    `${presentCount}/${fields.length} fields present`,
  ];
  if (missingRequired.length > 0) {
    summaryParts.push(`⚠️ ${missingRequired.length} REQUIRED missing: [${missingRequired.map(f => f.field).join(', ')}]`);
  }
  if (missingRecommended.length > 0) {
    summaryParts.push(`${missingRecommended.length} recommended missing: [${missingRecommended.map(f => f.field).join(', ')}]`);
  }

  const result: ContextAuditResult = {
    timestamp: new Date().toISOString(),
    tripId,
    totalFields: fields.length,
    presentCount,
    missingRequiredCount: missingRequired.length,
    missingRecommendedCount: missingRecommended.length,
    fields,
    summary: summaryParts.join(' | '),
  };

  // ── Log ──
  console.log(`[CONTEXT AUDIT] Trip ${tripId}: ${result.summary}`);
  for (const f of fields) {
    const icon = f.present ? '✅' : (f.severity === 'required' ? '🚨' : f.severity === 'recommended' ? '⚠️' : '📝');
    console.log(`  ${icon} ${f.field}: ${f.present ? 'present' : 'MISSING'} (${f.source}, count=${f.count})${f.notes ? ` — ${f.notes}` : ''}`);
  }

  return result;
}
