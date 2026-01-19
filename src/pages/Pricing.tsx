import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { motion } from 'framer-motion';
import { Check, Sparkles, Compass, Crown, Zap, ArrowRight, Shield, Clock, Users, Heart, Loader2, CreditCard, Wallet } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';
import { PLAN_FEATURES, STRIPE_PRODUCTS, TOPUP_OPTIONS, CREDIT_COSTS } from '@/config/pricing';
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
      toast({
        title: "Purchase successful!",
        description: "Your subscription is now active.",
      });
      searchParams.delete('success');
      setSearchParams(searchParams);
    }
    if (searchParams.get('canceled') === 'true') {
      toast({
        title: "Checkout canceled",
        description: "You can try again whenever you're ready.",
        variant: "default",
      });
      searchParams.delete('canceled');
      setSearchParams(searchParams);
    }
    if (searchParams.get('credits_added') === 'true') {
      toast({
        title: "Credits added!",
        description: "Your wallet has been topped up.",
      });
      searchParams.delete('credits_added');
      searchParams.delete('amount');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams, toast]);

  const openCheckout = async (priceId: string, mode: 'subscription' | 'payment', planName: string, productDisplayName: string) => {
    setLoadingPlan(planName);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Sign in required",
          description: "Please sign in to subscribe to a plan.",
          variant: "default",
        });
        navigate('/signin?redirect=/pricing');
        return;
      }

      setCheckoutConfig({
        priceId,
        mode,
        productName: productDisplayName,
        returnPath: '/payment-success',
      });
    } catch (error) {
      console.error('Checkout error:', error);
      toast({
        title: "Checkout failed",
        description: error instanceof Error ? error.message : "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleAddCredits = async (amountCents: number) => {
    setLoadingPlan(`credits-${amountCents}`);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Sign in required",
          description: "Please sign in to add credits.",
          variant: "default",
        });
        navigate('/signin?redirect=/pricing');
        return;
      }

      const { data, error } = await supabase.functions.invoke('add-credits', {
        body: { amount_cents: amountCents }
      });

      if (error) throw error;
      
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Add credits error:', error);
      toast({
        title: "Failed to add credits",
        description: error instanceof Error ? error.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <MainLayout>
      <Head
        title="Pricing | Voyance"
        description="Plan your first trip free. Pay only when you want Voyance to build more."
      />
      
      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-muted/60 via-background to-background" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/6 via-transparent to-transparent" />
        
        <div className="relative max-w-3xl mx-auto px-4 text-center">
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm font-medium tracking-wide text-primary uppercase mb-6"
          >
            Simple Pricing
          </motion.p>
          
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-[3.5rem] font-serif font-bold text-foreground mb-5 leading-[1.15] tracking-tight"
          >
            Your first trip is free.
            <br />
            <span className="text-primary">Pay when you want more.</span>
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed"
          >
            One complete itinerary at full power. After that, plan manually 
            or upgrade for unlimited rebuilds, smart recommendations, and group tools.
          </motion.p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="relative py-12 -mt-4">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-5">
            
            {/* Free */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="relative bg-card rounded-xl border border-border p-6 flex flex-col"
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-white mb-5">
                <Compass className="w-5 h-5" />
              </div>
              
              <h3 className="text-lg font-serif font-bold text-foreground mb-1">Free</h3>
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">Your first full itinerary is on us.</p>
              
              <div className="mb-5">
                <span className="text-3xl font-bold tracking-tight text-foreground">$0</span>
                <span className="text-sm text-muted-foreground ml-1">forever</span>
              </div>
              
              <div className="flex-1 space-y-2.5 mb-5">
                {['1 full itinerary build at full power', 'Save 1 draft trip', 'Keep your itinerary forever', 'Manual DIY planning mode', 'Share view-only links'].map((feature, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 flex-shrink-0 mt-0.5 text-slate-400" />
                    <span className="text-foreground/80">{feature}</span>
                  </div>
                ))}
              </div>
              
              <Button asChild variant="outline" className="w-full">
                <Link to={ROUTES.QUIZ}>
                  Start Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </motion.div>

            {/* Trip Pass */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="relative bg-card rounded-xl border border-border p-6 flex flex-col"
            >
              <div className="flex items-start justify-between mb-5">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white">
                  <Zap className="w-5 h-5" />
                </div>
                <span className="px-2 py-0.5 text-xs font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 rounded">
                  One Trip
                </span>
              </div>
              
              <h3 className="text-lg font-serif font-bold text-foreground mb-1">Trip Pass</h3>
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">Full power for a single trip.</p>
              
              <div className="mb-5">
                <span className="text-3xl font-bold tracking-tight text-foreground">${STRIPE_PRODUCTS.TRIP_PASS.price}</span>
                <span className="text-sm text-muted-foreground ml-1">one-time</span>
              </div>
              
              <div className="flex-1 space-y-2.5 mb-5">
                {['Unlimited rebuilds for this one trip', 'Unlimited day regenerations', 'Route optimization included', 'Group budgeting tools', 'Co-edit with travel companions'].map((feature, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 flex-shrink-0 mt-0.5 text-violet-500" />
                    <span className="text-foreground/80">{feature}</span>
                  </div>
                ))}
              </div>
              
              <Button
                variant="outline"
                className="w-full"
                onClick={() => openCheckout(STRIPE_PRODUCTS.TRIP_PASS.priceId, 'payment', 'trip_pass', 'Single Trip Pass')}
                disabled={loadingPlan === 'trip_pass'}
              >
                {loadingPlan === 'trip_pass' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Unlock This Trip
                    <CreditCard className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </motion.div>

            {/* Monthly */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="relative bg-gradient-to-b from-primary/[0.04] to-card rounded-xl border-2 border-primary p-6 flex flex-col"
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-full">
                  <Sparkles className="w-3 h-3" />
                  Most Popular
                </span>
              </div>
              
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white mb-5 mt-1">
                <Sparkles className="w-5 h-5" />
              </div>
              
              <h3 className="text-lg font-serif font-bold text-foreground mb-1">Monthly</h3>
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">Plan multiple trips at once.</p>
              
              <div className="mb-5">
                <span className="text-3xl font-bold tracking-tight text-foreground">${STRIPE_PRODUCTS.MONTHLY.price}</span>
                <span className="text-sm text-muted-foreground ml-1">/month</span>
              </div>
              
              <div className="flex-1 space-y-2.5 mb-5">
                {['Up to 5 draft trips at once', 'Unlimited day builds and rebuilds', 'Smart flight and hotel picks', 'Group budgeting and co-editing', 'Route optimization on all trips'].map((feature, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary" />
                    <span className="text-foreground/80">{feature}</span>
                  </div>
                ))}
              </div>
              
              <Button
                className="w-full"
                onClick={() => openCheckout(STRIPE_PRODUCTS.MONTHLY.priceId, 'subscription', 'monthly', 'Voyager Monthly')}
                disabled={loadingPlan === 'monthly'}
              >
                {loadingPlan === 'monthly' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Start Monthly
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </motion.div>

            {/* Yearly */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="relative bg-card rounded-xl border border-border p-6 flex flex-col"
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-medium rounded-full">
                  Save 48%
                </span>
              </div>
              
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white mb-5 mt-1">
                <Crown className="w-5 h-5" />
              </div>
              
              <h3 className="text-lg font-serif font-bold text-foreground mb-1">Yearly</h3>
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">Your travel planning home base.</p>
              
              <div className="mb-2">
                <span className="text-3xl font-bold tracking-tight text-foreground">${STRIPE_PRODUCTS.YEARLY.price}</span>
                <span className="text-sm text-muted-foreground ml-1">/year</span>
              </div>
              <p className="text-xs text-muted-foreground mb-4">Just $8.25 per month</p>
              
              <div className="flex-1 space-y-2.5 mb-5">
                {['Everything in Monthly', 'Unlimited draft trips', 'Preference learning over time', 'Trip history archive', 'Priority support'].map((feature, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
                    <span className="text-foreground/80">{feature}</span>
                  </div>
                ))}
              </div>
              
              <Button
                variant="outline"
                className="w-full"
                onClick={() => openCheckout(STRIPE_PRODUCTS.YEARLY.priceId, 'subscription', 'yearly', 'Voyager Yearly')}
                disabled={loadingPlan === 'yearly'}
              >
                {loadingPlan === 'yearly' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Start Yearly
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Credits Section */}
      <section className="py-16 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-muted/20 to-background" />
        
        <div className="relative max-w-4xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase mb-3">Pay as you go</p>
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-3">
              Not ready to commit?
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Add credits to your wallet and use them whenever inspiration strikes. 
              Perfect for finishing a single day or optimizing a route.
            </p>
          </motion.div>

          {/* Credit Actions */}
          <div className="grid sm:grid-cols-2 gap-3 mb-6">
            {[
              { 
                title: 'Build one day', 
                price: (CREDIT_COSTS.BUILD_DAY / 100).toFixed(2),
                desc: 'AI fills a single day with personalized activities',
              },
              { 
                title: 'Build entire trip', 
                price: (CREDIT_COSTS.BUILD_FULL_TRIP / 100).toFixed(2),
                desc: 'Generate a complete multi-day itinerary',
              },
              { 
                title: 'Optimize route', 
                price: (CREDIT_COSTS.ROUTE_OPTIMIZE / 100).toFixed(2),
                desc: 'Reorder activities and calculate travel times',
              },
              { 
                title: 'Group budget setup', 
                price: (CREDIT_COSTS.GROUP_BUDGET_SETUP / 100).toFixed(2),
                desc: 'Auto-split expenses among your travel group',
              },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="bg-card rounded-lg p-4 border border-border"
              >
                <div className="flex items-start justify-between mb-1">
                  <h4 className="font-medium text-foreground text-sm">{item.title}</h4>
                  <span className="text-sm font-semibold text-primary">${item.price}</span>
                </div>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Top Up */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-muted/40 rounded-xl p-5 border border-border"
          >
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">Add credits to your wallet</p>
                  <p className="text-xs text-muted-foreground">Credits never expire</p>
                </div>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {TOPUP_OPTIONS.map((option) => (
                  <Button
                    key={option.amount}
                    variant="outline"
                    size="sm"
                    className="min-w-[72px]"
                    onClick={() => handleAddCredits(option.amount)}
                    disabled={loadingPlan === `credits-${option.amount}`}
                  >
                    {loadingPlan === `credits-${option.amount}` ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      `Add ${option.label}`
                    )}
                  </Button>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Value Props */}
      <section className="py-16">
        <div className="max-w-5xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <h2 className="text-2xl font-serif font-bold text-foreground mb-2">
              Every plan includes
            </h2>
            <p className="text-muted-foreground text-sm">
              Core features that make Voyance the smartest way to plan travel
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Shield, title: 'No Hidden Fees', description: 'What you see is what you pay. No surprise charges.' },
              { icon: Clock, title: 'Save 15+ Hours', description: 'AI handles the research so you can focus on dreaming.' },
              { icon: Heart, title: 'Truly Personal', description: 'Every recommendation reflects your preferences.' },
              { icon: Users, title: 'Group Friendly', description: 'Balance everyone\'s preferences for group trips.' },
            ].map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="bg-card rounded-lg p-4 border border-border text-center"
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <item.icon className="h-4 w-4 text-primary" />
                </div>
                <h3 className="font-medium text-foreground text-sm mb-1">{item.title}</h3>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-16 bg-muted/20">
        <div className="max-w-2xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <h2 className="text-2xl font-serif font-bold text-foreground mb-2">
              Frequently asked questions
            </h2>
          </motion.div>

          <div className="space-y-3">
            {[
              {
                question: 'What\'s included in the free plan?',
                answer: 'One full itinerary build at full power, no restrictions. After that, you can keep planning manually using DIY mode, or upgrade to auto-build more.',
              },
              {
                question: 'What\'s the difference between Trip Pass and Monthly?',
                answer: 'Trip Pass unlocks unlimited rebuilds for one specific trip. Monthly lets you plan up to five trips at once with smart flight and hotel recommendations, group budgeting, and co-editing on every trip.',
              },
              {
                question: 'How do credits work?',
                answer: 'Add funds to your wallet (minimum $5) and spend them on specific actions: building a day ($3.99), optimizing routes ($1.99), or building a full trip ($9.99). Credits never expire.',
              },
              {
                question: 'Can I cancel my subscription?',
                answer: 'Yes, cancel anytime from your account settings. You keep access until the end of your billing period. No cancellation fees.',
              },
              {
                question: 'What about sharing trips?',
                answer: 'Sharing view-only links is always free. Co-edit collaboration (where others can modify the itinerary) requires a Trip Pass or subscription.',
              },
              {
                question: 'Do you charge booking fees?',
                answer: 'No booking fees. The subscription price covers our planning service. Flight, hotel, and activity prices are passed through at market rates with no markup.',
              },
            ].map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.03 }}
                className="bg-card rounded-lg p-4 border border-border"
              >
                <h3 className="font-medium text-foreground text-sm mb-1.5">{faq.question}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{faq.answer}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 relative">
        <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-background" />
        
        <div className="relative max-w-2xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-2xl font-serif font-bold text-foreground mb-3">
              Ready to plan smarter?
            </h2>
            <p className="text-muted-foreground mb-6 text-sm">
              Start with your free itinerary. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button asChild size="lg">
                <Link to={ROUTES.QUIZ}>
                  Start Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to={ROUTES.HOW_IT_WORKS}>
                  See How It Works
                </Link>
              </Button>
            </div>
          </motion.div>
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
