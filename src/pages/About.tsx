import { motion } from 'framer-motion';
import MainLayout from '@/components/layout/MainLayout';
import { ArrowRight, MessageSquare, Users, Clock, Check, X, Compass, Heart, Zap, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import Head from '@/components/common/Head';

export default function About() {
  return (
    <MainLayout>
      <Head
        title="About Voyance | AI-Powered Travel Planning"
        description="Learn about Voyance's mission to revolutionize travel planning with AI-powered personalization."
      />
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        {/* Background gradient instead of image */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10" />

        <div className="container mx-auto px-6 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span className="inline-block px-4 py-1.5 rounded-full bg-accent text-accent-foreground text-sm font-medium mb-6">
              Our Mission
            </span>
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              Travel Planning,{' '}
              <span className="text-primary">Reimagined</span>
            </h1>
            <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto mb-8">
              Voyance is an intelligent trip builder that listens, curates, and learns — 
              transforming the chaos of travel planning into a seamless experience.
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Compass className="h-4 w-4" />
              <span>Building the future of travel</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* The Problem Section */}
      <section className="py-20 bg-card">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-primary text-sm font-medium uppercase tracking-wider">The Problem</span>
            <h2 className="font-display text-3xl md:text-4xl font-bold mt-4">
              Travel Planning Shouldn't Feel Like Work
            </h2>
            <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">
              Most trips start with dozens of browser tabs, scattered notes, and endless group chat debates. 
              The excitement gets lost in the logistics.
            </p>
          </motion.div>

          {/* Problem Cards */}
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-16">
            {[
              {
                icon: <MessageSquare className="h-6 w-6" />,
                title: 'Too Many Tabs',
                description: 'Flights here, hotels there, activities somewhere else. No single source of truth.',
                color: 'text-red-500',
                bgColor: 'bg-red-500/10',
              },
              {
                icon: <Users className="h-6 w-6" />,
                title: 'Group Coordination',
                description: 'Endless messages, conflicting preferences, and decisions that never get made.',
                color: 'text-orange-500',
                bgColor: 'bg-orange-500/10',
              },
              {
                icon: <Clock className="h-6 w-6" />,
                title: 'Hours of Research',
                description: 'By the time you\'ve planned everything, the excitement has faded.',
                color: 'text-amber-500',
                bgColor: 'bg-amber-500/10',
              },
            ].map((problem, idx) => (
              <motion.div
                key={problem.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="bg-background rounded-xl border border-border p-6"
              >
                <div className={`w-12 h-12 rounded-lg ${problem.bgColor} flex items-center justify-center mb-4`}>
                  <div className={problem.color}>{problem.icon}</div>
                </div>
                <h3 className="font-semibold text-lg mb-2">{problem.title}</h3>
                <p className="text-sm text-muted-foreground">{problem.description}</p>
              </motion.div>
            ))}
          </div>

          {/* Before/After Comparison */}
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Before */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-900/50 p-6"
            >
              <span className="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wider">Before</span>
              <h3 className="font-semibold text-lg mt-2 mb-4">The Old Way</h3>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <X className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Lists scattered across multiple apps</span>
                </li>
                <li className="flex items-start gap-2">
                  <X className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Hours comparing prices and reviews</span>
                </li>
                <li className="flex items-start gap-2">
                  <X className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Generic recommendations that don't fit</span>
                </li>
              </ul>
            </motion.div>

            {/* After */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-primary/5 rounded-xl border border-primary/20 p-6"
            >
              <span className="text-xs font-medium text-primary uppercase tracking-wider">After</span>
              <h3 className="font-semibold text-lg mt-2 mb-4">With Voyance</h3>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">One intelligent interface for everything</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Personalized recommendations in minutes</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Trips tailored to your unique preferences</span>
                </li>
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Our Approach Section */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-primary text-sm font-medium uppercase tracking-wider">Our Approach</span>
            <h2 className="font-display text-3xl md:text-4xl font-bold mt-4">
              Built From First Principles
            </h2>
            <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">
              We didn't just build another booking site. We reimagined what travel planning could be.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                icon: <Heart className="h-6 w-6" />,
                title: 'Personalized Curation',
                description: 'Your Travel DNA powers recommendations that actually match your preferences, not generic suggestions.',
              },
              {
                icon: <Zap className="h-6 w-6" />,
                title: 'Intelligent Planning',
                description: 'AI that understands context, timing, and logistics — so every itinerary just works.',
              },
              {
                icon: <Shield className="h-6 w-6" />,
                title: 'Confidence in Booking',
                description: 'Transparent pricing, verified options, and support when you need it.',
              },
            ].map((feature, idx) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="text-center"
              >
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <div className="text-primary">{feature.icon}</div>
                </div>
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Who We Serve Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <span className="text-primary text-sm font-medium uppercase tracking-wider">Who We Serve</span>
            <h2 className="font-display text-3xl font-bold mt-4">Built for Thoughtful Travelers</h2>
            <p className="text-muted-foreground mt-4 max-w-xl mx-auto">
              We serve those who value their time as much as their experiences.
            </p>
          </motion.div>

          <div className="max-w-3xl mx-auto space-y-4">
            {[
              {
                title: 'Experience Seekers',
                desc: 'Those who want meaningful trips, not just destinations.',
              },
              {
                title: 'Busy Professionals',
                desc: 'Who want amazing trips without spending weeks planning.',
              },
              {
                title: 'Group Travelers',
                desc: 'Making coordination easy for friends and family trips.',
              },
            ].map((persona, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="flex items-center gap-4 bg-card rounded-xl border border-border p-5"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Check className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold">{persona.title}</h4>
                  <p className="text-sm text-muted-foreground">{persona.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary/5">
        <div className="container mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
              Ready to Plan Differently?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
              Discover your Travel DNA and let Voyance craft your perfect trip.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/quiz">
                <Button size="lg">
                  Take the Quiz
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
              <Link to="/explore">
                <Button size="lg" variant="outline">
                  Explore Destinations
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </MainLayout>
  );
}