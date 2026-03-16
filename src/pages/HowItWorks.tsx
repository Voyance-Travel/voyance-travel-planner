import { useState, useCallback, useEffect } from 'react';
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
  type LucideIcon,
  ChevronLeft,
  ChevronRight,
  MapPin,
  MessageCircle,
  ClipboardPaste,
  Globe,
  Wallet,
  BookOpen,
  Compass
} from 'lucide-react';
import useEmblaCarousel from 'embla-carousel-react';
import { ARCHETYPE_NARRATIVES, CATEGORY_DESCRIPTIONS, type ArchetypeNarrative } from '@/data/archetypeNarratives';
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
import liveTripImage from '@/assets/howitworks-livetrip.jpg';
import communityImage from '@/assets/howitworks-community.jpg';

const promises = [
  { text: 'No credit card to explore', icon: Shield },
  { text: 'Real reviews, not paid placements', icon: Star },
  { text: "Book direct - we don't mark up prices", icon: DollarSign },
  { text: 'Your data stays yours', icon: Lock },
  { text: 'We learn travel-you, nothing else', icon: Dna },
  { text: 'Your trips are saved forever', icon: BookOpen },
  { text: 'Every rating makes your next trip better', icon: Star },
];

const ALL_ARCHETYPE_IDS = [
  'cultural_anthropologist', 'urban_nomad', 'wilderness_pioneer', 'digital_explorer',
  'social_butterfly', 'family_architect', 'romantic_curator', 'story_seeker', 'community_builder',
  'bucket_list_conqueror', 'adrenaline_architect', 'collection_curator', 'status_seeker',
  'zen_seeker', 'slow_traveler', 'beach_therapist', 'sanctuary_seeker', 'escape_artist', 'retreat_regular',
  'culinary_cartographer', 'luxury_luminary', 'art_aficionado', 'eco_ethicist', 'history_hunter',
  'gap_year_graduate', 'midlife_explorer', 'healing_journeyer', 'sabbatical_scholar', 'retirement_ranger',
];

