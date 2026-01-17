import { useEffect } from 'react';
import TopNav from '@/components/common/TopNav';
import Footer from '@/components/common/Footer';
import ScrollTarget from '@/components/common/ScrollTarget';
import CinematicHero from '@/components/home/CinematicHero';
import HowItWorksCarousel from '@/components/home/HowItWorksCarousel';
import ItineraryShowcase from '@/components/home/ItineraryShowcase';
import TravelQuote from '@/components/home/TravelQuote';
import FinalCTA from '@/components/home/FinalCTA';
import { scrollToTop } from '@/utils/scrollUtils';

export default function Home() {
  useEffect(() => {
    scrollToTop();
    document.documentElement.style.scrollPaddingTop = '80px';

    return () => {
      document.documentElement.style.scrollPaddingTop = '';
    };
  }, []);

  return (
    <main className="antialiased relative">
      <TopNav />
      <div className="bg-background overflow-hidden relative">
        <CinematicHero />
        <ScrollTarget id="features-section" className="scroll-mt-16">
          <HowItWorksCarousel />
        </ScrollTarget>
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
