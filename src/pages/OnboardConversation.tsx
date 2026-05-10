import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, MessageCircle, RefreshCw, Check, ArrowLeft } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { recalculateArchetype } from '@/services/engines/travelDNA/recalculateArchetype';

interface Archetype {
  id: string;
  name: string;
  category: string;
  traits: string[];
}

interface ParsedTraits {
  pace: 'slow' | 'balanced' | 'active';
  social: 'solo' | 'small-group' | 'social';
  planning: 'spontaneous' | 'flexible' | 'structured';
  comfort: 'budget' | 'moderate' | 'luxury';
  authenticity: 'tourist' | 'balanced' | 'local-immersion';
  adventure: 'relaxed' | 'moderate' | 'thrill-seeking';
  whatWorked: string[];
  whatFailed: string[];
}

interface StoryAnalysis {
  primaryArchetype: Archetype;
  secondaryArchetype: Archetype | null;
  traits: ParsedTraits;
  confidence: number;
  reasoning: string;
  followUpQuestion?: string;
}

type Step = 'intro' | 'story' | 'followup' | 'result' | 'confirm';

export default function OnboardConversation() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [step, setStep] = useState<Step>('intro');
  const [story, setStory] = useState('');
  const [followUpAnswer, setFollowUpAnswer] = useState('');
  const [analysis, setAnalysis] = useState<StoryAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // CRITICAL: Synchronous ref guard to prevent race condition on save
  // Multiple rapid clicks can trigger duplicate saves before state updates
  const savingInProgressRef = useRef(false);

  const analyzeStory = useCallback(async (text: string, previousAnalysis?: StoryAnalysis) => {
    setIsAnalyzing(true);
    
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-travel-story`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ 
            story: text,
            previousAnalysis: previousAnalysis || null,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze story');
      }

      const result: StoryAnalysis = await response.json();
      setAnalysis(result);

      // If confidence is low, ask follow-up
      if (result.confidence < 70 && result.followUpQuestion) {
        setStep('followup');
      } else {
        setStep('result');
      }
    } catch (error) {
      console.error('[OnboardConversation] Error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to analyze your story');
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const handleStorySubmit = useCallback(() => {
    if (story.trim().length < 50) {
      toast.error('Please share a bit more detail about your trip (at least a few sentences)');
      return;
    }
    analyzeStory(story);
  }, [story, analyzeStory]);

  const handleFollowUpSubmit = useCallback(() => {
    if (followUpAnswer.trim().length < 10) {
      toast.error('Please provide a bit more detail');
      return;
    }
    // Combine original story with follow-up for re-analysis
    analyzeStory(`${story}\n\nAdditional context: ${followUpAnswer}`, analysis || undefined);
  }, [story, followUpAnswer, analysis, analyzeStory]);

  const handleConfirm = useCallback(async () => {
    if (!analysis || !user) {
      toast.error('Please sign in to save your Travel DNA');
      navigate(ROUTES.SIGNIN);
      return;
    }
    
    // Race condition guard - prevent duplicate saves from rapid clicks
    if (savingInProgressRef.current) {
      console.log('[OnboardConversation] Save already in progress, skipping');
      return;
    }
    savingInProgressRef.current = true;

    setIsSaving(true);

      try {
        // Map traits to the format expected by the database
        // Helper: clamp trait score to canonical [-10, 10] range used by the
        // personalization engine. Any out-of-range value here would poison generation.
        const clamp = (n: number) => Math.max(-10, Math.min(10, n));

        const traitScores = {
          planning: clamp(analysis.traits.planning === 'structured' ? 7 : analysis.traits.planning === 'flexible' ? 0 : -5),
          social: clamp(analysis.traits.social === 'social' ? 7 : analysis.traits.social === 'small-group' ? 2 : -5),
          comfort: clamp(analysis.traits.comfort === 'luxury' ? 7 : analysis.traits.comfort === 'moderate' ? 2 : -4),
          pace: clamp(analysis.traits.pace === 'active' ? 7 : analysis.traits.pace === 'balanced' ? 2 : -4),
          authenticity: clamp(analysis.traits.authenticity === 'local-immersion' ? 8 : analysis.traits.authenticity === 'balanced' ? 3 : -2),
          adventure: clamp(analysis.traits.adventure === 'thrill-seeking' ? 8 : analysis.traits.adventure === 'moderate' ? 3 : -3),
          budget: clamp(analysis.traits.comfort === 'budget' ? 7 : analysis.traits.comfort === 'moderate' ? 2 : -5),
          // CULTURAL — derived from authenticity + the curiosity/depth the user describes.
          // High cultural = cares about history, language, customs, local rituals.
          // Low cultural = wants the destination as a backdrop, not an immersion.
          cultural: clamp((() => {
            const auth = analysis.traits.authenticity;
            const baseFromAuth = auth === 'local-immersion' ? 7 : auth === 'balanced' ? 2 : -3;
            const culturalKeywords = ['museum', 'history', 'ruin', 'monument', 'temple', 'church', 'mosque', 'synagogue', 'gallery', 'heritage', 'tradition', 'language', 'local guide', 'archaeological', 'art'];
            const hits = [story, followUpAnswer, analysis.reasoning || '']
              .join(' ')
              .toLowerCase();
            const culturalSignal = culturalKeywords.filter(kw => hits.includes(kw)).length;
            return baseFromAuth + Math.min(3, culturalSignal);
          })()),
          // TRANSFORMATION — derived from a combination of authenticity, adventure, and
          // explicit transformation/growth language.
          transformation: clamp((() => {
            const auth = analysis.traits.authenticity;
            const adv = analysis.traits.adventure;
            let base = 0;
            if (auth === 'local-immersion') base += 3;
            if (adv === 'thrill-seeking') base += 3;
            else if (adv === 'moderate') base += 1;
            const transformKeywords = ['changed me', 'perspective', 'growth', 'challenge myself', 'push myself', 'reset', 'reflect', 'discover', 'become', 'transform', 'pilgrimage', 'soul-searching', 'sabbatical', 'gap year'];
            const hits = [story, followUpAnswer, analysis.reasoning || '']
              .join(' ')
              .toLowerCase();
            const transformSignal = transformKeywords.filter(kw => hits.includes(kw)).length;
            return base + Math.min(4, transformSignal * 2);
          })()),
        };

        // Atomic 3-table save via SECURITY DEFINER RPC. Either all three writes
        // succeed (travel_dna_profiles + profiles.quiz_completed + user_preferences)
        // or none do — no more partial onboarding state.
        const { data, error } = await supabase.rpc('save_onboarding_dna', {
          p_user_id: user.id,
          p_primary_archetype: analysis.primaryArchetype.name,
          p_secondary_archetype: analysis.secondaryArchetype?.name ?? null,
          p_confidence: Math.round(analysis.confidence),
          p_trait_scores: traitScores,
          p_preferences: {
            travel_pace: analysis.traits.pace,
            travel_companion:
              analysis.traits.social === 'solo'
                ? 'solo'
                : analysis.traits.social === 'social'
                  ? 'friends'
                  : 'partner',
            planning_preference: analysis.traits.planning,
            budget_tier: analysis.traits.comfort,
          },
          p_derivation_source: 'conversation',
        });

        const result = data as { success?: boolean; error?: string } | null;
        if (error) {
          // Network / RPC layer error (function unreachable, auth, transport)
          console.error('[OnboardConversation] save_onboarding_dna RPC error', error);
          toast.error(`Couldn't save your Travel DNA: ${error.message}. Please try again.`);
          return;
        }
        if (!result?.success) {
          // RPC ran but DB write failed inside the SECURITY DEFINER function
          console.error('[OnboardConversation] save_onboarding_dna returned failure', data);
          toast.error(`Save failed: ${result?.error || 'unknown error'}. Please try again.`);
          return;
        }

        // P0.9: Re-derive archetype against the merged trait_scores. The RPC's
        // JSONB merge preserves quiz-only traits (~17) when conversation runs
        // second, but the caller-passed primary_archetype was computed against
        // only the 8 conversation traits and goes stale on merge. Always
        // recalc against the canonical merged keyset.
        const recalc = await recalculateArchetype(user.id);
        if (!recalc.success) {
          console.warn('[OnboardConversation] recalculateArchetype failed (non-fatal)', recalc.error);
        }

        toast.success('Your Travel DNA has been saved!');
        navigate(ROUTES.PROFILE.VIEW);
    } catch (error) {
      console.error('[OnboardConversation] Save error:', error);
      toast.error('Failed to save your Travel DNA. Please try again.');
    } finally {
      setIsSaving(false);
      savingInProgressRef.current = false;
    }
  }, [analysis, user, navigate]);

  const handleTryAgain = useCallback(() => {
    setStory('');
    setFollowUpAnswer('');
    setAnalysis(null);
    setStep('story');
  }, []);

  return (
    <MainLayout showFooter={false}>
      <Head
        title="Discover Your Travel DNA | Voyance"
        description="Tell us about your travel experiences and we'll discover your unique travel personality."
      />

      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">
            {/* INTRO STEP */}
            {step === 'intro' && (
              <motion.div
                key="intro"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="text-center space-y-8"
              >
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-medium">
                  <MessageCircle className="w-4 h-4" />
                  Conversational Discovery
                </div>

                <h1 className="text-3xl md:text-4xl font-bold text-foreground">
                  Tell us about a trip you loved
                </h1>

                <p className="text-lg text-muted-foreground max-w-lg mx-auto">
                  Instead of answering questions, share a travel story. We'll listen and discover your unique travel personality from what you loved (and what didn't work).
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    size="lg"
                    onClick={() => setStep('story')}
                    className="gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    Share My Story
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => navigate(ROUTES.QUIZ)}
                    className="gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Take the Quiz Instead
                  </Button>
                </div>
              </motion.div>
            )}

            {/* STORY INPUT STEP */}
            {step === 'story' && (
              <motion.div
                key="story"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-bold text-foreground">
                    Describe a trip you loved
                  </h2>
                  <p className="text-muted-foreground">
                    What made it great? What was the best day like? Was there anything you wish had been different?
                  </p>
                </div>

                <Textarea
                  value={story}
                  onChange={(e) => setStory(e.target.value)}
                  placeholder="Japan was amazing but exhausting. The best day was getting lost in Kyoto and finding a tiny soba shop where we were the only tourists. I wish the whole trip had been like that. Less scheduled, more wandering..."
                  className="min-h-[120px] sm:min-h-[200px] text-base resize-none"
                  disabled={isAnalyzing}
                />

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {story.length} characters
                    {story.length < 50 && story.length > 0 && ' (share a bit more)'}
                  </span>
                  <div className="flex gap-3">
                    <Button
                      variant="ghost"
                      onClick={() => setStep('intro')}
                      disabled={isAnalyzing}
                    >
                      Back
                    </Button>
                    <Button
                      onClick={handleStorySubmit}
                      disabled={isAnalyzing || story.trim().length < 50}
                      className="gap-2"
                    >
                      {isAnalyzing ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          Discover My DNA
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* FOLLOW-UP QUESTION STEP */}
            {step === 'followup' && analysis && (
              <motion.div
                key="followup"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 text-amber-600 rounded-full text-sm">
                    <MessageCircle className="w-3.5 h-3.5" />
                    One more question
                  </div>
                  <h2 className="text-2xl font-bold text-foreground">
                    {analysis.followUpQuestion || "Tell us more about your ideal travel day"}
                  </h2>
                </div>

                <Textarea
                  value={followUpAnswer}
                  onChange={(e) => setFollowUpAnswer(e.target.value)}
                  placeholder="Share a bit more..."
                  className="min-h-[120px] text-base resize-none"
                  disabled={isAnalyzing}
                />

                <div className="flex justify-end gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => setStep('result')}
                    disabled={isAnalyzing}
                  >
                    Skip & See Results
                  </Button>
                  <Button
                    onClick={handleFollowUpSubmit}
                    disabled={isAnalyzing || followUpAnswer.trim().length < 10}
                    className="gap-2"
                  >
                    {isAnalyzing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Refining...
                      </>
                    ) : (
                      <>
                        Continue
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}

            {/* RESULT STEP */}
            {step === 'result' && analysis && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                    <Sparkles className="w-3.5 h-3.5" />
                    {analysis.confidence}% match
                  </div>
                  <h2 className="text-3xl font-bold text-foreground">
                    You're {analysis.primaryArchetype.name}
                  </h2>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    {analysis.reasoning}
                  </p>
                </div>

                {/* Trait pills */}
                <div className="flex flex-wrap gap-2 justify-center">
                  {analysis.primaryArchetype.traits.slice(0, 4).map((trait) => (
                    <span
                      key={trait}
                      className="px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-sm"
                    >
                      {trait}
                    </span>
                  ))}
                </div>

                {/* What worked / what failed */}
                {(analysis.traits.whatWorked.length > 0 || analysis.traits.whatFailed.length > 0) && (
                  <div className="grid md:grid-cols-2 gap-4">
                    {analysis.traits.whatWorked.length > 0 && (
                      <div className="p-4 bg-green-500/5 border border-green-500/20 rounded-lg">
                        <h4 className="text-sm font-medium text-green-600 mb-2">What you loved</h4>
                        <ul className="space-y-1 text-sm text-muted-foreground">
                          {analysis.traits.whatWorked.map((item, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <Check className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {analysis.traits.whatFailed.length > 0 && (
                      <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-lg">
                        <h4 className="text-sm font-medium text-red-600 mb-2">What didn't work</h4>
                        <ul className="space-y-1 text-sm text-muted-foreground">
                          {analysis.traits.whatFailed.map((item, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-red-500">•</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Secondary archetype */}
                {analysis.secondaryArchetype && (
                  <p className="text-center text-sm text-muted-foreground">
                    With hints of <span className="font-medium text-foreground">{analysis.secondaryArchetype.name}</span>
                  </p>
                )}

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button
                    size="lg"
                    onClick={handleConfirm}
                    disabled={isSaving}
                    className="gap-2"
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        This is Me!
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={handleTryAgain}
                    disabled={isSaving}
                  >
                    Try a Different Story
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </MainLayout>
  );
}
