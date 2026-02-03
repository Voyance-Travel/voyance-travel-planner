import { motion } from 'framer-motion';
import { strangerCopy } from '@/lib/strangerCopy';
import { X } from 'lucide-react';
import beforeAfterImage from '@/assets/before-after-planning.jpg';

export default function TheProblemSection() {
  const { problem } = strangerCopy.homepage;

  return (
    <section className="py-16 sm:py-24 md:py-32 relative overflow-hidden bg-muted/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-16 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12 md:mb-16"
        >
          {/* Eyebrow with icon */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <X className="w-5 h-5 text-destructive" />
            </div>
            <span className="text-sm tracking-[0.2em] uppercase text-muted-foreground font-medium">
              {problem.eyebrow}
            </span>
          </div>

          {/* Headline */}
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-normal text-foreground mb-6 leading-tight max-w-3xl mx-auto">
            {problem.headline}
          </h2>

          {/* Punchy copy - approved as-is */}
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            You research for <span className="font-semibold text-foreground">HOURS</span>. 
            Half the recommendations aren't for you. 
            Your itinerary was too packed.
          </p>
        </motion.div>

        {/* Before/After Visual */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="relative rounded-2xl overflow-hidden shadow-2xl border border-border/50"
        >
          <img 
            src={beforeAfterImage}
            alt="Before: Chaotic browser tabs, spreadsheets, and Reddit threads. After: Clean Voyance itinerary with Intelligence Summary showing 3 hours saved and 2 hidden gems found."
            className="w-full h-auto"
            loading="lazy"
          />
          
          {/* Overlay labels for accessibility and emphasis */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Left side gradient overlay for better text contrast */}
            <div className="absolute left-0 bottom-0 w-1/2 h-20 bg-gradient-to-t from-black/60 to-transparent" />
            {/* Right side gradient overlay */}
            <div className="absolute right-0 bottom-0 w-1/2 h-20 bg-gradient-to-t from-black/40 to-transparent" />
          </div>
        </motion.div>

        {/* Closing statement */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="text-xl md:text-2xl font-serif text-foreground text-center mt-10 md:mt-14 italic"
        >
          Your vacation. Wasted on someone else's idea of a good time.
        </motion.p>
      </div>
    </section>
  );
}
