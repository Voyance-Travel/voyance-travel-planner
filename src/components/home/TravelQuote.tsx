import { motion } from 'framer-motion';
import { Quote } from 'lucide-react';

export default function TravelQuote() {
  return (
    <section className="py-24 bg-primary/5">
      <div className="max-w-4xl mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <Quote className="h-12 w-12 text-primary/30 mx-auto mb-6" />
          
          <blockquote className="text-2xl md:text-4xl font-display font-medium text-foreground mb-8 leading-relaxed">
            "Travel is the only thing you buy that makes you richer."
          </blockquote>
          
          <div className="flex items-center justify-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-lg font-bold text-primary">✦</span>
            </div>
            <div className="text-left">
              <p className="font-medium text-foreground">Anonymous Traveler</p>
              <p className="text-sm text-muted-foreground">Wisdom passed through generations</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
