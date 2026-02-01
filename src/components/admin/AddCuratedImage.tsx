/**
 * Add Curated Image Component
 * 
 * Admin tool for manually seeding curated images for edge case cities/venues
 * that don't have good API results.
 */

import { useState } from 'react';
import { Plus, Search, Image, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const ENTITY_TYPES = [
  { value: 'destination', label: 'Destination/City' },
  { value: 'activity', label: 'Activity/Attraction' },
  { value: 'hotel', label: 'Hotel/Accommodation' },
  { value: 'restaurant', label: 'Restaurant/Dining' },
];

const SOURCES = [
  { value: 'unsplash', label: 'Unsplash' },
  { value: 'pexels', label: 'Pexels' },
  { value: 'wikimedia', label: 'Wikimedia' },
  { value: 'manual', label: 'Manual Upload' },
  { value: 'google_places', label: 'Google Places' },
];

interface AddCuratedImageProps {
  onImageAdded?: () => void;
}

export function AddCuratedImage({ onImageAdded }: AddCuratedImageProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewError, setPreviewError] = useState(false);
  
  const [formData, setFormData] = useState({
    imageUrl: '',
    entityType: 'activity',
    entityKey: '',
    destination: '',
    source: 'unsplash',
    altText: '',
    attribution: '',
  });

  const handleUrlChange = (url: string) => {
    setFormData(prev => ({ ...prev, imageUrl: url }));
    setPreviewUrl(url);
    setPreviewError(false);
  };

  const handleSubmit = async () => {
    if (!formData.imageUrl || !formData.entityKey) {
      toast({ title: 'Missing required fields', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      // Normalize entity key for consistent matching
      const normalizedKey = formData.entityKey.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').slice(0, 100);
      
      const { error } = await supabase.from('curated_images').insert({
        image_url: formData.imageUrl.trim(),
        entity_type: formData.entityType,
        entity_key: normalizedKey,
        destination: formData.destination || null,
        source: formData.source,
        alt_text: formData.altText || `${formData.entityKey} photo`,
        attribution: formData.attribution || null,
        quality_score: 80, // Start with decent score for manually curated
        vote_score: 1, // Give manual additions a head start
        vote_count: 0,
        is_blacklisted: false,
      });

      if (error) throw error;

      toast({ title: 'Image added successfully!' });
      setOpen(false);
      setFormData({
        imageUrl: '',
        entityType: 'activity',
        entityKey: '',
        destination: '',
        source: 'unsplash',
        altText: '',
        attribution: '',
      });
      setPreviewUrl('');
      onImageAdded?.();
    } catch (error) {
      console.error('Failed to add image:', error);
      toast({ title: 'Failed to add image', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Image
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Image className="h-5 w-5" />
            Add Curated Image
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Image URL */}
          <div className="space-y-2">
            <Label htmlFor="imageUrl">Image URL *</Label>
            <Input
              id="imageUrl"
              placeholder="https://images.unsplash.com/..."
              value={formData.imageUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Use high-quality images (1200px+ wide). Unsplash, Pexels, or Wikimedia recommended.
            </p>
          </div>

          {/* Preview */}
          {previewUrl && (
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                {previewError ? (
                  <div className="h-48 flex items-center justify-center bg-muted text-muted-foreground">
                    Failed to load image
                  </div>
                ) : (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-48 object-cover"
                    onError={() => setPreviewError(true)}
                    onLoad={() => setPreviewError(false)}
                  />
                )}
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Entity Type */}
            <div className="space-y-2">
              <Label>Type *</Label>
              <Select
                value={formData.entityType}
                onValueChange={(v) => setFormData(prev => ({ ...prev, entityType: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Source */}
            <div className="space-y-2">
              <Label>Source</Label>
              <Select
                value={formData.source}
                onValueChange={(v) => setFormData(prev => ({ ...prev, source: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCES.map(source => (
                    <SelectItem key={source.value} value={source.value}>
                      {source.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Entity Key (searchable name) */}
          <div className="space-y-2">
            <Label htmlFor="entityKey">Entity Name * (what users search for)</Label>
            <Input
              id="entityKey"
              placeholder="e.g., 'Tokyo Tower', 'Santorini', 'The Ritz Paris'"
              value={formData.entityKey}
              onChange={(e) => setFormData(prev => ({ ...prev, entityKey: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              This is matched against activity titles and destination names.
            </p>
          </div>

          {/* Destination (for context) */}
          <div className="space-y-2">
            <Label htmlFor="destination">Destination (city/country)</Label>
            <Input
              id="destination"
              placeholder="e.g., 'Tokyo, Japan' or 'Santorini, Greece'"
              value={formData.destination}
              onChange={(e) => setFormData(prev => ({ ...prev, destination: e.target.value }))}
            />
          </div>

          {/* Alt Text */}
          <div className="space-y-2">
            <Label htmlFor="altText">Alt Text</Label>
            <Input
              id="altText"
              placeholder="Descriptive text for accessibility"
              value={formData.altText}
              onChange={(e) => setFormData(prev => ({ ...prev, altText: e.target.value }))}
            />
          </div>

          {/* Attribution */}
          <div className="space-y-2">
            <Label htmlFor="attribution">Attribution / Credit</Label>
            <Input
              id="attribution"
              placeholder="e.g., 'Photo by John Doe on Unsplash'"
              value={formData.attribution}
              onChange={(e) => setFormData(prev => ({ ...prev, attribution: e.target.value }))}
            />
          </div>

          {/* Submit */}
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !formData.imageUrl || !formData.entityKey}
            className="w-full"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Add to Curated Images
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
