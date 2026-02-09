import { motion, AnimatePresence } from 'framer-motion';
import { Bus, TrainFront, Car, CarTaxiFront, Ship, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export type TransportMode = 'flight' | 'train' | 'car' | 'ferry' | 'bus' | 'rideshare' | '';

export interface TransportFormData {
  mode: TransportMode;
  arrivalTime: string;
  departureTime: string;
  // Flight-specific
  arrivalAirport: string;
  departureAirport: string;
  // Train-specific
  arrivalStation: string;
  departureStation: string;
  // Ferry/cruise
  arrivalPort: string;
  departurePort: string;
}

export const EMPTY_TRANSPORT_FORM: TransportFormData = {
  mode: '',
  arrivalTime: '',
  departureTime: '',
  arrivalAirport: '',
  departureAirport: '',
  arrivalStation: '',
  departureStation: '',
  arrivalPort: '',
  departurePort: '',
};

const MODES = [
  { value: 'train' as const, label: 'Train', icon: TrainFront },
  { value: 'car' as const, label: 'Car', icon: Car },
  { value: 'bus' as const, label: 'Bus', icon: Bus },
  { value: 'rideshare' as const, label: 'Rideshare', icon: CarTaxiFront },
  { value: 'ferry' as const, label: 'Ferry / Cruise', icon: Ship },
] as const;

interface TransportModeSelectorProps {
  form: TransportFormData;
  onChange: (form: TransportFormData) => void;
  destination: string;
}

export function TransportModeSelector({ form, onChange, destination }: TransportModeSelectorProps) {
  const update = (patch: Partial<TransportFormData>) => onChange({ ...form, ...patch });

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">How are you getting there?</div>

      {/* Mode picker chips */}
      <div className="flex flex-wrap gap-2">
        {MODES.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => update({ mode: form.mode === value ? '' : value })}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors',
              form.mode === value
                ? 'border-primary bg-primary/10 text-primary font-medium'
                : 'border-border text-muted-foreground hover:border-muted-foreground/50'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Mode-specific fields */}
      <AnimatePresence mode="wait">
        {form.mode && (
          <motion.div
            key={form.mode}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3 overflow-hidden"
          >
            {form.mode === 'train' && (
              <TrainFields form={form} onChange={update} destination={destination} />
            )}
            {form.mode === 'car' && (
              <CarFields form={form} onChange={update} destination={destination} />
            )}
            {(form.mode === 'bus' || form.mode === 'rideshare') && (
              <CarFields form={form} onChange={update} destination={destination} />
            )}
            {form.mode === 'ferry' && (
              <FerryFields form={form} onChange={update} destination={destination} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Mode-specific field groups ---

// Flight fields removed - platform doesn't handle flight booking


function TrainFields({ form, onChange, destination }: { form: TransportFormData; onChange: (p: Partial<TransportFormData>) => void; destination: string }) {
  return (
    <>
      <TimeField label={`Arrival time in ${destination}`} value={form.arrivalTime} onChangeValue={(v) => onChange({ arrivalTime: v })} />
      <Input placeholder="Arrival station (e.g., Roma Termini)" value={form.arrivalStation} onChange={(e) => onChange({ arrivalStation: e.target.value })} />
      <TimeField label={`Departure time from ${destination}`} value={form.departureTime} onChangeValue={(v) => onChange({ departureTime: v })} />
      <Input placeholder="Departure station" value={form.departureStation} onChange={(e) => onChange({ departureStation: e.target.value })} />
    </>
  );
}

function CarFields({ form, onChange, destination }: { form: TransportFormData; onChange: (p: Partial<TransportFormData>) => void; destination: string }) {
  return (
    <>
      <TimeField label={`Estimated arrival in ${destination}`} value={form.arrivalTime} onChangeValue={(v) => onChange({ arrivalTime: v })} />
      <TimeField label={`Estimated departure from ${destination}`} value={form.departureTime} onChangeValue={(v) => onChange({ departureTime: v })} />
    </>
  );
}

function FerryFields({ form, onChange, destination }: { form: TransportFormData; onChange: (p: Partial<TransportFormData>) => void; destination: string }) {
  return (
    <>
      <TimeField label={`Arrival time in ${destination}`} value={form.arrivalTime} onChangeValue={(v) => onChange({ arrivalTime: v })} />
      <Input placeholder="Arrival port / terminal" value={form.arrivalPort} onChange={(e) => onChange({ arrivalPort: e.target.value })} />
      <TimeField label={`Departure time from ${destination}`} value={form.departureTime} onChangeValue={(v) => onChange({ departureTime: v })} />
      <Input placeholder="Departure port / terminal" value={form.departurePort} onChange={(e) => onChange({ departurePort: e.target.value })} />
    </>
  );
}

function TimeField({ label, value, onChangeValue }: { label: string; value: string; onChangeValue: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground flex items-center gap-1">
        <Clock className="h-3 w-3" />
        {label}
      </Label>
      <Input type="time" value={value} onChange={(e) => onChangeValue(e.target.value)} />
    </div>
  );
}

/** Convert transport form data into the flight_selection shape used by the system */
export function buildTransportSelection(form: TransportFormData) {
  if (!form.mode || (!form.arrivalTime && !form.departureTime)) return undefined;

  const terminalKey = form.mode === 'train' ? 'station'
    : form.mode === 'ferry' ? 'port'
    : undefined;

  const arrivalTerminal = form.mode === 'train' ? form.arrivalStation
    : form.mode === 'ferry' ? form.arrivalPort
    : undefined;

  const departureTerminal = form.mode === 'train' ? form.departureStation
    : form.mode === 'ferry' ? form.departurePort
    : undefined;

  return {
    transportMode: form.mode,
    outbound: form.arrivalTime ? {
      arrivalTime: form.arrivalTime,
      arrival: {
        time: form.arrivalTime,
        ...(terminalKey && arrivalTerminal ? { [terminalKey]: arrivalTerminal } : {}),
      },
    } : undefined,
    return: form.departureTime ? {
      departureTime: form.departureTime,
      departure: {
        time: form.departureTime,
        ...(terminalKey && departureTerminal ? { [terminalKey]: departureTerminal } : {}),
      },
    } : undefined,
  };
}
