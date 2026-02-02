import { motion } from 'framer-motion';
import { strangerCopy } from '@/lib/strangerCopy';
import { X, UtensilsCrossed, AlertTriangle, ThumbsDown } from 'lucide-react';

export default function TheProblemSection() {
  const { problem } = strangerCopy.homepage;

  const frustrations = [
    { text: 'The "must-see" restaurant was overhyped', Icon: UtensilsCrossed },
    { text: 'The itinerary was way too packed', Icon: AlertTriangle },
    { text: 'Half the recommendations weren\'t your thing', Icon: ThumbsDown },
  ];

  return (
    <section className="py-16 sm:py-24 md:py-32 relative overflow-hidden">
      {/* Split background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-muted/50 via-muted/30 to-background" />
        {/* Decorative image peek */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 hidden lg:block">
          <div className="absolute inset-0 bg-gradient-to-r from-muted/50 to-transparent z-10" />
          <img 
            src="https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80"
            alt="Frustrated traveler with map"
            className="w-full h-full object-cover opacity-30"
          />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-16 relative z-10">
        <div className="max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
          >
            {/* Eyebrow with icon */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <X className="w-5 h-5 text-destructive" />
              </div>
              <span className="text-sm tracking-[0.2em] uppercase text-muted-foreground font-medium">
                {problem.eyebrow}
              </span>
            </div>

            {/* Headline */}
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-serif font-normal text-foreground mb-4 sm:mb-6 leading-tight">
              {problem.headline}
            </h2>

            {/* Intro paragraph */}
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground leading-relaxed mb-8 sm:mb-10">
              You spend hours researching. Reading blogs. Watching videos. Building a spreadsheet that gets more complicated every day.
            </p>
          </motion.div>

          {/* Frustration cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-4 mb-10"
          >
            <p className="text-sm uppercase tracking-wide text-muted-foreground mb-4">Then you get there and realize:</p>
            
            {frustrations.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="flex items-center gap-4 p-4 bg-background/80 backdrop-blur-sm rounded-xl border border-border/50 shadow-sm"
              >
                <item.Icon className="w-6 h-6 text-muted-foreground shrink-0" />
                <span className="text-foreground font-medium">{item.text}</span>
              </motion.div>
            ))}
          </motion.div>

          {/* Closing statement */}
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.6 }}
            className="text-xl md:text-2xl font-serif text-foreground italic"
          >
            Your vacation. Wasted on someone else's idea of a good time.
          </motion.p>
        </div>
      </div>
    </section>
  );
}
