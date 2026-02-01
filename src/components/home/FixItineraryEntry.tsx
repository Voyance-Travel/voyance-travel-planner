import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ItineraryAnalysis from './ItineraryAnalysis';

interface Issue {
  emoji: string;
  headline: string;
  detail: string;
  severity: 'critical' | 'warning' | 'suggestion';
}

interface AnalysisData {
  destination: string | null;
  issues: Issue[];
  positives: string[];
  canFix: boolean;
}

export default function FixItineraryEntry() {
  const [itinerary, setItinerary] = useState('');
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyze = async () => {
    if (!itinerary.trim() || itinerary.trim().length < 20) {
      toast.error('Please paste more details about your trip');
      return;
    }

    setIsAnalyzing(true);

    try {
      const { data, error } = await supabase.functions.invoke('analyze-itinerary', {
        body: { itineraryText: itinerary.trim() }
      });

      if (error) {
        console.error('Analysis error:', error);
        toast.error('Failed to analyze itinerary. Please try again.');
        return;
      }

      if (data.error) {
        toast.error(data.error);
        return;
      }

      setAnalysis(data);
    } catch (err) {
      console.error('Analysis error:', err);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setAnalysis(null);
    setItinerary('');
  };

  if (analysis) {
    return (
      <ItineraryAnalysis 
        analysis={analysis} 
        onReset={handleReset}
      />
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl md:text-3xl lg:text-4xl font-serif font-normal text-center mb-4 text-foreground"
      >
        Already have a trip planned?
      </motion.h2>
      
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-center text-muted-foreground mb-8"
      >
        Paste your itinerary. We'll tell you what's wrong with it.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Textarea
          value={itinerary}
          onChange={(e) => setItinerary(e.target.value)}
          placeholder="Paste your itinerary, travel notes, or just describe your plan...

Example:
Day 1: Land at Narita, go to Shibuya
Day 2: Tsukiji Market, TeamLab, Harajuku, Shinjuku
Day 3: Day trip to Mt Fuji, Robot Restaurant at night
..."
          className="min-h-[200px] resize-none text-base"
          disabled={isAnalyzing}
        />

        <Button
          onClick={handleAnalyze}
          disabled={!itinerary.trim() || isAnalyzing}
          size="lg"
          className="w-full mt-4 rounded-full"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            'Roast my itinerary'
          )}
        </Button>
      </motion.div>
    </div>
  );
}
