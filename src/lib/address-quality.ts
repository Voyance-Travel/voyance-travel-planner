/**
 * Frontend mirror of supabase/functions/_shared/address-quality.ts.
 * Keep in sync — same regex and same semantics.
 */

export const WEAK_NEIGHBORHOOD_RE = /^(?:san\s*marco|cannaregio|castello|dorsoduro|santa\s*croce|san\s*polo|giudecca|lido|murano|burano|trastevere|monti|prati|testaccio|esquilino|pigneto|ostiense|chiado|alfama|baixa|bairro\s*alto|graça|graca|principe\s*real|principe\s+real|cais\s*do\s*sodr[ée]|le\s*marais|montmartre|saint[\- ]germain|le\s*quartier\s*latin|champs[\- ]elys[ée]es|bastille|belleville|pigalle|soho|shoreditch|mayfair|notting\s*hill|covent\s*garden|south\s*kensington|chelsea|camden|kreuzberg|mitte|prenzlauer\s*berg|friedrichshain|charlottenburg|gr[áa]cia|el\s*born|el\s*raval|el\s*g[óo]tic|barceloneta|eixample|sants|el\s*poble[\- ]nou|shibuya|shinjuku|ginza|asakusa|roppongi|gion|arashiyama|dotonbori|namba|umeda|the\s+downtown|downtown|old\s*town|old\s*city|city\s*centre|city\s*center|el\s*centro|centro\s*storico|centro\s*hist[óo]rico|altstadt)$/i;

export function isWeakAddress(address: unknown): boolean {
  if (typeof address !== 'string') return true;
  const trimmed = address.trim();
  if (trimmed.length < 8) return true;
  if (WEAK_NEIGHBORHOOD_RE.test(trimmed)) return true;
  if (!/\d/.test(trimmed)) return true;
  return false;
}
