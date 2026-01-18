import { motion } from 'framer-motion';
import { Sparkles, Map, Calendar, CreditCard } from 'lucide-react';

const steps = [
  {
    number: '01',
    icon: Sparkles,
    title: 'Share Your Vision',
    description: 'Tell us about your dream destination and travel style. Our AI learns what matters most to you.',
  },
  {
    number: '02',
    icon: Map,
    title: 'Receive Your Itinerary',
    description: 'Get a thoughtfully crafted day-by-day plan, complete with curated experiences and local insights.',
  },
  {
    number: '03',
    icon: Calendar,
    title: 'Refine & Customize',
    description: 'Adjust activities, swap hotels, add experiences. Your itinerary evolves with your preferences.',
  },
  {
    number: '04',
    icon: CreditCard,
    title: 'Book With Confidence',
    description: 'Secure your flights, hotels, and experiences in one seamless transaction.',
  },
];

export default function HowItWorksCarousel() {
  return (
    <section className="py-32 bg-secondary/30 relative overflow-hidden">
      {/* Background Texture */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 left-0 right-0 h-px bg-border" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-border" />
      </div>

      <div className="max-w-7xl mx-auto px-8 md:px-16 relative">
        {/* Section Header - Editorial Style */}
        <div className="flex items-start justify-between mb-20">
          <div>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="flex items-center gap-4 mb-4"
            >
              <div className="w-8 h-px bg-primary" />
              <span className="text-xs tracking-[0.25em] uppercase text-muted-foreground font-sans">
                The Process
              </span>
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl md:text-5xl lg:text-6xl font-serif font-normal text-foreground"
            >
              How it <em className="font-normal">works</em>
            </motion.h2>
          </div>
        </div>

        {/* Steps Grid - Editorial Layout */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-px bg-border">
          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="bg-background p-8 lg:p-10 group relative"
            >
              {/* Large Number */}
              <span className="text-6xl font-serif text-muted/20 absolute top-6 right-6 group-hover:text-primary/20 transition-colors duration-500">
                {step.number}
              </span>
              
              {/* Icon */}
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <step.icon className="w-5 h-5 text-primary" />
              </div>
              
              {/* Content */}
              <h3 className="text-xl font-serif text-foreground mb-3">
                {step.title}
              </h3>
              <p className="text-sm text-muted-foreground font-sans leading-relaxed">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}