/**
 * Universal address-quality gate — shared between edge functions and frontend.
 *
 * A "weak" address is one that misleads the user — typically because the LLM
 * filled in only a neighborhood / sestiere ("San Marco", "Trastevere") instead
 * of a real street address. We treat such strings as effectively missing so:
 *   1. Pre-save: venue-enrichment can prefer Google Places' formattedAddress
 *      over the LLM-supplied weak string even at lower match confidence.
 *   2. UI: render path hides the misleading line instead of showing a bare
 *      neighborhood as if it were the venue's location.
 */

/** Bare neighborhoods / sestieri / districts that masquerade as addresses. */
export const WEAK_NEIGHBORHOOD_RE = /^(?:san\s*marco|cannaregio|castello|dorsoduro|santa\s*croce|san\s*polo|giudecca|lido|murano|burano|trastevere|monti|prati|testaccio|esquilino|pigneto|ostiense|chiado|alfama|baixa|bairro\s*alto|graça|graca|principe\s*real|principe\s+real|cais\s*do\s*sodr[ée]|le\s*marais|montmartre|saint[\- ]germain|le\s*quartier\s*latin|champs[\- ]elys[ée]es|bastille|belleville|pigalle|soho|shoreditch|mayfair|notting\s*hill|covent\s*garden|south\s*kensington|chelsea|camden|kreuzberg|mitte|prenzlauer\s*berg|friedrichshain|charlottenburg|gr[áa]cia|el\s*born|el\s*raval|el\s*g[óo]tic|barceloneta|eixample|sants|el\s*poble[\- ]nou|shibuya|shinjuku|ginza|asakusa|roppongi|gion|arashiyama|dotonbori|namba|umeda|the\s+downtown|downtown|old\s*town|old\s*city|city\s*centre|city\s*center|el\s*centro|centro\s*storico|centro\s*hist[óo]rico|altstadt)$/i;

/**
 * Returns true when the address is too weak to display or trust.
 * - null / empty / whitespace
 * - shorter than 8 characters
 * - contains no digit (street numbers are near-universal in real addresses)
 * - matches a bare neighborhood / sestiere / district name
 */
export function isWeakAddress(address: unknown): boolean {
  if (typeof address !== 'string') return true;
  const trimmed = address.trim();
  if (trimmed.length < 8) return true;
  if (WEAK_NEIGHBORHOOD_RE.test(trimmed)) return true;
  if (!/\d/.test(trimmed)) {
    // No digit anywhere → almost certainly a neighborhood/POI name, not a
    // street address. Allow PO-box / postal-only edge cases by checking for
    // a comma + uppercase token (city, country) — those usually have numbers
    // too, but be permissive when they don't.
    return true;
  }
  return false;
}
