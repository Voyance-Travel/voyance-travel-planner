import { useState } from 'react';
import { getLocalToday } from '@/utils/dateUtils';
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
  Heart,
  Calendar,
  Plane,
  Hotel,
  ArrowLeft,
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
import { useCreateTrip } from '@/hooks/useVoyanceAPI';

interface DestinationSuggestion {
  city: string;
  country: string;
  reason: string;
  matchScore: number;
  highlights: string[];
  image: string;
  region?: string;
}

interface HotelSuggestion {
  name: string;
  neighborhood: string;
  starRating: number;
  pricePerNight: number;
  totalEstimate: number;
  whyMatch: string;
  amenityHighlights: string[];
  tier: 'value' | 'comfort' | 'premium';
}

interface FlightEstimate {
  priceRangeLow: number;
  priceRangeHigh: number;
  typicalAirline: string;
  flightDuration: string;
  departureCity: string;
}

interface MysteryGetawayModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 'intro' | 'reveal' | 'selected' | 'feedback' | 'dates' | 'logistics' | 'summary';

const DECLINE_REASONS = [
  { id: 'been_there', label: "I've already been there" },
  { id: 'not_interested', label: "Not interested in this destination" },
  { id: 'too_expensive', label: "Too expensive for my budget" },
  { id: 'wrong_climate', label: "Not the right climate/weather" },
  { id: 'too_far', label: "Too far to travel" },
  { id: 'safety_concerns', label: "Safety or travel concerns" },
  { id: 'wrong_vibe', label: "Doesn't match my travel style" },
];

const TIER_LABELS: Record<string, string> = {
  value: '💰 Value',
  comfort: '⭐ Comfort',
  premium: '✨ Premium',
};

