/**
 * EditActivityModal — Edit an existing activity's details inline.
 */

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Edit3 } from 'lucide-react';
import { toast } from 'sonner';

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
      setLocationName(activity.location?.name || '');
      setLocationAddress(activity.location?.address || '');
    }
  }, [activity]);

  const handleSubmit = () => {
    if (!title.trim()) {
      toast.error('Please enter an activity title');
      return;
    }
    const costNum = parseFloat(cost) || 0;
    onSave({
      title: title.trim(),
      description,
      category,
      startTime,
      endTime,
      cost: { amount: costNum, currency },
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
            <Select value={category} onValueChange={setCategory}>
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
            <Input type="number" min="0" value={cost} onChange={(e) => { const v = e.target.value; if (v === '' || parseFloat(v) >= 0) setCost(v); }} placeholder="0" />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium mb-1 block">Description</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description..." rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!title}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EditActivityModal;
