import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { motion } from 'framer-motion';
import { Check, Sparkles, Compass, Crown, Zap, ArrowRight, Shield, Clock, Users, Heart, Loader2, CreditCard, Infinity, MapPin, Wallet } from 'lucide-react';
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

const planIcons = {
  free: Compass,
  trip_pass: Zap,
  monthly: Sparkles,
  yearly: Crown,
};

const planColors = {
  free: 'from-slate-400 to-slate-500',
  trip_pass: 'from-violet-500 to-purple-600',
  monthly: 'from-primary to-accent',
  yearly: 'from-amber-500 to-orange-500',
};

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
      
      {/* Hero - Editorial Style */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        {/* Background layers */}
        <div className="absolute inset-0 bg-gradient-to-b from-muted/80 via-background to-background" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/8 via-transparent to-transparent" />
        <div className="absolute top-20 right-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-gold/5 rounded-full blur-3xl" />
        
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full mb-8"
          >
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            <span className="text-sm font-medium text-primary">Simple, transparent pricing</span>
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-foreground mb-6 leading-[1.1] tracking-tight"
          >
            Your first trip is free.
            <br />
            <span className="text-primary">Pay only when you want more.</span>
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
          >
            One complete itinerary at full power. After that, plan manually or upgrade 
            for unlimited AI-powered days, smart recommendations, and group tools.
          </motion.p>
        </div>
      </section>

      {/* Pricing Cards - Magazine Grid */}
      <section className="relative py-16 -mt-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-5 lg:gap-6">
            
            {/* Free Plan */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="group relative bg-card rounded-2xl border border-border p-6 lg:p-7 flex flex-col hover:shadow-lg hover:shadow-slate-900/5 transition-all duration-300"
            >
              <div className="flex items-start justify-between mb-5">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-white">
                  <Compass className="w-5 h-5" />
                </div>
              </div>
              
              <h3 className="text-xl font-serif font-bold text-foreground mb-1">Free</h3>
              <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{PLAN_FEATURES.FREE.headline}</p>
              
              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight text-foreground">$0</span>
                  <span className="text-muted-foreground text-sm">forever</span>
                </div>
              </div>
              
              <div className="flex-1 space-y-3 mb-6">
                {PLAN_FEATURES.FREE.features.slice(0, 5).map((feature, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-sm">
                    <Check className="w-4 h-4 flex-shrink-0 mt-0.5 text-muted-foreground" />
                    <span className="text-foreground/80">{feature}</span>
                  </div>
                ))}
              </div>
              
              <Button asChild variant="outline" className="w-full h-11 font-medium">
                <Link to={ROUTES.QUIZ}>
                  Start Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </motion.div>

            {/* Trip Pass */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="group relative bg-card rounded-2xl border border-border p-6 lg:p-7 flex flex-col hover:shadow-lg hover:shadow-violet-900/5 transition-all duration-300"
            >
              <div className="flex items-start justify-between mb-5">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white">
                  <Zap className="w-5 h-5" />
                </div>
                <span className="px-2.5 py-1 text-xs font-medium bg-violet-500/10 text-violet-600 rounded-full">
                  One-time
                </span>
              </div>
              
              <h3 className="text-xl font-serif font-bold text-foreground mb-1">Trip Pass</h3>
              <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{PLAN_FEATURES.TRIP_PASS.headline}</p>
              
              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight text-foreground">${STRIPE_PRODUCTS.TRIP_PASS.price}</span>
                  <span className="text-muted-foreground text-sm">one-time</span>
                </div>
              </div>
              
              <div className="flex-1 space-y-3 mb-6">
                {PLAN_FEATURES.TRIP_PASS.features.slice(0, 5).map((feature, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-sm">
                    <Check className="w-4 h-4 flex-shrink-0 mt-0.5 text-violet-500" />
                    <span className="text-foreground/80">{feature}</span>
                  </div>
                ))}
              </div>
              
              <Button
                variant="outline"
                className="w-full h-11 font-medium border-violet-200 hover:bg-violet-50 hover:border-violet-300 dark:border-violet-800 dark:hover:bg-violet-950"
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

            {/* Monthly - Featured */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="group relative bg-gradient-to-b from-primary/5 via-card to-card rounded-2xl border-2 border-primary shadow-lg shadow-primary/10 p-6 lg:p-7 flex flex-col"
            >
              {/* Best Value Badge */}
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-full shadow-lg">
                  <Sparkles className="w-3 h-3" />
                  Most Popular
                </span>
              </div>
              
              <div className="flex items-start justify-between mb-5 pt-2">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white">
                  <Sparkles className="w-5 h-5" />
                </div>
              </div>
              
              <h3 className="text-xl font-serif font-bold text-foreground mb-1">Monthly</h3>
              <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{PLAN_FEATURES.MONTHLY.headline}</p>
              
              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight text-foreground">${STRIPE_PRODUCTS.MONTHLY.price}</span>
                  <span className="text-muted-foreground text-sm">/month</span>
                </div>
              </div>
              
              <div className="flex-1 space-y-3 mb-6">
                {PLAN_FEATURES.MONTHLY.features.slice(0, 6).map((feature, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-sm">
                    <Check className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary" />
                    <span className="text-foreground/80">{feature}</span>
                  </div>
                ))}
              </div>
              
              <Button
                className="w-full h-11 font-medium"
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
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="group relative bg-card rounded-2xl border border-border p-6 lg:p-7 flex flex-col hover:shadow-lg hover:shadow-amber-900/5 transition-all duration-300"
            >
              {/* Save Badge */}
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-semibold rounded-full shadow-lg">
                  Save 48%
                </span>
              </div>
              
              <div className="flex items-start justify-between mb-5 pt-2">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white">
                  <Crown className="w-5 h-5" />
                </div>
              </div>
              
              <h3 className="text-xl font-serif font-bold text-foreground mb-1">Yearly</h3>
              <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{PLAN_FEATURES.YEARLY.headline}</p>
              
              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight text-foreground">${STRIPE_PRODUCTS.YEARLY.price}</span>
                  <span className="text-muted-foreground text-sm">/year</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">That's just $8.25/month</p>
              </div>
              
              <div className="flex-1 space-y-3 mb-6">
                {PLAN_FEATURES.YEARLY.features.slice(0, 5).map((feature, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-sm">
                    <Check className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
                    <span className="text-foreground/80">{feature}</span>
                  </div>
                ))}
              </div>
              
              <Button
                variant="outline"
                className="w-full h-11 font-medium border-amber-200 hover:bg-amber-50 hover:border-amber-300 dark:border-amber-800 dark:hover:bg-amber-950"
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

      {/* À la Carte Credits - Editorial Section */}
      <section className="py-20 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-muted/30 to-background" />
        
        <div className="relative max-w-5xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-muted border border-border rounded-full text-xs font-medium text-muted-foreground mb-4">
              <Wallet className="w-3.5 h-3.5" />
              Pay as you go
            </span>
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-3">
              Not ready to commit?
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Add credits to your wallet and use them whenever inspiration strikes. 
              Perfect for finishing that one stubborn day or optimizing a route before you leave.
            </p>
          </motion.div>

          {/* Credit Actions Grid */}
          <div className="grid sm:grid-cols-2 gap-4 mb-8">
            {[
              { 
                title: 'Build one day', 
                price: (CREDIT_COSTS.BUILD_DAY / 100).toFixed(2),
                desc: 'AI fills a single day with activities tailored to you',
                tags: ['AI suggestions', 'Time blocking']
              },
              { 
                title: 'Build entire trip', 
                price: (CREDIT_COSTS.BUILD_FULL_TRIP / 100).toFixed(2),
                desc: 'Generate a complete multi-day itinerary in one go',
                tags: ['All days filled', 'AI personalized'],
                tip: 'For just $6 more, Monthly gives you unlimited rebuilds'
              },
              { 
                title: 'Optimize route', 
                price: (CREDIT_COSTS.ROUTE_OPTIMIZE / 100).toFixed(2),
                desc: 'Reorder activities and calculate travel times',
                tags: ['Smart ordering', 'Transport modes']
              },
              { 
                title: 'Group budget setup', 
                price: (CREDIT_COSTS.GROUP_BUDGET_SETUP / 100).toFixed(2),
                desc: 'Auto-split expenses among your travel crew',
                tags: ['Expense tracking', 'Split calculator']
              },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group bg-card rounded-xl p-5 border border-border hover:border-primary/20 hover:shadow-md transition-all duration-300"
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    {item.title}
                  </h4>
                  <span className="text-lg font-bold text-primary">${item.price}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">{item.desc}</p>
                <div className="flex flex-wrap gap-1.5">
                  {item.tags.map(tag => (
                    <span key={tag} className="px-2 py-0.5 text-xs bg-primary/5 text-primary/80 rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
                {item.tip && (
                  <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border italic">
                    💡 {item.tip}
                  </p>
                )}
              </motion.div>
            ))}
          </div>

          {/* Top Up CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-muted/60 to-muted/30 rounded-2xl p-6 border border-border"
          >
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-center md:text-left">
                <h4 className="font-semibold text-foreground mb-1">Add credits to your wallet</h4>
                <p className="text-sm text-muted-foreground">Credits never expire. Use them whenever you need.</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {TOPUP_OPTIONS.map((option) => (
                  <Button
                    key={option.amount}
                    variant="outline"
                    size="sm"
                    className="min-w-[80px]"
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

      {/* Value Props - Editorial Cards */}
      <section className="py-20 bg-gradient-to-b from-background to-muted/20">
        <div className="max-w-6xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-3">
              Every plan includes
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Core features that make Voyance the smartest way to plan travel
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
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
                className="bg-card rounded-xl p-5 border border-border text-center hover:shadow-md transition-shadow"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-1.5 text-sm">{item.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQs - Editorial Accordion Style */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-3">
              Frequently asked questions
            </h2>
            <p className="text-muted-foreground">
              Everything you need to know about our plans
            </p>
          </motion.div>

          <div className="space-y-4">
            {[
              {
                question: 'What\'s included in the free plan?',
                answer: 'One full itinerary build at full power, no blur, no withholding. After that, you can keep planning manually using our DIY skeleton mode, or upgrade to auto-build more.',
              },
              {
                question: 'What\'s the difference between Trip Pass and Monthly?',
                answer: 'Trip Pass unlocks one trip with unlimited rebuilds. Monthly unlocks up to five draft trips at once, plus smarter flight/hotel ranking, group budgeting, and co-editing on every trip.',
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
                className="bg-card rounded-xl p-5 border border-border hover:border-primary/20 transition-colors"
              >
                <h3 className="font-semibold text-foreground mb-2">{faq.question}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{faq.answer}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA - Refined */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-primary/5 via-muted/30 to-background" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/10 rounded-full blur-3xl" />
        
        <div className="relative max-w-3xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-4">
              Ready to plan smarter?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
              Start with your free itinerary. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button asChild size="lg" className="min-w-[160px]">
                <Link to={ROUTES.QUIZ}>
                  Start Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="min-w-[160px]">
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
