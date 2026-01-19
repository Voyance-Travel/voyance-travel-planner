/**
 * Hook for fetching activity placeholder images from Pexels
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Simple in-memory cache to avoid refetching
const imageCache = new Map<string, string>();

// Category-based fallback keywords for better image matching
const CATEGORY_KEYWORDS: Record<string, string> = {
  breakfast: 'breakfast restaurant cafe',
  brunch: 'brunch restaurant food',
  lunch: 'lunch restaurant',
  dinner: 'dinner restaurant fine dining',
  dining: 'restaurant food dining',
  cafe: 'coffee cafe',
  coffee: 'coffee cafe',
  museum: 'museum art gallery',
  cultural: 'culture heritage landmark',
  sightseeing: 'landmark tourist attraction',
  tour: 'guided tour travel',
  activity: 'travel activity adventure',
  adventure: 'adventure outdoor activity',
  spa: 'spa wellness relaxation',
  relaxation: 'relaxation wellness peaceful',
  beach: 'beach ocean seaside',
  shopping: 'shopping market boutique',
  entertainment: 'entertainment show performance',
  nightlife: 'nightlife bar cocktail',
  transportation: 'travel transportation',
  transport: 'travel transportation',
  accommodation: 'hotel room',
};

function getCacheKey(title: string, category?: string): string {
  return `${category || 'activity'}-${title}`.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 50);
}

export function useActivityImage(
  title: string,
  category?: string,
  existingPhoto?: string | null,
  destination?: string
): { imageUrl: string | null; loading: boolean } {
  const [imageUrl, setImageUrl] = useState<string | null>(existingPhoto || null);
  const [loading, setLoading] = useState(!existingPhoto);

  useEffect(() => {
    // If we have an existing photo, use it
    if (existingPhoto) {
      setImageUrl(existingPhoto);
      setLoading(false);
      return;
    }

    const cacheKey = getCacheKey(title, category);
    
    // Check cache first
    if (imageCache.has(cacheKey)) {
      setImageUrl(imageCache.get(cacheKey) || null);
      setLoading(false);
      return;
    }

    // Skip fetching for downtime/free time
    if (category === 'relaxation' && title.toLowerCase().includes('free time')) {
      setLoading(false);
      return;
    }

    // Build search query
    const categoryKeywords = CATEGORY_KEYWORDS[category?.toLowerCase() || 'activity'] || 'travel';
    const searchQuery = `${title} ${categoryKeywords} ${destination || ''}`.trim();

    const fetchImage = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('destination-images', {
          body: {
            destination: searchQuery,
            imageType: 'activity',
            limit: 1,
          },
        });

        if (!error && data?.images?.[0]?.url) {
          const url = data.images[0].url;
          imageCache.set(cacheKey, url);
          setImageUrl(url);
        }
      } catch (err) {
        console.log('[useActivityImage] Failed to fetch image for:', title);
      } finally {
        setLoading(false);
      }
    };

    // Debounce to avoid too many requests
    const timer = setTimeout(fetchImage, 100 + Math.random() * 200);
    return () => clearTimeout(timer);
  }, [title, category, existingPhoto, destination]);

  return { imageUrl, loading };
}

// Pre-generate a placeholder URL based on category (no API call)
export function getActivityPlaceholder(category?: string): string {
  const cat = (category || 'activity').toLowerCase();
  
  // Use Unsplash source for instant placeholder images
  const searchTerms: Record<string, string> = {
    breakfast: 'breakfast,cafe',
    brunch: 'brunch,restaurant',
    lunch: 'lunch,restaurant',
    dinner: 'dinner,restaurant',
    dining: 'restaurant,food',
    cafe: 'coffee,cafe',
    coffee: 'coffee',
    museum: 'museum,art',
    cultural: 'culture,heritage',
    sightseeing: 'landmark,travel',
    tour: 'travel,tour',
    activity: 'travel,adventure',
    adventure: 'adventure,outdoor',
    spa: 'spa,wellness',
    relaxation: 'relax,peaceful',
    beach: 'beach,ocean',
    shopping: 'shopping,market',
    entertainment: 'entertainment,show',
    nightlife: 'bar,nightlife',
  };
  
  const term = searchTerms[cat] || 'travel';
  return `https://source.unsplash.com/96x96/?${term}`;
}
