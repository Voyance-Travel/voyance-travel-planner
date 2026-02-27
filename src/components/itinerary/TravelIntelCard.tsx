/**
 * TravelIntelCard — Dynamic, date-specific destination intelligence
 * 
 * Shows timely, curated intel: events during trip dates, transport advice,
 * booking urgency, weather/packing, insider tips, spending guide.
 * Completely distinct from Need to Know (which covers static basics like
 * visa, adapters, emergency numbers, phrases).
 */
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, Sparkles, CalendarDays, TrainFront, Wallet,
  Clock, CloudSun, Lightbulb, Ticket, MapPin, Loader2,
  AlertTriangle, ShoppingBag, Utensils,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

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

export interface TravelIntelData {
  eventsAndHappenings: TravelIntelEvent[];
  gettingAround: TravelIntelTransport;
  moneyAndSpending: TravelIntelMoney;
  bookNowVsWalkUp: { bookNow: BookingItem[]; walkUpFine: BookingItem[] };
  weatherAndPacking: TravelIntelWeather;
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
  className?: string;
  defaultExpanded?: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const eventTypeIcon: Record<string, string> = {
  festival: '🎪', exhibition: '🎨', sports: '⚽', concert: '🎵',
  theatre: '🎭', market: '🛍️', holiday: '🎉', other: '📌',
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
  className,
  defaultExpanded = false,
}: TravelIntelCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [intel, setIntel] = useState<TravelIntelData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current || !city || !startDate || !endDate) return;

    const fetchIntel = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: fnError } = await supabase.functions.invoke('generate-travel-intel', {
          body: { destination: city, country, startDate, endDate, travelers, archetype, interests },
        });

        if (fnError) throw fnError;

        if (data?.success && data?.data) {
          setIntel(data.data);
          fetchedRef.current = true;
        } else {
          setError(data?.error || 'Failed to load intel');
        }
      } catch (err) {
        console.error('Failed to fetch travel intel:', err);
        setError('Could not load travel intelligence');
      } finally {
        setIsLoading(false);
      }
    };

    fetchIntel();
  }, [city, country, startDate, endDate, travelers, archetype, interests]);

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
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-accent/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div className="text-left">
            <span className="text-sm font-medium text-foreground">Travel Intel</span>
            <span className="text-xs text-muted-foreground ml-2">{city}</span>
          </div>
          <Badge variant="secondary" className="text-[10px] ml-1 px-1.5 py-0">
            Live
          </Badge>
        </div>
        <ChevronDown className={cn(
          'w-4 h-4 text-muted-foreground transition-transform duration-200',
          isExpanded && 'rotate-180',
        )} />
      </button>

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
                    💡 {intel.archetypeAdvice}
                  </p>
                </div>
              )}

              {/* ── Events & Happenings ── */}
              {intel.eventsAndHappenings?.length > 0 && (
                <Section icon={CalendarDays} title="During Your Trip" iconColor="text-rose-500">
                  <div className="space-y-2.5">
                    {intel.eventsAndHappenings.map((ev, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <span className="text-sm mt-0.5">{eventTypeIcon[ev.type] || '📌'}</span>
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
                            <p className="text-[11px] text-primary mt-0.5 font-medium">⚡ {ev.bookingTip}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* ── Getting Around ── */}
              {intel.gettingAround && (
                <Section icon={TrainFront} title="Getting Around" iconColor="text-blue-500">
                  <div className="space-y-2">
                    <TipLine icon="🚫" label={intel.gettingAround.doNotDo} highlight />
                    <TipLine icon="✅" label={intel.gettingAround.bestOption} />
                    <TipLine icon="💰" label={intel.gettingAround.moneyTip} />
                    <TipLine icon="🤫" label={intel.gettingAround.localSecret} />
                    <TipLine icon="🎩" label={intel.gettingAround.etiquetteTip} />
                  </div>
                </Section>
              )}

              {/* ── Money & Spending ── */}
              {intel.moneyAndSpending && (
                <Section icon={Wallet} title="Money & Spending" iconColor="text-emerald-500">
                  <div className="space-y-2">
                    <TipLine icon="💳" label={intel.moneyAndSpending.paymentTip} />
                    <div className="grid grid-cols-3 gap-2 py-1">
                      <MealCostPill label="Budget" cost={intel.moneyAndSpending.mealCosts.budget} />
                      <MealCostPill label="Mid-range" cost={intel.moneyAndSpending.mealCosts.midRange} />
                      <MealCostPill label="Fine dining" cost={intel.moneyAndSpending.mealCosts.fineDining} />
                    </div>
                    <TipLine icon="⚠️" label={intel.moneyAndSpending.moneyTrap} highlight />
                    <TipLine icon="🧠" label={intel.moneyAndSpending.savingHack} />
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
                            {item.reason && <span className="text-muted-foreground"> — {item.reason}</span>}
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
                            {item.note && <span className="text-muted-foreground"> — {item.note}</span>}
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
                      <Badge variant="outline" className="font-normal">🌡️ {intel.weatherAndPacking.temperature}</Badge>
                      <Badge variant="outline" className="font-normal">🌧️ {intel.weatherAndPacking.rainChance}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {intel.weatherAndPacking.packingList?.map((item, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px] font-normal">✓ {item}</Badge>
                      ))}
                    </div>
                    {intel.weatherAndPacking.dontPack && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        ❌ Leave at home: {intel.weatherAndPacking.dontPack}
                      </p>
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

function TipLine({ icon, label, highlight }: { icon: string; label: string; highlight?: boolean }) {
  return (
    <div className={cn(
      'flex items-start gap-2 text-xs',
      highlight && 'font-medium text-foreground',
      !highlight && 'text-muted-foreground',
    )}>
      <span className="shrink-0 mt-0.5">{icon}</span>
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
