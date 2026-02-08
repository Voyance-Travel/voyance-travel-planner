import { useState, useEffect } from 'react';
import pricingHero from '@/assets/pricing-hero.jpg';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Check, ChevronDown, Loader2, ArrowRight, Lock, Sparkles,
  MapPin, Camera, Lightbulb, DollarSign, Footprints, ExternalLink,
  Pencil, FileDown, Dna, Users, Heart, Accessibility,
  CalendarClock, UtensilsCrossed, ShieldAlert, Clock, Route, Cloud,
  Bus, Share2, Receipt, BarChart3, Plus, Bookmark, Bot, Star,
  Hammer, Ticket
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';
import { CREDIT_PACKS, TOPUP_PACK, formatCredits } from '@/config/pricing';

import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { EmbeddedCheckoutModal } from '@/components/checkout';
import { cn } from '@/lib/utils';

// =============================================================================
// Types & Config
// =============================================================================

interface CheckoutConfig {
  priceId: string;
  mode: 'subscription' | 'payment';
  productName: string;
  returnPath: string;
  productId?: string;
  credits?: number;
}

const tiers = [
  {
    id: 'single',
    name: 'Starter',
    credits: 200,
    price: 15.99,
    bestFor: 'Quick city break',
  },
  {
    id: 'weekend',
    name: 'Weekend',
    credits: 500,
    price: 29.99,
    featured: true,
    bestFor: 'Long weekend or short trip',
  },
  {
    id: 'explorer',
    name: 'Explorer',
    credits: 1200,
    price: 65.99,
    bestFor: 'Week-long adventure or multi-city',
  },
  {
    id: 'adventurer',
    name: 'Adventurer',
    credits: 2500,
    price: 99.99,
    bestFor: 'Multiple trips throughout the year',
  },
];

const freePreviewFeatures = [
  { icon: CalendarClock, text: '5-7 curated activities', detail: 'Real venues we picked for you' },
  { icon: Clock, text: 'Timing & flow', detail: 'When to arrive, how the day moves' },
  { icon: Star, text: 'Ratings & reviews', detail: 'What others think' },
  { icon: Ticket, text: 'Booking alerts', detail: 'Which spots need reservations' },
  { icon: Cloud, text: 'Weather', detail: 'Conditions for your dates' },
  { icon: Dna, text: 'Why we picked it', detail: 'Personalized to your travel style' },
];

const unlockGroups = [
  {
    title: 'Full Trip',
    items: [
      { icon: CalendarClock, text: 'All remaining days built out (beyond your free 2)' },
      { icon: Route, text: 'Complete activity schedule' },
    ],
  },
  {
    title: 'Actionable Details',
    items: [
      { icon: MapPin, text: 'Addresses & maps' },
      { icon: Camera, text: 'Photos' },
      { icon: Star, text: 'Ratings & reviews' },
      { icon: DollarSign, text: 'Costs & budget tiers' },
      { icon: Cloud, text: 'Weather forecasts' },
      { icon: Lightbulb, text: 'Insider tips: what to order, what to skip' },
      { icon: Ticket, text: 'Booking alerts & reservation links' },
      { icon: Bus, text: 'Transportation between stops' },
      { icon: ExternalLink, text: 'Direct booking links' },
    ],
  },
  {
    title: 'Editing & Export',
    items: [
      { icon: Pencil, text: 'Swap, reorder, lock activities' },
      { icon: Plus, text: 'Add your own stops' },
      { icon: FileDown, text: 'PDF export' },
    ],
  },
];

