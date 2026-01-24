/**
 * Airport Autocomplete Component
 * 
 * Searchable dropdown connected to the airports table.
 */

import { useState, useEffect, useCallback } from 'react';
import { Check, ChevronsUpDown, Plane } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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
  value: string;
  onChange: (code: string, airport?: Airport) => void;
  placeholder?: string;
  className?: string;
}

export function AirportAutocomplete({ 
  value, 
  onChange, 
  placeholder = 'Select airport...',
  className 
}: AirportAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [airports, setAirports] = useState<Airport[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAirport, setSelectedAirport] = useState<Airport | null>(null);

  // Fetch airports based on search
  const searchAirports = useCallback(async (query: string) => {
    if (query.length < 2) {
      setAirports([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('airports')
        .select('code, name, city, country')
        .or(`code.ilike.%${query}%,name.ilike.%${query}%,city.ilike.%${query}%`)
        .limit(15);

      if (error) throw error;
      setAirports(data || []);
    } catch (err) {
      console.error('[AirportAutocomplete] Search error:', err);
      setAirports([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchAirports(search);
    }, 200);
    return () => clearTimeout(timer);
  }, [search, searchAirports]);

  // Load initial value
  useEffect(() => {
    if (value && !selectedAirport) {
      supabase
        .from('airports')
        .select('code, name, city, country')
        .eq('code', value.toUpperCase())
        .maybeSingle()
        .then(({ data }) => {
          if (data) setSelectedAirport(data);
        });
    }
  }, [value, selectedAirport]);

  const handleSelect = (airport: Airport) => {
    setSelectedAirport(airport);
    onChange(airport.code, airport);
    setOpen(false);
    setSearch('');
  };

  const displayValue = selectedAirport 
    ? `${selectedAirport.code} - ${selectedAirport.city || selectedAirport.name}`
    : value || placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className="truncate flex items-center gap-2">
            {selectedAirport && <Plane className="h-3 w-3 text-muted-foreground" />}
            {displayValue}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Search by code, city, or name..." 
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {loading && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Searching...
              </div>
            )}
            {!loading && search.length < 2 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Type at least 2 characters to search
              </div>
            )}
            {!loading && search.length >= 2 && airports.length === 0 && (
              <CommandEmpty>No airports found.</CommandEmpty>
            )}
            {!loading && airports.length > 0 && (
              <CommandGroup>
                {airports.map((airport) => (
                  <CommandItem
                    key={airport.code}
                    value={airport.code}
                    onSelect={() => handleSelect(airport)}
                    className="flex items-center gap-2"
                  >
                    <Check
                      className={cn(
                        "h-4 w-4",
                        selectedAirport?.code === airport.code ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-primary">{airport.code}</span>
                        <span className="truncate">{airport.city || airport.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {airport.name} • {airport.country}
                      </p>
                    </div>
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
