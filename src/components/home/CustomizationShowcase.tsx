import { motion } from 'framer-motion';
import { Search, DollarSign, MessageSquare, ExternalLink } from 'lucide-react';

const FEATURES = [
  {
    id: 'swap',
    title: 'Find Alternatives in Seconds',
    description: 'Search, filter, see 6 options, swap, done. Your itinerary updates instantly.',
    icon: Search,
    // Placeholder for real product GIF - replace with actual screen recording
    gifPlaceholder: 'swap-activity-demo.gif',
  },
  {
    id: 'budget',
    title: 'Budget Updates Instantly',
    description: 'Swap an activity and watch your trip budget recalculate in real-time.',
    icon: DollarSign,
    gifPlaceholder: 'budget-update-demo.gif',
  },
  {
    id: 'ai-chat',
    title: 'Chat With AI to Customize',
    description: 'Tell the Trip Assistant what you want in plain English. It modifies your itinerary for you.',
    icon: MessageSquare,
    gifPlaceholder: 'ai-chat-demo.gif',
  },
  {
    id: 'book',
    title: 'Reserve & Book Directly',
    description: 'One-click links to Viator, Google Maps, and restaurant sites. Book where you prefer.',
    icon: ExternalLink,
    gifPlaceholder: 'booking-links-demo.gif',
  },
];

function FeatureCard({ feature, index }: { feature: typeof FEATURES[0]; index: number }) {
  const Icon = feature.icon;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      className="group"
    >
      {/* GIF/Video placeholder - replace with real screen recordings */}
      <div className="aspect-[4/3] bg-muted rounded-xl mb-4 overflow-hidden border border-border/50 relative">
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5">
          <div className="text-center p-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Icon className="w-6 h-6 text-primary" />
            </div>
            <p className="text-xs text-muted-foreground">
              Screen recording: {feature.gifPlaceholder}
            </p>
          </div>
        </div>
        {/* When you have real GIFs, replace the above with:
        <img 
          src={`/demos/${feature.gifPlaceholder}`} 
          alt={feature.title}
          className="w-full h-full object-cover"
        />
        */}
      </div>
      
      {/* Content */}
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
            {feature.title}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {feature.description}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export default function CustomizationShowcase() {
  return (
    <section className="py-16 sm:py-24 md:py-32 bg-background relative overflow-hidden">
      {/* Subtle background */}
      <div className="absolute inset-0 opacity-[0.02]">
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '32px 32px' }} />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-8 md:px-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12 md:mb-16"
        >
          <div className="flex items-center justify-center gap-3 sm:gap-4 mb-4">
            <div className="w-6 sm:w-8 h-px bg-primary" />
            <span className="text-[10px] sm:text-xs tracking-[0.25em] uppercase text-muted-foreground font-sans">
              After Generation
            </span>
            <div className="w-6 sm:w-8 h-px bg-primary" />
          </div>
          
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-normal text-foreground mb-4">
            Full Control. Your Way.
          </h2>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Your itinerary is a starting point, not a straitjacket.
          </p>
        </motion.div>

        {/* Four-column Feature Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {FEATURES.map((feature, index) => (
            <FeatureCard key={feature.id} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
