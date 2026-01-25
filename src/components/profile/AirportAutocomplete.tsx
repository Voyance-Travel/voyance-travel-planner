/**
 * Airport Autocomplete Component
 * 
 * A validated airport selector that queries the airports table
 * to ensure users can only select valid airport codes.
 */

import { useState, useEffect, useRef } from 'react';
import { Check, Plane, Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';

interface Airport {
  code: string;
  name: string;
  city: string | null;
  country: string | null;
}

interface AirportAutocompleteProps {
  value: string | null | undefined;
  onSelect: (code: string) => void;
  placeholder?: string;
  className?: string;
}

export function AirportAutocomplete({
  value,
  onSelect,
  placeholder = "Search your home airport...",
  className,
}: AirportAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [airports, setAirports] = useState<Airport[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAirport, setSelectedAirport] = useState<Airport | null>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Load initial airport if value is set
  useEffect(() => {
    async function loadSelectedAirport() {
      if (!value) {
        setSelectedAirport(null);
        return;
      }
      
      const { data } = await supabase
        .from('airports')
        .select('code, name, city, country')
        .eq('code', value.toUpperCase())
        .maybeSingle();
      
      if (data) {
        setSelectedAirport(data);
      }
    }
    
    loadSelectedAirport();
  }, [value]);

  // Search airports with debounce
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!search || search.length < 2) {
      setAirports([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const searchUpper = search.toUpperCase();
        const searchLower = search.toLowerCase();
        
        // Search by code, city, or name
        const { data, error } = await supabase
          .from('airports')
          .select('code, name, city, country')
          .or(`code.ilike.%${searchUpper}%,city.ilike.%${searchLower}%,name.ilike.%${searchLower}%`)
          .limit(20);
        
        if (error) throw error;
        setAirports(data || []);
      } catch (error) {
        console.error('Failed to search airports:', error);
        setAirports([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [search]);

  const handleSelect = (airport: Airport) => {
    setSelectedAirport(airport);
    onSelect(airport.code);
    setOpen(false);
    setSearch('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg border border-input bg-background px-4 py-3 text-left text-sm transition-colors",
            "hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            !selectedAirport && "text-muted-foreground",
            className
          )}
        >
          {selectedAirport ? (
            <>
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 shrink-0">
                <span className="font-mono font-bold text-primary text-sm">
                  {selectedAirport.code}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground truncate">
                  {selectedAirport.name}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {selectedAirport.city}{selectedAirport.country ? `, ${selectedAirport.country}` : ''}
                </div>
              </div>
            </>
          ) : (
            <>
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{placeholder}</span>
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-popover border border-border shadow-lg z-50" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Type city or airport code..." 
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-[300px]">
            {isLoading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
            {!isLoading && search.length >= 2 && airports.length === 0 && (
              <CommandEmpty>No airports found.</CommandEmpty>
            )}
            {!isLoading && search.length < 2 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Type at least 2 characters
              </div>
            )}
            {airports.length > 0 && (
              <CommandGroup>
                {airports.map((airport) => (
                  <CommandItem
                    key={airport.code}
                    value={airport.code}
                    onSelect={() => handleSelect(airport)}
                    className="flex items-center gap-3 py-3 cursor-pointer"
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 shrink-0">
                      <span className="font-mono font-bold text-primary text-sm">
                        {airport.code}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{airport.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {airport.city}{airport.country ? `, ${airport.country}` : ''}
                      </div>
                    </div>
                    {value === airport.code && (
                      <Check className="h-4 w-4 text-primary shrink-0" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}