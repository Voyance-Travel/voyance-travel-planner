import { useState, useRef } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { DemoHero } from '@/components/demo/DemoHero';
import { DemoFeatureShowcase } from '@/components/demo/DemoFeatureShowcase';
import { DemoPlayground } from '@/components/demo/DemoPlayground';
import { DemoArchetypeComparison } from '@/components/demo/DemoArchetypeComparison';
import { DemoGroupBlend } from '@/components/demo/DemoGroupBlend';
import { DemoCTA } from '@/components/demo/DemoCTA';
import { DemoSideNav } from '@/components/demo/DemoSideNav';

export default function Demo() {
  const [showTour, setShowTour] = useState(false);
  const playgroundRef = useRef<HTMLDivElement>(null);
  const comparisonRef = useRef<HTMLDivElement>(null);

  const handleStartTour = () => {
    setShowTour(true);
  };

  const handleTourComplete = () => {
    setShowTour(false);
    // Scroll to comparison section first
    comparisonRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSkipToPlayground = () => {
    playgroundRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <MainLayout>
      <Head 
        title="Demo | Voyance"
        description="Experience Voyance's AI-powered trip planning. See how we build personalized itineraries in minutes. Free interactive demo."
      />

      {/* Side Navigation */}
      <DemoSideNav showTour={showTour} />

      {/* Hero - Clear entry point */}
      <div id="hero">
        {!showTour && (
          <DemoHero 
            onStartTour={handleStartTour} 
            onSkipToPlayground={handleSkipToPlayground}
          />
        )}

        {/* Feature showcase - Step by step tour */}
        {showTour && (
          <DemoFeatureShowcase onComplete={handleTourComplete} onSkipToPlayground={handleSkipToPlayground} />
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

      {/* Final CTA */}
      <div id="cta">
        <DemoCTA />
      </div>
    </MainLayout>
  );
}
