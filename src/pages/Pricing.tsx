import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown, Loader2, ArrowRight, ShieldCheck, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';
import { CREDIT_PACKS, TOPUP_PACK, formatCredits } from '@/config/pricing';
import { EXAMPLE_TRIP_COSTS, COMPLEXITY_TIERS, BASE_RATE_PER_DAY } from '@/lib/tripCostCalculator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { EmbeddedCheckoutModal } from '@/components/checkout';
import { cn } from '@/lib/utils';

interface CheckoutConfig {
  priceId: string;
  mode: 'subscription' | 'payment';
  productName: string;
  returnPath: string;
  productId?: string;
  credits?: number;
}

// Enhanced tier data with formula-based translations
const tiers = [
  {
    id: 'single',
    name: 'Starter',
    credits: 200,
    price: 15.99,
    translates: '~2 days of curated itinerary',
    useCase: 'Generate a 2-day city break, or add extra days to an existing trip.',
    breakdown: {
      options: [
        'A complete 2-day city break',
        'Add 2 days to any existing trip',
        'Multiple activity swaps and regenerations',
      ],
      example: 'A 2-day Paris weekend: Montmartre → Marais',
    },
  },
  {
    id: 'weekend',
    name: 'Weekend',
    credits: 500,
    price: 29.99,
    featured: true,
    translates: '3-5 day trip',
    useCase: 'Generate a complete long weekend trip, or plan a 5-day getaway with room for swaps and extras.',
    breakdown: {
      options: [
        'A complete 5-day standard trip',
        'A 3-day custom trip with hotel search',
        'Extend any trip by 3-5 days',
      ],
      example: 'A 5-day Tokyo trip: Shibuya → Asakusa → Akihabara → Tsukiji → Harajuku',
    },
  },
  {
    id: 'explorer',
    name: 'Explorer',
    credits: 1200,
    price: 65.99,
    translates: 'Week+ trip or multi-trip',
    useCase: 'Generate a full week-long multi-city trip, or plan multiple shorter getaways across any destinations.',
    breakdown: {
      options: [
        'One 7-day multi-city trip with hotels',
        'Two separate 5-day vacations',
        'Mix and match across any destinations',
      ],
      example: '7 days: Tokyo (4) → Kyoto (3), both fully curated with hotels',
    },
  },
  {
    id: 'adventurer',
    name: 'Adventurer',
    credits: 2500,
    price: 99.99,
    translates: 'Multiple vacations',
    useCase: 'Generate up to three complete vacations, or one epic multi-week trip, or mix and match across the whole year.',
    breakdown: {
      options: [
        'Three complete 7-day vacations',
        'One epic 21+ day adventure',
        'Mix and match all year long',
      ],
      example: 'Tokyo (7) + Barcelona (7) + Iceland (7), all fully curated',
    },
  },
];

const whatsInADay = [
  { icon: '📍', label: '4-5 curated activities', desc: 'Timed to avoid crowds, ordered for efficient routing' },
  { icon: '🍽️', label: 'Restaurant picks with dish recs', desc: 'Not just where, but what to order and what to skip' },
  { icon: '💰', label: 'Three budget tiers', desc: 'Safe ($) · Stretch ($$) · Splurge ($$$) for every stop' },
  { icon: '🛡️', label: 'Trap Avoided warnings', desc: 'We flag overhyped spots and suggest better alternatives' },
  { icon: '🕐', label: 'Timing strategies', desc: 'Best arrival windows, crowd patterns, booking lead times' },
  { icon: '🔗', label: 'Booking links included', desc: 'Direct links to reserve. No searching, no middlemen' },
];

const faqs = [
  {
    q: 'How many credits does a trip use?',
    a: `Trip cost is based on a simple formula: ${BASE_RATE_PER_DAY} credits per day, plus a small fee for multi-city routes. Trips with dietary needs, kids, or special occasions use a Custom (1.15×) or Highly Curated (1.30×) multiplier. You always see the exact cost before generating.`,
  },
  {
    q: 'Do credits expire?',
    a: 'Never. Purchased credits are yours until you use them. Only the free 150 monthly credits refresh each month (with a 2-month expiry window).',
  },
  {
    q: 'What if my trip has special requirements?',
    a: 'Trips with vegan/halal/kosher dietary needs, kids, pets, strict budgets, or special occasions use slightly more credits because our AI does extra work to match venues to your specific needs. Accessibility is always free, no upcharge, ever.',
  },
  {
    q: 'What about multi-city trips?',
    a: 'Multi-city trips add a small routing fee: +60 credits for 2 cities, +120 for 3, capped at +180 for 4+. This covers cross-city logistics, transfers, and optimized sequencing.',
  },
  {
    q: 'Can I regenerate a trip if I don\'t like it?',
    a: 'Yes! Day regeneration costs 90 credits per day. Activity swaps cost 15 credits each. Both are designed to let you fine-tune without regenerating the entire trip.',
  },
  {
    q: 'What\'s included free?',
    a: 'PDF export, trip sharing, route optimization, AI companion chat, group blending, budget tracking, and weather forecasts are all free with any credit balance.',
  },
];

