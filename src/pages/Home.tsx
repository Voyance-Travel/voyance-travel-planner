import { useEffect, useRef } from 'react';
import TopNav from '@/components/common/TopNav';
import Footer from '@/components/common/Footer';
import Head from '@/components/common/Head';
import ScrollTarget from '@/components/common/ScrollTarget';
import ValueFirstHero from '@/components/home/ValueFirstHero';
import QuizBanner from '@/components/home/QuizBanner';
import TheProblemSection from '@/components/home/TheProblemSection';
import PersonalizationProof from '@/components/home/PersonalizationProof';
import TheInsightSection from '@/components/home/TheInsightSection';
import SampleArchetype from '@/components/home/SampleArchetype';
import CustomizationShowcase from '@/components/home/CustomizationShowcase';
import ItineraryShowcase from '@/components/home/ItineraryShowcase';
import SocialProofSection from '@/components/home/SocialProofSection';
import FinalCTA from '@/components/home/FinalCTA';
import FreeTierSection from '@/components/home/FreeTierSection';
import { OnboardingRedirect } from '@/components/auth/OnboardingRedirect';
import { OrganizationSchema, WebSiteSchema, TravelAgencySchema } from '@/components/seo/StructuredData';
import { scrollToTop } from '@/utils/scrollUtils';

export default function Home() {
  const demoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToTop();
    document.documentElement.style.scrollPaddingTop = '80px';

    return () => {
      document.documentElement.style.scrollPaddingTop = '';
    };
  }, []);

  const handleScrollToDemo = () => {
    demoRef.current?.scrollIntoView({ behavior: 'smooth' });
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
        {/* Hero - Destination Search + Demo CTA */}
        <ValueFirstHero onScrollToDemo={handleScrollToDemo} />
        
        {/* Quiz Banner - Unmissable CTA right after hero */}
        <QuizBanner />
        
        {/* The Problem - Emotional resonance */}
        <TheProblemSection />
        
        {/* Personalization Proof - Same city, different journeys */}
        <PersonalizationProof />
        
        {/* Sample Archetype - Travel DNA proof */}
        <SampleArchetype />
        
        {/* Customization Showcase - Post-generation power */}
        <CustomizationShowcase />
        
        {/* Featured Journeys - Sample itineraries */}
        <ScrollTarget id="demo-section" className="scroll-mt-16">
          <div ref={demoRef}>
            <ItineraryShowcase />
          </div>
        </ScrollTarget>
        
        {/* Social Proof - Honest trust signals */}
        <SocialProofSection />
        
        {/* Free Tier Visibility - Growth engine */}
        <FreeTierSection />
        
        {/* Final CTA - Still scrolling? */}
        <ScrollTarget id="cta-section" className="scroll-mt-16">
          <FinalCTA />
        </ScrollTarget>
      </div>
      
      <Footer />
    </main>
  );
}