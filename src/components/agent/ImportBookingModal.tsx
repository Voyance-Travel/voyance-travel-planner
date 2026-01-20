import { useState } from 'react';
import { FileText, Loader2, Check, AlertCircle, Wand2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { createSegment, type BookingSegment, type BookingSegmentType } from '@/services/agencyCRM';
import { toast } from '@/hooks/use-toast';

interface ImportBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  onSuccess: () => void;
}

interface ParsedBooking {
  segment_type: BookingSegmentType;
  vendor_name?: string;
  confirmation_number?: string;
  start_date?: string;
  start_time?: string;
  end_date?: string;
  end_time?: string;
  origin?: string;
  origin_code?: string;
  destination?: string;
  destination_code?: string;
  flight_number?: string;
  cabin_class?: string;
  room_type?: string;
  room_count?: number;
  notes?: string;
  net_cost_cents?: number;
}

const SEGMENT_TYPE_LABELS: Record<string, string> = {
  flight: 'Flight',
  hotel: 'Hotel',
  car_rental: 'Car Rental',
  rail: 'Rail',
  tour: 'Tour',
  cruise: 'Cruise',
  transfer: 'Transfer',
  insurance: 'Insurance',
  other: 'Other',
};

export default function ImportBookingModal({ open, onOpenChange, tripId, onSuccess }: ImportBookingModalProps) {
  const [confirmationText, setConfirmationText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsedBooking, setParsedBooking] = useState<ParsedBooking | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleParse = async () => {
    if (!confirmationText.trim()) {
      setError('Please paste a booking confirmation');
      return;
    }

    setParsing(true);
    setError(null);
    setParsedBooking(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('parse-booking-confirmation', {
        body: { confirmationText },
      });

      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);

      setParsedBooking(data.booking);
    } catch (err) {
      console.error('Error parsing:', err);
      setError(err instanceof Error ? err.message : 'Failed to parse booking confirmation');
    } finally {
      setParsing(false);
    }
  };

  const handleSave = async () => {
    if (!parsedBooking) return;

    setSaving(true);
    try {
      await createSegment({
        trip_id: tripId,
        segment_type: parsedBooking.segment_type,
        status: 'pending',
        vendor_name: parsedBooking.vendor_name,
        confirmation_number: parsedBooking.confirmation_number,
        start_date: parsedBooking.start_date,
        start_time: parsedBooking.start_time,
        end_date: parsedBooking.end_date,
        end_time: parsedBooking.end_time,
        origin: parsedBooking.origin,
        origin_code: parsedBooking.origin_code,
        destination: parsedBooking.destination,
        destination_code: parsedBooking.destination_code,
        flight_number: parsedBooking.flight_number,
        cabin_class: parsedBooking.cabin_class,
        room_type: parsedBooking.room_type,
        room_count: parsedBooking.room_count,
        net_cost_cents: parsedBooking.net_cost_cents || 0,
        sell_price_cents: 0,
        commission_cents: 0,
        notes: parsedBooking.notes,
      });

      toast({ title: 'Booking imported successfully!' });
      onSuccess();
      handleClose();
    } catch (err) {
      console.error('Error saving booking:', err);
      toast({ title: 'Failed to save booking', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setConfirmationText('');
    setParsedBooking(null);
    setError(null);
    onOpenChange(false);
  };

  const formatDate = (date?: string) => {
    if (!date) return null;
    try {
      return new Date(date).toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
    } catch {
      return date;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Import Booking from Confirmation
          </DialogTitle>
          <DialogDescription>
            Paste a booking confirmation email or text and we'll extract the details automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!parsedBooking ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="confirmation">Confirmation Text</Label>
                <Textarea
                  id="confirmation"
                  value={confirmationText}
                  onChange={(e) => setConfirmationText(e.target.value)}
                  placeholder="Paste your booking confirmation email or text here...

Example:
Your flight is confirmed!
Confirmation: ABC123
United Airlines Flight UA 789
From: New York (JFK)
To: Los Angeles (LAX)
Date: March 15, 2026
Departure: 8:30 AM
Arrival: 11:45 AM
Cabin: Economy"
                  className="min-h-[200px] font-mono text-sm"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <Button onClick={handleParse} disabled={parsing || !confirmationText.trim()} className="w-full">
                {parsing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Parsing...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 mr-2" />
                    Parse Confirmation
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 p-3 bg-emerald-500/10 text-emerald-600 rounded-lg text-sm">
                <Check className="h-4 w-4" />
                Successfully extracted booking details
              </div>

              <Card>
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-sm">
                      {SEGMENT_TYPE_LABELS[parsedBooking.segment_type] || parsedBooking.segment_type}
                    </Badge>
                    {parsedBooking.confirmation_number && (
                      <span className="font-mono text-sm">
                        #{parsedBooking.confirmation_number}
                      </span>
                    )}
                  </div>

                  {parsedBooking.vendor_name && (
                    <p className="font-semibold text-lg">{parsedBooking.vendor_name}</p>
                  )}

                  {parsedBooking.flight_number && (
                    <p className="font-mono">{parsedBooking.flight_number}</p>
                  )}

                  <div className="grid sm:grid-cols-2 gap-4 text-sm">
                    {(parsedBooking.origin || parsedBooking.origin_code) && (
                      <div>
                        <p className="text-muted-foreground">From</p>
                        <p className="font-medium">
                          {parsedBooking.origin}
                          {parsedBooking.origin_code && ` (${parsedBooking.origin_code})`}
                        </p>
                      </div>
                    )}
                    {(parsedBooking.destination || parsedBooking.destination_code) && (
                      <div>
                        <p className="text-muted-foreground">To</p>
                        <p className="font-medium">
                          {parsedBooking.destination}
                          {parsedBooking.destination_code && ` (${parsedBooking.destination_code})`}
                        </p>
                      </div>
                    )}
                    {parsedBooking.start_date && (
                      <div>
                        <p className="text-muted-foreground">Start Date</p>
                        <p className="font-medium">
                          {formatDate(parsedBooking.start_date)}
                          {parsedBooking.start_time && ` at ${parsedBooking.start_time}`}
                        </p>
                      </div>
                    )}
                    {parsedBooking.end_date && (
                      <div>
                        <p className="text-muted-foreground">End Date</p>
                        <p className="font-medium">
                          {formatDate(parsedBooking.end_date)}
                          {parsedBooking.end_time && ` at ${parsedBooking.end_time}`}
                        </p>
                      </div>
                    )}
                    {parsedBooking.cabin_class && (
                      <div>
                        <p className="text-muted-foreground">Cabin</p>
                        <p className="font-medium capitalize">{parsedBooking.cabin_class.replace('_', ' ')}</p>
                      </div>
                    )}
                    {parsedBooking.room_type && (
                      <div>
                        <p className="text-muted-foreground">Room Type</p>
                        <p className="font-medium">{parsedBooking.room_type}</p>
                      </div>
                    )}
                    {parsedBooking.net_cost_cents && parsedBooking.net_cost_cents > 0 && (
                      <div>
                        <p className="text-muted-foreground">Price</p>
                        <p className="font-medium">
                          ${(parsedBooking.net_cost_cents / 100).toFixed(2)}
                        </p>
                      </div>
                    )}
                  </div>

                  {parsedBooking.notes && (
                    <div>
                      <p className="text-muted-foreground text-sm">Notes</p>
                      <p className="text-sm">{parsedBooking.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <p className="text-xs text-muted-foreground text-center">
                Review the extracted details above. You can edit them after saving.
              </p>
            </>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          {parsedBooking ? (
            <>
              <Button variant="outline" onClick={() => setParsedBooking(null)}>
                Back
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Save Booking
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}