const sampleDay = [
  { time: '8:00 AM', name: 'Meiji Shrine', note: 'Private guide, before tourist buses arrive', cost: 'Free–$175' },
  { time: '12:00 PM', name: 'Afuri Harajuku', note: 'Yuzu shio ramen · skip Takeshita St tourist traps', cost: '$11–$20' },
  { time: '1:45 PM', name: 'Omotesando Architecture Walk', note: 'Prada → Dior → Ando\'s Omotesando Hills', cost: 'Free–$210' },
  { time: '5:00 PM', name: 'teamLab Planets', note: 'Weekday 5 PM = 40% fewer visitors', cost: '$22' },
  { time: '7:30 PM', name: 'Sushi Sora, 38th Floor', note: '8-seat omakase · book 30+ days ahead', cost: '$105–$280' },
];

export default function Pricing() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [checkoutConfig, setCheckoutConfig] = useState<CheckoutConfig | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast({ title: 'Purchase complete!', description: 'Credits have been added to your account.' });
      searchParams.delete('success');
      setSearchParams(searchParams);
    }
    if (searchParams.get('canceled') === 'true') {
      toast({ title: 'No worries', description: 'You can get credits whenever you\'re ready.' });
      searchParams.delete('canceled');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams, toast]);

  const openCheckout = async (packId: string) => {
    setLoadingPlan(packId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: 'Sign in first', description: 'Create an account to get started.' });
        navigate('/signin?redirect=/pricing');
        return;
      }
      
      const pack = packId === 'topup' || packId === 'boost'
        ? TOPUP_PACK 
        : CREDIT_PACKS.find(p => p.id === packId);
      
      if (!pack) return;

      setCheckoutConfig({ 
        priceId: pack.priceId, 
        mode: 'payment', 
        productName: `${pack.name} - ${formatCredits(pack.credits)} Credits`, 
        returnPath: '/pricing?success=true',
        productId: pack.productId,
        credits: pack.credits,
      });
    } catch (error) {
      toast({ title: 'Something went wrong', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <MainLayout>
      <Head 
        title="Pricing | Voyance" 
        description="Preview any trip free. Use credits to generate full itineraries with photos, hours, and booking links. Buy once, use anytime." 
        canonical="https://travelwithvoyance.com/pricing"
      />
      
      {/* Hero */}
      <section className="pt-20 pb-12 sm:pt-24 sm:pb-16 bg-gradient-to-b from-muted/50 to-background">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs font-medium tracking-widest text-primary uppercase mb-4"
          >
            Pricing
          </motion.p>
          
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="text-3xl sm:text-4xl md:text-5xl font-serif font-medium text-foreground mb-5 text-balance"
          >
            Credits that translate to trips.
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground text-base sm:text-lg max-w-lg mx-auto"
          >
            See your personalized trip preview free. Unlock full details when you're ready.
            <br className="hidden sm:block" />
            <span className="sm:inline block mt-1 sm:mt-0">Buy once, use anytime. Credits never expire.</span>
          </motion.p>
        </div>
      </section>

      {/* Free Tier Banner */}
      <section className="py-6 sm:py-8">
        <div className="max-w-2xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-primary/5 border border-primary/20 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4"
          >
            <div className="text-center sm:text-left">
              <p className="text-primary font-semibold text-sm mb-1">
                Free: 150 credits / month
              </p>
              <p className="text-muted-foreground text-sm">
                Get your personalized trip preview every month. Unlock details when ready.
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="shrink-0 border-primary/30 text-primary hover:bg-primary/5">
              <Link to={ROUTES.QUIZ}>Start Free</Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-10 sm:py-14">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {tiers.map((tier, index) => {
              const isFeatured = tier.featured;
              
              return (
                <motion.div
                  key={tier.id}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    'relative rounded-2xl p-5 sm:p-6 transition-all duration-300',
                    'bg-card border hover:-translate-y-1',
                    isFeatured ? 'border-primary shadow-md' : 'border-border'
                  )}
                >
                  {isFeatured && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase whitespace-nowrap">
                      Most Popular
                    </span>
                  )}

                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-foreground">{tier.name}</h3>
                    <span className="text-2xl font-bold text-foreground">${tier.price}</span>
                  </div>

                  <p className="text-xs text-muted-foreground mb-4">
                    {formatCredits(tier.credits)} credits
                  </p>

                  <div className="border-t border-border pt-4 mb-4">
                    <p className="font-medium text-foreground text-sm mb-1">
                      {tier.translates}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {tier.useCase}
                    </p>
                  </div>

                  <div className="space-y-1.5 text-xs text-muted-foreground pb-4 border-b border-border mb-4">
                    {tier.breakdown.options.map((option, i) => (
                      <p key={i} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                        <span>{option}</span>
                      </p>
                    ))}
                    <p className="flex items-start gap-2 pt-1">
                      <span>💡</span>
                      <span className="italic">{tier.breakdown.example}</span>
                    </p>
                  </div>

                  <Button 
                    className="w-full"
                    variant={isFeatured ? 'default' : 'outline'}
                    onClick={(e) => {
                      e.stopPropagation();
                      openCheckout(tier.id);
                    }}
                    disabled={loadingPlan === tier.id}
                  >
                    {loadingPlan === tier.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      `Get ${formatCredits(tier.credits)} Credits`
                    )}
                  </Button>
                </motion.div>
              );
            })}
          </div>

          {/* Boost */}
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center text-sm text-muted-foreground mt-8"
          >
            Need a quick top-up?{' '}
            <button 
              onClick={() => openCheckout('boost')}
              disabled={loadingPlan === 'boost'}
              className="text-primary font-medium hover:underline disabled:opacity-50"
            >
              {loadingPlan === 'boost' ? 'Loading...' : 'Boost · $8.99'}
            </button>
            : 100 credits for swaps, regenerations, or extending a trip.
          </motion.p>
        </div>
      </section>

      {/* What Can You Build? */}
      <section className="py-12 sm:py-16 bg-muted/30">
        <div className="max-w-4xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <h2 className="text-xl sm:text-2xl font-serif font-medium text-foreground mb-2">
              What can you build with credits?
            </h2>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">
              Real trip examples so you know exactly what you're getting.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-card border border-border rounded-2xl overflow-hidden"
          >
            <div className="divide-y divide-border">
              {EXAMPLE_TRIP_COSTS.map((example, i) => (
                <div key={i} className="flex items-center justify-between px-5 sm:px-6 py-4">
                  <span className="text-sm text-muted-foreground">{example.label}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-medium text-foreground text-sm">{formatCredits(example.credits)}</span>
                    <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">{example.pack}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* All Features Included */}
      <section className="py-12 sm:py-16">
        <div className="max-w-5xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <h2 className="text-xl sm:text-2xl font-serif font-medium text-foreground mb-2">
              Everything included with credits
            </h2>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">
              No hidden tiers. No feature gates. Every credit unlocks the full Voyance experience.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: '👥', label: 'Group Trip Blending', desc: 'Combine travel preferences across multiple travelers into one balanced itinerary' },
              { icon: '🔗', label: 'Share & Collaborate', desc: 'Invite friends to view or edit trips together in real-time' },
              { icon: '💸', label: 'Split Costs', desc: 'Track who owes what, assign payments, and settle up easily' },
              { icon: '📊', label: 'Budget Tracking', desc: 'Set trip budgets, see spending by category, get alerts before you overspend' },
              { icon: '🌤️', label: 'Weather Forecasts', desc: 'See daily weather for your destination dates built into your itinerary' },
              { icon: '🍜', label: 'Restaurant Search', desc: 'AI-powered restaurant recommendations with what to order and what to skip' },
              { icon: '➕', label: 'Add Your Own', desc: 'Insert custom activities, notes, or reservations into any day' },
              { icon: '🔄', label: 'Swap Alternatives', desc: 'Don\'t like a pick? Swap it instantly with curated alternatives' },
              { icon: '🗺️', label: 'Route Optimization', desc: 'Activities ordered to minimize backtracking and maximize your time' },
              { icon: '🤖', label: 'AI Trip Companion', desc: 'Ask questions, get suggestions, and refine your trip with AI chat' },
              { icon: '📄', label: 'PDF Export', desc: 'Download your full itinerary as a polished, printable PDF' },
              { icon: '🔒', label: 'Lock Activities', desc: 'Pin must-do activities so regenerations keep them in place' },
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.03 }}
                className="bg-card border border-border rounded-xl p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{feature.icon}</span>
                  <h3 className="font-medium text-foreground text-sm">{feature.label}</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {feature.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* What's In One Day */}
      <section className="py-12 sm:py-16 bg-muted/30">
        <div className="max-w-4xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-8"
          >
            <h2 className="text-xl sm:text-2xl font-serif font-medium text-foreground mb-2">
              Every day includes
            </h2>
            <p className="text-sm text-muted-foreground">
              This is what one day of itinerary actually produces.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {whatsInADay.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="bg-card border border-border rounded-xl p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{item.icon}</span>
                  <h3 className="font-medium text-foreground text-sm">{item.label}</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Sample Day Preview */}
      <section className="py-12 sm:py-16">
        <div className="max-w-2xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-6"
          >
            <p className="text-xs font-medium tracking-widest text-primary uppercase mb-2">
              Real example
            </p>
            <h2 className="text-xl sm:text-2xl font-serif font-medium text-foreground">
              Here's what your Tokyo preview looks like:
            </h2>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-card border border-border rounded-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
              <div>
                <p className="text-xs text-muted-foreground">Day 1 · Preview</p>
                <p className="font-medium text-foreground">Cultural Immersion</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Your on-the-ground spending</p>
                <p className="font-medium text-foreground">$33 - $560</p>
                <p className="text-[10px] text-muted-foreground">Safe → Splurge at each stop</p>
              </div>
            </div>

            <div className="divide-y divide-border">
              {sampleDay.map((stop, i) => (
                <div key={i} className="flex gap-4 p-4">
                  <span className="text-xs text-muted-foreground font-mono whitespace-nowrap pt-0.5">
                    {stop.time}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm">{stop.name}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                      <span className="text-xs text-muted-foreground">{stop.note}</span>
                      <span className="text-xs text-primary font-medium">{stop.cost}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-muted/30 border-t border-border">
              <p className="text-xs text-muted-foreground text-center">
                Preview your full trip free. Generate full details with credits when ready.
              </p>
            </div>
          </motion.div>
        </div>
      </section>


      {/* FAQ */}
      <section className="py-12 sm:py-16">
        <div className="max-w-2xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-8"
          >
            <h2 className="text-xl sm:text-2xl font-serif font-medium text-foreground mb-2">
              Common questions
            </h2>
            <p className="text-sm text-muted-foreground">
              How credits work, what they buy, and what to expect.
            </p>
          </motion.div>

          <div className="border border-border rounded-2xl overflow-hidden bg-card divide-y divide-border">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="cursor-pointer"
                onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
              >
                <div className="flex items-center justify-between p-4">
                  <h3 className="font-medium text-foreground text-sm pr-4">{faq.q}</h3>
                  <ChevronDown className={cn(
                    'w-4 h-4 text-muted-foreground shrink-0 transition-transform',
                    expandedFaq === i && 'rotate-180'
                  )} />
                </div>
                <AnimatePresence>
                  {expandedFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <p className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">
                        {faq.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-16 sm:py-20 bg-primary/5 border-t border-primary/10">
        <div className="max-w-xl mx-auto px-4 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-xl sm:text-2xl font-serif font-medium text-foreground mb-4"
          >
            Your trip preview is always free. Every month.
          </motion.h2>
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            <Button asChild size="lg">
              <Link to={ROUTES.QUIZ}>
                Build My Itinerary
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className="text-sm text-muted-foreground mt-4"
          >
            No credit card. 150 free credits. Takes 2 minutes.
          </motion.p>
        </div>
      </section>

      {/* Checkout Modal */}
      {checkoutConfig && (
        <EmbeddedCheckoutModal
          isOpen={!!checkoutConfig}
          onClose={() => setCheckoutConfig(null)}
          priceId={checkoutConfig.priceId}
          mode={checkoutConfig.mode}
          productName={checkoutConfig.productName}
          returnPath={checkoutConfig.returnPath}
          productId={checkoutConfig.productId}
          credits={checkoutConfig.credits}
        />
      )}
    </MainLayout>
  );
}
