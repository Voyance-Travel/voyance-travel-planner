import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TopNav from '@/components/common/TopNav';
import Footer from '@/components/common/Footer';
import ScrollTarget from '@/components/common/ScrollTarget';
import TravelDNAHero from '@/components/home/TravelDNAHero';
import SampleArchetype from '@/components/home/SampleArchetype';
import DNAHowItWorks from '@/components/home/DNAHowItWorks';
import WhatVoyanceDoes from '@/components/home/WhatVoyanceDoes';
import ItineraryShowcase from '@/components/home/ItineraryShowcase';
import TravelQuote from '@/components/home/TravelQuote';
import FinalCTA from '@/components/home/FinalCTA';
import { OnboardingRedirect } from '@/components/auth/OnboardingRedirect';
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
    <main className="antialiased relative">
      <OnboardingRedirect />
      <TopNav />
      <div className="bg-background overflow-hidden relative">
        <TravelDNAHero />
        <SampleArchetype />
        <ScrollTarget id="features-section" className="scroll-mt-16">
          <DNAHowItWorks />
        </ScrollTarget>
        <WhatVoyanceDoes />
        <ScrollTarget id="preview-section" className="scroll-mt-16">
          <ItineraryShowcase />
        </ScrollTarget>
        <ScrollTarget id="quote-section" className="scroll-mt-16">
          <TravelQuote />
        </ScrollTarget>
        <ScrollTarget id="cta-section" className="scroll-mt-16">
          <FinalCTA />
        </ScrollTarget>
      </div>
      <Footer />
    </main>
  );
}
