/**
 * Trip Debrief Modal
 * Post-trip retrospective for continuous learning
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Star, MapPin, ThumbsUp, ThumbsDown, Clock, Hotel, 
  Lightbulb, Plus, Trash2, ChevronRight, ChevronLeft, Sparkles,
  Sun, Sunset, Moon, RotateCcw, Check, Heart, RefreshCw, Car
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  useSubmitTripLearning,
  useTripLearning,
  type TripHighlight,
  type PainPoint,
  type PacingFeedback,
  type AccommodationFeedback,
  type BestTimeOfDay,
} from '@/services/tripLearningsAPI';

interface TripDebriefModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
  destination: string;
  tripName?: string;
}

const STEPS = ['rating', 'highlights', 'challenges', 'preferences', 'summary'] as const;
type Step = typeof STEPS[number];

export function TripDebriefModal({
  isOpen,
  onClose,
  tripId,
  destination,
  tripName,
}: TripDebriefModalProps) {
  const [currentStep, setCurrentStep] = useState<Step>('rating');
  const [overallRating, setOverallRating] = useState<number>(0);
  const [wouldReturn, setWouldReturn] = useState<boolean | null>(null);
  const [pacingFeedback, setPacingFeedback] = useState<PacingFeedback | null>(null);
  const [accommodationFeedback, setAccommodationFeedback] = useState<AccommodationFeedback | null>(null);
  const [highlights, setHighlights] = useState<TripHighlight[]>([]);
  const [painPoints, setPainPoints] = useState<PainPoint[]>([]);
  const [discoveredLikes, setDiscoveredLikes] = useState<string[]>([]);
  const [discoveredDislikes, setDiscoveredDislikes] = useState<string[]>([]);
  const [bestTimeOfDay, setBestTimeOfDay] = useState<BestTimeOfDay | null>(null);
  const [travelPartyNotes, setTravelPartyNotes] = useState('');
  const [wouldChange, setWouldChange] = useState('');
  const [newHighlight, setNewHighlight] = useState({ activity: '', why: '' });
  const [newPainPoint, setNewPainPoint] = useState({ issue: '', solution: '' });
  const [newLike, setNewLike] = useState('');
  const [newDislike, setNewDislike] = useState('');

  const { data: existingLearning } = useTripLearning(tripId);
  const submitLearning = useSubmitTripLearning();

  // Load existing data
  useEffect(() => {
    if (existingLearning) {
      setOverallRating(existingLearning.overall_rating || 0);
      setWouldReturn(existingLearning.would_return);
      setPacingFeedback(existingLearning.pacing_feedback);
      setAccommodationFeedback(existingLearning.accommodation_feedback);
      setHighlights(existingLearning.highlights || []);
      setPainPoints(existingLearning.pain_points || []);
      setDiscoveredLikes(existingLearning.discovered_likes || []);
      setDiscoveredDislikes(existingLearning.discovered_dislikes || []);
      setBestTimeOfDay(existingLearning.best_time_of_day);
      setTravelPartyNotes(existingLearning.travel_party_notes || '');
      setWouldChange(existingLearning.would_change || '');
    }
  }, [existingLearning]);

  const stepIndex = STEPS.indexOf(currentStep);
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === STEPS.length - 1;

  const handleNext = () => {
    if (!isLastStep) {
      setCurrentStep(STEPS[stepIndex + 1]);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (!isFirstStep) {
      setCurrentStep(STEPS[stepIndex - 1]);
    }
  };

  const handleSubmit = async () => {
    try {
      await submitLearning.mutateAsync({
        trip_id: tripId,
        destination,
        overall_rating: overallRating || undefined,
        would_return: wouldReturn ?? undefined,
        pacing_feedback: pacingFeedback || undefined,
        accommodation_feedback: accommodationFeedback || undefined,
        highlights,
        pain_points: painPoints,
        discovered_likes: discoveredLikes.length > 0 ? discoveredLikes : undefined,
        discovered_dislikes: discoveredDislikes.length > 0 ? discoveredDislikes : undefined,
        best_time_of_day: bestTimeOfDay || undefined,
        travel_party_notes: travelPartyNotes || undefined,
        would_change: wouldChange || undefined,
      });

      toast.success('Trip debrief saved!', {
        description: "We'll use these insights to make your next trip even better.",
      });
      onClose();
    } catch (error) {
      console.error('Failed to save debrief:', error);
      toast.error('Failed to save debrief');
    }
  };

  const addHighlight = () => {
    if (newHighlight.activity && newHighlight.why) {
      setHighlights([...highlights, { ...newHighlight, category: 'general' }]);
      setNewHighlight({ activity: '', why: '' });
    }
  };

  const addPainPoint = () => {
    if (newPainPoint.issue) {
      setPainPoints([...painPoints, newPainPoint]);
      setNewPainPoint({ issue: '', solution: '' });
    }
  };

  const addDiscoveredLike = () => {
    const normalizedLike = newLike.trim();
    if (!normalizedLike) return;

    setDiscoveredLikes((prev) => {
      if (prev.some((item) => item.toLowerCase() === normalizedLike.toLowerCase())) return prev;
      return [...prev, normalizedLike];
    });
    setNewLike('');
  };

  const addDiscoveredDislike = () => {
    const normalizedDislike = newDislike.trim();
    if (!normalizedDislike) return;

    setDiscoveredDislikes((prev) => {
      if (prev.some((item) => item.toLowerCase() === normalizedDislike.toLowerCase())) return prev;
      return [...prev, normalizedDislike];
    });
    setNewDislike('');
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'rating':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold">How was your trip?</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Rate your overall experience in {destination}
              </p>
            </div>

            {/* Star Rating */}
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <motion.button
                  key={star}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setOverallRating(star)}
                  className="p-2"
                >
                  <Star
                    className={cn(
                      'w-10 h-10 transition-colors',
                      star <= overallRating
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-muted-foreground/30'
                    )}
                  />
                </motion.button>
              ))}
            </div>

            {/* Would Return */}
            <div className="space-y-3">
              <Label className="text-center block">Would you visit {destination} again?</Label>
              <div className="flex justify-center gap-3">
                <Button
                  variant={wouldReturn === true ? 'default' : 'outline'}
                  onClick={() => setWouldReturn(true)}
                  className="gap-2"
                >
                  <ThumbsUp className="w-4 h-4" />
                  Definitely!
                </Button>
                <Button
                  variant={wouldReturn === false ? 'default' : 'outline'}
                  onClick={() => setWouldReturn(false)}
                  className="gap-2"
                >
                  <ThumbsDown className="w-4 h-4" />
                  Probably not
                </Button>
              </div>
            </div>

            {/* Pacing */}
            <div className="space-y-3">
              <Label>How was the pacing?</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'too_rushed', label: 'Too rushed', icon: '🏃' },
                  { value: 'perfect', label: 'Just right', icon: '✨' },
                  { value: 'too_slow', label: 'Too slow', icon: '🐢' },
                  { value: 'varied_needs', label: 'Varied by day', icon: '📊' },
                ].map((option) => (
                  <Button
                    key={option.value}
                    variant={pacingFeedback === option.value ? 'default' : 'outline'}
                    onClick={() => setPacingFeedback(option.value as PacingFeedback)}
                    className="justify-start gap-2"
                  >
                    <span>{option.icon}</span>
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        );

      case 'highlights':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold">What were the highlights?</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Tell us about your favorite moments
              </p>
            </div>

            {/* Existing highlights */}
            <div className="space-y-2">
              {highlights.map((h, idx) => (
                <div key={idx} className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                  <ThumbsUp className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{h.activity}</p>
                    <p className="text-xs text-muted-foreground">{h.why}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setHighlights(highlights.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Add new highlight */}
            <div className="space-y-3 p-4 border border-dashed rounded-lg">
              <Input
                placeholder="What activity or experience?"
                value={newHighlight.activity}
                onChange={(e) => setNewHighlight(prev => ({ ...prev, activity: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && newHighlight.activity && newHighlight.why && addHighlight()}
              />
              <Input
                placeholder="Why was it great?"
                value={newHighlight.why}
                onChange={(e) => setNewHighlight(prev => ({ ...prev, why: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && newHighlight.activity && newHighlight.why && addHighlight()}
              />
              <Button
                variant={newHighlight.activity && newHighlight.why ? 'default' : 'outline'}
                onClick={addHighlight}
                disabled={!newHighlight.activity.trim() || !newHighlight.why.trim()}
                className="w-full gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Highlight
              </Button>
            </div>
          </div>
        );

      case 'challenges':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold">What could have been better?</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Help us avoid these issues in future trips
              </p>
            </div>

            {/* Existing pain points */}
            <div className="space-y-2">
              {painPoints.map((p, idx) => (
                <div key={idx} className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                  <ThumbsDown className="w-4 h-4 text-orange-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{p.issue}</p>
                    {p.solution && (
                      <p className="text-xs text-muted-foreground">💡 {p.solution}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setPainPoints(painPoints.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Add new pain point */}
            <div className="space-y-3 p-4 border border-dashed rounded-lg">
              <Input
                placeholder="What was the issue?"
                value={newPainPoint.issue}
                onChange={(e) => setNewPainPoint((prev) => ({ ...prev, issue: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && newPainPoint.issue.trim() && addPainPoint()}
              />
              <Input
                placeholder="What would fix it? (optional)"
                value={newPainPoint.solution}
                onChange={(e) => setNewPainPoint((prev) => ({ ...prev, solution: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && newPainPoint.issue.trim() && addPainPoint()}
              />
              <Button
                variant={newPainPoint.issue.trim() ? 'default' : 'outline'}
                onClick={addPainPoint}
                disabled={!newPainPoint.issue.trim()}
                className="w-full gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Issue
              </Button>
            </div>

            {/* Accommodation feedback */}
            <div className="space-y-3">
              <Label>How was your accommodation?</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'loved_it', label: 'Loved it', Icon: Heart },
                  { value: 'good_location', label: 'Great location', Icon: MapPin },
                  { value: 'would_change', label: "Would change", Icon: RefreshCw },
                  { value: 'too_far', label: 'Too far out', Icon: Car },
                ].map((option) => (
                  <Button
                    key={option.value}
                    variant={accommodationFeedback === option.value ? 'default' : 'outline'}
                    onClick={() => setAccommodationFeedback(option.value as AccommodationFeedback)}
                    className="justify-start gap-2"
                  >
                    <option.Icon className="w-4 h-4" />
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        );

      case 'preferences':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold">What did you discover?</h3>
              <p className="text-sm text-muted-foreground mt-1">
                New preferences you learned about yourself
              </p>
            </div>

            {/* Discovered likes */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                Things you discovered you love
              </Label>
              <div className="flex flex-wrap gap-2">
                {discoveredLikes.map((like, idx) => (
                  <Badge
                    key={idx}
                    variant="secondary"
                    className="gap-1 cursor-pointer"
                    onClick={() => setDiscoveredLikes(discoveredLikes.filter((_, i) => i !== idx))}
                  >
                    {like}
                    <X className="w-3 h-3" />
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g., food tours, sunrise hikes..."
                  value={newLike}
                  onChange={(e) => setNewLike(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && newLike.trim() && addDiscoveredLike()}
                />
                <Button variant={newLike.trim() ? 'default' : 'outline'} onClick={addDiscoveredLike} disabled={!newLike.trim()}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Discovered dislikes */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <ThumbsDown className="w-4 h-4 text-muted-foreground" />
                Things you now know to avoid
              </Label>
              <div className="flex flex-wrap gap-2">
                {discoveredDislikes.map((dislike, idx) => (
                  <Badge
                    key={idx}
                    variant="outline"
                    className="gap-1 cursor-pointer"
                    onClick={() => setDiscoveredDislikes(discoveredDislikes.filter((_, i) => i !== idx))}
                  >
                    {dislike}
                    <X className="w-3 h-3" />
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g., large group tours, loud areas..."
                  value={newDislike}
                  onChange={(e) => setNewDislike(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && newDislike.trim() && addDiscoveredDislike()}
                />
                <Button variant={newDislike.trim() ? 'default' : 'outline'} onClick={addDiscoveredDislike} disabled={!newDislike.trim()}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Best time of day */}
            <div className="space-y-3">
              <Label>When were you at your best?</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'morning_person', label: 'Morning', icon: <Sun className="w-4 h-4" /> },
                  { value: 'afternoon_explorer', label: 'Afternoon', icon: <Sunset className="w-4 h-4" /> },
                  { value: 'evening_adventurer', label: 'Evening', icon: <Moon className="w-4 h-4" /> },
                  { value: 'flexible', label: 'Flexible', icon: <RotateCcw className="w-4 h-4" /> },
                ].map((option) => (
                  <Button
                    key={option.value}
                    variant={bestTimeOfDay === option.value ? 'default' : 'outline'}
                    onClick={() => setBestTimeOfDay(option.value as BestTimeOfDay)}
                    className="justify-start gap-2"
                  >
                    {option.icon}
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        );

      case 'summary':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold">Final thoughts</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Anything else that would help us improve?
              </p>
            </div>

            <div className="space-y-3">
              <Label>Travel party notes</Label>
              <Textarea
                placeholder="e.g., Kids got tired after 4pm, partner loved the food tours..."
                value={travelPartyNotes}
                onChange={(e) => setTravelPartyNotes(e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-3">
              <Label>What would you do differently?</Label>
              <Textarea
                placeholder="e.g., Stay in a more central area, book fewer activities..."
                value={wouldChange}
                onChange={(e) => setWouldChange(e.target.value)}
                rows={2}
              />
            </div>

            {/* Summary preview */}
            <div className="p-4 bg-primary/5 rounded-lg border border-primary/10">
              <div className="flex items-start gap-2">
                <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Your feedback will help us:</p>
                  <ul className="text-xs text-muted-foreground mt-1 space-y-1">
                    <li>• Personalize your future itineraries</li>
                    <li>• Avoid things you didn't enjoy</li>
                    <li>• Include more of what you loved</li>
                    <li>• Match your preferred pace and timing</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Trip Debrief</DialogTitle>
        {/* Progress bar */}
        <div className="flex gap-1 mb-4">
          {STEPS.map((step, idx) => (
            <div
              key={step}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors',
                idx <= stepIndex ? 'bg-primary' : 'bg-muted'
              )}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex justify-between mt-6 pt-4 border-t">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={isFirstStep}
            className="gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={submitLearning.isPending}
            className="gap-2"
          >
            {isLastStep ? (
              <>
                <Check className="w-4 h-4" />
                {submitLearning.isPending ? 'Saving...' : 'Complete'}
              </>
            ) : (
              <>
                Next
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TripDebriefModal;
