/**
 * AddBookingInline Component
 * 
 * Inline UI for adding flight/hotel details to an itinerary.
 * Flights: Customers book their own flights elsewhere and add details here.
 * Hotels: Can browse & book through platform or manually enter details.
 * Supports multi-leg flights (multi-city, round-trip, one-way).
 */

import { useState, useEffect } from 'react';
import { BoardingPassUpload } from './BoardingPassUpload';
import { useNavigate } from 'react-router-dom';
import { Plane, Hotel, Plus, ArrowRight, Loader2, CalendarIcon, ChevronDown, ChevronUp, Upload, Sparkles, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { parseLocalDate } from '@/utils/dateUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { AirportAutocomplete } from '@/components/common/AirportAutocomplete';
import { enrichHotel } from '@/services/hotelAPI';
import { HotelAutocomplete } from '@/components/common/HotelAutocomplete';
import { syncHotelToLedger, syncFlightToLedger, syncMultiCityHotelsToLedger } from '@/services/budgetLedgerSync';
import { patchItineraryWithHotel, patchItineraryWithMultipleHotels } from '@/services/hotelItineraryPatch';
import { getTripCities } from '@/services/tripCitiesService';
import { patchItineraryWithFlight } from '@/services/flightItineraryPatch';
import { cn } from '@/lib/utils';
import { FlightImportModal } from './FlightImportModal';
import { FindMyHotelsDrawer } from './FindMyHotelsDrawer';
import { 
  type HotelBooking, 
  findOverlappingHotel, 
  isValidDateRange 
} from '@/utils/hotelValidation';

// Types for manual entry
export interface ManualFlightEntry {
  airline: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  departureTime: string;
  arrivalTime: string;
  departureDate: string;
  price?: number; // Optional price for budget tracking
  seatNumber?: string;
  confirmationCode?: string;
  cabinClass?: string;
  terminal?: string;
  gate?: string;
  baggageInfo?: string;
  boardingPassUrl?: string;
  frequentFlyerNumber?: string;
  classification?: 'OUTBOUND' | 'RETURN' | 'CONNECTION' | 'INTER_DESTINATION';
  connectionGroup?: number;
  /** User-marked: this leg arrives at the final destination */
  isDestinationArrival?: boolean;
  /** User-marked: this leg departs from the final destination (return) */
  isDestinationDeparture?: boolean;
}

export interface ManualHotelEntry {
  id?: string;
  name: string;
  address: string;
  neighborhood?: string;
  checkInDate?: string; // YYYY-MM-DD
  checkOutDate?: string; // YYYY-MM-DD
  checkInTime?: string;
  checkOutTime?: string;
  accommodationType?: import('@/utils/hotelValidation').AccommodationType;
  totalPrice?: number;
}

interface AddFlightInlineProps {
  tripId: string;
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  origin?: string;
  onFlightAdded?: () => void;
  // Edit mode props
  editMode?: boolean;
  existingOutbound?: ManualFlightEntry;
  existingReturn?: ManualFlightEntry;
  /** All existing legs for multi-leg editing */
  existingLegs?: ManualFlightEntry[];
  /** Multi-city route for auto-generating leg slots: [{from: 'Atlanta', to: 'London'}, {from: 'London', to: 'Paris'}, {from: 'Paris', to: 'Atlanta'}] */
  multiCityRoute?: Array<{ from: string; to: string; date?: string }>;
}

interface AddHotelInlineProps {
  tripId: string;
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  onHotelAdded?: () => void;
  // Edit mode props
  editMode?: boolean;
  existingHotel?: ManualHotelEntry;
  // Multi-hotel support
  existingHotels?: import('@/utils/hotelValidation').HotelBooking[];
  // Multi-city: when set, hotel is saved to trip_cities instead of trips
  cityId?: string;
}

// ============================================================================
// ADD FLIGHT INLINE COMPONENT
// ============================================================================

export function AddFlightInline({ 
  tripId, 
  destination, 
  startDate, 
  endDate, 
  travelers,
  origin,
  onFlightAdded,
  editMode = false,
  existingOutbound,
  existingReturn,
  existingLegs,
  multiCityRoute,
}: AddFlightInlineProps) {
  const navigate = useNavigate();
  const [showManualEntry, setShowManualEntry] = useState(editMode);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Build initial legs from existing data
  const buildInitialLegs = (): ManualFlightEntry[] => {
    // Priority 1: explicit existingLegs
    if (existingLegs && existingLegs.length > 0) return existingLegs;

    // Priority 2: legacy outbound/return
    const legs: ManualFlightEntry[] = [];
    if (existingOutbound) legs.push(existingOutbound);
    if (existingReturn) legs.push(existingReturn);
    if (legs.length > 0) return legs;

    // Priority 3: auto-generate from multi-city route
    if (multiCityRoute && multiCityRoute.length > 0) {
      return multiCityRoute.map((r, i) => ({
        airline: '',
        flightNumber: '',
        departureAirport: '',
        arrivalAirport: '',
        departureTime: '',
        arrivalTime: '',
        departureDate: r.date || (i === 0 ? startDate : ''),
        seatNumber: '',
        confirmationCode: '',
        cabinClass: '',
        terminal: '',
        gate: '',
        baggageInfo: '',
      }));
    }

    // Default: single outbound leg
    return [{
      airline: '',
      flightNumber: '',
      departureAirport: origin || '',
      arrivalAirport: '',
      departureTime: '',
      arrivalTime: '',
      departureDate: startDate,
      seatNumber: '',
      confirmationCode: '',
      cabinClass: '',
      terminal: '',
      gate: '',
      baggageInfo: '',
    }];
  };

  const [legs, setLegs] = useState<ManualFlightEntry[]>(buildInitialLegs);
  const [expandedLeg, setExpandedLeg] = useState<number | null>(null);
  const [arrivalTimeError, setArrivalTimeError] = useState(false);

  // Reset state when key props change (e.g., switching trips)
  useEffect(() => {
    setLegs(buildInitialLegs());
    setExpandedLeg(null);
    setShowManualEntry(editMode);
  }, [
    tripId,
    origin,
    editMode,
    JSON.stringify(existingLegs),
    JSON.stringify(multiCityRoute),
    existingOutbound?.departureAirport,
    existingReturn?.departureAirport,
  ]);

  const updateLeg = (index: number, patch: Partial<ManualFlightEntry>) => {
    setLegs(prev => prev.map((leg, i) => i === index ? { ...leg, ...patch } : leg));
  };

  const addLeg = () => {
    const lastLeg = legs[legs.length - 1];
    setLegs(prev => [...prev, {
      airline: '',
      flightNumber: '',
      departureAirport: lastLeg?.arrivalAirport || '',
      arrivalAirport: '',
      departureTime: '',
      arrivalTime: '',
      departureDate: '',
      seatNumber: '',
      confirmationCode: '',
      cabinClass: '',
      terminal: '',
      gate: '',
      baggageInfo: '',
    }]);
    setExpandedLeg(legs.length);
  };

  const removeLeg = (index: number) => {
    if (legs.length <= 1) return;
    setLegs(prev => prev.filter((_, i) => i !== index));
    if (expandedLeg === index) setExpandedLeg(null);
  };

  const handleSave = async () => {
    // Find which leg has the destination arrival (user-marked or first leg)
    const destinationLeg = legs.find(l => l.isDestinationArrival) || legs[0];
    if (!destinationLeg?.arrivalTime) {
      setArrivalTimeError(true);
      toast.error('Please enter your arrival time at the destination so we can plan Day 1');
      return;
    }
    setArrivalTimeError(false);
    setIsSaving(true);

    try {
      const legObjs = legs.map((leg, i) => ({
        legOrder: i + 1,
        airline: leg.airline || 'Unknown',
        flightNumber: leg.flightNumber || '',
        departure: {
          airport: leg.departureAirport,
          time: leg.departureTime,
          date: leg.departureDate,
        },
        arrival: {
          airport: leg.arrivalAirport,
          time: leg.arrivalTime,
        },
        price: leg.price || 0,
        cabin: leg.cabinClass || 'economy',
        seatNumber: leg.seatNumber || undefined,
        confirmationCode: leg.confirmationCode || undefined,
        terminal: leg.terminal || undefined,
        gate: leg.gate || undefined,
        baggageInfo: leg.baggageInfo || undefined,
        boardingPassUrl: leg.boardingPassUrl || undefined,
        frequentFlyerNumber: leg.frequentFlyerNumber || undefined,
        isDestinationArrival: leg.isDestinationArrival || undefined,
        isDestinationDeparture: leg.isDestinationDeparture || undefined,
      }));

      // Find the destination arrival leg for backward-compat "departure" (outbound) field
      const destArrivalLeg = legObjs.find(l => l.isDestinationArrival) || legObjs[0];
      
      const flightSelection: Record<string, unknown> = {
        legs: legObjs,
        isManualEntry: true,
        // Backward compat — "departure" means the outbound/destination-arrival leg
        departure: {
          airline: destArrivalLeg.airline,
          flightNumber: destArrivalLeg.flightNumber,
          departure: destArrivalLeg.departure,
          arrival: destArrivalLeg.arrival,
          price: destArrivalLeg.price,
          cabin: destArrivalLeg.cabin,
        },
      };

      if (legObjs.length >= 2) {
        const last = legObjs[legObjs.length - 1];
        flightSelection.return = {
          airline: last.airline,
          flightNumber: last.flightNumber,
          departure: last.departure,
          arrival: last.arrival,
          price: last.price,
          cabin: last.cabin,
        };
      }

      const { error } = await supabase
        .from('trips')
        .update({ flight_selection: flightSelection as any })
        .eq('id', tripId);

      if (error) throw error;

      toast.success(legObjs.length > 1 ? `${legObjs.length} flight legs saved!` : 'Flight details saved!');
      setShowManualEntry(false);
      onFlightAdded?.();

      // Sync flight price to budget ledger
      try {
        await syncFlightToLedger(tripId, flightSelection as any);
      } catch (ledgerErr) {
        console.warn('[AddBookingInline] Flight budget sync skipped:', ledgerErr);
      }

      // Patch Day 1/last day activities with flight arrival/departure times
      try {
        await patchItineraryWithFlight(tripId, flightSelection);
      } catch (patchErr) {
        console.warn('[AddBookingInline] Flight itinerary patch skipped:', patchErr);
      }

      // Cascade transport changes to itinerary
      try {
        const { runCascadeAndPersist } = await import('@/services/cascadeTransportToItinerary');
        const { data: tripData } = await supabase
          .from('trips')
          .select('itinerary_data, is_multi_city')
          .eq('id', tripId)
          .single();
        const itDays = (tripData?.itinerary_data as any)?.days;
        if (itDays?.length) {
          if (tripData?.is_multi_city) {
            const { getTripCities } = await import('@/services/tripCitiesService');
            const cities = await getTripCities(tripId);
            await runCascadeAndPersist(tripId, itDays, flightSelection, cities);
          } else {
            await runCascadeAndPersist(tripId, itDays, flightSelection);
          }
        }
      } catch (cascadeErr) {
        console.warn('[cascade] Flight cascade skipped:', cascadeErr);
      }

      // Dispatch booking-changed event for financial snapshot refresh
      window.dispatchEvent(new CustomEvent('booking-changed', { detail: { tripId } }));
    } catch (err) {
      console.error('Failed to save flight:', err);
      toast.error('Failed to save flight details');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle import from modal (legacy: outbound + return)
  const handleImportFlight = (outbound: ManualFlightEntry, returnFlightData?: ManualFlightEntry) => {
    const imported = [outbound];
    if (returnFlightData) imported.push(returnFlightData);
    setLegs(imported);
    setShowManualEntry(true);
  };

  // Handle multi-leg import
  const handleImportLegs = async (importedLegs: ManualFlightEntry[]) => {
    if (importedLegs.length === 0) return;
    setLegs(importedLegs);
    setShowManualEntry(true);
  };

  // Route label for a leg
  const legLabel = (index: number): string => {
    if (multiCityRoute && multiCityRoute[index]) {
      return `${multiCityRoute[index].from} → ${multiCityRoute[index].to}`;
    }
    if (index === 0) return 'Outbound';
    if (index === legs.length - 1 && legs.length > 1) return 'Return';
    return `Leg ${index + 1}`;
  };

  return (
    <>
      <Button 
        onClick={() => setShowManualEntry(true)} 
        data-add-flight-trigger
        className="hidden"
      >
        Add Flight
      </Button>
      
      {/* Visible trigger for inline use */}
      <Button onClick={() => setShowManualEntry(true)}>
        <Plus className="h-4 w-4 mr-2" />
        Add Flight Details
      </Button>

      {/* Import Modal */}
      <FlightImportModal
        open={showImportModal}
        onOpenChange={setShowImportModal}
        onImport={handleImportFlight}
        onImportLegs={handleImportLegs}
        tripStartDate={startDate}
        tripEndDate={endDate}
      />

      {/* Multi-leg Entry Dialog */}
      <Dialog open={showManualEntry} onOpenChange={setShowManualEntry}>
        <DialogContent className="max-w-[480px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plane className="h-5 w-5 text-primary" />
              {legs.length > 1 ? `Flight Legs (${legs.length})` : 'Add Your Flight Times'}
            </DialogTitle>
            <DialogDescription>
              {legs.length > 1
                ? 'Enter details for each flight leg'
                : "We'll use this to plan activities around your arrival"}
            </DialogDescription>
          </DialogHeader>

          {/* Import option */}
          <div className="flex items-center justify-center gap-3 py-2 border-b">
            <Button 
              variant="outline" 
              size="sm" 
              className="text-xs"
              onClick={() => {
                setShowManualEntry(false);
                setShowImportModal(true);
              }}
            >
              <Upload className="h-3 w-3 mr-1.5" />
              Paste from airline confirmation
            </Button>
          </div>

          <div className="space-y-3 py-2">
            {legs.length > 1 && (
              <div className="bg-muted/30 rounded-lg px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>Mark which flight lands at your <span className="font-medium text-foreground">final destination</span>. We'll use that to plan Day 1.</span>
              </div>
            )}
            {legs.map((leg, idx) => (
              <div key={idx} className={cn(
                "border rounded-lg overflow-hidden",
                leg.isDestinationArrival && "border-primary/50 ring-1 ring-primary/20"
              )}>
                {/* Leg header */}
                <button
                  type="button"
                  onClick={() => setExpandedLeg(expandedLeg === idx ? null : idx)}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                      leg.isDestinationArrival ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
                    )}>
                      {idx + 1}
                    </div>
                    <span className="text-sm font-medium">{legLabel(idx)}</span>
                    {leg.departureAirport && leg.arrivalAirport && (
                      <span className="text-xs text-muted-foreground">
                        {leg.departureAirport} → {leg.arrivalAirport}
                      </span>
                    )}
                    {leg.isDestinationArrival && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-primary/10 text-primary border-0">
                        Destination
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {legs.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); removeLeg(idx); }}
                      >
                        ×
                      </Button>
                    )}
                    {expandedLeg === idx ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                  </div>
                </button>

                {/* Leg fields - always show route + arrival time, expand for more */}
                {(expandedLeg === idx || legs.length === 1) && (
                  <div className="p-3 space-y-3">
                    {/* Route */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">From</Label>
                        <AirportAutocomplete
                          value={leg.departureAirport}
                          onChange={(code) => updateLeg(idx, { departureAirport: code })}
                          placeholder="ATL"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">To</Label>
                        <AirportAutocomplete
                          value={leg.arrivalAirport}
                          onChange={(code) => updateLeg(idx, { arrivalAirport: code })}
                          placeholder="LHR"
                        />
                      </div>
                    </div>

                    {/* Date + Arrival Time */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Departure Date</Label>
                        <Input
                          type="date"
                          value={leg.departureDate}
                          onChange={(e) => updateLeg(idx, { departureDate: e.target.value })}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Arrival Time {(leg.isDestinationArrival || (legs.length === 1)) && '*'}
                        </Label>
                        <Input
                          type="time"
                          value={leg.arrivalTime}
                          onChange={(e) => {
                            updateLeg(idx, { arrivalTime: e.target.value });
                            if ((leg.isDestinationArrival || idx === 0) && e.target.value) setArrivalTimeError(false);
                          }}
                          className={cn("text-sm", (leg.isDestinationArrival || (legs.length === 1 && idx === 0)) && arrivalTimeError && "border-destructive ring-1 ring-destructive")}
                        />
                        {(leg.isDestinationArrival || legs.length === 1) && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Plans Day 1 activities
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Destination arrival marker - only show for multi-leg trips */}
                    {legs.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          // Toggle: set this leg as destination arrival, clear others
                          setLegs(prev => prev.map((l, i) => ({
                            ...l,
                            isDestinationArrival: i === idx ? !l.isDestinationArrival : false,
                          })));
                        }}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs transition-colors",
                          leg.isDestinationArrival
                            ? "bg-primary/10 text-primary font-medium"
                            : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                        )}
                      >
                        <MapPin className={cn("h-3.5 w-3.5", leg.isDestinationArrival && "text-primary")} />
                        {leg.isDestinationArrival ? 'This is my destination arrival' : 'Mark as destination arrival'}
                      </button>
                    )}

                    {/* Destination departure marker - only show for multi-leg trips */}
                    {legs.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          // Toggle: set this leg as destination departure, clear others
                          setLegs(prev => prev.map((l, i) => ({
                            ...l,
                            isDestinationDeparture: i === idx ? !l.isDestinationDeparture : false,
                          })));
                        }}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs transition-colors",
                          leg.isDestinationDeparture
                            ? "bg-accent/10 text-accent font-medium"
                            : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                        )}
                      >
                        <Plane className={cn("h-3.5 w-3.5", leg.isDestinationDeparture && "text-accent")} />
                        {leg.isDestinationDeparture ? 'This is my destination departure' : 'Mark as destination departure'}
                      </button>
                    )}

                    {/* More details */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Airline</Label>
                        <Input
                          placeholder="e.g. Delta"
                          value={leg.airline}
                          onChange={(e) => updateLeg(idx, { airline: e.target.value })}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Flight #</Label>
                        <Input
                          placeholder="e.g. DL123"
                          value={leg.flightNumber}
                          onChange={(e) => updateLeg(idx, { flightNumber: e.target.value })}
                          className="text-sm"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Departure Time</Label>
                        <Input
                          type="time"
                          value={leg.departureTime}
                          onChange={(e) => updateLeg(idx, { departureTime: e.target.value })}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Price ($)</Label>
                        <Input
                          type="number"
                          placeholder="450"
                          value={leg.price || ''}
                          onChange={(e) => updateLeg(idx, { price: e.target.value ? Number(e.target.value) : undefined })}
                          className="text-sm"
                        />
                      </div>
                    </div>

                    {/* Traveler details section */}
                    <div className="pt-2 border-t border-border/50">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Traveler Details</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">Confirmation Code</Label>
                          <Input
                            placeholder="e.g. ABCDEF"
                            value={leg.confirmationCode || ''}
                            onChange={(e) => updateLeg(idx, { confirmationCode: e.target.value.toUpperCase() })}
                            className="text-sm font-mono"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Seat</Label>
                          <Input
                            placeholder="e.g. 12A"
                            value={leg.seatNumber || ''}
                            onChange={(e) => updateLeg(idx, { seatNumber: e.target.value.toUpperCase() })}
                            className="text-sm font-mono"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">Class</Label>
                          <select
                            value={leg.cabinClass || ''}
                            onChange={(e) => updateLeg(idx, { cabinClass: e.target.value })}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <option value="">Select class</option>
                            <option value="Economy">Economy</option>
                            <option value="Premium Economy">Premium Economy</option>
                            <option value="Business">Business</option>
                            <option value="First">First</option>
                          </select>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Baggage</Label>
                          <Input
                            placeholder="e.g. 1 checked bag"
                            value={leg.baggageInfo || ''}
                            onChange={(e) => updateLeg(idx, { baggageInfo: e.target.value })}
                            className="text-sm"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">Terminal</Label>
                          <Input
                            placeholder="e.g. Terminal B"
                            value={leg.terminal || ''}
                            onChange={(e) => updateLeg(idx, { terminal: e.target.value })}
                            className="text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Gate</Label>
                          <Input
                            placeholder="e.g. B42"
                            value={leg.gate || ''}
                            onChange={(e) => updateLeg(idx, { gate: e.target.value })}
                            className="text-sm"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">Frequent Flyer #</Label>
                          <Input
                            placeholder="e.g. FF123456789"
                            value={leg.frequentFlyerNumber || ''}
                            onChange={(e) => updateLeg(idx, { frequentFlyerNumber: e.target.value.toUpperCase() })}
                            className="text-sm font-mono"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Boarding Pass</Label>
                          <BoardingPassUpload
                            tripId={tripId}
                            legIndex={idx}
                            currentUrl={leg.boardingPassUrl}
                            onUploaded={(url) => updateLeg(idx, { boardingPassUrl: url })}
                            onRemoved={() => updateLeg(idx, { boardingPassUrl: undefined })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Add another leg */}
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={addLeg}
            >
              <Plus className="h-3 w-3 mr-1.5" />
              Add another flight leg
            </Button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManualEntry(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : legs.length > 1 ? `Save ${legs.length} Legs` : 'Save Flight'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================================
// ADD HOTEL INLINE COMPONENT
// ============================================================================

export function AddHotelInline({ 
  tripId, 
  destination, 
  startDate, 
  endDate, 
  travelers,
  onHotelAdded,
  editMode = false,
  existingHotel,
  existingHotels = [],
  cityId,
}: AddHotelInlineProps) {
  const navigate = useNavigate();
  const [showManualEntry, setShowManualEntry] = useState(editMode);
  const [isSaving, setIsSaving] = useState(false);
  
  // Parse trip dates for calendar bounds
  const tripStartDate = parseLocalDate(startDate);
  const tripEndDate = parseLocalDate(endDate);
  
  const [hotelData, setHotelData] = useState<ManualHotelEntry>(() => {
    if (existingHotel) return existingHotel;
    return {
      name: '',
      address: '',
      neighborhood: '',
      checkInDate: startDate,
      checkOutDate: endDate,
      checkInTime: '15:00',
      checkOutTime: '11:00',
      accommodationType: 'hotel',
    };
  });

  const accomType = hotelData.accommodationType || 'hotel';
  const accomLabel = accomType === 'airbnb' ? 'Airbnb' : accomType === 'rental' ? 'Rental' : accomType === 'hostel' ? 'Hostel' : 'Hotel';
  
  // Date picker state
  const [checkInDate, setCheckInDate] = useState<Date | undefined>(
    hotelData.checkInDate ? parseLocalDate(hotelData.checkInDate) : tripStartDate
  );
  const [checkOutDate, setCheckOutDate] = useState<Date | undefined>(
    hotelData.checkOutDate ? parseLocalDate(hotelData.checkOutDate) : tripEndDate
  );

  // Removed: handleBrowseHotels — replaced by FindMyHotelsDrawer

  const handleSaveManualHotel = async () => {
    if (!hotelData.name) {
      toast.error(`Please enter the ${accomLabel.toLowerCase()} name`);
      return;
    }
    
    if (!checkInDate || !checkOutDate) {
      toast.error('Please select check-in and check-out dates');
      return;
    }
    
    const checkInStr = format(checkInDate, 'yyyy-MM-dd');
    const checkOutStr = format(checkOutDate, 'yyyy-MM-dd');
    
    // Validate date range
    if (!isValidDateRange(checkInStr, checkOutStr)) {
      toast.error('Check-out date must be after check-in date');
      return;
    }
    
    // Check for overlapping hotels
    const overlapping = findOverlappingHotel(
      checkInStr, 
      checkOutStr, 
      existingHotels,
      existingHotel?.id // Exclude current hotel if editing
    );
    
    if (overlapping) {
      toast.error(`Dates overlap with "${overlapping.name}" (${format(parseLocalDate(overlapping.checkInDate), 'MMM d')} - ${format(parseLocalDate(overlapping.checkOutDate), 'MMM d')})`);
      return;
    }

    setIsSaving(true);
    try {
      // Try to enrich with real data (address, photos, etc.)
      // For Airbnb/rentals, enrichment may not find a match — that's OK, the address is used directly
      const isHotelType = accomType === 'hotel' || accomType === 'hostel';
      toast.info(isHotelType ? `Looking up ${accomLabel.toLowerCase()} details...` : 'Saving stay details...', { id: 'hotel-enrich' });
      
      // Normalize destination (remove IATA codes)
      const cleanDestination = destination
        .replace(/\s*\([A-Z]{3}\)\s*$/i, '')
        .trim();
      
      // Only try enrichment for hotels/hostels (not Airbnb/rentals)
      const enrichment = isHotelType ? await enrichHotel(hotelData.name, cleanDestination) : null;
      
      const newHotel: HotelBooking = {
        id: existingHotel?.id || `manual-${Date.now()}`,
        name: hotelData.name,
        address: enrichment?.address || hotelData.address,
        neighborhood: hotelData.neighborhood || hotelData.address,
        checkInDate: checkInStr,
        checkOutDate: checkOutStr,
        checkInTime: hotelData.checkInTime,
        checkOutTime: hotelData.checkOutTime,
        website: enrichment?.website,
        googleMapsUrl: enrichment?.googleMapsUrl,
        images: enrichment?.photos,
        imageUrl: enrichment?.photos?.[0],
        placeId: enrichment?.placeId,
        isManualEntry: true,
        isEnriched: !!enrichment,
        accommodationType: hotelData.accommodationType || 'hotel',
        totalPrice: hotelData.totalPrice || undefined,
      };
      
      // Build updated hotels array
      let updatedHotels: HotelBooking[];
      if (existingHotel?.id) {
        // Editing existing - replace it
        updatedHotels = existingHotels.map(h => 
          h.id === existingHotel.id ? newHotel : h
        );
      } else {
        // Adding new hotel
        updatedHotels = [...existingHotels, newHotel];
      }
      
      // Sort by check-in date
      updatedHotels.sort((a, b) => 
        parseLocalDate(a.checkInDate).getTime() - parseLocalDate(b.checkInDate).getTime()
      );

      // Aggregate total hotel cost across ALL hotels in this city
      const aggregatedCostCents = updatedHotels.reduce((sum, h) => {
        const hAny = h as any;
        const ppn = hAny.pricePerNight || 0;
        const tp = hAny.totalPrice || 0;
        if (tp > 0) return sum + Math.round(tp * 100);
        if (ppn > 0) {
          const ci = hAny.checkInDate || hAny.checkIn;
          const co = hAny.checkOutDate || hAny.checkOut;
          let n = 1;
          if (ci && co) {
            const diff = new Date(co).getTime() - new Date(ci).getTime();
            if (diff > 0) n = Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
          }
          return sum + Math.round(ppn * n * 100);
        }
        return sum;
      }, 0);

      if (cityId) {
        // Multi-city: save to trip_cities table
        const { error } = await supabase
          .from('trip_cities')
          .update({
            hotel_selection: JSON.parse(JSON.stringify(updatedHotels)),
            hotel_cost_cents: aggregatedCostCents,
          } as any)
          .eq('id', cityId);
        if (error) throw error;

        // Sync all city hotels to budget ledger
        const hotelsForSync = updatedHotels
          .filter((h: any) => (h.totalPrice || h.pricePerNight) && h.name)
          .map((h: any) => {
            let total = h.totalPrice || 0;
            if (!total && h.pricePerNight) {
              const ci = h.checkInDate || h.checkIn;
              const co = h.checkOutDate || h.checkOut;
              let n = 1;
              if (ci && co) {
                const diff = new Date(co).getTime() - new Date(ci).getTime();
                if (diff > 0) n = Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
              }
              total = h.pricePerNight * n;
            }
            return { name: h.name, totalPrice: total };
          });
        if (hotelsForSync.length > 0) {
          await syncMultiCityHotelsToLedger(tripId, hotelsForSync);
        }
      } else {
        // Single-city: save to trips table (existing behavior)
        const { error } = await supabase
          .from('trips')
          .update({ hotel_selection: JSON.parse(JSON.stringify(updatedHotels)) })
          .eq('id', tripId);
        if (error) throw error;

        // Sync hotel price to budget ledger if price was entered
        if (newHotel.totalPrice && newHotel.totalPrice > 0) {
          await syncHotelToLedger(tripId, {
            name: newHotel.name,
            totalPrice: newHotel.totalPrice,
            checkIn: newHotel.checkInDate,
            checkOut: newHotel.checkOutDate,
          });
        }
      }

      // Cascade hotel info into itinerary accommodation activities
      if (cityId) {
        // Multi-city: fetch all city hotels and use date-aware multi-hotel patcher
        getTripCities(tripId).then(cities => {
          const allHotels = cities
            .filter(c => c.hotel_selection)
            .flatMap(c => {
              const sel = c.hotel_selection as any;
              const arr = Array.isArray(sel) ? sel : [sel];
              return arr.filter((h: any) => h?.name).map((h: any) => ({
                name: h.name,
                address: h.address,
                checkInDate: c.arrival_date || h.checkInDate || h.checkIn,
                checkOutDate: c.departure_date || h.checkOutDate || h.checkOut,
              }));
            });
          if (allHotels.length > 1) {
            return patchItineraryWithMultipleHotels(tripId, allHotels);
          } else if (allHotels.length === 1) {
            return patchItineraryWithHotel(tripId, allHotels[0]);
          }
        }).catch(err => console.error('[AddHotel] Multi-hotel itinerary patch failed:', err));
      } else {
        // Single-city: patch with just this hotel
        patchItineraryWithHotel(tripId, {
          name: newHotel.name,
          address: newHotel.address,
          checkInDate: newHotel.checkInDate,
          checkOutDate: newHotel.checkOutDate,
        }).catch(err => console.error('[AddHotel] Itinerary patch failed:', err));
      }

      // Dispatch booking-changed event for financial snapshot refresh
      window.dispatchEvent(new CustomEvent('booking-changed', { detail: { tripId } }));

      toast.dismiss('hotel-enrich');
      toast.success(enrichment ? `${accomLabel} found and details updated!` : `${accomLabel} details saved!`);
      setShowManualEntry(false);
      onHotelAdded?.();
    } catch (err) {
      console.error('Failed to save hotel:', err);
      toast.dismiss('hotel-enrich');
      toast.error('Failed to save hotel details');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="flex gap-2">
        <FindMyHotelsDrawer
          tripId={tripId}
          destination={destination}
          startDate={startDate}
          endDate={endDate}
          travelers={travelers}
          onHotelSelected={onHotelAdded}
          cityId={cityId}
        />
        <Button variant="outline" onClick={() => setShowManualEntry(true)}>
          {editMode ? 'Edit Details' : 'I Have a Hotel'}
        </Button>
      </div>

      {/* Manual Entry Dialog */}
      <Dialog open={showManualEntry} onOpenChange={setShowManualEntry}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hotel className="h-5 w-5 text-primary" />
              {editMode ? `Edit ${accomLabel} Details` : 'Add Accommodation'}
            </DialogTitle>
            <DialogDescription>
              {existingHotels.length > 0 
                ? `You have ${existingHotels.length} stay(s). Add another or edit dates to avoid overlap.`
                : 'Enter your stay details: hotel, Airbnb, vacation rental, or any address.'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Accommodation Type Selector */}
            <div>
              <Label className="text-xs mb-1.5 block">Type of Stay</Label>
              <div className="flex gap-2 flex-wrap">
                {([
                  { value: 'hotel', label: 'Hotel' },
                  { value: 'airbnb', label: 'Airbnb' },
                  { value: 'rental', label: 'Vacation Rental' },
                  { value: 'hostel', label: 'Hostel' },
                  { value: 'other', label: 'Other' },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setHotelData(prev => ({ ...prev, accommodationType: opt.value }))}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                      accomType === opt.value 
                        ? "bg-primary text-primary-foreground border-primary" 
                        : "bg-secondary text-muted-foreground border-border hover:border-primary/40"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>{accomLabel} Name *</Label>
              {(accomType === 'hotel' || accomType === 'hostel') ? (
                <HotelAutocomplete
                  value={hotelData.name}
                  onChange={(hotel) => setHotelData(prev => ({
                    ...prev,
                    name: hotel.name,
                    address: hotel.address || prev.address,
                  }))}
                  destination={destination}
                  placeholder={accomType === 'hostel' ? 'e.g. Generator Hostel' : 'e.g. The Ritz Paris'}
                />
              ) : (
                <Input
                  placeholder={accomType === 'airbnb' ? 'e.g. Cozy French Quarter Loft' : 'e.g. Beachfront Villa'}
                  value={hotelData.name}
                  onChange={(e) => setHotelData(prev => ({ ...prev, name: e.target.value }))}
                />
              )}
            </div>
            
            {/* Check-in / Check-out Date Pickers */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Check-in Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !checkInDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {checkInDate ? format(checkInDate, "MMM d, yyyy") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={checkInDate}
                      onSelect={(date) => {
                        setCheckInDate(date);
                        // Auto-adjust checkout if needed
                        if (date && checkOutDate && date >= checkOutDate) {
                          const nextDay = new Date(date);
                          nextDay.setDate(nextDay.getDate() + 1);
                          setCheckOutDate(nextDay);
                        }
                      }}
                      disabled={(date) => date < tripStartDate || date > tripEndDate}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="space-y-1.5">
                <Label className="text-xs">Check-out Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !checkOutDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {checkOutDate ? format(checkOutDate, "MMM d, yyyy") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={checkOutDate}
                      onSelect={setCheckOutDate}
                      disabled={(date) => 
                        date < (checkInDate || tripStartDate) || 
                        date > tripEndDate
                      }
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            
            <div>
              <Label>Address</Label>
              <Input
                placeholder={accomType === 'airbnb' ? 'e.g. 742 Bourbon St, New Orleans, LA' : 'e.g. 15 Place Vendôme, 75001 Paris'}
                value={hotelData.address}
                onChange={(e) => setHotelData(prev => ({ ...prev, address: e.target.value }))}
              />
            </div>
            
            <div>
              <Label>Neighborhood</Label>
              <Input
                placeholder="e.g. 1st Arrondissement"
                value={hotelData.neighborhood}
                onChange={(e) => setHotelData(prev => ({ ...prev, neighborhood: e.target.value }))}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Check-in Time</Label>
                <Input
                  type="time"
                  value={hotelData.checkInTime}
                  onChange={(e) => setHotelData(prev => ({ ...prev, checkInTime: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Check-out Time</Label>
                <Input
                  type="time"
                  value={hotelData.checkOutTime}
                  onChange={(e) => setHotelData(prev => ({ ...prev, checkOutTime: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Total Price (USD)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="pl-7"
                  value={hotelData.totalPrice || ''}
                  onChange={(e) => setHotelData(prev => ({ 
                    ...prev, 
                    totalPrice: e.target.value ? parseFloat(e.target.value) : undefined 
                  }))}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Optional. Syncs to your trip budget if enabled.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManualEntry(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveManualHotel} disabled={isSaving} className="gap-2">
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSaving ? `Finding ${accomLabel}...` : (editMode ? `Update ${accomLabel}` : `Add ${accomLabel}`)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
