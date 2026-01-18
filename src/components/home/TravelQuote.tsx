import { motion } from 'framer-motion';

export default function TravelQuote() {
  return (
    <section className="py-32 bg-background relative overflow-hidden">
      {/* Editorial Lines */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-1/4 top-0 bottom-0 w-px bg-border/50" />
        <div className="absolute right-1/4 top-0 bottom-0 w-px bg-border/50" />
      </div>

      <div className="max-w-5xl mx-auto px-8 md:px-16 text-center relative">
        {/* Quote Mark */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="mb-8"
        >
          <span className="text-8xl font-serif text-primary/20 leading-none">"</span>
        </motion.div>

        {/* Quote */}
        <motion.blockquote
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12"
        >
          <p className="text-3xl md:text-4xl lg:text-5xl font-serif font-normal text-foreground leading-snug italic">
            The real voyage of discovery consists not in seeking new landscapes, 
            but in having new eyes.
          </p>
        </motion.blockquote>

        {/* Attribution */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="flex items-center justify-center gap-4"
        >
          <div className="w-12 h-px bg-primary/40" />
          <span className="text-sm tracking-[0.2em] uppercase text-muted-foreground font-sans">
            Marcel Proust
          </span>
          <div className="w-12 h-px bg-primary/40" />
        </motion.div>
      </div>
    </section>
  );
}