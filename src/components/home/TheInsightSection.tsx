import { motion } from 'framer-motion';
import { strangerCopy } from '@/lib/strangerCopy';

export default function TheInsightSection() {
  const { insight } = strangerCopy.homepage;

  return (
    <section className="py-20 md:py-28 bg-background relative overflow-hidden">
      {/* Decorative accent */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-48 bg-gradient-to-b from-transparent via-primary/30 to-transparent hidden lg:block" />

      <div className="max-w-4xl mx-auto px-8 md:px-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          {/* Eyebrow */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-8 h-px bg-primary" />
            <span className="text-xs tracking-[0.25em] uppercase text-muted-foreground font-sans">
              {insight.eyebrow}
            </span>
          </div>

          {/* Headline */}
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-normal text-foreground mb-8">
            {insight.headline}
          </h2>

          {/* Body - preserving line breaks */}
          <div className="text-lg md:text-xl text-muted-foreground leading-relaxed font-sans whitespace-pre-line">
            {insight.body}
          </div>

          {/* Emphasis line */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="mt-10 flex items-center gap-4"
          >
            <div className="w-12 h-px bg-primary" />
            <span className="text-xl md:text-2xl font-serif italic text-primary">
              We ask.
            </span>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
