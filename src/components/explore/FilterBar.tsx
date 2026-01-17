import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Filter, X } from "lucide-react";
import { useState } from 'react';

interface FilterBarProps {
  currentSeason?: string;
  currentTag?: string;
  currentRegion?: string;
  destinationCount?: number;
  onSeasonChange: (season: string) => void;
  onTagChange: (tag: string) => void;
  onRegionChange: (region: string) => void;
  onClearFilters: () => void;
}

const seasons = [
  { value: "", label: "Any Season" },
  { value: "spring", label: "Spring" },
  { value: "summer", label: "Summer" },
  { value: "fall", label: "Fall" },
  { value: "winter", label: "Winter" },
];

const tags = [
  { value: "", label: "All Styles" },
  { value: "romantic", label: "Romantic" },
  { value: "luxury", label: "Luxury" },
  { value: "adventure", label: "Adventure" },
  { value: "cultural", label: "Cultural" },
  { value: "foodie", label: "Foodie" },
  { value: "wellness", label: "Wellness" },
];

const regions = [
  { value: "", label: "All Regions" },
  { value: "europe", label: "Europe" },
  { value: "asia", label: "Asia" },
  { value: "americas", label: "Americas" },
  { value: "africa", label: "Africa" },
  { value: "oceania", label: "Oceania" },
];

export default function FilterBar({
  currentSeason = "",
  currentTag = "",
  currentRegion = "",
  destinationCount = 0,
  onSeasonChange,
  onTagChange,
  onRegionChange,
  onClearFilters
}: FilterBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasActiveFilters = currentSeason || currentTag || currentRegion;

  return (
    <div className="relative">
      {/* Mobile Filter Toggle */}
      <div className="lg:hidden mb-4">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg shadow-sm hover:shadow-md transition-shadow"
        >
          <Filter className="w-4 h-4" />
          <span className="font-medium">Filters</span>
          {hasActiveFilters && (
            <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
              Active
            </span>
          )}
        </button>
      </div>

      {/* Filter Controls - Always visible on desktop, toggleable on mobile */}
      <div className={`${isExpanded ? 'block' : 'hidden'} lg:block`}>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-xl shadow-sm p-4 mb-8"
        >
          <div className="flex flex-wrap items-center gap-4">
            {/* Season Filter */}
            <div className="relative">
              <select
                value={currentSeason}
                onChange={(e) => onSeasonChange(e.target.value)}
                className="appearance-none bg-muted border border-border rounded-lg px-4 py-2 pr-10 text-sm font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors cursor-pointer"
              >
                {seasons.map((season) => (
                  <option key={season.value} value={season.value}>
                    {season.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>

            {/* Style/Tag Filter */}
            <div className="relative">
              <select
                value={currentTag}
                onChange={(e) => onTagChange(e.target.value)}
                className="appearance-none bg-muted border border-border rounded-lg px-4 py-2 pr-10 text-sm font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors cursor-pointer"
              >
                {tags.map((tag) => (
                  <option key={tag.value} value={tag.value}>
                    {tag.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>

            {/* Region Filter */}
            <div className="relative">
              <select
                value={currentRegion}
                onChange={(e) => onRegionChange(e.target.value)}
                className="appearance-none bg-muted border border-border rounded-lg px-4 py-2 pr-10 text-sm font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors cursor-pointer"
              >
                {regions.map((region) => (
                  <option key={region.value} value={region.value}>
                    {region.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>

            {/* Clear Filters */}
            <AnimatePresence>
              {hasActiveFilters && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={onClearFilters}
                  className="flex items-center gap-1 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                  <span>Clear filters</span>
                </motion.button>
              )}
            </AnimatePresence>

            {/* Results Count */}
            <div className="ml-auto text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {destinationCount}
              </span>
              {" "}destination{destinationCount !== 1 ? "s" : ""}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
