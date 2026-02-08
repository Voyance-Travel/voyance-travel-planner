import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown, Loader2, ArrowRight, Lock, Sparkles, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';
import { CREDIT_PACKS, TOPUP_PACK, formatCredits } from '@/config/pricing';
import { BASE_RATE_PER_DAY } from '@/lib/tripCostCalculator';
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

// Revised tiers with outcome-based naming
const tiers = [
  {
    id: 'single',
    name: 'City Break',
    credits: 200,
    price: 15.99,
    bestFor: 'Quick 2-day escape',
    covers: '~2 days',
    breakdown: [
      'A complete 2-day city break',
      'Add 2 days to any existing trip',
      'Multiple activity swaps',
    ],
    example: '2-day Paris weekend: Montmartre to Marais',
  },
  {
    id: 'weekend',
    name: 'Getaway',
    credits: 500,
    price: 29.99,
    featured: true,
    bestFor: 'Long weekend',
    covers: '~3-5 days',
    breakdown: [
      'A complete 5-day standard trip',
      'A 3-day custom trip with hotel search',
      'Extend any trip by 3-5 days',
    ],
    example: '5-day Tokyo: Shibuya, Asakusa, Akihabara, Tsukiji, Harajuku',
  },
  {
    id: 'explorer',
    name: 'Journey',
    credits: 1200,
    price: 65.99,
    bestFor: 'Full week abroad',
    covers: '~7 days + hotels',
    breakdown: [
      'One 7-day multi-city trip with hotels',
      'Two separate 5-day vacations',
      'Mix and match across destinations',
    ],
    example: '7 days: Tokyo (4) then Kyoto (3), fully curated',
  },
  {
    id: 'adventurer',
    name: 'Expedition',
    credits: 2500,
    price: 99.99,
    bestFor: 'Multiple trips',
    covers: '2-3 full vacations',
    breakdown: [
      'Three complete 7-day vacations',
      'One epic 21+ day adventure',
      'Mix and match all year long',
    ],
    example: 'Tokyo + Barcelona + Iceland, all fully curated',
  },
];

// What one unlocked day looks like (moved up, old free/paid arrays removed)

// What one unlocked day looks like
const dayDetails = [
  {
    category: 'Activities',
    items: [
      '4-5 curated stops, timed to avoid crowds',
      'Route-optimized order (no backtracking)',
      '"Why this" context for each pick',
      'Alternative swaps if you don\'t like something',
    ],
  },
  {
    category: 'Restaurants',
    items: [
      'Breakfast, lunch, dinner picks',
      'What to order (specific dishes)',
      'What to skip (tourist traps, overpriced items)',
      'Reservation timing ("book 2 weeks out")',
    ],
  },
  {
    category: 'Budget Tiers',
    items: [
      'Safe ($): Great experience, budget-friendly',
      'Stretch ($$): Worth the upgrade',
      'Splurge ($$$): Once-in-a-lifetime',
    ],
  },
];

const sampleDay = [
  { time: '8:00 AM', name: 'Meiji Shrine', note: 'Private guide, before tourist buses arrive', cost: 'Free-$175' },
  { time: '12:00 PM', name: 'Afuri Harajuku', note: 'Yuzu shio ramen. Skip Takeshita St tourist traps', cost: '$11-$20' },
  { time: '1:45 PM', name: 'Omotesando Architecture Walk', note: 'Prada, Dior, Ando\'s Omotesando Hills', cost: 'Free-$210' },
  { time: '5:00 PM', name: 'teamLab Planets', note: 'Weekday 5 PM = 40% fewer visitors', cost: '$22' },
  { time: '7:30 PM', name: 'Sushi Sora, 38th Floor', note: '8-seat omakase. Book 30+ days ahead', cost: '$105-$280' },
];

