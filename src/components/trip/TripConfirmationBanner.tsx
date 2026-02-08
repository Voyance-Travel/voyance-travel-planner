import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plane, Hotel, Clock, CheckCircle2, PenLine, Sparkles, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface TripConfirmationBannerProps {
  tripId: string;
  destination: string;
  startDate: string;
  endDate: string;
  currentStatus: string;
  hasFlightSelection: boolean;
  hasHotelSelection: boolean;
  onStatusUpdate: (status: string) => void;
  onTripDataUpdate: (data: { flight_selection?: any; hotel_selection?: any }) => void;
  onRegenerateTrip: () => void;
  className?: string;
}

interface LogisticsFormData {
  hotelName: string;
  hotelNeighborhood: string;
  arrivalTime: string;
  arrivalAirport: string;
  departureTime: string;
  departureAirport: string;
  hasFlights: 'yes' | 'no' | '';
}

export function TripConfirmationBanner({
  tripId,
  destination,
  startDate,
  endDate,
  currentStatus,
  hasFlightSelection,
  hasHotelSelection,
  onStatusUpdate,
  onTripDataUpdate,
  onRegenerateTrip,
  className,
}: TripConfirmationBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [showLogisticsDialog, setShowLogisticsDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<LogisticsFormData>({
    hotelName: '',
    hotelNeighborhood: '',
    arrivalTime: '',
    arrivalAirport: '',
    departureTime: '',
    departureAirport: '',
    hasFlights: '',
  });

  // Don't show for non-draft trips or dismissed
  if (currentStatus !== 'draft' || dismissed) return null;

  const handleDrafting = async () => {
    // Just dismiss — trip stays as draft
    setDismissed(true);
  };

  const handleUpcoming = () => {
    // If already has both hotel + flight, just update status
    if (hasFlightSelection && hasHotelSelection) {
      confirmUpcoming();
      return;
    }
    setShowLogisticsDialog(true);
  };

  const confirmUpcoming = async (logistics?: { flight_selection?: any; hotel_selection?: any }) => {
    setIsSaving(true);
    try {
      const updatePayload: Record<string, any> = {
        status: 'booked',
        updated_at: new Date().toISOString(),
      };

      if (logistics?.flight_selection) {
        updatePayload.flight_selection = logistics.flight_selection;
      }
      if (logistics?.hotel_selection) {
        updatePayload.hotel_selection = logistics.hotel_selection;
      }

      const { error } = await supabase
        .from('trips')
        .update(updatePayload)
        .eq('id', tripId);

      if (error) throw error;

      onStatusUpdate('booked');
      if (logistics) {
        onTripDataUpdate(logistics);
      }

      // If we added new logistics, regenerate
      if (logistics?.flight_selection || logistics?.hotel_selection) {
        toast.success('Trip confirmed! Regenerating itinerary with your travel details...', { duration: 4000 });
        // Small delay so the user sees the toast
        setTimeout(() => onRegenerateTrip(), 800);
      } else {
        toast.success('Trip confirmed as upcoming!');
      }

      setDismissed(true);
      setShowLogisticsDialog(false);
    } catch (err) {
      console.error('[TripConfirmationBanner] Failed to update trip:', err);
      toast.error('Failed to update trip status');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogisticsSubmit = () => {
    const logistics: { flight_selection?: any; hotel_selection?: any } = {};

    // Build hotel selection
    if (form.hotelName.trim()) {
      logistics.hotel_selection = {
        name: form.hotelName.trim(),
        neighborhood: form.hotelNeighborhood.trim() || undefined,
        checkIn: startDate,
        checkOut: endDate,
      };
    }

    // Build flight selection
    if (form.hasFlights === 'yes' && (form.arrivalTime || form.departureTime)) {
      logistics.flight_selection = {
        outbound: form.arrivalTime ? {
          arrivalTime: form.arrivalTime,
          arrival: {
            time: form.arrivalTime,
            airport: form.arrivalAirport || undefined,
          },
        } : undefined,
        return: form.departureTime ? {
          departureTime: form.departureTime,
          departure: {
            time: form.departureTime,
            airport: form.departureAirport || undefined,
          },
        } : undefined,
      };
    }

    confirmUpcoming(Object.keys(logistics).length > 0 ? logistics : undefined);
  };

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className={cn(
            'relative rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-background to-accent/5 p-5 md:p-6',
            className
          )}
        >
          <button 
            onClick={() => setDismissed(true)}
            className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Is this trip happening?
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                If it's confirmed, we'll optimize your itinerary around your actual hotel and arrival times.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDrafting}
                className="gap-1.5"
              >
                <PenLine className="h-3.5 w-3.5" />
                Just Drafting
              </Button>
              <Button
                size="sm"
                onClick={handleUpcoming}
                className="gap-1.5"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                It's Happening!
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Logistics Collection Dialog */}
      <Dialog open={showLogisticsDialog} onOpenChange={setShowLogisticsDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Tell us your travel details
            </DialogTitle>
            <DialogDescription>
              We'll rebuild your itinerary around these — locked activities stay put.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            {/* Hotel Section */}
            {!hasHotelSelection && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Hotel className="h-4 w-4 text-primary" />
                  Where are you staying?
                </div>
                <div className="space-y-2">
                  <Input
                    placeholder="Hotel name (e.g., The Ritz Carlton)"
                    value={form.hotelName}
                    onChange={(e) => setForm(prev => ({ ...prev, hotelName: e.target.value }))}
                  />
                  <Input
                    placeholder="Neighborhood (e.g., Shibuya, Trastevere)"
                    value={form.hotelNeighborhood}
                    onChange={(e) => setForm(prev => ({ ...prev, hotelNeighborhood: e.target.value }))}
                  />
                </div>
              </div>
            )}

            {/* Flight Section */}
            {!hasFlightSelection && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Plane className="h-4 w-4 text-primary" />
                  Do you have flights booked?
                </div>

                <Select
                  value={form.hasFlights}
                  onValueChange={(val) => setForm(prev => ({ ...prev, hasFlights: val as 'yes' | 'no' }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes, I have flights</SelectItem>
                    <SelectItem value="no">No flights yet</SelectItem>
                  </SelectContent>
                </Select>

                <AnimatePresence>
                  {form.hasFlights === 'yes' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-3 overflow-hidden"
                    >
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Arrival time in {destination}
                        </Label>
                        <Input
                          type="time"
                          value={form.arrivalTime}
                          onChange={(e) => setForm(prev => ({ ...prev, arrivalTime: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Departure time from {destination}
                        </Label>
                        <Input
                          type="time"
                          value={form.departureTime}
                          onChange={(e) => setForm(prev => ({ ...prev, departureTime: e.target.value }))}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Submit */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  // Skip logistics, just confirm
                  confirmUpcoming();
                }}
              >
                Skip for now
              </Button>
              <Button
                className="flex-1 gap-1.5"
                onClick={handleLogisticsSubmit}
                disabled={isSaving || (!form.hotelName.trim() && form.hasFlights !== 'yes')}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {isSaving ? 'Saving...' : 'Confirm & Optimize'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default TripConfirmationBanner;
