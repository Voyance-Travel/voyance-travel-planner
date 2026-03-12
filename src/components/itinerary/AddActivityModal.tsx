/**
 * AddActivityModal — Enhanced with hybrid address search
 * Nominatim (free) first, Google Places fallback.
 * Shows transit estimates from/to surrounding activities.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, MapPin, Loader2, Globe, Link2, CheckCircle2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useAddressSearch, type AddressResult } from '@/hooks/useAddressSearch';
import { TransitPreview } from './TransitPreview';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface EditorialActivity {
  id?: string;
  title?: string;
  description?: string;
  category?: string;
  startTime?: string;
  endTime?: string;
  cost?: { amount: number; currency: string };
  location?: { name?: string; address?: string; lat?: number; lng?: number };
  [key: string]: any;
}

interface SurroundingActivity {
  title: string;
  startTime?: string;
  endTime?: string;
  duration?: string;
  location?: { lat?: number; lng?: number; address?: string; name?: string };
}

interface AddActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (activity: Partial<EditorialActivity>) => void;
  currency?: string;
  destination?: string;
  /** Activity before insertion point */
  prevActivity?: SurroundingActivity | null;
  /** Activity after insertion point */
  nextActivity?: SurroundingActivity | null;
}

export function AddActivityModal({ isOpen, onClose, onAdd, currency = 'USD', destination, prevActivity, nextActivity }: AddActivityModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('activity');
  const [startTime, setStartTime] = useState('12:00');
  const [endTime, setEndTime] = useState('13:00');
  const [cost, setCost] = useState('0');
  const [website, setWebsite] = useState('');
  const [reservationMade, setReservationMade] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [locationCoords, setLocationCoords] = useState<{ lat?: number; lng?: number }>({});
  const [showSearch, setShowSearch] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  const { results, isSearching, searchNominatim, searchGoogle, clearResults, hasGoogleFallback } = useAddressSearch();

  // Debounced search
  useEffect(() => {
    if (!showSearch || !searchQuery || searchQuery.length < 2) {
      clearResults();
      return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      searchNominatim(searchQuery, destination);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery, showSearch, destination]);

  const handleSelectResult = useCallback((result: AddressResult) => {
    setLocationName(result.name);
    setLocationAddress(result.address);
    setLocationCoords({ lat: result.lat, lng: result.lng });
    if (!title) setTitle(result.name);
    setShowSearch(false);
    setSearchQuery('');
    clearResults();
  }, [title]);

  const handleGoogleSearch = useCallback(() => {
    if (searchQuery) searchGoogle(searchQuery, destination);
  }, [searchQuery, destination, searchGoogle]);

  const handleSubmit = () => {
    if (!title.trim()) {
      toast.error('Please enter an activity title');
      return;
    }
    if (startTime && endTime && endTime <= startTime) {
      toast.error('End time must be after start time');
      return;
    }
    const costNum = parseFloat(cost) || 0;
    if (costNum < 0) {
      toast.error('Cost cannot be negative');
      return;
    }
    onAdd({
      title: title.trim(),
      description,
      category,
      startTime,
      endTime,
      cost: { amount: costNum, currency },
      website: website.trim() || undefined,
      reservationMade,
      location: {
        name: locationName,
        address: locationAddress,
        ...(locationCoords.lat ? { lat: locationCoords.lat, lng: locationCoords.lng } : {}),
      },
    });
    resetForm();
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCategory('activity');
    setStartTime('12:00');
    setEndTime('13:00');
    setCost('0');
    setWebsite('');
    setReservationMade(false);
    setLocationName('');
    setLocationAddress('');
    setLocationCoords({});
    setShowSearch(true);
    setSearchQuery('');
    clearResults();
  };

  // Build the current location for transit preview
  const newLocation = locationCoords.lat
    ? { lat: locationCoords.lat, lng: locationCoords.lng, address: locationAddress, name: locationName }
    : locationAddress
      ? { address: locationAddress, name: locationName }
      : locationName
        ? { name: locationName }
        : undefined;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Activity</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
          {/* Address Search */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium">Find a Place</label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowSearch(!showSearch)}
                className="text-xs gap-1 h-7"
              >
                <Search className="h-3 w-3" />
                {showSearch ? 'Manual entry' : 'Search by name'}
              </Button>
            </div>

            {showSearch ? (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={`Search places${destination ? ` in ${destination}` : ''}...`}
                    className="pl-9"
                    autoFocus
                  />
                  {isSearching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>

                {/* Results */}
                {results.length > 0 && (
                  <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                    {results.map((r, i) => (
                      <button
                        key={i}
                        onClick={() => handleSelectResult(r)}
                        className="w-full text-left px-3 py-2.5 hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{r.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{r.address}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Google fallback */}
                {searchQuery.length >= 2 && !isSearching && hasGoogleFallback && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleGoogleSearch}
                    className="text-xs gap-1.5 w-full text-muted-foreground hover:text-foreground"
                  >
                    <Globe className="h-3 w-3" />
                    {results.length === 0 ? 'No results - try Google Places' : 'Search Google Places instead'}
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Venue Name</label>
                    <Input value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="e.g. Zeerovers" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Address</label>
                    <Input value={locationAddress} onChange={(e) => setLocationAddress(e.target.value)} placeholder="e.g. Savaneta, Aruba" />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Transit Preview — shown after a place is selected */}
          {newLocation && (prevActivity || nextActivity) && (
            <TransitPreview
              newLocation={newLocation}
              newStartTime={startTime}
              newEndTime={endTime}
              prevActivity={prevActivity}
              nextActivity={nextActivity}
            />
          )}

          {/* Title */}
          <div>
            <label className="text-sm font-medium mb-1 block">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Activity name" />
          </div>

          {/* Category */}
          <div>
            <label className="text-sm font-medium mb-1 block">Category</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sightseeing">Sightseeing</SelectItem>
                <SelectItem value="dining">Dining</SelectItem>
                <SelectItem value="cultural">Cultural</SelectItem>
                <SelectItem value="activity">Activity</SelectItem>
                <SelectItem value="relaxation">Relaxation</SelectItem>
                <SelectItem value="shopping">Shopping</SelectItem>
                <SelectItem value="nightlife">Nightlife</SelectItem>
                <SelectItem value="transportation">Transportation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Start Time</label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">End Time</label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          {/* Cost */}
          <div>
            <label className="text-sm font-medium mb-1 block">Cost ($)</label>
            <Input type="number" min="0" value={cost} onChange={(e) => { const v = e.target.value; if (v === '' || parseFloat(v) >= 0) setCost(v); }} placeholder="0" />
          </div>

          {/* Website / Link */}
          <div>
            <label className="text-sm font-medium mb-1 block">Website / Link</label>
            <div className="relative">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." className="pl-9" />
            </div>
          </div>

          {/* Reservation confirmation */}
          <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
            <Checkbox 
              id="add-reservation-made" 
              checked={reservationMade} 
              onCheckedChange={(checked) => setReservationMade(checked === true)} 
            />
            <label htmlFor="add-reservation-made" className="text-sm font-medium flex items-center gap-2 cursor-pointer">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Reservation / Tickets Confirmed
            </label>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium mb-1 block">Description</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description..." rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!title}>Add Activity</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AddActivityModal;
