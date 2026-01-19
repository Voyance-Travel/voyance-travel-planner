import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { motion } from 'framer-motion';
import { Check, Sparkles, Compass, Crown, Zap, ArrowRight, Shield, Clock, Users, Heart, Star, Wallet, Loader2, CreditCard, CheckCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';
import { PLAN_FEATURES, STRIPE_PRODUCTS, TOPUP_OPTIONS } from '@/config/pricing';
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

  // Handle success/canceled URL params
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast({
        title: "Purchase successful!",
        description: "Your subscription is now active.",
      });
      // Clean up URL
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
      // Check if user is logged in
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

      // Open embedded checkout modal
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
      <section className="pt-32 pb-20 bg-gradient-to-br from-primary/10 via-background to-accent/10 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
        <div className="max-w-5xl mx-auto px-4 text-center relative">
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-block px-4 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium mb-6"
          >
            Simple, Transparent Pricing
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-display font-bold text-foreground mb-6 leading-tight"
          >
            Plan your first trip free—<br />
            <span className="text-primary">then pay only when you want more</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-muted-foreground max-w-2xl mx-auto"
          >
            One full itinerary build at full power. After that, keep planning manually 
            or upgrade to auto-build days, budgets, routes, and smarter options.
          </motion.p>
        </div>
      </section>

      {/* Main Pricing Cards */}
      <section className="py-20 -mt-8 relative z-10">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* 1. Free */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="relative rounded-3xl bg-card border border-border p-6 flex flex-col"
            >
              <div className="mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-400 to-slate-500 text-white mb-4">
                  <Compass className="h-6 w-6" />
                </div>
                <h3 className="text-2xl font-bold text-foreground">Free</h3>
                <p className="text-sm text-muted-foreground">{PLAN_FEATURES.FREE.headline}</p>
              </div>
              
              <div className="mb-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-foreground">$0</span>
                  <span className="text-muted-foreground">forever</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">{PLAN_FEATURES.FREE.subheadline}</p>
              </div>
              
              <ul className="space-y-3 mb-8 flex-1">
                {PLAN_FEATURES.FREE.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <Check className="w-5 h-5 flex-shrink-0 mt-0.5 text-muted-foreground" />
                    <span className="text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
              
              <Button asChild size="lg" variant="outline" className="w-full">
                <Link to={ROUTES.QUIZ}>
                  Start Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </motion.div>

            {/* 2. Trip Pass */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="relative rounded-3xl bg-card border border-border p-6 flex flex-col"
            >
              <div className="mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500 text-white mb-4">
                  <Zap className="h-6 w-6" />
                </div>
                <h3 className="text-2xl font-bold text-foreground">Trip Pass</h3>
                <p className="text-sm text-muted-foreground">{PLAN_FEATURES.TRIP_PASS.headline}</p>
              </div>
              
              <div className="mb-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-foreground">${STRIPE_PRODUCTS.TRIP_PASS.price}</span>
                  <span className="text-muted-foreground">one-time</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">{PLAN_FEATURES.TRIP_PASS.subheadline}</p>
              </div>
              
              <ul className="space-y-3 mb-8 flex-1">
                {PLAN_FEATURES.TRIP_PASS.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <Check className="w-5 h-5 flex-shrink-0 mt-0.5 text-violet-500" />
                    <span className="text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
              
              <Button
                size="lg"
                variant="outline"
                className="w-full"
                onClick={() => openCheckout(STRIPE_PRODUCTS.TRIP_PASS.priceId, 'payment', 'trip_pass', 'Single Trip Pass')}
                disabled={loadingPlan === 'trip_pass'}
              >
                {loadingPlan === 'trip_pass' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Opening checkout...
                  </>
                ) : (
                  <>
                    Unlock This Trip
                    <CreditCard className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </motion.div>

            {/* 3. Monthly - BEST VALUE */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="relative rounded-3xl bg-gradient-to-b from-primary/10 to-background border-2 border-primary shadow-xl shadow-primary/10 p-6 flex flex-col"
            >
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-full">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  Best Value
                </span>
              </div>
              
              <div className="mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-white mb-4">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h3 className="text-2xl font-bold text-foreground">Monthly</h3>
                <p className="text-sm text-muted-foreground">{PLAN_FEATURES.MONTHLY.headline}</p>
              </div>
              
              <div className="mb-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-foreground">${STRIPE_PRODUCTS.MONTHLY.price}</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">{PLAN_FEATURES.MONTHLY.subheadline}</p>
              </div>
              
              <ul className="space-y-3 mb-8 flex-1">
                {PLAN_FEATURES.MONTHLY.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <Check className="w-5 h-5 flex-shrink-0 mt-0.5 text-primary" />
                    <span className="text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
              
              <Button
                size="lg"
                className="w-full"
                onClick={() => openCheckout(STRIPE_PRODUCTS.MONTHLY.priceId, 'subscription', 'monthly', 'Voyager Monthly')}
                disabled={loadingPlan === 'monthly'}
              >
                {loadingPlan === 'monthly' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Opening checkout...
                  </>
                ) : (
                  <>
                    Go Monthly
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </motion.div>

            {/* 4. Yearly */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="relative rounded-3xl bg-card border border-border p-6 flex flex-col"
            >
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-amber-500 text-white text-sm font-medium rounded-full">
                  Save 48%
                </span>
              </div>
              
              <div className="mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white mb-4">
                  <Crown className="h-6 w-6" />
                </div>
                <h3 className="text-2xl font-bold text-foreground">Yearly</h3>
                <p className="text-sm text-muted-foreground">{PLAN_FEATURES.YEARLY.headline}</p>
              </div>
              
              <div className="mb-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-foreground">${STRIPE_PRODUCTS.YEARLY.price}</span>
                  <span className="text-muted-foreground">/year</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">{PLAN_FEATURES.YEARLY.subheadline}</p>
              </div>
              
              <ul className="space-y-3 mb-8 flex-1">
                {PLAN_FEATURES.YEARLY.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <Check className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-500" />
                    <span className="text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
              
              <Button
                size="lg"
                variant="outline"
                className="w-full border-amber-500/50 hover:bg-amber-500/10"
                onClick={() => openCheckout(STRIPE_PRODUCTS.YEARLY.priceId, 'subscription', 'yearly', 'Voyager Yearly')}
                disabled={loadingPlan === 'yearly'}
              >
                {loadingPlan === 'yearly' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Opening checkout...
                  </>
                ) : (
                  <>
                    Go Yearly
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </motion.div>
          </div>

          {/* Credits Section - Editorial Refresh */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-20 max-w-4xl mx-auto"
          >
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-3">
                Not ready to commit? That's okay.
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Add credits to your wallet and use them whenever inspiration strikes. 
                Perfect for finishing that one stubborn day or optimizing your route before you go.
              </p>
            </div>

            <div className="bg-gradient-to-br from-muted/60 via-muted/40 to-background rounded-3xl border border-border p-8">
              {/* Credit Actions */}
              <div className="grid md:grid-cols-2 gap-4 mb-8">
                <div className="group bg-background rounded-2xl p-5 border border-border hover:border-primary/30 hover:shadow-lg transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">Build one day</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Let AI fill a single day with activities tailored to you
                      </p>
                    </div>
                    <span className="text-xl font-bold text-primary">$3.99</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="px-2 py-1 rounded-full bg-green-500/10 text-green-600">AI suggestions</span>
                    <span className="px-2 py-1 rounded-full bg-green-500/10 text-green-600">Time blocking</span>
                  </div>
                </div>

                <div className="group bg-background rounded-2xl p-5 border border-border hover:border-primary/30 hover:shadow-lg transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">Build entire trip</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Generate a complete multi-day itinerary in one go
                      </p>
                    </div>
                    <span className="text-xl font-bold text-primary">$9.99</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="px-2 py-1 rounded-full bg-green-500/10 text-green-600">All days filled</span>
                    <span className="px-2 py-1 rounded-full bg-green-500/10 text-green-600">AI personalized</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3 italic">
                    💡 Tip: For just $6 more, Monthly gives you unlimited rebuilds + group tools
                  </p>
                </div>

                <div className="group bg-background rounded-2xl p-5 border border-border hover:border-primary/30 hover:shadow-lg transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">Optimize your route</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Reorder activities and calculate travel times
                      </p>
                    </div>
                    <span className="text-xl font-bold text-primary">$1.99</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="px-2 py-1 rounded-full bg-green-500/10 text-green-600">Smart ordering</span>
                    <span className="px-2 py-1 rounded-full bg-green-500/10 text-green-600">Transport modes</span>
                  </div>
                </div>

                <div className="group bg-background rounded-2xl p-5 border border-border hover:border-primary/30 hover:shadow-lg transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">Group budget setup</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Auto-split expenses among your travel crew
                      </p>
                    </div>
                    <span className="text-xl font-bold text-primary">$2.99</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="px-2 py-1 rounded-full bg-green-500/10 text-green-600">Expense tracking</span>
                    <span className="px-2 py-1 rounded-full bg-green-500/10 text-green-600">Split calculator</span>
                  </div>
                </div>
              </div>

              {/* Add Credits */}
              <div className="bg-background/50 rounded-2xl p-6 border border-dashed border-border">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-center sm:text-left">
                    <p className="font-medium text-foreground">Add credits to your wallet</p>
                    <p className="text-sm text-muted-foreground">Use them anytime. They never expire.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {TOPUP_OPTIONS.map((option) => (
                      <Button
                        key={option.amount}
                        variant="outline"
                        size="sm"
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
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Value Props */}
      <section className="py-20 bg-gradient-to-b from-muted/50 to-background">
        <div className="max-w-6xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
              Every plan includes
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Core features that make Voyance the smartest way to plan travel
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Shield, title: 'No Hidden Fees', description: 'What you see is what you pay. No surprise charges ever.' },
              { icon: Clock, title: 'Save 15+ Hours', description: 'AI handles the research so you can focus on dreaming.' },
              { icon: Heart, title: 'Truly Personal', description: 'Every recommendation reflects your unique preferences.' },
              { icon: Users, title: 'Group Friendly', description: 'Balance everyone\'s preferences for perfect group trips.' },
            ].map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-card rounded-2xl p-6 border border-border text-center"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <item.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-20 bg-gradient-to-b from-background to-muted/30">
        <div className="max-w-3xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
              Frequently asked questions
            </h2>
          </motion.div>

          <div className="space-y-6">
            {[
              {
                question: 'What\'s included in the free plan?',
                answer: 'One full itinerary build at full power—no blur, no withholding. After that, you can keep planning manually using our DIY skeleton mode, or upgrade to auto-build more.',
              },
              {
                question: 'What\'s the difference between Trip Pass and Monthly?',
                answer: 'Trip Pass unlocks one trip with unlimited rebuilds. Monthly unlocks up to five draft trips at once—plus smarter flight/hotel ranking, group budgeting, and co-editing on every trip.',
              },
              {
                question: 'How do credits work?',
                answer: 'Add funds to your wallet (min $5) and spend them on specific actions: building a day ($3.99), optimizing routes ($1.99), or building a full trip ($9.99). Credits never expire.',
              },
              {
                question: 'Can I cancel my subscription?',
                answer: 'Yes, cancel anytime from your account settings. You\'ll keep access until the end of your billing period. No cancellation fees.',
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
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="bg-card rounded-2xl p-6 border border-border"
              >
                <h3 className="font-semibold text-foreground mb-2">{faq.question}</h3>
                <p className="text-muted-foreground">{faq.answer}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-gradient-to-b from-muted/30 to-primary/5">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
              Ready to plan smarter?
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Start with your free itinerary. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link to={ROUTES.QUIZ}>
                  Start Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                <Link to={ROUTES.HOW_IT_WORKS}>
                  See How It Works
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Embedded Checkout Modal */}
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
