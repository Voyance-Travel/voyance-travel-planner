import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { searchDestinations, type Destination } from '@/services/locationSearchAPI';

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

interface LocationSelection {
  display: string;
  cityName: string;
  airportCodes?: string[];
  isMetroArea?: boolean;
}

interface DestinationAutocompleteProps {
  value: string;
  onChange: (selection: LocationSelection) => void;
  placeholder?: string;
  className?: string;
}

export function DestinationAutocomplete({
  value,
  onChange,
  placeholder = 'Search cities...',
  className,
}: DestinationAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasValidSelection, setHasValidSelection] = useState(!!value);

  const debouncedQuery = useDebounce(inputValue, 300);

  // Sync with external value changes
  useEffect(() => {
    if (value && value !== inputValue) {
      setInputValue(value);
      setHasValidSelection(true);
    } else if (!value && inputValue) {
      setInputValue('');
      setHasValidSelection(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      setLoading(true);
      searchDestinations(debouncedQuery, 10)
        .then(setDestinations)
        .finally(() => setLoading(false));
    } else {
      setDestinations([]);
    }
  }, [debouncedQuery]);

  const handleSelect = (destination: Destination) => {
    const display = `${destination.city}, ${destination.country}`;
    setInputValue(display);
    setHasValidSelection(true);
    onChange({
      display,
      cityName: destination.city,
      airportCodes: destination.airport_codes,
      isMetroArea: false,
    });
    setIsOpen(false);
  };

  const handleInputChange = (val: string) => {
    setInputValue(val);
    if (hasValidSelection) {
      // User is editing after a valid selection — invalidate it
      setHasValidSelection(false);
      onChange({
        display: '',
        cityName: '',
        airportCodes: undefined,
        isMetroArea: false,
      });
    }
    if (val.length === 0) {
      setHasValidSelection(false);
    }
    setIsOpen(true);
  };

  const showDropdown = isOpen && inputValue.length >= 2;
  const showValidationHint = inputValue.length >= 2 && !hasValidSelection && !isOpen;

  return (
    <div className={cn('relative', className)}>
      <div className="absolute left-0 top-1/2 -translate-y-1/2">
        <MapPin className="h-4 w-4 text-muted-foreground" />
      </div>
      <Input
        placeholder={placeholder}
        value={inputValue}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => {
          if (inputValue.length >= 2) setIsOpen(true);
        }}
        onBlur={() => setTimeout(() => setIsOpen(false), 300)}
        className={cn(
          'h-12 pl-8 text-base bg-transparent border-0 border-b rounded-none focus:ring-0 font-sans truncate',
          showValidationHint ? 'border-destructive' : 'border-border focus:border-primary'
        )}
      />
      {showValidationHint && (
        <p className="text-xs text-destructive mt-1">Please select a valid city from the dropdown</p>
      )}
      {showDropdown && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-full left-0 right-0 mt-2 bg-card border border-border shadow-elevated z-50 overflow-hidden max-h-80 overflow-y-auto rounded-xl"
        >
          {loading ? (
            <div className="px-4 py-6 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span className="text-sm font-sans">Searching destinations...</span>
            </div>
          ) : destinations.length > 0 ? (
            destinations.map((dest, idx) => (
              <button
                key={dest.id}
                type="button"
                className={cn(
                  'w-full px-4 py-3 text-left hover:bg-secondary/50 flex items-center gap-3 transition-colors',
                  idx < destinations.length - 1 && 'border-b border-border/50'
                )}
                onPointerDown={(e) => {
                  e.preventDefault();
                  handleSelect(dest);
                }}
              >
                <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-sans text-sm font-medium text-foreground">{dest.city}</p>
                  <p className="text-xs text-muted-foreground">
                    {dest.country}
                    {dest.region ? ` • ${dest.region}` : ''}
                  </p>
                </div>
              </button>
            ))
          ) : inputValue.length >= 2 ? (
            <div className="px-4 py-6 text-center text-muted-foreground text-sm font-sans">
              No destinations found for "{inputValue}"
            </div>
          ) : null}
        </motion.div>
      )}
    </div>
  );
}

export default DestinationAutocomplete;
