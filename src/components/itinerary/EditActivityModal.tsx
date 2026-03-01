/**
 * EditActivityModal — Edit an existing activity's details inline.
 */

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Edit3, Link2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { validateCostUpdate } from '@/services/activityCostService';

interface EditableActivity {
  id?: string;
  title?: string;
  description?: string;
  category?: string;
  startTime?: string;
  endTime?: string;
  cost?: { amount: number; currency: string };
  location?: { name?: string; address?: string };
  [key: string]: any;
}

interface EditActivityModalProps {
  isOpen: boolean;
  activity: EditableActivity | null;
  onClose: () => void;
  onSave: (updates: Partial<EditableActivity>) => void;
  currency?: string;
}

export function EditActivityModal({ isOpen, activity, onClose, onSave, currency = 'USD' }: EditActivityModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('activity');
  const [startTime, setStartTime] = useState('12:00');
  const [endTime, setEndTime] = useState('13:00');
  const [cost, setCost] = useState('0');
  const [costError, setCostError] = useState<string | null>(null);
  const [costWarning, setCostWarning] = useState<string | null>(null);
  const [website, setWebsite] = useState('');
  const [reservationMade, setReservationMade] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');

  useEffect(() => {
    if (activity) {
      setTitle(activity.title || '');
      setDescription(activity.description || '');
      setCategory(activity.category || activity.type || 'activity');
      setStartTime(activity.startTime || activity.time || '12:00');
      setEndTime(activity.endTime || '13:00');
      setCost(String(activity.cost?.amount ?? 0));
      setWebsite(activity.website || activity.bookingUrl || '');
      setReservationMade(activity.reservationMade ?? false);
      setLocationName(activity.location?.name || '');
      setLocationAddress(activity.location?.address || '');
    }
  }, [activity]);

  // Validate cost on change
  const handleCostChange = (value: string) => {
    if (value === '' || parseFloat(value) >= 0) {
      setCost(value);
      const num = parseFloat(value) || 0;
      const validation = validateCostUpdate(category, num);
      setCostError(validation.valid ? null : validation.message || null);
      setCostWarning(validation.valid ? (validation.warning || null) : null);
    }
  };

  // Re-validate when category changes
  const handleCategoryChange = (newCategory: string) => {
    setCategory(newCategory);
    const num = parseFloat(cost) || 0;
    if (num > 0) {
      const validation = validateCostUpdate(newCategory, num);
      setCostError(validation.valid ? null : validation.message || null);
      setCostWarning(validation.valid ? (validation.warning || null) : null);
    } else {
      setCostWarning(null);
    }
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      toast.error('Please enter an activity title');
      return;
    }
    const costNum = parseFloat(cost) || 0;
    const validation = validateCostUpdate(category, costNum);
    if (!validation.valid) {
      toast.error(validation.message || 'Invalid cost');
      return;
    }
    onSave({
      title: title.trim(),
      description,
      category,
      startTime,
      endTime,
      cost: { amount: costNum, currency },
      website: website.trim() || undefined,
      reservationMade,
      location: {
        name: locationName,
        address: locationAddress,
      },
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="h-5 w-5 text-primary" />
            Edit Activity
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
          {/* Title */}
          <div>
            <label className="text-sm font-medium mb-1 block">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Activity name" />
          </div>

          {/* Category */}
          <div>
            <label className="text-sm font-medium mb-1 block">Category</label>
            <Select value={category} onValueChange={handleCategoryChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sightseeing">Sightseeing</SelectItem>
                <SelectItem value="dining">Dining</SelectItem>
                <SelectItem value="cultural">Cultural</SelectItem>
                <SelectItem value="activity">Activity</SelectItem>
                <SelectItem value="relaxation">Relaxation</SelectItem>
                <SelectItem value="shopping">Shopping</SelectItem>
                <SelectItem value="nightlife">Nightlife</SelectItem>
                <SelectItem value="transportation">Transportation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Start Time</label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">End Time</label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          {/* Location */}
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Venue Name</label>
              <Input value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="e.g. Louvre Museum" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Address</label>
              <Input value={locationAddress} onChange={(e) => setLocationAddress(e.target.value)} placeholder="e.g. Rue de Rivoli, Paris" />
            </div>
          </div>

          {/* Cost */}
          <div>
            <label className="text-sm font-medium mb-1 block">Cost ({currency})</label>
            <Input type="number" min="0" value={cost} onChange={(e) => handleCostChange(e.target.value)} placeholder="0" className={costError ? 'border-destructive' : costWarning ? 'border-yellow-500' : ''} />
            {costError && (
              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-destructive">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                <span>{costError}</span>
              </div>
            )}
            {costWarning && !costError && (
              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-yellow-600 dark:text-yellow-400">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                <span>{costWarning}</span>
              </div>
            )}
          </div>

          {/* Website / Link */}
          <div>
            <label className="text-sm font-medium mb-1 block">Website / Link</label>
            <div className="relative">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." className="pl-9" />
            </div>
          </div>

          {/* Reservation confirmation */}
          <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
            <Checkbox 
              id="reservation-made" 
              checked={reservationMade} 
              onCheckedChange={(checked) => setReservationMade(checked === true)} 
            />
            <label htmlFor="reservation-made" className="text-sm font-medium flex items-center gap-2 cursor-pointer">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Reservation / Tickets Confirmed
            </label>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium mb-1 block">Description</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description..." rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!title || !!costError}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EditActivityModal;
