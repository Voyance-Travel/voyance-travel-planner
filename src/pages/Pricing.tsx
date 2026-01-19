import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { motion } from 'framer-motion';
import { Check, Sparkles, Compass, Crown, Zap, ArrowRight, Shield, Clock, Users, Heart, Star, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';

const plans = [
  {
    name: 'Explorer',
    tagline: 'Start your journey',
    price: 'Free',
    priceDetail: 'forever',
    description: 'Perfect for travelers who want to discover their travel style and explore destinations.',
    icon: Compass,
    color: 'from-blue-500 to-cyan-500',
    popular: false,
    features: [
      'Travel DNA Quiz & Profile',
      'Personalized destination recommendations',
      'Browse curated travel guides',
      'Save up to 3 trips',
      'Basic itinerary generation',
      'Community access',
    ],
    cta: 'Get Started Free',
    ctaLink: ROUTES.QUIZ,
  },
  {
    name: 'Voyager',
    tagline: 'Most popular',
    price: '$12',
    priceDetail: 'per trip',
    description: 'Full-featured trip planning with AI-powered itineraries and booking assistance.',
    icon: Sparkles,
    color: 'from-primary to-primary/80',
    popular: true,
    features: [
      'Everything in Explorer, plus:',
      'Unlimited AI itinerary generation',
      'Real-time flight & hotel search',
      'Price lock guarantee (48 hours)',
      'Day-by-day activity planning',
      'Weather-optimized scheduling',
      'Export & share itineraries',
      'Priority email support',
    ],
    cta: 'Plan Your Trip',
    ctaLink: ROUTES.START,
  },
  {
    name: 'Concierge',
    tagline: 'White-glove service',
    price: '$49',
    priceDetail: 'per trip',
    description: 'Premium planning with expert curation and exclusive experiences for discerning travelers.',
    icon: Crown,
    color: 'from-amber-500 to-orange-500',
    popular: false,
    features: [
      'Everything in Voyager, plus:',
      'Hand-curated by travel experts',
      'Access to exclusive experiences',
      'Restaurant reservation assistance',
      'VIP upgrades when available',
      '72-hour price lock',
      'Dedicated trip coordinator',
      '24/7 priority support',
    ],
    cta: 'Get Concierge',
    ctaLink: ROUTES.START,
  },
];

const faqs = [
  {
    question: 'How does pricing work?',
    answer: 'Explorer is completely free. For Voyager and Concierge, you only pay when you\'re ready to finalize and book a trip. No subscription, no hidden fees—just pay per trip.',
  },
  {
    question: 'What\'s included in the price lock guarantee?',
    answer: 'When you lock in prices with Voyager (48 hours) or Concierge (72 hours), we guarantee the flight and hotel prices shown. If prices drop, we\'ll automatically apply the lower rate.',
  },
  {
    question: 'Can I try before I buy?',
    answer: 'Absolutely! Start with Explorer for free. Take the quiz, explore destinations, and generate basic itineraries. Upgrade to Voyager or Concierge when you\'re ready to book.',
  },
  {
    question: 'What if I need to change my trip?',
    answer: 'Itinerary modifications are unlimited before booking. After booking, standard airline and hotel cancellation policies apply. Concierge members get priority rebooking assistance.',
  },
  {
    question: 'Do you charge booking fees?',
    answer: 'No booking fees. The trip price includes our planning service. Flight, hotel, and activity prices are passed through at market rates with no markup.',
  },
];

const testimonials = [
  {
    quote: "Voyance planned our honeymoon in Paris better than any travel agent could. Every restaurant, every activity was perfectly us.",
    author: "Sarah & James",
    trip: "Paris, France",
    plan: "Voyager",
  },
  {
    quote: "The Concierge service got us into a fully-booked restaurant and upgraded our hotel room. Worth every penny.",
    author: "Michael T.",
    trip: "Tokyo, Japan",
    plan: "Concierge",
  },
  {
    quote: "I was skeptical about AI planning, but the itinerary knew I hate mornings and love street food. It just got me.",
    author: "Priya K.",
    trip: "Barcelona, Spain",
    plan: "Voyager",
  },
];

export default function Pricing() {
  return (
    <MainLayout>
      <Head
        title="Pricing | Voyance"
        description="Simple, transparent pricing for AI-powered travel planning. Start free, pay per trip."
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
            Plan trips your way,<br />
            <span className="text-primary">pay only when ready</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-muted-foreground max-w-2xl mx-auto"
          >
            No subscriptions, no commitments. Start exploring for free, 
            and only pay when you're ready to bring your dream trip to life.
          </motion.p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-20 -mt-8 relative z-10">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {plans.map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
                className={`relative rounded-3xl ${
                  plan.popular 
                    ? 'bg-gradient-to-b from-primary/10 to-background border-2 border-primary shadow-xl shadow-primary/10' 
                    : 'bg-card border border-border'
                } p-8 flex flex-col`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-full">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      Most Popular
                    </span>
                  </div>
                )}
                
                {/* Plan Header */}
                <div className="mb-6">
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br ${plan.color} text-white mb-4`}>
                    <plan.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground">{plan.tagline}</p>
                </div>
                
                {/* Price */}
                <div className="mb-6">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.priceDetail}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
                </div>
                
                {/* Features */}
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <Check className={`w-5 h-5 flex-shrink-0 mt-0.5 ${plan.popular ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                {/* CTA */}
                <Button
                  asChild
                  size="lg"
                  variant={plan.popular ? 'default' : 'outline'}
                  className={`w-full ${plan.popular ? '' : 'hover:bg-primary/10'}`}
                >
                  <Link to={plan.ctaLink}>
                    {plan.cta}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </motion.div>
            ))}
          </div>
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

      {/* Testimonials */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
              Travelers love Voyance
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-card rounded-2xl p-6 border border-border"
              >
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-foreground mb-6 italic">"{testimonial.quote}"</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{testimonial.author}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {testimonial.trip}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full">
                    {testimonial.plan}
                  </span>
                </div>
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
            {faqs.map((faq, index) => (
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
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
              Ready to plan smarter?
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
              Start with our free Travel DNA quiz—no credit card required.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="text-lg px-8">
                <Link to={ROUTES.QUIZ}>
                  Take the Quiz
                  <Zap className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to={ROUTES.EXPLORE}>Explore Destinations</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </MainLayout>
  );
}
