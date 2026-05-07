/**
 * Shared "is this a walking leg?" predicate.
 * Walking legs MUST snapshot $0 in activity_costs regardless of stored category.
 *
 * Mirrored frontend-side in src/lib/cost-estimation.ts (isWalkingLeg).
 *
 * Excludes booked guided "walking tour" experiences — those have a real ticket
 * cost and are paid like any other tour.
 */

const WALK_TITLE_RE = /^\s*(?:walk|stroll)\b/i;
const WALKING_VERB_RE = /\bwalking\s+(?:to|along|through|around)\b/i;
const WALKING_TOUR_RE = /\bwalking\s+tour\b/i;

export interface WalkingLegInput {
  title?: string | null;
  name?: string | null;
  description?: string | null;
  bookingRequired?: boolean | null;
  booking_required?: boolean | null;
}

export function isWalkingLeg(activity: WalkingLegInput): boolean {
  const title = (activity.title || activity.name || '').trim();
  const desc = (activity.description || '').trim();
  if (!title && !desc) return false;

  const matches =
    WALK_TITLE_RE.test(title) ||
    WALKING_VERB_RE.test(title) ||
    WALKING_VERB_RE.test(desc);
  if (!matches) return false;

  // A booked guided "walking tour" is a paid experience — exclude.
  const isBooked = activity.bookingRequired === true || activity.booking_required === true;
  if (isBooked && (WALKING_TOUR_RE.test(title) || WALKING_TOUR_RE.test(desc))) return false;

  return true;
}
