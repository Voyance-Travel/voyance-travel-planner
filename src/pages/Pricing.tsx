import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown, Sparkles, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';
import { CREDIT_PACKS, TOPUP_PACK, formatCredits, CREDIT_COSTS } from '@/config/pricing';
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

// Per-day cost at each tier
const tierDayRates = {
  single: (12 / 200 * 150).toFixed(2),    // $9.00
  starter: (29 / 500 * 150).toFixed(2),   // $8.70
  explorer: (55 / 1200 * 150).toFixed(2), // $6.88
  adventurer: (89 / 2500 * 150).toFixed(2), // $5.34
};

// Enhanced tier data with translations
const tiers = [
  {
    id: 'single',
    name: 'Starter',
    credits: 200,
    price: 12,
    perDay: tierDayRates.single,
    translates: '1 full day of curated itinerary',
    useCase: 'Perfect for adding an extra day to your free preview, or planning a focused day trip.',
    breakdown: {
      days: '1 complete day',
      leftover: '+ 50 credits banked for later',
      example: 'Turn your free Day 1 into a full weekend — add Day 2 for $12',
    },
  },
  {
    id: 'starter',
    name: 'Weekend',
    credits: 500,
    price: 29,
    perDay: tierDayRates.starter,
    featured: true,
    translates: '3 full days of curated itinerary',
    useCase: 'Ideal for a long weekend trip or the core days of a longer vacation.',
    breakdown: {
      days: '3 complete days',
      leftover: '+ 50 credits banked for later',
      example: 'A 3-day Paris weekend: Montmartre → Marais → Versailles, fully planned',
    },
  },
  {
    id: 'explorer',
    name: 'Explorer',
    credits: 1200,
    price: 55,
    perDay: tierDayRates.explorer,
    translates: '8 full days of curated itinerary',
    useCase: 'One complete 5-day trip plus 3 bonus days for a second destination or extension.',
    breakdown: {
      days: '8 complete days',
      leftover: 'No leftover — exact fit',
      example: '5 days in Tokyo + 3 days in Kyoto, both fully curated',
    },
  },
  {
    id: 'adventurer',
    name: 'Adventurer',
    credits: 2500,
    price: 89,
    perDay: tierDayRates.adventurer,
    translates: '16 full days of curated itinerary',
    useCase: 'Three complete trips with days to spare. Best value for couples or frequent travelers.',
    breakdown: {
      days: '16 complete days',
      leftover: '+ 100 credits banked',
      example: 'Tokyo (5) + Barcelona (5) + Iceland (5) + 1 bonus day anywhere',
    },
  },
];

const creditBreakdown = [
  { item: 'One curated day', credits: CREDIT_COSTS.UNLOCK_DAY, note: '4–5 timed activities, restaurants, logistics' },
  { item: 'One 3-day weekend trip', credits: CREDIT_COSTS.UNLOCK_DAY * 3, note: 'Complete short getaway' },
  { item: 'One 5-day trip', credits: CREDIT_COSTS.UNLOCK_DAY * 5, note: 'Full vacation itinerary' },
  { item: 'One 7-day trip', credits: CREDIT_COSTS.UNLOCK_DAY * 7, note: 'Extended exploration' },
  { item: 'Trip regeneration', credits: CREDIT_COSTS.UNLOCK_DAY, note: 'Start fresh with new preferences' },
  { item: 'Add-a-day extension', credits: CREDIT_COSTS.UNLOCK_DAY, note: 'Extend any existing trip' },
];

const whatsInADay = [
  { icon: '📍', label: '4–5 curated activities', desc: 'Timed to avoid crowds, ordered for efficient routing' },
  { icon: '🍽️', label: 'Restaurant picks with dish recs', desc: 'Not just where — what to order and what to skip' },
  { icon: '💰', label: 'Three budget tiers', desc: 'Safe ($) · Stretch ($$) · Splurge ($$$) for every stop' },
  { icon: '🛡️', label: 'Trap Avoided warnings', desc: 'We flag overhyped spots and suggest better alternatives' },
  { icon: '🕐', label: 'Timing strategies', desc: 'Best arrival windows, crowd patterns, booking lead times' },
  { icon: '🔗', label: 'Booking links included', desc: 'Direct links to reserve — no searching, no middlemen' },
];

