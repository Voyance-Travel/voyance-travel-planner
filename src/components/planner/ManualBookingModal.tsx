import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plane, Hotel, Calendar, Clock, AlertTriangle, ChevronRight } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';

interface ManualFlightData {
  airline: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  departureTime: string;
  arrivalTime: string;
  departureDate: string;
  arrivalDate: string;
}

interface ManualHotelData {
  name: string;
  address: string;
  neighborhood: string;
  checkInTime: string;
  checkOutTime: string;
}

interface ManualBookingModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { flight?: ManualFlightData; hotel?: ManualHotelData }) => void;
  type: 'flight' | 'hotel' | 'both';
  onSkip: () => void;
}

export function ManualBookingModal({ open, onClose, onSubmit, type, onSkip }: ManualBookingModalProps) {
  const [activeTab, setActiveTab] = useState<'enter' | 'later'>(type === 'both' ? 'enter' : 'enter');
  
  // Flight state
  const [flightData, setFlightData] = useState<ManualFlightData>({
    airline: '',
    flightNumber: '',
    departureAirport: '',
    arrivalAirport: '',
    departureTime: '',
    arrivalTime: '',
    departureDate: '',
    arrivalDate: '',
  });
  
  // Hotel state
  const [hotelData, setHotelData] = useState<ManualHotelData>({
    name: '',
    address: '',
    neighborhood: '',
    checkInTime: '15:00',
    checkOutTime: '11:00',
  });

  const handleFlightChange = (field: keyof ManualFlightData, value: string) => {
    setFlightData(prev => ({ ...prev, [field]: value }));
  };

  const handleHotelChange = (field: keyof ManualHotelData, value: string) => {
    setHotelData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    const result: { flight?: ManualFlightData; hotel?: ManualHotelData } = {};
    
    if (type === 'flight' || type === 'both') {
      const missing: string[] = [];
      if (!flightData.airline.trim()) missing.push('airline');
      if (!flightData.departureAirport.trim()) missing.push('departure airport');
      if (!flightData.arrivalAirport.trim()) missing.push('arrival airport');
      if (!flightData.departureDate) missing.push('departure date');
      if (!flightData.arrivalDate) missing.push('arrival date');
      
      if (missing.length > 0) {
        toast.error(`Please fill in: ${missing.join(', ')}`);
        return;
      }
      result.flight = flightData;
    }
    
    if (type === 'hotel' || type === 'both') {
      if (!hotelData.name.trim()) {
        toast.error('Please enter the hotel name');
        return;
      }
      result.hotel = hotelData;
    }
    
    onSubmit(result);
    onClose();
  };

  const handleSkipWithWarning = () => {
    onSkip();
    onClose();
  };

  const title = type === 'flight' ? 'Your Flight Details' : type === 'hotel' ? 'Your Hotel Details' : 'Your Booking Details';
  const description = type === 'flight' 
    ? 'Enter your flight information so we can plan activities around your arrival and departure times.'
    : type === 'hotel'
    ? 'Enter your hotel information so we can plan activities around your location.'
    : 'Provide your booking details to help us create a better itinerary.';

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {type === 'flight' && <Plane className="h-5 w-5" />}
            {type === 'hotel' && <Hotel className="h-5 w-5" />}
            {type === 'both' && <span>✈️ 🏨</span>}
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'enter' | 'later')} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="enter">Enter Details</TabsTrigger>
            <TabsTrigger value="later">I'll Add Later</TabsTrigger>
          </TabsList>

          <TabsContent value="enter" className="space-y-4 mt-4">
            {(type === 'flight' || type === 'both') && (
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Plane className="h-4 w-4" />
                  Flight Information
                </h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="airline">Airline</Label>
                    <Input
                      id="airline"
                      placeholder="e.g., Delta, United"
                      value={flightData.airline}
                      onChange={(e) => handleFlightChange('airline', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="flightNumber">Flight Number</Label>
                    <Input
                      id="flightNumber"
                      placeholder="e.g., DL123"
                      value={flightData.flightNumber}
                      onChange={(e) => handleFlightChange('flightNumber', e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="departureAirport">Departure Airport</Label>
                    <Input
                      id="departureAirport"
                      placeholder="e.g., JFK"
                      value={flightData.departureAirport}
                      onChange={(e) => handleFlightChange('departureAirport', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="arrivalAirport">Arrival Airport</Label>
                    <Input
                      id="arrivalAirport"
                      placeholder="e.g., CDG"
                      value={flightData.arrivalAirport}
                      onChange={(e) => handleFlightChange('arrivalAirport', e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="departureDate">Departure Date</Label>
                    <Input
                      id="departureDate"
                      type="date"
                      value={flightData.departureDate}
                      onChange={(e) => handleFlightChange('departureDate', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="departureTime">Departure Time</Label>
                    <Input
                      id="departureTime"
                      type="time"
                      value={flightData.departureTime}
                      onChange={(e) => handleFlightChange('departureTime', e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="arrivalDate">Arrival Date</Label>
                    <Input
                      id="arrivalDate"
                      type="date"
                      value={flightData.arrivalDate}
                      onChange={(e) => handleFlightChange('arrivalDate', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="arrivalTime">Arrival Time</Label>
                    <Input
                      id="arrivalTime"
                      type="time"
                      value={flightData.arrivalTime}
                      onChange={(e) => handleFlightChange('arrivalTime', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {type === 'both' && <div className="border-t my-4" />}

            {(type === 'hotel' || type === 'both') && (
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Hotel className="h-4 w-4" />
                  Hotel Information
                </h4>
                
                <div className="space-y-1.5">
                  <Label htmlFor="hotelName">Hotel Name</Label>
                  <Input
                    id="hotelName"
                    placeholder="e.g., Grand Hyatt Paris"
                    value={hotelData.name}
                    onChange={(e) => handleHotelChange('name', e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="hotelAddress">Address</Label>
                  <Input
                    id="hotelAddress"
                    placeholder="e.g., 2 Rue de la Paix, 75002"
                    value={hotelData.address}
                    onChange={(e) => handleHotelChange('address', e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="neighborhood">Neighborhood / Area</Label>
                  <Input
                    id="neighborhood"
                    placeholder="e.g., Le Marais, Opera District"
                    value={hotelData.neighborhood}
                    onChange={(e) => handleHotelChange('neighborhood', e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="checkInTime">Check-in Time</Label>
                    <Input
                      id="checkInTime"
                      type="time"
                      value={hotelData.checkInTime}
                      onChange={(e) => handleHotelChange('checkInTime', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="checkOutTime">Check-out Time</Label>
                    <Input
                      id="checkOutTime"
                      type="time"
                      value={hotelData.checkOutTime}
                      onChange={(e) => handleHotelChange('checkOutTime', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="later" className="mt-4">
            <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-sm">
                {type === 'flight' ? (
                  <>Without flight details, we'll use general arrival/departure times. You can add your flight info later from the trip dashboard.</>
                ) : type === 'hotel' ? (
                  <>Without hotel info, we'll optimize routes for the city center. You can specify your hotel later from the trip dashboard.</>
                ) : (
                  <>Without your booking details, we'll create a general itinerary. Activities will be optimized for the city center with standard timing. You can always add details later.</>
                )}
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6 gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {activeTab === 'enter' ? (
            <Button onClick={handleSubmit}>
              Save & Continue
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSkipWithWarning}>
              Continue Without Details
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type { ManualFlightData, ManualHotelData };
