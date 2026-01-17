import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { motion } from 'framer-motion';
import { CheckCircle, Sparkles, Calendar, Plane } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';

const steps = [
  {
    icon: Sparkles,
    title: 'Tell Us Your Style',
    description: 'Take our quick quiz to share your travel preferences, budget, and dream destinations.',
  },
  {
    icon: Calendar,
    title: 'Get Your Itinerary',
    description: 'Our AI crafts a personalized day-by-day itinerary based on your unique preferences.',
  },
  {
    icon: Plane,
    title: 'Book & Go',
    description: 'Review, customize, and book everything in one place. Then pack your bags!',
  },
];

const features = [
  'AI-powered personalization',
  'Real-time pricing',
  'Flexible booking',
  'Local insider tips',
  '24/7 trip support',
  'Mobile-friendly itineraries',
];

export default function HowItWorks() {
  return (
    <MainLayout>
      <Head
        title="How It Works | Voyance"
        description="Learn how Voyance uses AI to create your perfect personalized travel itinerary in minutes."
      />
      
      {/* Hero */}
      <section className="pt-24 pb-16 bg-gradient-to-b from-primary/5 to-background">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-display font-bold text-foreground mb-4"
          >
            Plan Your Dream Trip in Minutes
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto"
          >
            No more endless research or overwhelming options. Voyance makes travel planning effortless and enjoyable.
          </motion.p>
        </div>
      </section>
      
      {/* Steps */}
      <section className="py-16">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.15 }}
                className="text-center"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-6">
                  <step.icon className="h-8 w-8" />
                </div>
                <div className="text-sm font-medium text-primary mb-2">Step {index + 1}</div>
                <h3 className="text-xl font-semibold text-foreground mb-3">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Features */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-display font-bold text-center text-foreground mb-12">
            What You Get
          </h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {features.map((feature, index) => (
              <motion.div
                key={feature}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-3 p-4 bg-background rounded-lg border border-border"
              >
                <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                <span className="text-foreground">{feature}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      
      {/* CTA */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-display font-bold text-foreground mb-4">
            Ready to Start Planning?
          </h2>
          <p className="text-muted-foreground mb-8">
            Join thousands of travelers who've discovered their perfect trips with Voyance.
          </p>
          <Button asChild size="lg">
            <Link to={ROUTES.START}>Start Planning Free</Link>
          </Button>
        </div>
      </section>
    </MainLayout>
  );
}
