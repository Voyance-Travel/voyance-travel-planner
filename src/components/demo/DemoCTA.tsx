import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, ChevronRight, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function DemoCTA() {
  const navigate = useNavigate();

  return (
    <section className="py-20 bg-gradient-to-br from-primary/10 via-accent/5 to-background">
      <div className="max-w-2xl mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="inline-flex items-center gap-2 text-primary text-sm font-medium mb-4">
            <Zap className="h-4 w-4" />
            Ready to plan for real?
          </div>
          
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">
            Your Adventure Starts Here
          </h2>
          
          <p className="text-lg text-muted-foreground mb-8">
            Take our 2-minute Travel DNA Quiz and get a personalized itinerary built just for you.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button 
              size="lg" 
              onClick={() => navigate('/quiz')}
              className="min-w-[200px] h-14 text-lg"
            >
              <Sparkles className="h-5 w-5 mr-2" />
              Take the Quiz
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              onClick={() => navigate('/start?mode=itinerary')}
              className="min-w-[200px] h-14 text-lg"
            >
              Start Planning
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>

          <p className="text-sm text-muted-foreground mt-6">
            ✨ First itinerary free • No credit card required
          </p>
        </motion.div>
      </div>
    </section>
  );
}