function ArchetypeCarousel() {
  const allArchetypes = ALL_ARCHETYPE_IDS
    .map(id => ARCHETYPE_NARRATIVES[id])
    .filter(Boolean);

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: 'start', dragFree: true });
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
    return () => { emblaApi.off('select', onSelect); emblaApi.off('reInit', onSelect); };
  }, [emblaApi, onSelect]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: 0.1 }}
      className="relative mb-12"
    >
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex -ml-2">
          {allArchetypes.map((archetype, index) => (
            <div
              key={archetype.id}
              className="flex-[0_0_280px] sm:flex-[0_0_300px] min-w-0 px-2 transition-all duration-300"
              style={{ transform: index === selectedIndex ? 'translateY(-4px)' : 'translateY(0)' }}
            >
              <div className={`bg-card rounded-2xl border overflow-hidden transition-all duration-300 h-full ${index === selectedIndex ? 'border-primary/50 shadow-elevated ring-1 ring-primary/20' : 'border-border hover:shadow-lg hover:border-primary/30 hover:-translate-y-1'}`}>
                <div className={`h-1.5 bg-gradient-to-r ${index === selectedIndex ? 'from-primary via-accent to-primary' : 'from-primary/60 via-primary to-primary/60'}`} />
                <div className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">{archetype.emoji}</span>
                    <div>
                      <h3 className="font-serif font-bold text-base text-foreground">{archetype.name}</h3>
                      <span className="text-xs text-primary font-medium">
                        {CATEGORY_DESCRIPTIONS[archetype.category]?.name}
                      </span>
                    </div>
                  </div>
                  <p className="text-foreground/80 italic text-sm mb-2 leading-relaxed line-clamp-2">
                    "{archetype.hookLine}"
                  </p>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {archetype.coreDescription}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={() => emblaApi?.scrollPrev()}
        disabled={!canScrollPrev}
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 z-10 w-10 h-10 rounded-full bg-card border border-border shadow-md flex items-center justify-center text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Previous types"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        onClick={() => emblaApi?.scrollNext()}
        disabled={!canScrollNext}
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 z-10 w-10 h-10 rounded-full bg-card border border-border shadow-md flex items-center justify-center text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Next types"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent pointer-events-none z-[5]" />
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none z-[5]" />
    </motion.div>
  );
}

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
      <section id="journey" className="py-16 md:py-32 relative">
        <div className="max-w-6xl mx-auto px-4">
          {/* Chapter 1 */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center mb-16 md:mb-32"
          >
            <div>
              <span className="text-4xl md:text-8xl font-serif font-bold text-primary/10">01</span>
              <h2 className="text-xl md:text-4xl font-serif font-bold text-foreground -mt-4 md:-mt-8 mb-3 md:mb-6">
                Tell us who you are
              </h2>
              <p className="text-sm md:text-lg text-muted-foreground leading-relaxed mb-3 md:mb-6">
                Not what you want to see – who you are. Our quiz measures 8 core traits: 
                how you plan, how you recharge, what thrills you, what bores you.
              </p>
              <p className="hidden md:block text-lg text-muted-foreground leading-relaxed">
                In 5 minutes, we identify your type from 29 distinct traveler types. 
                Not a horoscope. A blueprint.
              </p>
              <div className="mt-4 md:mt-8 flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm text-muted-foreground">
                <span className="px-2 md:px-3 py-1 bg-muted rounded-full">5 minutes</span>
                <span className="px-2 md:px-3 py-1 bg-muted rounded-full">29 types</span>
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-2 md:-inset-4 bg-gradient-to-br from-primary/20 to-accent/20 rounded-2xl md:rounded-3xl blur-xl md:blur-2xl" />
              <img 
                src={quizImage}
                alt="Taking the travel quiz"
                className="relative rounded-xl md:rounded-2xl shadow-xl md:shadow-2xl w-full aspect-square md:aspect-[4/3] object-cover"
              />
            </div>
          </motion.div>

          {/* Chapter 2 */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-start mb-16 md:mb-32"
          >
            <div className="relative md:order-1 order-2">
              <div className="absolute -inset-2 md:-inset-4 bg-gradient-to-br from-accent/20 to-primary/20 rounded-2xl md:rounded-3xl blur-xl md:blur-2xl" />
              <img 
                src={planImage}
                alt="Multiple ways to plan your trip"
                className="relative rounded-xl md:rounded-2xl shadow-xl md:shadow-2xl w-full aspect-square md:aspect-[4/3] object-cover"
              />
            </div>
            <div className="md:order-2 order-1">
              <span className="text-4xl md:text-8xl font-serif font-bold text-primary/10">02</span>
              <h2 className="text-xl md:text-4xl font-serif font-bold text-foreground -mt-4 md:-mt-8 mb-3 md:mb-6">
                Start your way
              </h2>
              <p className="text-sm md:text-lg text-muted-foreground leading-relaxed mb-4 md:mb-8">
                Four ways to begin – pick the one that matches how you think.
              </p>

              {/* Compact cards on mobile, full cards on desktop */}
              <div className="space-y-2 md:space-y-4">
                {[
                  { icon: MapPin, title: 'Pick a City', desc: 'Choose destination, dates, budget – we build the itinerary.' },
                  { icon: Globe, title: 'Multi-City', desc: 'Plan a multi-stop trip with smart day allocation.' },
                  { icon: MessageCircle, title: 'Just Tell Us', desc: 'Describe your dream trip – AI extracts the details.' },
                  { icon: ClipboardPaste, title: 'Build It Yourself', desc: 'Paste an existing itinerary – we parse and enhance it.' },
                ].map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="flex items-start gap-2 md:gap-4 p-2 md:p-4 rounded-lg md:rounded-xl bg-muted/50 border border-border">
                    <div className="w-7 h-7 md:w-10 md:h-10 rounded-md md:rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="h-3.5 w-3.5 md:h-5 md:w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-foreground text-sm md:text-base">{title}</h4>
                      <p className="text-xs md:text-sm text-muted-foreground leading-snug line-clamp-2">
                        {desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Chapter 3 */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center"
          >
            <div>
              <span className="text-4xl md:text-8xl font-serif font-bold text-primary/10">03</span>
              <h2 className="text-xl md:text-4xl font-serif font-bold text-foreground -mt-4 md:-mt-8 mb-3 md:mb-6">
                Get your itinerary
              </h2>
              <p className="text-sm md:text-lg text-muted-foreground leading-relaxed mb-3 md:mb-6">
                Day-by-day. Hour-by-hour. Every activity timed to your pace, 
                every route optimized, every recommendation backed by real reviews.
              </p>
              <p className="hidden md:block text-lg text-muted-foreground leading-relaxed">
                Don't like something? Swap it. Love something? Lock it. 
                Want a different vibe? Regenerate the whole day.
              </p>
              <div className="mt-4 md:mt-8 grid grid-cols-3 gap-2 md:gap-4 text-center">
                <div className="p-2 md:p-4 bg-muted/50 rounded-lg md:rounded-xl">
                  <p className="text-lg md:text-2xl font-bold text-primary">Hours</p>
                  <p className="text-[10px] md:text-xs text-muted-foreground">saved</p>
                </div>
                <div className="p-2 md:p-4 bg-muted/50 rounded-lg md:rounded-xl">
                  <p className="text-lg md:text-2xl font-bold text-primary">Global</p>
                  <p className="text-[10px] md:text-xs text-muted-foreground">coverage</p>
                </div>
                <div className="p-2 md:p-4 bg-muted/50 rounded-lg md:rounded-xl">
                  <p className="text-lg md:text-2xl font-bold text-primary">Real</p>
                  <p className="text-[10px] md:text-xs text-muted-foreground">reviews</p>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-2 md:-inset-4 bg-gradient-to-br from-primary/20 to-accent/20 rounded-2xl md:rounded-3xl blur-xl md:blur-2xl" />
              <img 
                src={itineraryImage}
                alt="Your personalized itinerary"
                className="relative rounded-xl md:rounded-2xl shadow-xl md:shadow-2xl w-full aspect-square md:aspect-[4/3] object-cover"
              />
            </div>
          </motion.div>

          {/* Chapter 4 - Watch Your Budget */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center mt-16 md:mt-32 mb-16 md:mb-32"
          >
            <div className="relative md:order-1 order-2">
              <div className="absolute -inset-2 md:-inset-4 bg-gradient-to-br from-accent/20 to-primary/20 rounded-2xl md:rounded-3xl blur-xl md:blur-2xl" />
              <img 
                src={itineraryImage}
                alt="Real-time budget tracking for your trip"
                className="relative rounded-xl md:rounded-2xl shadow-xl md:shadow-2xl w-full aspect-square md:aspect-[4/3] object-cover"
              />
            </div>
            <div className="md:order-2 order-1">
              <span className="text-4xl md:text-8xl font-serif font-bold text-primary/10">04</span>
              <h2 className="text-xl md:text-4xl font-serif font-bold text-foreground -mt-4 md:-mt-8 mb-3 md:mb-6">
                Watch your budget
              </h2>
              <p className="text-sm md:text-lg text-muted-foreground leading-relaxed mb-3 md:mb-6">
                Every activity, every hotel, every meal – priced and totaled in real time. No more spreadsheets. No more surprises on the credit card. Your trip budget updates as you build, swap, and customize your itinerary. Set your limit, and Voyance keeps you on track without sacrificing the experiences that matter to you.
              </p>
              <div className="mt-4 md:mt-8 grid grid-cols-3 gap-2 md:gap-4 text-center">
                <div className="p-2 md:p-4 bg-muted/50 rounded-lg md:rounded-xl">
                  <p className="text-lg md:text-2xl font-bold text-primary">Real-time</p>
                  <p className="text-[10px] md:text-xs text-muted-foreground">totals</p>
                </div>
                <div className="p-2 md:p-4 bg-muted/50 rounded-lg md:rounded-xl">
                  <p className="text-lg md:text-2xl font-bold text-primary">Per-day</p>
                  <p className="text-[10px] md:text-xs text-muted-foreground">breakdown</p>
                </div>
                <div className="p-2 md:p-4 bg-muted/50 rounded-lg md:rounded-xl">
                  <p className="text-lg md:text-2xl font-bold text-primary">No surprises</p>
                  <p className="text-[10px] md:text-xs text-muted-foreground">guaranteed</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Chapter 5 - Live Your Trip */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center mb-16 md:mb-32"
          >
            <div>
              <span className="text-4xl md:text-8xl font-serif font-bold text-primary/10">05</span>
              <h2 className="text-xl md:text-4xl font-serif font-bold text-foreground -mt-4 md:-mt-8 mb-3 md:mb-6">
                Live your trip
              </h2>
              <p className="text-sm md:text-lg text-muted-foreground leading-relaxed mb-3 md:mb-6">
                Your itinerary becomes a day-by-day travel companion with a live map view of your entire trip. See every activity, restaurant, and experience plotted on an interactive map – where you're going, what's next, and how to get there. Get real-time directions, activity details, and local tips as you go. Want to swap an activity or change your pace? Your consultant adapts with you.
              </p>
              <div className="mt-4 md:mt-8 grid grid-cols-3 gap-2 md:gap-4 text-center">
                <div className="p-2 md:p-4 bg-muted/50 rounded-lg md:rounded-xl">
                  <p className="text-lg md:text-2xl font-bold text-primary">Live map</p>
                  <p className="text-[10px] md:text-xs text-muted-foreground">see your full trip</p>
                </div>
                <div className="p-2 md:p-4 bg-muted/50 rounded-lg md:rounded-xl">
                  <p className="text-lg md:text-2xl font-bold text-primary">Real-time</p>
                  <p className="text-[10px] md:text-xs text-muted-foreground">guidance</p>
                </div>
                <div className="p-2 md:p-4 bg-muted/50 rounded-lg md:rounded-xl">
                  <p className="text-lg md:text-2xl font-bold text-primary">On-the-fly</p>
                  <p className="text-[10px] md:text-xs text-muted-foreground">changes</p>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-2 md:-inset-4 bg-gradient-to-br from-primary/20 to-accent/20 rounded-2xl md:rounded-3xl blur-xl md:blur-2xl" />
              <img 
                src={liveTripImage}
                alt="Live map view of your trip"
                className="relative rounded-xl md:rounded-2xl shadow-xl md:shadow-2xl w-full aspect-square md:aspect-[4/3] object-cover"
              />
            </div>
          </motion.div>

          {/* Chapter 6 - Share Your Story */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center mb-16 md:mb-32"
          >
            <div className="relative md:order-1 order-2">
              <div className="absolute -inset-2 md:-inset-4 bg-gradient-to-br from-accent/20 to-primary/20 rounded-2xl md:rounded-3xl blur-xl md:blur-2xl" />
              <img 
                src={communityImage}
                alt="Sharing your travel story as a community guide"
                className="relative rounded-xl md:rounded-2xl shadow-xl md:shadow-2xl w-full aspect-square md:aspect-[4/3] object-cover"
              />
            </div>
            <div className="md:order-2 order-1">
              <span className="text-4xl md:text-8xl font-serif font-bold text-primary/10">06</span>
              <h2 className="text-xl md:text-4xl font-serif font-bold text-foreground -mt-4 md:-mt-8 mb-3 md:mb-6">
                Share your story
              </h2>
              <p className="text-sm md:text-lg text-muted-foreground leading-relaxed mb-3 md:mb-6">
                After your trip, it lives on. View your past trips anytime – every itinerary, every restaurant, every detail saved and organized. Rate the activities you did, share your photos and tips, and turn your experience into a community guide that helps fellow travelers discover what you loved. Your ratings don't just help others – they teach Voyance what you love so your next trip is even better.
              </p>
              <div className="mt-4 md:mt-8 grid grid-cols-3 gap-2 md:gap-4 text-center">
                <div className="p-2 md:p-4 bg-muted/50 rounded-lg md:rounded-xl">
                  <p className="text-lg md:text-2xl font-bold text-primary">Past trips</p>
                  <p className="text-[10px] md:text-xs text-muted-foreground">saved forever</p>
                </div>
                <div className="p-2 md:p-4 bg-muted/50 rounded-lg md:rounded-xl">
                  <p className="text-lg md:text-2xl font-bold text-primary">Community</p>
                  <p className="text-[10px] md:text-xs text-muted-foreground">guides</p>
                </div>
                <div className="p-2 md:p-4 bg-muted/50 rounded-lg md:rounded-xl">
                  <p className="text-lg md:text-2xl font-bold text-primary">Your ratings</p>
                  <p className="text-[10px] md:text-xs text-muted-foreground">make us smarter</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Chapter 7 - We Only Know Travel-You */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center"
          >
            <div>
              <span className="text-4xl md:text-8xl font-serif font-bold text-primary/10">07</span>
              <h2 className="text-xl md:text-4xl font-serif font-bold text-foreground -mt-4 md:-mt-8 mb-3 md:mb-6">
                We only know travel-you
              </h2>
              <p className="text-sm md:text-lg text-muted-foreground leading-relaxed mb-3 md:mb-6">
                This is important. Voyance doesn't try to be everything. We're not tracking your work schedule, your grocery list, or your morning routine. We know one thing: how you travel. Your Travel DNA is dedicated entirely to understanding you as a traveler – what excites you, what drains you, how you recharge, and what makes a trip feel like it was made for you.
              </p>
              <p className="hidden md:block text-lg text-muted-foreground leading-relaxed">
                That separation is the point. We're not a general AI trying to guess what you want. We're a travel-specific AI that remembers exactly who you are every time you come back. Tell us once. We lock it in. And we only get better.
              </p>
              <div className="mt-4 md:mt-8 grid grid-cols-3 gap-2 md:gap-4 text-center">
                <div className="p-2 md:p-4 bg-muted/50 rounded-lg md:rounded-xl">
                  <p className="text-lg md:text-2xl font-bold text-primary">Travel-only</p>
                  <p className="text-[10px] md:text-xs text-muted-foreground">DNA</p>
                </div>
                <div className="p-2 md:p-4 bg-muted/50 rounded-lg md:rounded-xl">
                  <p className="text-lg md:text-2xl font-bold text-primary">Tell us once</p>
                  <p className="text-[10px] md:text-xs text-muted-foreground">we remember</p>
                </div>
                <div className="p-2 md:p-4 bg-muted/50 rounded-lg md:rounded-xl">
                  <p className="text-lg md:text-2xl font-bold text-primary">Always</p>
                  <p className="text-[10px] md:text-xs text-muted-foreground">improving</p>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-2 md:-inset-4 bg-gradient-to-br from-primary/20 to-accent/20 rounded-2xl md:rounded-3xl blur-xl md:blur-2xl" />
              <img 
                src={quizImage}
                alt="Travel DNA - we only know the traveler in you"
                className="relative rounded-xl md:rounded-2xl shadow-xl md:shadow-2xl w-full aspect-square md:aspect-[4/3] object-cover"
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
              29 traveler types
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Every trip is shaped by who you are. Discover your type and see how 
              it transforms every recommendation.
            </p>
          </motion.div>

          <ArchetypeCarousel />

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
                Explore all 29 types
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
              9 interactive steps showing how we build your perfect trip
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
              <span>Free to start. Takes 5 minutes</span>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </MainLayout>
  );
}