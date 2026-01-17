import { useState, useRef, useEffect } from 'react';
import Head from '@/components/common/Head';
import TopNav from '@/components/common/TopNav';
import Footer from '@/components/common/Footer';
import ScrollTarget from '@/components/common/ScrollTarget';
import FilterPanel from '@/components/explore/FilterPanel';
import HeroSection from '@/components/explore/sections/HeroSection';
import SeasonalCollections from '@/components/explore/sections/SeasonalCollections';
import ExploreByStyle from '@/components/explore/sections/ExploreByStyle';
import TrendingDestinationsEnhanced from '@/components/explore/sections/TrendingDestinationsEnhanced';
import VoyanceGuides from '@/components/explore/sections/VoyanceGuides';
import { scrollToTop } from '@/utils/scrollUtils';

export default function Explore() {
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ 
    region: null as string | null, 
    budget: null as string | null, 
    vibe: null as string | null 
  });
  const destinationGridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToTop();
    document.documentElement.style.scrollPaddingTop = '80px';
    return () => {
      document.documentElement.style.scrollPaddingTop = '';
    };
  }, []);

  const handleBrowseClick = () => {
    destinationGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <main className="min-h-screen bg-background antialiased">
      <Head
        title="Explore Destinations | Voyance"
        description="Explore amazing destinations curated to your travel preferences. Discover places by travel style, season, and more."
      />
      <TopNav />

      {/* Hero */}
      <HeroSection
        onFilterToggle={() => setShowFilters(!showFilters)}
        onBrowseClick={handleBrowseClick}
      />

      {/* Filter Panel */}
      <div className="max-w-7xl mx-auto px-4">
        <FilterPanel
          isOpen={showFilters}
          onClose={() => setShowFilters(false)}
          filters={filters}
          onFilterChange={setFilters}
        />
      </div>

      {/* Seasonal Collections */}
      <ScrollTarget id="seasonal" className="scroll-mt-20">
        <SeasonalCollections />
      </ScrollTarget>

      {/* Explore by Style */}
      <ScrollTarget id="styles" className="scroll-mt-20">
        <ExploreByStyle />
      </ScrollTarget>

      {/* Trending Destinations */}
      <ScrollTarget id="trending" className="scroll-mt-20">
        <div ref={destinationGridRef}>
          <TrendingDestinationsEnhanced />
        </div>
      </ScrollTarget>

      {/* Voyance Guides */}
      <ScrollTarget id="guides" className="scroll-mt-20">
        <VoyanceGuides />
      </ScrollTarget>

      <Footer />
    </main>
  );
}
