/**
 * Trip Review Modal
 * Rich multi-dimension review for completed trips with highlights, ratings, and tags.
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, X, Send, Sparkles, MapPin, Utensils, Gem, DollarSign, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  useUpsertTripReview,
  useTripReview,
  REVIEW_HIGHLIGHT_OPTIONS,
  REVIEW_TAGS,
  type UpsertTripReviewInput,
} from '@/services/tripReviewAPI';

interface TripReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
  destination: string;
}

const DIMENSION_ICONS = [
  { key: 'value_rating', label: 'Value', Icon: DollarSign },
  { key: 'experience_rating', label: 'Experience', Icon: Gem },
  { key: 'location_rating', label: 'Location', Icon: MapPin },
  { key: 'food_rating', label: 'Food', Icon: Utensils },
] as const;

function StarRow({ value, onChange, size = 'md' }: { value: number; onChange: (v: number) => void; size?: 'sm' | 'md' }) {
  const [hovered, setHovered] = useState(0);
  const iconSize = size === 'sm' ? 'h-5 w-5' : 'h-7 w-7';

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          onMouseEnter={() => setHovered(s)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(s)}
          className="p-0.5 transition-transform hover:scale-110"
        >
          <Star
          className={cn(
            iconSize, 'transition-colors',
            (hovered || value) >= s
              ? 'fill-primary text-primary'
              : 'text-muted-foreground/25'
          )}
          />
        </button>
      ))}
    </div>
  );
}

export function TripReviewModal({ isOpen, onClose, tripId, destination }: TripReviewModalProps) {
  const { data: existing } = useTripReview(tripId);
  const upsert = useUpsertTripReview();

  const [overall, setOverall] = useState(0);
  const [dimensions, setDimensions] = useState<Record<string, number>>({});
  const [highlightLabel, setHighlightLabel] = useState<string | null>(null);
  const [highlightText, setHighlightText] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  // Load existing review
  useEffect(() => {
    if (existing) {
      setOverall(existing.overall_rating);
      setDimensions({
        value_rating: existing.value_rating ?? 0,
        experience_rating: existing.experience_rating ?? 0,
        location_rating: existing.location_rating ?? 0,
        food_rating: existing.food_rating ?? 0,
      });
      setHighlightLabel(existing.highlight_label);
      setHighlightText(existing.highlight_text || '');
      setReviewText(existing.review_text || '');
      setSelectedTags(existing.tags || []);
    }
  }, [existing]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (overall === 0) {
      toast.error('Please select an overall rating');
      return;
    }

    const input: UpsertTripReviewInput = {
      trip_id: tripId,
      overall_rating: overall,
      value_rating: dimensions.value_rating || null,
      experience_rating: dimensions.experience_rating || null,
      location_rating: dimensions.location_rating || null,
      food_rating: dimensions.food_rating || null,
      highlight_label: highlightLabel,
      highlight_text: highlightText || null,
      review_text: reviewText || null,
      tags: selectedTags,
    };

    try {
      await upsert.mutateAsync(input);
      setSubmitted(true);
      setTimeout(onClose, 2000);
    } catch {
      toast.error('Failed to save review');
    }
  };

  const ratingLabel = ['', 'Poor', 'Fair', 'Good', 'Great', 'Incredible'][overall] || '';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
        <AnimatePresence mode="wait">
          {!submitted ? (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-6 space-y-6"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-serif text-xl font-semibold flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Review {destination}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {existing ? 'Update your review' : 'How was your trip?'}
                  </p>
                </div>
                <button onClick={onClose} className="p-1 rounded-full hover:bg-muted">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              {/* Overall Rating */}
              <div className="text-center space-y-2">
                <p className="text-sm font-medium">Overall Experience</p>
                <StarRow value={overall} onChange={setOverall} size="md" />
                <p className="text-sm text-muted-foreground h-5">{ratingLabel}</p>
              </div>

              {/* Dimension Ratings */}
              <div className="grid grid-cols-2 gap-3">
                {DIMENSION_ICONS.map(({ key, label, Icon }) => (
                  <div key={key} className="flex items-center gap-2 p-3 rounded-xl bg-muted/40 border border-border">
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium mb-1">{label}</p>
                      <StarRow
                        value={dimensions[key] || 0}
                        onChange={(v) => setDimensions((prev) => ({ ...prev, [key]: v }))}
                        size="sm"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Highlight */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Trip Highlight</p>
                <div className="flex flex-wrap gap-1.5">
                  {REVIEW_HIGHLIGHT_OPTIONS.map((opt) => (
                    <Badge
                      key={opt}
                      variant={highlightLabel === opt ? 'default' : 'outline'}
                      className={cn(
                        'cursor-pointer transition-all text-xs',
                        highlightLabel === opt
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      )}
                      onClick={() => setHighlightLabel(highlightLabel === opt ? null : opt)}
                    >
                      {opt}
                    </Badge>
                  ))}
                </div>
                {highlightLabel && (
                  <Textarea
                    placeholder={`Tell us about your "${highlightLabel}" moment...`}
                    value={highlightText}
                    onChange={(e) => setHighlightText(e.target.value)}
                    rows={2}
                    className="resize-none text-sm"
                  />
                )}
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Quick Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {REVIEW_TAGS.map((tag) => (
                    <Badge
                      key={tag}
                      variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                      className={cn(
                        'cursor-pointer transition-all text-xs',
                        selectedTags.includes(tag)
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      )}
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Written Review */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Written Review <span className="text-muted-foreground font-normal">(optional)</span></p>
                <Textarea
                  placeholder="What would you tell a friend about this trip?"
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={onClose} className="flex-1">
                  {existing ? 'Cancel' : 'Maybe Later'}
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={upsert.isPending || overall === 0}
                  className="flex-1 gap-2"
                >
                  {upsert.isPending ? 'Saving...' : (
                    <>
                      <Send className="h-4 w-4" />
                      {existing ? 'Update' : 'Save Review'}
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-8 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.1 }}
                className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4"
              >
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </motion.div>
              <h3 className="text-xl font-serif font-semibold mb-2">Review Saved</h3>
              <p className="text-muted-foreground">Your insights will improve future recommendations.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

export default TripReviewModal;
