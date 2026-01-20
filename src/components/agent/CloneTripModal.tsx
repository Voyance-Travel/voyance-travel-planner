import { useState } from 'react';
import { Copy } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cloneAgencyTrip } from '@/services/agencyCRM/library';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

interface CloneTripModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  originalName: string;
}

export default function CloneTripModal({
  open,
  onOpenChange,
  tripId,
  originalName
}: CloneTripModalProps) {
  const navigate = useNavigate();
  const [newName, setNewName] = useState(`${originalName} (Copy)`);
  const [isCloning, setIsCloning] = useState(false);

  const handleClone = async () => {
    if (!newName.trim()) {
      toast({ title: 'Please enter a name', variant: 'destructive' });
      return;
    }

    setIsCloning(true);
    try {
      const newTripId = await cloneAgencyTrip(tripId, newName.trim());
      toast({ 
        title: 'Trip cloned successfully!',
        description: 'Opening the new trip...'
      });
      onOpenChange(false);
      navigate(`/agent/trips/${newTripId}`);
    } catch (error) {
      console.error('Failed to clone trip:', error);
      toast({ title: 'Failed to clone trip', variant: 'destructive' });
    } finally {
      setIsCloning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Clone Trip
          </DialogTitle>
          <DialogDescription>
            Create a copy of this trip with all itinerary items and booking templates.
            Dates and confirmations will be cleared.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="tripName">New Trip Name</Label>
            <Input
              id="tripName"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Enter trip name"
            />
          </div>

          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <p className="font-medium mb-1">What gets copied:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Full itinerary with all activities</li>
              <li>Booking templates (without confirmations)</li>
              <li>Trip notes and preferences</li>
              <li>Destination and traveler count</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleClone} disabled={isCloning}>
            {isCloning ? 'Cloning...' : 'Clone Trip'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
