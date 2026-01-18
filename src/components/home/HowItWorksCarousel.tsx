import { motion } from 'framer-motion';

const steps = [
  {
    number: '01',
    title: 'Share Your Vision',
    description: 'Tell us about your ideal trip—your pace, your passions, your non-negotiables. Our quick questionnaire captures what matters most to you.',
  },
  {
    number: '02',
    title: 'Receive Your Itinerary',
    description: 'Within moments, receive a thoughtfully crafted day-by-day plan. Every recommendation comes with clear reasoning—no black boxes.',
  },
  {
    number: '03',
    title: 'Refine & Customize',
    description: 'Swap activities, adjust timing, add experiences. Your itinerary adapts to your preferences in real-time.',
  },
  {
    number: '04',
    title: 'Book With Confidence',
    description: 'Flights, accommodations, experiences—all bookable in one place with transparent pricing and instant confirmation.',
  },
];

export default function HowItWorksCarousel() {
  return (
    <section className="py-24 bg-gradient-to-b from-background to-secondary/30 border-t border-border relative overflow-hidden">
      {/* Subtle decorative elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-primary/5 to-transparent rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-accent/5 to-transparent rounded-full blur-3xl" />
      
      <div className="max-w-6xl mx-auto px-4 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mb-16"
        >
          <p className="text-sm font-medium tracking-widest text-accent uppercase mb-4">
            How It Works
          </p>
          <h2 className="text-3xl md:text-4xl font-display font-semibold text-foreground leading-tight">
            From inspiration to departure, simplified.
          </h2>
        </motion.div>

        {/* Steps */}
        <div className="grid md:grid-cols-2 gap-x-16 gap-y-12">
          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="group"
            >
              <div className="flex gap-6">
                {/* Number */}
                <span className="text-5xl font-display font-light text-primary/20 group-hover:text-accent/60 transition-colors">
                  {step.number}
                </span>
                
                {/* Content */}
                <div className="pt-2">
                  <h3 className="text-xl font-semibold text-foreground mb-3">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
