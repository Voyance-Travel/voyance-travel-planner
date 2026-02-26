/**
 * TripConfirmCard — Displays extracted trip details for user review before generation.
 */

import { motion } from 'framer-motion';
import { MapPin, Calendar, Users, DollarSign, Hotel, Sparkles, CheckCircle2, Pencil, Route } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';
import type { TripDetails } from './TripChatPlanner';

interface TripConfirmCardProps {
  details: TripDetails;
  onConfirm: () => void;
  onEdit: () => void;
  isGenerating?: boolean;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy');
  } catch {
    return dateStr;
  }
}

export function TripConfirmCard({ details, onConfirm, onEdit, isGenerating }: TripConfirmCardProps) {
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
  if (details.tripType) {
    rows.push({ icon: <Sparkles className="h-3.5 w-3.5" />, label: 'Trip type', value: details.tripType });
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
        <div className="rounded-lg bg-muted/50 p-2 space-y-1">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <Route className="h-3 w-3" />
            City breakdown
          </p>
          {details.cities.map((city, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">{i + 1}.</span>
              <span className="text-foreground font-medium">{city.name}</span>
              {city.country && <span className="text-muted-foreground">({city.country})</span>}
              <span className="text-muted-foreground ml-auto">{city.nights} night{city.nights !== 1 ? 's' : ''}</span>
            </div>
          ))}
        </div>
      )}

      {details.mustDoActivities && (
        <div className="text-xs">
          <span className="text-muted-foreground">Must-do: </span>
          <span className="text-foreground">{details.mustDoActivities}</span>
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