export default function MysteryGetawayModal({ open, onOpenChange }: MysteryGetawayModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const spendCredits = useSpendCredits();
  const { data: credits } = useCredits();
  const createTrip = useCreateTrip();
  
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<DestinationSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [archetype, setArchetype] = useState<string>('');
  const [step, setStep] = useState<Step>('intro');
  
  // Date state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Logistics state
  const [loadingLogistics, setLoadingLogistics] = useState(false);
  const [flightEstimate, setFlightEstimate] = useState<FlightEstimate | null>(null);
  const [hotelSuggestions, setHotelSuggestions] = useState<HotelSuggestion[]>([]);
  const [selectedHotelIndex, setSelectedHotelIndex] = useState<number | null>(null);
  const [departureCity, setDepartureCity] = useState('');
  
  // Feedback state
  const [feedbackDestination, setFeedbackDestination] = useState<DestinationSuggestion | null>(null);
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [additionalFeedback, setAdditionalFeedback] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [savingFavorite, setSavingFavorite] = useState(false);
  const [creatingTrip, setCreatingTrip] = useState(false);

  const selectedDestination = selectedIndex !== null ? suggestions[selectedIndex] : null;

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
        if (response.status === 429) toast.error('Too many requests. Please try again in a moment.');
        else if (response.status === 402) toast.error('Service temporarily unavailable. Please try again later.');
        else toast.error(error.error || 'Failed to generate suggestions');
        return;
      }

      const data = await response.json();

      // Charge credits AFTER successful API response (charge-on-success pattern)
      try {
        await spendCredits.mutateAsync({ action: 'MYSTERY_GETAWAY' });
      } catch {
        console.warn('[MysteryGetaway] Credit charge failed post-response');
      }

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
      const { data: existing } = await supabase
        .from('user_enrichment')
        .select('id, decline_count')
        .eq('user_id', user.id)
        .eq('enrichment_type', 'destination_decline')
        .eq('entity_id', `${feedbackDestination.city.toLowerCase()}_${feedbackDestination.country.toLowerCase()}`)
        .maybeSingle();

      if (existing) {
        const newCount = (existing.decline_count || 1) + 1;
        await supabase
          .from('user_enrichment')
          .update({
            decline_count: newCount,
            feedback_tags: selectedReasons,
            feedback_reason: additionalFeedback || null,
            suppress_until: newCount >= 3 
              ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() 
              : null,
            is_permanent_suppress: newCount >= 5,
            metadata: { last_decline_at: new Date().toISOString() },
          })
          .eq('id', existing.id);
      } else {
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

  const handleProceedToDates = () => {
    setStep('dates');
  };

  const handleFetchLogistics = async () => {
    if (!selectedDestination || !startDate || !endDate) return;
    
    setLoadingLogistics(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please sign in');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mystery-trip-logistics`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            destination: selectedDestination.city,
            country: selectedDestination.country,
            startDate,
            endDate,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 429) toast.error('Too many requests. Please try again.');
        else if (response.status === 402) toast.error('Service temporarily unavailable.');
        else toast.error(error.error || 'Failed to get logistics');
        return;
      }

      const data = await response.json();

      // Charge credits AFTER successful API response (charge-on-success pattern)
      try {
        await spendCredits.mutateAsync({ action: 'MYSTERY_LOGISTICS' });
      } catch {
        console.warn('[MysteryGetaway] Logistics credit charge failed post-response');
      }

      setFlightEstimate(data.flightEstimate);
      setHotelSuggestions(data.hotelSuggestions || []);
      setDepartureCity(data.departureCity || '');
      setSelectedHotelIndex(null);
      setStep('logistics');
    } catch (error) {
      console.error('Logistics error:', error);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoadingLogistics(false);
    }
  };

  const handleGoToSummary = () => {
    setStep('summary');
  };

  const handleBuildTrip = async () => {
    if (!selectedDestination || !startDate || !endDate) return;
    
    setCreatingTrip(true);
    try {
      const days = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
      const selectedHotel = selectedHotelIndex !== null ? hotelSuggestions[selectedHotelIndex] : null;

      const tripData = await createTrip.mutateAsync({
        name: `Mystery Trip: ${selectedDestination.city}`,
        destination: selectedDestination.city,
        startDate,
        endDate,
        travelers: 1,
        originCity: departureCity || undefined,
        budgetTier: 'moderate',
        tripType: 'leisure',
        creationSource: 'mystery_getaway',
      });

      // If hotel was selected, save it to the trip
      if (selectedHotel && tripData?.id) {
        await supabase
          .from('trips')
          .update({
            hotel_selection: JSON.parse(JSON.stringify([{
              name: selectedHotel.name,
              starRating: selectedHotel.starRating,
              pricePerNight: selectedHotel.pricePerNight,
              totalPrice: selectedHotel.totalEstimate,
              currency: 'USD',
              roomType: 'Standard',
              amenities: selectedHotel.amenityHighlights,
              checkIn: startDate,
              checkOut: endDate,
              source: 'mystery_getaway_ai',
            }])),
          })
          .eq('id', tripData.id);
      }

      onOpenChange(false);
      navigate(`/trip/${tripData.id}?generate=true`);
      toast.success(`Let's build your trip to ${selectedDestination.city}!`);
    } catch (error) {
      console.error('Create trip error:', error);
      toast.error('Failed to create trip. Please try again.');
    } finally {
      setCreatingTrip(false);
    }
  };

  const handleSaveForLater = async () => {
    if (selectedIndex === null || !user?.id) return;
    const selected = suggestions[selectedIndex];
    setSavingFavorite(true);
    try {
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
      toast.success(`${selected.city} saved to your favorites!`);
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
    setStartDate('');
    setEndDate('');
    setFlightEstimate(null);
    setHotelSuggestions([]);
    setSelectedHotelIndex(null);
    setDepartureCity('');
    setStep('intro');
  };

  const toggleReason = (reasonId: string) => {
    setSelectedReasons(prev => 
      prev.includes(reasonId) 
        ? prev.filter(r => r !== reasonId)
        : [...prev, reasonId]
    );
  };

  const datesValid = startDate && endDate && startDate <= endDate;
  const totalDays = startDate && endDate 
    ? Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) 
    : 0;

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
          {/* STEP: INTRO */}
          {step === 'intro' && (
            <motion.div key="intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-8 text-center">
              <DialogHeader className="mb-6">
                <motion.div animate={{ rotate: [0, -5, 5, 0] }} transition={{ duration: 2, repeat: Infinity }} className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Sparkles className="h-8 w-8 text-primary" />
                </motion.div>
                <DialogTitle className="font-display text-3xl">Mystery Getaway</DialogTitle>
              </DialogHeader>
              <p className="text-muted-foreground text-lg mb-8 max-w-md mx-auto">
                Based on your Travel DNA and preferences, we'll suggest 3 destinations, 
                help you pick dates, estimate flights, and suggest hotels, all in one flow.
              </p>
              {credits && credits.totalCredits < 15 && (
                <p className="text-sm text-destructive mb-4">You don't have enough credits for this feature.</p>
              )}
              <Button size="lg" onClick={fetchSuggestions} disabled={loading || !credits || credits.totalCredits < 15} className="gap-2">
                {loading ? (<><Loader2 className="h-4 w-4 animate-spin" />Finding Your Perfect Matches...</>) : (<><Sparkles className="h-4 w-4" />Reveal My Destinations</>)}
              </Button>
            </motion.div>
          )}

          {/* STEP: REVEAL DESTINATIONS */}
          {step === 'reveal' && suggestions.length > 0 && (
            <motion.div key="reveal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-6">
              <DialogHeader className="mb-4">
                <DialogTitle className="font-display text-2xl text-center">We Think You'd Love...</DialogTitle>
                <p className="text-muted-foreground text-sm text-center mt-1">
                  Curated for the <span className="text-primary font-medium">{archetype}</span> in you
                </p>
              </DialogHeader>
              <div className="space-y-4">
                {suggestions.map((dest, index) => (
                  <motion.div key={`${dest.city}-${index}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.15 }}
                    className={cn("rounded-xl overflow-hidden border-2 transition-all", selectedIndex === index ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/50")}>
                    <button onClick={() => handleSelect(index)} className="w-full text-left">
                      <div className="flex gap-4 p-4">
                        <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0">
                          <img src={dest.image} alt={dest.city} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-display text-xl font-semibold">{dest.city}</h3>
                              <p className="text-muted-foreground text-sm flex items-center gap-1"><MapPin className="h-3 w-3" />{dest.country}</p>
                            </div>
                            <Badge variant="secondary" className="gap-1 flex-shrink-0"><Star className="h-3 w-3 fill-current" />{dest.matchScore}% match</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{dest.reason}</p>
                        </div>
                      </div>
                    </button>
                    <div className="px-4 pb-3 flex justify-end">
                      <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive gap-1.5"
                        onClick={(e) => { e.stopPropagation(); handleDecline(dest); }}>
                        <ThumbsDown className="h-3.5 w-3.5" />Not for me
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
              {suggestions.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">You've reviewed all suggestions. Would you like new ones?</p>
                  <Button onClick={fetchSuggestions} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Get New Suggestions
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground text-center mt-4">Click a destination to see more details and start planning</p>
            </motion.div>
          )}

          {/* STEP: FEEDBACK */}
          {step === 'feedback' && feedbackDestination && (
            <motion.div key="feedback" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-6">
              <DialogHeader className="mb-6">
                <DialogTitle className="font-display text-2xl text-center">Help Us Understand</DialogTitle>
                <p className="text-muted-foreground text-sm text-center mt-1">
                  Why isn't <span className="font-medium text-foreground">{feedbackDestination.city}</span> the right fit?
                </p>
              </DialogHeader>
              <div className="space-y-3 mb-6">
                {DECLINE_REASONS.map((reason) => (
                  <label key={reason.id} className={cn("flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                    selectedReasons.includes(reason.id) ? "border-primary bg-primary/5" : "border-border hover:border-primary/50")}>
                    <Checkbox checked={selectedReasons.includes(reason.id)} onCheckedChange={() => toggleReason(reason.id)} />
                    <span className="text-sm">{reason.label}</span>
                  </label>
                ))}
              </div>
              <div className="mb-6">
                <label className="text-sm font-medium mb-2 block">Anything else? (optional)</label>
                <Textarea placeholder="Tell us more about what you're looking for..." value={additionalFeedback} onChange={(e) => setAdditionalFeedback(e.target.value)} className="resize-none" rows={3} />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setStep('reveal')}>Skip</Button>
                <Button className="flex-1" onClick={submitFeedback} disabled={submittingFeedback || selectedReasons.length === 0}>
                  {submittingFeedback ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Submit Feedback
                </Button>
              </div>
            </motion.div>
          )}

          {/* STEP: SELECTED DESTINATION DETAIL */}
          {step === 'selected' && selectedDestination && (
            <motion.div key="selected" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-0">
              <div className="relative h-48 overflow-hidden">
                <img src={selectedDestination.image} alt={selectedDestination.city} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
                <Button variant="ghost" size="icon" className="absolute top-4 right-4 bg-background/50 backdrop-blur-sm" onClick={() => setStep('reveal')}>
                  <X className="h-4 w-4" />
                </Button>
                <div className="absolute bottom-4 left-6">
                  <Badge variant="secondary" className="gap-1 mb-2"><Star className="h-3 w-3 fill-current" />{selectedDestination.matchScore}% match</Badge>
                  <h2 className="font-display text-3xl font-bold text-foreground">{selectedDestination.city}</h2>
                  <p className="text-muted-foreground flex items-center gap-1"><MapPin className="h-4 w-4" />{selectedDestination.country}{selectedDestination.region && ` · ${selectedDestination.region}`}</p>
                </div>
              </div>
              <div className="p-6">
                <div className="mb-6">
                  <h3 className="font-semibold mb-2">Why We Think You'll Love It</h3>
                  <p className="text-muted-foreground">{selectedDestination.reason}</p>
                </div>
                <div className="mb-6">
                  <h3 className="font-semibold mb-3">Perfect Experiences For You</h3>
                  <div className="space-y-2">
                    {selectedDestination.highlights.map((highlight, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-muted-foreground">{highlight}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setStep('reveal')}>Choose Another</Button>
                  <Button variant="secondary" className="gap-2" onClick={handleSaveForLater} disabled={savingFavorite}>
                    {savingFavorite ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className="h-4 w-4" />}Save
                  </Button>
                  <Button className="flex-1 gap-2" onClick={handleProceedToDates}>
                    Plan This Trip<ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP: DATE SELECTION */}
          {step === 'dates' && selectedDestination && (
            <motion.div key="dates" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-6">
              <DialogHeader className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setStep('selected')}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <DialogTitle className="font-display text-2xl">When are you going?</DialogTitle>
                </div>
                <p className="text-muted-foreground text-sm ml-10">
                  Pick your travel dates for <span className="text-primary font-medium">{selectedDestination.city}</span>
                </p>
              </DialogHeader>

              <div className="space-y-4 mb-8">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    min={getLocalToday()}
                    className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    style={{ fontSize: '16px' }}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate || getLocalToday()}
                    className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    style={{ fontSize: '16px' }}
                  />
                </div>
                {datesValid && (
                  <p className="text-sm text-muted-foreground text-center">
                    {totalDays} day{totalDays > 1 ? 's' : ''} in {selectedDestination.city}
                  </p>
                )}
              </div>

              <div className="bg-muted/50 rounded-lg p-3 mb-6">
                <p className="text-xs text-muted-foreground text-center">
                  <Sparkles className="h-3 w-3 inline mr-1" />
                  Next: We'll estimate flight costs and suggest hotels (5 credits)
                </p>
              </div>

              <Button className="w-full h-12 gap-2" onClick={handleFetchLogistics} disabled={!datesValid || loadingLogistics}>
                {loadingLogistics ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Estimating flights & hotels...</>
                ) : (
                  <><Plane className="h-4 w-4" />Get Flight & Hotel Estimates</>
                )}
              </Button>
            </motion.div>
          )}

          {/* STEP: LOGISTICS (Flight + Hotels) */}
          {step === 'logistics' && selectedDestination && (
            <motion.div key="logistics" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-6">
              <DialogHeader className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setStep('dates')}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <DialogTitle className="font-display text-2xl">Trip Logistics</DialogTitle>
                </div>
                <p className="text-muted-foreground text-sm ml-10">
                  {selectedDestination.city} · {totalDays} days
                </p>
              </DialogHeader>

              {/* Flight Estimate */}
              {flightEstimate && (
                <div className="rounded-xl border border-border p-4 mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Plane className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-sm">Estimated Flight</h3>
                  </div>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-2xl font-display font-bold">${flightEstimate.priceRangeLow}</span>
                    <span className="text-muted-foreground">–</span>
                    <span className="text-2xl font-display font-bold">${flightEstimate.priceRangeHigh}</span>
                    <span className="text-sm text-muted-foreground ml-1">round trip</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{flightEstimate.departureCity} → {selectedDestination.city}</span>
                    <span>·</span>
                    <span>{flightEstimate.flightDuration}</span>
                    <span>·</span>
                    <span>{flightEstimate.typicalAirline}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    AI estimate. Actual prices may vary. You can add real flight details later.
                  </p>
                </div>
              )}

              {/* Hotel Suggestions */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Hotel className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-sm">Suggested Hotels</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">Optional. You can add from itinerary</p>
                </div>

                <div className="space-y-3">
                  {hotelSuggestions.map((hotel, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedHotelIndex(selectedHotelIndex === index ? null : index)}
                      className={cn(
                        "w-full text-left rounded-xl border-2 p-4 transition-all",
                        selectedHotelIndex === index
                          ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-sm">{hotel.name}</h4>
                            <Badge variant="outline" className="text-xs">{TIER_LABELS[hotel.tier] || hotel.tier}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{hotel.neighborhood}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="font-display font-bold">${hotel.pricePerNight}<span className="text-xs font-normal text-muted-foreground">/night</span></div>
                          <div className="text-xs text-muted-foreground">~${hotel.totalEstimate} total</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 mb-2">
                        {Array.from({ length: hotel.starRating }).map((_, i) => (
                          <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{hotel.whyMatch}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {hotel.amenityHighlights.map((amenity, i) => (
                          <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded-full">{amenity}</span>
                        ))}
                      </div>
                      {selectedHotelIndex === index && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-primary">
                          <Check className="h-3 w-3" /> Selected
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <Button className="w-full h-12 gap-2" onClick={handleGoToSummary}>
                Review & Build Trip<ArrowRight className="h-4 w-4" />
              </Button>
            </motion.div>
          )}

          {/* STEP: SUMMARY */}
          {step === 'summary' && selectedDestination && (
            <motion.div key="summary" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-6">
              <DialogHeader className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setStep('logistics')}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <DialogTitle className="font-display text-2xl">Trip Summary</DialogTitle>
                </div>
              </DialogHeader>

              <div className="rounded-xl border border-border overflow-hidden mb-6">
                <div className="relative h-32 overflow-hidden">
                  <img src={selectedDestination.image} alt={selectedDestination.city} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
                  <div className="absolute bottom-3 left-4">
                    <h3 className="font-display text-2xl font-bold text-foreground">{selectedDestination.city}</h3>
                    <p className="text-sm text-muted-foreground">{selectedDestination.country}</p>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  {/* Dates */}
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} to {new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                      <p className="text-xs text-muted-foreground">{totalDays} days</p>
                    </div>
                  </div>

                  {/* Flight */}
                  {flightEstimate && (
                    <div className="flex items-center gap-3">
                      <Plane className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">${flightEstimate.priceRangeLow}–${flightEstimate.priceRangeHigh} estimated</p>
                        <p className="text-xs text-muted-foreground">{flightEstimate.departureCity} · {flightEstimate.flightDuration}</p>
                      </div>
                    </div>
                  )}

                  {/* Hotel */}
                  {selectedHotelIndex !== null && hotelSuggestions[selectedHotelIndex] && (
                    <div className="flex items-center gap-3">
                      <Hotel className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{hotelSuggestions[selectedHotelIndex].name}</p>
                        <p className="text-xs text-muted-foreground">
                          ${hotelSuggestions[selectedHotelIndex].pricePerNight}/night · ~${hotelSuggestions[selectedHotelIndex].totalEstimate} total
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedHotelIndex === null && (
                    <div className="flex items-center gap-3">
                      <Hotel className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">No hotel selected. You can add one from the itinerary</p>
                    </div>
                  )}
                </div>
              </div>

              <Button className="w-full h-12 gap-2" onClick={handleBuildTrip} disabled={creatingTrip}>
                {creatingTrip ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Creating your trip...</>
                ) : (
                  <><Sparkles className="h-4 w-4" />Build My Itinerary</>
                )}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
