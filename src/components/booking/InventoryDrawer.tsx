/**
 * Inventory Drawer Component
 * 
 * Right-hand drawer for searching and adding bookable inventory
 * (hotels, activities, transfers) without disrupting the itinerary layout.
 */

import { useState, useCallback } from 'react';
import { 
  X, Search, Filter, Hotel, MapPin, Star, Clock, Users,
  Plus, Check, Loader2, ChevronDown, ChevronRight, ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

export type InventoryType = 'hotel' | 'activity' | 'transfer' | 'experience';

export interface InventoryItem {
  id: string;
  type: InventoryType;
  title: string;
  description?: string;
  imageUrl?: string;
  rating?: number;
  reviewCount?: number;
  priceCents: number;
  currency: string;
  duration?: string;
  location?: string;
  vendor?: string;
  tags?: string[];
  highlights?: string[];
  cancellationPolicy?: string;
  externalUrl?: string;
}

export interface InventoryFilters {
  priceRange: [number, number];
  rating: number | null;
  categories: string[];
}

interface InventoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  type: InventoryType;
  destination: string;
  date?: string;
  onSelectItem: (item: InventoryItem) => void;
  onCompare?: (items: InventoryItem[]) => void;
  searchFn?: (query: string, filters: InventoryFilters) => Promise<InventoryItem[]>;
}

const DEFAULT_FILTERS: InventoryFilters = {
  priceRange: [0, 50000], // cents
  rating: null,
  categories: [],
};

const TYPE_LABELS: Record<InventoryType, string> = {
  hotel: 'Hotels',
  activity: 'Activities',
  transfer: 'Transfers',
  experience: 'Experiences',
};

const TYPE_ICONS: Record<InventoryType, React.ReactNode> = {
  hotel: <Hotel className="h-4 w-4" />,
  activity: <MapPin className="h-4 w-4" />,
  transfer: <MapPin className="h-4 w-4" />,
  experience: <Star className="h-4 w-4" />,
};

