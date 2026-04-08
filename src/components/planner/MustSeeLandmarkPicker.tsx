/**
 * MustSeeLandmarkPicker — AI-powered landmark suggestions + custom input
 * Clean, professional layout inspired by booking sites.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Plus, X, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface Landmark {
  name: string;
  category: string;
}

interface MustSeeLandmarkPickerProps {
  cities: string[];
  selectedLandmarks: string[];
  onSelectedLandmarksChange: (landmarks: string[]) => void;
  customItems: string[];
  onCustomItemsChange: (items: string[]) => void;
}

export function MustSeeLandmarkPicker({
  cities,
  selectedLandmarks,
  onSelectedLandmarksChange,
  customItems,
  onCustomItemsChange,
}: MustSeeLandmarkPickerProps) {
  const [landmarksByCity, setLandmarksByCity] = useState<Record<string, Landmark[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [customInput, setCustomInput] = useState('');

  const fetchLandmarks = useCallback(async (city: string) => {
    if (landmarksByCity[city] || loading[city]) return;
    
    setLoading(prev => ({ ...prev, [city]: true }));
    try {
      const { data, error } = await supabase.functions.invoke('suggest-landmarks', {
        body: { city },
      });
      if (!error && data?.landmarks) {
        // Strip emoji field if present from API response
        const cleaned = (data.landmarks as any[]).map(({ emoji, ...rest }) => rest);
        setLandmarksByCity(prev => ({ ...prev, [city]: cleaned }));
      }
    } catch (e) {
      console.error(`Failed to fetch landmarks for ${city}:`, e);
    } finally {
      setLoading(prev => ({ ...prev, [city]: false }));
    }
  }, [landmarksByCity, loading]);

  useEffect(() => {
    cities.forEach(city => {
      if (city.trim()) fetchLandmarks(city.trim());
    });
  }, [cities.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleLandmark = (name: string) => {
    const isCurrentlySelected = selectedLandmarks.includes(name);
    const updated = isCurrentlySelected
      ? selectedLandmarks.filter(l => l !== name)
      : [...selectedLandmarks, name];
    onSelectedLandmarksChange(updated);
  };

  const addCustomItem = () => {
    const trimmed = customInput.trim();
    if (trimmed && !customItems.includes(trimmed)) {
      onCustomItemsChange([...customItems, trimmed]);
      setCustomInput('');
    }
  };

  const removeCustomItem = (item: string) => {
    onCustomItemsChange(customItems.filter(i => i !== item));
  };

  const hasAnyCities = cities.some(c => c.trim());
  const filteredCities = cities.filter(c => c.trim());

  return (
    <div className="space-y-5">
      {/* Landmarks per city */}
      {hasAnyCities && (
        <div className="space-y-4">
          {filteredCities.map((city, idx) => {
            const cityLandmarks = landmarksByCity[city] || [];
            const isLoading = loading[city];

            return (
              <div key={city} className="space-y-2">
                {/* City divider — simple text, no icons */}
                {filteredCities.length > 1 && (
                  <>
                    {idx > 0 && <Separator className="my-3" />}
                    <p className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
                      {city}
                    </p>
                  </>
                )}

                {isLoading ? (
                  <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Finding top attractions…
                  </div>
                ) : cityLandmarks.length > 0 ? (
                  <div className="grid gap-1.5">
                    <AnimatePresence mode="popLayout">
                      {cityLandmarks.map(landmark => {
                        const isSelected = selectedLandmarks.includes(landmark.name);
                        return (
                          <motion.button
                            key={landmark.name}
                            type="button"
                            layout
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            onClick={() => toggleLandmark(landmark.name)}
                            aria-pressed={isSelected}
                            data-selected={isSelected}
                            className={cn(
                              'flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg border transition-colors duration-150',
                              isSelected
                                ? 'border-primary/40 bg-primary/5'
                                : 'border-border bg-card hover:bg-muted/50'
                            )}
                          >
                            {/* Checkbox indicator */}
                            <span
                              className={cn(
                                'flex items-center justify-center w-5 h-5 rounded border transition-colors shrink-0',
                                isSelected
                                  ? 'bg-primary border-primary text-primary-foreground'
                                  : 'border-border bg-background'
                              )}
                            >
                              {isSelected && <Check className="w-3 h-3" />}
                            </span>

                            <span className="flex-1 min-w-0">
                              <span className="text-sm text-foreground">{landmark.name}</span>
                              {landmark.category && (
                                <span className="ml-2 text-xs text-muted-foreground">{landmark.category}</span>
                              )}
                            </span>
                          </motion.button>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground py-1">
                    No suggestions available for this destination.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Custom must-do items */}
      <div className="space-y-2">
        <label className="text-xs tracking-wide uppercase font-medium text-muted-foreground">
          Add your own must-dos
        </label>

        {customItems.length > 0 && (
          <div className="grid gap-1.5 mb-2">
            {customItems.map(item => (
              <div
                key={item}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-primary/40 bg-primary/5"
              >
                <span className="flex items-center justify-center w-5 h-5 rounded bg-primary border-primary text-primary-foreground shrink-0">
                  <Check className="w-3 h-3" />
                </span>
                <span className="flex-1 text-sm text-foreground">{item}</span>
                <button
                  type="button"
                  onClick={() => removeCustomItem(item)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Input
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="e.g., Eat at Roscioli, See sunset from Piazzale…"
            className="text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustomItem();
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addCustomItem}
            disabled={!customInput.trim()}
            className="shrink-0"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Press Enter or tap Add. These will be prioritized in your itinerary.
        </p>
      </div>
    </div>
  );
}

export default MustSeeLandmarkPicker;
