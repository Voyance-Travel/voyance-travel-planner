import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Loader2, CheckCircle, MapPin, Clock, DollarSign, RefreshCw, Star, Image, Wallet, Lightbulb, LogIn, Coins, Cloud, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useItineraryGeneration, GeneratedDay, TripOverview } from '@/hooks/useItineraryGeneration';
import { useGenerationPoller } from '@/hooks/useGenerationPoller';
import { toast } from 'sonner';
import type { GenerationStep } from '@/hooks/useLovableItinerary';
import { useEntitlements } from '@/hooks/useEntitlements';
import { useOutOfCredits } from '@/contexts/OutOfCreditsContext';
import { PreferenceNudge, usePreferenceCompletion } from '@/components/common/PreferenceNudge';
import { GenerationPhases } from '@/components/planner/shared/GenerationPhases';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { format, differenceInCalendarDays } from 'date-fns';
import { parseLocalDate, safeFormatDate } from '@/utils/dateUtils';
import { sanitizeActivityName } from '@/utils/activityNameSanitizer';
import { formatTime12h } from '@/utils/timeFormat';
import { ROUTES } from '@/config/routes';
import { EditorialItinerary } from '@/components/itinerary/EditorialItinerary';
import type { EditorialDay } from '@/components/itinerary/EditorialItinerary';
import { parseEditorialDays } from '@/utils/itineraryParser';
import PersonalizedLoadingProgress from '@/components/planner/PersonalizedLoadingProgress';
import { Skeleton } from '@/components/ui/skeleton';
import { useGenerationGate, type GateResult } from '@/hooks/useGenerationGate';
import { generateFullPreview, type FullPreview, type PreviewDay } from '@/services/fullPreviewService';
import { convertPreviewToGeneratedDays, createLockedPlaceholderDays } from '@/utils/previewConverter';
import { calculateTripCredits, calculateMultiCityFee, roundUpTo10, BASE_RATE_PER_DAY } from '@/lib/tripCostCalculator';
import { useTripCities } from '@/hooks/useTripCities';
import { useCredits } from '@/hooks/useCredits';
import { formatCredits } from '@/config/pricing';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

/** Fire-and-forget refund with retries — works even if component unmounts */
async function issueRefund(
  tripId: string,
  creditsAmount: number,
  reason: string,
  errorMessage?: string,
) {
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { error } = await supabase.functions.invoke('spend-credits', {
        body: {
          action: 'REFUND',
          tripId,
          creditsAmount,
          metadata: { originalAction: 'trip_generation', reason, errorMessage },
        },
      });
      if (error) throw error;
      console.log(`[Refund] Success on attempt ${attempt}: +${creditsAmount} credits for ${reason}`);
      return true;
    } catch (err) {
      console.error(`[Refund] Attempt ${attempt}/${maxRetries} failed:`, err);
      if (attempt < maxRetries) await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
  console.error(`[Refund] All ${maxRetries} attempts failed for trip ${tripId}`);
  return false;
}

interface ItineraryGeneratorProps {
  tripId: string;
  destination: string;
  destinationCountry?: string;
  startDate: string;
  endDate: string;
  travelers: number;
  tripType?: string;
  budgetTier?: string;
  userId?: string;
  isMultiCity?: boolean;
  /** Auto-start generation immediately without showing confirmation */
  autoStart?: boolean;
  onComplete: (days: GeneratedDay[], overview?: TripOverview, isFirstTrip?: boolean) => void;
  onCancel?: () => void;
}

// Status messages for each generation stage
const STATUS_MESSAGES = {
  idle: 'Ready to generate',
  preparing: 'Analyzing your preferences...',
  generating: 'Crafting your perfect itinerary...',
  enriching: 'Adding photos and details...',
  complete: 'Your itinerary is ready!',
  error: 'Checking generation status...',
};

