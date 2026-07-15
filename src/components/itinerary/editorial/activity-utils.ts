// Extracted from EditorialItinerary.tsx during the file-size decomposition.
// Small pure accessors over an activity/hotel shape.
import type { EditorialActivity } from '../EditorialItinerary';

export function getActivityType(activity: EditorialActivity): string {
  const raw = activity.category || activity.type || 'activity';
  return typeof raw === 'string' ? raw : String(raw);
}

// AI-concierge notes must never attach to a transit/logistics row. Mirrors the
// CONCIERGE_HIDDEN_TYPES set used to hide the concierge entry point on those
// cards — the save path guards the data too, so an id mix-up can't land a note
// on the preceding transit card (the original "note shows on Travel to X" bug).
const NOTE_BLOCKED_TYPES = ['transportation', 'transport', 'transit', 'travel', 'logistics'];
export function isNoteBlockedActivity(activity: EditorialActivity): boolean {
  return NOTE_BLOCKED_TYPES.includes(getActivityType(activity));
}

export function getActivityRating(activity: EditorialActivity): number | null {
  if (typeof activity.rating === 'number') return activity.rating;
  if (typeof activity.rating === 'object' && activity.rating?.value) return activity.rating.value;
  return null;
}

export function getActivityReviewCount(activity: EditorialActivity): number | null {
  if (typeof activity.rating === 'object' && activity.rating?.totalReviews) {
    return activity.rating.totalReviews;
  }
  return null;
}

export function getActivityPhoto(activity: EditorialActivity): string | null {
  // Prefer explicit image_url (set by writeback) over photos array
  const directUrl = (activity as any).image_url;
  if (directUrl && typeof directUrl === 'string' && directUrl.startsWith('http')) return directUrl;
  if (!activity.photos || activity.photos.length === 0) return null;
  const photo = activity.photos[0];
  if (typeof photo === 'string') return photo;
  if (typeof photo === 'object' && photo.url) return photo.url;
  return null;
}

export function getHotelHeroImage(h: any): string | null {
  if (!h) return null;
  const fromVal = (v: any): string | null => {
    if (typeof v === 'string' && v.trim()) return v;
    if (v && typeof v === 'object' && typeof v.url === 'string' && v.url.trim()) return v.url;
    return null;
  };
  const direct = fromVal(h.imageUrl) || fromVal(h.image_url);
  if (direct) return direct;
  const imgs = Array.isArray(h.images) ? h.images : [];
  for (const v of imgs) { const u = fromVal(v); if (u) return u; }
  const photos = Array.isArray(h.photos) ? h.photos : [];
  for (const v of photos) { const u = fromVal(v); if (u) return u; }
  return null;
}
