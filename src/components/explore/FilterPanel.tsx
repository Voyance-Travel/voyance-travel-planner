import { motion, AnimatePresence } from 'framer-motion';
import { X, Globe, Wallet, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';

interface Filters {
  region: string | null;
  budget: string | null;
  vibe: string | null;
}

interface FilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  filters: Filters;
  onFilterChange: (filters: Filters) => void;
}

const regions = ['Asia', 'Europe', 'Americas', 'Africa', 'Oceania'];
const budgets = ['Budget', 'Mid-range', 'Luxury', 'Ultra-luxury'];
const vibes = ['Adventure', 'Relaxation', 'Culture', 'Romance', 'Foodie', 'Nature'];

export default function FilterPanel({ isOpen, onClose, filters, onFilterChange }: FilterPanelProps) {
  const isMobile = useIsMobile();

  const updateFilter = (key: keyof Filters, value: string | null) => {
    onFilterChange({
      ...filters,
      [key]: filters[key] === value ? null : value,
    });
  };

  const clearFilters = () => {
    onFilterChange({ region: null, budget: null, vibe: null });
  };

  const hasActiveFilters = filters.region || filters.budget || filters.vibe;

  const filterContent = (
    <>
      {/* Drag handle — mobile only */}
      <div className="sm:hidden w-12 h-1 bg-muted rounded-full mx-auto mb-4 mt-2" />

      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-foreground">Filter Destinations</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Region */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-3">
          <Globe className="h-4 w-4" />
          Region
        </div>
        <div className="flex flex-wrap gap-2">
          {regions.map(region => (
            <button
              key={region}
              onClick={() => updateFilter('region', region)}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                filters.region === region
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {region}
            </button>
          ))}
        </div>
      </div>

      {/* Budget */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-3">
          <Wallet className="h-4 w-4" />
          Budget
        </div>
        <div className="flex flex-wrap gap-2">
          {budgets.map(budget => (
            <button
              key={budget}
              onClick={() => updateFilter('budget', budget)}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                filters.budget === budget
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {budget}
            </button>
          ))}
        </div>
      </div>

      {/* Vibe */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-3">
          <Compass className="h-4 w-4" />
          Travel Vibe
        </div>
        <div className="flex flex-wrap gap-2">
          {vibes.map(vibe => (
            <button
              key={vibe}
              onClick={() => updateFilter('vibe', vibe)}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                filters.vibe === vibe
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {vibe}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {hasActiveFilters && (
          <Button variant="outline" onClick={clearFilters}>
            Clear All
          </Button>
        )}
        <Button onClick={onClose}>
          Apply Filters
        </Button>
      </div>
    </>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Mobile: bottom sheet with backdrop */}
          {isMobile ? (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/40"
                onClick={onClose}
              />
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="fixed inset-x-0 bottom-0 z-50 bg-card border-t border-border rounded-t-2xl p-6 max-h-[85vh] overflow-y-auto"
              >
                {filterContent}
              </motion.div>
            </>
          ) : (
            /* Desktop: inline card */
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-card border border-border rounded-2xl p-6 mb-8 shadow-lg"
            >
              {filterContent}
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  );
}
