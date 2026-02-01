import { motion } from 'framer-motion';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';

interface PreviewDay {
  dayNumber: number;
  headline: string;
  description: string;
}

interface QuickPreviewDisplayProps {
  preview: {
    destination: string;
    days: PreviewDay[];
    totalDays: number;
    archetypeUsed: string;
    archetypeTagline: string;
  };
  onStartOver: () => void;
}

export default function QuickPreviewDisplay({ preview, onStartOver }: QuickPreviewDisplayProps) {
  const navigate = useNavigate();

  const handlePersonalize = () => {
    // Navigate to archetypes page with destination pre-filled
    navigate(`${ROUTES.ARCHETYPES}?destination=${encodeURIComponent(preview.destination)}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-2xl mx-auto"
    >
      {/* Header */}
      <div className="text-center mb-8">
        <motion.h2 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl md:text-4xl font-serif font-normal mb-3 text-white drop-shadow-lg"
        >
          {preview.destination}
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-white/80"
        >
          Here's a taste of what we'd build for you
        </motion.p>
      </div>

      {/* Preview itinerary */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-black/40 backdrop-blur-sm rounded-2xl p-6 md:p-8 mb-8 border border-white/20"
      >
        <div className="space-y-6">
          {preview.days.map((day, i) => (
            <motion.div 
              key={day.dayNumber}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="flex gap-4"
            >
              <div className="text-sm font-medium text-white/60 w-14 shrink-0">
                Day {day.dayNumber}
              </div>
              <div className="border-l border-white/30 pl-4">
                <p className="font-medium text-white">{day.headline}</p>
                <p className="text-sm text-white/70 mt-1">{day.description}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Teaser footer */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-8 pt-6 border-t border-white/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <span className="text-sm text-white/60">
            + {preview.totalDays - 3} more days
          </span>
          <span className="text-sm text-white/60 italic">
            This is a "{preview.archetypeUsed}" style trip
          </span>
        </motion.div>
      </motion.div>

      {/* The hook */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="text-center"
      >
        <p className="text-lg font-medium text-white mb-2">
          This might not be your style. That's the point.
        </p>
        <p className="text-white/70 mb-8">
          Answer a few questions and we'll build <strong className="text-white">your</strong> version of {preview.destination}.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={handlePersonalize}
            size="lg"
            className="rounded-full px-8 bg-white text-black hover:bg-white/90"
          >
            Make it mine
            <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
          <Button
            onClick={onStartOver}
            variant="outline"
            size="lg"
            className="rounded-full px-8 border-white/40 text-white hover:bg-white/20"
          >
            <RotateCcw className="mr-2 w-4 h-4" />
            Try another destination
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
