import { motion } from 'framer-motion';

export default function IntroSection() {
  return (
    <section
      id="intro-section"
      className="min-h-screen flex items-center bg-background relative overflow-hidden"
    >
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-gradient-radial from-transparent to-muted/50 opacity-50" />
      
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          <h2 className="text-4xl md:text-5xl font-serif font-semibold text-foreground mb-6">
            Built Around You
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            We're not a booking site. We're your AI-powered travel designer. Voyance
            creates intelligent itineraries based on who you are, not who paid to be seen.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
