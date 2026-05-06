/**
 * TravelIntelCard — Dynamic, date-specific destination intelligence
 * 
 * Shows timely, curated intel: events during trip dates, transport advice,
 * booking urgency, weather/packing, insider tips, spending guide,
 * local customs/etiquette, and neighborhood guide.
 * Completely distinct from Need to Know (which covers static basics like
 * visa, adapters, emergency numbers, language phrases).
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, Sparkles, CalendarDays, TrainFront, Wallet,
  Clock, CloudSun, Lightbulb, Ticket, MapPin, Loader2,
  AlertTriangle, ShoppingBag, Utensils, Ban, CheckCircle2,
  PiggyBank, EyeOff, GraduationCap, CreditCard, Brain,
  Thermometer, CloudRain, Check, X, Zap, Music, Palette,
  Trophy, Theater, Gift, Pin, Coins, HandCoins, RefreshCw,
  ThumbsUp, ThumbsDown, Building2, Coffee, Navigation,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeTravelIntel } from './travelIntel';

// ─── Types ──────────────────────────────────────────────────────────────────

interface TravelIntelEvent {
  name: string;
  dates: string;
  type: string;
  description: string;
  bookingTip?: string | null;
  isFree: boolean;
}

interface TravelIntelTransport {
  doNotDo: string;
  bestOption: string;
  moneyTip: string;
  localSecret: string;
  etiquetteTip: string;
}

interface TravelIntelMoney {
  paymentTip: string;
  currencyInfo?: string;
  tippingCustom?: string;
  mealCosts: { budget: string; midRange: string; fineDining: string };
  moneyTrap: string;
  savingHack: string;
}

interface BookingItem {
  name: string;
  reason?: string;
  note?: string;
}

interface TravelIntelWeather {
  summary: string;
  temperature: string;
  rainChance: string;
  packingList: string[];
  dontPack: string;
}

interface InsiderTip {
  tip: string;
  category: string;
}

interface CustomsItem {
  do: string;
  dont: string;
  context: string;
}

interface NeighborhoodGuide {
  stayingNear: string;
  vibe: string;
  walkingDistance: string[];
  localGem: string;
  avoidNearby?: string | null;
}

export interface TravelIntelData {
  eventsAndHappenings: TravelIntelEvent[];
  gettingAround: TravelIntelTransport;
  moneyAndSpending: TravelIntelMoney;
  bookNowVsWalkUp: { bookNow: BookingItem[]; walkUpFine: BookingItem[] };
  weatherAndPacking: TravelIntelWeather;
  localCustomsAndEtiquette?: CustomsItem[];
  neighborhoodGuide?: NeighborhoodGuide;
  insiderTips: InsiderTip[];
  archetypeAdvice?: string;
}

interface TravelIntelCardProps {
  city: string;
  country?: string;
  startDate: string;
  endDate: string;
  travelers?: number;
  archetype?: string;
  interests?: string[];
  hotelArea?: string;
  className?: string;
  defaultExpanded?: boolean;
  tripId?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const MONTH_NAMES: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * Best-effort check whether a freeform event date string overlaps with the trip window.
 * Returns true (keep event) when:
 *  - The string is recurring ("Every …", "Daily", "Weekends", etc.)
 *  - The string can't be parsed (safe default — don't hide what we can't validate)
 *  - The parsed dates overlap with [tripStart, tripEnd]
 */