const faqs = [
  {
    q: 'How do credits work?',
    a: 'Credits unlock the full details of your trip: booking links, budget breakdowns, reservation timing, and PDF export. 1 day of itinerary is roughly 100 credits. Trips with dietary needs or multiple cities use slightly more.',
  },
  {
    q: 'What\'s free?',
    a: 'Your complete itinerary outline is always free: every day mapped with activities, timing tips, and restaurant picks. You see the full plan before you pay anything.',
  },
  {
    q: 'Do credits expire?',
    a: 'Never. Buy once, use whenever you\'re ready.',
  },
  {
    q: 'Can I regenerate if I don\'t like my trip?',
    a: 'Yes. Regenerating your outline is free. If you\'ve already unlocked details, regenerating those sections uses credits.',
  },
  {
    q: 'What if my trip has special requirements?',
    a: 'Dietary restrictions, accessibility needs, traveling with kids, group trips: we handle it. These trips use slightly more credits because they require more tailored research. Accessibility is never upcharged.',
  },
  {
    q: 'What about multi-city trips?',
    a: 'Trips with multiple destinations use more credits because we plan transit, timing between cities, and optimize your route. A 7-day Tokyo to Kyoto trip uses roughly 690 credits.',
  },
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
        description="Plan your trip free. See your personalized itinerary outline with activities, timing, and restaurant picks. Unlock full details when you're ready to book." 
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
            Plan free. Unlock when you're ready.
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto leading-relaxed"
          >
            See your personalized itinerary outline: activities, timing strategies, and restaurant picks. Completely free.
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto mt-2"
          >
            When you want the full details, use credits to unlock your complete trip.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-8"
          >
            <Button asChild size="lg">
              <Link to={ROUTES.QUIZ}>
                Build My Free Trip
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <p className="text-xs text-muted-foreground mt-3">No credit card required</p>
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-12 sm:py-16">
        <div className="max-w-4xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <h2 className="text-xl sm:text-2xl font-serif font-medium text-foreground mb-2">
              How Voyance Works
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                step: '01',
                title: 'Tell us about your trip',
                desc: 'Destination, dates, who\'s going, what you love, what you hate. Takes 2 minutes.',
              },
              {
                step: '02',
                title: 'Get your itinerary outline',
                desc: 'See every day planned: activities, restaurants, timing tips. This is yours to keep. Free.',
              },
              {
                step: '03',
                title: 'Unlock full details when ready',
                desc: 'Use credits to reveal booking links, budget breakdowns, reservation windows, and PDF export.',
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="text-center"
              >
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary text-sm font-bold mb-4">
                  {item.step}
                </span>
                <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center text-xs text-muted-foreground mt-8 max-w-md mx-auto"
          >
            We want you to see exactly what you're getting before you pay. No bait-and-switch.
          </motion.p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-12 sm:py-16">
        <div className="max-w-5xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <h2 className="text-xl sm:text-2xl font-serif font-medium text-foreground mb-2">
              Pick your adventure
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              1 day of itinerary is roughly 100 credits. Complex trips use slightly more.
              <br />Credits never expire.
            </p>
          </motion.div>

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

                  <div className="mb-3">
                    <h3 className="font-semibold text-foreground text-lg">{tier.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{tier.bestFor}</p>
                  </div>

                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-3xl font-bold text-foreground">${tier.price}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    {formatCredits(tier.credits)} credits. Covers {tier.covers}
                  </p>

                  <div className="border-t border-border pt-4 mb-4 space-y-1.5">
                    {tier.breakdown.map((option, i) => (
                      <p key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                        <span>{option}</span>
                      </p>
                    ))}
                    <p className="flex items-start gap-2 pt-1 text-xs text-muted-foreground">
                      <span className="shrink-0">e.g.</span>
                      <span className="italic">{tier.example}</span>
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
                      `Get ${tier.name}`
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
              {loadingPlan === 'boost' ? 'Loading...' : '+100 credits for $8.99'}
            </button>
            {' '}for swaps, extensions, or upgrades.
          </motion.p>
        </div>
      </section>

      {/* What One Day Looks Like */}
      <section className="py-12 sm:py-16">
        <div className="max-w-4xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <h2 className="text-xl sm:text-2xl font-serif font-medium text-foreground mb-2">
              What one unlocked day looks like
            </h2>
            <p className="text-sm text-muted-foreground">
              When you unlock a day, here's what you get.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-3 gap-4">
            {dayDetails.map((section, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="bg-card border border-border rounded-xl p-5"
              >
                <h3 className="font-semibold text-foreground text-sm mb-3">{section.category}</h3>
                <ul className="space-y-2">
                  {section.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Sample Day Preview */}
      <section className="py-12 sm:py-16 bg-muted/30">
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
              A day in Tokyo, unlocked
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
                <p className="text-xs text-muted-foreground">Day 1</p>
                <p className="font-medium text-foreground">Cultural Immersion</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">On-the-ground spending</p>
                <p className="font-medium text-foreground">$33 - $560</p>
                <p className="text-[10px] text-muted-foreground">Safe to Splurge at each stop</p>
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
                Booking links and full budget breakdowns included with every unlocked day.
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
            className="text-xl sm:text-2xl font-serif font-medium text-foreground mb-3"
          >
            Your trip is waiting.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.05 }}
            className="text-sm text-muted-foreground mb-6"
          >
            Start free. See your personalized itinerary outline in 2 minutes.
            <br />Unlock when ready. Credits never expire.
          </motion.p>
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            <Button asChild size="lg">
              <Link to={ROUTES.QUIZ}>
                Build My Trip
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className="text-xs text-muted-foreground mt-3"
          >
            No credit card required
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
