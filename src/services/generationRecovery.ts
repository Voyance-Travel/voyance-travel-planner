import { differenceInDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { parseLocalDate } from '@/utils/dateUtils';
import { safeUpdateItineraryData } from '@/services/safeUpdateItineraryData';

export type GenerationRecoveryStatus = 'ready' | 'in_progress' | 'partial' | 'missing';

export interface GenerationRecoveryResult {
  status: GenerationRecoveryStatus;
  days: any[];
  expectedTotalDays: number;
  realDayCount: number;
  tableDayCount: number;
  persisted: boolean;
}

const RITUAL_RE = /^(return to|travel to|walk to|taxi to|metro to|bus to|train to|drive to|check[- ]?in|check[- ]?out|luggage drop|freshen up|head to)\b/i;

function dateSpanDays(start?: string | null, end?: string | null): number {
  if (!start || !end) return 0;
  try {
    return differenceInDays(parseLocalDate(end), parseLocalDate(start)) + 1;
  } catch {
    return 0;
  }
}

function dedupeRows(rows: any[]): any[] {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const r of rows) {
    const cat = String(r?.category || '').toLowerCase();
    const title = String(r?.title || r?.name || '').toLowerCase().trim();
    const key = RITUAL_RE.test(title)
      ? `ritual|${cat}|${title}`
      : `${r?.start_time || ''}|${r?.end_time || ''}|${cat}|${title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

function rowToActivity(r: any): any {
  const title = r?.title || r?.name || 'Activity';
  const startTime = r?.start_time || undefined;
  return {
    id: r?.external_id || r?.id || `${r?.itinerary_day_id || 'day'}-${r?.sort_order || 0}`,
    title,
    name: title,
    description: r?.description || '',
    category: r?.category || undefined,
    startTime,
    endTime: r?.end_time || undefined,
    time: startTime,
    durationMinutes: r?.duration_minutes ?? undefined,
    location: r?.location || undefined,
    cost: r?.cost || undefined,
    estimatedCost: r?.cost || undefined,
    tags: Array.isArray(r?.tags) ? r.tags : [],
    photos: r?.photos || undefined,
    transportation: r?.transportation || undefined,
    isLocked: !!r?.is_locked,
    bookingRequired: !!r?.booking_required,
    tips: r?.tips || undefined,
    walkingDistance: r?.walking_distance || undefined,
    walkingTime: r?.walking_time || undefined,
    rating: r?.rating || undefined,
    website: r?.website || undefined,
    viatorProductCode: r?.viator_product_code || undefined,
    extra_data: r?.extra_data || undefined,
    suggested_for: r?.suggested_for || undefined,
  };
}

function hasRealActivities(day: any): boolean {
  return Array.isArray(day?.activities) && day.activities.length > 0 && day.status !== 'placeholder';
}

export async function recoverGenerationFromTables(
  tripId: string,
  options: { persist?: boolean; promoteReady?: boolean; reason?: string } = {},
): Promise<GenerationRecoveryResult> {
  const [tripRes, daysRes, activitiesRes] = await Promise.all([
    supabase
      .from('trips')
      .select('itinerary_status, itinerary_data, metadata, start_date, end_date')
      .eq('id', tripId)
      .maybeSingle(),
    supabase
      .from('itinerary_days')
      .select('id, day_number, date, title, theme, description, weather, activities')
      .eq('trip_id', tripId)
      .order('day_number'),
    supabase
      .from('itinerary_activities')
      .select('id, itinerary_day_id, sort_order, start_time, end_time, title, name, description, category, location, cost, tags, photos, transportation, duration_minutes, is_locked, booking_required, tips, walking_distance, walking_time, rating, website, viator_product_code, extra_data, external_id, suggested_for')
      .eq('trip_id', tripId)
      .order('sort_order'),
  ]);

  const trip = tripRes.data as any;
  const meta = (trip?.metadata as Record<string, any>) || {};
  const jsonDays = Array.isArray((trip?.itinerary_data as any)?.days) ? ((trip.itinerary_data as any).days as any[]) : [];
  const dayRows = Array.isArray(daysRes.data) ? (daysRes.data as any[]) : [];
  const activityRows = Array.isArray(activitiesRes.data) ? (activitiesRes.data as any[]) : [];
  const expectedTotalDays = Math.max(
    0,
    dateSpanDays(trip?.start_date, trip?.end_date),
    Number(meta.generation_total_days || 0),
    dayRows.length,
    jsonDays.length,
  );

  if (!trip || dayRows.length === 0) {
    return { status: 'missing', days: jsonDays, expectedTotalDays, realDayCount: 0, tableDayCount: 0, persisted: false };
  }

  const rowsByDayId = new Map<string, any[]>();
  for (const row of activityRows) {
    if (!row?.itinerary_day_id) continue;
    const rows = rowsByDayId.get(row.itinerary_day_id) || [];
    rows.push(row);
    rowsByDayId.set(row.itinerary_day_id, rows);
  }

  const jsonByDayNumber = new Map<number, any>();
  for (const day of jsonDays) {
    const n = Number(day?.dayNumber ?? day?.day_number ?? 0);
    if (n > 0) jsonByDayNumber.set(n, day);
  }

  const rebuiltDays = dayRows.map((row) => {
    const existing = jsonByDayNumber.get(Number(row.day_number));
    const perRowActivities = dedupeRows(rowsByDayId.get(row.id) || []).map(rowToActivity);
    const embeddedActivities = Array.isArray(row.activities) ? row.activities : [];
    const jsonActivities = Array.isArray(existing?.activities) ? existing.activities : [];
    const bestActivities = [perRowActivities, embeddedActivities, jsonActivities]
      .sort((a, b) => b.length - a.length)[0];
    return {
      ...(existing || {}),
      dayNumber: Number(row.day_number),
      date: existing?.date || row.date || '',
      title: existing?.title || row.title || `Day ${row.day_number}`,
      theme: existing?.theme || row.theme || row.title || `Day ${row.day_number}`,
      description: existing?.description || row.description || '',
      weather: existing?.weather || row.weather || undefined,
      activities: bestActivities,
    };
  });

  const realDayCount = rebuiltDays.filter(hasRealActivities).length;
  const complete = expectedTotalDays > 0 && rebuiltDays.length >= expectedTotalDays && realDayCount >= expectedTotalDays;
  const status: GenerationRecoveryStatus = complete ? 'ready' : (realDayCount > 0 ? 'partial' : 'in_progress');
  let persisted = false;

  if (options.persist && rebuiltDays.length > 0) {
    const healedItinerary = { ...((trip?.itinerary_data as any) || {}), days: rebuiltDays };
    await safeUpdateItineraryData(tripId, healedItinerary, {}, {
      skipLedgerCheck: true,
      allowFrozenWrite: true,
      reason: options.reason || 'self-heal-generation-recovery',
    });
    persisted = true;
  }

  if (complete && options.promoteReady) {
    const promotedMeta = {
      ...meta,
      failed_day_numbers: [],
      generation_completed_days: expectedTotalDays,
      generation_total_days: expectedTotalDays,
      fully_persisted: true,
      fully_persisted_at: new Date().toISOString(),
      recovered_from_tables_at: new Date().toISOString(),
    };
    delete promotedMeta.generation_error;
    delete promotedMeta.chain_error;
    delete promotedMeta.chain_broken_at_day;
    await supabase
      .from('trips')
      .update({ itinerary_status: 'ready' as any, metadata: promotedMeta as any, updated_at: new Date().toISOString() })
      .eq('id', tripId);
  }

  return { status, days: rebuiltDays, expectedTotalDays, realDayCount, tableDayCount: dayRows.length, persisted };
}

export async function hasCompleteGenerationTables(tripId: string, expectedTotalDays: number): Promise<boolean> {
  if (!tripId || expectedTotalDays <= 0) return false;
  const result = await recoverGenerationFromTables(tripId, { persist: false, promoteReady: false });
  return result.status === 'ready' && result.realDayCount >= expectedTotalDays;
}