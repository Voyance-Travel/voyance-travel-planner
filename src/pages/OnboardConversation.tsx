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
        const traitScores = {
          planning: analysis.traits.planning === 'structured' ? 7 : analysis.traits.planning === 'flexible' ? 0 : -5,
          social: analysis.traits.social === 'social' ? 7 : analysis.traits.social === 'small-group' ? 2 : -5,
          comfort: analysis.traits.comfort === 'luxury' ? 7 : analysis.traits.comfort === 'moderate' ? 2 : -4,
          pace: analysis.traits.pace === 'active' ? 7 : analysis.traits.pace === 'balanced' ? 2 : -4,
          authenticity:
            analysis.traits.authenticity === 'local-immersion'
              ? 8
              : analysis.traits.authenticity === 'balanced'
                ? 3
                : -2,
          adventure:
            analysis.traits.adventure === 'thrill-seeking'
              ? 8
              : analysis.traits.adventure === 'moderate'
                ? 3
                : -3,
          budget: analysis.traits.comfort === 'budget' ? 7 : analysis.traits.comfort === 'moderate' ? 2 : -5,
          transformation: 3, // Default middle value
        };

        const nowIso = new Date().toISOString();

        // Save to travel_dna_profiles (schema-safe columns only)
        const { error: dnaError } = await supabase
          .from('travel_dna_profiles')
          .upsert(
            [
              {
                user_id: user.id,
                primary_archetype_name: analysis.primaryArchetype.name,
                secondary_archetype_name: analysis.secondaryArchetype?.name ?? null,
                dna_confidence_score: Math.round(analysis.confidence),
                trait_scores: traitScores,
                calculated_at: nowIso,
                updated_at: nowIso,
              },
            ],
            { onConflict: 'user_id' }
          );

        if (dnaError) throw dnaError;

        // Ensure profile row exists + mark as completed (prevents silent "0 rows updated")
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert(
            [
              {
                id: user.id,
                quiz_completed: true,
                updated_at: nowIso,
              },
            ],
            { onConflict: 'id' }
          );

        if (profileError) throw profileError;

        // Map traits to user_preferences format
        const { error: prefError } = await supabase
          .from('user_preferences')
          .upsert(
            [
              {
                user_id: user.id,
                travel_pace: analysis.traits.pace,
                travel_companions: [
                  analysis.traits.social === 'solo'
                    ? 'solo'
                    : analysis.traits.social === 'social'
                      ? 'friends'
                      : 'partner',
                ],
                planning_preference: analysis.traits.planning,
                budget_tier: analysis.traits.comfort,
                updated_at: nowIso,
              },
            ],
            { onConflict: 'user_id' }
          );

        if (prefError) throw prefError;

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
