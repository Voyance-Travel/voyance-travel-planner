import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import { Trash2, Plane, Hotel, Train, Car, Ship, Umbrella, MapPin } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createSegment, updateSegment, deleteSegment, type BookingSegment, type BookingSegmentType } from '@/services/agencyCRM';
import { toast } from '@/hooks/use-toast';

interface BookingSegmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  segment?: BookingSegment | null;
  onSuccess: () => void;
}

const SEGMENT_TYPES: { value: BookingSegmentType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'flight', label: 'Flight', icon: Plane },
  { value: 'hotel', label: 'Hotel', icon: Hotel },
  { value: 'transfer', label: 'Transfer', icon: Car },
  { value: 'rail', label: 'Rail', icon: Train },
  { value: 'tour', label: 'Tour', icon: MapPin },
  { value: 'cruise', label: 'Cruise', icon: Ship },
  { value: 'car_rental', label: 'Car Rental', icon: Car },
  { value: 'insurance', label: 'Insurance', icon: Umbrella },
  { value: 'other', label: 'Other', icon: MapPin },
];

export default function BookingSegmentModal({ open, onOpenChange, tripId, segment, onSuccess }: BookingSegmentModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { register, handleSubmit, reset, watch, setValue } = useForm<any>();
  const isEdit = !!segment;
  const segmentType = watch('segment_type') || 'flight';
  const settlementType = watch('settlement_type') || 'supplier_direct';

  useEffect(() => {
    if (segment) {
      reset(segment);
    } else {
      reset({
        segment_type: 'flight',
        status: 'pending',
        is_refundable: true,
        currency: 'USD',
        settlement_type: 'supplier_direct',
      });
    }
  }, [segment, reset]);

  const onSubmit = async (data: Record<string, unknown>) => {
    setIsSubmitting(true);
    try {
      const payload = {
        ...data,
        trip_id: tripId,
        net_cost_cents: Math.round((Number(data.net_cost_cents) || 0) * 100),
        sell_price_cents: Math.round((Number(data.sell_price_cents) || 0) * 100),
        commission_cents: Math.round((Number(data.commission_cents) || 0) * 100),
        supplier_paid_cents: Math.round((Number(data.supplier_paid_cents) || 0) * 100),
        commission_expected_cents: Math.round((Number(data.commission_expected_cents) || 0) * 100),
        commission_received_cents: Math.round((Number(data.commission_received_cents) || 0) * 100),
      };

      if (isEdit && segment) {
        await updateSegment(segment.id, payload);
        toast({ title: 'Booking updated' });
      } else {
        await createSegment(payload as Parameters<typeof createSegment>[0]);
        toast({ title: 'Booking added' });
      }
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({ title: 'Failed to save booking', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!segment || !confirm('Delete this booking segment?')) return;
    try {
      await deleteSegment(segment.id);
      toast({ title: 'Booking deleted' });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({ title: 'Failed to delete booking', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Booking' : 'Add Booking'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Segment Type & Status */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Booking Type *</Label>
              <Select 
                value={segmentType} 
                onValueChange={(v) => setValue('segment_type', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEGMENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <span className="flex items-center gap-2">
                        <type.icon className="h-4 w-4" />
                        {type.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select 
                value={(watch('status') as string) || 'pending'} 
                onValueChange={(v) => setValue('status', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="ticketed">Ticketed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Tabs defaultValue="details" className="w-full">
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="financials">Financials</TabsTrigger>
              <TabsTrigger value="policies">Policies</TabsTrigger>
            </TabsList>

            {/* Details Tab */}
            <TabsContent value="details" className="space-y-4 mt-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="vendor_name">Vendor / Supplier *</Label>
                  <Input id="vendor_name" {...register('vendor_name')} placeholder="e.g., United Airlines, Marriott" required />
                </div>
                <div>
                  <Label htmlFor="confirmation_number">Confirmation # / PNR</Label>
                  <Input id="confirmation_number" {...register('confirmation_number')} placeholder="ABC123" />
                </div>
              </div>

              {/* Flight-specific fields */}
              {segmentType === 'flight' && (
                <>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="flight_number">Flight Number</Label>
                      <Input id="flight_number" {...register('flight_number')} placeholder="UA 123" />
                    </div>
                    <div>
                      <Label htmlFor="cabin_class">Cabin Class</Label>
                      <Select 
                        value={watch('cabin_class') || ''} 
                        onValueChange={(v) => setValue('cabin_class', v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="economy">Economy</SelectItem>
                          <SelectItem value="premium_economy">Premium Economy</SelectItem>
                          <SelectItem value="business">Business</SelectItem>
                          <SelectItem value="first">First</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="aircraft_type">Aircraft</Label>
                      <Input id="aircraft_type" {...register('aircraft_type')} placeholder="Boeing 787" />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="origin">Origin</Label>
                      <Input id="origin" {...register('origin')} placeholder="New York (JFK)" />
                    </div>
                    <div>
                      <Label htmlFor="destination">Destination</Label>
                      <Input id="destination" {...register('destination')} placeholder="London (LHR)" />
                    </div>
                  </div>
                </>
              )}

              {/* Hotel-specific fields */}
              {segmentType === 'hotel' && (
                <>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="room_type">Room Type</Label>
                      <Input id="room_type" {...register('room_type')} placeholder="Deluxe King" />
                    </div>
                    <div>
                      <Label htmlFor="room_count">Number of Rooms</Label>
                      <Input id="room_count" type="number" {...register('room_count')} defaultValue={1} />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="destination">Property Location</Label>
                    <Input id="destination" {...register('destination')} placeholder="123 Main St, City, Country" />
                  </div>
                </>
              )}

              {/* Dates & Times */}
              <Separator />
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_date">{segmentType === 'hotel' ? 'Check-in Date' : 'Start Date'}</Label>
                  <Input id="start_date" type="date" {...register('start_date')} />
                </div>
                <div>
                  <Label htmlFor="start_time">{segmentType === 'flight' ? 'Departure Time' : 'Time'}</Label>
                  <Input id="start_time" type="time" {...register('start_time')} />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="end_date">{segmentType === 'hotel' ? 'Check-out Date' : 'End Date'}</Label>
                  <Input id="end_date" type="date" {...register('end_date')} />
                </div>
                <div>
                  <Label htmlFor="end_time">{segmentType === 'flight' ? 'Arrival Time' : 'End Time'}</Label>
                  <Input id="end_time" type="time" {...register('end_time')} />
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" {...register('notes')} placeholder="Special requests, seat assignments, etc." rows={3} />
              </div>
            </TabsContent>

            {/* Financials Tab */}
            <TabsContent value="financials" className="space-y-4 mt-4">
              {/* Settlement Type - How booking is financially processed */}
              <div>
                <Label>Submit To (Settlement Type)</Label>
                <Select 
                  value={watch('settlement_type') || 'supplier_direct'} 
                  onValueChange={(v) => setValue('settlement_type', v as BookingSegment['settlement_type'])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="arc_bsp">
                      <div className="flex flex-col">
                        <span>ARC/BSP</span>
                        <span className="text-xs text-muted-foreground">Airline reporting settlement</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="supplier_direct">
                      <div className="flex flex-col">
                        <span>Supplier Direct</span>
                        <span className="text-xs text-muted-foreground">Agency collects, then pays supplier</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="commission_track">
                      <div className="flex flex-col">
                        <span>Commission Track</span>
                        <span className="text-xs text-muted-foreground">Client pays supplier, commission due later</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="net_cost_cents">Net Cost ($)</Label>
                  <Input 
                    id="net_cost_cents" 
                    type="number" 
                    step="0.01"
                    {...register('net_cost_cents')} 
                    placeholder="0.00" 
                  />
                </div>
                <div>
                  <Label htmlFor="sell_price_cents">Sell Price ($)</Label>
                  <Input 
                    id="sell_price_cents" 
                    type="number" 
                    step="0.01"
                    {...register('sell_price_cents')} 
                    placeholder="0.00" 
                  />
                </div>
                <div>
                  <Label htmlFor="commission_cents">Commission ($)</Label>
                  <Input 
                    id="commission_cents" 
                    type="number" 
                    step="0.01"
                    {...register('commission_cents')} 
                    placeholder="0.00" 
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="commission_rate">Commission Rate (%)</Label>
                  <Input 
                    id="commission_rate" 
                    type="number" 
                    step="0.1"
                    {...register('commission_rate')} 
                    placeholder="10" 
                  />
                </div>
                <div>
                  <Label htmlFor="currency">Currency</Label>
                  <Select 
                    value={watch('currency') || 'USD'} 
                    onValueChange={(v) => setValue('currency', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                      <SelectItem value="CAD">CAD</SelectItem>
                      <SelectItem value="AUD">AUD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Settlement-specific fields */}
              {watch('settlement_type') === 'arc_bsp' && (
                <>
                  <Separator />
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="arc_submission_date">ARC Submission Date</Label>
                      <Input id="arc_submission_date" type="date" {...register('arc_submission_date')} />
                    </div>
                    <div>
                      <Label htmlFor="arc_settlement_date">Settlement Date</Label>
                      <Input id="arc_settlement_date" type="date" {...register('arc_settlement_date')} />
                    </div>
                    <div>
                      <Label htmlFor="arc_report_number">Report/Batch #</Label>
                      <Input id="arc_report_number" {...register('arc_report_number')} placeholder="e.g., 12345" />
                    </div>
                  </div>
                </>
              )}

              {watch('settlement_type') === 'supplier_direct' && (
                <>
                  <Separator />
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="supplier_paid_cents">Amount Paid to Supplier ($)</Label>
                      <Input 
                        id="supplier_paid_cents" 
                        type="number" 
                        step="0.01"
                        {...register('supplier_paid_cents')} 
                        placeholder="0.00" 
                      />
                    </div>
                    <div>
                      <Label htmlFor="supplier_paid_at">Date Paid</Label>
                      <Input id="supplier_paid_at" type="date" {...register('supplier_paid_at')} />
                    </div>
                  </div>
                </>
              )}

              {watch('settlement_type') === 'commission_track' && (
                <>
                  <Separator />
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="commission_expected_cents">Expected Commission ($)</Label>
                      <Input 
                        id="commission_expected_cents" 
                        type="number" 
                        step="0.01"
                        {...register('commission_expected_cents')} 
                        placeholder="0.00" 
                      />
                    </div>
                    <div>
                      <Label htmlFor="commission_received_cents">Received Commission ($)</Label>
                      <Input 
                        id="commission_received_cents" 
                        type="number" 
                        step="0.01"
                        {...register('commission_received_cents')} 
                        placeholder="0.00" 
                      />
                    </div>
                    <div>
                      <Label htmlFor="commission_received_at">Date Received</Label>
                      <Input id="commission_received_at" type="date" {...register('commission_received_at')} />
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            {/* Policies Tab */}
            <TabsContent value="policies" className="space-y-4 mt-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="ticketing_deadline">Ticketing Deadline</Label>
                  <Input id="ticketing_deadline" type="date" {...register('ticketing_deadline')} />
                </div>
                <div>
                  <Label htmlFor="payment_deadline">Payment Deadline</Label>
                  <Input id="payment_deadline" type="date" {...register('payment_deadline')} />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cancellation_deadline">Cancellation Deadline</Label>
                  <Input id="cancellation_deadline" type="date" {...register('cancellation_deadline')} />
                </div>
                <div>
                  <Label htmlFor="penalty_amount_cents">Cancellation Penalty ($)</Label>
                  <Input 
                    id="penalty_amount_cents" 
                    type="number" 
                    step="0.01"
                    {...register('penalty_amount_cents')} 
                    placeholder="0.00" 
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch 
                  id="is_refundable"
                  checked={watch('is_refundable') ?? true}
                  onCheckedChange={(v) => setValue('is_refundable', v)}
                />
                <Label htmlFor="is_refundable">Refundable</Label>
              </div>
              <div>
                <Label htmlFor="cancellation_policy">Cancellation Policy Notes</Label>
                <Textarea 
                  id="cancellation_policy" 
                  {...register('cancellation_policy')} 
                  placeholder="Full refund until 24 hours before departure..."
                  rows={3}
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex items-center justify-between pt-4 border-t">
            {isEdit ? (
              <Button type="button" variant="destructive" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Booking'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