export function ItineraryGenerator({
  tripId,
  destination,
  destinationCountry,
  startDate,
  endDate,
  travelers,
  tripType,
  budgetTier,
  userId,
  isMultiCity,
  autoStart = false,
  onComplete,
  onCancel,
}: ItineraryGeneratorProps) {
  const {
    isGenerating,
    currentDay,
    totalDays,
    progress,
    days,
    overview,
    error,
    status,
    generateItinerary,
    startServerGeneration,
    reset,
    cancel,
  } = useItineraryGeneration();

  // Get entitlements
  const { data: entitlements, isPaid } = useEntitlements();

  // Out of credits modal
  const { showOutOfCredits } = useOutOfCredits();
  const queryClient = useQueryClient();

  // Get auth state
  const { user } = useAuth();
  const navigate = useNavigate();

  // Get preference completion status
  const { data: preferenceStatus } = usePreferenceCompletion();
  const showPreferenceNudge = preferenceStatus && 
    (preferenceStatus.personalizationLevel === 'none' || preferenceStatus.personalizationLevel === 'basic');

  // Fetch trip cities for multi-city progress display
  const { data: tripCitiesData } = useTripCities(isMultiCity ? tripId : undefined);

  const [hasStarted, setHasStarted] = useState(false);
  const [showNudgeCard, setShowNudgeCard] = useState(true);
  const [showGenericWarning, setShowGenericWarning] = useState(false);
  const [showCostConfirm, setShowCostConfirm] = useState(false);
  const [prePhase, setPrePhase] = useState<Extract<GenerationStep, 'gathering-dna' | 'personalizing' | 'preparing'> | null>(null);
  const [journeyLegs, setJourneyLegs] = useState<Array<{ city: string; days: number; cost: number }>>([]);
  const [journeyMultiCityFee, setJourneyMultiCityFee] = useState(0);

  const fetchCompletedDaysFromBackend = useCallback(async (): Promise<GeneratedDay[]> => {
    if (!tripId) return [];

    let expectedTotalDays = 0;

    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: tripData, error: fetchError } = await supabase
        .from('trips')
        .select('itinerary_data, metadata, start_date, end_date')
        .eq('id', tripId)
        .single();

      if (fetchError) {
        console.error('[ItineraryGenerator] Failed to fetch trip data:', fetchError);
        break;
      }

      const meta = (tripData?.metadata as Record<string, unknown>) || {};
      expectedTotalDays = (meta.generation_total_days as number) || 0;
      if (expectedTotalDays <= 0 && tripData?.start_date && tripData?.end_date) {
        expectedTotalDays = differenceInCalendarDays(
          parseLocalDate(tripData.end_date),
          parseLocalDate(tripData.start_date)
        ) + 1;
      }

      const itData = (tripData?.itinerary_data ?? {}) as Record<string, unknown>;
      const itineraryDays = Array.isArray(itData.days) ? (itData.days as GeneratedDay[]) : [];

      // Accept data if we have enough days OR if we have N-1 days with real activities
      // (backend sometimes generates one fewer day than the date range implies)
      const daysWithActivities = itineraryDays.filter(
        (d: any) => Array.isArray(d.activities) && d.activities.length > 0
      );
      if (
        itineraryDays.length > 0 &&
        expectedTotalDays > 0 &&
        (itineraryDays.length >= expectedTotalDays ||
          daysWithActivities.length >= expectedTotalDays - 1)
      ) {
        return itineraryDays;
      }

      if (attempt < 4) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    const { data: dayRows, error: daysError } = await supabase
      .from('itinerary_days')
      .select('day_number, date, title, theme, activities')
      .eq('trip_id', tripId)
      .order('day_number', { ascending: true });

    if (daysError || !dayRows?.length) {
      if (daysError) {
        console.error('[ItineraryGenerator] Failed to fetch fallback itinerary_days:', daysError);
      }
      return [];
    }

    const fallbackDays: GeneratedDay[] = dayRows.map((row: any) => {
      const rawActivities = Array.isArray(row.activities) ? row.activities : [];

      return {
        dayNumber: row.day_number,
        date: row.date || '',
        title: row.title || `Day ${row.day_number}`,
        theme: row.theme || row.title || '',
        activities: rawActivities.map((activity: any, idx: number) => {
          const locationValue = activity?.location;
          const normalizedLocation = typeof locationValue === 'string'
            ? locationValue
            : {
                name: locationValue?.name || '',
                address: locationValue?.address || '',
                coordinates: locationValue?.coordinates,
              };

          return {
            id: activity?.id || `day-${row.day_number}-activity-${idx + 1}`,
            title: activity?.title || activity?.name || 'Activity',
            name: activity?.name || activity?.title || 'Activity',
            description: activity?.description || '',
            category: activity?.category || activity?.type || 'activity',
            startTime: activity?.startTime || activity?.start_time || activity?.time || '',
            endTime: activity?.endTime || activity?.end_time || '',
            location: normalizedLocation,
            bookingRequired: Boolean(activity?.bookingRequired ?? activity?.booking_required ?? false),
          };
        }),
      } as GeneratedDay;
    });

    // Merge activities from itinerary_data JSON into empty fallback day shells
    // This handles the case where itinerary_days rows exist but activities failed to sync
    const { data: tripDataForMerge } = await supabase
      .from('trips')
      .select('itinerary_data')
      .eq('id', tripId)
      .single();

    if (tripDataForMerge?.itinerary_data) {
      const jsonDays = ((tripDataForMerge.itinerary_data as any).days || []) as any[];
      for (const fb of fallbackDays) {
        if (fb.activities.length === 0) {
          const match = jsonDays.find((jd: any) => jd.dayNumber === fb.dayNumber);
          if (match?.activities?.length > 0) {
            fb.activities = match.activities;
          }
        }
      }
    }

    // Don't reject fallback days when we have fewer than expected — show what we have
    return fallbackDays;
  }, [tripId]);

  // Server-side generation poller — start polling as soon as generation has started
  // (even during prePhase) so progress updates aren't missed and GenerationPhases
  // doesn't remount and lose simulated progress state
  const [serverGenActive, setServerGenActive] = useState(false);
  const pollerEnabled = serverGenActive || (hasStarted && !!prePhase);
  const poller = useGenerationPoller({
    tripId: pollerEnabled ? tripId : null,
    enabled: pollerEnabled,
    interval: 3000,
    onReady: async () => {
      console.log('[ItineraryGenerator] onReady fired — fetching completed itinerary');
      setPrePhase(null);
      try {
        const completedDays = await fetchCompletedDaysFromBackend();
        
        // Validate: don't finalize if all days are empty shells
        const daysWithActivities = completedDays.filter(
          (d: any) => Array.isArray(d.activities) && d.activities.length > 0
        ).length;
        
        if (completedDays.length > 0 && daysWithActivities === 0) {
          console.error('[ItineraryGenerator] onReady: All days are empty shells — treating as failed');
          setHasStarted(true);
          setPrePhase('preparing');
          setServerGenActive(true);
          setGenerationIssueSince(Date.now());
          return;
        }
        
        const gr = gateResultRef.current;
        toast.success('Your itinerary is ready!', { duration: 4000 });
        // Let the celebration screen show for 3 seconds before transitioning
        console.log('[ItineraryGenerator] Showing celebration for 3s before onComplete');
        await new Promise(r => setTimeout(r, 3000));
        console.log('[ItineraryGenerator] Calling onComplete with', completedDays.length, 'days');
        onComplete(completedDays, undefined, gr?.isFirstTrip);
      } catch (err) {
        console.error('[ItineraryGenerator] onReady error:', err);
        // Still try to transition — parent can reload from DB
        onComplete([], undefined, gateResultRef.current?.isFirstTrip);
      } finally {
        setServerGenActive(false);
      }
    },
    onFailed: async (err) => {
      setServerGenActive(false);
      setPrePhase('preparing');
      await suppressErrorAndRecover('poller.onFailed', err);
      if (userId) {
        queryClient.invalidateQueries({ queryKey: ['credits', userId] });
        queryClient.invalidateQueries({ queryKey: ['entitlements', userId] });
      }
    },
  });

  const autoStartTriggered = useRef(false);
  const gateResultRef = useRef<GateResult | null>(null);

  // Generation gate — pre-authorizes credits before generation
  const { authorize } = useGenerationGate();
  
  // Credit data for cost estimation
  const { data: creditData } = useCredits();
  const currentBalance = creditData?.totalCredits ?? 0;
  
  // Pre-calculate estimated cost for display
  const totalDaysEstimate = useMemo(() => {
    try {
      return differenceInCalendarDays(parseLocalDate(endDate), parseLocalDate(startDate)) + 1;
    } catch { return 1; }
  }, [startDate, endDate]);
  
  const tripCityNames = useMemo(() => {
    if (!isMultiCity) return [destination];
    if (tripCitiesData && tripCitiesData.length > 0) {
      return tripCitiesData.map(c => c.city_name).filter(Boolean) as string[];
    }
    return [destination]; // fallback
  }, [isMultiCity, tripCitiesData, destination]);

  const costEstimate = useMemo(() => {
    return calculateTripCredits({ days: totalDaysEstimate, cities: tripCityNames });
  }, [totalDaysEstimate, tripCityNames]);


  // Keep the pre-generation experience on screen until the first day is ready,
  // so we don't flash back to the generic spinner state.
  useEffect(() => {
    if (!prePhase) return;
    // Clear pre-phase when days arrive OR when an error/completion occurs
    if (days.length > 0 || status === 'error' || status === 'complete' || serverGenActive) {
      setPrePhase(null);
    }
  }, [prePhase, days.length, status, serverGenActive]);

  const isFirstTrip = entitlements?.is_first_trip ?? false;

  // State for partial generation
  const [partialDays, setPartialDays] = useState<number | null>(null);
  const [generationIssueSince, setGenerationIssueSince] = useState<number | null>(null);
  const [showRetryButton, setShowRetryButton] = useState(false);
  const recoveryInFlightRef = useRef(false);

  const recoverFromDatabase = useCallback(async () => {
    const [tripResult, dayResult] = await Promise.all([
      supabase
        .from('trips')
        .select('itinerary_status, itinerary_data, metadata, start_date, end_date')
        .eq('id', tripId)
        .maybeSingle(),
      supabase
        .from('itinerary_days')
        .select('id', { count: 'exact', head: true })
        .eq('trip_id', tripId),
    ]);

    const itineraryData = (tripResult.data?.itinerary_data as { days?: GeneratedDay[] } | null) ?? null;
    const existingDays = itineraryData?.days ?? [];
    const dayCount = dayResult.count ?? 0;
    const actualDays = Math.max(existingDays.length, dayCount);

    // Compute expected total days from metadata or date range
    const tripMeta = (tripResult.data?.metadata as Record<string, unknown>) || {};
    const metaTotalDays = (tripMeta.generation_total_days as number) || 0;
    let expectedTotalDays = metaTotalDays;
    if (expectedTotalDays <= 0 && tripResult.data?.start_date && tripResult.data?.end_date) {
      try {
        expectedTotalDays = differenceInCalendarDays(
          parseLocalDate(tripResult.data.end_date),
          parseLocalDate(tripResult.data.start_date)
        ) + 1;
      } catch { expectedTotalDays = 0; }
    }

    if (existingDays.length > 0) {
      // STRUCTURAL CHECK: Require at least one real activity per day
      // Shell days (theme/title only, no activities) should NOT be treated as complete
      const daysWithActivities = existingDays.filter(
        (d: any) => Array.isArray(d.activities) && d.activities.length > 0
      ).length;
      const isShellOnly = daysWithActivities === 0;

      if (isShellOnly) {
        console.warn(`[ItineraryGenerator] Shell-only itinerary detected: ${existingDays.length} days but 0 have activities. Treating as incomplete.`);
        setHasStarted(true);
        setPrePhase('preparing');
        setServerGenActive(true);
        setShowRetryButton(false);
        return 'in_progress' as const;
      }

      // Only treat as truly ready if ALL expected days are present AND have activities
      const isComplete = expectedTotalDays > 0
        ? (actualDays >= expectedTotalDays && daysWithActivities >= expectedTotalDays)
        : daysWithActivities > 0; // Fallback: at least some days have real content

      if (isComplete) {
        setGenerationIssueSince(null);
        setShowRetryButton(false);
        setPrePhase(null);
        setServerGenActive(false);
        setHasStarted(false);
        onComplete(existingDays, undefined, gateResultRef.current?.isFirstTrip);
        return 'ready' as const;
      }

      // Partial data exists — do NOT finalize. Keep polling/stalled state.
      console.log(`[ItineraryGenerator] Partial recovery: ${actualDays}/${expectedTotalDays} days. Staying in_progress.`);
      setHasStarted(true);
      setPrePhase('preparing');
      setServerGenActive(true);
      setShowRetryButton(false);
      return 'in_progress' as const;
    }

    const status = String(tripResult.data?.itinerary_status || '').toLowerCase();
    if (dayCount > 0 || status === 'generating' || status === 'queued' || status === 'ready' || status === 'generated') {
      setHasStarted(true);
      setPrePhase('preparing');
      setServerGenActive(true);
      setShowRetryButton(false);
      return 'in_progress' as const;
    }

    return 'missing' as const;
  }, [tripId, onComplete]);

  const suppressErrorAndRecover = useCallback(async (source: string, err?: unknown) => {
    console.warn(`[ItineraryGenerator] Suppressing generation error (${source})`, err);
    if (recoveryInFlightRef.current) return;
    recoveryInFlightRef.current = true;
    try {
      const result = await recoverFromDatabase();
      if (result !== 'ready') {
        setHasStarted(true);
        setPrePhase('preparing');
        setServerGenActive(result === 'in_progress');
        setGenerationIssueSince(prev => prev ?? Date.now());
      }
    } catch (recoveryErr) {
      console.warn('[ItineraryGenerator] Recovery check failed, continuing loading state:', recoveryErr);
      setHasStarted(true);
      setPrePhase('preparing');
      setServerGenActive(true);
      setGenerationIssueSince(prev => prev ?? Date.now());
    } finally {
      recoveryInFlightRef.current = false;
    }
  }, [recoverFromDatabase]);

  // Show retry CTA only if no itinerary exists for 5+ minutes after a suppressed failure
  useEffect(() => {
    if (!generationIssueSince) return;
    const timer = window.setInterval(async () => {
      const result = await recoverFromDatabase().catch(() => 'in_progress' as const);
      if (result === 'missing' && Date.now() - generationIssueSince >= 5 * 60 * 1000) {
        setShowRetryButton(true);
      }
    }, 15000);

    return () => clearInterval(timer);
  }, [generationIssueSince, recoverFromDatabase]);

  // Show cost confirmation before generating (for non-first-trip users)
  // Pre-fetches journey legs so the cost dialog shows the correct journey total
  const handleGenerateClick = async () => {
    // First trip is always free — skip cost confirmation
    if (isFirstTrip) {
      handleGenerate();
      return;
    }

    // Pre-fetch journey legs for cost display BEFORE showing dialog
    try {
      const { data: tripRow } = await supabase
        .from('trips')
        .select('journey_id, journey_order')
        .eq('id', tripId)
        .single();

      if (tripRow?.journey_id && tripRow.journey_order === 1) {
        const { data: allLegs } = await supabase
          .from('trips')
          .select('destination, start_date, end_date')
          .eq('journey_id', tripRow.journey_id)
          .neq('status', 'cancelled')
          .order('journey_order', { ascending: true });

        if (allLegs && allLegs.length > 1) {
          const allCityNames = allLegs.map(l => l.destination);
          const multiCityFee = calculateMultiCityFee(allCityNames.length);
          const breakdown = allLegs.map(leg => {
            const legDays = Math.max(1, Math.ceil(
              (new Date(leg.end_date).getTime() - new Date(leg.start_date).getTime()) / (1000 * 60 * 60 * 24)
            ) + 1);
            const legBaseCost = roundUpTo10(legDays * BASE_RATE_PER_DAY);
            return { city: leg.destination, days: legDays, cost: legBaseCost };
          });
          setJourneyMultiCityFee(multiCityFee);
          setJourneyLegs(breakdown);
        } else {
          setJourneyMultiCityFee(0);
          setJourneyLegs([]);
        }
      } else {
        setJourneyMultiCityFee(0);
        setJourneyLegs([]);
      }
    } catch {
      setJourneyMultiCityFee(0);
      setJourneyLegs([]);
    }

    // If cost > 0, show confirmation first
    if (costEstimate.totalCredits > 0) {
      setShowCostConfirm(true);
      return;
    }
    handleGenerate();
  };

  const handleConfirmGenerate = () => {
    setShowCostConfirm(false);
    setPartialDays(null); // Full generation
    handleGenerate();
  };

  const handleConfirmPartialGenerate = (days: number) => {
    setShowCostConfirm(false);
    setPartialDays(days);
    handleGenerate(days);
  };

  const handleGenerate = async (overrideDays?: number) => {
    setHasStarted(true);
    setShowGenericWarning(false);
    setShowCostConfirm(false);
    setGenerationIssueSince(null);
    setShowRetryButton(false);

    // Pre-generation phases (matches the newer streaming UX)
    setPrePhase('gathering-dna');
    await new Promise(resolve => setTimeout(resolve, 800));
    setPrePhase('personalizing');
    await new Promise(resolve => setTimeout(resolve, 800));

    // Calculate trip days for the gate
    const totalDays = differenceInCalendarDays(parseLocalDate(endDate), parseLocalDate(startDate)) + 1;
    const cities = tripCityNames; // Uses resolved city list (includes multi-city)

    // ── Fetch journey info if this is a journey leg ──
    let journeyId: string | undefined;
    let journeyTotalLegs: number | undefined;

    const { data: tripRow } = await supabase
      .from('trips')
      .select('journey_id, journey_order, journey_total_legs, metadata')
      .eq('id', tripId)
      .single();

    if (tripRow?.journey_id && tripRow.journey_order === 1) {
      // Only do journey costing on the FIRST leg
      journeyId = tripRow.journey_id;
      journeyTotalLegs = tripRow.journey_total_legs ?? undefined;
      // journeyLegs already populated by handleGenerateClick — no need to re-fetch
    }

    // PRE-AUTHORIZE: Check credits and deduct if affordable
    setPrePhase('preparing');
    let gateResult: GateResult;
    try {
      gateResult = await authorize({
        tripId,
        days: totalDays,
        cities,
        journeyId,
        journeyTotalLegs,
      });
    } catch (err: any) {
      // Distinguish credit errors from server/network errors
      const msg = err?.message || '';
      const isCreditError = msg.includes('INSUFFICIENT_CREDITS') || msg.includes('Not enough credits');

      if (isCreditError) {
        // Genuine insufficient credits — show locked state
        console.warn('[ItineraryGenerator] Insufficient credits:', msg);
        gateResult = {
          mode: 'locked',
          tripCost: totalDays * 60,
          creditsCharged: 0,
          currentBalance: 0,
          shortfall: totalDays * 60,
          recommendedPack: null,
          requestedDays: totalDays,
          generateDays: 0,
        };
      } else {
        // Server/network error — suppress hard errors and recover from DB state
        console.error('[ItineraryGenerator] Gate error (server/network):', err);
        cancel();
        await suppressErrorAndRecover('authorize', err);
        return;
      }
    }

    // ── PARTIAL MODE: user confirmed partial generation via overrideDays ──
    // The gate returned 'partial' but we need to actually spend credits now
    if (gateResult.mode === 'partial' && overrideDays && overrideDays > 0) {
      const costPerDay = Math.ceil(gateResult.tripCost / gateResult.requestedDays);
      const partialCost = overrideDays * costPerDay;
      
      try {
        const { data, error: spendErr } = await supabase.functions.invoke('spend-credits', {
          body: {
            action: 'trip_generation',
            tripId,
            creditsAmount: partialCost,
            metadata: {
              days: overrideDays,
              totalDays,
              mode: 'partial',
            },
          },
        });

        if (spendErr || data?.error) {
          console.error('[ItineraryGenerator] Partial spend failed:', spendErr || data?.error);
          cancel();
          setPrePhase(null);
          toast.error('Failed to process credits. Please try again.');
          return;
        }

        // Convert to full mode with the partial cost
        gateResult = {
          ...gateResult,
          mode: 'full',
          creditsCharged: data.spent ?? partialCost,
          currentBalance: data.newBalance?.total ?? (gateResult.currentBalance - partialCost),
          generateDays: overrideDays,
        };

        // Refresh credit balance
        if (userId) {
          queryClient.invalidateQueries({ queryKey: ['credits', userId] });
        }
      } catch (err) {
        console.error('[ItineraryGenerator] Partial spend error:', err);
        cancel();
        await suppressErrorAndRecover('partial_spend', err);
        return;
      }
    }

    console.log(`[ItineraryGenerator] Gate result: mode=${gateResult.mode}, cost=${gateResult.tripCost}, charged=${gateResult.creditsCharged}`);
    gateResultRef.current = gateResult;

    try {
      const totalRequestedDays = gateResult.requestedDays;
      const daysToGenerate = gateResult.generateDays;

      if (gateResult.mode === 'full') {
        // FULL GENERATION — credits already deducted (or first trip free)
        // For first trip: cap endDate to only generate `daysToGenerate` days
        let effectiveEndDate = endDate;
        if (daysToGenerate < totalRequestedDays) {
          // Inclusive end-date: endDate = startDate + (daysToGenerate - 1). Backend adds +1 to date diff.
          // Use local date parsing to avoid UTC timezone issues
          const [y, m, d] = startDate.split('-').map(Number);
          const cappedEnd = new Date(y, m - 1, d + daysToGenerate - 1);
          effectiveEndDate = `${cappedEnd.getFullYear()}-${String(cappedEnd.getMonth() + 1).padStart(2, '0')}-${String(cappedEnd.getDate()).padStart(2, '0')}`;
        }

        // Use server-side generation — fire and poll
        try {
        const tripMeta = (tripRow?.metadata as Record<string, unknown>) || {};
          await startServerGeneration({
            tripId,
            destination,
            destinationCountry,
            startDate,
            endDate: effectiveEndDate,
            travelers,
            tripType,
            budgetTier,
            userId,
            isMultiCity,
            creditsCharged: gateResult.creditsCharged,
            requestedDays: totalRequestedDays,
            isFirstTrip: gateResult.isFirstTrip ?? false,
            mustDoActivities: (tripMeta.mustDoActivities as string) || '',
            perDayActivities: (tripMeta.perDayActivities as any[]) || [],
          });
          // Server acknowledged — start polling for completion
          setServerGenActive(true);
          return; // Don't proceed — poller's onReady/onFailed handles the rest
        } catch (serverErr) {
          console.warn('[ItineraryGenerator] Server request interrupted (likely network disconnect):', serverErr);
          // DO NOT show an error screen or reset state.
          // The Edge Function may have already received the request and is generating.
          // Start polling to check if generation is actually in progress.
          setServerGenActive(true);
          return;
        }
      } else if (gateResult.mode === 'partial') {
        // PARTIAL — gate found user can afford some days but didn't confirm yet
        // This shouldn't normally be reached since partial triggers the confirmation dialog,
        // but handle gracefully: show the cost confirm dialog
        console.log(`[ItineraryGenerator] PARTIAL: user can afford ${daysToGenerate}/${totalRequestedDays} days. Showing confirmation.`);
        setPrePhase(null);
        setHasStarted(false);
        setShowCostConfirm(true);
      } else {
        // LOCKED — no credits, no AI, no API calls
        console.log(`[ItineraryGenerator] LOCKED: user has ${gateResult.currentBalance} credits, needs ${gateResult.tripCost}. No AI generation.`);
        
        // Create ALL days as locked placeholders (no AI call)
        const lockedDays = createLockedPlaceholderDays(startDate, 0, totalRequestedDays, destination, false);
        
        setPrePhase(null);

        // Show out of credits modal immediately
        showOutOfCredits({
          creditsNeeded: gateResult.tripCost,
          creditsAvailable: gateResult.currentBalance,
          tripId,
        });

        // Pass locked placeholders to onComplete so the trip structure exists
        onComplete(lockedDays, undefined, false);
      }
    } catch (err) {
      console.error('[ItineraryGenerator] Generation failed:', err);
      setPrePhase(null);

      // PARTIAL REFUND: Only refund credits for days that were NOT generated.
      // The progressive generator saves each day as it completes, so days.length
      // reflects real progress even when a later day fails.
      const gr = gateResultRef.current;
      if (gr && gr.creditsCharged > 0) {
        const daysCompleted = days.length;
        const totalTrip = gr.requestedDays || totalDaysEstimate;
        const creditsPerDay = Math.round(gr.creditsCharged / totalTrip);
        const ungenerated = Math.max(0, totalTrip - daysCompleted);
        const refundAmount = daysCompleted > 0 ? creditsPerDay * ungenerated : gr.creditsCharged;

        if (refundAmount > 0) {
          const errMsg = err instanceof Error ? err.message : 'Unknown error';
          console.log(`[ItineraryGenerator] Partial refund: ${daysCompleted}/${totalTrip} days done, refunding ${refundAmount} of ${gr.creditsCharged} credits`);
          const ok = await issueRefund(tripId, refundAmount, 'generation_failed_partial', `${daysCompleted}/${totalTrip} days completed. ${errMsg}`);
          if (ok) {
            toast.info(
              daysCompleted > 0
                ? 'Generation paused. Your progress has been saved.'
                : 'Generation failed. Your credits have been refunded.',
              { duration: 6000 }
            );
            if (userId) {
              queryClient.invalidateQueries({ queryKey: ['credits', userId] });
              queryClient.invalidateQueries({ queryKey: ['entitlements', userId] });
            }
          }
        }
      } else {
        // Suppress hard errors and keep loading while verifying DB state
      }
      await suppressErrorAndRecover('handle_generate', err);
    }
  };

  // Auto-start generation if prop is true and user has builds remaining AND is authenticated
  // BUT if user has no personalization, show warning first
  useEffect(() => {
    if (autoStart && !autoStartTriggered.current && user) {
      autoStartTriggered.current = true;
      
      // If user has no/basic personalization, show warning instead of auto-starting
      if (showPreferenceNudge) {
        setShowGenericWarning(true);
      } else {
        handleGenerateClick();
      }
    }
  }, [autoStart, user, showPreferenceNudge]); // eslint-disable-line react-hooks/exhaustive-deps

  // On mount / page revisit, check if generation is already in progress or complete
  useEffect(() => {
    if (!tripId) return;
    let cancelled = false;
    const checkStatus = async () => {
      try {
        const { data: tripRow } = await supabase
          .from('trips')
          .select('itinerary_status, itinerary_data')
          .eq('id', tripId)
          .single();
        if (cancelled) return;
        const st = tripRow?.itinerary_status as string;
        const itData = tripRow?.itinerary_data as { days?: unknown[] } | null;
        
        // Always recover from DB-first state (never call onComplete with empty days)
        await recoverFromDatabase();
      } catch (e) {
        console.warn('[ItineraryGenerator] Mount status check failed:', e);
      }
    };
    checkStatus();

    // Visibility/focus handlers: when user returns, re-check DB first (never show hard error)
    const handleVisibility = async () => {
      if (document.visibilityState === 'visible') {
        await recoverFromDatabase().catch(() => undefined);
      }
    };
    const handleFocus = async () => {
      await recoverFromDatabase().catch(() => undefined);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, [tripId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRetry = () => {
    reset();
    handleGenerate();
  };

  // Get activity name (supports both formats) and sanitize system prefixes
  const getActivityName = (activity: GeneratedDay['activities'][0]) => {
    const rawName = activity.title || (activity as { name?: string }).name || 'Activity';
    return sanitizeActivityName(rawName);
  };

  // Get activity cost
  const getActivityCost = (activity: GeneratedDay['activities'][0]) => {
    if (activity.cost?.amount !== undefined) {
      return activity.cost.amount;
    }
    if ((activity as { estimatedCost?: { amount: number } }).estimatedCost?.amount !== undefined) {
      return (activity as { estimatedCost: { amount: number } }).estimatedCost.amount;
    }
    return 0;
  };

  // Initial state - show generate button
  if (!hasStarted) {
    // Show sign-in prompt if not authenticated
    if (!user) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16"
        >
          <div className="max-w-md mx-auto">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-6">
              <LogIn className="h-10 w-10 text-primary" />
            </div>
            
            <h2 className="text-2xl font-serif font-bold mb-3">
              Sign In to Generate Your Itinerary
            </h2>
            
            <p className="text-muted-foreground mb-6">
              Create a free account to generate personalized itineraries tailored to your travel style.
              It's free and takes just seconds.
            </p>

            <div className="flex flex-col gap-3">
              <Button 
                size="lg" 
                onClick={() => navigate(`/signin?redirect=${encodeURIComponent(`/trip/${tripId}?generate=true`)}`)}
                className="gap-2"
              >
                <LogIn className="h-5 w-5" />
                Sign In to Continue
              </Button>
              
              {onCancel && (
                <Button variant="ghost" onClick={onCancel}>
                  Cancel
                </Button>
              )}
            </div>

            <p className="text-xs text-muted-foreground mt-6">
              Your first trip includes 2 free days. Get 150 credits every month.
            </p>
          </div>
        </motion.div>
      );
    }

    // Show generic itinerary warning for users without personalization
    if (showGenericWarning || (showPreferenceNudge && showNudgeCard)) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-12"
        >
          <div className="max-w-lg mx-auto">
            {/* Warning icon */}
            <div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="h-10 w-10 text-amber-600" />
            </div>
            
            <h2 className="text-2xl font-serif font-bold mb-3">
              Your Itinerary Won't Be Personalized
            </h2>
            
            <p className="text-muted-foreground mb-6">
              Without completing your Travel DNA quiz, we can only generate a <strong className="text-foreground">generic itinerary</strong>. 
              Take 5 minutes to tell us about your travel style and get recommendations that actually match <em>you</em>.
            </p>

            {/* What you're missing */}
            <div className="bg-muted/50 rounded-xl p-4 mb-6 text-left">
              <p className="text-sm font-medium text-foreground mb-3">With personalization, you'll get:</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Restaurants that match your dietary needs & cuisine preferences</span>
                </li>
                <li className="flex items-start gap-2">
                  <Clock className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>A pace that fits your energy level (not too rushed, not too slow)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Star className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Activities aligned with your interests and travel style</span>
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <Button 
                size="lg" 
                onClick={() => navigate(ROUTES.QUIZ)}
                className="gap-2"
              >
                <Sparkles className="h-5 w-5" />
                Take the Quiz (5 min)
              </Button>
              
              <Button 
                variant="ghost" 
                onClick={() => {
                  setShowGenericWarning(false);
                  setShowNudgeCard(false);
                  handleGenerateClick();
                }}
                className="text-muted-foreground"
              >
                Skip and generate generic itinerary
              </Button>
            </div>

            <p className="text-xs text-muted-foreground mt-6">
              You can always retake the quiz later from your profile
            </p>
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-16"
      >
        <div className="max-w-md mx-auto">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-6">
            <Sparkles className="h-10 w-10 text-primary" />
          </div>
          
          <h2 className="text-2xl font-serif font-bold mb-3">
            Create Your Personalized Itinerary
          </h2>
          
          <p className="text-muted-foreground mb-4">
            Our AI will craft a complete day-by-day itinerary tailored to your preferences for{' '}
            <span className="font-medium text-foreground">{destination}</span>.
          </p>

          <div className="flex flex-wrap gap-2 justify-center mb-6">
            <Badge variant="outline" className="gap-1">
              <MapPin className="h-3 w-3" />
              {destination}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              {totalDaysEstimate} days
            </Badge>
            <Badge variant="outline" className="gap-1">
              <DollarSign className="h-3 w-3" />
              {budgetTier || 'Standard'}
            </Badge>
          </div>

          {/* Preference completion nudge */}
          {showPreferenceNudge && showNudgeCard && (
            <div className="mb-6">
              <PreferenceNudge 
                variant="card"
                showProceedButton
                onProceedAnyway={() => setShowNudgeCard(false)}
                onDismiss={() => setShowNudgeCard(false)}
              />
            </div>
          )}

          
          {/* Cost Confirmation Dialog */}
          {showCostConfirm && costEstimate.totalCredits > 0 && (() => {
            // Use journey total if this is a journey, otherwise single-trip cost
            const effectiveTotalCost = journeyLegs.length > 1 
              ? journeyLegs.reduce((sum, leg) => sum + leg.cost, 0) + journeyMultiCityFee
              : costEstimate.totalCredits;
            const canAffordAll = currentBalance >= effectiveTotalCost;
            const costPerDay = 60; // CREDIT_COSTS standard
            const affordableDays = costPerDay > 0 ? Math.floor(currentBalance / costPerDay) : 0;
            const partialCost = affordableDays * costPerDay;
            // Disable partial generation for journeys — must pay full upfront
            const canAffordPartial = journeyLegs.length <= 1 && !canAffordAll && affordableDays >= 1;

            return (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-4 text-left"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Coins className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">
                    {journeyLegs.length > 1 ? 'Journey Cost Breakdown' : 'Cost Breakdown'}
                  </span>
                </div>
                <div className="space-y-1.5 text-sm">
                  {/* Journey breakdown - show each leg */}
                  {journeyLegs.length > 1 && (
                    <div className="space-y-1 mb-3">
                      {journeyLegs.map((leg, i) => (
                        <div key={i} className="flex justify-between text-muted-foreground">
                          <span>{leg.city} ({leg.days} days)</span>
                          <span>{formatCredits(leg.cost)} credits</span>
                        </div>
                      ))}
                      {journeyMultiCityFee > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>Multi-city fee</span>
                          <span>{formatCredits(journeyMultiCityFee)} credits</span>
                        </div>
                      )}
                      <div className="border-t border-border/50 pt-1" />
                    </div>
                  )}
                  {/* Single trip breakdown - only show if not a journey */}
                  {journeyLegs.length <= 1 && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{totalDaysEstimate} days × {costPerDay} cr/day</span>
                        <span className="text-foreground">{costEstimate.baseCredits} cr</span>
                      </div>
                      {costEstimate.multiCityFee > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Multi-city fee</span>
                          <span className="text-foreground">+{costEstimate.multiCityFee} cr</span>
                        </div>
                      )}
                      {costEstimate.complexity.multiplier > 1 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{costEstimate.complexity.tierLabel} complexity</span>
                          <span className="text-foreground">×{costEstimate.complexity.multiplier}</span>
                        </div>
                      )}
                    </>
                  )}
                  {/* Total and balance */}
                  <div className="border-t border-border pt-1.5 flex justify-between font-semibold">
                    <span className="text-foreground">{journeyLegs.length > 1 ? 'Journey Total' : 'Total'}</span>
                    <span className="text-primary">
                      {formatCredits(journeyLegs.length > 1 
                        ? journeyLegs.reduce((sum, leg) => sum + leg.cost, 0) + journeyMultiCityFee
                        : costEstimate.totalCredits
                      )} credits
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Your balance</span>
                    <span className={canAffordAll ? 'text-foreground' : 'text-destructive'}>
                      {formatCredits(currentBalance)} credits
                    </span>
                  </div>
                  {canAffordAll && (
                    <div className="text-xs text-muted-foreground">
                      After: {formatCredits(currentBalance - effectiveTotalCost)} credits remaining
                    </div>
                  )}
                  {canAffordPartial && (
                    <div className="mt-2 p-2.5 rounded-lg bg-accent/50 border border-accent text-xs text-foreground">
                      You have enough credits for <span className="font-semibold">{affordableDays} of {totalDaysEstimate} days</span>.
                      Generate those now and unlock the rest later.
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 mt-4">
                  {canAffordAll ? (
                    <Button size="sm" onClick={handleConfirmGenerate} className="w-full gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" />
                      {journeyLegs.length > 1 ? 'Confirm & Generate Journey' : 'Confirm & Generate'}
                    </Button>
                  ) : canAffordPartial ? (
                    <Button size="sm" onClick={() => handleConfirmPartialGenerate(affordableDays)} className="w-full gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" />
                      Generate {affordableDays} {affordableDays === 1 ? 'Day' : 'Days'} ({partialCost} cr)
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => {
                      setShowCostConfirm(false);
                      showOutOfCredits({
                        creditsNeeded: effectiveTotalCost,
                        creditsAvailable: currentBalance,
                        tripId,
                      });
                    }} className="w-full gap-1.5">
                      <Wallet className="h-3.5 w-3.5" />
                      Get Credits
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setShowCostConfirm(false)}>
                    Cancel
                  </Button>
                </div>
              </motion.div>
            );
          })()}

          {!showCostConfirm && (
            <div className="flex flex-col gap-3">
              <Button 
                size="lg" 
                onClick={handleGenerateClick} 
                className="gap-2"
              >
                <Sparkles className="h-5 w-5" />
                Generate Itinerary
                {isFirstTrip ? (
                  <span className="text-xs opacity-80">· Free</span>
                ) : costEstimate.totalCredits > 0 ? (
                  <span className="text-xs opacity-80">· {formatCredits(costEstimate.totalCredits)} cr</span>
                ) : null}
              </Button>
              
              {onCancel && (
                <Button variant="ghost" onClick={onCancel}>
                  Cancel
                </Button>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground mt-6">
            {isFirstTrip
              ? 'Your first trip is free! Includes activities, restaurants, transit & tips'
              : costEstimate.totalCredits > 0 
                ? `${formatCredits(costEstimate.totalCredits)} credits for ${totalDaysEstimate} days · Day unlocks charged separately`
                : 'Includes activities, restaurants, transportation, and local tips'
            }
          </p>
        </div>
      </motion.div>
    );
  }

  // Error state - check if it's an auth error
  if (error) {
    const isAuthError = error.toLowerCase().includes('unauthorized') || 
                        error.toLowerCase().includes('sign in') ||
                        error.toLowerCase().includes('authentication');

    if (isAuthError || !user) {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16"
        >
          <div className="max-w-md mx-auto">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-6">
              <LogIn className="h-10 w-10 text-primary" />
            </div>
            
            <h2 className="text-2xl font-serif font-bold mb-3">
              Create Your Free Account
            </h2>
            
            <p className="text-muted-foreground mb-2">
              Sign up in seconds to generate personalized itineraries tailored to your travel style.
            </p>
            
            <p className="text-sm text-muted-foreground mb-6">
              Your first itinerary build is <span className="font-medium text-foreground">completely free</span> - no credit card required.
            </p>

            <div className="flex flex-col gap-3">
              <Button 
                size="lg" 
                onClick={() => navigate(`/signup?redirect=${encodeURIComponent(`/trip/${tripId}?generate=true`)}`)}
                className="gap-2"
              >
                <Sparkles className="h-5 w-5" />
                Create Free Account
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => navigate(`/signin?redirect=${encodeURIComponent(`/trip/${tripId}?generate=true`)}`)}
                className="gap-2"
              >
                <LogIn className="h-5 w-5" />
                Already have an account? Sign In
              </Button>
            </div>

            <p className="text-xs text-muted-foreground mt-6">
              Join thousands of travelers planning smarter trips
            </p>
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-16"
      >
        <div className="max-w-md mx-auto space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <h2 className="text-xl font-semibold">Checking your itinerary status…</h2>
          <p className="text-muted-foreground">
            We’re reconnecting and verifying your generated days in the background.
          </p>

          {showRetryButton && (
            <Button onClick={handleRetry} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Generation didn't complete. Try again?
            </Button>
          )}
        </div>
      </motion.div>
    );
  }

  // Pre-generation phases OR server-side generation — unified render to prevent
  // GenerationPhases from remounting (which resets the simulated progress to 0%)
  if (prePhase || serverGenActive) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="py-10"
      >
        <GenerationPhases
          currentStep={prePhase || 'preparing'}
          destination={destination}
          totalDays={totalDaysEstimate}
          tripId={tripId}
          completedDays={poller.completedDays}
          generatedDaysList={poller.generatedDaysList}
          isComplete={poller.isReady}
          progress={poller.progress}
          currentCity={poller.currentCity}
          isMultiCity={isMultiCity}
          tripCities={tripCitiesData?.map(c => ({ city_name: c.city_name, generation_status: c.generation_status })) || []}
        />
        <div className="flex justify-center mt-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              reset();
              setPrePhase(null);
              setServerGenActive(false);
              setHasStarted(false);
              onCancel?.();
            }}
          >
            Cancel
          </Button>
        </div>
      </motion.div>
    );
  }

  // Generating state (frontend loop fallback — only reached if serverGenActive is false)
  return (
    <div className="py-8">
      {/* Progress Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4">
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : status === 'complete' ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          <span className="text-sm font-medium">
            {STATUS_MESSAGES[status] || STATUS_MESSAGES.generating}
          </span>
        </div>
        
        <h2 className="text-2xl font-serif font-bold mb-2">
          {status === 'complete' 
            ? `Your ${destination} Adventure` 
            : `Crafting Your ${destination} Adventure`
          }
        </h2>
        
        <div className="max-w-md mx-auto mt-4">
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-muted-foreground mt-2">
            {status === 'complete' 
              ? `${days.length} days of adventure ready` 
              : `${progress}% complete`
            }
          </p>
        </div>
      </motion.div>

      {/* Budget Overview (if available) */}
      {status === 'complete' && overview?.budgetBreakdown && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto mb-6"
        >
          <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Wallet className="h-4 w-4 text-primary" />
                <span className="font-medium">Estimated Trip Budget</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Activities</p>
                  <p className="font-semibold">${overview.budgetBreakdown.activities}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Food</p>
                  <p className="font-semibold">${overview.budgetBreakdown.food}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Transport</p>
                  <p className="font-semibold">${overview.budgetBreakdown.transportation}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total</p>
                  <p className="font-bold text-primary">${overview.budgetBreakdown.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Highlights (if available) */}
      {status === 'complete' && overview?.highlights && overview.highlights.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="max-w-2xl mx-auto mb-6"
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Star className="h-4 w-4 text-amber-500" />
                <span className="font-medium">Trip Highlights</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {overview.highlights.map((highlight, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {highlight}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Local Tips (if available) */}
      {status === 'complete' && overview?.localTips && overview.localTips.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="max-w-2xl mx-auto mb-6"
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="h-4 w-4 text-primary" />
                <span className="font-medium">Local Tips</span>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {overview.localTips.slice(0, 3).map((tip, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Generated Days Preview */}
      <AnimatePresence mode="popLayout">
        <div className="space-y-4 max-w-2xl mx-auto">
          {days.map((day, index) => (
            <motion.div
              key={day.dayNumber}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-card border border-border rounded-xl p-5 shadow-sm"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary" className="text-xs">
                      Day {day.dayNumber}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {safeFormatDate(day.date, 'EEEE, MMM d', `Day ${day.dayNumber}`)}
                    </span>
                    {day.metadata?.pacingLevel && (
                      <Badge variant="outline" className="text-xs capitalize">
                        {day.metadata.pacingLevel}
                      </Badge>
                    )}
                  </div>
                  <h3 className="font-semibold text-lg">{day.title || day.theme}</h3>
                </div>
                <div className="flex items-center gap-2">
                  {day.metadata?.totalEstimatedCost !== undefined && (
                    <span className="text-sm text-muted-foreground">
                      ~${day.metadata.totalEstimatedCost}
                    </span>
                  )}
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
              </div>

              <div className="space-y-3">
                {day.activities.slice(0, 4).map((activity, actIdx) => (
                  <div
                    key={activity.id || actIdx}
                    className="flex items-center gap-3 text-sm"
                  >
                    <span className="text-muted-foreground w-14 shrink-0 font-mono">
                      {formatTime12h(activity.startTime)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{getActivityName(activity)}</span>
                        {activity.photos && activity.photos.length > 0 && (
                          <Image className="h-3 w-3 text-muted-foreground" />
                        )}
                        {activity.verified?.isValid && (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        )}
                      </div>
                      {activity.category && (
                        <Badge variant="outline" className="text-xs mt-0.5 capitalize">
                          {activity.category}
                        </Badge>
                      )}
                    </div>
                    {getActivityCost(activity) > 0 && (
                      <span className="text-muted-foreground shrink-0">
                        ${getActivityCost(activity)}
                      </span>
                    )}
                  </div>
                ))}
                {day.activities.length > 4 && (
                  <p className="text-xs text-muted-foreground pl-14">
                    +{day.activities.length - 4} more activities
                  </p>
                )}
              </div>
            </motion.div>
          ))}

          {/* Placeholder for generating state */}
          {isGenerating && days.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-card border border-dashed border-primary/30 rounded-xl p-8"
            >
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground mb-1">
                    Creating your personalized itinerary...
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Analyzing {destination} attractions, dining, and experiences
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Progressive generation placeholder */}
          {isGenerating && days.length > 0 && currentDay > days.length && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-card border border-dashed border-primary/30 rounded-xl p-5"
            >
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-muted-foreground">
                  Generating Day {currentDay}...
                </span>
              </div>
            </motion.div>
          )}
        </div>
      </AnimatePresence>
    </div>
  );
}
