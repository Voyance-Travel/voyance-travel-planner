import { motion } from 'framer-motion';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ARCHETYPE_TEASERS } from '@/lib/archetypeTeasers';
import { ROUTES } from '@/config/routes';

interface ArchetypeTeaserProps {
  archetype: string;
  onReset: () => void;
}

export default function ArchetypeTeaser({ archetype, onReset }: ArchetypeTeaserProps) {
  const navigate = useNavigate();
  const data = ARCHETYPE_TEASERS[archetype];

  if (!data) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full max-w-2xl mx-auto text-center"
    >
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl md:text-3xl lg:text-4xl font-serif font-normal mb-4 text-foreground"
      >
        You might be a {data.name}
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-lg md:text-xl text-muted-foreground mb-10"
      >
        {data.oneLiner}
      </motion.p>

      {/* Side by side comparison */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid md:grid-cols-2 gap-4 mb-10"
      >
        {/* Typical Trip */}
        <div className="p-6 bg-muted/50 rounded-xl text-left">
          <h3 className="font-medium text-sm uppercase tracking-wide text-muted-foreground mb-4">
            Typical Trip
          </h3>
          <ul className="space-y-2">
            {data.typicalTrip.map((item, i) => (
              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="text-muted-foreground/50">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Your Trip */}
        <div className="p-6 bg-primary/10 rounded-xl text-left border border-primary/20">
          <h3 className="font-medium text-sm uppercase tracking-wide text-primary mb-4">
            Your Trip
          </h3>
          <ul className="space-y-2">
            {data.yourTrip.map((item, i) => (
              <li key={i} className="text-sm text-foreground flex items-start gap-2">
                <span className="text-primary">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </motion.div>

      {/* CTAs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={() => navigate(ROUTES.QUIZ)}
            size="lg"
            className="rounded-full px-8"
          >
            Find out for sure
            <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
          <Button
            onClick={() => navigate(ROUTES.START)}
            variant="outline"
            size="lg"
            className="rounded-full px-8"
          >
            Or just plan a trip
          </Button>
        </div>
        
        <button
          onClick={onReset}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2 mx-auto"
        >
          <RotateCcw className="w-3 h-3" />
          Answer differently
        </button>
      </motion.div>
    </motion.div>
  );
}
