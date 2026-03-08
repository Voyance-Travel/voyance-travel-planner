import { useState } from 'react';
import { ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { POPULAR_DESTINATIONS } from '@/lib/archetypeTeasers';
import ItineraryTeaser from './ItineraryTeaser';
import { supabase } from '@/integrations/supabase/client';
import { ROUTES } from '@/config/routes';

interface Day {
  dayNumber: number;
  headline: string;
  description: string;
}

interface BudgetEstimate {
  dailyLow: number;
  dailyHigh: number;
  currency: string;
  costLevel: string;
}

interface PaymentInfo {
  localCurrency: string;
  currencyCode: string;
  paymentTips: string;
}


interface PreviewData {
  destination: string;
  days: Day[];
  totalDays: number;
  archetypeUsed: string;
  archetypeTagline: string;
  budgetEstimate?: BudgetEstimate;
  paymentInfo?: PaymentInfo;
  
}

export default function DestinationEntry() {
  const [destination, setDestination] = useState('');
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (dest?: string) => {
    const targetDest = (dest || destination).trim();
    if (!targetDest) return;

    // Detect vague/ambiguous queries before hitting the edge function
    const vaguePatterns = /^(somewhere|anywhere|a place|find me|i want|show me|looking for|help me|suggest|recommend)/i;
    const vagueKeywords = ['warm', 'cold', 'cheap', 'exotic', 'relaxing', 'adventure', 'beach', 'for a week', 'for a weekend', 'near me', 'tropical'];
    const looksVague = vaguePatterns.test(targetDest) || 
      (vagueKeywords.some(k => targetDest.toLowerCase().includes(k)) && targetDest.split(/\s+/).length > 3 && !/[A-Z][a-z]{2,}/.test(targetDest.replace(/^[A-Z]/, '')));
    
    if (looksVague) {
      setErrorMessage("Try entering a specific city or country, like \"Barcelona\", \"Tokyo\", or \"Costa Rica\", and we'll build a preview for you.");
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);
    setPreviewData(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-quick-preview', {
        body: { destination: targetDest.trim() }
      });

      if (error) {
        console.error('Preview generation error:', error);
        // Supabase client puts 4xx response body in error.context.body or error.message
        const errorMsg = error.message || '';
        
        // Try parsing the error message as JSON (Supabase wraps 400 body here)
        let parsed: { error?: string; message?: string } | null = null;
        try {
          // error.message might be the raw JSON or prefixed with status info
          const jsonMatch = errorMsg.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
          }
        } catch { /* not JSON */ }

        if (parsed?.error === 'unknown_destination' || parsed?.error === 'invalid_destination') {
          setErrorMessage(parsed.message || "We couldn't recognize that destination. Try a well-known city or country.");
          return;
        }

        // Also check if data was returned despite the error (some Supabase versions)
        if (data?.error === 'unknown_destination' || data?.error === 'invalid_destination') {
          setErrorMessage(data.message || "We couldn't recognize that destination.");
          return;
        }

        setErrorMessage("We couldn't generate a preview for that. Try a specific city or country like \"Paris\" or \"Japan\".");
        return;
      }

      // Check if data itself contains an error (some 400 responses populate data)
      if (data?.error === 'unknown_destination' || data?.error === 'invalid_destination') {
        setErrorMessage(data.message || "We couldn't recognize that destination.");
        return;
      }

      setPreviewData({
        destination: data?.destination || targetDest,
        days: data?.days || [],
        totalDays: data?.totalDays || 7,
        archetypeUsed: data?.archetypeUsed || "Present Traveler",
        archetypeTagline: data?.archetypeTagline || "Fewer things, done well.",
        budgetEstimate: data?.budgetEstimate,
        paymentInfo: data?.paymentInfo,
        
      });
    } catch (err) {
      console.error('Preview error:', err);
      setErrorMessage("We couldn't generate a preview for that. Try a specific city or country like \"Paris\" or \"Japan\".");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  const handleStartOver = () => {
    setPreviewData(null);
    setDestination('');
  };

  const handleTakeQuiz = () => {
    // Navigate to quiz with destination pre-filled
    navigate(`${ROUTES.ARCHETYPES}?destination=${encodeURIComponent(previewData?.destination || destination)}`);
  };

  // Show itinerary teaser after generation
  if (previewData) {
    return (
      <ItineraryTeaser 
        destination={previewData.destination}
        days={previewData.days}
        totalDays={previewData.totalDays}
        archetypeUsed={previewData.archetypeUsed}
        archetypeTagline={previewData.archetypeTagline}
        budgetEstimate={previewData.budgetEstimate}
        paymentInfo={previewData.paymentInfo}
        
        onTakeQuiz={handleTakeQuiz}
        onStartOver={handleStartOver}
      />
    );
  }

  return (
    <div className="w-full text-center px-2">
      {/* Value proposition headline - mobile-optimized */}
      <motion.h1 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-serif font-normal mb-2 sm:mb-4 leading-tight"
      >
        <span 
          className="block text-white/90"
          style={{ textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 4px 24px rgba(0,0,0,0.7), 0 0 60px rgba(0,0,0,0.5)' }}
        >
          You don't need more travel ideas.
        </span>
        <span 
          className="block mt-1 sm:mt-2 text-white font-bold"
          style={{ textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 4px 24px rgba(0,0,0,0.7), 0 0 60px rgba(0,0,0,0.5)' }}
        >
          You need a trip.
        </span>
      </motion.h1>
      
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-base sm:text-lg md:text-xl text-white/90 mb-5 sm:mb-10 px-2"
        style={{ textShadow: '0 1px 10px rgba(0,0,0,0.7), 0 2px 20px rgba(0,0,0,0.5)' }}
      >
        Tell us how you travel. We'll build an experience for everyday.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="relative max-w-md mx-auto"
      >
        <input
          type="text"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Preview where you want to go..."
          className="w-full text-lg sm:text-xl text-center py-3 sm:py-4 border-t-0 border-x-0 border-b-2 border-white/40 bg-transparent text-white placeholder:text-white/50 focus:outline-none focus:ring-0 focus:border-white transition-colors rounded-none"
          autoFocus
          disabled={isGenerating}
        />
        
        {destination && !isGenerating && (
          <button
            onClick={() => handleSubmit()}
            className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-white hover:text-white/80 transition-colors"
          >
            <ArrowRight className="w-6 h-6" />
          </button>
        )}
        
        {isGenerating && (
          <div className="absolute right-0 top-1/2 -translate-y-1/2 p-2">
            <Loader2 className="w-5 h-5 animate-spin text-white/60" />
          </div>
        )}
      </motion.div>

      {isGenerating && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-6 text-white/70"
        >
          Creating your preview...
        </motion.p>
      )}

      {errorMessage && !isGenerating && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 text-red-300 text-sm"
        >
          {errorMessage}
        </motion.p>
      )}

      {/* CTAs: Primary "Start Planning" on mobile, both on desktop */}
      {!isGenerating && !destination && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4"
        >
          <Button
            size="lg"
            asChild
            className="rounded-full bg-white text-primary hover:bg-white/90 font-semibold px-8 min-h-[48px] shadow-lg"
          >
            <a href="/start">
              Start Planning
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
          {/* Secondary CTA hidden on mobile, shown on desktop */}
          <Button
            size="lg"
            variant="outline"
            onClick={() => navigate(ROUTES.QUIZ)}
            className="hidden sm:inline-flex rounded-full border-white/40 text-white hover:bg-white/20 font-semibold px-8 min-h-[48px] backdrop-blur-sm"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Find Your Style
          </Button>
        </motion.div>
      )}

      {/* Popular destinations - improved mobile touch targets */}
      {!destination && !isGenerating && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-4 sm:mt-6 flex flex-wrap justify-center gap-2 px-2"
        >
          {POPULAR_DESTINATIONS.map((city) => (
            <Button
              key={city}
              variant="secondary"
              size="sm"
              onClick={() => {
                setDestination(city);
                handleSubmit(city);
              }}
              className="rounded-full bg-white/20 text-white border-white/30 hover:bg-white/30 backdrop-blur-sm min-h-[44px] px-4"
            >
              {city}
            </Button>
          ))}
        </motion.div>
      )}

      {/* Free tier callout - moderate visibility */}
      {!isGenerating && !previewData && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-8 text-sm text-white/60"
        >
          No credit card required.
        </motion.p>
      )}
    </div>
  );
}
