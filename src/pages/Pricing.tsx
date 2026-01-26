import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { motion } from 'framer-motion';
import { Check, ArrowRight, Loader2, Sparkles, Briefcase, Clock, Zap, FileText, Wallet, Route, Layers, Download, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ROUTES } from '@/config/routes';
import { PLAN_FEATURES, STRIPE_PRODUCTS, COMPARISON_TABLE } from '@/config/pricing';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { EmbeddedCheckoutModal } from '@/components/checkout';
import pricingHero from '@/assets/pricing-hero.jpg';

interface CheckoutConfig {
  priceId: string;
  mode: 'subscription' | 'payment';
  productName: string;
  returnPath: string;
}

// Helper component for table cell rendering
function TableCellContent({ value, highlight }: { value: string; highlight?: boolean }) {
  if (value === '✓') {
    return <Check className={`w-4 h-4 mx-auto ${highlight ? 'text-primary' : 'text-green-600'}`} />;
  }
  if (value === '-') {
    return <span className="text-muted-foreground/50">—</span>;
  }
  return <span className={highlight ? 'text-foreground font-medium' : 'text-muted-foreground'}>{value}</span>;
}

export default function Pricing() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [checkoutConfig, setCheckoutConfig] = useState<CheckoutConfig | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast({ title: "Purchase complete!", description: "Your plan is now active." });
      searchParams.delete('success');
      setSearchParams(searchParams);
    }
    if (searchParams.get('canceled') === 'true') {
      toast({ title: "No worries", description: "You can upgrade whenever you're ready." });
      searchParams.delete('canceled');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams, toast]);

  const openCheckout = async (priceId: string, mode: 'subscription' | 'payment', planName: string, productDisplayName: string) => {
    setLoadingPlan(planName);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Sign in first", description: "Create an account to get started." });
        navigate('/signin?redirect=/pricing');
        return;
      }
      setCheckoutConfig({ priceId, mode, productName: productDisplayName, returnPath: '/payment-success' });
    } catch (error) {
      toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" });
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <MainLayout>
      <Head title="Pricing | Voyance" description="Build your perfect trip. Try free, upgrade when you're ready." />
      
      {/* Hero */}
      <section className="relative min-h-[45vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img 
            src={pricingHero} 
            alt="Travel planning" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background" />
        </div>
        
        <div className="relative z-10 max-w-3xl mx-auto px-4 text-center py-16">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-primary font-medium text-sm mb-3"
          >
            Simple, transparent pricing
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-3xl md:text-5xl font-serif font-bold text-foreground mb-4"
          >
            Build Your Trip. Unlock When Ready.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-muted-foreground text-lg max-w-xl mx-auto"
          >
            Start for free. See Day 1 of any itinerary. Upgrade to unlock all days, unlimited swaps, and export.
          </motion.p>
        </div>
      </section>

      {/* Main Pricing Cards */}
      <section className="py-16 -mt-8">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Free */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              whileInView={{ opacity: 1, y: 0 }} 
              viewport={{ once: true }}
              className="bg-card rounded-2xl border border-border p-6 flex flex-col"
            >
              <div className="mb-4">
                <h3 className="text-xl font-serif font-bold text-foreground">{PLAN_FEATURES.FREE.name}</h3>
                <p className="text-sm text-primary font-medium mt-1">{PLAN_FEATURES.FREE.headline}</p>
              </div>
              <div className="mb-4">
                <span className="text-3xl font-bold text-foreground">$0</span>
                <span className="text-muted-foreground text-sm ml-1">forever</span>
              </div>
              
              <p className="text-muted-foreground text-sm mb-4 pb-4 border-b border-border">
                {PLAN_FEATURES.FREE.subheadline}
              </p>
              
              <ul className="space-y-2 mb-4 flex-1">
                {PLAN_FEATURES.FREE.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary" />
                    <span className="text-foreground">{f}</span>
                  </li>
                ))}
              </ul>

              {PLAN_FEATURES.FREE.notIncluded && (
                <ul className="space-y-2 mb-6">
                  {PLAN_FEATURES.FREE.notIncluded.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Lock className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              )}
              
              <Button asChild variant="outline" className="w-full mt-auto">
                <Link to={ROUTES.QUIZ}>
                  Start Free <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </motion.div>

            {/* Trip Pass - Featured */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              whileInView={{ opacity: 1, y: 0 }} 
              viewport={{ once: true }}
              transition={{ delay: 0.05 }}
              className="bg-card rounded-2xl border-2 border-primary p-6 flex flex-col relative"
            >
              <div className="absolute -top-3 left-6">
                <Badge className="bg-primary text-primary-foreground">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Best for One Trip
                </Badge>
              </div>
              
              <div className="mb-4 mt-2">
                <h3 className="text-xl font-serif font-bold text-foreground">{PLAN_FEATURES.TRIP_PASS.name}</h3>
                <p className="text-sm text-primary font-medium mt-1">{PLAN_FEATURES.TRIP_PASS.headline}</p>
              </div>
              <div className="mb-4">
                <span className="text-3xl font-bold text-foreground">${STRIPE_PRODUCTS.TRIP_PASS.price}</span>
                <span className="text-muted-foreground text-sm ml-1">one-time</span>
              </div>
              
              <p className="text-muted-foreground text-sm mb-4 pb-4 border-b border-border">
                {PLAN_FEATURES.TRIP_PASS.subheadline}
              </p>
              
              <ul className="space-y-2 mb-6 flex-1">
                {PLAN_FEATURES.TRIP_PASS.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary" />
                    <span className="text-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              
              <Button 
                className="w-full mt-auto" 
                onClick={() => openCheckout(STRIPE_PRODUCTS.TRIP_PASS.priceId, 'payment', 'trip_pass', 'Trip Pass')} 
                disabled={loadingPlan === 'trip_pass'}
              >
                {loadingPlan === 'trip_pass' ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Unlock Trip — ${STRIPE_PRODUCTS.TRIP_PASS.price}</>}
              </Button>
            </motion.div>

            {/* 5 Credits */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              whileInView={{ opacity: 1, y: 0 }} 
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="bg-card rounded-2xl border border-border p-6 flex flex-col"
            >
              <div className="mb-4">
                <h3 className="text-xl font-serif font-bold text-foreground">{PLAN_FEATURES.CREDITS_5.name}</h3>
                <p className="text-sm text-primary font-medium mt-1">{PLAN_FEATURES.CREDITS_5.headline}</p>
              </div>
              <div className="mb-4">
                <span className="text-3xl font-bold text-foreground">${STRIPE_PRODUCTS.CREDITS_5.price}</span>
                <span className="text-muted-foreground text-sm ml-1">one-time</span>
              </div>
              
              <p className="text-muted-foreground text-sm mb-4 pb-4 border-b border-border">
                {PLAN_FEATURES.CREDITS_5.subheadline}
              </p>
              
              <ul className="space-y-2 mb-6 flex-1">
                {PLAN_FEATURES.CREDITS_5.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary" />
                    <span className="text-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              
              <Button 
                variant="outline"
                className="w-full mt-auto" 
                onClick={() => openCheckout(STRIPE_PRODUCTS.CREDITS_5.priceId, 'payment', 'credits_5', '5 Credits')} 
                disabled={loadingPlan === 'credits_5'}
              >
                {loadingPlan === 'credits_5' ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Buy 5 Credits</>}
              </Button>
            </motion.div>

            {/* 10 Credits */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              whileInView={{ opacity: 1, y: 0 }} 
              viewport={{ once: true }}
              transition={{ delay: 0.15 }}
              className="bg-card rounded-2xl border border-border p-6 flex flex-col relative"
            >
              <div className="absolute -top-3 left-6">
                <Badge variant="secondary">Save ~15%</Badge>
              </div>
              
              <div className="mb-4 mt-2">
                <h3 className="text-xl font-serif font-bold text-foreground">{PLAN_FEATURES.CREDITS_10.name}</h3>
                <p className="text-sm text-primary font-medium mt-1">{PLAN_FEATURES.CREDITS_10.headline}</p>
              </div>
              <div className="mb-4">
                <span className="text-3xl font-bold text-foreground">${STRIPE_PRODUCTS.CREDITS_10.price}</span>
                <span className="text-muted-foreground text-sm ml-1">one-time</span>
              </div>
              
              <p className="text-muted-foreground text-sm mb-4 pb-4 border-b border-border">
                {PLAN_FEATURES.CREDITS_10.subheadline}
              </p>
              
              <ul className="space-y-2 mb-6 flex-1">
                {PLAN_FEATURES.CREDITS_10.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary" />
                    <span className="text-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              
              <Button 
                variant="outline"
                className="w-full mt-auto" 
                onClick={() => openCheckout(STRIPE_PRODUCTS.CREDITS_10.priceId, 'payment', 'credits_10', '10 Credits')} 
                disabled={loadingPlan === 'credits_10'}
              >
                {loadingPlan === 'credits_10' ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Buy 10 Credits</>}
              </Button>
            </motion.div>
          </div>

          {/* Credits never expire callout */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mt-8"
          >
            <div className="inline-flex items-center gap-3 px-6 py-4 bg-primary/10 border border-primary/20 rounded-xl">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="text-lg font-medium text-foreground">Credits never expire.</span>
              <span className="text-muted-foreground">Use them whenever you're ready.</span>
            </div>
          </motion.div>

          {/* Credit explanation */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mt-6 p-6 bg-muted/30 rounded-xl"
          >
            <h3 className="font-medium text-foreground mb-2">How Credits Work</h3>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto">
              1 credit = Build a full trip, regenerate a day, or swap an activity. 
              Use them across any trip, anytime.
            </p>
          </motion.div>
        </div>
      </section>

      {/* What's Included Breakdown */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-5xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <h2 className="text-2xl font-serif font-bold text-foreground mb-3">
              What's Included
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              A complete breakdown of what you get with each option.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-4 gap-6">
            {/* Free breakdown */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-card rounded-xl border border-border p-5"
            >
              <h3 className="font-bold text-foreground mb-1">Free</h3>
              <p className="text-2xl font-bold text-foreground mb-4">$0</p>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Build any itinerary</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>View Day 1 only</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>3 activity swaps</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Lock className="w-4 h-4 flex-shrink-0" />
                  <span>No export</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Lock className="w-4 h-4 flex-shrink-0" />
                  <span>No sharing</span>
                </div>
              </div>
            </motion.div>

            {/* Trip Pass breakdown */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.05 }}
              className="bg-card rounded-xl border-2 border-primary p-5"
            >
              <h3 className="font-bold text-foreground mb-1">Trip Pass</h3>
              <p className="text-2xl font-bold text-foreground mb-4">$24.99 <span className="text-sm font-normal text-muted-foreground">one-time</span></p>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>All days visible</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Unlimited swaps</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Regenerate any day</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Export to PDF</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Share with companions</span>
                </div>
              </div>
            </motion.div>

            {/* 5 Credits breakdown */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="bg-card rounded-xl border border-border p-5"
            >
              <h3 className="font-bold text-foreground mb-1">5 Credits</h3>
              <p className="text-2xl font-bold text-foreground mb-4">$79 <span className="text-sm font-normal text-muted-foreground">one-time</span></p>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>5 flexible credits</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Use across any trip</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Build, swap, or regenerate</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Export & share included</span>
                </div>
                <div className="flex items-center gap-2 font-medium text-primary">
                  <Sparkles className="w-4 h-4 flex-shrink-0" />
                  <span>Never expire</span>
                </div>
              </div>
            </motion.div>

            {/* 10 Credits breakdown */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15 }}
              className="bg-card rounded-xl border border-border p-5"
            >
              <h3 className="font-bold text-foreground mb-1">10 Credits</h3>
              <p className="text-2xl font-bold text-foreground mb-4">$149 <span className="text-sm font-normal text-muted-foreground">one-time</span></p>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>10 flexible credits</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>~15% savings</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Build, swap, or regenerate</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Export & share included</span>
                </div>
                <div className="flex items-center gap-2 font-medium text-primary">
                  <Sparkles className="w-4 h-4 flex-shrink-0" />
                  <span>Never expire</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>


      {/* Comparison Table */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-2xl font-serif font-bold text-foreground text-center mb-8"
          >
            Compare Plans
          </motion.h2>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="overflow-x-auto rounded-xl border border-border bg-card"
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left py-4 px-5 font-medium text-muted-foreground">Feature</th>
                  <th className="text-center py-4 px-3 font-semibold text-foreground">Free</th>
                  <th className="text-center py-4 px-3 font-semibold text-primary-foreground bg-primary">Trip Pass</th>
                  <th className="text-center py-4 px-3 font-semibold text-foreground">5 Credits</th>
                  <th className="text-center py-4 px-3 font-semibold text-foreground">10 Credits</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_TABLE.rows.map((row, i) => (
                  <tr key={row.feature} className={`border-b border-border/50 ${i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}>
                    <td className="py-3.5 px-5 text-foreground font-medium">{row.feature}</td>
                    <td className="py-3.5 px-3 text-center">
                      <TableCellContent value={row.free} />
                    </td>
                    <td className="py-3.5 px-3 text-center bg-primary/5">
                      <TableCellContent value={row.tripPass} highlight />
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <TableCellContent value={row.credits5} />
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <TableCellContent value={row.credits10} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </div>
      </section>


      {/* FAQ */}
      <section className="py-16 border-t border-border">
        <div className="max-w-3xl mx-auto px-4">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-2xl font-serif font-bold text-foreground text-center mb-10"
          >
            Questions?
          </motion.h2>

          <div className="space-y-6">
            {[
              { q: 'What can I do for free?', a: 'Build any itinerary and see Day 1 completely free. You can also swap up to 3 activities to try our AI-powered refinements.' },
              { q: 'What does a Trip Pass unlock?', a: 'Full access to one trip: all days visible, unlimited activity swaps, day regeneration, PDF export, and sharing with travel companions.' },
              { q: 'How do credits work?', a: 'Credits are flexible tokens. 1 credit = build a full trip, regenerate a day, or swap an activity. Use them across any trip. They never expire.' },
              { q: 'Can I upgrade later?', a: 'Absolutely! Start free, and purchase a Trip Pass or credits whenever you\'re ready to unlock your trip.' },
            ].map((faq, i) => (
              <motion.div
                key={faq.q}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="border-b border-border pb-6"
              >
                <h3 className="font-medium text-foreground mb-2">{faq.q}</h3>
                <p className="text-sm text-muted-foreground">{faq.a}</p>
              </motion.div>
            ))}
          </div>
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
        />
      )}
    </MainLayout>
  );
}
