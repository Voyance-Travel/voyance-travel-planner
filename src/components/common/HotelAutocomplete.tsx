import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Hotel, MapPin, Star } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { searchHotelsByName, type HotelSearchByNameResult } from '@/services/hotelAPI';

interface HotelAutocompleteProps {
  value: string;
  onChange: (hotel: { name: string; address: string; placeId?: string }) => void;
  destination: string;
  placeholder?: string;
  className?: string;
}

export function HotelAutocomplete({
  value,
  onChange,
  destination,
  placeholder = 'Start typing hotel name...',
  className,
}: HotelAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value);
  const [results, setResults] = useState<HotelSearchByNameResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Sync input value when value prop changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const performSearch = useCallback(async (query: string) => {
    if (!query || query.length < 2 || !destination) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const hotels = await searchHotelsByName(query, destination);
      setResults(hotels);
      setIsOpen(hotels.length > 0);
    } catch (error) {
      console.error('Hotel search failed:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [destination]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce search
    debounceRef.current = setTimeout(() => {
      performSearch(newValue);
    }, 300);
  };

   const handleSelect = (hotel: HotelSearchByNameResult, e: React.MouseEvent) => {
     e.preventDefault();
     e.stopPropagation();
    setInputValue(hotel.name);
    setIsOpen(false);
    setResults([]);
    onChange({
      name: hotel.name,
      address: hotel.address,
      placeId: hotel.placeId,
    });
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Input
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className="pr-8"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden max-h-[280px] overflow-y-auto">
          {results.map((hotel) => (
            <button
              key={hotel.placeId}
              type="button"
               onClick={(e) => handleSelect(hotel, e)}
              className="w-full px-3 py-2.5 text-left hover:bg-accent transition-colors flex items-start gap-3 border-b border-border/50 last:border-0"
            >
              <Hotel className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-foreground truncate">
                  {hotel.name}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{hotel.address}</span>
                </div>
                {hotel.rating && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                    <span>{hotel.rating}</span>
                    {hotel.reviewCount && (
                      <span>({hotel.reviewCount.toLocaleString()} reviews)</span>
                    )}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {isOpen && !isLoading && results.length === 0 && inputValue.length >= 2 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg p-3 text-center text-sm text-muted-foreground">
          No hotels found. You can still type manually.
        </div>
      )}
    </div>
  );
}
