/**
 * FlightImportModal
 * 
 * Modal for importing flight details via copy/paste from airline confirmations.
 * Uses AI to parse unstructured text into structured flight data.
 */

import { useState } from 'react';
import { Plane, Clipboard, Sparkles, Loader2, AlertCircle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import type { ManualFlightEntry } from './AddBookingInline';

interface ParsedFlightData {
  airline?: string;
  flightNumber?: string;
  departureAirport?: string;
  arrivalAirport?: string;
  departureTime?: string;
  arrivalTime?: string;
  departureDate?: string;
  price?: number;
}

interface FlightImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (outbound: ManualFlightEntry, returnFlight?: ManualFlightEntry) => void;
  tripStartDate?: string;
  tripEndDate?: string;
}

export function FlightImportModal({
  open,
  onOpenChange,
  onImport,
  tripStartDate,
  tripEndDate,
}: FlightImportModalProps) {
  const [confirmationText, setConfirmationText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedOutbound, setParsedOutbound] = useState<ParsedFlightData | null>(null);
  const [parsedReturn, setParsedReturn] = useState<ParsedFlightData | null>(null);
  const [step, setStep] = useState<'paste' | 'review'>('paste');

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setConfirmationText(text);
    } catch {
      // Clipboard API may not be available
    }
  };

  const handleParse = async () => {
    if (!confirmationText.trim()) {
      setError('Please paste your flight confirmation first');
      return;
    }

    setIsParsing(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('parse-booking-confirmation', {
        body: { confirmationText },
      });

      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);

      const booking = data.booking;
      
      if (booking.segment_type !== 'flight') {
        setError('This doesn\'t look like a flight confirmation. Please paste flight details.');
        return;
      }

      // Map parsed data to our format
      const outbound: ParsedFlightData = {
        airline: booking.vendor_name,
        flightNumber: booking.flight_number,
        departureAirport: booking.origin_code,
        arrivalAirport: booking.destination_code,
        departureTime: booking.start_time,
        arrivalTime: booking.end_time,
        departureDate: booking.start_date || tripStartDate,
        price: booking.net_cost_cents ? booking.net_cost_cents / 100 : undefined,
      };

      setParsedOutbound(outbound);
      
      // Check if there's return flight info (some confirmations include both)
      if (booking.notes?.toLowerCase().includes('return') || booking.end_date) {
        // For now, we'll let users add return separately
      }
      
      setStep('review');
    } catch (err) {
      console.error('Parse error:', err);
      setError(err instanceof Error ? err.message : 'Failed to parse confirmation');
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirmImport = () => {
    if (!parsedOutbound) return;

    const outbound: ManualFlightEntry = {
      airline: parsedOutbound.airline || '',
      flightNumber: parsedOutbound.flightNumber || '',
      departureAirport: parsedOutbound.departureAirport || '',
      arrivalAirport: parsedOutbound.arrivalAirport || '',
      departureTime: parsedOutbound.departureTime || '',
      arrivalTime: parsedOutbound.arrivalTime || '',
      departureDate: parsedOutbound.departureDate || tripStartDate || '',
      price: parsedOutbound.price,
    };

    const returnFlight: ManualFlightEntry | undefined = parsedReturn ? {
      airline: parsedReturn.airline || '',
      flightNumber: parsedReturn.flightNumber || '',
      departureAirport: parsedReturn.departureAirport || '',
      arrivalAirport: parsedReturn.arrivalAirport || '',
      departureTime: parsedReturn.departureTime || '',
      arrivalTime: parsedReturn.arrivalTime || '',
      departureDate: parsedReturn.departureDate || tripEndDate || '',
      price: parsedReturn.price,
    } : undefined;

    onImport(outbound, returnFlight);
    handleClose();
  };

  const handleClose = () => {
    setConfirmationText('');
    setParsedOutbound(null);
    setParsedReturn(null);
    setError(null);
    setStep('paste');
    onOpenChange(false);
  };

  const updateParsedOutbound = (field: keyof ParsedFlightData, value: string | number) => {
    setParsedOutbound(prev => prev ? { ...prev, [field]: value } : null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plane className="h-5 w-5 text-primary" />
            Import Flight Details
          </DialogTitle>
          <DialogDescription>
            {step === 'paste' 
              ? 'Paste your airline confirmation email or booking details' 
              : 'Review and confirm the extracted details'}
          </DialogDescription>
        </DialogHeader>

        {step === 'paste' && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Confirmation Text</Label>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs text-muted-foreground"
                  onClick={handlePaste}
                >
                  <Clipboard className="h-3 w-3 mr-1" />
                  Paste from clipboard
                </Button>
              </div>
              <Textarea
                placeholder="Paste your flight confirmation here...

Example:
Your flight confirmation
Delta Air Lines - Confirmation #ABC123
Flight DL456
Departing: Atlanta (ATL) at 8:30 PM
Arriving: Lisbon (LIS) at 10:15 AM +1"
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                className="min-h-[180px] text-sm font-mono"
              />
            </div>

            {error && (
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">{error}</AlertDescription>
              </Alert>
            )}

            <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
              <p className="font-medium mb-1">💡 Tip: Copy the entire email</p>
              <p>Our AI works best with full confirmation emails. Include flight numbers, times, and airports.</p>
            </div>
          </div>
        )}

        {step === 'review' && parsedOutbound && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 rounded-lg p-2">
              <Check className="h-4 w-4" />
              <span>Successfully extracted flight details!</span>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Airline</Label>
                  <Input
                    value={parsedOutbound.airline || ''}
                    onChange={(e) => updateParsedOutbound('airline', e.target.value)}
                    placeholder="Delta"
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Flight #</Label>
                  <Input
                    value={parsedOutbound.flightNumber || ''}
                    onChange={(e) => updateParsedOutbound('flightNumber', e.target.value)}
                    placeholder="DL456"
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">From</Label>
                  <Input
                    value={parsedOutbound.departureAirport || ''}
                    onChange={(e) => updateParsedOutbound('departureAirport', e.target.value)}
                    placeholder="ATL"
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">To</Label>
                  <Input
                    value={parsedOutbound.arrivalAirport || ''}
                    onChange={(e) => updateParsedOutbound('arrivalAirport', e.target.value)}
                    placeholder="LIS"
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Departure Date</Label>
                  <Input
                    type="date"
                    value={parsedOutbound.departureDate || ''}
                    onChange={(e) => updateParsedOutbound('departureDate', e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Departure Time</Label>
                  <Input
                    type="time"
                    value={parsedOutbound.departureTime || ''}
                    onChange={(e) => updateParsedOutbound('departureTime', e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Arrival Time *</Label>
                  <Input
                    type="time"
                    value={parsedOutbound.arrivalTime || ''}
                    onChange={(e) => updateParsedOutbound('arrivalTime', e.target.value)}
                    className="text-sm"
                    required
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Used to plan Day 1
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Price ($)</Label>
                  <Input
                    type="number"
                    value={parsedOutbound.price || ''}
                    onChange={(e) => updateParsedOutbound('price', Number(e.target.value))}
                    placeholder="450"
                    className="text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'paste' ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleParse} disabled={isParsing || !confirmationText.trim()}>
                {isParsing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Extract Details
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep('paste')}>
                Back
              </Button>
              <Button onClick={handleConfirmImport}>
                Use These Details
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
