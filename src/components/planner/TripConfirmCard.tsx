/**
 * TripConfirmCard — Displays extracted trip details for user review before generation.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Calendar, Users, DollarSign, Hotel, Sparkles, CheckCircle2, Pencil, Route, TrainFront, Plane, Bus, Car, Ship, ChevronDown, Clock, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import type { TripDetails } from './TripChatPlanner';

export type InterCityTransportMode = 'flight' | 'train' | 'bus' | 'car' | 'ferry';

const TRANSPORT_OPTIONS: { value: InterCityTransportMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'flight', label: 'Flight', icon: Plane },
  { value: 'train', label: 'Train', icon: TrainFront },
  { value: 'bus', label: 'Bus', icon: Bus },
  { value: 'car', label: 'Car', icon: Car },
  { value: 'ferry', label: 'Ferry', icon: Ship },
];

interface TripConfirmCardProps {
  details: TripDetails;
  onConfirm: () => void;
  onEdit: () => void;
  isGenerating?: boolean;
  transports?: InterCityTransportMode[];
  onTransportChange?: (index: number, mode: InterCityTransportMode) => void;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-';
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy');
  } catch {
    return dateStr;
  }
}

export function TripConfirmCard({ details, onConfirm, onEdit, isGenerating, transports, onTransportChange }: TripConfirmCardProps) {
  const isMultiCity = details.cities && details.cities.length > 1;
  const rows: { icon: React.ReactNode; label: string; value: string }[] = [];

  if (details.destination) {
    rows.push({
      icon: <MapPin className="h-3.5 w-3.5" />,
      label: isMultiCity ? 'Route' : 'Destination',
      value: details.destination,
    });
  }
  if (details.startDate || details.endDate) {
    rows.push({
      icon: <Calendar className="h-3.5 w-3.5" />,
      label: 'Dates',
      value: `${formatDate(details.startDate)} → ${formatDate(details.endDate)}`,
    });
  }
  if (details.travelers) {
    rows.push({ icon: <Users className="h-3.5 w-3.5" />, label: 'Travelers', value: `${details.travelers}` });
  }
  if (details.budgetAmount) {
    rows.push({
      icon: <DollarSign className="h-3.5 w-3.5" />,
      label: 'Budget',
      value: `$${details.budgetAmount.toLocaleString()}`,
    });
  }
  if (details.hotelName) {
    rows.push({ icon: <Hotel className="h-3.5 w-3.5" />, label: 'Hotel', value: details.hotelName });
  }
  if (details.arrivalAirport || details.arrivalTime) {
    const flightIn = [details.arrivalAirport, details.arrivalTime].filter(Boolean).join(' at ');
    rows.push({ icon: <Plane className="h-3.5 w-3.5" />, label: 'Arriving', value: flightIn });
  }
  if (details.departureAirport || details.departureTime) {
    const flightOut = [details.departureAirport, details.departureTime].filter(Boolean).join(' at ');
    rows.push({ icon: <Plane className="h-3.5 w-3.5" />, label: 'Departing', value: flightOut });
  }
  if (details.mustDoActivities) {
    rows.push({ icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: 'Must-do', value: details.mustDoActivities });
  }
  if (details.pacing && details.pacing !== 'balanced') {
    const pacingLabels: Record<string, string> = { relaxed: 'Relaxed pace', packed: 'Action-packed' };
    rows.push({ icon: <Clock className="h-3.5 w-3.5" />, label: 'Pace', value: pacingLabels[details.pacing] || details.pacing });
  }
  if (details.interestCategories?.length) {
    rows.push({ icon: <Star className="h-3.5 w-3.5" />, label: 'Interests', value: details.interestCategories.join(', ') });
  }
  if (details.tripType) {
    rows.push({ icon: <Sparkles className="h-3.5 w-3.5" />, label: 'Trip type', value: details.tripType });
  }

  // Show structured day count if perDayActivities exists
  const structuredDayCount = details.perDayActivities?.length || 0;
  if (structuredDayCount > 0) {
    rows.push({ icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: 'Locked days', value: `${structuredDayCount} day${structuredDayCount !== 1 ? 's' : ''} of your itinerary captured` });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border border-border bg-card p-3 space-y-2.5"
    >
      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
        <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
        Here's what I captured
      </p>

      <div className="space-y-1.5">
        {rows.map((row, i) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            <span className="text-muted-foreground mt-0.5 shrink-0">{row.icon}</span>
            <span className="text-muted-foreground w-16 shrink-0">{row.label}</span>
            <span className="text-foreground font-medium">{row.value}</span>
          </div>
        ))}
      </div>

      {/* Multi-city route breakdown */}
      {isMultiCity && details.cities && (
        <div className="rounded-lg bg-muted/50 p-2 space-y-0">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1 mb-1">
            <Route className="h-3 w-3" />
            City breakdown
          </p>
          {details.cities.map((city, i) => (
            <div key={i}>
              <div className="flex items-center gap-1.5 text-xs py-0.5">
                <span className="text-muted-foreground">{i + 1}.</span>
                <span className="text-foreground font-medium">{city.name}</span>
                {city.country && <span className="text-muted-foreground">({city.country})</span>}
                <span className="text-muted-foreground ml-auto">{city.nights} night{city.nights !== 1 ? 's' : ''}</span>
              </div>
              {/* Transport selector between consecutive cities */}
              {i < details.cities!.length - 1 && (
                <TransportLegSelector
                  fromCity={city.name}
                  toCity={details.cities![i + 1].name}
                  value={transports?.[i] || 'flight'}
                  onChange={(mode) => onTransportChange?.(i, mode)}
                />
              )}
            </div>
          ))}
        </div>
      )}


      {details.additionalNotes && (
        <div className="text-xs text-muted-foreground italic line-clamp-2">
          {details.additionalNotes}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          variant="ghost"
          className="flex-1 text-xs h-8"
          onClick={onEdit}
          disabled={isGenerating}
        >
          <Pencil className="h-3 w-3 mr-1" />
          Fix something
        </Button>
        <Button
          size="sm"
          className="flex-1 text-xs h-8"
          onClick={onConfirm}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>Generating…</>
          ) : (
            <>
              <Sparkles className="h-3 w-3 mr-1" />
              Confirm & Generate
            </>
          )}
        </Button>
      </div>
    </motion.div>
  );
}

