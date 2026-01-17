import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import type { Guide } from "@/data/guides";
import GuideCard from "./GuideCard";

interface GuidesGridProps {
  guides: Guide[];
  featured?: boolean;
  limit?: number;
  category?: string;
  showFilters?: boolean;
}

export default function GuidesGrid({
  guides,
  featured = false,
  limit,
  category,
  showFilters = false
}: GuidesGridProps) {
  const [filteredGuides, setFilteredGuides] = useState<Guide[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>(category || 'All');
  const [searchQuery, setSearchQuery] = useState('');

  // Get unique categories from guides
  const categories = ['All', ...new Set(guides.map(guide => guide?.category))];

  // Filter guides based on category, featured status, and search query
  useEffect(() => {
    let result = [...guides];

    // Filter by featured status if required
    if (featured) {
      result = result.filter(guide => guide?.featured);
    }

    // Filter by category if selected
    if (activeCategory && activeCategory !== 'All') {
      result = result.filter(guide => guide?.category === activeCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(guide =>
        guide?.title.toLowerCase().includes(query) ||
        guide?.summary.toLowerCase().includes(query) ||
        guide?.content.toLowerCase().includes(query) ||
        (guide?.tags && guide?.tags.some(tag => tag.toLowerCase().includes(query)))
      );
    }

    // Apply limit if specified
    if (limit && limit > 0) {
      result = result.slice(0, limit);
    }

    setFilteredGuides(result);
  }, [guides, featured, activeCategory, searchQuery, limit]);

  return (
    <div className="w-full">
      {/* Filters - only show if showFilters is true */}
      {showFilters && (
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            {/* Category filter */}
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <button
                  key={cat}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    activeCategory === cat
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-accent'
                  }`}
                  onClick={() => setActiveCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Search input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search guides..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-4 py-2 pr-10 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            </div>
          </div>
        </motion.div>
      )}

      {/* Grid */}
      {filteredGuides.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGuides.map((guide, index) => (
            <GuideCard
              key={guide.slug}
              guide={guide}
              priority={index}
            />
          ))}
        </div>
      ) : (
        <motion.div
          className="text-center py-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-muted-foreground text-lg">
            {searchQuery
              ? `No guides found matching "${searchQuery}"`
              : 'No guides available in this category'}
          </p>
        </motion.div>
      )}
    </div>
  );
}
