import { useState } from 'react';
import { Bookmark, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { saveAsTemplate } from '@/services/itineraryTemplates';
import type { DayItinerary } from '@/types/itinerary';

interface SaveAsTemplateDialogProps {
  days: DayItinerary[];
  destination: string;
  tripId?: string;
  trigger?: React.ReactNode;
}

export function SaveAsTemplateDialog({
  days,
  destination,
  tripId,
  trigger,
}: SaveAsTemplateDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(`${destination} Template`);
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter a name for your template.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const result = await saveAsTemplate({
        name: name.trim(),
        description: description.trim() || undefined,
        sourceDestination: destination,
        sourceTripId: tripId,
        days,
      });

      if (result.success) {
        toast({
          title: 'Template saved!',
          description: 'You can reuse this itinerary for other destinations.',
        });
        setOpen(false);
        setName(`${destination} Template`);
        setDescription('');
      } else {
        toast({
          title: 'Failed to save',
          description: result.error || 'Please try again.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Bookmark className="h-4 w-4" />
            Save as Template
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save as Template</DialogTitle>
          <DialogDescription>
            Save this {days.length}-day itinerary as a reusable template. Apply it to other destinations later.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">Template Name</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Romantic Getaway, Adventure Week"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-description">Description (optional)</Label>
            <Textarea
              id="template-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What makes this itinerary special?"
              rows={3}
            />
          </div>

          <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
            <p className="font-medium mb-1">What gets saved:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Day themes and structure</li>
              <li>Activity types and timing</li>
              <li>Your pace and preferences</li>
            </ul>
            <p className="mt-2 text-xs">
              When applied to a new destination, the AI will find equivalent experiences.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Bookmark className="h-4 w-4" />
                Save Template
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SaveAsTemplateDialog;