export function InventoryDrawer({
  isOpen,
  onClose,
  type,
  destination,
  date,
  onSelectItem,
  onCompare,
  searchFn,
}: InventoryDrawerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<InventoryFilters>(DEFAULT_FILTERS);
  const [results, setResults] = useState<InventoryItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!searchFn) {
      // Demo data for UI development
      setResults(DEMO_RESULTS[type] || []);
      return;
    }

    setIsSearching(true);
    try {
      const items = await searchFn(searchQuery || destination, filters);
      setResults(items);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  }, [searchFn, searchQuery, destination, filters, type]);

  const toggleCompare = (itemId: string) => {
    setSelectedForCompare(prev => {
      if (prev.includes(itemId)) {
        return prev.filter(id => id !== itemId);
      }
      if (prev.length >= 3) return prev;
      return [...prev, itemId];
    });
  };

  const handleCompare = () => {
    const itemsToCompare = results.filter(item => selectedForCompare.includes(item.id));
    onCompare?.(itemsToCompare);
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:w-[480px] p-0">
        <SheetHeader className="p-4 border-b">
          <div className="flex items-center gap-2">
            {TYPE_ICONS[type]}
            <SheetTitle>Find {TYPE_LABELS[type]}</SheetTitle>
          </div>
          <SheetDescription className="text-sm">
            {destination}{date ? ` • ${date}` : ''}
          </SheetDescription>
        </SheetHeader>

        {/* Search Bar */}
        <div className="p-4 border-b space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Search ${TYPE_LABELS[type].toLowerCase()}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-9"
              />
            </div>
            <Button onClick={handleSearch} disabled={isSearching}>
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
            </Button>
          </div>

          {/* Filters Toggle */}
          <Collapsible open={showFilters} onOpenChange={setShowFilters}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 h-8">
                <Filter className="h-3.5 w-3.5" />
                Filters
                {showFilters ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-4">
              {/* Price Range */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Price Range</label>
                <Slider
                  value={[filters.priceRange[0] / 100, filters.priceRange[1] / 100]}
                  onValueChange={([min, max]) => setFilters(f => ({
                    ...f,
                    priceRange: [min * 100, max * 100],
                  }))}
                  min={0}
                  max={500}
                  step={10}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>${filters.priceRange[0] / 100}</span>
                  <span>${filters.priceRange[1] / 100}+</span>
                </div>
              </div>

              {/* Rating Filter */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Minimum Rating</label>
                <div className="flex gap-2">
                  {[3, 3.5, 4, 4.5].map(rating => (
                    <Button
                      key={rating}
                      variant={filters.rating === rating ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => setFilters(f => ({
                        ...f,
                        rating: f.rating === rating ? null : rating,
                      }))}
                    >
                      <Star className="h-3 w-3" />
                      {rating}+
                    </Button>
                  ))}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Compare Bar */}
        <AnimatePresence>
          {selectedForCompare.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-b bg-muted/50"
            >
              <div className="p-3 flex items-center justify-between">
                <span className="text-sm">
                  {selectedForCompare.length} selected for comparison
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedForCompare([])}
                  >
                    Clear
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleCompare}
                    disabled={selectedForCompare.length < 2}
                  >
                    Compare
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <ScrollArea className="flex-1 h-[calc(100vh-250px)]">
          <div className="p-4 space-y-3">
            {isSearching ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mb-3" />
                <p>Searching...</p>
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-3 opacity-50" />
                <p>Search for {TYPE_LABELS[type].toLowerCase()} in {destination}</p>
                <Button variant="link" size="sm" onClick={handleSearch} className="mt-2">
                  Browse popular options
                </Button>
              </div>
            ) : (
              results.map((item) => (
                <InventoryCard
                  key={item.id}
                  item={item}
                  isSelected={selectedForCompare.includes(item.id)}
                  onToggleCompare={() => toggleCompare(item.id)}
                  onSelect={() => onSelectItem(item)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

interface InventoryCardProps {
  item: InventoryItem;
  isSelected: boolean;
  onToggleCompare: () => void;
  onSelect: () => void;
}

function InventoryCard({ item, isSelected, onToggleCompare, onSelect }: InventoryCardProps) {
  const formatPrice = (cents: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(cents / 100);
  };

  return (
    <Card className={cn(
      'overflow-hidden transition-all',
      isSelected && 'ring-2 ring-primary'
    )}>
      <div className="flex">
        {/* Image */}
        {item.imageUrl && (
          <div className="w-28 h-28 flex-shrink-0">
            <img
              src={item.imageUrl}
              alt={item.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Content */}
        <CardContent className="flex-1 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm leading-tight truncate">
                {item.title}
              </h4>
              {item.location && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3 w-3" />
                  {typeof item.location === 'string' 
                    ? item.location 
                    : (item.location as { name?: string; address?: string }).name || 
                      (item.location as { name?: string; address?: string }).address}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="font-semibold text-sm">
                {formatPrice(item.priceCents, item.currency)}
              </p>
              {item.vendor && (
                <p className="text-xs text-muted-foreground">{item.vendor}</p>
              )}
            </div>
          </div>

          {/* Rating & Duration */}
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            {item.rating && (
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                {item.rating.toFixed(1)}
                {item.reviewCount && <span>({item.reviewCount})</span>}
              </span>
            )}
            {item.duration && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {item.duration}
              </span>
            )}
          </div>

          {/* Tags */}
          {item.tags && item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {item.tags.slice(0, 3).map(tag => (
                <Badge key={tag} variant="secondary" className="text-xs h-5 px-1.5">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 mt-3">
            <Button
              size="sm"
              className="h-7 text-xs gap-1 flex-1"
              onClick={onSelect}
            >
              <Plus className="h-3 w-3" />
              Add to Trip
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'h-7 w-7 p-0',
                isSelected && 'bg-primary text-primary-foreground'
              )}
              onClick={(e) => {
                e.stopPropagation();
                onToggleCompare();
              }}
            >
              {isSelected ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
            </Button>
            {item.externalUrl && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                asChild
              >
                <a href={item.externalUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

// Demo data for UI development
const DEMO_RESULTS: Record<InventoryType, InventoryItem[]> = {
  hotel: [
    {
      id: 'h1',
      type: 'hotel',
      title: 'Grand Hyatt Tokyo',
      description: 'Luxury hotel in Roppongi Hills',
      imageUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400',
      rating: 4.7,
      reviewCount: 2341,
      priceCents: 35000,
      currency: 'USD',
      location: 'Roppongi, Tokyo',
      vendor: 'Expedia',
      tags: ['Luxury', 'Spa', 'Pool'],
    },
    {
      id: 'h2',
      type: 'hotel',
      title: 'Park Hyatt Tokyo',
      description: 'Iconic hotel from Lost in Translation',
      imageUrl: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=400',
      rating: 4.8,
      reviewCount: 1876,
      priceCents: 45000,
      currency: 'USD',
      location: 'Shinjuku, Tokyo',
      vendor: 'Expedia',
      tags: ['Luxury', 'Views', 'Fine Dining'],
    },
  ],
  activity: [
    {
      id: 'a1',
      type: 'activity',
      title: 'Tokyo Food Tour',
      description: 'Explore local cuisine in hidden alleys',
      imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400',
      rating: 4.9,
      reviewCount: 543,
      priceCents: 8900,
      currency: 'USD',
      duration: '3 hours',
      location: 'Shibuya',
      vendor: 'Viator',
      tags: ['Food', 'Walking', 'Local'],
    },
  ],
  transfer: [],
  experience: [],
};
