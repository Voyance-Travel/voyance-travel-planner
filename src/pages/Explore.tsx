import { useState, useRef, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { motion } from 'framer-motion';
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
import { destinations as allDestinations, searchDestinations, regions } from '@/lib/destinations';
import { buildRoute } from '@/config/routes';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function Explore() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [filters, setFilters] = useState({ 
    region: searchParams.get('region') as string | null, 
    budget: null as string | null, 
    vibe: null as string | null 
  });
  const destinationGridRef = useRef<HTMLDivElement>(null);
  const searchResultsRef = useRef<HTMLDivElement>(null);

  // Filter destinations based on search and filters
  const filteredDestinations = useMemo(() => {
    let results = allDestinations;
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      results = results.filter(d => 
        d.city.toLowerCase().includes(q) || 
        d.country.toLowerCase().includes(q) ||
        d.tagline.toLowerCase().includes(q) ||
        d.region.toLowerCase().includes(q)
      );
    }
    
    if (filters.region) {
      results = results.filter(d => 
        d.region.toLowerCase().includes(filters.region!.toLowerCase())
      );
    }
    
    return results;
  }, [searchQuery, filters.region]);

  const isSearching = searchQuery || filters.region || filters.budget || filters.vibe;

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

  const handleDestinationClick = (destinationId: string) => {
    navigate(buildRoute.destination(destinationId));
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

      {/* Search Bar */}
      <div className="max-w-7xl mx-auto px-4 -mt-8 relative z-10">
        <form onSubmit={handleSearch} className="bg-card rounded-2xl shadow-lg p-4 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search destinations, countries, or regions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 text-base"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button 
            type="button"
            variant="outline" 
            size="lg"
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
          <Button type="submit" size="lg">
            Search
          </Button>
        </form>
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
                  {filteredDestinations.length} Destination{filteredDestinations.length !== 1 ? 's' : ''} Found
                </h2>
                <div className="flex flex-wrap gap-2">
                  {searchQuery && (
                    <Badge variant="secondary" className="gap-1">
                      "{searchQuery}"
                      <button onClick={clearSearch} className="ml-1 hover:text-foreground">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  {filters.region && (
                    <Badge variant="secondary" className="gap-1">
                      {filters.region}
                      <button onClick={() => setFilters({...filters, region: null})} className="ml-1 hover:text-foreground">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                </div>
              </div>
              <Button variant="ghost" onClick={() => { clearSearch(); setFilters({ region: null, budget: null, vibe: null }); }}>
                Clear All
              </Button>
            </div>

            {filteredDestinations.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredDestinations.map((destination, index) => (
                  <motion.div
                    key={destination.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="group cursor-pointer"
                    onClick={() => handleDestinationClick(destination.id)}
                  >
                    <div className="relative aspect-[4/3] rounded-xl overflow-hidden mb-3">
                      <img
                        src={destination.imageUrl}
                        alt={destination.city}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      <div className="absolute bottom-3 left-3 right-3">
                        <h3 className="font-semibold text-white text-lg">
                          {destination.city}
                        </h3>
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
        </>
      )}

      <Footer />
    </main>
  );
}
