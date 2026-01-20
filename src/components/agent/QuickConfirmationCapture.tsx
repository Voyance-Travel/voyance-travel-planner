import { useState } from 'react';
import { 
  Car, 
  Train, 
  Umbrella, 
  Ship, 
  MapPin,
  CalendarClock,
  Plus,
  Sparkles,
  FileText
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { createSegment, createTask, type BookingSegmentType, type BookingSettlementType } from '@/services/agencyCRM';
import { toast } from '@/hooks/use-toast';

interface QuickConfirmationCaptureProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  onSuccess: () => void;
}

type QuickCaptureCategory = 'transfer' | 'car_rental' | 'rail' | 'insurance' | 'tour' | 'cruise' | 'other';

const QUICK_CATEGORIES: { value: QuickCaptureCategory; label: string; icon: React.ComponentType<{ className?: string }>; description: string }[] = [
  { value: 'transfer', label: 'Transfer', icon: Car, description: 'Airport/hotel transfers' },
  { value: 'car_rental', label: 'Car Rental', icon: Car, description: 'Rental vehicles' },
  { value: 'rail', label: 'Rail', icon: Train, description: 'Train tickets' },
  { value: 'insurance', label: 'Insurance', icon: Umbrella, description: 'Travel insurance' },
  { value: 'tour', label: 'Tour', icon: MapPin, description: 'Tours & activities' },
  { value: 'cruise', label: 'Cruise', icon: Ship, description: 'Cruise bookings' },
  { value: 'other', label: 'Other', icon: FileText, description: 'Misc. bookings' },
];

