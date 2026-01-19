import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { motion } from 'framer-motion';
import { Check, ArrowRight, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';
import { PLAN_FEATURES, STRIPE_PRODUCTS } from '@/config/pricing';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { EmbeddedCheckoutModal } from '@/components/checkout/EmbeddedCheckoutModal';

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
      toast({ title: "Purchase successful!", description: "Your subscription is now active." });
      searchParams.delete('success');
      setSearchParams(searchParams);
    }
    if (searchParams.get('canceled') === 'true') {
      toast({ title: "Checkout canceled", description: "You can try again whenever you're ready." });
      searchParams.delete('canceled');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams, toast]);

  const openCheckout = async (priceId: string, mode: 'subscription' | 'payment', planName: string, productDisplayName: string) => {
    setLoadingPlan(planName);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Sign in required", description: "Please sign in to subscribe." });
        navigate('/signin?redirect=/pricing');
        return;
      }
      setCheckoutConfig({ priceId, mode, productName: productDisplayName, returnPath: '/payment-success' });
    } catch (error) {
      toast({ title: "Checkout failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <MainLayout>
      <Head title="Pricing | Voyance" description="Simple, transparent pricing. Your first trip is free." />
      
      {/* Hero */}
      <section className="pt-32 pb-16">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-4 tracking-tight"
          >
            Your first trip is free.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-muted-foreground"
          >
            One complete itinerary per month at full power. Upgrade when you want more.
          </motion.p>
        </div>
      </section>

      {/* Two-Column Plans */}
      <section className="pb-20">
        <div className="max-w-4xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-6">
            
            {/* Left Column: Free + Trip Pass */}
            <div className="space-y-6">
              {/* Free */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-xl border border-border p-6">
                <h3 className="text-xl font-serif font-bold text-foreground mb-1">Free</h3>
                <p className="text-sm text-muted-foreground mb-4">Try Voyance with monthly limits.</p>
                <div className="mb-5">
                  <span className="text-3xl font-bold text-foreground">$0</span>
                  <span className="text-sm text-muted-foreground ml-1">forever</span>
                </div>
                <ul className="space-y-2 mb-6">
                  {PLAN_FEATURES.FREE.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                      <Check className="w-4 h-4 flex-shrink-0 mt-0.5 text-muted-foreground" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button asChild variant="outline" className="w-full">
                  <Link to={ROUTES.QUIZ}>Start Free <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
              </motion.div>

              {/* Trip Pass */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-xl font-serif font-bold text-foreground">Trip Pass</h3>
                  <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded">One Trip</span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">Full power for a single trip.</p>
                <div className="mb-5">
                  <span className="text-3xl font-bold text-foreground">${STRIPE_PRODUCTS.TRIP_PASS.price}</span>
                  <span className="text-sm text-muted-foreground ml-1">one-time</span>
                </div>
                <ul className="space-y-2 mb-6">
                  {PLAN_FEATURES.TRIP_PASS.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                      <Check className="w-4 h-4 flex-shrink-0 mt-0.5 text-muted-foreground" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button variant="outline" className="w-full" onClick={() => openCheckout(STRIPE_PRODUCTS.TRIP_PASS.priceId, 'payment', 'trip_pass', 'Single Trip Pass')} disabled={loadingPlan === 'trip_pass'}>
                  {loadingPlan === 'trip_pass' ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Unlock This Trip <ArrowRight className="ml-2 h-4 w-4" /></>}
                </Button>
              </motion.div>
            </div>

            {/* Right Column: Monthly + Yearly */}
            <div className="space-y-6">
              {/* Monthly */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card rounded-xl border-2 border-primary p-6 relative">
                <div className="absolute -top-3 left-4">
                  <span className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded">Most Popular</span>
                </div>
                <h3 className="text-xl font-serif font-bold text-foreground mb-1 mt-1">Monthly</h3>
                <p className="text-sm text-muted-foreground mb-4">Plan multiple trips at once.</p>
                <div className="mb-5">
                  <span className="text-3xl font-bold text-foreground">${STRIPE_PRODUCTS.MONTHLY.price}</span>
                  <span className="text-sm text-muted-foreground ml-1">/month</span>
                </div>
                <ul className="space-y-2 mb-6">
                  {PLAN_FEATURES.MONTHLY.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                      <Check className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button className="w-full" onClick={() => openCheckout(STRIPE_PRODUCTS.MONTHLY.priceId, 'subscription', 'monthly', 'Voyager Monthly')} disabled={loadingPlan === 'monthly'}>
                  {loadingPlan === 'monthly' ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Start Monthly <ArrowRight className="ml-2 h-4 w-4" /></>}
                </Button>
              </motion.div>

              {/* Yearly */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="bg-card rounded-xl border border-border p-6 relative">
                <div className="absolute -top-3 left-4">
                  <span className="text-xs px-2 py-1 bg-foreground text-background rounded">Save 48%</span>
                </div>
                <h3 className="text-xl font-serif font-bold text-foreground mb-1 mt-1">Yearly</h3>
                <p className="text-sm text-muted-foreground mb-4">Your travel planning home base.</p>
                <div className="mb-2">
                  <span className="text-3xl font-bold text-foreground">${STRIPE_PRODUCTS.YEARLY.price}</span>
                  <span className="text-sm text-muted-foreground ml-1">/year</span>
                </div>
                <p className="text-xs text-muted-foreground mb-4">Just $8.25 per month</p>
                <ul className="space-y-2 mb-6">
                  {PLAN_FEATURES.YEARLY.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                      <Check className="w-4 h-4 flex-shrink-0 mt-0.5 text-muted-foreground" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button variant="outline" className="w-full" onClick={() => openCheckout(STRIPE_PRODUCTS.YEARLY.priceId, 'subscription', 'yearly', 'Voyager Yearly')} disabled={loadingPlan === 'yearly'}>
                  {loadingPlan === 'yearly' ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Start Yearly <ArrowRight className="ml-2 h-4 w-4" /></>}
                </Button>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-2xl mx-auto px-4">
          <h2 className="text-2xl font-serif font-bold text-foreground text-center mb-8">Questions</h2>
          <div className="space-y-4">
            {[
              { q: "What's included free?", a: "One full itinerary build per month, three route optimizations, and one group budget setup. After that, upgrade or wait until next month." },
              { q: "What's the Trip Pass?", a: "A one-time purchase that unlocks unlimited rebuilds for a single trip. Best when you're focused on planning one specific trip." },
              { q: "Can I cancel Monthly or Yearly?", a: "Yes. Cancel anytime from your account. You keep access until the end of your billing period." },
              { q: "Do you charge booking fees?", a: "No. Flight, hotel, and activity prices are passed through at market rates with no markup." },
            ].map((faq, i) => (
              <div key={i} className="bg-card rounded-lg p-4 border border-border">
                <h3 className="font-medium text-foreground text-sm mb-1">{faq.q}</h3>
                <p className="text-sm text-muted-foreground">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="max-w-xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-serif font-bold text-foreground mb-3">Ready to plan smarter?</h2>
          <p className="text-muted-foreground mb-6 text-sm">Start with your free itinerary. No credit card required.</p>
          <Button asChild size="lg">
            <Link to={ROUTES.QUIZ}>Start Free <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
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
