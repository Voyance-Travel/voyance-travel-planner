/**
 * MustSeeLandmarkPicker — AI-powered landmark chips + interest categories + custom input
 * Replaces free-text must-do textarea with a curated, tappable experience.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Plus, X, Sparkles, Star } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface Landmark {
  name: string;
  emoji: string;
  category: string;
}

const INTEREST_CATEGORIES = [
  { id: 'history', label: 'History & Museums', emoji: '🏛️' },
  { id: 'food', label: 'Food & Dining', emoji: '🍕' },
  { id: 'shopping', label: 'Shopping', emoji: '🛍️' },
  { id: 'nature', label: 'Parks & Nature', emoji: '🌳' },
  { id: 'culture', label: 'Arts & Culture', emoji: '🎭' },
  { id: 'nightlife', label: 'Nightlife', emoji: '🌙' },
];

interface MustSeeLandmarkPickerProps {
  /** City name(s) to fetch landmarks for */
  cities: string[];
  /** Selected landmark names */
  selectedLandmarks: string[];
  onSelectedLandmarksChange: (landmarks: string[]) => void;
  /** Selected interest category IDs */
  selectedCategories: string[];
  onSelectedCategoriesChange: (categories: string[]) => void;
  /** Custom user-added items */
  customItems: string[];
  onCustomItemsChange: (items: string[]) => void;
  /** Optional free-text notes (kept for backward compat) */
  additionalNotes?: string;
  onAdditionalNotesChange?: (notes: string) => void;
}

export function MustSeeLandmarkPicker({
  cities,
  selectedLandmarks,
  onSelectedLandmarksChange,
  selectedCategories,
  onSelectedCategoriesChange,
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
        setLandmarksByCity(prev => ({ ...prev, [city]: data.landmarks }));
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
    onSelectedLandmarksChange(
      selectedLandmarks.includes(name)
        ? selectedLandmarks.filter(l => l !== name)
        : [...selectedLandmarks, name]
    );
  };

  const toggleCategory = (id: string) => {
    onSelectedCategoriesChange(
      selectedCategories.includes(id)
        ? selectedCategories.filter(c => c !== id)
        : [...selectedCategories, id]
    );
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

  return (
    <div className="space-y-5">
      {/* Interest Categories */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-xs tracking-[0.2em] uppercase font-medium text-muted-foreground">
          <Star className="w-4 h-4" />
          What interests you?
        </label>
        <div className="flex flex-wrap gap-2">
          {INTEREST_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => toggleCategory(cat.id)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm border transition-all duration-200',
                selectedCategories.includes(cat.id)
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-card text-foreground border-border hover:border-primary/50'
              )}
            >
              <span className="mr-1.5">{cat.emoji}</span>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Must-See Landmarks per city */}
      {hasAnyCities && (
        <div className="space-y-4">
          {cities.filter(c => c.trim()).map(city => {
            const cityLandmarks = landmarksByCity[city] || [];
            const isLoading = loading[city];

            return (
              <div key={city} className="space-y-2">
                <label className="flex items-center gap-2 text-xs tracking-[0.2em] uppercase font-medium text-muted-foreground">
                  <Sparkles className="w-4 h-4" />
                  Must-see in {city}
                </label>

                {isLoading ? (
                  <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading top attractions...
                  </div>
                ) : cityLandmarks.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    <AnimatePresence mode="popLayout">
                      {cityLandmarks.map(landmark => (
                        <motion.button
                          key={landmark.name}
                          type="button"
                          layout
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          onClick={() => toggleLandmark(landmark.name)}
                          className={cn(
                            'px-3 py-1.5 rounded-full text-sm border transition-all duration-200',
                            selectedLandmarks.includes(landmark.name)
                              ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                              : 'bg-card text-foreground border-border hover:border-primary/50'
                          )}
                        >
                          <span className="mr-1.5">{landmark.emoji}</span>
                          {landmark.name}
                        </motion.button>
                      ))}
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
        <label className="flex items-center gap-2 text-xs tracking-[0.2em] uppercase font-medium text-muted-foreground">
          <Plus className="w-4 h-4" />
          Add your own must-dos
        </label>

        {customItems.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {customItems.map(item => (
              <span
                key={item}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm bg-primary text-primary-foreground border border-primary"
              >
                {item}
                <button
                  type="button"
                  onClick={() => removeCustomItem(item)}
                  className="ml-0.5 hover:opacity-70"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Input
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="e.g., Eat at Roscioli, See sunset from Piazzale..."
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
