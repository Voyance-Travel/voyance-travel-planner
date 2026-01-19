import { useState } from 'react';
import { format } from 'date-fns';
import { Car, MapPin, Calendar, DollarSign, FileText, X, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

export interface RentalCarDetails {
  rentalCompany?: string;
  carType?: string;
  pickupLocation?: string;
  pickupDate?: string;
  pickupTime?: string;
  dropoffLocation?: string;
  dropoffDate?: string;
  dropoffTime?: string;
  dailyRate?: number;
  totalCost?: number;
  currency?: string;
  confirmationNumber?: string;
  bookingUrl?: string;
  insuranceIncluded?: boolean;
  notes?: string;
}

interface RentalCarModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (details: RentalCarDetails) => void;
  initialData?: RentalCarDetails;
  tripDates?: { startDate: string; endDate: string };
}

const CAR_TYPES = [
  { value: 'economy', label: 'Economy' },
  { value: 'compact', label: 'Compact' },
  { value: 'midsize', label: 'Midsize' },
  { value: 'fullsize', label: 'Full-Size' },
  { value: 'suv', label: 'SUV' },
  { value: 'luxury', label: 'Luxury' },
  { value: 'minivan', label: 'Minivan' },
  { value: 'convertible', label: 'Convertible' },
];

const RENTAL_COMPANIES = [
  'Enterprise',
  'Hertz',
  'Avis',
  'Budget',
  'National',
  'Alamo',
  'Dollar',
  'Thrifty',
  'Sixt',
  'Europcar',
  'Other',
];

export default function RentalCarModal({
  open,
  onClose,
  onSave,
  initialData,
  tripDates,
}: RentalCarModalProps) {
  const [details, setDetails] = useState<RentalCarDetails>(
    initialData || {
      pickupDate: tripDates?.startDate,
      dropoffDate: tripDates?.endDate,
      currency: 'USD',
      insuranceIncluded: false,
    }
  );

  const handleSave = () => {
    onSave(details);
    onClose();
  };

  const updateField = <K extends keyof RentalCarDetails>(
    field: K,
    value: RentalCarDetails[K]
  ) => {
    setDetails(prev => ({ ...prev, [field]: value }));
  };

  // Calculate total cost when daily rate or dates change
  const calculateTotal = () => {
    if (details.dailyRate && details.pickupDate && details.dropoffDate) {
      const days = Math.ceil(
        (new Date(details.dropoffDate).getTime() - new Date(details.pickupDate).getTime()) /
        (1000 * 60 * 60 * 24)
      );
      return details.dailyRate * Math.max(days, 1);
    }
    return details.totalCost || 0;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="w-5 h-5 text-primary" />
            Rental Car Details
          </DialogTitle>
          <DialogDescription>
            Add your rental car information to track costs and optimize your itinerary
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Rental Company & Car Type */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Rental Company</Label>
              <Select
                value={details.rentalCompany}
                onValueChange={(v) => updateField('rentalCompany', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  {RENTAL_COMPANIES.map((company) => (
                    <SelectItem key={company} value={company.toLowerCase()}>
                      {company}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Car Type</Label>
              <Select
                value={details.carType}
                onValueChange={(v) => updateField('carType', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {CAR_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Pickup Details */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <MapPin className="w-4 h-4 text-green-500" />
              Pickup
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-3 sm:col-span-1">
                <Input
                  type="date"
                  value={details.pickupDate || ''}
                  onChange={(e) => updateField('pickupDate', e.target.value)}
                />
              </div>
              <div className="col-span-3 sm:col-span-1">
                <Input
                  type="time"
                  value={details.pickupTime || ''}
                  onChange={(e) => updateField('pickupTime', e.target.value)}
                  placeholder="Time"
                />
              </div>
              <div className="col-span-3 sm:col-span-1">
                <Input
                  value={details.pickupLocation || ''}
                  onChange={(e) => updateField('pickupLocation', e.target.value)}
                  placeholder="Location (e.g., Airport)"
                />
              </div>
            </div>
          </div>

          {/* Dropoff Details */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <MapPin className="w-4 h-4 text-red-500" />
              Drop-off
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-3 sm:col-span-1">
                <Input
                  type="date"
                  value={details.dropoffDate || ''}
                  onChange={(e) => updateField('dropoffDate', e.target.value)}
                />
              </div>
              <div className="col-span-3 sm:col-span-1">
                <Input
                  type="time"
                  value={details.dropoffTime || ''}
                  onChange={(e) => updateField('dropoffTime', e.target.value)}
                  placeholder="Time"
                />
              </div>
              <div className="col-span-3 sm:col-span-1">
                <Input
                  value={details.dropoffLocation || ''}
                  onChange={(e) => updateField('dropoffLocation', e.target.value)}
                  placeholder="Location"
                />
              </div>
            </div>
          </div>

          {/* Cost */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-primary" />
              Cost
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Daily Rate</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={details.dailyRate || ''}
                  onChange={(e) => updateField('dailyRate', parseFloat(e.target.value) || undefined)}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Total Cost</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={details.totalCost || calculateTotal() || ''}
                  onChange={(e) => updateField('totalCost', parseFloat(e.target.value) || undefined)}
                  placeholder={calculateTotal().toFixed(2)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Currency</Label>
                <Select
                  value={details.currency || 'USD'}
                  onValueChange={(v) => updateField('currency', v)}
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
          </div>

          {/* Booking Info */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              Booking Info
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <Input
                value={details.confirmationNumber || ''}
                onChange={(e) => updateField('confirmationNumber', e.target.value)}
                placeholder="Confirmation #"
              />
              <Input
                value={details.bookingUrl || ''}
                onChange={(e) => updateField('bookingUrl', e.target.value)}
                placeholder="Booking URL (optional)"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={details.insuranceIncluded || false}
                onCheckedChange={(checked) => updateField('insuranceIncluded', checked)}
              />
              <Label className="text-sm">Insurance included</Label>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={details.notes || ''}
              onChange={(e) => updateField('notes', e.target.value)}
              placeholder="Any special requests, upgrades, or reminders..."
              rows={2}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="gap-2">
            <Check className="w-4 h-4" />
            Save Rental Car
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
