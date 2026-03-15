/**
 * InterCityTransportEditor
 * 
 * Sheet/dialog for adding or editing transport details between cities.
 * Mode-specific fields: train, flight, bus, car/rental, ferry.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plane, Train, Bus, Car, Ship, Clock, CreditCard,
  MapPin, ArrowRight, Hash, Armchair, StickyNote, X, Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { TransportType, TransportDetails } from '@/types/tripCity';

const MODE_CONFIG = [
  { value: 'flight' as const, label: 'Flight', icon: Plane },
  { value: 'train' as const, label: 'Train', icon: Train },
  { value: 'bus' as const, label: 'Bus', icon: Bus },
  { value: 'car' as const, label: 'Car / Rental', icon: Car },
  { value: 'ferry' as const, label: 'Ferry', icon: Ship },
] as const;

interface InterCityTransportEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromCity: string;
  toCity: string;
  transportType?: TransportType;
  transportDetails?: TransportDetails;
  transportCostCents?: number;
  transportCurrency?: string;
  onSave: (data: {
    transportType: TransportType;
    transportDetails: TransportDetails;
    transportCostCents: number;
    currency: string;
  }) => void;
  saving?: boolean;
}

export function InterCityTransportEditor({
  open,
  onOpenChange,
  fromCity,
  toCity,
  transportType,
  transportDetails,
  transportCostCents,
  transportCurrency,
  onSave,
  saving,
}: InterCityTransportEditorProps) {
  const [mode, setMode] = useState<TransportType>(transportType || 'train');
  const [details, setDetails] = useState<TransportDetails>(transportDetails || {});
  const [costStr, setCostStr] = useState('');
  const [currency, setCurrency] = useState(transportCurrency || 'USD');

  // Normalize legacy transport_details field names from Step 1/2 into editor field names
  const normalizeDetails = (raw: TransportDetails | undefined, mode: TransportType): TransportDetails => {
    if (!raw) return {};
    const d = raw as Record<string, any>;
    const normalized: TransportDetails = { ...raw };

    // Map "operator" → "carrier"
    if (d.operator && !d.carrier) normalized.carrier = d.operator;

    // For flights: "departureStation"/"arrivalStation" may hold airport names
    if (mode === 'flight') {
      if (d.departureStation && !d.departureAirport) normalized.departureAirport = d.departureStation;
      if (d.arrivalStation && !d.arrivalAirport) normalized.arrivalAirport = d.arrivalStation;
    }

    // Map duration variants
    if (!d.duration) {
      if (d.inTransitDuration) normalized.duration = d.inTransitDuration;
      else if (d.doorToDoorDuration) normalized.duration = d.doorToDoorDuration;
    }

    return normalized;
  };

  // Reset form when opening
  useEffect(() => {
    if (open) {
      const m = transportType || 'train';
      setMode(m);
      setDetails(normalizeDetails(transportDetails, m));
      // Prefer totalCost from details if transportCostCents is missing
      const rawDetails = transportDetails as Record<string, any> | undefined;
      const costFromCents = transportCostCents && transportCostCents > 0
        ? (transportCostCents / 100).toFixed(2)
        : '';
      const costFromDetails = rawDetails?.totalCost ? String(rawDetails.totalCost) : '';
      setCostStr(costFromCents || costFromDetails);
      setCurrency(transportCurrency || (rawDetails?.currency as string) || 'USD');
    }
  }, [open, transportType, transportDetails, transportCostCents, transportCurrency]);

  const update = (patch: Partial<TransportDetails>) => setDetails(prev => ({ ...prev, ...patch }));

  const handleSave = () => {
    const costCents = Math.round(parseFloat(costStr || '0') * 100);
    onSave({
      transportType: mode,
      transportDetails: { ...details, fromCity, toCity },
      transportCostCents: costCents,
      currency,
    });
  };

  const hasContent = details.carrier || details.flightNumber || details.departureTime || details.arrivalTime || details.bookingRef || costStr;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[min(85vh,calc(100dvh-100px))] overflow-y-auto rounded-t-2xl">
        <SheetHeader className="pb-2">
          <SheetTitle className="flex items-center gap-2 text-base">
            <div className="flex items-center gap-1.5 text-sm">
              <MapPin className="h-4 w-4 text-primary" />
              <span>{fromCity}</span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{toCity}</span>
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5 py-3">
          {/* Mode selector */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Transport mode</Label>
            <div className="flex flex-wrap gap-2">
              {MODE_CONFIG.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors',
                    mode === value
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border text-muted-foreground hover:border-muted-foreground/50'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Mode-specific fields */}
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="space-y-4"
            >
              {mode === 'flight' && <FlightFields details={details} onChange={update} />}
              {mode === 'train' && <TrainFields details={details} onChange={update} />}
              {mode === 'bus' && <BusFields details={details} onChange={update} />}
              {mode === 'car' && <CarFields details={details} onChange={update} />}
              {mode === 'ferry' && <FerryFields details={details} onChange={update} />}
            </motion.div>
          </AnimatePresence>

          {/* Common fields: times, duration, cost, booking ref, notes */}
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Departure time" icon={Clock}>
                  <Input type="text" placeholder="e.g. 10:30 AM" value={details.departureTime || ''} onChange={e => update({ departureTime: e.target.value })} />
                </Field>
                <Field label="Arrival time" icon={Clock}>
                  <Input type="text" placeholder="e.g. 2:45 PM" value={details.arrivalTime || ''} onChange={e => update({ arrivalTime: e.target.value })} />
                </Field>
              </div>
              <Field label="Duration" icon={Clock}>
                <Input placeholder="e.g. 2h 30m" value={details.duration || ''} onChange={e => update({ duration: e.target.value })} />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Total cost" icon={CreditCard}>
                <div className="flex gap-1.5">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={costStr}
                    onChange={e => setCostStr(e.target.value)}
                    className="flex-1"
                  />
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF'].map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </Field>
              <Field label="Booking reference" icon={Hash}>
                <Input placeholder="e.g. ABC123" value={details.bookingRef || ''} onChange={e => update({ bookingRef: e.target.value })} />
              </Field>
            </div>

            <Field label="Seat / class" icon={Armchair}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input placeholder="Class (e.g. First)" value={details.seatClass || ''} onChange={e => update({ seatClass: e.target.value })} />
                <Input placeholder="Seat (e.g. 12A)" value={details.seatNumber || ''} onChange={e => update({ seatNumber: e.target.value })} />
              </div>
            </Field>

            <Field label="Notes" icon={StickyNote}>
              <Textarea
                placeholder="Any extra details..."
                value={details.notes || ''}
                onChange={e => update({ notes: e.target.value })}
                rows={2}
              />
            </Field>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <span className="flex items-center gap-1.5">
                  <span className="h-3.5 w-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Saving...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Save className="h-3.5 w-3.5" />
                  {hasContent ? 'Save details' : 'Set transport'}
                </span>
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Helpers ────────────────────────────────────────────

function Field({ label, icon: Icon, children }: { label: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {label}
      </Label>
      {children}
    </div>
  );
}

// ── Mode-specific field groups ─────────────────────────

function FlightFields({ details, onChange }: { details: TransportDetails; onChange: (p: Partial<TransportDetails>) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Airline" icon={Plane}>
          <Input placeholder="e.g. British Airways" value={details.carrier || ''} onChange={e => onChange({ carrier: e.target.value })} />
        </Field>
        <Field label="Flight number" icon={Hash}>
          <Input placeholder="e.g. BA 307" value={details.flightNumber || ''} onChange={e => onChange({ flightNumber: e.target.value })} />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Departure airport" icon={MapPin}>
          <Input placeholder="e.g. LHR" value={details.departureAirport || ''} onChange={e => onChange({ departureAirport: e.target.value })} />
        </Field>
        <Field label="Arrival airport" icon={MapPin}>
          <Input placeholder="e.g. CDG" value={details.arrivalAirport || ''} onChange={e => onChange({ arrivalAirport: e.target.value })} />
        </Field>
      </div>
    </div>
  );
}

function TrainFields({ details, onChange }: { details: TransportDetails; onChange: (p: Partial<TransportDetails>) => void }) {
  return (
    <div className="space-y-3">
      <Field label="Train service" icon={Train}>
        <Input placeholder="e.g. Eurostar, TGV, Shinkansen" value={details.carrier || ''} onChange={e => onChange({ carrier: e.target.value })} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Departure station" icon={MapPin}>
          <Input placeholder="e.g. London St Pancras" value={details.departureStation || ''} onChange={e => onChange({ departureStation: e.target.value })} />
        </Field>
        <Field label="Arrival station" icon={MapPin}>
          <Input placeholder="e.g. Paris Gare du Nord" value={details.arrivalStation || ''} onChange={e => onChange({ arrivalStation: e.target.value })} />
        </Field>
      </div>
      <Field label="Train number" icon={Hash}>
        <Input placeholder="e.g. ES 9014" value={details.flightNumber || ''} onChange={e => onChange({ flightNumber: e.target.value })} />
      </Field>
    </div>
  );
}

function BusFields({ details, onChange }: { details: TransportDetails; onChange: (p: Partial<TransportDetails>) => void }) {
  return (
    <div className="space-y-3">
      <Field label="Bus service" icon={Bus}>
        <Input placeholder="e.g. FlixBus, Megabus" value={details.carrier || ''} onChange={e => onChange({ carrier: e.target.value })} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Departure point" icon={MapPin}>
          <Input placeholder="e.g. Victoria Coach Station" value={details.departureStation || ''} onChange={e => onChange({ departureStation: e.target.value })} />
        </Field>
        <Field label="Arrival point" icon={MapPin}>
          <Input placeholder="e.g. Bercy Seine" value={details.arrivalStation || ''} onChange={e => onChange({ arrivalStation: e.target.value })} />
        </Field>
      </div>
    </div>
  );
}

function CarFields({ details, onChange }: { details: TransportDetails; onChange: (p: Partial<TransportDetails>) => void }) {
  return (
    <div className="space-y-3">
      <Field label="Rental company" icon={Car}>
        <Input placeholder="e.g. Hertz, Europcar" value={details.rentalCompany || ''} onChange={e => onChange({ rentalCompany: e.target.value })} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Pickup location" icon={MapPin}>
          <Input placeholder="e.g. Heathrow Airport" value={details.pickupLocation || ''} onChange={e => onChange({ pickupLocation: e.target.value })} />
        </Field>
        <Field label="Dropoff location" icon={MapPin}>
          <Input placeholder="e.g. Paris CDG" value={details.dropoffLocation || ''} onChange={e => onChange({ dropoffLocation: e.target.value })} />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Car class" icon={Car}>
          <Input placeholder="e.g. Compact, SUV" value={details.carClass || ''} onChange={e => onChange({ carClass: e.target.value })} />
        </Field>
        <Field label="Cost per day" icon={CreditCard}>
          <Input type="number" step="0.01" placeholder="0.00" value={details.costPerDay || ''} onChange={e => onChange({ costPerDay: parseFloat(e.target.value) || undefined })} />
        </Field>
      </div>
    </div>
  );
}

function FerryFields({ details, onChange }: { details: TransportDetails; onChange: (p: Partial<TransportDetails>) => void }) {
  return (
    <div className="space-y-3">
      <Field label="Ferry operator" icon={Ship}>
        <Input placeholder="e.g. P&O Ferries, Stena Line" value={details.carrier || ''} onChange={e => onChange({ carrier: e.target.value })} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Departure terminal" icon={MapPin}>
          <Input placeholder="e.g. Dover" value={details.departureTerminal || ''} onChange={e => onChange({ departureTerminal: e.target.value })} />
        </Field>
        <Field label="Arrival terminal" icon={MapPin}>
          <Input placeholder="e.g. Calais" value={details.arrivalTerminal || ''} onChange={e => onChange({ arrivalTerminal: e.target.value })} />
        </Field>
      </div>
      <Field label="Cabin type" icon={Armchair}>
        <Input placeholder="e.g. Outside cabin, Recliner seat" value={details.cabinType || ''} onChange={e => onChange({ cabinType: e.target.value })} />
      </Field>
    </div>
  );
}
