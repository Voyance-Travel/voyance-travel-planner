import { useState, useRef, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { SlidersHorizontal, X, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import Head from '@/components/common/Head';
import TopNav from '@/components/common/TopNav';
import Footer from '@/components/common/Footer';
import ScrollTarget from '@/components/common/ScrollTarget';
import FilterPanel from '@/components/explore/FilterPanel';
import HeroSection from '@/components/explore/sections/HeroSection';

import ExploreByStyle from '@/components/explore/sections/ExploreByStyle';
import TrendingDestinationsEnhanced from '@/components/explore/sections/TrendingDestinationsEnhanced';
import VoyanceGuides from '@/components/explore/sections/VoyanceGuides';
import DestinationHeroImage from '@/components/common/DestinationHeroImage';
import { scrollToTop } from '@/utils/scrollUtils';
import { destinations as allDestinations } from '@/lib/destinations';
import { buildRoute } from '@/config/routes';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useHybridDestinationSearch, HybridDestination } from '@/hooks/useHybridDestinationSearch';

// Travel style to destination mapping
const styleToDestinations: Record<string, string[]> = {
  luxury: ['paris', 'santorini', 'singapore', 'vienna', 'florence'],
  adventure: ['cape-town', 'reykjavik', 'petra', 'cusco', 'vancouver'],
  culture: ['kyoto', 'marrakech', 'mexico-city', 'hanoi', 'oaxaca'],
  wellness: ['bali', 'copenhagen', 'lisbon', 'porto', 'barcelona'],
  culinary: ['tokyo', 'bangkok', 'new-orleans', 'mexico-city', 'buenos-aires'],
  romantic: ['santorini', 'paris', 'florence', 'cartagena', 'porto'],
};

// Seasonal destination mapping with curated picks (using existing destination IDs)
const seasonToDestinations: Record<string, string[]> = {
  spring: ['kyoto', 'paris', 'seoul', 'lisbon', 'florence', 'hanoi'],
  summer: ['santorini', 'barcelona', 'reykjavik', 'vancouver', 'cape-town', 'porto'],
  autumn: ['new-york', 'kyoto', 'vienna', 'new-orleans', 'mexico-city', 'marrakech'],
  winter: ['reykjavik', 'singapore', 'bali', 'buenos-aires', 'melbourne', 'bangkok'],
};

// Style labels for display
const styleLabels: Record<string, string> = {
  luxury: 'Luxury',
  adventure: 'Adventure', 
  culture: 'Culture',
  wellness: 'Wellness',
  culinary: 'Culinary',
  romantic: 'Romantic',
};

// Season labels for display
const seasonLabels: Record<string, { title: string; description: string }> = {
  spring: { title: 'Spring Destinations', description: 'Cherry blossoms, tulip fields & renewal' },
  summer: { title: 'Summer Escapes', description: 'Coastal retreats & sun-drenched adventures' },
  autumn: { title: 'Autumn Journeys', description: 'Golden foliage & harvest festivals' },
  winter: { title: 'Winter Wonderlands', description: 'Alpine retreats & northern lights' },
};

export default function Explore() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const activeStyle = searchParams.get('style');
  const activeSeason = searchParams.get('season');
  const [filters, setFilters] = useState({ 
    region: searchParams.get('region') as string | null, 
    budget: null as string | null, 
    vibe: null as string | null 
  });
  const destinationGridRef = useRef<HTMLDivElement>(null);
  const searchResultsRef = useRef<HTMLDivElement>(null);

  // Hybrid search - combines featured destinations with database
  const { 
    results: hybridResults, 
    isLoading: isSearchLoading,
    featuredCount,
    databaseCount 
  } = useHybridDestinationSearch(searchQuery, !!searchQuery);

  // Filter static destinations for style/season/region filters (non-search)
  const filteredStaticDestinations = useMemo(() => {
    let results = allDestinations;
    
    // Filter by travel style
    if (activeStyle && styleToDestinations[activeStyle]) {
      const styleDestIds = styleToDestinations[activeStyle];
      results = results.filter(d => styleDestIds.includes(d.id));
    }
    
    // Filter by season
    if (activeSeason && seasonToDestinations[activeSeason]) {
      const seasonDestIds = seasonToDestinations[activeSeason];
      results = results.filter(d => seasonDestIds.includes(d.id));
    }
    
    if (filters.region) {
      results = results.filter(d => 
        d.region.toLowerCase().includes(filters.region!.toLowerCase())
      );
    }
    
    return results;
  }, [filters.region, activeStyle, activeSeason]);

  // Use hybrid results when searching, static when filtering
  const displayDestinations = searchQuery ? hybridResults : filteredStaticDestinations.map(d => ({
    id: d.id,
    city: d.city,
    country: d.country,
    region: d.region,
    tagline: d.tagline,
    imageUrl: d.imageUrl,
    source: 'featured' as const
  }));

  const isSearching = searchQuery || filters.region || filters.budget || filters.vibe || activeStyle || activeSeason;

  useEffect(() => {
    scrollToTop();
    document.documentElement.style.scrollPaddingTop = '80px';
    return () => {
      document.documentElement.style.scrollPaddingTop = '';
    };
  }, []);

  // Scroll to results when searching
  useEffect(() => {
    if (isSearching && searchResultsRef.current) {
      searchResultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [isSearching]);

  const handleBrowseClick = () => {
    destinationGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery) {
      setSearchParams({ q: searchQuery });
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchParams({});
  };

  const handleDestinationClick = (destination: HybridDestination) => {
    // For featured destinations, use slug-based routing
    // For database destinations, use ID-based routing
    if (destination.source === 'featured') {
      navigate(buildRoute.destination(destination.id));
    } else {
      navigate(buildRoute.destination(destination.city.toLowerCase().replace(/\s+/g, '-')));
    }
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
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={() => searchQuery && setSearchParams({ q: searchQuery })}
      />

      {/* Filter & Active Search Indicators Bar */}
      <div className="max-w-7xl mx-auto px-4 -mt-6 relative z-10">
        <div className="bg-card/80 backdrop-blur-sm rounded-xl shadow-sm border border-border/50 p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button 
              type="button"
              variant="outline" 
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {(filters.region || filters.budget || filters.vibe) && (
                <Badge variant="secondary" className="ml-1">
                  {[filters.region, filters.budget, filters.vibe].filter(Boolean).length}
                </Badge>
              )}
            </Button>
            {searchQuery && (
              <Badge variant="secondary" className="gap-1">
                Searching: "{searchQuery}"
                <button onClick={clearSearch} className="ml-1 hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
          </div>
          {isSearching && (
            <span className="text-sm text-muted-foreground">
              {displayDestinations.length} result{displayDestinations.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Filter Panel */}
      <div className="max-w-7xl mx-auto px-4 mt-4">
        <FilterPanel
          isOpen={showFilters}
          onClose={() => setShowFilters(false)}
          filters={filters}
          onFilterChange={setFilters}
        />
      </div>

      {/* Search Results */}
      {isSearching && (
        <section ref={searchResultsRef} className="py-12 bg-background scroll-mt-20">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-display font-bold text-foreground mb-2">
                  {activeSeason && seasonLabels[activeSeason] 
                    ? seasonLabels[activeSeason].title 
                    : activeStyle && styleLabels[activeStyle] 
                      ? `${styleLabels[activeStyle]} Destinations` 
                      : `${displayDestinations.length} Destination${displayDestinations.length !== 1 ? 's' : ''} Found`}
                </h2>
                {searchQuery && featuredCount > 0 && databaseCount > 0 && (
                  <p className="text-sm text-muted-foreground mb-2">
                    <Sparkles className="inline h-3 w-3 mr-1" />
                    {featuredCount} featured + {databaseCount} more from our database
                  </p>
                )}
                {activeSeason && seasonLabels[activeSeason] && (
                  <p className="text-muted-foreground mb-3">{seasonLabels[activeSeason].description}</p>
                )}
                {(activeSeason || activeStyle) && (
                  <div className="flex flex-wrap gap-2">
                    {activeSeason && seasonLabels[activeSeason] && (
                      <Badge variant="default" className="gap-1 bg-primary">
                        {seasonLabels[activeSeason].title.replace(' Destinations', '').replace(' Escapes', '').replace(' Journeys', '').replace(' Wonderlands', '')}
                        <button onClick={() => setSearchParams({})} className="ml-1 hover:text-primary-foreground/80">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )}
                    {activeStyle && styleLabels[activeStyle] && (
                      <Badge variant="default" className="gap-1 bg-primary">
                        {styleLabels[activeStyle]}
                        <button onClick={() => setSearchParams({})} className="ml-1 hover:text-primary-foreground/80">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )}
                  </div>
                )}
              </div>
              <Button variant="ghost" onClick={() => { clearSearch(); setFilters({ region: null, budget: null, vibe: null }); setSearchParams({}); }}>
                Clear All
              </Button>
            </div>

            {isSearchLoading && searchQuery ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : displayDestinations.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {displayDestinations.map((destination, index) => (
                  <motion.div
                    key={destination.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="group cursor-pointer"
                    onClick={() => handleDestinationClick(destination)}
                  >
                    <div className="relative aspect-[4/3] rounded-xl overflow-hidden mb-3">
                      <DestinationHeroImage
                        destinationName={`${destination.city}, ${destination.country}`}
                        alt={destination.city}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        overlayGradient=""
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      <div className="absolute bottom-3 left-3 right-3">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-white text-lg">
                            {destination.city}
                          </h3>
                          {destination.source === 'featured' && (
                            <Sparkles className="h-3 w-3 text-amber-400" />
                          )}
                        </div>
                        <p className="text-sm text-white/80">
                          {destination.country} • {destination.region}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {destination.tagline}
                    </p>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <p className="text-muted-foreground text-lg mb-4">No destinations found matching your criteria.</p>
                <Button onClick={() => { clearSearch(); setFilters({ region: null, budget: null, vibe: null }); }}>
                  Clear Filters
                </Button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Show regular sections when not searching */}
      {!isSearching && (
        <>

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
        </>
      )}

      <Footer />
    </main>
  );
}
