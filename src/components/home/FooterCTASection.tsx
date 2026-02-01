import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { strangerCopy } from '@/lib/strangerCopy';
import { ROUTES } from '@/config/routes';

export default function FooterCTASection() {
  const { footerCta } = strangerCopy.homepage;

  return (
    <section className="py-20 md:py-28 bg-background relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-[0.02]">
        <div 
          className="absolute inset-0" 
          style={{ 
            backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', 
            backgroundSize: '48px 48px' 
          }} 
        />
      </div>

      <div className="max-w-3xl mx-auto px-8 md:px-16 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          {/* Headline */}
          <h2 className="text-2xl md:text-3xl font-serif font-normal text-foreground mb-6">
            {footerCta.headline}
          </h2>

          {/* Body */}
          <p className="text-lg text-muted-foreground leading-relaxed font-sans whitespace-pre-line mb-10">
            {footerCta.body}
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="text-base px-8 py-6 font-sans font-medium">
              <Link to={ROUTES.QUIZ}>
                {footerCta.ctaPrimary}
                <ArrowRight className="ml-3 h-4 w-4" />
              </Link>
            </Button>
            
            <Button 
              asChild 
              size="lg" 
              variant="outline" 
              className="text-base px-8 py-6 font-sans"
            >
              <Link to={ROUTES.DEMO}>
                {footerCta.ctaSecondary}
              </Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
