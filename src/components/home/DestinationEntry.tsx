import { useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { POPULAR_DESTINATIONS } from '@/lib/archetypeTeasers';
import IntelligenceTeaser from './IntelligenceTeaser';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ROUTES } from '@/config/routes';

interface IntelligenceStats {
  destination: string;
  hiddenGems: number;
  timingHacks: number;
  trapsToAvoid: number;
  insiderTips: number;
}

export default function DestinationEntry() {
  const [destination, setDestination] = useState('');
  const [intelligenceStats, setIntelligenceStats] = useState<IntelligenceStats | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (dest?: string) => {
    const targetDest = dest || destination;
    if (!targetDest.trim()) return;

    setIsGenerating(true);
    
    try {
      // Call cached intelligence preview (no login required)
      const { data, error } = await supabase.functions.invoke('get-destination-intelligence', {
        body: { destination: targetDest.trim() }
      });

      if (error) {
        console.error('Intelligence fetch error:', error);
        // Fallback to mock data for demo
        setIntelligenceStats({
          destination: targetDest,
          hiddenGems: 12,
          timingHacks: 8,
          trapsToAvoid: 5,
          insiderTips: 15,
        });
        return;
      }

      setIntelligenceStats({
        destination: targetDest,
        hiddenGems: data?.hiddenGems || 12,
        timingHacks: data?.timingHacks || 8,
        trapsToAvoid: data?.trapsToAvoid || 5,
        insiderTips: data?.insiderTips || 15,
      });
    } catch (err) {
      console.error('Intelligence error:', err);
      // Fallback to mock data
      setIntelligenceStats({
        destination: targetDest,
        hiddenGems: 12,
        timingHacks: 8,
        trapsToAvoid: 5,
        insiderTips: 15,
      });
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
    setIntelligenceStats(null);
    setDestination('');
  };

  const handleTakeQuiz = () => {
    // Navigate to quiz with destination pre-filled
    navigate(`${ROUTES.START}?destination=${encodeURIComponent(intelligenceStats?.destination || destination)}`);
  };

  // Show intelligence teaser after destination search
  if (intelligenceStats) {
    return (
      <IntelligenceTeaser 
        destination={intelligenceStats.destination}
        stats={intelligenceStats}
        onTakeQuiz={handleTakeQuiz}
        onStartOver={handleStartOver}
      />
    );
  }

  return (
    <div className="w-full text-center">
      {/* Value proposition headline */}
      <motion.h1 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-4xl md:text-5xl lg:text-6xl font-serif font-normal mb-4 text-white"
        style={{ textShadow: '0 2px 20px rgba(0,0,0,0.8), 0 4px 40px rgba(0,0,0,0.6)' }}
      >
        You don't need more travel ideas.
        <br />
        <span className="text-primary" style={{ textShadow: '0 2px 20px rgba(0,0,0,0.9), 0 4px 40px rgba(0,0,0,0.7)' }}>You need a trip.</span>
      </motion.h1>
      
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-lg md:text-xl text-white/90 mb-10"
        style={{ textShadow: '0 1px 10px rgba(0,0,0,0.7), 0 2px 20px rgba(0,0,0,0.5)' }}
      >
        Tell us how you travel. We'll build every day: timed, budgeted, and editable.
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
          className="w-full text-xl text-center py-4 border-0 border-b-2 border-white/40 bg-transparent text-white placeholder:text-white/50 focus:outline-none focus:border-white transition-colors"
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
          Loading intelligence...
        </motion.p>
      )}

      {/* Popular destinations as shortcuts */}
      {!destination && !isGenerating && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-10 flex flex-wrap justify-center gap-2"
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
              className="rounded-full bg-white/20 text-white border-white/30 hover:bg-white/30 backdrop-blur-sm"
            >
              {city}
            </Button>
          ))}
        </motion.div>
      )}

      {/* Free tier callout - moderate visibility */}
      {!isGenerating && !intelligenceStats && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-8 text-sm text-white/60"
        >
          No credit card required. Your first day is free, every month.
        </motion.p>
      )}
    </div>
  );
}
