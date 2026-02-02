import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { motion } from 'framer-motion';
import { Check, ArrowRight, Loader2, Sparkles, Clock, Zap, Lock, Dna, Brain, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ROUTES } from '@/config/routes';
import { PLAN_FEATURES, STRIPE_PRODUCTS, PACKAGES, TIER_FEATURES, COMPARISON_TABLE, getPerDayPrice, FREE_TIER_LIMITS } from '@/config/pricing';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { EmbeddedCheckoutModal } from '@/components/checkout';
import pricingHero from '@/assets/pricing-hero.jpg';

interface CheckoutConfig {
  priceId: string;
  mode: 'subscription' | 'payment';
  productName: string;
  returnPath: string;
  // Day purchase fields
  productId?: string;
  days?: number;
  packageTier?: 'essential' | 'complete';
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
      toast({ title: "Purchase complete!", description: "Your days have been added to your account." });
      searchParams.delete('success');
      setSearchParams(searchParams);
    }
    if (searchParams.get('canceled') === 'true') {
      toast({ title: "No worries", description: "You can upgrade whenever you're ready." });
      searchParams.delete('canceled');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams, toast]);

  const openCheckout = async (
    priceId: string, 
    mode: 'subscription' | 'payment', 
    planName: string, 
    productDisplayName: string,
    options?: { productId?: string; days?: number; packageTier?: 'essential' | 'complete' }
  ) => {
    setLoadingPlan(planName);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Sign in first", description: "Create an account to get started." });
        navigate('/signin?redirect=/pricing');
        return;
      }
      setCheckoutConfig({ 
        priceId, 
        mode, 
        productName: productDisplayName, 
        returnPath: '/pricing?success=true',
        productId: options?.productId,
        days: options?.days,
        packageTier: options?.packageTier,
      });
    } catch (error) {
      toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" });
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <MainLayout>
      <Head title="Pricing | Voyance" description="Simple, flexible pricing. Pay for what you need. Days never expire." />
      
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
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full text-primary font-medium text-sm mb-4"
          >
            <Dna className="w-4 h-4" />
            Powered by Travel DNA
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-3xl md:text-5xl font-serif font-bold text-foreground mb-4"
          >
            Simple, flexible pricing.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-muted-foreground text-lg max-w-xl mx-auto"
          >
            Pay for what you need. Days never expire.
          </motion.p>
        </div>
      </section>

      {/* Packages Section - LEAD */}
      <section className="py-12 -mt-8">
        <div className="max-w-6xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <h2 className="text-2xl font-serif font-bold text-foreground mb-2">Packages</h2>
            <p className="text-muted-foreground">Best value for full trips</p>
          </motion.div>

          {/* Package Grid */}
          <div className="overflow-x-auto">
            <div className="grid grid-cols-3 gap-4 min-w-[700px]">
              {/* Header Row */}
              <div className="text-center py-4">
                <h3 className="font-bold text-foreground text-lg">Escape</h3>
                <p className="text-muted-foreground text-sm">3 days</p>
              </div>
              <div className="text-center py-4">
                <h3 className="font-bold text-foreground text-lg">Week</h3>
                <p className="text-muted-foreground text-sm">7 days</p>
              </div>
              <div className="text-center py-4">
                <h3 className="font-bold text-foreground text-lg">Extended</h3>
                <p className="text-muted-foreground text-sm">12 days</p>
              </div>

              {/* Essential Row */}
              {[
                { pkg: PACKAGES.ESCAPE, product: STRIPE_PRODUCTS.ESCAPE_ESSENTIAL, key: 'escape_essential' },
                { pkg: PACKAGES.WEEK, product: STRIPE_PRODUCTS.WEEK_ESSENTIAL, key: 'week_essential' },
                { pkg: PACKAGES.EXTENDED, product: STRIPE_PRODUCTS.EXTENDED_ESSENTIAL, key: 'extended_essential' },
              ].map(({ pkg, product, key }) => (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="bg-card rounded-xl border border-border p-5"
                >
                  <div className="text-center mb-4">
                    <span className="text-sm font-medium text-muted-foreground">Essential</span>
                    <div className="text-2xl font-bold text-foreground">${product.price}</div>
                    <div className="text-xs text-muted-foreground">${getPerDayPrice(product.price, product.days)}/day</div>
                  </div>
                  <Button 
                    variant="outline"
                    className="w-full"
                    onClick={() => openCheckout(product.priceId, 'payment', key, product.name, {
                      productId: product.productId,
                      days: product.days,
                      packageTier: 'essential',
                    })}
                    disabled={loadingPlan === key}
                  >
                    {loadingPlan === key ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Get'}
                  </Button>
                </motion.div>
              ))}

              {/* Complete Row */}
              {[
                { pkg: PACKAGES.ESCAPE, product: STRIPE_PRODUCTS.ESCAPE_COMPLETE, key: 'escape_complete' },
                { pkg: PACKAGES.WEEK, product: STRIPE_PRODUCTS.WEEK_COMPLETE, key: 'week_complete', featured: true },
                { pkg: PACKAGES.EXTENDED, product: STRIPE_PRODUCTS.EXTENDED_COMPLETE, key: 'extended_complete' },
              ].map(({ pkg, product, key, featured }) => (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className={`rounded-xl p-5 relative ${featured ? 'bg-primary/5 border-2 border-primary' : 'bg-card border border-border'}`}
                >
                  {featured && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Recommended
                    </Badge>
                  )}
                  <div className="text-center mb-4">
                    <span className={`text-sm font-medium ${featured ? 'text-primary' : 'text-muted-foreground'}`}>Complete ✨</span>
                    <div className="text-2xl font-bold text-foreground">${product.price}</div>
                    <div className="text-xs text-muted-foreground">${getPerDayPrice(product.price, product.days)}/day</div>
                  </div>
                  <Button 
                    className="w-full"
                    variant={featured ? 'default' : 'outline'}
                    onClick={() => openCheckout(product.priceId, 'payment', key, product.name, {
                      productId: product.productId,
                      days: product.days,
                      packageTier: 'complete',
                    })}
                    disabled={loadingPlan === key}
                  >
                    {loadingPlan === key ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Get'}
                  </Button>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Add Days Section - ADD-ON */}
      <section className="py-12 bg-muted/30">
        <div className="max-w-4xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-8"
          >
            <h2 className="text-xl font-serif font-bold text-foreground mb-2">Need just a few days?</h2>
            <p className="text-muted-foreground text-sm">Add days à la carte for quick trips</p>
          </motion.div>

          <div className="flex justify-center gap-6 flex-wrap">
            {/* 1 Day */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-card rounded-2xl border border-border p-6 w-40 text-center"
            >
              <h3 className="text-lg font-bold text-foreground mb-1">1 Day</h3>
              <div className="text-2xl font-bold text-foreground mb-3">${STRIPE_PRODUCTS.DAY_1.price}</div>
              <Button 
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => openCheckout(STRIPE_PRODUCTS.DAY_1.priceId, 'payment', 'day_1', '1 Day', {
                  productId: STRIPE_PRODUCTS.DAY_1.productId,
                  days: STRIPE_PRODUCTS.DAY_1.days,
                })}
                disabled={loadingPlan === 'day_1'}
              >
                {loadingPlan === 'day_1' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
              </Button>
            </motion.div>

            {/* 2 Days */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.05 }}
              className="bg-card rounded-2xl border border-border p-6 w-40 text-center relative"
            >
              <Badge variant="secondary" className="absolute -top-2 left-1/2 -translate-x-1/2 text-xs">
                Save $2
              </Badge>
              <h3 className="text-lg font-bold text-foreground mb-1 mt-1">2 Days</h3>
              <div className="text-2xl font-bold text-foreground mb-3">${STRIPE_PRODUCTS.DAY_2.price}</div>
              <Button 
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => openCheckout(STRIPE_PRODUCTS.DAY_2.priceId, 'payment', 'day_2', '2 Days', {
                  productId: STRIPE_PRODUCTS.DAY_2.productId,
                  days: STRIPE_PRODUCTS.DAY_2.days,
                })}
                disabled={loadingPlan === 'day_2'}
              >
                {loadingPlan === 'day_2' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* What's Included */}
      <section className="py-16">
        <div className="max-w-5xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <h2 className="text-2xl font-serif font-bold text-foreground mb-3">What's Included</h2>
          </motion.div>

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
                  <th className="text-center py-4 px-4 font-semibold text-foreground">Essential</th>
                  <th className="text-center py-4 px-4 font-semibold text-primary-foreground bg-primary">Complete</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_TABLE.rows.filter(row => row.feature !== 'Travel DNA Quiz').map((row, i) => (
                  <tr key={row.feature} className={`border-b border-border/50 ${i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}>
                    <td className="py-3.5 px-5 text-foreground font-medium">{row.feature}</td>
                    <td className="py-3.5 px-4 text-center">
                      <TableCellContent value={row.essential} />
                    </td>
                    <td className="py-3.5 px-4 text-center bg-primary/5">
                      <TableCellContent value={row.complete} highlight />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </div>
      </section>

      {/* Free Tier */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-2xl font-serif font-bold text-foreground mb-4">Free</h2>
            <p className="text-muted-foreground mb-8">Always free to start</p>

            <div className="bg-card rounded-2xl border border-border p-8 text-left max-w-lg mx-auto">
              <ul className="space-y-3 mb-6">
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>1 free day every month (accumulates up to {FREE_TIER_LIMITS.maxBankedDays})</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>{FREE_TIER_LIMITS.maxActivitySwaps} activity swaps per month</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>{FREE_TIER_LIMITS.maxRegenerates} day regenerate per month</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Full Travel DNA quiz</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Trip previews</span>
                </li>
              </ul>
              <div className="text-sm text-muted-foreground border-t border-border pt-4 space-y-1">
                <p>• Free days expire after {FREE_TIER_LIMITS.freeExpirationMonths} months</p>
                <p>• Purchased days never expire</p>
              </div>
              <Button asChild variant="outline" className="w-full mt-6">
                <Link to={ROUTES.QUIZ}>
                  Start Free <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Why DNA Matters */}
      <section className="py-12">
        <div className="max-w-4xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-primary/5 via-card to-primary/5 rounded-2xl border border-primary/20 p-8"
          >
            <div className="text-center mb-8">
              <h2 className="text-xl font-serif font-bold text-foreground mb-2">
                Not just <span className="line-through text-muted-foreground">any</span> itinerary. <span className="text-primary italic">Your</span> itinerary.
              </h2>
              <p className="text-muted-foreground max-w-lg mx-auto">
                Generic travel guides don't know you hate crowds, love hidden cafés, or need a slower pace. Your Travel DNA does.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Brain className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-medium text-foreground mb-1">2-Minute Quiz</h3>
                <p className="text-sm text-muted-foreground">
                  We learn your pace, energy, and travel personality
                </p>
              </div>
              <Link to={ROUTES.ARCHETYPES} className="text-center group cursor-pointer">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3 group-hover:bg-primary/20 transition-colors">
                  <Dna className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-medium text-foreground mb-1 group-hover:text-primary transition-colors">27 Archetypes</h3>
                <p className="text-sm text-muted-foreground">
                  From "Slow Traveler" to "Adrenaline Chaser"
                </p>
                <span className="text-xs text-primary mt-2 inline-block opacity-0 group-hover:opacity-100 transition-opacity">
                  See all archetypes →
                </span>
              </Link>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Heart className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-medium text-foreground mb-1">Every Activity Fits</h3>
                <p className="text-sm text-muted-foreground">
                  Dining, activities, and timing tailored to you
                </p>
              </div>
            </div>
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
              { 
                q: 'What is Travel DNA?', 
                a: 'Travel DNA is your personalization profile. A 2-minute quiz identifies your travel personality from 27 archetypes - things like your pace, energy levels, food preferences, and crowd tolerance. Every itinerary we build uses your DNA to select activities, restaurants, and timing that actually fit how you travel.' 
              },
              { 
                q: 'What can I do for free?', 
                a: 'Take the Travel DNA quiz, discover your archetype, and build a fully personalized itinerary. You get 1 free day per month (accumulates up to 5) plus 3 activity swaps and 1 day regenerate each month.' 
              },
              { 
                q: "What's the difference between Essential and Complete?", 
                a: 'Essential gives you full access to your itinerary with 5 swaps and 2 regenerates. Complete adds unlimited modifications plus premium features: route optimization, AI trip companion, restaurant recommendations, and real-time trip mode.' 
              },
              { 
                q: 'Do days expire?', 
                a: 'Purchased days never expire. Free days (earned monthly) expire after 6 months if unused.' 
              },
              { 
                q: 'What if my trip is longer than my package?', 
                a: 'You can add individual days at $9/day or $16 for 2 days. Or upgrade to a larger package — we\'ll credit what you\'ve already spent.' 
              },
              { 
                q: 'Does my Travel DNA improve over time?', 
                a: 'Yes! The more you use Voyance, the smarter your recommendations become. When you save, skip, or swap activities, we learn what resonates and refine future suggestions.' 
              },
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
          productId={checkoutConfig.productId}
          days={checkoutConfig.days}
          packageTier={checkoutConfig.packageTier}
        />
      )}
    </MainLayout>
  );
}
