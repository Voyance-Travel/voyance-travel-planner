import { useEffect, useRef, useState } from 'react';
import TopNav from '@/components/common/TopNav';
import Footer from '@/components/common/Footer';
import Head from '@/components/common/Head';
import ScrollTarget from '@/components/common/ScrollTarget';
import ValueFirstHero from '@/components/home/ValueFirstHero';

import TheProblemSection from '@/components/home/TheProblemSection';
import PersonalizationProof from '@/components/home/PersonalizationProof';
import TheInsightSection from '@/components/home/TheInsightSection';
import SampleArchetype from '@/components/home/SampleArchetype';
import CustomizationShowcase from '@/components/home/CustomizationShowcase';
import ItineraryShowcase from '@/components/home/ItineraryShowcase';
import SocialProofSection from '@/components/home/SocialProofSection';
import FinalCTA from '@/components/home/FinalCTA';
import FreeTierSection from '@/components/home/FreeTierSection';
import MobileAccordionSection from '@/components/home/MobileAccordionSection';
import StickyMobileCTA from '@/components/home/StickyMobileCTA';
import { OnboardingRedirect } from '@/components/auth/OnboardingRedirect';
import { OrganizationSchema, WebSiteSchema, TravelAgencySchema } from '@/components/seo/StructuredData';
import { scrollToTop } from '@/utils/scrollUtils';

// Sections that collapse into accordions on mobile (detail/reference content)
const COLLAPSIBLE_SECTIONS = [
  { key: 'insight', title: 'Your Travel Identity', teaser: "You're not generic. Your trip shouldn't be either" },
  { key: 'archetypes', title: 'Your Travel DNA', teaser: 'Explore 29 unique traveler archetypes' },
  { key: 'itineraries', title: 'Sample Itineraries', teaser: 'Real trip plans with intelligence metrics' },
  { key: 'social', title: 'What Travelers Say', teaser: 'Beta tester quotes and platform intelligence' },
  { key: 'pricing', title: 'Pricing & Credits', teaser: '150 free credits monthly. No credit card required' },
] as const;

export default function Home() {
  const demoRef = useRef<HTMLDivElement>(null);
  const [openSection, setOpenSection] = useState<string | null>(null);

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

  const handleToggle = (key: string) => {
    setOpenSection(prev => (prev === key ? null : key));
  };

  const renderCollapsible = (key: string, children: React.ReactNode) => {
    const section = COLLAPSIBLE_SECTIONS.find(s => s.key === key)!;
    return (
      <MobileAccordionSection
        key={key}
        id={`section-${key}`}
        title={section.title}
        teaser={section.teaser}
        isOpen={openSection === key}
        onToggle={() => handleToggle(key)}
      >
        {children}
      </MobileAccordionSection>
    );
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
        {/* Hero — big, beautiful, immersive */}
        <ValueFirstHero onScrollToDemo={handleScrollToDemo} />
        
        {/* ═══ OPEN SECTIONS: Always visible on mobile ═══ */}
        
        {/* Section 1: The Planning Problem — emotional hook */}
        <div className="py-8 md:py-0">
          <TheProblemSection />
        </div>
        
        {/* Divider */}
        <div className="h-px bg-border/50 mx-6 md:hidden" />
        
        {/* Section 2: Same City, Different Journey — proof point */}
        <div className="py-8 md:py-0">
          <PersonalizationProof />
        </div>
        
        {/* Divider */}
        <div className="h-px bg-border/50 mx-6 md:hidden" />
        
        {/* Section 3: Your Travel DNA — identity */}
        <div className="py-8 md:py-0">
          <TheInsightSection />
        </div>
        
        {/* Divider */}
        <div className="h-px bg-border/50 mx-6 md:hidden" />
        
        {/* Section 4: Full Control, Your Way — reassurance */}
        <div className="py-8 md:py-0">
          <CustomizationShowcase />
        </div>
        
        {/* ═══ COLLAPSIBLE SECTIONS: Accordions on mobile ═══ */}
        <div className="md:hidden h-8" /> {/* Spacer before accordions */}
        
        {renderCollapsible('archetypes', <SampleArchetype />)}
        
        {renderCollapsible('itineraries',
          <ScrollTarget id="demo-section" className="scroll-mt-16">
            <div ref={demoRef}>
              <ItineraryShowcase />
            </div>
          </ScrollTarget>
        )}
        
        <ScrollTarget id="why-we-built" className="scroll-mt-16">
          {renderCollapsible('social', <SocialProofSection />)}
        </ScrollTarget>
        {renderCollapsible('pricing', <FreeTierSection />)}
        
        {/* Final CTA — always visible */}
        <ScrollTarget id="cta-section" className="scroll-mt-16">
          <FinalCTA />
        </ScrollTarget>
      </div>

      {/* Sticky bottom CTA on mobile */}
      <StickyMobileCTA />
      
      <Footer />
    </main>
  );
}
