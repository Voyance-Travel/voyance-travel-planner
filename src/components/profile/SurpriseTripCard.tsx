import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Gift, 
  Sparkles, 
  Lock, 
  Crown,
  Plane,
  ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SurpriseTripCardProps {
  isPremium?: boolean;
  className?: string;
}

export default function SurpriseTripCard({ isPremium = false, className }: SurpriseTripCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative rounded-xl border overflow-hidden",
        isPremium 
          ? "bg-gradient-to-br from-primary/10 via-accent/10 to-primary/5 border-primary/20" 
          : "bg-gradient-to-br from-muted to-muted/50 border-border",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Decorative Elements */}
      <div className="absolute top-4 right-4">
        {isPremium ? (
          <Badge className="bg-gradient-to-r from-amber-400 to-orange-500 text-white border-0 gap-1">
            <Crown className="h-3 w-3" />
            Premium
          </Badge>
        ) : (
          <Badge variant="secondary" className="gap-1">
            <Lock className="h-3 w-3" />
            Upgrade Required
          </Badge>
        )}
      </div>

      {/* Content */}
      <div className="p-8">
        <motion.div 
          animate={{ rotate: isHovered ? [0, -10, 10, 0] : 0 }}
          transition={{ duration: 0.5 }}
          className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-6"
        >
          <Gift className="h-8 w-8 text-white" />
        </motion.div>

        <h3 className="font-serif text-2xl font-bold text-foreground mb-2">
          Surprise Me
        </h3>
        
        <p className="text-muted-foreground mb-6 max-w-sm">
          Let us plan a mystery trip tailored to your Travel DNA. 
          You'll only discover your destination when you arrive at the airport.
        </p>

        {/* Features */}
        <div className="space-y-3 mb-8">
          {[
            'AI-curated based on your preferences',
            'Complete itinerary revealed at departure',
            'Guaranteed to match your travel style',
            'Full refund if you don\'t love it',
          ].map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center gap-2 text-sm"
            >
              <Sparkles className={cn(
                "h-4 w-4",
                isPremium ? "text-primary" : "text-muted-foreground"
              )} />
              <span className={isPremium ? "text-foreground" : "text-muted-foreground"}>
                {feature}
              </span>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        {isPremium ? (
          <Button size="lg" className="w-full gap-2 group">
            <Plane className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            Book a Surprise Trip
            <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Button>
        ) : (
          <Button 
            size="lg" 
            variant="outline" 
            className="w-full gap-2"
            asChild
          >
            <Link to="/profile?tab=subscription">
              <Crown className="h-5 w-5" />
              Upgrade to Unlock
            </Link>
          </Button>
        )}
      </div>

      {/* Background Pattern */}
      {isPremium && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-accent/5 rounded-full blur-3xl" />
        </div>
      )}
    </motion.div>
  );
}