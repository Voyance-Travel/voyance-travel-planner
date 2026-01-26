import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, ChevronRight, Zap, Shield, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function DemoCTA() {
  const navigate = useNavigate();

  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/5 to-background" />
      <div className="absolute inset-0">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-64 h-64 bg-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Zap className="h-4 w-4" />
            Ready to plan for real?
          </div>
          
          <h2 className="text-4xl md:text-5xl font-serif font-bold mb-6">
            Your Perfect Trip
            <br />
            <span className="text-primary">Starts Now</span>
          </h2>
          
          <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
            Take our 2-minute Travel DNA Quiz and get a personalized itinerary 
            built just for you. No more hours of research.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
            <Button 
              size="lg" 
              onClick={() => navigate('/quiz')}
              className="min-w-[220px] h-14 text-lg group"
            >
              <Sparkles className="h-5 w-5 mr-2 group-hover:rotate-12 transition-transform" />
              Take the Quiz
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              onClick={() => navigate('/start?mode=itinerary')}
              className="min-w-[220px] h-14 text-lg"
            >
              Start Planning
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>

          {/* Trust signals */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span>2 min quiz</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <span>No credit card</span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>First itinerary free</span>
            </div>
          </div>

          {/* Pricing transparency */}
          <div className="mt-10 pt-8 border-t border-border/50">
            <p className="text-xs text-muted-foreground mb-4">
              This demo shows all premium features. Here's how pricing works:
            </p>
            <div className="inline-flex flex-col sm:flex-row items-center gap-4 sm:gap-6 text-sm">
              <div className="text-center">
                <p className="font-medium text-foreground">Free</p>
                <p className="text-xs text-muted-foreground">Day 1 preview</p>
              </div>
              <div className="hidden sm:block w-px h-8 bg-border" />
              <div className="text-center">
                <p className="font-medium text-foreground">Trip Pass</p>
                <p className="text-xs text-muted-foreground">$24.99 per trip</p>
              </div>
              <div className="hidden sm:block w-px h-8 bg-border" />
              <div className="text-center">
                <p className="font-medium text-foreground">Credits</p>
                <p className="text-xs text-muted-foreground">5 for $79 • 10 for $149</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
