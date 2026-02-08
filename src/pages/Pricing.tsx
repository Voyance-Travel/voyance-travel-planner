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
  Bus, Share2, Receipt, BarChart3, Plus, Bookmark, Bot
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';
import { CREDIT_PACKS, TOPUP_PACK, formatCredits } from '@/config/pricing';
import { EXAMPLE_TRIP_COSTS } from '@/lib/tripCostCalculator';
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

const freeFeatures = [
  { icon: CalendarClock, text: 'Every day planned', detail: 'Activities, restaurants, and experiences mapped out' },
  { icon: MapPin, text: 'Real venue names', detail: 'Not placeholders. The actual spots we picked for you' },
  { icon: Clock, text: 'Timing & schedule', detail: 'When to arrive, how your day flows' },
  { icon: Sparkles, text: 'Ratings & reviews', detail: 'See what others think before you commit' },
  { icon: ShieldAlert, text: 'Booking alerts', detail: 'Know which spots need reservations' },
  { icon: Cloud, text: 'Weather forecasts', detail: 'Daily conditions built into your plan' },
  { icon: Dna, text: 'Personalization notes', detail: 'Why we picked this for your travel style' },
];

const unlockFeatures = [
  { icon: MapPin, label: 'Addresses & maps', detail: 'Know exactly where you\'re going' },
  { icon: Camera, label: 'Photos', detail: 'See each spot before you arrive' },
  { icon: Lightbulb, label: 'Voyance Insights', detail: 'Insider tips: what to order, when to arrive, what to skip' },
  { icon: DollarSign, label: 'Costs', detail: 'Budget breakdown for every activity' },
  { icon: Bus, label: 'Transportation', detail: 'How to get between stops (walk, taxi, train)' },
  { icon: ExternalLink, label: 'Booking links', detail: 'Direct links to reserve, no searching' },
  { icon: Pencil, label: 'Full editing', detail: 'Swap activities, reorder days, lock your favorites' },
  { icon: FileDown, label: 'PDF export', detail: 'Download your polished itinerary' },
];

const everythingIncluded = [
  {
    title: 'Planning & Personalization',
    items: [
      { icon: Dna, text: 'Travel DNA matching: itineraries built for how you actually travel' },
      { icon: Users, text: 'Group trip blending: combine preferences across travelers' },
      { icon: Heart, text: 'Special occasion curation: honeymoons, anniversaries, proposals' },
      { icon: Accessibility, text: 'Dietary & accessibility: vegan, halal, wheelchair-friendly, and more' },
    ],
  },
  {
    title: 'Your Itinerary',
    items: [
      { icon: CalendarClock, text: 'Activities tailored to your pace, timed to avoid crowds' },
      { icon: UtensilsCrossed, text: 'Restaurant picks: where to eat, what to order, what to skip' },
      { icon: DollarSign, text: 'Budget tiers: Safe ($), Stretch ($$), Splurge ($$$) for every stop' },
      { icon: ShieldAlert, text: 'Trap warnings: we flag overhyped spots and suggest alternatives' },
      { icon: Clock, text: 'Timing strategies: best arrival windows, booking lead times' },
    ],
  },
  {
    title: 'Booking & Logistics',
    items: [
      { icon: ExternalLink, text: 'Direct booking links: reserve without searching' },
      { icon: Route, text: 'Route optimization: minimal backtracking, maximum time' },
      { icon: Cloud, text: 'Weather built in: daily forecasts on your itinerary' },
      { icon: Bus, text: 'Transportation guidance: walk, taxi, or train between stops' },
    ],
  },
  {
    title: 'Collaboration & Export',
    items: [
      { icon: Share2, text: 'Share your trip: invite others to view or edit' },
      { icon: Receipt, text: 'Split costs: track who owes what' },
      { icon: BarChart3, text: 'Budget tracking: set limits, see spending by category' },
      { icon: Pencil, text: 'Swap activities: get curated alternatives' },
      { icon: Bookmark, text: 'Lock favorites: pin must-dos so regenerations keep them' },
      { icon: Plus, text: 'Add your own: insert custom activities or reservations' },
      { icon: FileDown, text: 'PDF export: download your complete itinerary' },
      { icon: Bot, text: 'AI trip companion: ask questions, get suggestions, refine on the fly' },
    ],
  },
];