const everythingIncluded = [
  {
    title: 'Planning',
    items: [
      { icon: Dna, text: 'Travel DNA matching' },
      { icon: Users, text: 'Group trip blending' },
      { icon: Accessibility, text: 'Dietary & accessibility support' },
      { icon: Heart, text: 'Special occasion curation' },
    ],
  },
  {
    title: 'Your Itinerary',
    items: [
      { icon: CalendarClock, text: '5-7 activities per day' },
      { icon: UtensilsCrossed, text: 'Restaurant picks with dish recommendations' },
      { icon: DollarSign, text: 'Budget tiers: Safe ($) / Stretch ($$) / Splurge ($$$)' },
      { icon: ShieldAlert, text: 'Trap warnings \u2014 overhyped spots flagged' },
      { icon: Clock, text: 'Timing strategies \u2014 when to arrive, when to book' },
    ],
  },
  {
    title: 'Logistics',
    items: [
      { icon: Route, text: 'Route optimization' },
      { icon: Bus, text: 'Transportation between stops' },
      { icon: Cloud, text: 'Weather forecasts' },
      { icon: ExternalLink, text: 'Direct booking links' },
    ],
  },
  {
    title: 'Collaboration',
    items: [
      { icon: Share2, text: 'Share & edit with others' },
      { icon: Receipt, text: 'Split costs' },
      { icon: BarChart3, text: 'Budget tracking' },
    ],
  },
  {
    title: 'Editing',
    items: [
      { icon: Pencil, text: 'Swap activities' },
      { icon: Bookmark, text: 'Lock favorites' },
      { icon: Plus, text: 'Add custom stops' },
      { icon: FileDown, text: 'PDF export' },
    ],
  },
  {
    title: 'AI Support',
    items: [
      { icon: Bot, text: 'Trip companion for questions & refinements' },
    ],
  },
];

const sampleDay = [
  { time: '9:00 AM', name: 'La Boqueria Market', rating: '4.7', type: 'Food market' },
  { time: '11:30 AM', name: 'Gothic Quarter Walk', rating: '4.8', type: 'Historic district' },
  { time: '2:00 PM', name: 'Can Culleretes', rating: '4.5', type: 'Traditional Catalan', booking: 'Booking recommended' },
  { time: '4:30 PM', name: 'Park Güell', rating: '4.6', type: null, booking: 'Booking required' },
];

const faqs = [
  {
    q: 'How do credits work?',
    a: 'Credits unlock your full itinerary \u2014 all days plus actionable details like addresses, costs, and booking links. You see the exact credit cost for your specific trip before you unlock.',
  },
  {
    q: 'Do I get free credits?',
    a: 'Yes! Every user gets 150 free credits every month. Free credits expire after 2 months if unused, so use them or bank up to 300.',
  },
  {
    q: 'Do purchased credits expire?',
    a: 'Never. Purchased credits are yours forever. Only the monthly free credits have a 2-month expiration.',
  },
  {
    q: 'What if I don\'t like the preview?',
    a: 'Adjust your preferences and regenerate — your first 2 days are always free. Or switch to manual mode and build your own.',
  },
  {
    q: 'Can I unlock individual days?',
    a: 'Yes! You can unlock days one at a time or all at once. Mix unlocked days with manual planning however you like.',
  },
  {
    q: 'What about dietary, accessibility, or special occasions?',
    a: 'We handle it. Tell us your needs and your itinerary reflects them.',
  },
];

