import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { motion } from 'framer-motion';
import { 
  ArrowRight, 
  Sparkles,
  Eye,
  CheckCircle,
  Shield,
  Star,
  DollarSign,
  Lock,
  Dna,
  Leaf,
  Zap,
  Palette,
  Play,
  type LucideIcon
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';
import { DemoPlayground } from '@/components/demo/DemoPlayground';
import { DemoArchetypeComparison } from '@/components/demo/DemoArchetypeComparison';
import { DemoGroupBlend } from '@/components/demo/DemoGroupBlend';
import { DemoFeatureShowcase } from '@/components/demo/DemoFeatureShowcase';
import { HowItWorksSideNav } from '@/components/home/HowItWorksSideNav';

// Import generated images
import heroImage from '@/assets/howitworks-hero.jpg';
import quizImage from '@/assets/howitworks-quiz.jpg';
import planImage from '@/assets/howitworks-plan.jpg';
import itineraryImage from '@/assets/howitworks-itinerary.jpg';

const promises = [
  { text: 'No credit card to explore', icon: Shield },
  { text: 'Real reviews, not paid placements', icon: Star },
  { text: "Book direct - we don't mark up prices", icon: DollarSign },
  { text: 'Your data stays yours', icon: Lock },
];

export default function HowItWorks() {
  const [showFeatureTour, setShowFeatureTour] = useState(false);

  return (
    <MainLayout>
      <Head
        title="How It Works | Voyance"
        description="From quiz to itinerary in minutes. See how Voyance builds personalized day-by-day travel plans."
        canonical="https://travelwithvoyance.com/how-it-works"
      />

      {/* Side Navigation */}
      <HowItWorksSideNav />
      
      {/* Hero */}
      <section id="hero" className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img 
            src={heroImage}
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background" />
        </div>
        
        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center py-32">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm uppercase tracking-[0.3em] text-primary font-medium mb-6"
          >
            The Voyance Method
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl lg:text-7xl font-serif font-bold text-foreground mb-8 leading-[1.1]"
          >
            From who you are<br />
            <span className="text-primary">to where you'll go</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed"
          >
            A 5-minute quiz. Your travel personality. 
            A day-by-day itinerary built just for you.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Button asChild size="lg" className="text-lg px-8 h-14">
              <Link to={ROUTES.QUIZ}>
                Take the Quiz
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="text-lg px-8 h-14 bg-background/50 backdrop-blur-sm">
              <Link to={ROUTES.DEMO}>
                <Eye className="mr-2 h-5 w-5" />
                See a Demo
              </Link>
            </Button>
          </motion.div>
        </div>
        
      </section>

      {/* The Journey */}
      <section id="journey" className="py-32 relative">
        <div className="max-w-6xl mx-auto px-4">
          {/* Chapter 1 */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="grid lg:grid-cols-2 gap-16 items-center mb-32"
          >
            <div>
              <span className="text-8xl font-serif font-bold text-primary/10">01</span>
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground -mt-8 mb-6">
                Tell us who you are
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                Not what you want to see - who you are. Our quiz measures 8 core traits: 
                how you plan, how you recharge, what thrills you, what bores you.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed">
                In 5 minutes, we identify your archetype from 27 distinct traveler personalities. 
                Not a horoscope. A blueprint.
              </p>
              <div className="mt-8 flex items-center gap-4 text-sm text-muted-foreground">
                <span className="px-3 py-1 bg-muted rounded-full">We remember forever</span>
                <span className="px-3 py-1 bg-muted rounded-full">5 minutes</span>
                <span className="px-3 py-1 bg-muted rounded-full">27 archetypes</span>
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-br from-primary/20 to-accent/20 rounded-3xl blur-2xl" />
              <img 
                src={quizImage}
                alt="Taking the travel quiz"
                className="relative rounded-2xl shadow-2xl w-full aspect-[4/3] object-cover"
              />
            </div>
          </motion.div>

          {/* Chapter 2 */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="grid lg:grid-cols-2 gap-16 items-center mb-32"
          >
            <div className="lg:order-2">
              <span className="text-8xl font-serif font-bold text-primary/10">02</span>
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground -mt-8 mb-6">
                Tell us your trip
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                Where you're going. When you arrive. Where you're staying. 
                We need the constraints to build the canvas.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Your flight lands at 2pm? We'll schedule accordingly. 
                Hotel in the old town? We'll cluster activities nearby. 
                Every detail shapes your days.
              </p>
            </div>
            <div className="relative lg:order-1">
              <div className="absolute -inset-4 bg-gradient-to-br from-accent/20 to-primary/20 rounded-3xl blur-2xl" />
              <img 
                src={planImage}
                alt="Planning your destination"
                className="relative rounded-2xl shadow-2xl w-full aspect-[4/3] object-cover"
              />
            </div>
          </motion.div>

          {/* Chapter 3 */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="grid lg:grid-cols-2 gap-16 items-center"
          >
            <div>
              <span className="text-8xl font-serif font-bold text-primary/10">03</span>
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground -mt-8 mb-6">
                Get your itinerary
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                Day-by-day. Hour-by-hour. Every activity timed to your pace, 
                every route optimized to save you walking, every recommendation 
                backed by real reviews.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Don't like something? Swap it. Love something? Lock it. 
                Want a different vibe? Regenerate the whole day. 
                It's your trip. We just built the first draft.
              </p>
              <div className="mt-8 grid grid-cols-3 gap-4 text-center">
                <div className="p-4 bg-muted/50 rounded-xl">
                  <p className="text-2xl font-bold text-primary">30-45</p>
                  <p className="text-xs text-muted-foreground">min saved daily</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-xl">
                  <p className="text-2xl font-bold text-primary">2,200+</p>
                  <p className="text-xs text-muted-foreground">destinations</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-xl">
                  <p className="text-2xl font-bold text-primary">Real</p>
                  <p className="text-xs text-muted-foreground">reviews only</p>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-br from-primary/20 to-accent/20 rounded-3xl blur-2xl" />
              <img 
                src={itineraryImage}
                alt="Your personalized itinerary"
                className="relative rounded-2xl shadow-2xl w-full aspect-[4/3] object-cover"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Travel DNA Section */}
      <section id="travel-dna" className="py-24 bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <div className="max-w-5xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full text-sm text-primary font-medium mb-6">
              <Dna className="h-4 w-4" />
              Travel DNA
            </div>
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4">
              27 traveler personalities
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Every trip is shaped by who you are. Discover your archetype and see how 
              it transforms every recommendation.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="grid md:grid-cols-3 gap-6 mb-12"
          >
            {([
              { name: 'The Slow Traveler', desc: 'Savors every moment, never rushes', Icon: Leaf },
              { name: 'The Adrenaline Architect', desc: 'Plans adventures others dream about', Icon: Zap },
              { name: 'The Cultural Curator', desc: 'Seeks authentic, local experiences', Icon: Palette },
            ] as { name: string; desc: string; Icon: LucideIcon }[]).map((archetype, idx) => (
              <motion.div
                key={archetype.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="bg-card border border-border/50 rounded-xl p-8 text-center hover:border-primary/30 hover:shadow-md transition-all"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
                  <archetype.Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{archetype.name}</h3>
                <p className="text-sm text-muted-foreground">{archetype.desc}</p>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-center"
          >
            <Button asChild size="lg" variant="outline" className="gap-2">
              <Link to={ROUTES.ARCHETYPES}>
                <Sparkles className="h-4 w-4" />
                Explore all 27 archetypes
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Divider with quote */}
      <section className="py-20 bg-muted/30 border-y border-border">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.blockquote
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-2xl md:text-3xl font-serif italic text-foreground/80 leading-relaxed"
          >
            "The same destination transforms completely based on who's traveling."
          </motion.blockquote>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-6 text-muted-foreground"
          >
            See it for yourself below ↓
          </motion.p>
        </div>
      </section>

      {/* Feature Tour (Interactive) */}
      {showFeatureTour && (
        <div id="feature-tour">
          <DemoFeatureShowcase onComplete={() => setShowFeatureTour(false)} />
        </div>
      )}

      {/* Start Feature Tour Button */}
      {!showFeatureTour && (
        <section className="py-12 bg-muted/30 border-y border-border">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <Button
              onClick={() => setShowFeatureTour(true)}
              size="lg"
              className="gap-2"
            >
              <Play className="h-5 w-5" />
              Take the Feature Tour
            </Button>
            <p className="text-sm text-muted-foreground mt-3">
              7 interactive steps showing how we build your perfect trip
            </p>
          </div>
        </section>
      )}

      {/* Archetype Comparison */}
      <div id="archetype-comparison">
        <DemoArchetypeComparison />
      </div>

      {/* Group Travel Blending */}
      <div id="group-blend">
        <DemoGroupBlend />
      </div>

      {/* Interactive Playground */}
      <div id="playground">
        <DemoPlayground />
      </div>

      {/* Our Promise */}
      <section id="promise" className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent" />
        
        <div className="max-w-4xl mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-white mb-4">
              Our Promise
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {promises.map((promise, index) => (
              <motion.div
                key={promise.text}
                initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-5 py-4"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <promise.icon className="w-4 h-4 text-primary" />
                </div>
                <span className="text-white/90 text-sm font-medium">{promise.text}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="cta" className="py-32 bg-gradient-to-b from-background to-muted/30">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground mb-4">
              Ready?
            </p>
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-6">
              See your itinerary come to life
            </h2>
            <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
              Take the quiz. Tell us your trip. Watch your days take shape.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="text-lg px-10 h-14">
                <Link to={ROUTES.QUIZ}>
                  Build My Itinerary
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="text-lg px-10 h-14">
                <Link to={ROUTES.DEMO}>Explore the Demo</Link>
              </Button>
            </div>
            
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="mt-10 flex items-center justify-center gap-2 text-sm text-muted-foreground"
            >
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span>No account required to start</span>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </MainLayout>
  );
}