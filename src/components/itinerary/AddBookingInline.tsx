/**
 * AddBookingInline Component
 * 
 * Inline UI for adding flight/hotel details when they were skipped during planning.
 * Provides options to either browse & book through the platform or manually enter details.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plane, Hotel, Plus, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// Types for manual entry
export interface ManualFlightEntry {
  airline: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  departureTime: string;
  arrivalTime: string;
  departureDate: string;
}

export interface ManualHotelEntry {
  name: string;
  address: string;
  neighborhood?: string;
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
}

interface AddHotelInlineProps {
  tripId: string;
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  onHotelAdded?: () => void;
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
  onFlightAdded 
}: AddFlightInlineProps) {
  const navigate = useNavigate();
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [outboundFlight, setOutboundFlight] = useState<ManualFlightEntry>({
    airline: '',
    flightNumber: '',
    departureAirport: origin || '',
    arrivalAirport: '',
    departureTime: '',
    arrivalTime: '',
    departureDate: startDate,
  });
  
  const [returnFlight, setReturnFlight] = useState<ManualFlightEntry>({
    airline: '',
    flightNumber: '',
    departureAirport: '',
    arrivalAirport: origin || '',
    departureTime: '',
    arrivalTime: '',
    departureDate: endDate,
  });

  const handleBrowseFlights = () => {
    const params = new URLSearchParams({
      tripId,
      destination,
      startDate,
      endDate,
      travelers: String(travelers),
      ...(origin && { origin }),
    });
    navigate(`/planner/flight?${params.toString()}`);
  };

  const handleSaveManualFlight = async () => {
    if (!outboundFlight.airline || !outboundFlight.flightNumber) {
      toast.error('Please enter at least the outbound flight details');
      return;
    }

    setIsSaving(true);
    try {
      const flightSelection = {
        departure: {
          airline: outboundFlight.airline,
          flightNumber: outboundFlight.flightNumber,
          departure: {
            airport: outboundFlight.departureAirport,
            time: outboundFlight.departureTime,
            date: outboundFlight.departureDate,
          },
          arrival: {
            airport: outboundFlight.arrivalAirport,
            time: outboundFlight.arrivalTime,
          },
          price: 0, // Manual entry, no price
          cabin: 'economy',
        },
        return: returnFlight.airline ? {
          airline: returnFlight.airline,
          flightNumber: returnFlight.flightNumber,
          departure: {
            airport: returnFlight.departureAirport,
            time: returnFlight.departureTime,
            date: returnFlight.departureDate,
          },
          arrival: {
            airport: returnFlight.arrivalAirport,
            time: returnFlight.arrivalTime,
          },
          price: 0,
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
      <div className="space-y-4">
        <div className="text-center py-6">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Plane className="h-6 w-6 text-primary" />
          </div>
          <p className="text-muted-foreground mb-4">No flight added yet</p>
          
          <div className="flex flex-col gap-2">
            <Button onClick={handleBrowseFlights} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Browse & Book Flights
            </Button>
            <button
              onClick={() => setShowManualEntry(true)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
            >
              I already have a flight — enter details
            </button>
          </div>
        </div>
      </div>

      {/* Manual Entry Dialog */}
      <Dialog open={showManualEntry} onOpenChange={setShowManualEntry}>
        <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plane className="h-5 w-5 text-primary" />
              Enter Your Flight Details
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Outbound Flight */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <ArrowRight className="h-4 w-4" />
                Outbound Flight
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Airline</Label>
                  <Input
                    placeholder="e.g. Delta"
                    value={outboundFlight.airline}
                    onChange={(e) => setOutboundFlight(prev => ({ ...prev, airline: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Flight Number</Label>
                  <Input
                    placeholder="e.g. DL123"
                    value={outboundFlight.flightNumber}
                    onChange={(e) => setOutboundFlight(prev => ({ ...prev, flightNumber: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">From (Airport)</Label>
                  <Input
                    placeholder="e.g. JFK"
                    value={outboundFlight.departureAirport}
                    onChange={(e) => setOutboundFlight(prev => ({ ...prev, departureAirport: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">To (Airport)</Label>
                  <Input
                    placeholder="e.g. CDG"
                    value={outboundFlight.arrivalAirport}
                    onChange={(e) => setOutboundFlight(prev => ({ ...prev, arrivalAirport: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Departure Date</Label>
                  <Input
                    type="date"
                    value={outboundFlight.departureDate}
                    onChange={(e) => setOutboundFlight(prev => ({ ...prev, departureDate: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Departure Time</Label>
                  <Input
                    type="time"
                    value={outboundFlight.departureTime}
                    onChange={(e) => setOutboundFlight(prev => ({ ...prev, departureTime: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Return Flight */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm flex items-center gap-2 text-muted-foreground">
                <ArrowRight className="h-4 w-4 rotate-180" />
                Return Flight <span className="text-xs font-normal">(optional)</span>
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Airline</Label>
                  <Input
                    placeholder="e.g. Delta"
                    value={returnFlight.airline}
                    onChange={(e) => setReturnFlight(prev => ({ ...prev, airline: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Flight Number</Label>
                  <Input
                    placeholder="e.g. DL456"
                    value={returnFlight.flightNumber}
                    onChange={(e) => setReturnFlight(prev => ({ ...prev, flightNumber: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">From (Airport)</Label>
                  <Input
                    placeholder="e.g. CDG"
                    value={returnFlight.departureAirport}
                    onChange={(e) => setReturnFlight(prev => ({ ...prev, departureAirport: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">To (Airport)</Label>
                  <Input
                    placeholder="e.g. JFK"
                    value={returnFlight.arrivalAirport}
                    onChange={(e) => setReturnFlight(prev => ({ ...prev, arrivalAirport: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Departure Date</Label>
                  <Input
                    type="date"
                    value={returnFlight.departureDate}
                    onChange={(e) => setReturnFlight(prev => ({ ...prev, departureDate: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Departure Time</Label>
                  <Input
                    type="time"
                    value={returnFlight.departureTime}
                    onChange={(e) => setReturnFlight(prev => ({ ...prev, departureTime: e.target.value }))}
                  />
                </div>
              </div>
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
  onHotelAdded 
}: AddHotelInlineProps) {
  const navigate = useNavigate();
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [hotelData, setHotelData] = useState<ManualHotelEntry>({
    name: '',
    address: '',
    neighborhood: '',
    checkInTime: '15:00',
    checkOutTime: '11:00',
  });

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

    setIsSaving(true);
    try {
      const hotelSelection = {
        id: `manual-${Date.now()}`,
        name: hotelData.name,
        address: hotelData.address,
        neighborhood: hotelData.neighborhood || hotelData.address,
        checkIn: hotelData.checkInTime,
        checkOut: hotelData.checkOutTime,
        isManualEntry: true,
      };

      const { error } = await supabase
        .from('trips')
        .update({ hotel_selection: hotelSelection })
        .eq('id', tripId);

      if (error) throw error;

      toast.success('Hotel details saved!');
      setShowManualEntry(false);
      onHotelAdded?.();
    } catch (err) {
      console.error('Failed to save hotel:', err);
      toast.error('Failed to save hotel details');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div className="text-center py-6">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Hotel className="h-6 w-6 text-primary" />
          </div>
          <p className="text-muted-foreground mb-4">No hotel added yet</p>
          
          <div className="flex flex-col gap-2">
            <Button onClick={handleBrowseHotels} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Browse & Book Hotels
            </Button>
            <button
              onClick={() => setShowManualEntry(true)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
            >
              I already have a hotel — enter details
            </button>
          </div>
        </div>
      </div>

      {/* Manual Entry Dialog */}
      <Dialog open={showManualEntry} onOpenChange={setShowManualEntry}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hotel className="h-5 w-5 text-primary" />
              Enter Your Hotel Details
            </DialogTitle>
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
            <Button onClick={handleSaveManualHotel} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Hotel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
