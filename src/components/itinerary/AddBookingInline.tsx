/**
 * AddBookingInline Component
 * 
 * Inline UI for adding flight/hotel details to an itinerary.
 * Flights: Customers book their own flights elsewhere and add details here.
 * Hotels: Can browse & book through platform or manually enter details.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plane, Hotel, Plus, ArrowRight, Loader2, CalendarIcon, ChevronDown, ChevronUp } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { cn } from '@/lib/utils';
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
  existingReturn
}: AddFlightInlineProps) {
  const navigate = useNavigate();
  const [showManualEntry, setShowManualEntry] = useState(editMode);
  const [isSaving, setIsSaving] = useState(false);
  const [showMoreOutbound, setShowMoreOutbound] = useState(false);
  const [showReturnFlight, setShowReturnFlight] = useState(!!existingReturn?.airline);
  
  const [outboundFlight, setOutboundFlight] = useState<ManualFlightEntry>(
    existingOutbound || {
      airline: '',
      flightNumber: '',
      departureAirport: origin || '',
      arrivalAirport: '',
      departureTime: '',
      arrivalTime: '',
      departureDate: startDate,
      price: undefined,
    }
  );
  
  const [returnFlight, setReturnFlight] = useState<ManualFlightEntry>(
    existingReturn || {
      airline: '',
      flightNumber: '',
      departureAirport: '',
      arrivalAirport: origin || '',
      departureTime: '',
      arrivalTime: '',
      departureDate: endDate,
      price: undefined,
    }
  );

  // Removed: Browse & Book flights - we're a "bring your own flight" platform

  const handleSaveManualFlight = async () => {
    // Only require arrival time for itinerary planning
    if (!outboundFlight.arrivalTime) {
      toast.error('Please enter your arrival time so we can plan Day 1');
      return;
    }

    setIsSaving(true);
    try {
      const flightSelection = {
        departure: {
          airline: outboundFlight.airline || 'Unknown',
          flightNumber: outboundFlight.flightNumber || '',
          departure: {
            airport: outboundFlight.departureAirport,
            time: outboundFlight.departureTime,
            date: outboundFlight.departureDate,
          },
          arrival: {
            airport: outboundFlight.arrivalAirport,
            time: outboundFlight.arrivalTime,
          },
          price: outboundFlight.price || 0,
          cabin: 'economy',
        },
        return: (showReturnFlight && returnFlight.departureTime) ? {
          airline: returnFlight.airline || 'Unknown',
          flightNumber: returnFlight.flightNumber || '',
          departure: {
            airport: returnFlight.departureAirport,
            time: returnFlight.departureTime,
            date: returnFlight.departureDate,
          },
          arrival: {
            airport: returnFlight.arrivalAirport,
            time: returnFlight.arrivalTime,
          },
          price: returnFlight.price || 0,
          cabin: 'economy',
        } : undefined,
        isManualEntry: true,
      };

      const { error } = await supabase
        .from('trips')
        .update({ flight_selection: flightSelection })
        .eq('id', tripId);

      if (error) throw error;

      toast.success('Flight details saved!');
      setShowManualEntry(false);
      onFlightAdded?.();
    } catch (err) {
      console.error('Failed to save flight:', err);
      toast.error('Failed to save flight details');
    } finally {
      setIsSaving(false);
    }
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

      {/* Manual Entry Dialog - Simplified */}
      <Dialog open={showManualEntry} onOpenChange={setShowManualEntry}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plane className="h-5 w-5 text-primary" />
              Add Your Flight Times
            </DialogTitle>
            <DialogDescription>
              We'll use this to plan activities around your arrival
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            {/* Outbound Flight - Essential fields only */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  Outbound Flight
                </h4>
              </div>
              
              {/* Essential: Route */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">From</Label>
                  <AirportAutocomplete
                    value={outboundFlight.departureAirport}
                    onChange={(code) => setOutboundFlight(prev => ({ ...prev, departureAirport: code }))}
                    placeholder="ATL"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">To</Label>
                  <AirportAutocomplete
                    value={outboundFlight.arrivalAirport}
                    onChange={(code) => setOutboundFlight(prev => ({ ...prev, arrivalAirport: code }))}
                    placeholder="LIS"
                  />
                </div>
              </div>

              {/* Essential: Dates and Times */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Departure Date</Label>
                  <Input
                    type="date"
                    value={outboundFlight.departureDate}
                    onChange={(e) => setOutboundFlight(prev => ({ ...prev, departureDate: e.target.value }))}
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Arrival Time *</Label>
                  <Input
                    type="time"
                    value={outboundFlight.arrivalTime}
                    onChange={(e) => setOutboundFlight(prev => ({ ...prev, arrivalTime: e.target.value }))}
                    className="text-sm"
                    required
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Plans Day 1 activities
                  </p>
                </div>
              </div>

              {/* Optional: More details */}
              <Collapsible open={showMoreOutbound} onOpenChange={setShowMoreOutbound}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground w-full justify-start px-0">
                    {showMoreOutbound ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                    {showMoreOutbound ? 'Less details' : 'Add more details (optional)'}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Airline</Label>
                      <Input
                        placeholder="e.g. Delta"
                        value={outboundFlight.airline}
                        onChange={(e) => setOutboundFlight(prev => ({ ...prev, airline: e.target.value }))}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Flight #</Label>
                      <Input
                        placeholder="e.g. DL123"
                        value={outboundFlight.flightNumber}
                        onChange={(e) => setOutboundFlight(prev => ({ ...prev, flightNumber: e.target.value }))}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Departure Time</Label>
                      <Input
                        type="time"
                        value={outboundFlight.departureTime}
                        onChange={(e) => setOutboundFlight(prev => ({ ...prev, departureTime: e.target.value }))}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Price ($)</Label>
                      <Input
                        type="number"
                        placeholder="450"
                        value={outboundFlight.price || ''}
                        onChange={(e) => setOutboundFlight(prev => ({ ...prev, price: e.target.value ? Number(e.target.value) : undefined }))}
                        className="text-sm"
                      />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            {/* Return Flight - Collapsed by default */}
            <div className="border-t pt-4">
              <Collapsible open={showReturnFlight} onOpenChange={setShowReturnFlight}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground w-full justify-start px-0">
                    {showReturnFlight ? <ChevronUp className="h-4 w-4 mr-2" /> : <ChevronDown className="h-4 w-4 mr-2" />}
                    <ArrowRight className="h-4 w-4 rotate-180 mr-2" />
                    {showReturnFlight ? 'Return Flight' : 'Add return flight (optional)'}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Departure Date</Label>
                      <Input
                        type="date"
                        value={returnFlight.departureDate}
                        onChange={(e) => setReturnFlight(prev => ({ ...prev, departureDate: e.target.value }))}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Departure Time</Label>
                      <Input
                        type="time"
                        value={returnFlight.departureTime}
                        onChange={(e) => setReturnFlight(prev => ({ ...prev, departureTime: e.target.value }))}
                        className="text-sm"
                      />
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Plans last day activities
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Airline</Label>
                      <Input
                        placeholder="e.g. Delta"
                        value={returnFlight.airline}
                        onChange={(e) => setReturnFlight(prev => ({ ...prev, airline: e.target.value }))}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Price ($)</Label>
                      <Input
                        type="number"
                        placeholder="450"
                        value={returnFlight.price || ''}
                        onChange={(e) => setReturnFlight(prev => ({ ...prev, price: e.target.value ? Number(e.target.value) : undefined }))}
                        className="text-sm"
                      />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManualEntry(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveManualFlight} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Flight'}
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
  existingHotels = []
}: AddHotelInlineProps) {
  const navigate = useNavigate();
  const [showManualEntry, setShowManualEntry] = useState(editMode);
  const [isSaving, setIsSaving] = useState(false);
  
  // Parse trip dates for calendar bounds
  const tripStartDate = parseISO(startDate);
  const tripEndDate = parseISO(endDate);
  
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
    };
  });
  
  // Date picker state
  const [checkInDate, setCheckInDate] = useState<Date | undefined>(
    hotelData.checkInDate ? parseISO(hotelData.checkInDate) : tripStartDate
  );
  const [checkOutDate, setCheckOutDate] = useState<Date | undefined>(
    hotelData.checkOutDate ? parseISO(hotelData.checkOutDate) : tripEndDate
  );

  const handleBrowseHotels = () => {
    const params = new URLSearchParams({
      tripId,
      destination,
      startDate,
      endDate,
      travelers: String(travelers),
    });
    navigate(`/planner/hotel?${params.toString()}`);
  };

  const handleSaveManualHotel = async () => {
    if (!hotelData.name) {
      toast.error('Please enter the hotel name');
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
      toast.error(`Dates overlap with "${overlapping.name}" (${format(parseISO(overlapping.checkInDate), 'MMM d')} - ${format(parseISO(overlapping.checkOutDate), 'MMM d')})`);
      return;
    }

    setIsSaving(true);
    try {
      // Try to enrich the hotel with real data (address, photos, etc.)
      toast.info('Looking up hotel details...', { id: 'hotel-enrich' });
      
      // Normalize destination (remove IATA codes)
      const cleanDestination = destination
        .replace(/\s*\([A-Z]{3}\)\s*$/i, '')
        .trim();
      
      const enrichment = await enrichHotel(hotelData.name, cleanDestination);
      
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
        parseISO(a.checkInDate).getTime() - parseISO(b.checkInDate).getTime()
      );

      const { error } = await supabase
        .from('trips')
        .update({ hotel_selection: JSON.parse(JSON.stringify(updatedHotels)) })
        .eq('id', tripId);

      if (error) throw error;

      toast.dismiss('hotel-enrich');
      toast.success(enrichment ? 'Hotel found and details updated!' : 'Hotel details saved!');
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
        <Button onClick={handleBrowseHotels}>
          <Plus className="h-4 w-4 mr-2" />
          Browse Hotels
        </Button>
        <Button variant="outline" onClick={() => setShowManualEntry(true)}>
          {editMode ? 'Edit Details' : 'Enter Details'}
        </Button>
      </div>

      {/* Manual Entry Dialog */}
      <Dialog open={showManualEntry} onOpenChange={setShowManualEntry}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hotel className="h-5 w-5 text-primary" />
              {editMode ? 'Edit Hotel Details' : 'Add Hotel'}
            </DialogTitle>
            <DialogDescription>
              {existingHotels.length > 0 
                ? `You have ${existingHotels.length} hotel(s). Add another or edit dates to avoid overlap.`
                : 'Enter your hotel details and stay dates.'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Hotel Name *</Label>
              <Input
                placeholder="e.g. The Ritz Paris"
                value={hotelData.name}
                onChange={(e) => setHotelData(prev => ({ ...prev, name: e.target.value }))}
              />
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
                placeholder="e.g. 15 Place Vendôme, 75001 Paris"
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManualEntry(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveManualHotel} disabled={isSaving} className="gap-2">
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSaving ? 'Finding Hotel...' : (editMode ? 'Update Hotel' : 'Add Hotel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