function isEventInDateRange(eventDates: string, tripStart: string, tripEnd: string): boolean {
  if (!eventDates) return true;
  const lower = eventDates.toLowerCase().trim();

  // Recurring / ongoing → always keep
  if (/\b(every|daily|weekends?|weekdays?|ongoing|all\s+(month|year|season)|nightly)\b/i.test(lower)) {
    return true;
  }

  const tripStartDate = new Date(tripStart + 'T00:00:00');
  const tripEndDate = new Date(tripEnd + 'T23:59:59');
  if (isNaN(tripStartDate.getTime()) || isNaN(tripEndDate.getTime())) return true;

  // Try to extract month + day(s) from the string
  // Patterns: "March 15", "March 15-17", "March 15 - April 2", "15 March", "Jun 3 – Jun 10"
  const monthDayRangeRe = /([a-z]+)\s+(\d{1,2})\s*[-–—]\s*(?:([a-z]+)\s+)?(\d{1,2})/i;
  const singleDateRe = /([a-z]+)\s+(\d{1,2})/i;
  const dayMonthRe = /(\d{1,2})\s+([a-z]+)/i;

  // Helper: resolve month+day to a Date using the trip's year context
  const resolve = (monthStr: string, day: number): Date | null => {
    const m = MONTH_NAMES[monthStr.toLowerCase()];
    if (m === undefined) return null;
    // Use trip start year; if event month < trip start month, might be next year
    let year = tripStartDate.getFullYear();
    const d = new Date(year, m, day);
    // If date is way before trip start, try next year
    if (d.getTime() < tripStartDate.getTime() - 180 * 86400000) {
      return new Date(year + 1, m, day);
    }
    return d;
  };

  // Try range: "March 15-17" or "March 15 - April 2"
  const rangeMatch = eventDates.match(monthDayRangeRe);
  if (rangeMatch) {
    const startMonth = rangeMatch[1];
    const startDay = parseInt(rangeMatch[2], 10);
    const endMonth = rangeMatch[3] || startMonth;
    const endDay = parseInt(rangeMatch[4], 10);
    const evStart = resolve(startMonth, startDay);
    const evEnd = resolve(endMonth, endDay);
    if (evStart && evEnd) {
      // Check overlap: event range overlaps trip range
      return evStart <= tripEndDate && evEnd >= tripStartDate;
    }
  }

  // Try single date: "March 15"
  const singleMatch = eventDates.match(singleDateRe);
  if (singleMatch) {
    const evDate = resolve(singleMatch[1], parseInt(singleMatch[2], 10));
    if (evDate) {
      return evDate >= tripStartDate && evDate <= tripEndDate;
    }
  }

  // Try day-month order: "15 March"
  const dayMonthMatch = eventDates.match(dayMonthRe);
  if (dayMonthMatch) {
    const evDate = resolve(dayMonthMatch[2], parseInt(dayMonthMatch[1], 10));
    if (evDate) {
      return evDate >= tripStartDate && evDate <= tripEndDate;
    }
  }

  // Can't parse → keep (safe default)
  return true;
}

const eventTypeIcon: Record<string, React.ElementType> = {
  festival: Gift, exhibition: Palette, sports: Trophy, concert: Music,
  theatre: Theater, market: ShoppingBag, holiday: Sparkles, other: Pin,
};

