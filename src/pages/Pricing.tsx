import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { motion } from 'framer-motion';
import { Check, ArrowRight, Loader2, Sparkles, X, Wallet, Route, Layers, Download, Users, Zap } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';
import { PLAN_FEATURES, STRIPE_PRODUCTS, TOPUP_PRODUCTS, COMPARISON_TABLE } from '@/config/pricing';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { EmbeddedCheckoutModal } from '@/components/checkout/EmbeddedCheckoutModal';
import pricingHero from '@/assets/pricing-hero.jpg';

interface CheckoutConfig {
  priceId: string;
  mode: 'subscription' | 'payment';
  productName: string;
  returnPath: string;
}

export default function Pricing() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [checkoutConfig, setCheckoutConfig] = useState<CheckoutConfig | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast({ title: "Welcome aboard!", description: "Your plan is now active." });
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
      <Head title="Pricing | Voyance" description="Plan a trip you actually want to take. Try Voyance for free. Upgrade when you're ready to finish." />
      
      {/* Hero */}
      <section className="relative min-h-[50vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img 
            src={pricingHero} 
            alt="Travel planning inspiration" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background" />
        </div>
        
        <div className="relative z-10 max-w-3xl mx-auto px-4 text-center py-20">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm font-medium tracking-widest text-primary uppercase mb-4"
          >
            Pricing
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-foreground mb-5 tracking-tight leading-[1.1]"
          >
            Plan a trip you
            <br />
            <span className="italic">actually want to take.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed"
          >
            Try Voyance for free. Upgrade when you're ready to finish.
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-sm text-muted-foreground/80 max-w-lg mx-auto mt-4"
          >
            Voyance isn't a chatbot — it's a trip engine: routes, budgets, versions, and one-tap refinements that stay organized as you change your mind.
          </motion.p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4">
          {/* Row 1: Free + Trip Pass */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {/* Free */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              whileInView={{ opacity: 1, y: 0 }} 
              viewport={{ once: true }}
              className="bg-card rounded-2xl border border-border p-6 flex flex-col"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-serif font-bold text-foreground">{PLAN_FEATURES.FREE.name}</h3>
                  <p className="text-sm text-primary font-medium">{PLAN_FEATURES.FREE.headline}</p>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <span className="text-2xl font-bold text-foreground">$0</span>
                  <span className="text-xs text-muted-foreground block">forever</span>
                </div>
              </div>
              
              <p className="text-muted-foreground text-sm mb-4 pb-4 border-b border-border">
                {PLAN_FEATURES.FREE.subheadline}
              </p>
              
              <div className="mb-2">
                <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Included</span>
              </div>
              <ul className="space-y-2 mb-4 flex-1">
                {PLAN_FEATURES.FREE.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary" />
                    <span className="text-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              
              {PLAN_FEATURES.FREE.notIncluded && (
                <>
                  <div className="mb-2">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Not included</span>
                  </div>
                  <ul className="space-y-2 mb-6">
                    {PLAN_FEATURES.FREE.notIncluded.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="w-4 text-center">—</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              
              <Button asChild variant="outline" className="w-full mt-auto">
                <Link to={ROUTES.QUIZ}>
                  Start Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-3">
                Best for: {PLAN_FEATURES.FREE.bestFor}
              </p>
            </motion.div>

            {/* Trip Pass */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              whileInView={{ opacity: 1, y: 0 }} 
              viewport={{ once: true }}
              transition={{ delay: 0.05 }}
              className="bg-card rounded-2xl border border-border p-6 flex flex-col"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-xl font-serif font-bold text-foreground">{PLAN_FEATURES.TRIP_PASS.name}</h3>
                    <span className="text-[10px] px-2 py-0.5 bg-muted text-muted-foreground rounded-full uppercase tracking-wide">One-time</span>
                  </div>
                  <p className="text-sm text-primary font-medium">{PLAN_FEATURES.TRIP_PASS.headline}</p>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <span className="text-2xl font-bold text-foreground">${STRIPE_PRODUCTS.TRIP_PASS.price}</span>
                  <span className="text-xs text-muted-foreground block">per trip</span>
                </div>
              </div>
              
              <p className="text-muted-foreground text-sm mb-4 pb-4 border-b border-border">
                {PLAN_FEATURES.TRIP_PASS.subheadline}
              </p>
              
              <div className="mb-2">
                <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Included for this trip</span>
              </div>
              <ul className="space-y-2 mb-6 flex-1">
                {PLAN_FEATURES.TRIP_PASS.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary" />
                    <span className="text-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              
              <Button 
                variant="outline"
                className="w-full mt-auto" 
                onClick={() => openCheckout(STRIPE_PRODUCTS.TRIP_PASS.priceId, 'payment', 'trip_pass', 'Trip Pass')} 
                disabled={loadingPlan === 'trip_pass'}
              >
                {loadingPlan === 'trip_pass' ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Unlock This Trip <ArrowRight className="ml-2 h-4 w-4" /></>}
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-3">
                Best for: {PLAN_FEATURES.TRIP_PASS.bestFor}
              </p>
            </motion.div>
          </div>

          {/* Row 2: Monthly + Yearly */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Monthly - Featured */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              whileInView={{ opacity: 1, y: 0 }} 
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="bg-card rounded-2xl border-2 border-primary p-6 relative flex flex-col"
            >
              <div className="absolute -top-3 left-6">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-full">
                  <Sparkles className="w-3 h-3" />
                  Most Popular
                </span>
              </div>
              
              <div className="flex items-start justify-between mb-4 mt-2">
                <div>
                  <h3 className="text-xl font-serif font-bold text-foreground">{PLAN_FEATURES.MONTHLY.name}</h3>
                  <p className="text-sm text-primary font-medium">{PLAN_FEATURES.MONTHLY.headline}</p>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <span className="text-2xl font-bold text-foreground">${STRIPE_PRODUCTS.MONTHLY.price}</span>
                  <span className="text-xs text-muted-foreground block">/month</span>
                </div>
              </div>
              
              <p className="text-muted-foreground text-sm mb-4 pb-4 border-b border-border">
                {PLAN_FEATURES.MONTHLY.subheadline}
              </p>
              
              <div className="mb-2">
                <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Included</span>
              </div>
              <ul className="space-y-2 mb-6 flex-1">
                {PLAN_FEATURES.MONTHLY.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary" />
                    <span className="text-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              
              <Button 
                className="w-full mt-auto" 
                onClick={() => openCheckout(STRIPE_PRODUCTS.MONTHLY.priceId, 'subscription', 'monthly', 'Voyager Monthly')} 
                disabled={loadingPlan === 'monthly'}
              >
                {loadingPlan === 'monthly' ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Go Monthly <ArrowRight className="ml-2 h-4 w-4" /></>}
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-3">
                Best for: {PLAN_FEATURES.MONTHLY.bestFor}
              </p>
            </motion.div>

            {/* Yearly */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              whileInView={{ opacity: 1, y: 0 }} 
              viewport={{ once: true }}
              transition={{ delay: 0.15 }}
              className="bg-card rounded-2xl border border-border p-6 relative flex flex-col"
            >
              <div className="absolute -top-3 left-6">
                <span className="inline-flex items-center px-3 py-1 bg-foreground text-background text-xs font-medium rounded-full">
                  Save 33%
                </span>
              </div>
              
              <div className="flex items-start justify-between mb-4 mt-2">
                <div>
                  <h3 className="text-xl font-serif font-bold text-foreground">{PLAN_FEATURES.YEARLY.name}</h3>
                  <p className="text-sm text-primary font-medium">{PLAN_FEATURES.YEARLY.headline}</p>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <span className="text-2xl font-bold text-foreground">${STRIPE_PRODUCTS.YEARLY.price}</span>
                  <span className="text-xs text-muted-foreground block">/year</span>
                </div>
              </div>
              
              <p className="text-muted-foreground text-sm mb-4 pb-4 border-b border-border">
                {PLAN_FEATURES.YEARLY.subheadline} <span className="text-foreground font-medium">Just $10.75/month.</span>
              </p>
              
              <div className="mb-2">
                <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Included</span>
              </div>
              <ul className="space-y-2 mb-6 flex-1">
                {PLAN_FEATURES.YEARLY.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary" />
                    <span className="text-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              
              <Button 
                variant="outline"
                className="w-full mt-auto" 
                onClick={() => openCheckout(STRIPE_PRODUCTS.YEARLY.priceId, 'subscription', 'yearly', 'Voyager Yearly')} 
                disabled={loadingPlan === 'yearly'}
              >
                {loadingPlan === 'yearly' ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Go Yearly <ArrowRight className="ml-2 h-4 w-4" /></>}
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-3">
                Best for: {PLAN_FEATURES.YEARLY.bestFor}
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Why Upgrade Section */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-4xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <h2 className="text-2xl font-serif font-bold text-foreground mb-3">
              Free helps you start. Paid helps you finish.
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              When you upgrade, Voyance becomes your planning workspace:
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Wallet, title: 'Budget Tracking', desc: 'Know the trip cost as you refine' },
              { icon: Route, title: 'Route + Map Layer', desc: 'Keep your days efficient, not zig-zagging' },
              { icon: Layers, title: 'Trip Versions', desc: 'Compare options without losing progress' },
              { icon: Zap, title: 'Unlimited Refinements', desc: 'Polish until it\'s exactly you' },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="bg-card rounded-xl border border-border p-5 text-center"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-medium text-foreground mb-1">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="flex items-center justify-center gap-2 mt-8 text-sm text-muted-foreground"
          >
            <Download className="w-4 h-4" />
            <span><strong className="text-foreground">Export (PDF)</strong> — take it with you</span>
          </motion.div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-16">
        <div className="max-w-5xl mx-auto px-4">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-2xl font-serif font-bold text-foreground text-center mb-8"
          >
            Compare plans at a glance
          </motion.h2>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="overflow-x-auto"
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Feature</th>
                  <th className="text-center py-3 px-4 font-medium text-foreground">Free</th>
                  <th className="text-center py-3 px-4 font-medium text-foreground">Trip Pass</th>
                  <th className="text-center py-3 px-4 font-medium text-foreground bg-primary/5 rounded-t-lg">Monthly</th>
                  <th className="text-center py-3 px-4 font-medium text-foreground">Yearly</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_TABLE.rows.map((row, i) => (
                  <tr key={row.feature} className="border-b border-border/50">
                    <td className="py-3 px-4 text-foreground">{row.feature}</td>
                    <td className="py-3 px-4 text-center text-muted-foreground">{row.free}</td>
                    <td className="py-3 px-4 text-center text-muted-foreground">{row.tripPass}</td>
                    <td className="py-3 px-4 text-center bg-primary/5">{row.monthly}</td>
                    <td className="py-3 px-4 text-center text-muted-foreground">{row.yearly}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </div>
      </section>

      {/* Top-Up Section */}
      <section className="py-16 border-t border-border">
        <div className="max-w-4xl mx-auto px-4">
          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <h2 className="text-2xl font-serif font-bold text-foreground mb-3">
              Want a little extra instead of a plan?
            </h2>
            <p className="text-muted-foreground">Top up only when you need it.</p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.values(TOPUP_PRODUCTS).map((item, i) => (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="bg-card rounded-xl border border-border p-5 text-center"
              >
                <div className="text-base font-medium text-foreground mb-1">{item.name}</div>
                <div className="text-2xl font-bold text-foreground mb-2">${item.price.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </motion.div>
            ))}
          </div>

          <motion.p 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center text-xs text-muted-foreground mt-6"
          >
            Top-ups are great for occasional tweaks. Trip Pass is best when you're in "finish mode."
          </motion.p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 border-t border-border">
        <div className="max-w-2xl mx-auto px-4">
          <h2 className="text-2xl font-serif font-bold text-foreground text-center mb-10">Common questions</h2>
          <div className="space-y-4">
            {[
              { q: "What's a Smart Refinement?", a: "Swapping a restaurant, adjusting the vibe, or optimizing a block — anything where Voyance searches for a better fit based on your preferences. Manual edits like moving, deleting, or reordering are always free." },
              { q: "What's always free?", a: "Moving activities, deleting items, reordering days, and adding personal notes. Anything you do manually is unlimited on every plan." },
              { q: "What's the difference between Free and Trip Pass?", a: "Free gives you limited refinements each month across all trips. Trip Pass removes all limits for one specific trip, forever. Great when you're seriously planning and want to perfect every detail." },
              { q: "Can I cancel my subscription?", a: "Yes, anytime. You keep access until your billing period ends. No cancellation fees, no awkward phone calls." },
              { q: "Do you charge fees on bookings?", a: "Never. Flight and hotel prices are passed through at market rates. We make money from subscriptions, not booking commissions." },
            ].map((faq, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.03 }}
                className="bg-card rounded-xl p-5 border border-border"
              >
                <h3 className="font-medium text-foreground mb-2">{faq.q}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-primary/5 via-transparent to-transparent" />
        <div className="relative max-w-xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-serif font-bold text-foreground mb-4">
              Your next adventure starts here.
            </h2>
            <p className="text-muted-foreground mb-8">
              Build your first itinerary free. See why thousands of travelers trust Voyance to plan trips that actually feel like them.
            </p>
            <Button asChild size="lg">
              <Link to={ROUTES.QUIZ}>
                Start Planning Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

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