// =============================================================================
// Component
// =============================================================================

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
        description="See your first 2 days free with real venues and timing. Unlock the full itinerary when you're ready, or build it yourself." 
        canonical="https://travelwithvoyance.com/pricing"
      />
      
      {/* ================================================================= */}
      {/* HERO                                                              */}
      {/* ================================================================= */}
      <section className="relative pt-20 pb-12 sm:pt-24 sm:pb-16 overflow-hidden">
        <div className="absolute inset-0">
          <img src={pricingHero} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-background/70" />
        </div>
        <div className="relative max-w-3xl mx-auto px-4 text-center">
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
            See your first 2 days. Unlock the rest when you're ready.
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto leading-relaxed"
          >
            We'll build your first 2 days for free: real venues, real timing, curated for you. Love it? Unlock the rest of your itinerary. Want control? Build it yourself.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-8"
          >
            <Button asChild size="lg">
              <Link to={ROUTES.QUIZ}>
                Start Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <p className="text-xs text-muted-foreground mt-3">No credit card required</p>
          </motion.div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* HOW IT WORKS                                                      */}
      {/* ================================================================= */}
      <section className="py-12 sm:py-16">
        <div className="max-w-4xl mx-auto px-4">
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-xl sm:text-2xl font-serif font-medium text-foreground mb-10 text-center"
          >
            How It Works
          </motion.h2>

          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { title: 'Tell us about your trip', desc: 'Destination, dates, who\'s going, what you love, what you skip. 2 minutes.' },
              { title: 'Preview your first 2 days — free', desc: 'See 5-7 curated activities per day with real venues, timing, and ratings. Get a feel for how we plan before you commit.' },
              { title: 'Choose your path', desc: 'Unlock: Use credits to reveal the rest of your itinerary — every day, every detail, ready to book. Build: Use our framework to create your own itinerary manually.' },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="text-center"
              >
                <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* YOUR FREE PREVIEW                                                 */}
      {/* ================================================================= */}
      <section className="py-12 sm:py-16 bg-muted/30">
        <div className="max-w-4xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <h2 className="text-xl sm:text-2xl font-serif font-medium text-foreground mb-2">
              Your Free Preview
            </h2>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">
              Your first 2 days include:
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 gap-3 max-w-3xl mx-auto">
            {freePreviewFeatures.map((feat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04 }}
                className="flex items-start gap-3 bg-card border border-border rounded-xl p-4"
              >
                <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                  <feat.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">{feat.text}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{feat.detail}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center text-xs text-muted-foreground mt-8 italic"
          >
            Details like addresses, costs, photos, and booking links unlock with credits.
          </motion.p>
        </div>
      </section>

      {/* ================================================================= */}
      {/* WHAT CREDITS UNLOCK                                               */}
      {/* ================================================================= */}
      <section className="py-12 sm:py-16">
        <div className="max-w-4xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <h2 className="text-xl sm:text-2xl font-serif font-medium text-foreground mb-2">
              What Credits Unlock
            </h2>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">
              Unlock your full itinerary: every day, every detail.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {unlockGroups.map((group, gi) => (
              <motion.div
                key={gi}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: gi * 0.06 }}
                className="bg-card border border-primary/20 rounded-xl p-5"
              >
                <h3 className="font-semibold text-foreground text-sm mb-4">{group.title}</h3>
                <ul className="space-y-2.5">
                  {group.items.map((item, ii) => (
                    <li key={ii} className="flex items-start gap-2.5 text-xs text-muted-foreground">
                      <item.icon className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      <span>{item.text}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* CREDIT PACKS                                                      */}
      {/* ================================================================= */}
      <section className="py-12 sm:py-16 bg-muted/30">
        <div className="max-w-5xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <h2 className="text-xl sm:text-2xl font-serif font-medium text-foreground mb-2">
              Credit Packs
            </h2>
            <p className="text-sm text-muted-foreground">
              Purchased credits never expire. Plus, every user gets 150 free credits monthly.
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
                  <p className="text-xs text-muted-foreground mb-5">
                    {formatCredits(tier.credits)} credits
                  </p>

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

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center text-sm text-muted-foreground mt-8"
          >
            Need a top-up?{' '}
            <button 
              onClick={() => openCheckout('boost')}
              disabled={loadingPlan === 'boost'}
              className="text-primary font-medium hover:underline disabled:opacity-50"
            >
              {loadingPlan === 'boost' ? 'Loading...' : 'Boost: 100 credits for $8.99'}
            </button>
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mt-6 bg-card border border-border rounded-xl p-4 max-w-lg mx-auto"
          >
            <p className="text-sm font-medium text-foreground mb-1">🎁 150 free credits every month</p>
            <p className="text-xs text-muted-foreground">
              Every user gets 150 credits monthly (expire in 2 months). Purchased credits never expire.
            </p>
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center text-xs text-muted-foreground mt-3"
          >
            You'll see the exact credit cost for your trip before you unlock.
          </motion.p>
        </div>
      </section>

      {/* ================================================================= */}
      {/* EVERYTHING INCLUDED                                               */}
      {/* ================================================================= */}
      <section className="py-12 sm:py-16">
        <div className="max-w-5xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <h2 className="text-xl sm:text-2xl font-serif font-medium text-foreground mb-2">
              Everything Included
            </h2>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">
              No tiers. No feature gates. Credits unlock the full experience.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {everythingIncluded.map((group, gi) => (
              <motion.div
                key={gi}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: gi * 0.06 }}
                className="bg-card border border-border rounded-xl p-5"
              >
                <h3 className="font-semibold text-foreground text-sm mb-4">{group.title}</h3>
                <ul className="space-y-2.5">
                  {group.items.map((item, ii) => (
                    <li key={ii} className="flex items-start gap-2.5 text-xs text-muted-foreground">
                      <item.icon className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      <span>{item.text}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* EXAMPLE: DAY 1 PREVIEW                                            */}
      {/* ================================================================= */}
      <section className="py-12 sm:py-16 bg-muted/30">
        <div className="max-w-2xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-6"
          >
            <p className="text-xs font-medium tracking-widest text-primary uppercase mb-2">
              Example
            </p>
            <h2 className="text-xl sm:text-2xl font-serif font-medium text-foreground">
              Free Preview: Days 1 & 2
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              What you see free (per day):
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-card border border-border rounded-2xl overflow-hidden"
          >
            <div className="divide-y divide-border">
              {sampleDay.map((stop, i) => (
                <div key={i} className="flex gap-4 p-4">
                  <span className="text-xs text-muted-foreground font-mono whitespace-nowrap pt-0.5">
                    {stop.time}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm">{stop.name}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Star className="h-3 w-3 text-primary" /> {stop.rating}
                      </span>
                      {stop.type && (
                        <span className="text-xs text-muted-foreground">{stop.type}</span>
                      )}
                      {stop.booking && (
                        <span className="text-xs text-primary flex items-center gap-1">
                          <Ticket className="h-3 w-3" /> {stop.booking}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-muted/30 border-t border-border">
              <p className="text-xs text-muted-foreground text-center">
                Addresses, costs, photos, tips, and booking links unlock with credits.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* OR BUILD IT YOURSELF                                              */}
      {/* ================================================================= */}
      <section className="py-12 sm:py-16">
        <div className="max-w-2xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-card border border-border rounded-2xl p-6 sm:p-8 text-center"
          >
            <div className="p-3 rounded-xl bg-muted/50 inline-flex mb-4">
              <Hammer className="h-6 w-6 text-muted-foreground" />
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-medium text-foreground mb-3">
              Or Build It Yourself
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto mb-4">
              Don't want to pay? Use our manual builder: start with your free 2-day preview, add your own activities, and research at your own pace.
            </p>
            <p className="text-xs text-muted-foreground italic">
              Credits unlock our curation. The builder is always free.
            </p>
          </motion.div>
        </div>
      </section>


      {/* ================================================================= */}
      {/* FAQ                                                               */}
      {/* ================================================================= */}
      <section className="py-12 sm:py-16">
        <div className="max-w-2xl mx-auto px-4">
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-xl sm:text-2xl font-serif font-medium text-foreground mb-8 text-center"
          >
            FAQ
          </motion.h2>

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

      {/* ================================================================= */}
      {/* BOTTOM CTA                                                        */}
      {/* ================================================================= */}
      <section className="py-16 sm:py-20 bg-primary/5 border-t border-primary/10">
        <div className="max-w-xl mx-auto px-4 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-xl sm:text-2xl font-serif font-medium text-foreground mb-3"
          >
            See what we'd plan for you.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.05 }}
            className="text-sm text-muted-foreground mb-6"
          >
            Preview your first 2 days in 2 minutes, free. Unlock the full trip when you're ready.
          </motion.p>
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            <Button asChild size="lg">
              <Link to={ROUTES.QUIZ}>
                Start Free
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
            No credit card required.
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
