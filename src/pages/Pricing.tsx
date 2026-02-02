import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { motion } from 'framer-motion';
import { Check, ArrowRight, Loader2, Sparkles, Dna, Brain, Heart, Ticket, RefreshCw, Utensils, MessageSquare, Map } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ROUTES } from '@/config/routes';
import { STRIPE_PRODUCTS, CREDIT_PACKS, CREDIT_COSTS, FREE_TIER, formatCredits } from '@/config/pricing';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { EmbeddedCheckoutModal } from '@/components/checkout';
import pricingHero from '@/assets/pricing-hero.jpg';

interface CheckoutConfig {
  priceId: string;
  mode: 'subscription' | 'payment';
  productName: string;
  returnPath: string;
  productId?: string;
  credits?: number;
}

export default function Pricing() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [checkoutConfig, setCheckoutConfig] = useState<CheckoutConfig | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast({ title: "Purchase complete!", description: "Credits have been added to your account." });
      searchParams.delete('success');
      setSearchParams(searchParams);
    }
    if (searchParams.get('canceled') === 'true') {
      toast({ title: "No worries", description: "You can get credits whenever you're ready." });
      searchParams.delete('canceled');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams, toast]);

  const openCheckout = async (
    pack: typeof CREDIT_PACKS[number],
    planKey: string
  ) => {
    setLoadingPlan(planKey);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Sign in first", description: "Create an account to get started." });
        navigate('/signin?redirect=/pricing');
        return;
      }
      setCheckoutConfig({ 
        priceId: pack.priceId, 
        mode: 'payment', 
        productName: `${pack.name} - ${formatCredits(pack.credits)} Credits`, 
        returnPath: '/pricing?success=true',
        productId: pack.productId,
        credits: pack.credits,
      });
    } catch (error) {
      toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" });
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <MainLayout>
      <Head title="Pricing | Voyance" description="One currency. One balance. Everything costs credits." />
      
      {/* Hero */}
      <section className="relative min-h-[40vh] flex items-center justify-center overflow-hidden">
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
            <Ticket className="w-4 h-4" />
            One Currency. Everything Costs Credits.
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-3xl md:text-5xl font-serif font-bold text-foreground mb-4"
          >
            No limits. No tracking. Just spend.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-muted-foreground text-lg max-w-xl mx-auto"
          >
            Buy credits once. Use them however you want.
          </motion.p>
        </div>
      </section>

      {/* Credit Costs */}
      <section className="py-12 -mt-8">
        <div className="max-w-4xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-8"
          >
            <h2 className="text-xl font-serif font-bold text-foreground mb-2">What Credits Buy</h2>
            <p className="text-muted-foreground text-sm">Every action has a clear price. You decide.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="grid grid-cols-2 md:grid-cols-3 gap-4"
          >
            {[
              { icon: Map, label: 'Unlock 1 day', cost: CREDIT_COSTS.UNLOCK_DAY },
              { icon: RefreshCw, label: 'Swap activity', cost: CREDIT_COSTS.SWAP_ACTIVITY },
              { icon: Sparkles, label: 'Regenerate day', cost: CREDIT_COSTS.REGENERATE_DAY },
              { icon: Utensils, label: 'Restaurant rec', cost: CREDIT_COSTS.RESTAURANT_REC },
              { icon: MessageSquare, label: 'AI message', cost: CREDIT_COSTS.AI_MESSAGE },
              { icon: Check, label: 'Route optimization', cost: CREDIT_COSTS.ROUTE_OPTIMIZATION, free: true },
            ].map((item) => (
              <div key={item.label} className="bg-card rounded-lg border border-border p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className={`text-sm ${item.free ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {item.free ? 'Free' : `${item.cost} credits`}
                  </p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Credit Packs */}
      <section className="py-12 bg-muted/30">
        <div className="max-w-5xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <h2 className="text-2xl font-serif font-bold text-foreground mb-2">Credit Packs</h2>
            <p className="text-muted-foreground">Purchased credits never expire</p>
          </motion.div>

          <div className="grid md:grid-cols-4 gap-6">
            {CREDIT_PACKS.map((pack, index) => {
              const isFeatured = pack.featured;
              return (
                <motion.div
                  key={pack.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                  className={`rounded-2xl p-6 relative ${
                    isFeatured 
                      ? 'bg-primary/5 border-2 border-primary' 
                      : 'bg-card border border-border'
                  }`}
                >
                  {isFeatured && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Best Value
                    </Badge>
                  )}
                  
                  <div className="text-center mb-4">
                    <h3 className="text-lg font-bold text-foreground">{pack.name}</h3>
                    <div className="text-3xl font-bold text-foreground mt-2">${pack.price}</div>
                    <div className="text-sm text-muted-foreground">{formatCredits(pack.credits)} credits</div>
                  </div>

                  <p className="text-sm text-muted-foreground text-center mb-4">
                    Covers {pack.description}
                  </p>

                  <Button 
                    className="w-full"
                    variant={isFeatured ? 'default' : 'outline'}
                    onClick={() => openCheckout(pack, pack.id)}
                    disabled={loadingPlan === pack.id}
                  >
                    {loadingPlan === pack.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Get Credits'}
                  </Button>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* What a Trip Costs */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <h2 className="text-2xl font-serif font-bold text-foreground mb-3">What a Trip Actually Costs</h2>
            <p className="text-muted-foreground">Real examples with typical usage</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { days: 3, pack: 'Starter', credits: 500, breakdown: [
                { item: '3 days', credits: 450 },
                { item: '4 swaps', credits: 20 },
                { item: '1 regenerate', credits: 15 },
                { item: '1 restaurant', credits: 10 },
                { item: '5 AI messages', credits: 10 },
              ], total: 505 },
              { days: 5, pack: 'Starter+', credits: 500, breakdown: [
                { item: '5 days', credits: 750 },
                { item: '6 swaps', credits: 30 },
                { item: '2 regenerates', credits: 30 },
                { item: '2 restaurants', credits: 20 },
                { item: '10 AI messages', credits: 20 },
              ], total: 850 },
              { days: 7, pack: 'Explorer', credits: 1200, breakdown: [
                { item: '7 days', credits: 1050 },
                { item: '8 swaps', credits: 40 },
                { item: '3 regenerates', credits: 45 },
                { item: '3 restaurants', credits: 30 },
                { item: '15 AI messages', credits: 30 },
              ], total: 1195 },
            ].map((example, i) => (
              <motion.div
                key={example.days}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-card rounded-xl border border-border p-5"
              >
                <div className="text-center mb-4">
                  <h3 className="text-lg font-bold text-foreground">{example.days}-Day Trip</h3>
                  <Badge variant="secondary" className="mt-1">{example.pack} pack covers it</Badge>
                </div>

                <div className="space-y-2 text-sm border-t border-border pt-4">
                  {example.breakdown.map((line) => (
                    <div key={line.item} className="flex justify-between text-muted-foreground">
                      <span>{line.item}</span>
                      <span>{line.credits}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-medium text-foreground pt-2 border-t border-border">
                    <span>Total</span>
                    <span>~{example.total} credits</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
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
                  <span><strong>{formatCredits(FREE_TIER.signupBonus)}</strong> credits on signup (1 free day)</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span><strong>{formatCredits(FREE_TIER.monthlyFree)}</strong> free credits every month</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span><strong>{formatCredits(FREE_TIER.referralBonus)}</strong> credits per friend referred</span>
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
                <p>• Free credits expire after {FREE_TIER.freeExpirationMonths} months</p>
                <p>• Purchased credits never expire</p>
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
                q: 'What are credits?', 
                a: 'Credits are your single currency for everything in Voyance. Unlock days, swap activities, regenerate itineraries, get restaurant recommendations, chat with the AI — all with credits. No limits, no tracking, no surprises.' 
              },
              { 
                q: 'Do credits expire?', 
                a: 'Purchased credits never expire. Free credits (signup bonus and monthly free credits) expire after 6 months if unused.' 
              },
              { 
                q: 'What can I do for free?', 
                a: 'You get 150 free credits on signup (enough for 1 day), plus 150 free credits every month. Take the Travel DNA quiz, preview trips, and decide when to unlock more.' 
              },
              { 
                q: 'Which pack should I buy?', 
                a: 'For a 3-day trip, Starter (500 credits) covers it. For a week, Explorer (1,200 credits) is perfect. For longer trips, Adventurer (2,500 credits) gives you room to experiment.' 
              },
              { 
                q: 'What if I run out mid-trip?', 
                a: 'Just buy more credits. They\'re added instantly. No interruption to your planning.' 
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
          credits={checkoutConfig.credits}
        />
      )}
    </MainLayout>
  );
}
