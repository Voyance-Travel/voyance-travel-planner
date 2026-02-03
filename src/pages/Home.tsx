import { useEffect, useState, useRef } from 'react';
import TopNav from '@/components/common/TopNav';
import Footer from '@/components/common/Footer';
import Head from '@/components/common/Head';
import ScrollTarget from '@/components/common/ScrollTarget';
import ValueFirstHero from '@/components/home/ValueFirstHero';
import TheProblemSection from '@/components/home/TheProblemSection';
import TheInsightSection from '@/components/home/TheInsightSection';
import SampleArchetype from '@/components/home/SampleArchetype';
import CustomizationShowcase from '@/components/home/CustomizationShowcase';
import ItineraryShowcase from '@/components/home/ItineraryShowcase';
import SocialProofSection from '@/components/home/SocialProofSection';
import FinalCTA from '@/components/home/FinalCTA';
import { OnboardingRedirect } from '@/components/auth/OnboardingRedirect';
import { OrganizationSchema, WebSiteSchema, TravelAgencySchema } from '@/components/seo/StructuredData';
import { scrollToTop } from '@/utils/scrollUtils';
import { DemoHero } from '@/components/demo/DemoHero';
import { DemoFeatureShowcase } from '@/components/demo/DemoFeatureShowcase';
import { DemoArchetypeComparison } from '@/components/demo/DemoArchetypeComparison';
import { DemoGroupBlend } from '@/components/demo/DemoGroupBlend';
import { DemoPlayground } from '@/components/demo/DemoPlayground';

export default function Home() {
  const [showTour, setShowTour] = useState(false);
  const playgroundRef = useRef<HTMLDivElement>(null);
  const comparisonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToTop();
    document.documentElement.style.scrollPaddingTop = '80px';

    return () => {
      document.documentElement.style.scrollPaddingTop = '';
    };
  }, []);

  const handleStartTour = () => {
    setShowTour(true);
  };

  const handleTourComplete = () => {
    setShowTour(false);
    comparisonRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSkipToPlayground = () => {
    playgroundRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <main className="antialiased">
      <Head 
        title="Voyance | AI-Powered Travel Planning - Personalized Itineraries"
        description="Plan your dream trip with Voyance. Our AI creates personalized travel itineraries based on your unique travel style. Discover hidden gems, avoid crowds, and travel smarter."
        canonical="https://travelwithvoyance.com/"
      />
      <OrganizationSchema />
      <WebSiteSchema />
      <TravelAgencySchema />
      <OnboardingRedirect />
      <TopNav />
      
      <div className="bg-background overflow-hidden">
        {/* Hero - Destination Search Only */}
        <ValueFirstHero />
        
        {/* Demo Hero Section */}
        <div id="demo-hero">
          {!showTour && (
            <DemoHero 
              onStartTour={handleStartTour} 
              onSkipToPlayground={handleSkipToPlayground}
            />
          )}
          {showTour && (
            <DemoFeatureShowcase onComplete={handleTourComplete} />
          )}
        </div>

        {/* Archetype Comparison - Prove personalization works */}
        <div id="archetype-comparison" ref={comparisonRef}>
          <DemoArchetypeComparison />
        </div>

        {/* Group Travel Blending Demo */}
        <div id="group-blend">
          <DemoGroupBlend />
        </div>

        {/* Interactive playground */}
        <div id="playground" ref={playgroundRef}>
          <DemoPlayground />
        </div>
        
        {/* The Problem - Emotional resonance */}
        <TheProblemSection />
        
        {/* The Insight - You're not generic */}
        <TheInsightSection />
        
        {/* Sample Archetype - Travel DNA proof */}
        <SampleArchetype />
        
        {/* Customization Showcase - Post-generation power */}
        <CustomizationShowcase />
        
        {/* Curated Journeys - Real output examples */}
        <ScrollTarget id="preview-section" className="scroll-mt-16">
          <ItineraryShowcase />
        </ScrollTarget>
        
        {/* Social Proof - Honest trust signals */}
        <SocialProofSection />
        
        {/* Final CTA - Still scrolling? */}
        <ScrollTarget id="cta-section" className="scroll-mt-16">
          <FinalCTA />
        </ScrollTarget>
      </div>
      
      <Footer />
    </main>
  );
}
