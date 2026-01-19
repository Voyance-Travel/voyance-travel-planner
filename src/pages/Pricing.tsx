import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { motion } from 'framer-motion';
import { Check, Sparkles, Compass, Crown, Zap, ArrowRight, Shield, Clock, Users, Heart, Star, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';
import { PLAN_FEATURES, STRIPE_PRODUCTS, CREDIT_MENU, TOPUP_OPTIONS } from '@/config/pricing';

export default function Pricing() {
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
            
            {/* Free */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="relative rounded-3xl bg-card border border-border p-6 flex flex-col"
            >
              <div className="mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white mb-4">
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

            {/* Trip Pass */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="relative rounded-3xl bg-gradient-to-b from-primary/10 to-background border-2 border-primary shadow-xl shadow-primary/10 p-6 flex flex-col"
            >
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-full">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  Best for One Trip
                </span>
              </div>
              
              <div className="mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-white mb-4">
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
                    <Check className="w-5 h-5 flex-shrink-0 mt-0.5 text-primary" />
                    <span className="text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
              
              <Button asChild size="lg" className="w-full">
                <Link to={ROUTES.START}>
                  Unlock This Trip
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </motion.div>

            {/* Monthly */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="relative rounded-3xl bg-card border border-border p-6 flex flex-col"
            >
              <div className="mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500 text-white mb-4">
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
                    <Check className="w-5 h-5 flex-shrink-0 mt-0.5 text-muted-foreground" />
                    <span className="text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
              
              <Button asChild size="lg" variant="outline" className="w-full">
                <Link to={ROUTES.START}>
                  Go Monthly
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </motion.div>

            {/* Yearly */}
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
              
              <Button asChild size="lg" variant="outline" className="w-full border-amber-500/50 hover:bg-amber-500/10">
                <Link to={ROUTES.START}>
                  Go Yearly
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </motion.div>
          </div>

          {/* Top-ups Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-16 max-w-3xl mx-auto"
          >
            <div className="bg-gradient-to-r from-muted/50 to-muted/30 rounded-2xl border border-border p-6 md:p-8">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Wallet className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground mb-1">Don't want a pass or subscription?</h3>
                  <p className="text-muted-foreground">
                    Top up your wallet (min $5) and spend it only when you want Voyance to auto-build a day, 
                    optimize routes, or complete an itinerary.
                  </p>
                </div>
              </div>
              
              <div className="grid sm:grid-cols-2 gap-4 mb-6">
                {CREDIT_MENU.map((item) => (
                  <div key={item.key} className="flex items-center justify-between bg-background rounded-lg p-3 border border-border">
                    <div>
                      <span className="font-medium text-foreground">{item.label}</span>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                    <span className="text-primary font-semibold">${(item.cost / 100).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              
              <div className="flex flex-wrap gap-3">
                {TOPUP_OPTIONS.map((option) => (
                  <Button key={option.amount} variant="outline" size="sm">
                    Add {option.label}
                  </Button>
                ))}
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
                answer: 'Trip Pass unlocks one trip. Monthly unlocks up to five draft trips at once—plus smarter flight/hotel ranking every time you search.',
              },
              {
                question: 'How do credits/top-ups work?',
                answer: 'Add funds to your wallet (min $5) and spend them on specific actions: building a day ($3.99), optimizing routes ($1.99), or building a full trip ($9.99). Perfect if you just need help finishing one day.',
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
      <section className="py-24 bg-gradient-to-br from-primary/10 via-accent/5 to-background">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-6">
              Ready to plan your dream trip?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Start with your free full-power build. See how Voyance just gets you.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="px-8">
                <Link to={ROUTES.QUIZ}>
                  Start Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="px-8">
                <Link to={ROUTES.HOW_IT_WORKS}>
                  See How It Works
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </MainLayout>
  );
}