const faqs = [
  {
    q: 'How many credits does a trip use?',
    a: 'One day = 150 credits. A 3-day trip uses 450. A 5-day trip uses 750. A 7-day trip uses 1,050. Simple math — you always know what you\'re spending before you generate.',
  },
  {
    q: 'Do credits expire?',
    a: 'Never. Purchased credits are yours until you use them. Only the free 150 monthly credits refresh each month.',
  },
  {
    q: 'What if my trip is shorter or longer than 5 days?',
    a: 'You only spend credits for the days you generate. A 3-day trip uses 450 credits. A 7-day trip uses 1,050. Unused credits stay in your balance for next time.',
  },
  {
    q: 'Can I use credits across different cities?',
    a: 'Absolutely. Use 750 on Tokyo, then 450 on Kyoto next month. Your balance, your call.',
  },
  {
    q: 'What\'s the difference between free and paid days?',
    a: 'Nothing. Same quality, same detail, same three budget tiers. Free gets you 1 day per month so you can see exactly what you\'re buying before you spend anything.',
  },
  {
    q: 'Can I regenerate a trip if I don\'t like it?',
    a: 'Yes — a regeneration costs 150 credits (one day\'s worth). It rebuilds your trip with fresh recommendations based on adjusted preferences.',
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
  const [expandedTier, setExpandedTier] = useState<number | null>(1); // Weekend is expanded by default
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
      
      // Find the pack from CREDIT_PACKS or TOPUP_PACK
      const pack = packId === 'topup' 
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

  // Best rate for cost calculations
  const bestRate = 89 / 2500;

  return (
    <MainLayout>
      <Head 
        title="Pricing | Voyance" 
        description="Credits that translate to trips. 1 day of curated itinerary = 150 credits. Buy once, use anytime." 
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
            1 day of curated itinerary = {CREDIT_COSTS.UNLOCK_DAY} credits.
            <br className="hidden sm:block" />
            <span className="sm:inline block mt-1 sm:mt-0"> Buy once, use anytime. Credits never expire.</span>
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
                Free — 150 credits / month
              </p>
              <p className="text-muted-foreground text-sm">
                That's 1 full day of any destination, every month. Same quality as paid.
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
              const isExpanded = expandedTier === index;
              const isFeatured = tier.featured;
              
              return (
                <motion.div
                  key={tier.id}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => setExpandedTier(isExpanded ? null : index)}
                  className={cn(
                    'relative rounded-2xl p-5 sm:p-6 cursor-pointer transition-all duration-300',
                    'bg-card border hover:-translate-y-1',
                    isFeatured ? 'border-primary shadow-md' : 'border-border',
                    isExpanded && !isFeatured && 'border-primary/50'
                  )}
                >
                  {isFeatured && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase whitespace-nowrap">
                      Most Popular
                    </span>
                  )}

                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-foreground">{tier.name}</h3>
                      <ChevronDown className={cn(
                        'w-4 h-4 text-muted-foreground mt-1 transition-transform',
                        isExpanded && 'rotate-180'
                      )} />
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-foreground">${tier.price}</span>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground mb-4">
                    {formatCredits(tier.credits)} credits · ${tier.perDay} per day
                  </p>

                  {/* Translation - the key part */}
                  <div className="border-t border-border pt-4 mb-4">
                    <p className="font-medium text-foreground text-sm mb-1">
                      {tier.translates}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {tier.useCase}
                    </p>
                  </div>

                  {/* Expanded details */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-2 text-xs text-muted-foreground pb-4 border-b border-border mb-4">
                          <p className="flex items-start gap-2">
                            <span>📅</span>
                            <span>{tier.breakdown.days} of personalized itinerary</span>
                          </p>
                          <p className="flex items-start gap-2">
                            <span>🏦</span>
                            <span>{tier.breakdown.leftover}</span>
                          </p>
                          <p className="flex items-start gap-2">
                            <span>💡</span>
                            <span>{tier.breakdown.example}</span>
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* CTA */}
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

          {/* $5 boost */}
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center text-sm text-muted-foreground mt-8"
          >
            Need just one extra day?{' '}
            <button 
              onClick={() => openCheckout('topup')}
              disabled={loadingPlan === 'topup'}
              className="text-primary font-medium hover:underline disabled:opacity-50"
            >
              {loadingPlan === 'topup' ? 'Loading...' : '$5 Boost — 50 credits'}
            </button>
            {' '}— for quick swaps and AI features.
          </motion.p>
        </div>
      </section>

      {/* Credit Price List */}
      <section className="py-12 sm:py-16 bg-muted/30">
        <div className="max-w-3xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-8"
          >
            <h2 className="text-xl sm:text-2xl font-serif font-medium text-foreground mb-2">
              What credits get you
            </h2>
            <p className="text-sm text-muted-foreground">
              A clear price list so you always know what you're spending.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-card rounded-2xl border border-border overflow-hidden"
          >
            {/* Header */}
            <div className="grid grid-cols-3 text-xs font-medium text-muted-foreground bg-muted/50 px-4 py-3 border-b border-border">
              <span>What you're generating</span>
              <span className="text-center">Credits used</span>
              <span className="text-right">Cost at best rate</span>
            </div>

            {/* Rows */}
            {creditBreakdown.map((row, i) => (
              <div key={i} className="grid grid-cols-3 px-4 py-3 border-b border-border last:border-0 text-sm">
                <div>
                  <p className="font-medium text-foreground">{row.item}</p>
                  <p className="text-xs text-muted-foreground">{row.note}</p>
                </div>
                <div className="flex items-center justify-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span className="font-medium text-foreground">{row.credits}</span>
                </div>
                <div className="text-right">
                  <p className="font-medium text-foreground">
                    ${(row.credits * bestRate).toFixed(2)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Adventurer rate</p>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Rate comparison */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="flex flex-wrap justify-center gap-3 mt-6"
          >
            {tiers.map((t) => (
              <div key={t.id} className="text-center px-4 py-2 bg-card border border-border rounded-xl">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t.name}</p>
                <p className="text-sm font-semibold text-foreground">${t.perDay}/day</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* What's In One Day */}
      <section className="py-12 sm:py-16">
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
              This is what {CREDIT_COSTS.UNLOCK_DAY} credits (one day) actually produces.
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
              Here's what 150 credits generated for Tokyo — Day 1:
            </h2>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-card border border-border rounded-2xl overflow-hidden"
          >
            {/* Day header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
              <div>
                <p className="text-xs text-muted-foreground">Day 1 · 150 credits</p>
                <p className="font-medium text-foreground">Cultural Immersion</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Day cost range</p>
                <p className="font-medium text-foreground">$33 — $560</p>
                <p className="text-[10px] text-muted-foreground">Safe → Splurge</p>
              </div>
            </div>

            {/* Activities */}
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

            {/* Footer */}
            <div className="p-4 bg-muted/30 border-t border-border">
              <p className="text-xs text-muted-foreground text-center">
                This is 1 day · 150 credits · A 5-day trip generates five days like this.
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
            Your first day is always free. Every month.
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
