import { motion } from 'framer-motion';
import { Sparkles, MapPin, Plane, Calendar } from 'lucide-react';

const steps = [
  {
    number: '01',
    icon: Sparkles,
    title: 'Tell us your style',
    description: 'Take our quick quiz to share your travel preferences, budget, and dream destinations.',
    color: 'from-violet-500 to-purple-600',
  },
  {
    number: '02',
    icon: MapPin,
    title: 'Get your itinerary',
    description: 'Our AI crafts a personalized day-by-day plan based on your unique travel DNA.',
    color: 'from-teal-500 to-cyan-600',
  },
  {
    number: '03',
    icon: Plane,
    title: 'Book everything',
    description: 'Flights, hotels, activities—all bookable in one place with real-time pricing.',
    color: 'from-orange-500 to-amber-600',
  },
  {
    number: '04',
    icon: Calendar,
    title: 'Travel with confidence',
    description: 'Access your itinerary anywhere, with 24/7 support and real-time updates.',
    color: 'from-pink-500 to-rose-600',
  },
];

export default function HowItWorksCarousel() {
  return (
    <section className="py-24 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            How It Works
          </span>
          <h2 className="text-3xl md:text-5xl font-display font-bold text-foreground mb-4">
            Four steps to your perfect trip
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            From inspiration to departure, we handle everything so you can focus on the adventure.
          </p>
        </motion.div>

        {/* Steps Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="relative group"
            >
              <div className="bg-card border border-border rounded-2xl p-6 h-full hover:shadow-lg transition-shadow">
                {/* Step Number */}
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${step.color} text-white font-bold text-lg mb-4`}>
                  {step.number}
                </div>

                {/* Icon */}
                <div className="mb-4">
                  <step.icon className="h-6 w-6 text-muted-foreground" />
                </div>

                {/* Content */}
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  {step.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>

              {/* Connector Line (except last) */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-3 w-6 h-0.5 bg-border" />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