const tipCategoryIcon: Record<string, typeof Lightbulb> = {
  money: Wallet, food: Utensils, culture: Sparkles, transport: TrainFront,
  timing: Clock, experience: MapPin,
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function TravelIntelCard({
  city,
  country,
  startDate,
  endDate,
  travelers,
  archetype,
  interests,
  hotelArea,
  className,
  defaultExpanded = false,
  tripId,
}: TravelIntelCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [intel, setIntel] = useState<TravelIntelData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fetchedRef = useRef(false);

  const fetchIntel = useCallback(async (forceRefresh = false) => {
    if (!city || !startDate || !endDate) return;

    if (forceRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('generate-travel-intel', {
        body: { destination: city, country, startDate, endDate, travelers, archetype, interests, hotelArea, tripId, forceRefresh },
      });

      if (fnError) throw fnError;

      if (data?.success && data?.data) {
        const cleaned = sanitizeTravelIntel(data.data);
        if (cleaned) {
          setIntel(cleaned);
          fetchedRef.current = true;
        } else {
          setError('Travel intelligence is temporarily unavailable.');
        }
      } else {
        setError(data?.error || 'Failed to load intel');
      }
    } catch (err) {
      console.error('Failed to fetch travel intel:', err);
      setError('Could not load travel intelligence');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [city, country, startDate, endDate, travelers, archetype, interests, hotelArea, tripId]);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchIntel(false);
  }, [fetchIntel]);

  // ── Loading / Error states ──
  if (isLoading) {
    return (
      <div className={cn('rounded-xl border border-border bg-card p-4', className)}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
          </div>
          <div>
            <span className="text-sm font-medium text-foreground">Travel Intel</span>
            <span className="text-xs text-muted-foreground ml-2">Loading intelligence for your dates…</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !intel) return null;

  return (
    <div className={cn('rounded-xl border border-border bg-card overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex-1 flex items-center gap-2.5 hover:opacity-80 transition-opacity"
        >
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div className="text-left">
            <span className="text-sm font-medium text-foreground">Travel Intel</span>
            <span className="text-xs text-muted-foreground ml-2">{city}</span>
          </div>
        </button>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              fetchIntel(true);
            }}
            disabled={isRefreshing}
            className="p-1.5 rounded-md hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50"
            title="Refresh Travel Intel"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isRefreshing && 'animate-spin')} />
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5"
          >
            <ChevronDown className={cn(
              'w-4 h-4 text-muted-foreground transition-transform duration-200',
              isExpanded && 'rotate-180',
            )} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-5 space-y-5 border-t border-border pt-4">

              {/* ── Archetype Advice ── */}
              {intel.archetypeAdvice && (
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                  <p className="text-xs text-foreground italic leading-relaxed">
                    <Lightbulb className="w-3 h-3 inline-block mr-1 -mt-0.5 text-primary" />{intel.archetypeAdvice}
                  </p>
                </div>
              )}

              {/* ── Events & Happenings ── */}
              {(() => {
                const filteredEvents = (intel.eventsAndHappenings || []).filter(
                  ev => isEventInDateRange(ev.dates, startDate, endDate)
                );
                return filteredEvents.length > 0 ? (
                <Section icon={CalendarDays} title="During Your Trip" iconColor="text-rose-500">
                  <div className="space-y-2.5">
                    {filteredEvents.map((ev, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        {(() => { const EvIcon = eventTypeIcon[ev.type] || Pin; return <EvIcon className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />; })()}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-medium text-foreground">{ev.name}</span>
                            {ev.isFree && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 text-green-600 border-green-600/30">Free</Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground">{ev.dates}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{ev.description}</p>
                          {ev.bookingTip && (
                            <p className="text-[11px] text-primary mt-0.5 font-medium flex items-center gap-1"><Zap className="w-3 h-3 shrink-0" />{ev.bookingTip}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
                ) : null;
              })()}

              {/* ── Getting Around ── */}
              {intel.gettingAround && (
                <Section icon={TrainFront} title="Getting Around" iconColor="text-blue-500">
                  <div className="space-y-2">
                    <TipLine icon={Ban} label={intel.gettingAround.doNotDo} highlight iconColor="text-destructive" />
                    <TipLine icon={CheckCircle2} label={intel.gettingAround.bestOption} iconColor="text-green-600" />
                    <TipLine icon={PiggyBank} label={intel.gettingAround.moneyTip} iconColor="text-emerald-500" />
                    <TipLine icon={EyeOff} label={intel.gettingAround.localSecret} iconColor="text-violet-500" />
                    <TipLine icon={GraduationCap} label={intel.gettingAround.etiquetteTip} iconColor="text-amber-600" />
                  </div>
                </Section>
              )}

              {/* ── Money & Spending (now includes currency + tipping) ── */}
              {intel.moneyAndSpending && (
                <Section icon={Wallet} title="Money & Spending" iconColor="text-emerald-500">
                  <div className="space-y-2">
                    {intel.moneyAndSpending.currencyInfo && (
                      <TipLine icon={Coins} label={intel.moneyAndSpending.currencyInfo} iconColor="text-amber-500" />
                    )}
                    <TipLine icon={CreditCard} label={intel.moneyAndSpending.paymentTip} iconColor="text-blue-500" />
                    {intel.moneyAndSpending.tippingCustom && (
                      <TipLine icon={HandCoins} label={intel.moneyAndSpending.tippingCustom} iconColor="text-emerald-600" />
                    )}
                    <div className="grid grid-cols-3 gap-2 py-1">
                      <MealCostPill label="Budget" cost={intel.moneyAndSpending.mealCosts.budget} />
                      <MealCostPill label="Mid-range" cost={intel.moneyAndSpending.mealCosts.midRange} />
                      <MealCostPill label="Fine dining" cost={intel.moneyAndSpending.mealCosts.fineDining} />
                    </div>
                    <TipLine icon={AlertTriangle} label={intel.moneyAndSpending.moneyTrap} highlight iconColor="text-amber-500" />
                    <TipLine icon={Brain} label={intel.moneyAndSpending.savingHack} iconColor="text-purple-500" />
                  </div>
                </Section>
              )}

              {/* ── Book Now vs Walk Up ── */}
              {intel.bookNowVsWalkUp && (
                <Section icon={Ticket} title="Book Now vs. Walk Up" iconColor="text-amber-500">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <p className="text-[11px] font-semibold text-foreground mb-1.5 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-red-500" /> Book Ahead
                      </p>
                      <div className="space-y-1.5">
                        {intel.bookNowVsWalkUp.bookNow?.map((item, i) => (
                          <div key={i} className="text-xs">
                            <span className="font-medium text-foreground">{item.name}</span>
                            {item.reason && <span className="text-muted-foreground"> - {item.reason}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-foreground mb-1.5 flex items-center gap-1">
                        <ShoppingBag className="w-3 h-3 text-green-500" /> Walk-Up Fine
                      </p>
                      <div className="space-y-1.5">
                        {intel.bookNowVsWalkUp.walkUpFine?.map((item, i) => (
                          <div key={i} className="text-xs">
                            <span className="font-medium text-foreground">{item.name}</span>
                            {item.note && <span className="text-muted-foreground"> - {item.note}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Section>
              )}

              {/* ── Weather & Packing ── */}
              {intel.weatherAndPacking && (
                <Section icon={CloudSun} title="Weather & Packing" iconColor="text-sky-500">
                  <div className="space-y-2">
                    <p className="text-xs text-foreground">{intel.weatherAndPacking.summary}</p>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      <Badge variant="outline" className="font-normal flex items-center gap-1"><Thermometer className="w-3 h-3" />{intel.weatherAndPacking.temperature}</Badge>
                      <Badge variant="outline" className="font-normal flex items-center gap-1"><CloudRain className="w-3 h-3" />{intel.weatherAndPacking.rainChance}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {intel.weatherAndPacking.packingList?.map((item, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px] font-normal flex items-center gap-0.5"><Check className="w-2.5 h-2.5 text-green-600" />{item}</Badge>
                      ))}
                    </div>
                    {intel.weatherAndPacking.dontPack && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        <X className="w-3 h-3 inline-block mr-0.5 -mt-0.5 text-destructive" />Leave at home: {intel.weatherAndPacking.dontPack}
                      </p>
                    )}
                  </div>
                </Section>
              )}

              {/* ── Local Customs & Etiquette ── */}
              {intel.localCustomsAndEtiquette && intel.localCustomsAndEtiquette.length > 0 && (
                <Section icon={GraduationCap} title="Local Customs & Etiquette" iconColor="text-violet-500">
                  <div className="space-y-2.5">
                    {intel.localCustomsAndEtiquette.map((item, i) => (
                      <div key={i} className="space-y-1 p-2.5 rounded-lg bg-secondary/30 border border-border/30">
                        <div className="flex items-start gap-2 text-xs">
                          <ThumbsUp className="w-3 h-3 text-green-600 shrink-0 mt-0.5" />
                          <span className="text-foreground font-medium">{item.do}</span>
                        </div>
                        <div className="flex items-start gap-2 text-xs">
                          <ThumbsDown className="w-3 h-3 text-destructive shrink-0 mt-0.5" />
                          <span className="text-muted-foreground">{item.dont}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground pl-5 italic">{item.context}</p>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* ── Neighborhood Guide ── */}
              {intel.neighborhoodGuide && (
                <Section icon={Building2} title={`Your Area: ${intel.neighborhoodGuide.stayingNear}`} iconColor="text-teal-500">
                  <div className="space-y-2">
                    <p className="text-xs text-foreground italic">{intel.neighborhoodGuide.vibe}</p>
                    
                    {intel.neighborhoodGuide.walkingDistance?.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                          <Navigation className="w-3 h-3" /> Walking distance
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {intel.neighborhoodGuide.walkingDistance.map((place, i) => (
                            <Badge key={i} variant="secondary" className="text-[10px] font-normal">{place}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {intel.neighborhoodGuide.localGem && (
                      <div className="flex items-start gap-2 text-xs mt-1">
                        <Coffee className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <span className="text-foreground"><span className="font-medium">Local gem:</span> {intel.neighborhoodGuide.localGem}</span>
                      </div>
                    )}

                    {intel.neighborhoodGuide.avoidNearby && (
                      <div className="flex items-start gap-2 text-xs mt-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">{intel.neighborhoodGuide.avoidNearby}</span>
                      </div>
                    )}
                  </div>
                </Section>
              )}

              {/* ── Insider Tips ── */}
              {intel.insiderTips?.length > 0 && (
                <Section icon={Lightbulb} title="Insider Tips" iconColor="text-amber-500">
                  <div className="space-y-2">
                    {intel.insiderTips.map((t, i) => {
                      const TipIcon = tipCategoryIcon[t.category] || Lightbulb;
                      return (
                        <div key={i} className="flex items-start gap-2">
                          <TipIcon className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                          <p className="text-xs text-foreground leading-relaxed">{t.tip}</p>
                        </div>
                      );
                    })}
                  </div>
                </Section>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function Section({ icon: Icon, title, iconColor, children }: {
  icon: React.ElementType;
  title: string;
  iconColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className={cn('w-4 h-4', iconColor)} />
        <span className="text-xs font-semibold text-foreground">{title}</span>
      </div>
      <div className="pl-6">{children}</div>
    </div>
  );
}

function TipLine({ icon: Icon, label, highlight, iconColor }: { icon: React.ElementType; label: string; highlight?: boolean; iconColor?: string }) {
  return (
    <div className={cn(
      'flex items-start gap-2 text-xs',
      highlight && 'font-medium text-foreground',
      !highlight && 'text-muted-foreground',
    )}>
      <Icon className={cn('w-3.5 h-3.5 shrink-0 mt-0.5', iconColor || 'text-muted-foreground')} />
      <span className="leading-relaxed">{label}</span>
    </div>
  );
}

function MealCostPill({ label, cost }: { label: string; cost: string }) {
  return (
    <div className="text-center p-1.5 rounded-md bg-muted/50">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-xs font-medium text-foreground">{cost}</p>
    </div>
  );
}

// Legacy exports for backward compat (other files may import these)
export function getTravelIntel(_country: string) { return null; }
export function getTravelIntelForCity(_city: string) { return null; }
