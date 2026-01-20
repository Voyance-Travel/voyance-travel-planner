import { useState } from 'react';
import { Library, Tag, X } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  createLibraryItem, 
  type LibraryItemType,
  type CreateLibraryItemInput 
} from '@/services/agencyCRM/library';
import type { EditorialActivity, EditorialDay } from '@/components/itinerary/EditorialItinerary';
import { toast } from '@/hooks/use-toast';

interface SaveToLibraryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemType: LibraryItemType;
  content: EditorialActivity | EditorialDay;
  defaultName?: string;
  destinationHint?: string;
  onSaved?: () => void;
}

export default function SaveToLibraryModal({
  open,
  onOpenChange,
  itemType,
  content,
  defaultName = '',
  destinationHint = '',
  onSaved
}: SaveToLibraryModalProps) {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [destination, setDestination] = useState(destinationHint);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: 'Please enter a name', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const input: CreateLibraryItemInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        item_type: itemType,
        tags: tags.length > 0 ? tags : undefined,
        destination_hint: destination.trim() || undefined,
        content,
      };

      await createLibraryItem(input);
      toast({ title: 'Saved to library!' });
      onSaved?.();
      onOpenChange(false);
      
      // Reset form
      setName('');
      setDescription('');
      setTags([]);
      setDestination('');
    } catch (error) {
      console.error('Failed to save to library:', error);
      toast({ title: 'Failed to save', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const typeLabel = itemType === 'activity' ? 'Activity' : itemType === 'day' ? 'Day' : 'Template';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Library className="h-5 w-5" />
            Save {typeLabel} to Library
          </DialogTitle>
          <DialogDescription>
            Save this {typeLabel.toLowerCase()} to reuse in future trips.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`E.g., "Morning at the Louvre"`}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes about when to use this..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="destination">Destination Hint</Label>
            <Input
              id="destination"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="E.g., Paris, France"
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Tags
            </Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map(tag => (
                <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                  {tag}
                  <button onClick={() => setTags(tags.filter(t => t !== tag))}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <Input
              value=""
              onChange={(e) => {
                const value = e.target.value;
                if (value.endsWith(',') || value.endsWith(' ')) {
                  const newTag = value.slice(0, -1).trim();
                  if (newTag && !tags.includes(newTag)) {
                    setTags([...tags, newTag]);
                  }
                  e.target.value = '';
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const input = e.target as HTMLInputElement;
                  const newTag = input.value.trim();
                  if (newTag && !tags.includes(newTag)) {
                    setTags([...tags, newTag]);
                  }
                  input.value = '';
                }
              }}
              placeholder="Add tags..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save to Library'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
