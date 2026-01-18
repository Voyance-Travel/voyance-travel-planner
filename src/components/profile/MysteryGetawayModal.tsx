import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  MapPin, 
  Check, 
  ArrowRight,
  Star,
  Loader2,
  X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

export default function MysteryGetawayModal({ open, onOpenChange }: MysteryGetawayModalProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<DestinationSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [archetype, setArchetype] = useState<string>('');
  const [step, setStep] = useState<'intro' | 'reveal' | 'selected'>('intro');

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please sign in to use Mystery Getaway');
        return;
      }

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
    navigate('/planner');
    toast.success(`Let's plan your trip to ${selected.city}!`);
  };

  const resetModal = () => {
    setSuggestions([]);
    setSelectedIndex(null);
    setStep('intro');
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

              <Button 
                size="lg" 
                onClick={fetchSuggestions}
                disabled={loading}
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
                  <motion.button
                    key={`${dest.city}-${index}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.15 }}
                    onClick={() => handleSelect(index)}
                    className={cn(
                      "w-full text-left rounded-xl overflow-hidden border-2 transition-all",
                      "hover:border-primary hover:shadow-lg",
                      selectedIndex === index 
                        ? "border-primary ring-2 ring-primary/20" 
                        : "border-border"
                    )}
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
                  </motion.button>
                ))}
              </div>

              <p className="text-xs text-muted-foreground text-center mt-4">
                Click a destination to see more details and start planning
              </p>
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
