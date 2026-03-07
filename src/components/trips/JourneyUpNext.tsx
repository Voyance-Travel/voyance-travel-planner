/**
 * JourneyUpNext — "Up Next" card at the bottom of the itinerary linking to the next journey leg.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plane, Train, Car, Ship, Bus, ArrowRight, ChevronRight, MapPin, Calendar, Globe, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface NextLeg {
  id: string;
  destination: string;
  startDate: string | null;
  endDate: string | null;
  journeyOrder: number;
  transitionMode: string | null;
}

interface JourneyUpNextProps {
  journeyId: string;
  journeyName: string | null;
  journeyOrder: number;
  journeyTotalLegs: number;
}

function getTransportIcon(mode: string | null) {
  switch (mode) {
    case 'flight': return Plane;
    case 'train': return Train;
    case 'drive':
    case 'car': return Car;
    case 'ferry': return Ship;
    case 'bus': return Bus;
    default: return ArrowRight;
  }
}

function getTransportEmoji(mode: string | null) {
  switch (mode) {
    case 'flight': return '✈️';
    case 'train': return '🚂';
    case 'drive':
    case 'car': return '🚗';
    case 'ferry': return '⛴️';
    case 'bus': return '🚌';
    default: return '→';
  }
}

function formatDateShort(dateStr: string | null): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function daysBetween(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)));
}

export function JourneyUpNext({ journeyId, journeyName, journeyOrder, journeyTotalLegs }: JourneyUpNextProps) {
  const navigate = useNavigate();
  const [nextLeg, setNextLeg] = useState<NextLeg | null>(null);
  const [loading, setLoading] = useState(true);
  const isLastLeg = journeyOrder >= journeyTotalLegs;

  useEffect(() => {
    async function fetchNextLeg() {
      if (isLastLeg) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('trips')
        .select('id, destination, start_date, end_date, journey_order, transition_mode')
        .eq('journey_id', journeyId)
        .eq('journey_order', journeyOrder + 1)
        .limit(1)
        .single();

      if (data) {
        setNextLeg({
          id: data.id,
          destination: data.destination,
          startDate: data.start_date,
          endDate: data.end_date,
          journeyOrder: data.journey_order ?? 0,
          transitionMode: data.transition_mode,
        });
      }
      setLoading(false);
    }
    fetchNextLeg();
  }, [journeyId, journeyOrder, isLastLeg]);

  if (loading) return null;

  // Last leg — journey complete card
  if (isLastLeg) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-8 mb-4"
      >
        <div className="rounded-xl border border-border bg-gradient-to-br from-primary/5 via-card to-accent/5 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-primary uppercase tracking-wider mb-1">Final Destination</p>
              <h4 className="font-serif text-lg font-semibold text-foreground">
                Journey complete
              </h4>
              {journeyName && (
                <p className="text-sm text-muted-foreground mt-1">
                  {journeyTotalLegs} cities · Your {journeyName} journey
                </p>
              )}
              <button
                onClick={() => navigate('/profile')}
                className="mt-3 text-sm text-primary hover:text-primary/80 font-medium inline-flex items-center gap-1 transition-colors"
              >
                View full journey in My Trips
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // Not last — show "Up Next" card
  if (!nextLeg) return null;

  const TransportIcon = getTransportIcon(nextLeg.transitionMode);
  const nights = nextLeg.startDate && nextLeg.endDate ? daysBetween(nextLeg.startDate, nextLeg.endDate) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-8 mb-4"
    >
      <button
        onClick={() => navigate(`/trip/${nextLeg.id}`)}
        className="w-full text-left rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-md transition-all p-5 sm:p-6 group"
      >
        <div className="flex items-start gap-3">
          {/* Transport icon */}
          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition-colors">
            <TransportIcon className="h-5 w-5 text-accent" />
          </div>

          <div className="min-w-0 flex-1">
            {/* Label */}
            <p className="text-xs font-medium text-accent uppercase tracking-wider mb-1">Up Next</p>

            {/* Transition info */}
            {nextLeg.transitionMode && (
              <p className="text-xs text-muted-foreground mb-1.5">
                {getTransportEmoji(nextLeg.transitionMode)}{' '}
                {nextLeg.transitionMode.charAt(0).toUpperCase() + nextLeg.transitionMode.slice(1)} to {nextLeg.destination}
              </p>
            )}

            {/* City name */}
            <h4 className="font-serif text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
              {nextLeg.destination}
            </h4>

            {/* Details */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs sm:text-sm text-muted-foreground">
              {nextLeg.startDate && nextLeg.endDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-primary/60" />
                  {formatDateShort(nextLeg.startDate)} – {formatDateShort(nextLeg.endDate)}
                </span>
              )}
              {nights > 0 && (
                <span>{nights} night{nights !== 1 ? 's' : ''}</span>
              )}
            </div>
          </div>

          {/* Arrow */}
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors mt-2 shrink-0" />
        </div>
      </button>
    </motion.div>
  );
}
