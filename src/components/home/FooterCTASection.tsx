import { motion } from 'framer-motion';
import { ArrowRight, Clock, Lightbulb, Heart, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { strangerCopy } from '@/lib/strangerCopy';
import { ROUTES } from '@/config/routes';

const promises = [
  { icon: Clock, text: 'The quiz takes 4 minutes' },
  { icon: Lightbulb, text: "It's actually interesting" },
  { icon: Heart, text: "You'll learn something about yourself" },
  { icon: ShieldCheck, text: "And we'll never spam you" },
];

export default function FooterCTASection() {
  const { footerCta } = strangerCopy.homepage;

  return (
    <section className="py-24 md:py-32 bg-gradient-to-b from-muted/30 via-background to-background relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-primary/3 to-transparent rounded-full" />
      </div>

      <div className="max-w-5xl mx-auto px-6 md:px-12 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >

          {/* Headline */}
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-normal text-foreground mb-4">
            {footerCta.headline}
          </h2>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-12">
            You're either very thorough (we respect that) or not quite sure yet (also fair).
          </p>

          {/* Promise Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {promises.map((promise, index) => {
              const Icon = promise.icon;
              return (
                <motion.div
                  key={promise.text}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className="group p-4 md:p-5 rounded-2xl bg-card/60 backdrop-blur-sm border border-border/50 hover:border-primary/30 hover:bg-card transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3 group-hover:bg-primary/20 transition-colors">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                    {promise.text}
                  </p>
                </motion.div>
              );
            })}
          </div>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.6 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Button 
              asChild 
              size="lg" 
              className="text-base px-10 py-6 font-medium shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all group"
            >
              <Link to={ROUTES.QUIZ}>
                {footerCta.ctaPrimary}
                <ArrowRight className="ml-3 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
            
            <Button 
              asChild 
              size="lg" 
              variant="outline" 
              className="text-base px-10 py-6 hover:bg-muted/50"
            >
              <Link to={ROUTES.DEMO}>
                {footerCta.ctaSecondary}
              </Link>
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