export default function QuickConfirmationCapture({ open, onOpenChange, tripId, onSuccess }: QuickConfirmationCaptureProps) {
  const [step, setStep] = useState<'select' | 'details'>('select');
  const [selectedCategory, setSelectedCategory] = useState<QuickCaptureCategory | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoCreateTask, setAutoCreateTask] = useState(true);
  
  // Form data
  const [formData, setFormData] = useState({
    vendor_name: '',
    confirmation_number: '',
    start_date: '',
    end_date: '',
    origin: '',
    destination: '',
    net_cost: '',
    sell_price: '',
    settlement_type: 'supplier_direct' as BookingSettlementType,
    payment_deadline: '',
    cancellation_deadline: '',
    notes: '',
  });

  const handleCategorySelect = (category: QuickCaptureCategory) => {
    setSelectedCategory(category);
    setStep('details');
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!selectedCategory) return;
    
    setIsSubmitting(true);
    try {
      // Create the booking segment
      const segment = await createSegment({
        trip_id: tripId,
        segment_type: selectedCategory as BookingSegmentType,
        status: formData.confirmation_number ? 'confirmed' : 'pending',
        vendor_name: formData.vendor_name,
        confirmation_number: formData.confirmation_number,
        start_date: formData.start_date || undefined,
        end_date: formData.end_date || undefined,
        origin: formData.origin || undefined,
        destination: formData.destination || undefined,
        net_cost_cents: Math.round(parseFloat(formData.net_cost || '0') * 100),
        sell_price_cents: Math.round(parseFloat(formData.sell_price || '0') * 100),
        settlement_type: formData.settlement_type,
        payment_deadline: formData.payment_deadline || undefined,
        cancellation_deadline: formData.cancellation_deadline || undefined,
        notes: formData.notes || undefined,
      });

      // Auto-create tasks for deadlines
      if (autoCreateTask) {
        const taskPromises: Promise<unknown>[] = [];

        if (formData.payment_deadline) {
          taskPromises.push(
            createTask({
              trip_id: tripId,
              booking_segment_id: segment.id,
              title: `Payment due: ${formData.vendor_name || selectedCategory}`,
              description: `Payment deadline for ${formData.vendor_name || 'booking'}. Confirmation: ${formData.confirmation_number || 'N/A'}`,
              priority: 'high',
              status: 'pending',
              due_date: formData.payment_deadline,
              task_type: 'payment_deadline',
              is_system_generated: true,
            })
          );
        }

        if (formData.cancellation_deadline) {
          taskPromises.push(
            createTask({
              trip_id: tripId,
              booking_segment_id: segment.id,
              title: `Cancellation deadline: ${formData.vendor_name || selectedCategory}`,
              description: `Last day to cancel ${formData.vendor_name || 'booking'} without penalty. Confirmation: ${formData.confirmation_number || 'N/A'}`,
              priority: 'medium',
              status: 'pending',
              due_date: formData.cancellation_deadline,
              task_type: 'cancellation_deadline',
              is_system_generated: true,
            })
          );
        }

        await Promise.all(taskPromises);
      }

      toast({ title: 'Booking captured', description: 'Segment and tasks created.' });
      onSuccess();
      handleClose();
    } catch (error) {
      console.error('Failed to capture booking:', error);
      toast({ title: 'Failed to save booking', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep('select');
    setSelectedCategory(null);
    setFormData({
      vendor_name: '',
      confirmation_number: '',
      start_date: '',
      end_date: '',
      origin: '',
      destination: '',
      net_cost: '',
      sell_price: '',
      settlement_type: 'supplier_direct',
      payment_deadline: '',
      cancellation_deadline: '',
      notes: '',
    });
    onOpenChange(false);
  };

  const getCategoryLabel = () => {
    const cat = QUICK_CATEGORIES.find(c => c.value === selectedCategory);
    return cat?.label || 'Booking';
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {step === 'select' ? 'Quick Capture' : `Add ${getCategoryLabel()}`}
          </DialogTitle>
          <DialogDescription>
            {step === 'select' 
              ? 'Select booking type to quickly log a confirmation'
              : 'Enter the essential details for this booking'
            }
          </DialogDescription>
        </DialogHeader>

        {step === 'select' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 py-4">
            {QUICK_CATEGORIES.map((category) => (
              <Card 
                key={category.value}
                className="cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors"
                onClick={() => handleCategorySelect(category.value)}
              >
                <CardContent className="p-4 text-center">
                  <category.icon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="font-medium text-sm">{category.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{category.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {step === 'details' && (
          <div className="space-y-4 py-2">
            {/* Essential fields */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="vendor_name">Vendor / Supplier *</Label>
                <Input 
                  id="vendor_name" 
                  value={formData.vendor_name}
                  onChange={(e) => handleInputChange('vendor_name', e.target.value)}
                  placeholder="e.g., Blacklane, Hertz, Allianz"
                  required
                />
              </div>
              <div>
                <Label htmlFor="confirmation_number">Confirmation #</Label>
                <Input 
                  id="confirmation_number" 
                  value={formData.confirmation_number}
                  onChange={(e) => handleInputChange('confirmation_number', e.target.value)}
                  placeholder="ABC123"
                />
              </div>
            </div>

            {/* Dates */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start_date">Start Date</Label>
                <Input 
                  id="start_date" 
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => handleInputChange('start_date', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="end_date">End Date</Label>
                <Input 
                  id="end_date" 
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => handleInputChange('end_date', e.target.value)}
                />
              </div>
            </div>

            {/* Location (context-aware labels) */}
            {(selectedCategory === 'transfer' || selectedCategory === 'rail' || selectedCategory === 'car_rental') && (
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="origin">
                    {selectedCategory === 'car_rental' ? 'Pickup Location' : 'From'}
                  </Label>
                  <Input 
                    id="origin" 
                    value={formData.origin}
                    onChange={(e) => handleInputChange('origin', e.target.value)}
                    placeholder={selectedCategory === 'rail' ? 'Station' : 'Location'}
                  />
                </div>
                <div>
                  <Label htmlFor="destination">
                    {selectedCategory === 'car_rental' ? 'Drop-off Location' : 'To'}
                  </Label>
                  <Input 
                    id="destination" 
                    value={formData.destination}
                    onChange={(e) => handleInputChange('destination', e.target.value)}
                    placeholder={selectedCategory === 'rail' ? 'Station' : 'Location'}
                  />
                </div>
              </div>
            )}

            <Separator />

            {/* Financials */}
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="net_cost">Net Cost ($)</Label>
                <Input 
                  id="net_cost" 
                  type="number"
                  step="0.01"
                  value={formData.net_cost}
                  onChange={(e) => handleInputChange('net_cost', e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label htmlFor="sell_price">Sell Price ($)</Label>
                <Input 
                  id="sell_price" 
                  type="number"
                  step="0.01"
                  value={formData.sell_price}
                  onChange={(e) => handleInputChange('sell_price', e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label htmlFor="settlement_type">Settlement</Label>
                <Select 
                  value={formData.settlement_type}
                  onValueChange={(v) => handleInputChange('settlement_type', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="supplier_direct">Supplier Direct</SelectItem>
                    <SelectItem value="commission_track">Commission Track</SelectItem>
                    <SelectItem value="arc_bsp">ARC/BSP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Deadlines */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="payment_deadline" className="flex items-center gap-1">
                  <CalendarClock className="h-3.5 w-3.5" />
                  Payment Deadline
                </Label>
                <Input 
                  id="payment_deadline" 
                  type="date"
                  value={formData.payment_deadline}
                  onChange={(e) => handleInputChange('payment_deadline', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="cancellation_deadline" className="flex items-center gap-1">
                  <CalendarClock className="h-3.5 w-3.5" />
                  Cancellation Deadline
                </Label>
                <Input 
                  id="cancellation_deadline" 
                  type="date"
                  value={formData.cancellation_deadline}
                  onChange={(e) => handleInputChange('cancellation_deadline', e.target.value)}
                />
              </div>
            </div>

            {/* Auto-task toggle */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <p className="text-sm font-medium">Auto-create deadline tasks</p>
                <p className="text-xs text-muted-foreground">
                  Creates reminders for payment & cancellation deadlines
                </p>
              </div>
              <Switch 
                checked={autoCreateTask}
                onCheckedChange={setAutoCreateTask}
              />
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea 
                id="notes" 
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Special requests, driver info, policy details..."
                rows={2}
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <Button type="button" variant="ghost" onClick={() => setStep('select')}>
                Back
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={isSubmitting || !formData.vendor_name}
              >
                <Plus className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Saving...' : 'Add Booking'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
