import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Clock, Sparkles, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';
import { strangerCopy } from '@/lib/strangerCopy';

export default function TheStakesSection() {
  const { stakes } = strangerCopy.homepage;

  const stats = [
    { icon: Clock, value: '30+', label: 'Hours typically spent planning' },
    { icon: Target, value: '70%', label: 'Time wasted on wrong things' },
    { icon: Sparkles, value: '4', label: 'Minutes to get started' },
  ];

  return (
    <section className="py-24 md:py-32 relative overflow-hidden">
      {/* Split background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/10" />
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/8 to-transparent" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute top-20 right-20 w-64 h-64 bg-accent/10 rounded-full blur-2xl" />
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left Column - Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {/* Eyebrow */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-1 bg-primary rounded-full" />
              <span className="text-xs tracking-[0.2em] uppercase text-primary font-medium">
                {stakes.eyebrow}
              </span>
            </div>

            {/* Headline */}
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-serif font-normal text-foreground mb-6 leading-[1.1]">
              Your next trip
              <br />
              <span className="text-primary">is waiting.</span>
            </h2>

            {/* Body - Refined */}
            <div className="space-y-4 mb-8">
              <p className="text-lg text-muted-foreground leading-relaxed">
                But it's not going to plan itself. And it's definitely not going to plan itself <span className="text-foreground font-medium">well</span>.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed">
                We've done the research. We know what works.
                <br />
                <span className="text-foreground">All we need to know is who you are.</span>
              </p>
            </div>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <Button asChild size="lg" className="text-base px-8 py-6 font-medium shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all">
                <Link to={ROUTES.QUIZ}>
                  {stakes.cta}
                  <ArrowRight className="ml-3 h-4 w-4" />
                </Link>
              </Button>
              <p className="text-sm text-muted-foreground self-center">
                {strangerCopy.trust.noCreditCard}
              </p>
            </div>
          </motion.div>

          {/* Right Column - Stats Cards */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-4"
          >
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className={`flex items-center gap-6 p-6 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-all ${
                    index === 2 ? 'bg-primary/5 border-primary/20' : ''
                  }`}
                >
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                    index === 2 ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <div className={`text-3xl font-bold ${
                      index === 2 ? 'text-primary' : 'text-foreground'
                    }`}>
                      {stat.value}{index === 2 && <span className="text-lg ml-1">min</span>}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {stat.label}
                    </div>
                  </div>
                  {index === 2 && (
                    <div className="text-xs font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">
                      With Voyance
                    </div>
                  )}
                </motion.div>
              );
            })}

            {/* Decorative quote */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.6 }}
              className="mt-6 pl-6 border-l-2 border-primary/30"
            >
              <p className="text-muted-foreground italic">
                "The best trips don't happen by accident. They're designed around who you actually are."
              </p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
