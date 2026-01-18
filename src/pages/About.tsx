import { motion } from 'framer-motion';
import MainLayout from '@/components/layout/MainLayout';
import { ArrowRight, MessageSquare, Users, Clock, Check, X, Compass } from 'lucide-react';
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
      <section className="relative pt-24 pb-16 overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1920&q=80" 
            alt="Airplane wing view"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background" />
        </div>

        <div className="container mx-auto px-6 relative z-10 text-center py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span className="inline-block px-4 py-1.5 rounded-full bg-accent text-accent-foreground text-sm font-medium mb-6">
              Our Mission & Values
            </span>
            <h1 className="font-serif text-4xl md:text-5xl font-semibold mb-4">
              This Isn't Just Travel.<br />
              <span className="text-accent">This Is Design.</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-6">
              Voyance isn't another booking site. It's an intelligent trip builder that listens, 
              curates, and learns for you — from dream to departure.
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Compass className="h-4 w-4" />
              <span>Voyance Philosophy</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* The Problem Section */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <span className="text-accent text-sm font-medium">The Problem</span>
            <h2 className="font-serif text-3xl md:text-4xl font-semibold mt-2">
              Travel Is Meant to Feel Liberating — <span className="text-muted-foreground">Not Like Homework.</span>
            </h2>
            <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">
              Most trips start with 25 browser tabs. A Google Doc full of 
              copy-pasted links. A group chat that dissolves into chaos.
            </p>
          </motion.div>

          {/* Warning icon */}
          <div className="flex justify-center mb-8">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
              <span className="text-xl">⚠️</span>
            </div>
          </div>

          <p className="text-center text-muted-foreground mb-12">
            But you're <span className="text-foreground font-medium">still</span> the one stitching it all together.
          </p>

          {/* Problem Cards */}
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-16">
            {[
              {
                icon: <MessageSquare className="h-5 w-5 text-red-500" />,
                title: 'Too Many Tabs',
                description: '25 open tabs, no clarity, no connection. Just noise.',
                cta: 'Sound familiar?',
              },
              {
                icon: <Users className="h-5 w-5 text-orange-500" />,
                title: 'Group Chat Chaos',
                description: '15 options, 47 suggestions, no decisions. The energy drains.',
                cta: 'Been there?',
              },
              {
                icon: <Clock className="h-5 w-5 text-yellow-500" />,
                title: 'Weeks of Work',
                description: 'By hour 15 of planning, the joy is gone. It\'s just a task.',
                cta: 'Let us help',
              },
            ].map((problem, idx) => (
              <motion.div
                key={problem.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="bg-card rounded-xl border border-border p-6"
              >
                <div className="mb-4">{problem.icon}</div>
                <h3 className="font-semibold mb-2">{problem.title}</h3>
                <p className="text-sm text-muted-foreground mb-4">{problem.description}</p>
                <button className="text-accent text-sm font-medium hover:underline">
                  {problem.cta} →
                </button>
              </motion.div>
            ))}
          </div>

          {/* Comparison: Before/After */}
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Before - Chaos */}
            <div className="bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-900 p-6">
              <span className="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wider">Before</span>
              <h3 className="font-semibold text-lg mt-2 mb-4">Chaos & Confusion</h3>
              
              <div className="bg-white dark:bg-background rounded-lg p-4 mb-4 border border-red-100 dark:border-red-900">
                <div className="flex gap-2 mb-3">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className="h-2 w-8 bg-gray-200 dark:bg-gray-700 rounded" />
                  ))}
                </div>
                <div className="space-y-2">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="h-2 bg-gray-100 dark:bg-gray-800 rounded w-full" />
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <X className="h-3 w-3 text-red-500" /> Was this reviewed yet again?
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <X className="h-3 w-3 text-red-500" /> Where do we eat in Egypt?
                </div>
              </div>

              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2"><X className="h-4 w-4 text-red-500 shrink-0 mt-0.5" /> Lists scattered across 6 devices</li>
                <li className="flex items-start gap-2"><X className="h-4 w-4 text-red-500 shrink-0 mt-0.5" /> No central source of truth</li>
                <li className="flex items-start gap-2"><X className="h-4 w-4 text-red-500 shrink-0 mt-0.5" /> Endless back and forth</li>
              </ul>
            </div>

            {/* After - Voyance */}
            <div className="bg-accent/5 rounded-xl border border-accent/20 p-6">
              <span className="text-xs font-medium text-accent uppercase tracking-wider">After</span>
              <h3 className="font-semibold text-lg mt-2 mb-4">Voyance Clarity</h3>
              
              <div className="bg-white dark:bg-background rounded-lg p-4 mb-4 border border-accent/20">
                <div className="flex gap-2 mb-3 text-xs">
                  <span className="px-2 py-0.5 rounded bg-accent/10 text-accent">Bali</span>
                  <span className="px-2 py-0.5 rounded bg-secondary">+Main</span>
                  <span className="px-2 py-0.5 rounded bg-secondary">+Activities</span>
                </div>
                <div className="space-y-2">
                  <div className="h-2 bg-accent/20 rounded w-3/4" />
                  <div className="h-2 bg-accent/10 rounded w-1/2" />
                </div>
                <Button variant="accent" size="sm" className="mt-4 w-full">
                  View Itinerary
                </Button>
              </div>

              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2"><Check className="h-4 w-4 text-accent shrink-0 mt-0.5" /> One intelligent interface for your group</li>
                <li className="flex items-start gap-2"><Check className="h-4 w-4 text-accent shrink-0 mt-0.5" /> Real-time collaboration</li>
                <li className="flex items-start gap-2"><Check className="h-4 w-4 text-accent shrink-0 mt-0.5" /> Book everything with confidence</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-20 bg-secondary/30">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <span className="text-accent text-sm font-medium">The Solution</span>
            <h2 className="font-serif text-3xl md:text-4xl font-semibold mt-2">
              So We Rebuilt Travel Planning From First Principles.
            </h2>
            <p className="text-muted-foreground mt-4">
              One interface. One conversation. Every detail handled.
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-12 items-center max-w-5xl mx-auto">
            <div>
              <h3 className="font-semibold text-xl mb-6">Intelligence That Actually Understands</h3>
              
              <div className="space-y-6">
                {[
                  { label: 'Bulk Curation', desc: 'Not 3,000 options. The right 3 — precisely matched.' },
                  { label: 'One to One Design', desc: 'Your itinerary is a conversation, not a template.' },
                  { label: 'Actuary Model', desc: 'We plan for what might go wrong, so you don\'t have to.' },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-accent mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <img 
                src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80" 
                alt="Beach destination"
                className="rounded-xl shadow-medium"
              />
              <div className="absolute bottom-4 left-4 right-4 bg-background/90 backdrop-blur-sm rounded-lg p-3">
                <p className="text-sm font-medium">✨ I have a unique trip...</p>
                <p className="text-xs text-muted-foreground">Tell us more about what you're looking for.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Who We Serve Section */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <span className="text-accent text-sm font-medium">Audience</span>
            <h2 className="font-serif text-3xl font-semibold mt-2">Who Voyance Is Built For</h2>
            <p className="text-muted-foreground mt-4">We serve those who value their time as much as their experiences.</p>
          </motion.div>

          <div className="max-w-4xl mx-auto space-y-6">
            {[
              {
                title: 'Luxury Seekers',
                desc: 'Those who value exceptional service and personalized attention over basic offerings.',
                image: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=400&q=80',
              },
              {
                title: 'Time-Conscious Professionals',
                desc: 'Who want to maximize experiences without spending weeks planning.',
                image: 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=400&q=80',
              },
            ].map((persona, idx) => (
              <div key={idx} className="flex items-center gap-6 bg-card rounded-xl border border-border p-4">
                <Check className="h-5 w-5 text-accent shrink-0" />
                <div className="flex-1">
                  <h4 className="font-semibold">{persona.title}</h4>
                  <p className="text-sm text-muted-foreground">{persona.desc}</p>
                </div>
                <img src={persona.image} alt={persona.title} className="w-24 h-16 rounded-lg object-cover hidden md:block" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-accent/5">
        <div className="container mx-auto px-6 text-center">
          <h2 className="font-serif text-3xl font-semibold mb-4">Ready to Experience the Difference?</h2>
          <p className="text-muted-foreground mb-8">Start planning your perfect trip with Voyance today.</p>
          <Link to="/trip/new">
            <Button variant="accent" size="xl">
              Start Your Journey
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>
    </MainLayout>
  );
}
