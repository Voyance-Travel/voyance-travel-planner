/**
 * Destination image URLs served from our own storage bucket.
 * These were backfilled from Unsplash originals into Supabase Storage
 * to avoid external dependency, 404s, and per-request costs.
 *
 * New Orleans uses bundled local assets (src/assets/destinations/).
 */

const STORAGE_BASE = 'https://jsxplunjjvxuejeouwob.supabase.co/storage/v1/object/public/trip-photos/destination';

function img(slug: string, index: number): string {
  return `${STORAGE_BASE}/${slug}-${index}.jpg`;
}

export const DESTINATION_STORAGE_IMAGES: Record<string, { imageUrl: string; images: string[] }> = {
  'paris': {
    imageUrl: img('paris', 0),
    images: [img('paris', 0), img('paris', 1), img('paris', 2)],
  },
  'santorini': {
    imageUrl: img('santorini', 0),
    images: [img('santorini', 0), img('santorini', 1), img('santorini', 2)],
  },
  'bali': {
    imageUrl: img('bali', 0),
    images: [img('bali', 0), img('bali', 1), img('bali', 2)],
  },
  'new-york': {
    imageUrl: img('new-york', 0),
    images: [img('new-york', 0), img('new-york', 1), img('new-york', 2)],
  },
  'kyoto': {
    imageUrl: img('kyoto', 0),
    images: [img('kyoto', 0), img('kyoto', 1), img('kyoto', 2)],
  },
  'lisbon': {
    imageUrl: img('lisbon', 0),
    images: [img('lisbon', 0), img('lisbon', 1), img('lisbon', 2)],
  },
  'cape-town': {
    imageUrl: img('cape-town', 0),
    images: [img('cape-town', 0), img('cape-town', 1), img('cape-town', 2)],
  },
  'mexico-city': {
    imageUrl: img('mexico-city', 0),
    images: [img('mexico-city', 0), img('mexico-city', 1), img('mexico-city', 2)],
  },
  'copenhagen': {
    imageUrl: img('copenhagen', 0),
    images: [img('copenhagen', 0), img('copenhagen', 1), img('copenhagen', 2)],
  },
  'cartagena': {
    // image 0 was 404; use image 1 as hero
    imageUrl: img('cartagena', 1),
    images: [img('cartagena', 1), img('cartagena', 2)],
  },
  'marrakech': {
    imageUrl: img('marrakech', 0),
    images: [img('marrakech', 0), img('marrakech', 1)],
  },
  'vancouver': {
    imageUrl: img('vancouver', 0),
    images: [img('vancouver', 0), img('vancouver', 1)],
  },
  'bangkok': {
    imageUrl: img('bangkok', 0),
    images: [img('bangkok', 0), img('bangkok', 1), img('bangkok', 2)],
  },
  'buenos-aires': {
    imageUrl: img('buenos-aires', 0),
    images: [img('buenos-aires', 0), img('buenos-aires', 1)],
  },
  'reykjavik': {
    imageUrl: img('reykjavik', 0),
    images: [img('reykjavik', 0), img('reykjavik', 1), img('reykjavik', 2)],
  },
  'singapore': {
    imageUrl: img('singapore', 0),
    images: [img('singapore', 0), img('singapore', 1), img('singapore', 2)],
  },
  'florence': {
    imageUrl: img('florence', 0),
    images: [img('florence', 0), img('florence', 1)],
  },
  'oaxaca': {
    imageUrl: img('oaxaca', 0),
    images: [img('oaxaca', 0), img('oaxaca', 2)],
  },
  'seoul': {
    imageUrl: img('seoul', 0),
    images: [img('seoul', 0), img('seoul', 1), img('seoul', 2)],
  },
  'vienna': {
    imageUrl: img('vienna', 0),
    images: [img('vienna', 0), img('vienna', 1)],
  },
  'hanoi': {
    imageUrl: img('hanoi', 0),
    images: [img('hanoi', 0), img('hanoi', 1), img('hanoi', 2)],
  },
  'barcelona': {
    // image 0 was 404; use image 1 as hero
    imageUrl: img('barcelona', 1),
    images: [img('barcelona', 1), img('barcelona', 2)],
  },
  'melbourne': {
    imageUrl: img('melbourne', 0),
    images: [img('melbourne', 0), img('melbourne', 1), img('melbourne', 2)],
  },
  'petra': {
    // image 0 was 404; use image 1 as hero
    imageUrl: img('petra', 1),
    images: [img('petra', 1), img('petra', 2)],
  },
  'cusco': {
    imageUrl: img('cusco', 0),
    images: [img('cusco', 0), img('cusco', 1), img('cusco', 2)],
  },
  'porto': {
    imageUrl: img('porto', 0),
    images: [img('porto', 0), img('porto', 1)],
  },
};
