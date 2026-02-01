import { motion } from 'framer-motion';
import { strangerCopy } from '@/lib/strangerCopy';

export default function TheProblemSection() {
  const { problem } = strangerCopy.homepage;

  return (
    <section className="py-20 md:py-28 bg-muted/30 relative overflow-hidden">
      {/* Subtle top fade */}
      <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-background to-transparent" />
      
      {/* Decorative accent */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-48 bg-gradient-to-b from-transparent via-destructive/20 to-transparent hidden lg:block" />

      <div className="max-w-4xl mx-auto px-8 md:px-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          {/* Eyebrow */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-8 h-px bg-muted-foreground/30" />
            <span className="text-xs tracking-[0.25em] uppercase text-muted-foreground font-sans">
              {problem.eyebrow}
            </span>
          </div>

          {/* Headline */}
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-normal text-foreground mb-8">
            {problem.headline}
          </h2>

          {/* Body - preserving line breaks */}
          <div className="text-lg md:text-xl text-muted-foreground leading-relaxed font-sans whitespace-pre-line">
            {problem.body}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
