import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, MapPin, Plane, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/config/routes';

interface QuizCompletionProps {
  onContinue?: () => void;
}

// Confetti particle component
function ConfettiParticle({ delay, x }: { delay: number; x: number }) {
  const colors = ['#C2956E', '#D4A574', '#B8860B', '#CD853F', '#8B7355'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  
  return (
    <motion.div
      initial={{ 
        y: -20, 
        x: x, 
        opacity: 1,
        rotate: 0,
        scale: 1 
      }}
      animate={{ 
        y: 400, 
        x: x + (Math.random() - 0.5) * 200,
        opacity: 0,
        rotate: Math.random() * 360,
        scale: 0.5
      }}
      transition={{ 
        duration: 3,
        delay: delay,
        ease: 'easeOut'
      }}
      className="absolute top-0 w-3 h-3 rounded-sm"
      style={{ backgroundColor: color, left: '50%' }}
    />
  );
}

export function QuizCompletion({ onContinue }: QuizCompletionProps) {
  const navigate = useNavigate();
  const [showConfetti, setShowConfetti] = useState(true);
  
  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  const handleContinue = () => {
    if (onContinue) {
      onContinue();
    } else {
      navigate(ROUTES.PROFILE.VIEW);
    }
  };

  const confettiParticles = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    delay: Math.random() * 0.5,
    x: (Math.random() - 0.5) * 400,
  }));

  return (
    <div className="min-h-[60vh] flex items-center justify-center relative overflow-hidden">
      {/* Confetti */}
      <AnimatePresence>
        {showConfetti && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {confettiParticles.map((particle) => (
              <ConfettiParticle 
                key={particle.id} 
                delay={particle.delay} 
                x={particle.x}
              />
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ 
          duration: 0.6,
          type: 'spring',
          stiffness: 200,
          damping: 20 
        }}
        className="text-center max-w-md px-4"
      >
        {/* Success icon with glow */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}
          className="relative mx-auto mb-8"
        >
          <div className="absolute inset-0 bg-accent/20 rounded-full blur-2xl scale-150" />
          <div className="relative w-24 h-24 bg-gradient-to-br from-accent to-gold rounded-full flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, type: 'spring' }}
            >
              <CheckCircle2 className="w-12 h-12 text-white" />
            </motion.div>
          </div>
          
          {/* Floating icons */}
          <motion.div
            animate={{ 
              y: [-5, 5, -5],
              rotate: [-5, 5, -5]
            }}
            transition={{ 
              duration: 3,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
            className="absolute -top-2 -right-2"
          >
            <Sparkles className="w-8 h-8 text-gold" />
          </motion.div>
          
          <motion.div
            animate={{ 
              y: [5, -5, 5],
              x: [-3, 3, -3]
            }}
            transition={{ 
              duration: 4,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
            className="absolute -bottom-1 -left-3"
          >
            <MapPin className="w-6 h-6 text-accent" />
          </motion.div>
          
          <motion.div
            animate={{ 
              y: [-3, 3, -3],
              rotate: [0, 10, 0]
            }}
            transition={{ 
              duration: 2.5,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
            className="absolute top-0 -left-4"
          >
            <Plane className="w-5 h-5 text-muted-foreground" />
          </motion.div>
        </motion.div>

        {/* Text content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4">
            You're all set!
          </h1>
          <p className="text-lg text-muted-foreground mb-2">
            We've saved your travel preferences.
          </p>
          <p className="text-muted-foreground mb-8">
            Now let's find your perfect destination and create an unforgettable journey.
          </p>
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="space-y-3"
        >
          <Button 
            onClick={handleContinue}
            size="lg"
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
          >
            Start Planning My Trip
          </Button>
          <Button 
            variant="ghost"
            onClick={() => navigate(ROUTES.EXPLORE)}
            className="w-full text-muted-foreground hover:text-foreground"
          >
            Explore Destinations First
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
