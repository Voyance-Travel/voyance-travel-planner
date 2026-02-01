import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { strangerCopy } from '@/lib/strangerCopy';
import { ROUTES } from '@/config/routes';

export default function TheStakesSection() {
  const { stakes } = strangerCopy.homepage;

  return (
    <section className="py-20 md:py-28 bg-muted/30 relative overflow-hidden">
      {/* Background accent */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5" />

      <div className="max-w-4xl mx-auto px-8 md:px-16 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          {/* Eyebrow */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="w-8 h-px bg-primary" />
            <span className="text-xs tracking-[0.25em] uppercase text-muted-foreground font-sans">
              {stakes.eyebrow}
            </span>
            <div className="w-8 h-px bg-primary" />
          </div>

          {/* Headline */}
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-normal text-foreground mb-8">
            {stakes.headline}
          </h2>

          {/* Body */}
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed font-sans whitespace-pre-line max-w-2xl mx-auto mb-10">
            {stakes.body}
          </p>

          {/* CTA */}
          <Button asChild size="lg" className="text-base px-10 py-6 font-sans font-medium">
            <Link to={ROUTES.QUIZ}>
              {stakes.cta}
              <ArrowRight className="ml-3 h-4 w-4" />
            </Link>
          </Button>

          {/* Trust signal */}
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="mt-4 text-sm text-muted-foreground"
          >
            {strangerCopy.trust.noCreditCard}
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
