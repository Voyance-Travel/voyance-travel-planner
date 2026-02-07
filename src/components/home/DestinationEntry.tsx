import { useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
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

interface NeedToKnow {
  visaSummary: string;
  safetyLevel: string;
  keyRequirement?: string;
}

interface PreviewData {
  destination: string;
  days: Day[];
  totalDays: number;
  archetypeUsed: string;
  archetypeTagline: string;
  budgetEstimate?: BudgetEstimate;
  paymentInfo?: PaymentInfo;
  needToKnow?: NeedToKnow;
}

export default function DestinationEntry() {
  const [destination, setDestination] = useState('');
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (dest?: string) => {
    const targetDest = dest || destination;
    if (!targetDest.trim()) return;

    setIsGenerating(true);
    setErrorMessage(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-quick-preview', {
        body: { destination: targetDest.trim() }
      });

      if (error) {
        console.error('Preview generation error:', error);
        // Check for validation errors
        try {
          const errBody = JSON.parse(error.message || '{}');
          if (errBody.error === 'unknown_destination' || errBody.error === 'invalid_destination') {
            setErrorMessage(errBody.message || "We couldn't recognize that destination. Try a well-known city or country.");
            return;
          }
        } catch { /* not JSON */ }
        setErrorMessage("Something went wrong. Please try again.");
        return;
      }

      // Check if data itself contains an error (400 responses)
      if (data?.error === 'unknown_destination' || data?.error === 'invalid_destination') {
        setErrorMessage(data.message || "We couldn't recognize that destination.");
        return;
      }

      setPreviewData({
        destination: data?.destination || targetDest,
        days: data?.days || [],
        totalDays: data?.totalDays || 7,
        archetypeUsed: data?.archetypeUsed || "Slow Traveler",
        archetypeTagline: data?.archetypeTagline || "Fewer things, done well.",
        budgetEstimate: data?.budgetEstimate,
        paymentInfo: data?.paymentInfo,
        needToKnow: data?.needToKnow,
      });
    } catch (err) {
      console.error('Preview error:', err);
      setErrorMessage("Something went wrong. Please try again.");
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
        needToKnow={previewData.needToKnow}
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
        className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-serif font-normal mb-3 sm:mb-4 text-white leading-tight"
        style={{ textShadow: '0 2px 20px rgba(0,0,0,0.8), 0 4px 40px rgba(0,0,0,0.6)' }}
      >
        <span className="block sm:inline">You don't need more travel ideas.</span>
        <br className="hidden sm:block" />
        <span className="text-primary" style={{ textShadow: '0 2px 20px rgba(0,0,0,0.9), 0 4px 40px rgba(0,0,0,0.7)' }}> You need a trip.</span>
      </motion.h1>
      
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-base sm:text-lg md:text-xl text-white/90 mb-6 sm:mb-10 px-2"
        style={{ textShadow: '0 1px 10px rgba(0,0,0,0.7), 0 2px 20px rgba(0,0,0,0.5)' }}
      >
        Tell us how you travel. We'll build every day.
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
          placeholder="Where do you want to go..."
          className="w-full text-lg sm:text-xl text-center py-3 sm:py-4 border-0 border-b-2 border-white/40 bg-transparent text-white placeholder:text-white/50 focus:outline-none focus:border-white transition-colors"
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

      {/* Popular destinations - improved mobile touch targets */}
      {!destination && !isGenerating && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-6 sm:mt-10 flex flex-wrap justify-center gap-2 px-2"
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
          No credit card required. Free monthly credits to get started.
        </motion.p>
      )}
    </div>
  );
}
