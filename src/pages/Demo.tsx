import { useState, useRef } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { DemoHero } from '@/components/demo/DemoHero';
import { DemoFeatureShowcase } from '@/components/demo/DemoFeatureShowcase';
import { DemoPlayground } from '@/components/demo/DemoPlayground';
import { DemoCTA } from '@/components/demo/DemoCTA';

export default function Demo() {
  const [showTour, setShowTour] = useState(false);
  const playgroundRef = useRef<HTMLDivElement>(null);

  const handleStartTour = () => {
    setShowTour(true);
  };

  const handleTourComplete = () => {
    setShowTour(false);
    // Scroll to playground
    playgroundRef.current?.scrollIntoView({ behavior: 'smooth' });
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

      {/* Hero - Clear entry point */}
      {!showTour && (
        <DemoHero 
          onStartTour={handleStartTour} 
          onSkipToPlayground={handleSkipToPlayground}
        />
      )}

      {/* Feature showcase - Step by step tour */}
      {showTour && (
        <DemoFeatureShowcase onComplete={handleTourComplete} />
      )}

      {/* Interactive playground */}
      <div ref={playgroundRef}>
        <DemoPlayground />
      </div>

      {/* Final CTA */}
      <DemoCTA />
    </MainLayout>
  );
}
