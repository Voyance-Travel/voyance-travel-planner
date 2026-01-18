import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { motion } from 'framer-motion';
import { CheckCircle, Sparkles, Calendar, Plane, MapPin, Clock, Users, Star, ArrowRight, Compass, Heart, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';

const steps = [
  {
    icon: Sparkles,
    title: 'Discover Your Travel DNA',
    description: 'Take our 5-minute quiz to uncover your unique travel personality. We\'ll learn about your pace, interests, budget, and dream experiences.',
    image: 'https://images.unsplash.com/photo-1501555088652-021faa106b9b?w=600&q=80',
    color: 'from-violet-500 to-purple-600',
  },
  {
    icon: Compass,
    title: 'Get Personalized Recommendations',
    description: 'Our AI matches you with destinations and experiences that resonate with who you are. No more generic itineraries—every suggestion is tailored to you.',
    image: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=600&q=80',
    color: 'from-blue-500 to-cyan-600',
  },
  {
    icon: Calendar,
    title: 'Craft Your Perfect Itinerary',
    description: 'Watch as we build a day-by-day plan with the right mix of activities, dining, and downtime. Customize anything until it feels just right.',
    image: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80',
    color: 'from-emerald-500 to-teal-600',
  },
  {
    icon: Plane,
    title: 'Book Everything in One Place',
    description: 'Flights, hotels, activities—all seamlessly bookable. Lock in your prices and get ready for an unforgettable journey.',
    image: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=600&q=80',
    color: 'from-orange-500 to-rose-600',
  },
];

const benefits = [
  {
    icon: Clock,
    title: 'Save 15+ Hours',
    description: 'Skip the endless research. We do the heavy lifting so you can focus on dreaming.',
  },
  {
    icon: Heart,
    title: 'Truly Personal',
    description: 'Every recommendation reflects your unique preferences, not generic tourist traps.',
  },
  {
    icon: Users,
    title: 'Group Friendly',
    description: 'Planning with others? We balance everyone\'s preferences for perfect group trips.',
  },
  {
    icon: Shield,
    title: 'Book with Confidence',
    description: 'Price lock guarantees, flexible cancellations, and 24/7 trip support.',
  },
];

const stats = [
  { value: '15+', label: 'Hours Saved Per Trip', icon: Clock },
  { value: '190+', label: 'Countries Covered', icon: MapPin },
];

export default function HowItWorks() {
  return (
    <MainLayout>
      <Head
        title="How It Works | Voyance"
        description="Learn how Voyance uses AI to create your perfect personalized travel itinerary in minutes."
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
            The Smarter Way to Travel
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-display font-bold text-foreground mb-6 leading-tight"
          >
            Your Dream Trip,<br />
            <span className="text-primary">Perfectly Planned</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10"
          >
            No more endless tabs, conflicting reviews, or overwhelming choices. 
            Voyance learns who you are and builds the journey you've been dreaming of.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Button asChild size="lg" className="text-lg px-8">
              <Link to={ROUTES.QUIZ}>
                Take the Quiz
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="text-lg px-8">
              <Link to={ROUTES.EXPLORE}>Explore Destinations</Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="py-12 bg-gradient-to-r from-primary/5 via-card to-primary/5 border-y border-border">
        <div className="max-w-4xl mx-auto px-4">
          <div className="grid grid-cols-2 gap-12">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
                className="text-center"
              >
                <div className="flex items-center justify-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <stat.icon className="w-5 h-5 text-primary" />
                  </div>
                  <p className="text-4xl font-bold text-primary">{stat.value}</p>
                </div>
                <p className="text-muted-foreground">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Steps - Alternating Layout */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
              Four Simple Steps to Your Perfect Trip
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From dream to departure in less time than it takes to scroll through travel blogs
            </p>
          </motion.div>

          <div className="space-y-24">
            {steps.map((step, index) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6 }}
                className={`grid lg:grid-cols-2 gap-12 items-center ${
                  index % 2 === 1 ? 'lg:flex-row-reverse' : ''
                }`}
              >
                <div className={index % 2 === 1 ? 'lg:order-2' : ''}>
                  <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br ${step.color} text-white mb-6`}>
                    <step.icon className="h-7 w-7" />
                  </div>
                  <div className="text-sm font-semibold text-primary mb-2">Step {index + 1}</div>
                  <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-4">{step.title}</h3>
                  <p className="text-lg text-muted-foreground leading-relaxed">{step.description}</p>
                </div>
                <div className={`relative ${index % 2 === 1 ? 'lg:order-1' : ''}`}>
                  <div className={`absolute inset-0 bg-gradient-to-br ${step.color} rounded-3xl blur-2xl opacity-20 -m-4`} />
                  <img
                    src={step.image}
                    alt={step.title}
                    className="relative w-full aspect-[4/3] object-cover rounded-2xl shadow-xl"
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-24 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
              Why Travelers Love Voyance
            </h2>
            <p className="text-lg text-muted-foreground">
              We handle the complexity so you can enjoy the journey
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((benefit, index) => (
              <motion.div
                key={benefit.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-card p-6 rounded-2xl border border-border hover:border-primary/30 hover:shadow-lg transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <benefit.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{benefit.title}</h3>
                <p className="text-muted-foreground text-sm">{benefit.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Promise Section - Replace testimonials */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="max-w-5xl mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
              Our Promise to You
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              We're building Voyance on a foundation of honesty and transparency
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Shield,
                title: 'No Hidden Fees',
                description: 'What you see is what you pay. We never add surprise charges or markups.',
              },
              {
                icon: Heart,
                title: 'Honest Recommendations',
                description: 'Every suggestion is based on your preferences—not paid partnerships or sponsorships.',
              },
              {
                icon: Sparkles,
                title: 'Genuinely Personalized',
                description: 'Your itinerary is crafted for you, not recycled from a template.',
              },
            ].map((promise, index) => (
              <motion.div
                key={promise.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-card/50 backdrop-blur p-8 rounded-2xl border border-border text-center hover:border-primary/30 transition-colors"
              >
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <promise.icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{promise.title}</h3>
                <p className="text-muted-foreground text-sm">{promise.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      
      {/* CTA */}
      <section className="py-24 bg-gradient-to-br from-primary/10 via-accent/5 to-background">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
              Ready to Plan Your Next Adventure?
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
              Start with our free quiz to discover your Travel DNA—no credit card required.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="text-lg px-8">
                <Link to={ROUTES.QUIZ}>
                  Take the Travel Quiz
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to={ROUTES.DESTINATIONS}>Browse Destinations</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </MainLayout>
  );
}
