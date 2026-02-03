import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { motion } from 'framer-motion';
import { Check, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ROUTES } from '@/config/routes';
import { CREDIT_PACKS, TOPUP_PACK, formatCredits } from '@/config/pricing';
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
    pack: { priceId: string; productId: string; credits: number; name: string },
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
      <Head title="Pricing | Voyance" description="Simple credit packs for personalized travel planning." />
      
      {/* Hero */}
      <section className="relative min-h-[35vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img 
            src={pricingHero} 
            alt="Travel planning" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background" />
        </div>
        
        <div className="relative z-10 max-w-3xl mx-auto px-4 text-center py-16">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-5xl font-serif font-bold text-foreground mb-4"
          >
            Simple pricing. No surprises.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground text-lg max-w-xl mx-auto"
          >
            Pick a pack that fits your trip. Purchased credits never expire.
          </motion.p>
        </div>
      </section>

      {/* What Credits Buy */}
      <section className="py-12 -mt-8">
        <div className="max-w-4xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-wrap justify-center gap-3 text-sm"
          >
            {[
              'Unlock days',
              'Swap activities',
              'Regenerate itineraries',
              'AI restaurant picks',
              'Trip companion chat',
            ].map((item) => (
              <span key={item} className="px-4 py-2 bg-card border border-border rounded-full text-muted-foreground">
                {item}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Credit Packs */}
      <section className="py-16 -mt-8">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-5">
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
                      Most Popular
                    </Badge>
                  )}
                  
                  <div className="text-center mb-4">
                    <h3 className="text-lg font-bold text-foreground">{pack.name}</h3>
                    <div className="text-3xl font-bold text-foreground mt-2">${pack.price}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {formatCredits(pack.credits)} credits
                    </div>
                  </div>

                  <Button 
                    className="w-full"
                    variant={isFeatured ? 'default' : 'outline'}
                    onClick={() => openCheckout(pack, pack.id)}
                    disabled={loadingPlan === pack.id}
                  >
                    {loadingPlan === pack.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Get Started'}
                  </Button>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* What's Included */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-2xl font-serif font-bold text-foreground mb-8">Every pack includes</h2>

            <div className="bg-card rounded-2xl border border-border p-8 text-left max-w-lg mx-auto">
              <ul className="space-y-4">
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Personalized itineraries based on your Travel DNA</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Swap activities to match your mood</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>AI restaurant recommendations</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Smart route optimization</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>PDF export and sharing</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Real-time trip mode</span>
                </li>
              </ul>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Free Tier */}
      <section className="py-16">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-2xl font-serif font-bold text-foreground mb-2">Try it free</h2>
            <p className="text-muted-foreground mb-8">No credit card required</p>

            <div className="bg-card rounded-2xl border border-border p-8 text-left max-w-lg mx-auto">
              <ul className="space-y-3 mb-6">
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span><strong>1 free day</strong> to unlock on signup</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Monthly free credits to keep exploring</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Full Travel DNA quiz</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Preview any trip before you buy</span>
                </li>
              </ul>
              <Button asChild className="w-full">
                <Link to={ROUTES.QUIZ}>
                  Start Free <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Quick Top-Up */}
      <section className="py-12 bg-muted/30">
        <div className="max-w-md mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h3 className="text-lg font-medium text-foreground mb-2">Need a quick refill?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              50 credits for $5. Good for swaps and AI features.
            </p>
            <Button 
              variant="outline"
              size="sm"
              onClick={() => openCheckout(TOPUP_PACK, 'topup')}
              disabled={loadingPlan === 'topup'}
            >
              {loadingPlan === 'topup' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Quick Top-Up'}
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Simple FAQ */}
      <section className="py-16 border-t border-border">
        <div className="max-w-2xl mx-auto px-4">
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
              { q: "Do credits expire?", a: "Purchased credits never expire. Free credits expire after 6 months if unused." },
              { q: "Can I try before I buy?", a: "Yes! You get free credits on signup to unlock your first day. No credit card required." },
              { q: "What if I need more credits mid-trip?", a: "Just buy another pack anytime. Credits are added instantly." },
              { q: "Can I share my trip with others?", a: "Absolutely. Sharing and PDF export are included with every trip." },
            ].map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <h3 className="font-medium text-foreground mb-1">{faq.q}</h3>
                <p className="text-muted-foreground text-sm">{faq.a}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 bg-primary/5 border-t border-primary/10">
        <div className="max-w-xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-serif font-bold text-foreground mb-3">
            Ready to plan your perfect trip?
          </h2>
          <p className="text-muted-foreground mb-6">
            Take the 5-minute quiz to discover your Travel DNA.
          </p>
          <Button asChild size="lg">
            <Link to={ROUTES.QUIZ}>
              Find My Travel Style <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
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