const sampleDay = [
  { time: '8:00 AM', name: 'Meiji Shrine', note: 'Private guide, before tourist buses arrive', cost: 'Free - $175' },
  { time: '12:00 PM', name: 'Afuri Harajuku', note: 'Yuzu shio ramen. Skip Takeshita St tourist traps', cost: '$11 - $20' },
  { time: '1:45 PM', name: 'Omotesando Architecture Walk', note: 'Prada → Dior → Ando\'s Omotesando Hills', cost: 'Free - $210' },
  { time: '5:00 PM', name: 'teamLab Planets', note: 'Weekday 5 PM = 40% fewer visitors', cost: '$22' },
  { time: '7:30 PM', name: 'Sushi Sora, 38th Floor', note: '8-seat omakase. Book 30+ days ahead', cost: '$105 - $280' },
];

const faqs = [
  {
    q: 'How do credits work?',
    a: 'Credits unlock your itinerary details: addresses, photos, tips, costs, and booking links. The number of credits depends on your trip: longer trips and trips with special requirements use more because they take more curation.',
  },
  {
    q: 'How many credits will my trip cost?',
    a: 'You\'ll see the exact credit cost before you unlock, no surprises. Browse your full preview first, then decide.',
  },
  {
    q: 'Do credits expire?',
    a: 'Never. Buy once, use whenever you\'re ready.',
  },
  {
    q: 'What if I don\'t like my itinerary?',
    a: 'You can browse the entire preview before spending any credits. If something\'s not right, adjust your preferences and regenerate. Previews are free.',
  },
  {
    q: 'Can I edit my trip after unlocking?',
    a: 'Yes. Swap activities, reorder days, add your own stops, lock your favorites. Full editing is included.',
  },
  {
    q: 'What about dietary restrictions or accessibility needs?',
    a: 'We handle it. Vegan, gluten-free, halal, wheelchair-friendly, mobility considerations: tell us what you need and your itinerary reflects it.',
  },
  {
    q: 'What about honeymoons and special occasions?',
    a: 'We curate specifically for them: romantic restaurants, meaningful moments, special views. These trips get extra attention.',
  },
  {
    q: 'Can I plan a trip for a group?',
    a: 'Yes. We blend preferences across travelers so everyone\'s happy.',
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
        description="Your personalized itinerary is free to preview. Every day, every activity, every restaurant. Unlock the details you need to book when you're ready." 
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
            See your trip. Unlock when you're ready.
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto leading-relaxed"
          >
            Your personalized itinerary is free to preview: every day, every activity, every restaurant. Unlock the details you need to actually book when you're ready to go.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-8"
          >
            <Button asChild size="lg">
              <Link to={ROUTES.QUIZ}>
                Build My Trip Free
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
              { step: '01', title: 'Tell us about your trip', desc: 'Destination, dates, who\'s going, what you love, what you skip. 2 minutes.' },
              { step: '02', title: 'Get your full itinerary, free', desc: 'See every day mapped out. Real venues, real restaurants, real timing. Browse the whole plan before you spend anything.' },
              { step: '03', title: 'Unlock the details', desc: 'When you\'re ready to book, use credits to unlock addresses, booking links, insider tips, photos, and costs.' },
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
        </div>
      </section>

      {/* ================================================================= */}
      {/* WHAT YOU SEE FREE                                                 */}
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
              What You See Free
            </h2>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">
              Your complete itinerary preview includes:
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 gap-3 max-w-3xl mx-auto">
            {freeFeatures.map((feat, i) => (
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
            className="text-center text-sm text-muted-foreground mt-8 italic"
          >
            This is your trip. You just can't book it yet.
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
              When you unlock your itinerary, you get everything you need to actually go:
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 gap-3 max-w-3xl mx-auto">
            {unlockFeatures.map((feat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04 }}
                className="flex items-start gap-3 bg-card border border-primary/20 rounded-xl p-4"
              >
                <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                  <feat.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">{feat.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{feat.detail}</p>
                </div>
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
              Buy once. Use anytime. Never expires.
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
            Need a quick top-up?{' '}
            <button 
              onClick={() => openCheckout('boost')}
              disabled={loadingPlan === 'boost'}
              className="text-primary font-medium hover:underline disabled:opacity-50"
            >
              {loadingPlan === 'boost' ? 'Loading...' : 'Boost Pack: 100 credits for $8.99'}
            </button>
          </motion.p>
        </div>
      </section>

      {/* ================================================================= */}
      {/* WHAT TRIPS ACTUALLY COST                                          */}
      {/* ================================================================= */}
      <section className="py-12 sm:py-16">
        <div className="max-w-2xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-8"
          >
            <h2 className="text-xl sm:text-2xl font-serif font-medium text-foreground mb-2">
              What Trips Actually Cost
            </h2>
            <p className="text-sm text-muted-foreground">
              Real examples, real credit costs.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-card border border-border rounded-2xl overflow-hidden"
          >
            <div className="grid grid-cols-[1fr_auto] text-xs font-medium text-muted-foreground border-b border-border px-4 py-3">
              <span>Trip</span>
              <span>Credits</span>
            </div>
            <div className="divide-y divide-border">
              {EXAMPLE_TRIP_COSTS.map((trip, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto] items-center px-4 py-3">
                  <span className="text-sm text-foreground">{trip.label}</span>
                  <span className="text-sm font-medium text-primary tabular-nums">~{formatCredits(trip.credits)}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-xs text-muted-foreground mt-6 max-w-lg mx-auto text-center leading-relaxed"
          >
            <span className="font-medium text-foreground">Why do some trips cost more?</span>{' '}
            Trips with dietary needs, accessibility requirements, special occasions, or multiple cities take more research and curation. The credit cost reflects that: no surprises, calculated before you unlock.
          </motion.p>
        </div>
      </section>

      {/* ================================================================= */}
      {/* EVERYTHING INCLUDED                                               */}
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
              Everything Included
            </h2>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">
              No feature tiers. No premium gates. Every credit unlocks the full Voyance experience.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 gap-6">
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
      {/* SAMPLE DAY                                                        */}
      {/* ================================================================= */}
      <section className="py-12 sm:py-16">
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
              What One Day Looks Like
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
                <p className="text-xs text-muted-foreground">Your on-the-ground spending</p>
                <p className="font-medium text-foreground">$33 - $560</p>
                <p className="text-[10px] text-muted-foreground">Safe → Splurge</p>
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

            <div className="p-4 bg-muted/30 border-t border-border space-y-1">
              <p className="text-xs text-muted-foreground text-center">
                <span className="font-medium text-foreground">Free preview:</span> You see the venues, times, and descriptions.
              </p>
              <p className="text-xs text-muted-foreground text-center">
                <span className="font-medium text-foreground">Unlocked:</span> Addresses, photos, insider tips, booking links, and budget details.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* FAQ                                                               */}
      {/* ================================================================= */}
      <section className="py-12 sm:py-16 bg-muted/30">
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
            Your trip is waiting.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.05 }}
            className="text-sm text-muted-foreground mb-6"
          >
            See your personalized itinerary in 2 minutes, completely free.
            <br />Unlock the details when you're ready to go.
          </motion.p>
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            <Button asChild size="lg">
              <Link to={ROUTES.QUIZ}>
                Build My Trip Free
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
