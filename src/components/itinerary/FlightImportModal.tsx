/**
 * FlightImportModal
 * 
 * Modal for importing flight details via copy/paste from airline confirmations.
 * Uses AI to parse unstructured text into structured flight data.
 * Supports multi-segment/multi-city bookings with intelligent analysis.
 */

import { useState } from 'react';
import { Plane, Clipboard, Sparkles, Loader2, AlertCircle, Check, ChevronDown, ChevronUp, ArrowRight, AlertTriangle, MapPin, Clock, Route } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import type { ManualFlightEntry } from './AddBookingInline';

interface ParsedSegmentData {
  airline?: string;
  flightNumber?: string;
  departureAirport?: string;
  arrivalAirport?: string;
  departureTime?: string;
  arrivalTime?: string;
  departureDate?: string;
  arrivalDate?: string;
  price?: number;
  cabinClass?: string;
  classification?: 'OUTBOUND' | 'RETURN' | 'CONNECTION' | 'INTER_DESTINATION';
  isLayoverArrival?: boolean;
  connectionGroup?: number | null;
}

export interface FlightIntelligence {
  route?: {
    display?: string;
    homeAirport?: string;
    destinationAirports?: string[];
    layoverAirports?: string[];
  };
  missingLegs?: Array<{
    from?: string;
    fromCity?: string;
    to?: string;
    toCity?: string;
    reason?: string;
    suggestedDateRange?: { earliest?: string; latest?: string };
    priority?: 'CRITICAL' | 'WARNING' | 'INFO';
  }>;
  destinationSchedule?: Array<{
    city?: string;
    airport?: string;
    arrivalDatetime?: string | null;
    departureDatetime?: string | null;
    availableFrom?: string | null;
    availableUntil?: string | null;
    fullDays?: number;
    isFirstDestination?: boolean;
    isLastDestination?: boolean;
    notes?: string[];
  }>;
  layovers?: Array<{
    airport?: string;
    city?: string;
    arrivalTime?: string;
    departureTime?: string;
    duration?: string;
  }>;
  warnings?: Array<{
    type?: string;
    message?: string;
    severity?: 'WARNING' | 'INFO' | 'ERROR';
  }>;
  summary?: string;
}

export interface ImportedFlightLegs {
  legs: ManualFlightEntry[];
}

interface FlightImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Legacy: single outbound + optional return */
  onImport: (outbound: ManualFlightEntry, returnFlight?: ManualFlightEntry) => void;
  /** New: all legs at once */
  onImportLegs?: (legs: ManualFlightEntry[]) => void;
  /** Callback with intelligence data */
  onIntelligence?: (intelligence: FlightIntelligence) => void;
  tripStartDate?: string;
  tripEndDate?: string;
  // Trip context for intelligent analysis
  destinations?: string[];
  destinationAirports?: string[];
  nightsPerCity?: Record<string, number>;
}

