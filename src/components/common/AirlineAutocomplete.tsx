/**
 * AirlineAutocomplete — searchable dropdown for airline selection
 * Uses IATA codes and full airline names
 */
import { useState, useMemo, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface AirlineOption {
  code: string;
  name: string;
}

// Comprehensive list of airlines with IATA codes
const AIRLINE_DATABASE: AirlineOption[] = [
  { code: 'AA', name: 'American Airlines' },
  { code: 'DL', name: 'Delta Air Lines' },
  { code: 'UA', name: 'United Airlines' },
  { code: 'WN', name: 'Southwest Airlines' },
  { code: 'B6', name: 'JetBlue Airways' },
  { code: 'AS', name: 'Alaska Airlines' },
  { code: 'NK', name: 'Spirit Airlines' },
  { code: 'F9', name: 'Frontier Airlines' },
  { code: 'G4', name: 'Allegiant Air' },
  { code: 'HA', name: 'Hawaiian Airlines' },
  { code: 'BA', name: 'British Airways' },
  { code: 'AF', name: 'Air France' },
  { code: 'LH', name: 'Lufthansa' },
  { code: 'KL', name: 'KLM Royal Dutch' },
  { code: 'IB', name: 'Iberia' },
  { code: 'EK', name: 'Emirates' },
  { code: 'QR', name: 'Qatar Airways' },
  { code: 'EY', name: 'Etihad Airways' },
  { code: 'TK', name: 'Turkish Airlines' },
  { code: 'SQ', name: 'Singapore Airlines' },
  { code: 'CX', name: 'Cathay Pacific' },
  { code: 'JL', name: 'Japan Airlines' },
  { code: 'NH', name: 'All Nippon Airways' },
  { code: 'QF', name: 'Qantas' },
  { code: 'AC', name: 'Air Canada' },
  { code: 'AM', name: 'Aeromexico' },
  { code: 'VS', name: 'Virgin Atlantic' },
  { code: 'LA', name: 'LATAM Airlines' },
  { code: 'AV', name: 'Avianca' },
  { code: 'CM', name: 'Copa Airlines' },
  { code: 'SK', name: 'SAS Scandinavian' },
  { code: 'AY', name: 'Finnair' },
  { code: 'OS', name: 'Austrian Airlines' },
  { code: 'SN', name: 'Brussels Airlines' },
  { code: 'TP', name: 'TAP Portugal' },
  { code: 'EI', name: 'Aer Lingus' },
  { code: 'LX', name: 'Swiss International' },
  { code: 'U2', name: 'easyJet' },
  { code: 'FR', name: 'Ryanair' },
  { code: 'VY', name: 'Vueling' },
  { code: 'W6', name: 'Wizz Air' },
  { code: 'KE', name: 'Korean Air' },
  { code: 'OZ', name: 'Asiana Airlines' },
  { code: 'CI', name: 'China Airlines' },
  { code: 'BR', name: 'EVA Air' },
  { code: 'MH', name: 'Malaysia Airlines' },
  { code: 'TG', name: 'Thai Airways' },
  { code: 'GA', name: 'Garuda Indonesia' },
  { code: 'SV', name: 'Saudia' },
  { code: 'CA', name: 'Air China' },
  { code: 'CZ', name: 'China Southern' },
  { code: 'MU', name: 'China Eastern' },
  { code: 'HU', name: 'Hainan Airlines' },
  { code: 'AI', name: 'Air India' },
  { code: 'ET', name: 'Ethiopian Airlines' },
  { code: 'MS', name: 'EgyptAir' },
  { code: 'RJ', name: 'Royal Jordanian' },
  { code: 'SA', name: 'South African Airways' },
  { code: 'NZ', name: 'Air New Zealand' },
  { code: 'VA', name: 'Virgin Australia' },
  { code: 'JQ', name: 'Jetstar' },
  { code: 'PR', name: 'Philippine Airlines' },
  { code: 'VN', name: 'Vietnam Airlines' },
  { code: 'WS', name: 'WestJet' },
  { code: 'AZ', name: 'ITA Airways' },
  { code: 'LO', name: 'LOT Polish Airlines' },
  { code: 'RO', name: 'TAROM' },
  { code: 'OK', name: 'Czech Airlines' },
  { code: 'PC', name: 'Pegasus Airlines' },
  { code: 'FZ', name: 'flydubai' },
  { code: 'WY', name: 'Oman Air' },
  { code: 'GF', name: 'Gulf Air' },
  { code: 'UL', name: 'SriLankan Airlines' },
  { code: 'PG', name: 'Bangkok Airways' },
  { code: 'AK', name: 'AirAsia' },
  { code: 'SL', name: 'Thai Lion Air' },
  { code: 'QG', name: 'Citilink' },
  { code: 'ZE', name: 'Eastar Jet' },
  { code: 'LJ', name: 'Jin Air' },
  { code: '7C', name: 'Jeju Air' },
  { code: 'MM', name: 'Peach Aviation' },
  { code: 'BC', name: 'Skymark Airlines' },
  { code: 'HD', name: 'Air Do' },
  { code: 'NU', name: 'Japan Transocean Air' },
];

interface AirlineAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function AirlineAutocomplete({ value, onChange, placeholder = 'e.g. Delta', className }: AirlineAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value
  useEffect(() => {
    setQuery(value);
  }, [value]);

  const filtered = useMemo(() => {
    if (!query.trim()) return AIRLINE_DATABASE.slice(0, 10);
    const q = query.toLowerCase();
    return AIRLINE_DATABASE.filter(
      a => a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectAirline = (airline: AirlineOption) => {
    setQuery(airline.name);
    onChange(airline.name);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault();
      selectAirline(filtered[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <Input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value); // Allow free-text fallback
          setIsOpen(true);
          setHighlightedIndex(-1);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn('text-sm', className)}
        autoComplete="off"
      />
      {isOpen && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((airline, idx) => (
            <button
              key={airline.code}
              type="button"
              className={cn(
                'w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors',
                idx === highlightedIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
              )}
              onMouseDown={(e) => { e.preventDefault(); selectAirline(airline); }}
              onMouseEnter={() => setHighlightedIndex(idx)}
            >
              <img
                src={`https://images.kiwi.com/airlines/64/${airline.code}.png`}
                alt=""
                className="w-5 h-5 rounded-sm object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <span className="flex-1">{airline.name}</span>
              <span className="text-xs text-muted-foreground font-mono">{airline.code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export { AIRLINE_DATABASE };
