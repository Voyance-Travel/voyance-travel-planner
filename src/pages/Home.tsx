import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TopNav from '@/components/common/TopNav';
import Footer from '@/components/common/Footer';
import Head from '@/components/common/Head';
import ScrollTarget from '@/components/common/ScrollTarget';
import ValueFirstHero from '@/components/home/ValueFirstHero';
import TheProblemSection from '@/components/home/TheProblemSection';
import TheInsightSection from '@/components/home/TheInsightSection';
import SampleArchetype from '@/components/home/SampleArchetype';
import ItineraryShowcase from '@/components/home/ItineraryShowcase';
import FinalCTA from '@/components/home/FinalCTA';
import { OnboardingRedirect } from '@/components/auth/OnboardingRedirect';
import { OrganizationSchema, WebSiteSchema, TravelAgencySchema } from '@/components/seo/StructuredData';
import { scrollToTop } from '@/utils/scrollUtils';
import { ROUTES } from '@/config/routes';

const FIRST_VISIT_KEY = 'voyance_has_visited';

export default function Home() {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if this is first visit
    const hasVisited = localStorage.getItem(FIRST_VISIT_KEY);
    
    if (!hasVisited) {
      // Mark as visited and redirect to demo
      localStorage.setItem(FIRST_VISIT_KEY, 'true');
      navigate(ROUTES.DEMO, { replace: true });
      return;
    }

    scrollToTop();
    document.documentElement.style.scrollPaddingTop = '80px';

    return () => {
      document.documentElement.style.scrollPaddingTop = '';
    };
  }, [navigate]);

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
        
        {/* The Problem - Emotional resonance */}
        <TheProblemSection />
        
        {/* The Insight - You're not generic */}
        <TheInsightSection />
        
        {/* Sample Archetype - Travel DNA proof */}
        <SampleArchetype />
        
        {/* Curated Journeys - Real output examples */}
        <ScrollTarget id="preview-section" className="scroll-mt-16">
          <ItineraryShowcase />
        </ScrollTarget>
        
        {/* Final CTA - Still scrolling? */}
        <ScrollTarget id="cta-section" className="scroll-mt-16">
          <FinalCTA />
        </ScrollTarget>
      </div>
      
      <Footer />
    </main>
  );
}
