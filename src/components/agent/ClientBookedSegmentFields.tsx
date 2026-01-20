/**
 * Client-Booked / Informational Segment Fields
 * 
 * Mode 3: For flights and bookings where the client booked themselves
 * or the agent ticketed outside the system. Provides additional fields
 * for tracking informational details without financial management.
 */

import { 
  Plane, 
  Luggage, 
  Building2, 
  Clock, 
  Globe, 
  Phone, 
  Info,
  AlertCircle
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { UseFormRegister, UseFormWatch, UseFormSetValue } from 'react-hook-form';

interface ClientBookedSegmentFieldsProps {
  register: UseFormRegister<any>;
  watch: UseFormWatch<any>;
  setValue: UseFormSetValue<any>;
  segmentType: string;
}

export default function ClientBookedSegmentFields({
  register,
  watch,
  setValue,
  segmentType,
}: ClientBookedSegmentFieldsProps) {
  const isInformational = watch('is_informational_only');

  return (
    <div className="space-y-4">
      {/* Informational Only Toggle */}
      <Card className="border-dashed">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Info className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <Label className="text-base font-medium">Client-Booked / Informational</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Enable for bookings where you're not managing finances—just tracking for the itinerary
                </p>
              </div>
            </div>
            <Switch
              checked={isInformational}
              onCheckedChange={(v) => setValue('is_informational_only', v)}
            />
          </div>
          
          {isInformational && (
            <Badge variant="secondary" className="mt-3">
              <AlertCircle className="h-3 w-3 mr-1" />
              This segment won't appear in finance ledger
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Flight-specific informational fields */}
      {segmentType === 'flight' && (
        <>
          <Separator />
          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <Plane className="h-4 w-4" />
              Flight Details for Client Reference
            </h4>

            {/* Terminal Info */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="terminal_info.departure">Departure Terminal</Label>
                <Input
                  id="terminal_info.departure"
                  {...register('terminal_info.departure')}
                  placeholder="Terminal 3, Gate B12"
                />
              </div>
              <div>
                <Label htmlFor="terminal_info.arrival">Arrival Terminal</Label>
                <Input
                  id="terminal_info.arrival"
                  {...register('terminal_info.arrival')}
                  placeholder="Terminal 1, Gate A5"
                />
              </div>
            </div>

            {/* Baggage */}
            <div>
              <Label htmlFor="baggage_allowance">
                <Luggage className="h-4 w-4 inline mr-1" />
                Baggage Allowance
              </Label>
              <Input
                id="baggage_allowance"
                {...register('baggage_allowance')}
                placeholder="1 carry-on + 1 checked bag (23kg)"
              />
            </div>

            {/* Timezone */}
            <div>
              <Label htmlFor="timezone_info">
                <Globe className="h-4 w-4 inline mr-1" />
                Timezone Note
              </Label>
              <Input
                id="timezone_info"
                {...register('timezone_info')}
                placeholder="Arrival time is local (UTC+9)"
              />
            </div>
          </div>
        </>
      )}

      {/* Support Instructions - for all informational segments */}
      <div>
        <Label htmlFor="support_instructions">
          <Phone className="h-4 w-4 inline mr-1" />
          Support / Contact Instructions
        </Label>
        <Textarea
          id="support_instructions"
          {...register('support_instructions')}
          placeholder="For changes, call airline directly at +1-800-XXX-XXXX. Reference booking: XXXXXX"
          rows={3}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Instructions for the client if they need to contact the vendor directly
        </p>
      </div>
    </div>
  );
}
