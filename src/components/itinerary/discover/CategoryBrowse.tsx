/**
 * CategoryBrowse — Tertiary category quick-filters for Discover
 */
import { Coffee, UtensilsCrossed, Footprints, Wine, IceCream, Music, Landmark, PartyPopper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type Category = 'coffee' | 'food' | 'wander' | 'drinks' | 'snacks' | 'nightlife' | 'attractions' | 'events';

const CATEGORIES: { key: Category; label: string; icon: React.ReactNode }[] = [
  { key: 'coffee', label: 'Cafés', icon: <Coffee className="h-3.5 w-3.5" /> },
  { key: 'food', label: 'Restaurants', icon: <UtensilsCrossed className="h-3.5 w-3.5" /> },
  { key: 'wander', label: 'Explore', icon: <Footprints className="h-3.5 w-3.5" /> },
  { key: 'drinks', label: 'Drinks', icon: <Wine className="h-3.5 w-3.5" /> },
  { key: 'nightlife', label: 'Nightlife', icon: <Music className="h-3.5 w-3.5" /> },
  { key: 'attractions', label: 'Attractions', icon: <Landmark className="h-3.5 w-3.5" /> },
  { key: 'events', label: 'Events', icon: <PartyPopper className="h-3.5 w-3.5" /> },
  { key: 'snacks', label: 'Snacks', icon: <IceCream className="h-3.5 w-3.5" /> },
];

interface CategoryBrowseProps {
  selected: Category | null;
  onSelect: (cat: Category) => void;
  isLoading: boolean;
}

export function CategoryBrowse({ selected, onSelect, isLoading }: CategoryBrowseProps) {
  return (
    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
      {CATEGORIES.map((cat) => (
        <Button
          key={cat.key}
          variant={selected === cat.key ? 'default' : 'outline'}
          size="sm"
          onClick={() => onSelect(cat.key)}
          disabled={isLoading}
          className={cn(
            'gap-1.5 shrink-0 text-xs h-8',
            selected === cat.key
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-primary/10 hover:border-primary/30'
          )}
        >
          {cat.icon}
          {cat.label}
        </Button>
      ))}
    </div>
  );
}

export { CATEGORIES };
