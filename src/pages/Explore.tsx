import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { Header } from '@/components/Header';
import { DestinationCard } from '@/components/DestinationCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { destinations, regions, searchDestinations } from '@/lib/destinations';

export default function Explore() {
  const [query, setQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('All');
  
  const filteredDestinations = searchDestinations(
    query, 
    selectedRegion === 'All' ? undefined : selectedRegion
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-6">
          {/* Header */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h1 className="font-serif text-4xl md:text-5xl font-semibold mb-4">
              Explore Destinations
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Curated cities where thoughtful planning makes the difference. Each destination chosen for depth, not trends.
            </p>
          </motion.div>

          {/* Search & Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-10">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search cities or countries..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-10 h-12"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {regions.map((region) => (
                <Button
                  key={region}
                  variant={selectedRegion === region ? 'accent' : 'soft'}
                  size="sm"
                  onClick={() => setSelectedRegion(region)}
                >
                  {region}
                </Button>
              ))}
            </div>
          </div>

          {/* Results count */}
          <p className="text-sm text-muted-foreground mb-6">
            {filteredDestinations.length} destination{filteredDestinations.length !== 1 ? 's' : ''} found
          </p>

          {/* Grid */}
          {filteredDestinations.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredDestinations.map((destination, index) => (
                <DestinationCard 
                  key={destination.id} 
                  destination={destination}
                  index={index}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-muted-foreground text-lg">No destinations match your search.</p>
              <Button variant="soft" className="mt-4" onClick={() => { setQuery(''); setSelectedRegion('All'); }}>
                Clear filters
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
