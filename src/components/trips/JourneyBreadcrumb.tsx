/**
 * JourneyBreadcrumb — Compact progress bar showing journey legs at the top of trip detail.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface JourneyLeg {
  id: string;
  destination: string;
  journeyOrder: number;
}

interface JourneyBreadcrumbProps {
  journeyId: string;
  journeyName: string | null;
  journeyOrder: number;
  journeyTotalLegs: number;
  currentTripId: string;
}

export function JourneyBreadcrumb({
  journeyId,
  journeyName,
  journeyOrder,
  journeyTotalLegs,
  currentTripId,
}: JourneyBreadcrumbProps) {
  const navigate = useNavigate();
  const [legs, setLegs] = useState<JourneyLeg[]>([]);

  useEffect(() => {
    async function fetchLegs() {
      const { data } = await supabase
        .from('trips')
        .select('id, destination, journey_order')
        .eq('journey_id', journeyId)
        .order('journey_order', { ascending: true });

      if (data) {
        setLegs(
          data.map((r) => ({
            id: r.id,
            destination: r.destination,
            journeyOrder: r.journey_order ?? 0,
          }))
        );
      }
    }
    fetchLegs();
  }, [journeyId]);

  const displayLegs = legs.length > 0 ? legs : Array.from({ length: journeyTotalLegs }, (_, i) => ({
    id: '',
    destination: '',
    journeyOrder: i + 1,
  }));

  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5 bg-muted/50 border-b border-border text-sm">
      {/* Journey name link */}
      <button
        onClick={() => navigate('/profile')}
        className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
      >
        <Globe className="h-3.5 w-3.5" />
        <span className="hidden sm:inline text-xs font-medium truncate max-w-[160px]">
          {journeyName || 'Journey'}
        </span>
      </button>

      <span className="text-muted-foreground/40">·</span>

      {/* Leg indicator text */}
      <span className="text-xs text-muted-foreground shrink-0">
        Leg {journeyOrder} of {journeyTotalLegs}
      </span>

      {/* Step dots */}
      <div className="flex items-center gap-1 ml-auto">
        {displayLegs.map((leg, i) => {
          const isCurrent = leg.journeyOrder === journeyOrder;
          const isClickable = leg.id && leg.id !== currentTripId;

          return (
            <button
              key={leg.id || i}
              disabled={!isClickable}
              onClick={() => isClickable && navigate(`/trip/${leg.id}`)}
              title={leg.destination || `Leg ${leg.journeyOrder}`}
              className={cn(
                'rounded-full transition-all',
                isCurrent
                  ? 'w-6 h-2 bg-primary'
                  : 'w-2 h-2 bg-border hover:bg-primary/40',
                isClickable && !isCurrent && 'cursor-pointer',
                !isClickable && !isCurrent && 'cursor-default'
              )}
            />
          );
        })}
      </div>
    </div>
  );
}
