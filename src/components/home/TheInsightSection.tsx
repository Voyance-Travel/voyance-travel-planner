import { motion } from 'framer-motion';
import { strangerCopy } from '@/lib/strangerCopy';
import { Lightbulb, Compass, UtensilsCrossed, Bed, Mountain } from 'lucide-react';

export default function TheInsightSection() {
  const { insight } = strangerCopy.homepage;

  const travelerTypes = [
    { text: 'See every landmark', icon: Compass, color: 'text-blue-500' },
    { text: 'Long lunches, nowhere to be', icon: UtensilsCrossed, color: 'text-amber-500' },
    { text: 'Adventure seekers', icon: Mountain, color: 'text-green-500' },
    { text: 'Rest & recharge', icon: Bed, color: 'text-purple-500' },
  ];

  return (
    <section className="py-24 md:py-32 relative overflow-hidden">
      {/* Background with accent */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/5 to-background" />
      
      {/* Decorative circles */}
      <div className="absolute -left-32 top-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute -right-32 bottom-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />

      <div className="max-w-6xl mx-auto px-6 md:px-16 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left: Content */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
          >
            {/* Eyebrow with icon */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Lightbulb className="w-5 h-5 text-primary" />
              </div>
              <span className="text-sm tracking-[0.2em] uppercase text-muted-foreground font-medium">
                {insight.eyebrow}
              </span>
            </div>

            {/* Headline */}
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-serif font-normal text-foreground mb-6 leading-tight">
              {insight.headline}
            </h2>

            {/* Body */}
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-8">
              You're not a generic traveler. The problem isn't your research skills—it's that no one asked what kind of traveler you are.
            </p>

            {/* The key insight */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="p-6 bg-primary/10 rounded-2xl border border-primary/20"
            >
              <p className="text-2xl md:text-3xl font-serif text-foreground mb-2">
                We ask.
              </p>
              <p className="text-muted-foreground">
                A few thoughtful questions. Then an itinerary that actually fits how you travel.
              </p>
            </motion.div>
          </motion.div>

          {/* Right: Traveler types visualization */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            {/* Image with overlay */}
            <div className="relative rounded-2xl overflow-hidden aspect-[4/5] shadow-2xl">
              <img 
                src="https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=800&q=80"
                alt="Happy travelers exploring"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              
              {/* Traveler type cards overlaid */}
              <div className="absolute bottom-6 left-6 right-6 space-y-3">
                {travelerTypes.map((type, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.4 + i * 0.1 }}
                    className="flex items-center gap-3 p-3 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg"
                  >
                    <type.icon className={`w-5 h-5 ${type.color}`} />
                    <span className="text-sm font-medium text-gray-900">{type.text}</span>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Decorative badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.6 }}
              className="absolute -top-4 -right-4 w-24 h-24 bg-primary rounded-full flex items-center justify-center shadow-xl"
            >
              <span className="text-primary-foreground text-xs font-bold text-center leading-tight px-2">
                27 Travel<br />Archetypes
              </span>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
