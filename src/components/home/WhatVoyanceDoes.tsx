import { motion } from 'framer-motion';
import { Check, ArrowRight, Plane, CalendarDays, Building2, MapPin, Users } from 'lucide-react';

const VOYANCE_HANDLES = [
  {
    icon: CalendarDays,
    title: 'Builds your itinerary',
    description: 'Day-by-day plans tailored to your Travel DNA',
  },
  {
    icon: Building2,
    title: 'Hotels',
    description: 'Curated stays that match your style and budget',
  },
  {
    icon: MapPin,
    title: 'Activities',
    description: 'Restaurants, attractions, and hidden gems',
  },
  {
    icon: Users,
    title: 'Group expenses',
    description: 'Split costs and track spending together',
  },
];

const YOU_HANDLE = {
  icon: Plane,
  title: 'Flights',
  description: 'Book anywhere you like, then add your details. We sync your itinerary to your arrival and departure times.',
};

export default function WhatVoyanceDoes() {
  return (
    <section className="py-20 md:py-24 bg-background relative overflow-hidden">
      {/* Top curved divider */}
      <div className="absolute top-0 left-0 right-0 h-24 -translate-y-full">
        <svg viewBox="0 0 1440 96" fill="none" className="absolute bottom-0 w-full h-24" preserveAspectRatio="none">
          <path d="M0 96L1440 96L1440 0C1440 0 1080 96 720 96C360 96 0 0 0 0L0 96Z" className="fill-background" />
        </svg>
      </div>
      
      {/* Decorative vertical line */}
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-border to-transparent hidden lg:block" />
      <div className="max-w-5xl mx-auto px-8 md:px-16">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="w-8 h-px bg-primary" />
            <span className="text-xs tracking-[0.25em] uppercase text-muted-foreground font-sans">
              Clear Expectations
            </span>
            <div className="w-8 h-px bg-primary" />
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-normal text-foreground">
            What Voyance <em className="font-normal">does</em>
          </h2>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* What Voyance Handles */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                <Check className="w-4 h-4 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-foreground font-sans">
                Voyance handles
              </h3>
            </div>

            <div className="space-y-4">
              {VOYANCE_HANDLES.map((item, index) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-start gap-4 p-4 bg-card border border-border rounded-xl hover:border-green-500/30 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                    <item.icon className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground mb-1">{item.title}</h4>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* What You Handle */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <ArrowRight className="w-4 h-4 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground font-sans">
                You handle
              </h3>
            </div>

            <div className="p-6 bg-muted/50 border border-border rounded-xl">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <YOU_HANDLE.icon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h4 className="text-xl font-semibold text-foreground mb-2">{YOU_HANDLE.title}</h4>
                  <p className="text-muted-foreground leading-relaxed">{YOU_HANDLE.description}</p>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Why?</span> We believe you should have full control over your flights. Book with your preferred airline, use your points, find the best deal. Then let us handle the rest.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
