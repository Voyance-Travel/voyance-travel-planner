import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Coffee, Camera, Utensils, Heart, Zap, MapPin, Music } from 'lucide-react';

interface RegenerateGuidedAssistDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (preferences: string) => void;
  dayNumber: number;
  destination?: string;
}

const QUICK_SUGGESTIONS = [
  { label: 'More relaxed pace', icon: Coffee, value: 'more relaxed pace, fewer activities, more breaks' },
  { label: 'Hidden gems', icon: MapPin, value: 'local hidden gems, off the beaten path spots' },
  { label: 'Foodie focus', icon: Utensils, value: 'more food experiences, local restaurants, food tours' },
  { label: 'Photo spots', icon: Camera, value: 'instagram-worthy locations, scenic viewpoints, photo opportunities' },
  { label: 'Romantic vibes', icon: Heart, value: 'romantic atmosphere, couple-friendly activities' },
  { label: 'More adventure', icon: Zap, value: 'more exciting activities, adventure, outdoor experiences' },
  { label: 'Cultural immersion', icon: Music, value: 'local culture, museums, historical sites, art galleries' },
];

export function RegenerateGuidedAssistDialog({
  isOpen,
  onClose,
  onSubmit,
  dayNumber,
  destination,
}: RegenerateGuidedAssistDialogProps) {
  const [selectedSuggestions, setSelectedSuggestions] = useState<string[]>([]);
  const [customRequest, setCustomRequest] = useState('');

  const toggleSuggestion = (value: string) => {
    setSelectedSuggestions(prev =>
      prev.includes(value)
        ? prev.filter(s => s !== value)
        : [...prev, value]
    );
  };

  const handleSubmit = () => {
    const allPreferences = [
      ...selectedSuggestions,
      customRequest.trim(),
    ].filter(Boolean).join('. ');
    
    onSubmit(allPreferences);
    setSelectedSuggestions([]);
    setCustomRequest('');
    onClose();
  };

  const handleSkip = () => {
    onSubmit(''); // Empty string means just regenerate without guidance
    setSelectedSuggestions([]);
    setCustomRequest('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            What are you looking for?
          </DialogTitle>
          <DialogDescription>
            Help us create the perfect Day {dayNumber}{destination ? ` in ${destination}` : ''} for you.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Quick suggestion chips */}
          <div className="flex flex-wrap gap-2">
            {QUICK_SUGGESTIONS.map(({ label, icon: Icon, value }) => (
              <Badge
                key={value}
                variant={selectedSuggestions.includes(value) ? 'default' : 'outline'}
                className="cursor-pointer hover:bg-primary/10 transition-colors py-1.5 px-3 gap-1.5"
                onClick={() => toggleSuggestion(value)}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Badge>
            ))}
          </div>

          {/* Custom request textarea */}
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">
              Or tell us in your own words:
            </label>
            <Textarea
              placeholder="e.g., I want to visit a specific neighborhood, avoid crowded tourist spots, include a sunset activity..."
              value={customRequest}
              onChange={(e) => setCustomRequest(e.target.value)}
              className="min-h-[80px] resize-none"
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={handleSkip}>
            Just refresh
          </Button>
          <Button onClick={handleSubmit}>
            <Sparkles className="h-4 w-4 mr-1" />
            Generate with preferences
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