const classificationLabels: Record<string, { label: string; color: string }> = {
  OUTBOUND: { label: 'Outbound', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  RETURN: { label: 'Return', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  CONNECTION: { label: 'Connection', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  INTER_DESTINATION: { label: 'Inter-destination', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
};

export function FlightImportModal({
  open,
  onOpenChange,
  onImport,
  onImportLegs,
  onIntelligence,
  tripStartDate,
  tripEndDate,
  destinations,
  destinationAirports,
  nightsPerCity,
}: FlightImportModalProps) {
  const [confirmationText, setConfirmationText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedSegments, setParsedSegments] = useState<ParsedSegmentData[]>([]);
  const [intelligence, setIntelligence] = useState<FlightIntelligence | null>(null);
  const [step, setStep] = useState<'paste' | 'review'>('paste');
  const [expandedSegments, setExpandedSegments] = useState<Set<number>>(new Set([0]));

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
      // Build tripContext if we have destination data
      const hasTripContext = destinations && destinations.length > 0;
      const tripContext = hasTripContext ? {
        destinations,
        destinationAirports: destinationAirports || [],
        tripDates: { start: tripStartDate, end: tripEndDate },
        nightsPerCity: nightsPerCity || {},
      } : undefined;

      const { data, error: fnError } = await supabase.functions.invoke('parse-booking-confirmation', {
        body: { confirmationText, tripContext },
      });

      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);

      const booking = data.booking;
      const intelData = data.intelligence as FlightIntelligence | null;
      
      if (booking.segment_type !== 'flight') {
        setError('This doesn\'t look like a flight confirmation. Please paste flight details.');
        return;
      }

      // Map ALL segments
      const segments: ParsedSegmentData[] = (booking.segments || []).map((seg: any) => ({
        airline: seg.vendor_name || booking.vendor_name,
        flightNumber: seg.flight_number,
        departureAirport: seg.origin_code,
        arrivalAirport: seg.destination_code,
        departureTime: seg.start_time,
        arrivalTime: seg.end_time,
        departureDate: seg.start_date,
        arrivalDate: seg.end_date,
        cabinClass: seg.cabin_class,
        price: seg.net_cost_cents ? seg.net_cost_cents / 100 : undefined,
        classification: seg.classification,
        isLayoverArrival: seg.isLayoverArrival,
        connectionGroup: seg.connectionGroup,
      }));

      // Fallback: if no segments array, use top-level fields
      if (segments.length === 0) {
        segments.push({
          airline: booking.vendor_name,
          flightNumber: booking.flight_number,
          departureAirport: booking.origin_code,
          arrivalAirport: booking.destination_code,
          departureTime: booking.start_time,
          arrivalTime: booking.end_time,
          departureDate: booking.start_date || tripStartDate,
          arrivalDate: booking.end_date,
          cabinClass: booking.cabin_class,
          price: booking.net_cost_cents ? booking.net_cost_cents / 100 : undefined,
        });
      }

      setParsedSegments(segments);
      setIntelligence(intelData);
      setExpandedSegments(new Set(segments.map((_, i) => i)));
      setStep('review');
    } catch (err) {
      console.error('Parse error:', err);
      setError(err instanceof Error ? err.message : 'Failed to parse confirmation');
    } finally {
      setIsParsing(false);
    }
  };

  const updateSegment = (index: number, field: keyof ParsedSegmentData, value: string | number) => {
    setParsedSegments(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const toggleSegment = (index: number) => {
    setExpandedSegments(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleConfirmImport = () => {
    if (parsedSegments.length === 0) return;

    const legs: ManualFlightEntry[] = parsedSegments.map(seg => ({
      airline: seg.airline || '',
      flightNumber: seg.flightNumber || '',
      departureAirport: seg.departureAirport || '',
      arrivalAirport: seg.arrivalAirport || '',
      departureTime: seg.departureTime || '',
      arrivalTime: seg.arrivalTime || '',
      departureDate: seg.departureDate || '',
      price: seg.price,
      classification: seg.classification,
      connectionGroup: seg.connectionGroup ?? undefined,
    }));

    // Pass intelligence data back
    if (onIntelligence && intelligence) {
      onIntelligence(intelligence);
    }

    // If consumer supports multi-leg, use that
    if (onImportLegs) {
      onImportLegs(legs);
    } else {
      // Legacy: pass first as outbound, last as return (if different)
      const outbound = legs[0];
      const returnFlight = legs.length >= 2 ? legs[legs.length - 1] : undefined;
      onImport(outbound, returnFlight);
    }
    
    handleClose();
  };

  const handleClose = () => {
    setConfirmationText('');
    setParsedSegments([]);
    setIntelligence(null);
    setError(null);
    setStep('paste');
    onOpenChange(false);
  };

  const buildRouteChain = () => {
    // Use intelligence route if available
    if (intelligence?.route?.display) {
      return intelligence.route.display;
    }
    if (parsedSegments.length === 0) return '';
    const codes = [parsedSegments[0].departureAirport || '?'];
    parsedSegments.forEach(seg => codes.push(seg.arrivalAirport || '?'));
    return codes.join(' → ');
  };

  // Group segments by connectionGroup
  const getConnectionGroupClass = (seg: ParsedSegmentData, idx: number) => {
    if (!seg.connectionGroup) return '';
    const nextSeg = parsedSegments[idx + 1];
    const prevSeg = idx > 0 ? parsedSegments[idx - 1] : null;
    const isFirst = !prevSeg || prevSeg.connectionGroup !== seg.connectionGroup;
    const isLast = !nextSeg || nextSeg.connectionGroup !== seg.connectionGroup;
    if (isFirst && isLast) return '';
    if (isFirst) return 'rounded-b-none border-b-0';
    if (isLast) return 'rounded-t-none border-t-dashed';
    return 'rounded-none border-t-dashed border-b-0';
  };

  // Find next destination city for layover segments
  const getNextDestinationCity = (idx: number) => {
    for (let i = idx + 1; i < parsedSegments.length; i++) {
      if (!parsedSegments[i].isLayoverArrival) {
        return parsedSegments[i].arrivalAirport || '?';
      }
    }
    return '?';
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plane className="h-5 w-5 text-primary" />
            Import Flight Details
          </DialogTitle>
          <DialogDescription>
            {step === 'paste' 
              ? 'Paste your airline confirmation email or booking details' 
              : `Review ${parsedSegments.length} flight segment${parsedSegments.length > 1 ? 's' : ''}`}
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
Arriving: Lisbon (LIS) at 10:15 AM +1

Multi-city bookings with multiple flights will all be extracted."
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
              <p>Our AI extracts <strong>all flight segments</strong> — multi-city, round-trip, and connections.</p>
            </div>
          </div>
        )}

        {step === 'review' && parsedSegments.length > 0 && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 rounded-lg p-2">
              <Check className="h-4 w-4" />
              <span>Extracted {parsedSegments.length} flight{parsedSegments.length > 1 ? 's' : ''}</span>
            </div>

            {/* Intelligent Route Display */}
            <div className="flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/5 rounded-lg px-3 py-2 overflow-x-auto">
              <Route className="h-3.5 w-3.5 shrink-0" />
              <span className="whitespace-nowrap">{buildRouteChain()}</span>
            </div>

            {/* Flight Analysis Card - Intelligence */}
            {intelligence && (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-3 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Flight Analysis
                  </div>

                  {/* Destination Schedule */}
                  {intelligence.destinationSchedule && intelligence.destinationSchedule.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Your Destinations</p>
                      {intelligence.destinationSchedule.map((dest, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs bg-background rounded-md p-2">
                          <MapPin className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="font-medium">{dest.city}</span>
                            {dest.airport && <span className="text-muted-foreground ml-1">({dest.airport})</span>}
                            <div className="flex items-center gap-2 text-muted-foreground mt-0.5">
                              {dest.fullDays != null && <span>{dest.fullDays} day{dest.fullDays !== 1 ? 's' : ''}</span>}
                              {dest.availableFrom && (
                                <span className="flex items-center gap-0.5">
                                  <Clock className="h-3 w-3" />
                                  from {dest.availableFrom.split('T')[1]?.slice(0, 5) || dest.availableFrom}
                                </span>
                              )}
                              {dest.availableUntil && (
                                <span>until {dest.availableUntil.split('T')[1]?.slice(0, 5) || dest.availableUntil}</span>
                              )}
                            </div>
                            {dest.notes && dest.notes.length > 0 && (
                              <p className="text-[10px] text-muted-foreground mt-0.5 italic">{dest.notes[0]}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Summary */}
                  {intelligence.summary && (
                    <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap font-mono bg-background rounded-md p-2 leading-relaxed">
                      {intelligence.summary}
                    </pre>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Missing Leg Warnings */}
            {intelligence?.missingLegs && intelligence.missingLegs.length > 0 && (
              <div className="space-y-2">
                {intelligence.missingLegs.map((leg, i) => (
                  <Alert key={i} className="border-amber-300 bg-amber-50 py-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-xs">
                      <p className="font-medium text-amber-800">
                        ⚠️ Missing flight: {leg.fromCity || leg.from} → {leg.toCity || leg.to}
                      </p>
                      {leg.reason && <p className="text-amber-700 mt-0.5">{leg.reason}</p>}
                      {leg.suggestedDateRange && (
                        <p className="text-amber-600 mt-0.5">
                          Suggested: Book between {leg.suggestedDateRange.earliest} – {leg.suggestedDateRange.latest}
                        </p>
                      )}
                      <Button variant="outline" size="sm" className="mt-1.5 h-6 text-[10px] border-amber-300 text-amber-700 hover:bg-amber-100">
                        Help me find this flight
                      </Button>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            )}

            {/* Segment Cards */}
            <div className="space-y-2">
              {parsedSegments.map((seg, idx) => (
                <Collapsible 
                  key={idx} 
                  open={expandedSegments.has(idx)} 
                  onOpenChange={() => toggleSegment(idx)}
                >
                  <CollapsibleTrigger asChild>
                    <button className={cn(
                      "w-full flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-left border",
                      getConnectionGroupClass(seg, idx)
                    )}>
                      <div className="flex items-center gap-2 text-sm flex-wrap">
                        <span className="text-xs font-medium text-muted-foreground w-5">#{idx + 1}</span>
                        <span className="font-medium">{seg.departureAirport || '?'}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">{seg.arrivalAirport || '?'}</span>
                        {seg.airline && (
                          <span className="text-xs text-muted-foreground">({seg.airline})</span>
                        )}
                        {/* Classification badge */}
                        {seg.classification && classificationLabels[seg.classification] && (
                          <Badge 
                            variant="outline" 
                            className={cn("text-[10px] px-1.5 py-0 h-4 border", classificationLabels[seg.classification].color)}
                          >
                            {classificationLabels[seg.classification].label}
                          </Badge>
                        )}
                      </div>
                      {expandedSegments.has(idx) ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className={cn(
                    "px-3 pb-3 space-y-3",
                    getConnectionGroupClass(seg, idx) && "border-x border-b rounded-b-lg"
                  )}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Airline</Label>
                        <Input
                          value={seg.airline || ''}
                          onChange={(e) => updateSegment(idx, 'airline', e.target.value)}
                          placeholder="Delta"
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Flight #</Label>
                        <Input
                          value={seg.flightNumber || ''}
                          onChange={(e) => updateSegment(idx, 'flightNumber', e.target.value)}
                          placeholder="DL456"
                          className="text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">From</Label>
                        <Input
                          value={seg.departureAirport || ''}
                          onChange={(e) => updateSegment(idx, 'departureAirport', e.target.value)}
                          placeholder="ATL"
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">To</Label>
                        <Input
                          value={seg.arrivalAirport || ''}
                          onChange={(e) => updateSegment(idx, 'arrivalAirport', e.target.value)}
                          placeholder="LIS"
                          className="text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Departure Date</Label>
                        <Input
                          type="date"
                          value={seg.departureDate || ''}
                          onChange={(e) => updateSegment(idx, 'departureDate', e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Departure Time</Label>
                        <Input
                          type="time"
                          value={seg.departureTime || ''}
                          onChange={(e) => updateSegment(idx, 'departureTime', e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Arrival Time</Label>
                        <Input
                          type="time"
                          value={seg.arrivalTime || ''}
                          onChange={(e) => updateSegment(idx, 'arrivalTime', e.target.value)}
                          className="text-sm"
                        />
                        {seg.isLayoverArrival ? (
                          <p className="text-[10px] text-amber-600 mt-0.5">
                            Connection — continues to {getNextDestinationCity(idx)}
                          </p>
                        ) : idx === 0 ? (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Used to plan Day 1
                          </p>
                        ) : null}
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Price ($)</Label>
                        <Input
                          type="number"
                          value={seg.price || ''}
                          onChange={(e) => updateSegment(idx, 'price', Number(e.target.value))}
                          placeholder="450"
                          className="text-sm"
                        />
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>

            {/* Does this look right? */}
            {intelligence && (
              <div className="text-center text-xs text-muted-foreground pt-1">
                Does this look right? You can edit any field above before importing.
              </div>
            )}
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
                Import {parsedSegments.length > 1 ? `${parsedSegments.length} Flights` : 'Flight'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
