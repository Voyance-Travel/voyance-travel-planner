import { useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { validateExternalUrl } from '@/services/communityGuidesAPI';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (entry: {
    name: string;
    category: string;
    description: string;
    external_url: string;
    day_number: number;
  }) => void;
  isPending: boolean;
  defaultDayNumber: number;
}

const CATEGORIES = [
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'activity', label: 'Activity' },
  { value: 'tip', label: 'Tip' },
  { value: 'hidden_gem', label: 'Hidden Gem' },
];

export default function AddRecommendationModal({
  open,
  onOpenChange,
  onSubmit,
  isPending,
  defaultDayNumber,
}: Props) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('activity');
  const [description, setDescription] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [urlError, setUrlError] = useState('');

  const reset = () => {
    setName('');
    setCategory('activity');
    setDescription('');
    setExternalUrl('');
    setUrlError('');
  };

  const handleOpenChange = (v: boolean) => {
    if (v) reset();
    onOpenChange(v);
  };

  const handleSubmit = () => {
    // Validate URL if provided
    if (externalUrl.trim()) {
      const result = validateExternalUrl(externalUrl);
      if (result.error) {
        setUrlError(result.error);
        return;
      }
      setUrlError('');
      onSubmit({
        name: name.trim(),
        category,
        description: description.trim(),
        external_url: result.url || '',
        day_number: defaultDayNumber,
      });
    } else {
      onSubmit({
        name: name.trim(),
        category,
        description: description.trim(),
        external_url: '',
        day_number: defaultDayNumber,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Add a Recommendation
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 100))}
              placeholder="Best coffee shop in town"
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 500))}
              placeholder="What makes this special?"
              maxLength={500}
              rows={3}
            />
            <p className="text-xs text-muted-foreground text-right">{description.length}/500</p>
          </div>

          <div className="space-y-2">
            <Label>External URL (optional)</Label>
            <Input
              value={externalUrl}
              onChange={(e) => {
                setExternalUrl(e.target.value);
                if (urlError) setUrlError('');
              }}
              placeholder="https://example.com"
            />
            {urlError && (
              <p className="text-xs text-destructive">{urlError}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || isPending}
            className="gap-2"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
