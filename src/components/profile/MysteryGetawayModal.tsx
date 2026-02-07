import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  MapPin, 
  Check, 
  ArrowRight,
  Star,
  Loader2,
  X,
  ThumbsDown,
  Heart
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useSpendCredits } from '@/hooks/useSpendCredits';
import { useCredits } from '@/hooks/useCredits';

interface DestinationSuggestion {
  city: string;
  country: string;
  reason: string;
  matchScore: number;
  highlights: string[];
  image: string;
  region?: string;
}

interface MysteryGetawayModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DECLINE_REASONS = [
  { id: 'been_there', label: "I've already been there" },
  { id: 'not_interested', label: "Not interested in this destination" },
  { id: 'too_expensive', label: "Too expensive for my budget" },
  { id: 'wrong_climate', label: "Not the right climate/weather" },
  { id: 'too_far', label: "Too far to travel" },
  { id: 'safety_concerns', label: "Safety or travel concerns" },
  { id: 'wrong_vibe', label: "Doesn't match my travel style" },
];

export default function MysteryGetawayModal({ open, onOpenChange }: MysteryGetawayModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const spendCredits = useSpendCredits();
  const { data: credits } = useCredits();
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<DestinationSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [archetype, setArchetype] = useState<string>('');
  const [step, setStep] = useState<'intro' | 'reveal' | 'selected' | 'feedback'>('intro');
  
  // Feedback state
  const [feedbackDestination, setFeedbackDestination] = useState<DestinationSuggestion | null>(null);
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [additionalFeedback, setAdditionalFeedback] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [savingFavorite, setSavingFavorite] = useState(false);

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please sign in to use Mystery Getaway');
        return;
      }

      // Deduct credits first
      await spendCredits.mutateAsync({ action: 'MYSTERY_GETAWAY' });

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/suggest-mystery-trips`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 429) {
          toast.error('Too many requests. Please try again in a moment.');
        } else if (response.status === 402) {
          toast.error('Service temporarily unavailable. Please try again later.');
        } else {
          toast.error(error.error || 'Failed to generate suggestions');
        }
        return;
      }

      const data = await response.json();
      setSuggestions(data.suggestions || []);
      setArchetype(data.userProfile?.archetype || 'Traveler');
      setStep('reveal');
    } catch (error) {
      console.error('Mystery getaway error:', error);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (index: number) => {
    setSelectedIndex(index);
    setStep('selected');
  };

  const handleDecline = (destination: DestinationSuggestion) => {
    setFeedbackDestination(destination);
    setSelectedReasons([]);
    setAdditionalFeedback('');
    setStep('feedback');
  };

  const submitFeedback = async () => {
    if (!feedbackDestination || !user?.id) return;
    
    setSubmittingFeedback(true);
    try {
      // Check if this destination has been declined before
      const { data: existing } = await supabase
        .from('user_enrichment')
        .select('id, decline_count')
        .eq('user_id', user.id)
        .eq('enrichment_type', 'destination_decline')
        .eq('entity_id', `${feedbackDestination.city.toLowerCase()}_${feedbackDestination.country.toLowerCase()}`)
        .maybeSingle();

      if (existing) {
        // Update existing record
        const newCount = (existing.decline_count || 1) + 1;
        await supabase
          .from('user_enrichment')
          .update({
            decline_count: newCount,
            feedback_tags: selectedReasons,
            feedback_reason: additionalFeedback || null,
            // After 3 declines, suppress for 30 days
            suppress_until: newCount >= 3 
              ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() 
              : null,
            is_permanent_suppress: newCount >= 5, // After 5, permanently suppress
            metadata: { last_decline_at: new Date().toISOString() },
          })
          .eq('id', existing.id);
      } else {
        // Insert new record
        await supabase
          .from('user_enrichment')
          .insert({
            user_id: user.id,
            enrichment_type: 'destination_decline',
            entity_type: 'destination',
            entity_id: `${feedbackDestination.city.toLowerCase()}_${feedbackDestination.country.toLowerCase()}`,
            entity_name: `${feedbackDestination.city}, ${feedbackDestination.country}`,
            feedback_tags: selectedReasons,
            feedback_reason: additionalFeedback || null,
            decline_count: 1,
            metadata: { first_decline_at: new Date().toISOString() },
          });
      }

      toast.success('Thanks for your feedback! We\'ll improve your suggestions.');
      
      // Remove declined destination from current suggestions
      setSuggestions(prev => prev.filter(s => 
        s.city !== feedbackDestination.city || s.country !== feedbackDestination.country
      ));
      
      setFeedbackDestination(null);
      setStep('reveal');
    } catch (error) {
      console.error('Feedback error:', error);
      toast.error('Failed to save feedback. Please try again.');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleBuildTrip = () => {
    if (selectedIndex === null) return;
    const selected = suggestions[selectedIndex];
    
    // Store in localStorage and navigate to planner
    localStorage.setItem('voyance_pending_trip', JSON.stringify({
      destination: selected.city,
      destinationCountry: selected.country,
      source: 'mystery_getaway',
    }));
    
    onOpenChange(false);
    navigate('/start');
    toast.success(`Let's plan your trip to ${selected.city}!`);
  };

  const handleSaveForLater = async () => {
    if (selectedIndex === null || !user?.id) return;
    const selected = suggestions[selectedIndex];
    
    setSavingFavorite(true);
    try {
      // Check if already saved
      const entityId = `${selected.city.toLowerCase()}_${selected.country.toLowerCase()}`;
      const { data: existing } = await supabase
        .from('user_enrichment')
        .select('id')
        .eq('user_id', user.id)
        .eq('enrichment_type', 'mystery_trip_favorite')
        .eq('entity_id', entityId)
        .maybeSingle();

      if (existing) {
        toast.info(`${selected.city} is already in your favorites!`);
        return;
      }

      // Save as favorite
      const { error } = await supabase
        .from('user_enrichment')
        .insert({
          user_id: user.id,
          enrichment_type: 'mystery_trip_favorite',
          entity_type: 'destination',
          entity_id: entityId,
          entity_name: `${selected.city}, ${selected.country}`,
          metadata: {
            city: selected.city,
            country: selected.country,
            region: selected.region || null,
            reason: selected.reason,
            matchScore: selected.matchScore,
            highlights: selected.highlights,
            image: selected.image,
            savedAt: new Date().toISOString(),
          },
        });

      if (error) throw error;

      toast.success(`${selected.city} saved to your favorites!`, {
        description: 'Find it in your profile to build the trip later.',
      });
      
      // Optionally close modal or go back to reveal
      setStep('reveal');
    } catch (error) {
      console.error('Save favorite error:', error);
      toast.error('Failed to save. Please try again.');
    } finally {
      setSavingFavorite(false);
    }
  };

  const resetModal = () => {
    setSuggestions([]);
    setSelectedIndex(null);
    setFeedbackDestination(null);
    setSelectedReasons([]);
    setAdditionalFeedback('');
    setStep('intro');
  };

  const toggleReason = (reasonId: string) => {
    setSelectedReasons(prev => 
      prev.includes(reasonId) 
        ? prev.filter(r => r !== reasonId)
        : [...prev, reasonId]
    );
  };

  return (
    <Dialog 
      open={open} 
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen);
        if (!isOpen) resetModal();
      }}
    >
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <AnimatePresence mode="wait">
          {step === 'intro' && (
            <motion.div
              key="intro"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-8 text-center"
            >
              <DialogHeader className="mb-6">
                <motion.div
                  animate={{ rotate: [0, -5, 5, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4"
                >
                  <Sparkles className="h-8 w-8 text-primary" />
                </motion.div>
                <DialogTitle className="font-display text-3xl">Mystery Getaway</DialogTitle>
              </DialogHeader>

              <p className="text-muted-foreground text-lg mb-8 max-w-md mx-auto">
                Based on your Travel DNA and preferences, we'll suggest 3 destinations 
                we think you'd love. Pick your favorite, and we'll help you build the perfect trip.
              </p>

              {credits && credits.totalCredits < 15 && (
                <p className="text-sm text-destructive mb-4">
                  You don't have enough credits for this feature. Purchase more to continue.
                </p>
              )}

              <Button 
                size="lg" 
                onClick={fetchSuggestions}
                disabled={loading || (credits ? credits.totalCredits < 15 : false)}
                className="gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Finding Your Perfect Matches...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Reveal My Destinations
                  </>
                )}
              </Button>
            </motion.div>
          )}

          {step === 'reveal' && suggestions.length > 0 && (
            <motion.div
              key="reveal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-6"
            >
              <DialogHeader className="mb-4">
                <DialogTitle className="font-display text-2xl text-center">
                  We Think You'd Love...
                </DialogTitle>
                <p className="text-muted-foreground text-sm text-center mt-1">
                  Curated for the <span className="text-primary font-medium">{archetype}</span> in you
                </p>
              </DialogHeader>

              <div className="space-y-4">
                {suggestions.map((dest, index) => (
                  <motion.div
                    key={`${dest.city}-${index}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.15 }}
                    className={cn(
                      "rounded-xl overflow-hidden border-2 transition-all",
                      selectedIndex === index 
                        ? "border-primary ring-2 ring-primary/20" 
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <button
                      onClick={() => handleSelect(index)}
                      className="w-full text-left"
                    >
                      <div className="flex gap-4 p-4">
                        <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0">
                          <img
                            src={dest.image}
                            alt={dest.city}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-display text-xl font-semibold">
                                {dest.city}
                              </h3>
                              <p className="text-muted-foreground text-sm flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {dest.country}
                              </p>
                            </div>
                            <Badge variant="secondary" className="gap-1 flex-shrink-0">
                              <Star className="h-3 w-3 fill-current" />
                              {dest.matchScore}% match
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                            {dest.reason}
                          </p>
                        </div>
                      </div>
                    </button>
                    {/* Decline button */}
                    <div className="px-4 pb-3 flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive gap-1.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDecline(dest);
                        }}
                      >
                        <ThumbsDown className="h-3.5 w-3.5" />
                        Not for me
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>

              {suggestions.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">
                    You've reviewed all suggestions. Would you like new ones?
                  </p>
                  <Button onClick={fetchSuggestions} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Get New Suggestions
                  </Button>
                </div>
              )}

              <p className="text-xs text-muted-foreground text-center mt-4">
                Click a destination to see more details and start planning
              </p>
            </motion.div>
          )}

          {step === 'feedback' && feedbackDestination && (
            <motion.div
              key="feedback"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-6"
            >
              <DialogHeader className="mb-6">
                <DialogTitle className="font-display text-2xl text-center">
                  Help Us Understand
                </DialogTitle>
                <p className="text-muted-foreground text-sm text-center mt-1">
                  Why isn't <span className="font-medium text-foreground">{feedbackDestination.city}</span> the right fit?
                </p>
              </DialogHeader>

              <div className="space-y-3 mb-6">
                {DECLINE_REASONS.map((reason) => (
                  <label
                    key={reason.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                      selectedReasons.includes(reason.id)
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <Checkbox
                      checked={selectedReasons.includes(reason.id)}
                      onCheckedChange={() => toggleReason(reason.id)}
                    />
                    <span className="text-sm">{reason.label}</span>
                  </label>
                ))}
              </div>

              <div className="mb-6">
                <label className="text-sm font-medium mb-2 block">
                  Anything else? (optional)
                </label>
                <Textarea
                  placeholder="Tell us more about what you're looking for..."
                  value={additionalFeedback}
                  onChange={(e) => setAdditionalFeedback(e.target.value)}
                  className="resize-none"
                  rows={3}
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep('reveal')}
                >
                  Skip
                </Button>
                <Button
                  className="flex-1"
                  onClick={submitFeedback}
                  disabled={submittingFeedback || selectedReasons.length === 0}
                >
                  {submittingFeedback ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Submit Feedback
                </Button>
              </div>
            </motion.div>
          )}

          {step === 'selected' && selectedIndex !== null && (
            <motion.div
              key="selected"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-0"
            >
              <div className="relative h-48 overflow-hidden">
                <img
                  src={suggestions[selectedIndex].image}
                  alt={suggestions[selectedIndex].city}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-4 right-4 bg-background/50 backdrop-blur-sm"
                  onClick={() => setStep('reveal')}
                >
                  <X className="h-4 w-4" />
                </Button>
                <div className="absolute bottom-4 left-6">
                  <Badge variant="secondary" className="gap-1 mb-2">
                    <Star className="h-3 w-3 fill-current" />
                    {suggestions[selectedIndex].matchScore}% match
                  </Badge>
                  <h2 className="font-display text-3xl font-bold text-foreground">
                    {suggestions[selectedIndex].city}
                  </h2>
                  <p className="text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {suggestions[selectedIndex].country}
                    {suggestions[selectedIndex].region && ` · ${suggestions[selectedIndex].region}`}
                  </p>
                </div>
              </div>

              <div className="p-6">
                <div className="mb-6">
                  <h3 className="font-semibold mb-2">Why We Think You'll Love It</h3>
                  <p className="text-muted-foreground">
                    {suggestions[selectedIndex].reason}
                  </p>
                </div>

                <div className="mb-6">
                  <h3 className="font-semibold mb-3">Perfect Experiences For You</h3>
                  <div className="space-y-2">
                    {suggestions[selectedIndex].highlights.map((highlight, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-muted-foreground">{highlight}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setStep('reveal')}
                  >
                    Choose Another
                  </Button>
                  <Button
                    variant="secondary"
                    className="gap-2"
                    onClick={handleSaveForLater}
                    disabled={savingFavorite}
                  >
                    {savingFavorite ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Heart className="h-4 w-4" />
                    )}
                    Save
                  </Button>
                  <Button 
                    className="flex-1 gap-2"
                    onClick={handleBuildTrip}
                  >
                    Build This Trip
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}