/** Inline transport mode picker between two cities */
function TransportLegSelector({
  fromCity,
  toCity,
  value,
  onChange,
}: {
  fromCity: string;
  toCity: string;
  value: InterCityTransportMode;
  onChange: (mode: InterCityTransportMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = TRANSPORT_OPTIONS.find(o => o.value === value) || TRANSPORT_OPTIONS[0];
  const Icon = selected.icon;

  return (
    <div className="relative pl-4 py-1">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <div className="w-px h-3 bg-border mr-1" />
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-border bg-background hover:bg-muted transition-colors text-foreground text-[11px] font-medium"
        >
          <Icon className="h-3 w-3" />
          {selected.label}
          <ChevronDown className="h-2.5 w-2.5 text-muted-foreground" />
        </button>
        <span>to {toCity}</span>
      </div>
      {open && (
        <div className="absolute left-8 top-full z-10 mt-0.5 bg-popover border border-border rounded-md shadow-md py-0.5 min-w-[120px]">
          {TRANSPORT_OPTIONS.map((opt) => {
            const OptIcon = opt.icon;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={cn(
                  'w-full flex items-center gap-1.5 px-2 py-1 text-[11px] hover:bg-muted transition-colors',
                  opt.value === value ? 'text-primary font-medium' : 'text-foreground'
                )}
              >
                <OptIcon className="h-3 w-3" />
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
