/**
 * InterCityTransportCard — Matches the activity card 3-column layout.
 * Desktop: Time | Icon thumbnail | Content
 * Mobile: Compact tappable row inside card wrapper
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
  /** Visual variant — 'final' adds a "Heading Home" header with subtle primary accent */
  variant?: 'default' | 'final';
}

function resolveIcon(transportName?: string): React.ComponentType<{ className?: string }> {
  const key = (transportName || '').toLowerCase();
  if (key.includes('flight') || key.includes('fly')) return Plane;
  if (key.includes('train') || key.includes('rail')) return Train;
  if (key.includes('bus') || key.includes('coach')) return Bus;
  if (key.includes('ferry') || key.includes('boat')) return Ship;
  if (key.includes('car') || key.includes('drive')) return Car;
  return Train;
}

export function InterCityTransportCard({ title, travelMeta, className, variant = 'default' }: InterCityTransportCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const Icon = resolveIcon(travelMeta.transportName);

  const hasExpandableDetails = travelMeta.seatInfo || travelMeta.bookingRef;
  const hasRoute = travelMeta.from && travelMeta.to;
  const carrierLine = [travelMeta.carrier, travelMeta.flightNum].filter(Boolean).join(' ');
  const isFinal = variant === 'final';
  const depTimeFormatted = travelMeta.depTime ? formatTime12h(travelMeta.depTime) : null;
  const arrTimeFormatted = travelMeta.arrTime ? formatTime12h(travelMeta.arrTime) : null;
  const transportLabel = (travelMeta.transportName || 'Transfer').toUpperCase();

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
        'group/activity overflow-hidden transition-shadow',
        // Desktop: flat row like activity cards
        'sm:flex sm:items-stretch sm:rounded-none sm:border-0 sm:shadow-none sm:bg-transparent',
        // Mobile: card style
        'rounded-xl border border-border bg-card shadow-sm',
        isFinal && 'sm:border-l-[3px] sm:border-l-primary/40',
        className,
      )}
    >
      {/* ── Mobile compact row ── */}
      <button
        type="button"
        className="sm:hidden flex items-center gap-2.5 w-full px-3 py-3 text-left active:bg-secondary/30 transition-colors"
        onClick={() => setMobileExpanded(prev => !prev)}
      >
        <span className="text-xs font-semibold text-primary tabular-nums w-12 shrink-0">
          {depTimeFormatted || '—'}
        </span>
        <span className="p-1 rounded-md bg-primary/10 text-primary shrink-0">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="text-sm font-medium text-foreground truncate flex-1 min-w-0">{title}</span>
        {formattedPrice && (
          <span className="text-xs font-medium text-muted-foreground shrink-0">{formattedPrice}</span>
        )}
        <ChevronDown className={cn(
          "h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200",
          mobileExpanded && "rotate-180"
        )} />
      </button>

      {/* Mobile expanded detail */}
      {mobileExpanded && (
        <div className="sm:hidden px-3 pb-3 pt-2 space-y-2 border-t border-border/30 animate-in slide-in-from-top-1 duration-200">
          {isFinal && (
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary/50">Heading Home</p>
          )}
          {hasRoute && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-muted-foreground/50" />
              <span className="text-xs font-medium text-foreground">{travelMeta.from}</span>
              <div className="flex-1 border-t border-dashed border-muted-foreground/30" />
              <span className="text-xs font-medium text-foreground">{travelMeta.to}</span>
              <div className="w-2 h-2 rounded-full bg-muted-foreground/50" />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {carrierLine && <span className="font-medium">{carrierLine}</span>}
            {depTimeFormatted && (
              <span className="flex items-center gap-1 tabular-nums">
                <Clock className="h-3 w-3" />
                {depTimeFormatted}{arrTimeFormatted && <> → {arrTimeFormatted}</>}
              </span>
            )}
            {travelMeta.dur && <span>{travelMeta.dur}</span>}
          </div>
          {(travelMeta.seatInfo || travelMeta.bookingRef) && (
            <div className="flex items-center gap-4 pt-1 text-xs text-muted-foreground">
              {travelMeta.seatInfo && (
                <span className="flex items-center gap-1"><Armchair className="h-3 w-3" />{travelMeta.seatInfo}</span>
              )}
              {travelMeta.bookingRef && (
                <span className="flex items-center gap-1"><Ticket className="h-3 w-3" />Ref: {travelMeta.bookingRef}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Desktop: Time Column ── */}
      <div className="hidden sm:block w-24 shrink-0 p-4 border-r border-border bg-gradient-to-b from-secondary/20 to-secondary/5">
        <span className="text-sm font-medium text-foreground">{depTimeFormatted || '—'}</span>
        {arrTimeFormatted && (
          <p className="text-xs text-muted-foreground mt-0.5">→ {arrTimeFormatted}</p>
        )}
        {travelMeta.dur && (
          <p className="text-xs text-primary/70 mt-0.5 font-medium">{travelMeta.dur}</p>
        )}
      </div>

      {/* ── Desktop: Icon / Thumbnail Column ── */}
      <div className="hidden sm:flex w-24 h-24 shrink-0 border-r border-border bg-muted/30 items-center justify-center">
        <Icon className="h-8 w-8 text-muted-foreground/60" />
      </div>

      {/* ── Desktop: Content Column ── */}
      <div
        className={cn(
          "hidden sm:block flex-1 p-4 overflow-hidden",
          hasExpandableDetails && 'cursor-pointer',
        )}
        onClick={hasExpandableDetails ? () => setExpanded(prev => !prev) : undefined}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="p-1 rounded bg-primary/10 text-primary"><Icon className="h-3.5 w-3.5" /></span>
              <span className="text-xs text-primary/80 uppercase tracking-wider font-medium">
                {isFinal ? `Heading Home · ${transportLabel}` : transportLabel}
              </span>
            </div>
            <h4 className="text-sm font-semibold text-foreground">{title}</h4>
          </div>
          {formattedPrice && (
            <span className="text-sm font-semibold text-foreground tabular-nums shrink-0 ml-3">{formattedPrice}</span>
          )}
        </div>

        {/* Route visualization */}
        {hasRoute && (
          <div className="flex items-center gap-2 mt-2 pl-1">
            <div className="w-2 h-2 rounded-full shrink-0 bg-muted-foreground/50" />
            <span className="text-xs font-medium text-foreground">{travelMeta.from}</span>
            <div className="flex-1 border-t border-dashed border-muted-foreground/30 mx-1" />
            <span className="text-xs font-medium text-foreground">{travelMeta.to}</span>
            <div className="w-2 h-2 rounded-full shrink-0 bg-muted-foreground/50" />
          </div>
        )}

        {/* Details row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-2">
          {carrierLine && <span className="font-medium">{carrierLine}</span>}
          {!travelMeta.depTime && !carrierLine && (
            <p className="text-xs text-muted-foreground/60 italic">Plan your transport details</p>
          )}
          {hasExpandableDetails && (
            <ChevronDown className={cn(
              'h-3.5 w-3.5 ml-auto text-muted-foreground/50 transition-transform duration-200',
              expanded && 'rotate-180',
            )} />
          )}
        </div>

        {/* Expandable section */}
        {expanded && hasExpandableDetails && (
          <div className="flex items-center gap-4 mt-2.5 pt-2.5 border-t border-border/50 text-xs text-muted-foreground">
            {travelMeta.seatInfo && (
              <span className="flex items-center gap-1"><Armchair className="h-3 w-3" />{travelMeta.seatInfo}</span>
            )}
            {travelMeta.bookingRef && (
              <span className="flex items-center gap-1"><Ticket className="h-3 w-3" />Ref: {travelMeta.bookingRef}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
