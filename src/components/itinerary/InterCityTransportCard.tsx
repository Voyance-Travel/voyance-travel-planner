/**
 * InterCityTransportCard — Prominent travel card for flights, trains, buses, ferries, etc.
 * Replaces the compact InterCityTransportStrip with a visually distinct, route-focused card.
 */

import { useState } from 'react';
import { Plane, Train, Bus, Ship, Car, ChevronDown, Clock, Ticket, Armchair } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatTime12h } from '@/utils/timeFormat';

export interface TravelMeta {
  from?: string;
  to?: string;
  transportName?: string;
  hubLabel?: string;
  carrier?: string;
  flightNum?: string;
  depTime?: string;
  arrTime?: string;
  dur?: string;
  seatInfo?: string;
  bookingRef?: string;
  price?: number;
  currency?: string;
}

interface InterCityTransportCardProps {
  title: string;
  travelMeta: TravelMeta;
  className?: string;
  /** Visual variant — 'final' adds a "Heading Home" header and elevated styling */
  variant?: 'default' | 'final';
}

const TRANSPORT_THEMES: Record<string, {
  bg: string;
  border: string;
  iconBg: string;
  iconColor: string;
  accentText: string;
  dotColor: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = {
  flight: {
    bg: 'bg-blue-500/[0.04]',
    border: 'border-l-blue-500',
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-600 dark:text-blue-400',
    accentText: 'text-blue-600 dark:text-blue-400',
    dotColor: 'bg-blue-500',
    Icon: Plane,
  },
  train: {
    bg: 'bg-emerald-500/[0.04]',
    border: 'border-l-emerald-500',
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    accentText: 'text-emerald-600 dark:text-emerald-400',
    dotColor: 'bg-emerald-500',
    Icon: Train,
  },
  bus: {
    bg: 'bg-amber-500/[0.04]',
    border: 'border-l-amber-500',
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-600 dark:text-amber-400',
    accentText: 'text-amber-600 dark:text-amber-400',
    dotColor: 'bg-amber-500',
    Icon: Bus,
  },
  ferry: {
    bg: 'bg-teal-500/[0.04]',
    border: 'border-l-teal-500',
    iconBg: 'bg-teal-500/10',
    iconColor: 'text-teal-600 dark:text-teal-400',
    accentText: 'text-teal-600 dark:text-teal-400',
    dotColor: 'bg-teal-500',
    Icon: Ship,
  },
  car: {
    bg: 'bg-slate-500/[0.04]',
    border: 'border-l-slate-500',
    iconBg: 'bg-slate-500/10',
    iconColor: 'text-slate-600 dark:text-slate-400',
    accentText: 'text-slate-600 dark:text-slate-400',
    dotColor: 'bg-slate-500',
    Icon: Car,
  },
};

function resolveTheme(transportName?: string) {
  const key = (transportName || '').toLowerCase();
  if (key.includes('flight') || key.includes('fly')) return TRANSPORT_THEMES.flight;
  if (key.includes('train') || key.includes('rail')) return TRANSPORT_THEMES.train;
  if (key.includes('bus') || key.includes('coach')) return TRANSPORT_THEMES.bus;
  if (key.includes('ferry') || key.includes('boat')) return TRANSPORT_THEMES.ferry;
  if (key.includes('car') || key.includes('drive')) return TRANSPORT_THEMES.car;
  return TRANSPORT_THEMES.train; // default
}

export function InterCityTransportCard({ title, travelMeta, className }: InterCityTransportCardProps) {
  const [expanded, setExpanded] = useState(false);
  const theme = resolveTheme(travelMeta.transportName);
  const { Icon } = theme;

  const hasExpandableDetails = travelMeta.seatInfo || travelMeta.bookingRef;
  const hasRoute = travelMeta.from && travelMeta.to;
  const carrierLine = [
    travelMeta.carrier,
    travelMeta.flightNum,
  ].filter(Boolean).join(' ');

  const formattedPrice = travelMeta.price != null && travelMeta.price > 0
    ? new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: travelMeta.currency || 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(travelMeta.price)
    : null;

  return (
    <div
      className={cn(
        'rounded-xl border border-border border-l-[3px] overflow-hidden transition-shadow',
        theme.bg,
        theme.border,
        hasExpandableDetails && 'cursor-pointer',
        className,
      )}
      onClick={hasExpandableDetails ? () => setExpanded(prev => !prev) : undefined}
    >
      <div className="px-4 py-3.5">
        {/* Header row: icon + title + price */}
        <div className="flex items-center gap-3 mb-2.5">
          <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', theme.iconBg)}>
            <Icon className={cn('h-4.5 w-4.5', theme.iconColor)} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn('text-xs font-bold uppercase tracking-wider', theme.accentText)}>
              {(travelMeta.transportName || 'Transfer').toUpperCase()}
            </p>
            <p className="text-sm font-semibold text-foreground truncate">{title}</p>
          </div>
          {formattedPrice && (
            <span className="text-sm font-semibold text-foreground tabular-nums shrink-0">
              {formattedPrice}
            </span>
          )}
        </div>

        {/* Route visualization */}
        {hasRoute && (
          <div className="flex items-center gap-2 mb-2.5 pl-1">
            <div className={cn('w-2 h-2 rounded-full shrink-0', theme.dotColor)} />
            <span className="text-xs font-medium text-foreground">{travelMeta.from}</span>
            <div className="flex-1 border-t border-dashed border-muted-foreground/30 mx-1" />
            <span className="text-xs font-medium text-foreground">{travelMeta.to}</span>
            <div className={cn('w-2 h-2 rounded-full shrink-0', theme.dotColor)} />
          </div>
        )}

        {/* Details row: carrier, times, duration */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {carrierLine && (
            <span className="font-medium">{carrierLine}</span>
          )}
          {travelMeta.depTime && (
            <span className="flex items-center gap-1 tabular-nums">
              <Clock className="h-3 w-3" />
              {formatTime12h(travelMeta.depTime)}
              {travelMeta.arrTime && (
                <> → {formatTime12h(travelMeta.arrTime)}</>
              )}
            </span>
          )}
          {travelMeta.dur && (
            <span>{travelMeta.dur}</span>
          )}
          {hasExpandableDetails && (
            <ChevronDown className={cn(
              'h-3.5 w-3.5 ml-auto text-muted-foreground/50 transition-transform duration-200',
              expanded && 'rotate-180',
            )} />
          )}
        </div>

        {/* No details placeholder */}
        {!travelMeta.depTime && !carrierLine && (
          <p className="text-xs text-muted-foreground/60 italic">Plan your transport details</p>
        )}

        {/* Expandable section */}
        {expanded && hasExpandableDetails && (
          <div className="flex items-center gap-4 mt-2.5 pt-2.5 border-t border-border/50 text-xs text-muted-foreground">
            {travelMeta.seatInfo && (
              <span className="flex items-center gap-1">
                <Armchair className="h-3 w-3" />
                {travelMeta.seatInfo}
              </span>
            )}
            {travelMeta.bookingRef && (
              <span className="flex items-center gap-1">
                <Ticket className="h-3 w-3" />
                Ref: {travelMeta.bookingRef}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
