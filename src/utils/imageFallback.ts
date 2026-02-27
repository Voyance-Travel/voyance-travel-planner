/**
 * Shared image error handler for all <img> elements.
 * Swaps broken images with a clean gradient placeholder.
 * Prevents infinite loops via data-fallback-applied attribute.
 */

/** Gradient placeholder as inline SVG data URI — no external dependency */
const GRADIENT_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0%25' stop-color='%23e8d5c4'/%3E%3Cstop offset='100%25' stop-color='%23c7b299'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='800' height='600' fill='url(%23g)'/%3E%3C/svg%3E";

/**
 * Universal onError handler for <img> tags.
 * Usage: <img src={url} onError={handleImageError} />
 */
export function handleImageError(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  if (img.dataset.fallbackApplied) return; // prevent infinite loop
  img.dataset.fallbackApplied = 'true';
  img.src = GRADIENT_PLACEHOLDER;
}

export { GRADIENT_PLACEHOLDER };
