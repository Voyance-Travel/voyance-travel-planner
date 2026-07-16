// Extracted from EditorialItinerary.tsx during the file-size decomposition.
// Pure formatting / matching helpers (no external dependencies).

export function formatTime(time: string | undefined): string {
  if (!time || typeof time !== 'string') return '';

  // Strip any non-ASCII characters (e.g. stray Chinese/Unicode from AI output)
  const cleanTime = time.replace(/[^\x00-\x7F]/g, '').trim();
  if (!cleanTime) return '';

  if (/\d{1,2}:\d{2}\s*(AM|PM)/i.test(cleanTime)) {
    return cleanTime;
  }

  const match = cleanTime.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return cleanTime;

  const hours = parseInt(match[1], 10);
  const minutes = match[2];

  if (isNaN(hours)) return cleanTime;

  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes} ${period}`;
}

/** Strip stray non-ASCII characters from AI-generated text fields */
export function sanitizeAiText(text: string | undefined): string {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/[一-鿿㐀-䶿豈-﫿]/g, '').trim();
}

/** Fuzzy location match — handles "Mandarin Oriental, Marrakech" vs "Mandarin Oriental" vs "Mandarin" */
export function isFuzzyLocationMatch(
  a?: { name?: string; address?: string } | null,
  b?: { name?: string; address?: string } | null,
): boolean {
  if (!a || !b) return false;
  if (a.name && b.name && a.name === b.name) return true;
  if (a.address && b.address && a.address === b.address) return true;
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (a.name && b.name) {
    const an = normalize(a.name);
    const bn = normalize(b.name);
    if (an.length >= 4 && bn.length >= 4 && (an.includes(bn) || bn.includes(an))) return true;
  }
  return false;
}

/** Strip airport codes/suffixes from a destination name ("Paris (CDG)" → "Paris") */
export function normalizeDestination(dest: string): string {
  return (dest || '')
    .replace(/\s*\([A-Z]{3}\)\s*$/i, '')
    .replace(/\b(international\s+)?airport\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
