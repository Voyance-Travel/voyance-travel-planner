import { useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { POPULAR_DESTINATIONS } from '@/lib/archetypeTeasers';
import QuickPreviewDisplay from './QuickPreviewDisplay';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PreviewData {
  destination: string;
  days: Array<{
    dayNumber: number;
    headline: string;
    description: string;
  }>;
  totalDays: number;
  archetypeUsed: string;
  archetypeTagline: string;
}

export default function DestinationEntry() {
  const [destination, setDestination] = useState('');
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleSubmit = async (dest?: string) => {
    const targetDest = dest || destination;
    if (!targetDest.trim()) return;

    setIsGenerating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-quick-preview', {
        body: { destination: targetDest.trim() }
      });

      if (error) {
        console.error('Preview generation error:', error);
        toast.error('Failed to generate preview. Please try again.');
        return;
      }

      if (data.error) {
        toast.error(data.error);
        return;
      }

      setPreview(data);
    } catch (err) {
      console.error('Preview error:', err);
      toast.error('Something went wrong. Please try again.');
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
    setPreview(null);
    setDestination('');
  };

  if (preview) {
    return (
      <QuickPreviewDisplay 
        preview={preview}
        onStartOver={handleStartOver}
      />
    );
  }

  return (
    <div className="w-full text-center">
      <motion.h1 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-4xl md:text-5xl lg:text-6xl font-serif font-normal mb-4 text-foreground"
      >
        Where do you want to go?
      </motion.h1>
      
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-lg md:text-xl text-muted-foreground mb-10"
      >
        Type a destination. See what your trip could look like.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="relative max-w-md mx-auto"
      >
        <Input
          type="text"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Tokyo, Paris, Bali..."
          className="text-xl text-center py-6 h-auto border-0 border-b-2 rounded-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary"
          autoFocus
          disabled={isGenerating}
        />
        
        {destination && !isGenerating && (
          <Button
            onClick={() => handleSubmit()}
            size="icon"
            variant="ghost"
            className="absolute right-0 top-1/2 -translate-y-1/2 text-primary hover:text-primary/80"
          >
            <ArrowRight className="w-6 h-6" />
          </Button>
        )}
        
        {isGenerating && (
          <div className="absolute right-0 top-1/2 -translate-y-1/2 p-2">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </motion.div>

      {isGenerating && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-6 text-muted-foreground"
        >
          Building you a taste...
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
              className="rounded-full"
            >
              {city}
            </Button>
          ))}
        </motion.div>
      )}
    </div>
  );
}
