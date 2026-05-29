/**
 * Neighborhood Coherence Guard
 *
 * Closes the gap in enforceGeoCoherence (schedule-executioner.ts:456) where
 * activities with NO `neighborhood` field AND no coordinates silently bypass
 * the geo-outlier check entirely.
 *
 * Root cause chain for "Alfama Wandering day → Av. da Liberdade activity":
 *
 *   1. `neighborhoodOf(a)` returns "" when activity has no `neighborhood`,
 *      `location.neighborhood`, `location.address`, or `address`.
 *      The title-token branch is guarded by `if (tokens.length > 0 && hood)`,
 *      so an empty `hood` short-circuits it — no mismatch is ever raised.
 *      (schedule-executioner.ts:456)
 *
 *   2. The coord-based fallback only fires when ≥2 activities carry coords AND
 *      the candidate exceeds OUTLIER_METERS (7 500 m). Within a compact city like
 *      Lisbon, Alfama → Av. da Liberdade is ≈1.5 km — well under the threshold.
 *      So the distance guard also stays silent. (schedule-executioner.ts:489)
 *
 *   3. `verified-venues-filter.ts` + `cross-city-filter.ts` only block
 *      cross-CITY leaks (wrong city in the same country). Alfama and
 *      Avenida da Liberdade are both Lisbon neighborhoods — neither filter
 *      activates. (verified-venues-filter.ts:20, cross-city-filter.ts:detectCrossCityMention)
 *
 *   4. `geoFlagOnly` defaults to `!geoDropEnabled` which equals `true` when
 *      the env flag is absent, disabling drops entirely.
 *      (action-generate-day.ts:1859, action-generate-trip-day.ts:2558)
 *
 * This module adds a TEXT-SEMANTIC layer: it extracts neighborhood tokens from
 * both the day title AND the activity's own title/description, then compares
 * them against a city-specific neighborhood alias dictionary. A mismatch
 * surfaces even when coords and the `neighborhood` field are absent.
 *
 * Callers integrate via `checkNeighborhoodCoherence`:
 *
 *   const verdict = checkNeighborhoodCoherence(activity, dayTitle, destination);
 *   if (verdict.mismatch) { flag / drop / refill }
 *
 * Used by enforceGeoCoherence as a tertiary signal when `hood` is empty.
 */

// ─────────────────────────────────────────────────────────────────────────────
// City → neighborhood alias dictionary
//
// Keys are normalised neighborhood names (lowercase, no diacritics).
// Values are arrays of alias strings that appear in natural language (title,
// description, address) for that neighborhood.
// ─────────────────────────────────────────────────────────────────────────────

export interface NeighborhoodEntry {
  canonical: string;            // display name
  aliases: string[];            // regex-ready lowercase strings
  /** lat/lng bounding box centre — used for coord cross-check when available */
  approxLat?: number;
  approxLng?: number;
}

type CityNeighborhoods = Record<string, NeighborhoodEntry>;

const CITY_NEIGHBORHOODS: Record<string, CityNeighborhoods> = {
  // ── Lisbon ────────────────────────────────────────────────────────────────
  lisbon: {
    alfama: {
      canonical: 'Alfama',
      aliases: ['alfama'],
      approxLat: 38.7133,
      approxLng: -9.1330,
    },
    mouraria: {
      canonical: 'Mouraria',
      aliases: ['mouraria'],
      approxLat: 38.7172,
      approxLng: -9.1359,
    },
    belem: {
      canonical: 'Belém',
      aliases: ['belém', 'belem'],
      approxLat: 38.6975,
      approxLng: -9.2044,
    },
    baixa: {
      canonical: 'Baixa',
      aliases: ['baixa', 'downtown lisbon', 'city centre'],
      approxLat: 38.7096,
      approxLng: -9.1365,
    },
    chiado: {
      canonical: 'Chiado',
      aliases: ['chiado'],
      approxLat: 38.7103,
      approxLng: -9.1417,
    },
    bairro_alto: {
      canonical: 'Bairro Alto',
      aliases: ['bairro alto'],
      approxLat: 38.7123,
      approxLng: -9.1446,
    },
    avenida_liberdade: {
      canonical: 'Avenida da Liberdade',
      aliases: ['avenida da liberdade', 'av. da liberdade', 'av da liberdade', 'avenida liberdade', 'liberdade avenue'],
      approxLat: 38.7196,
      approxLng: -9.1453,
    },
    parque_nacoes: {
      canonical: 'Parque das Nações',
      aliases: ['parque das nações', 'parque das nacoes', 'expo area', 'oriente'],
      approxLat: 38.7685,
      approxLng: -9.0950,
    },
    lx_factory: {
      canonical: 'LX Factory / Alcântara',
      aliases: ['lx factory', 'alcantara', 'alcântara'],
      approxLat: 38.7025,
      approxLng: -9.1771,
    },
    intendente: {
      canonical: 'Intendente',
      aliases: ['intendente'],
      approxLat: 38.7186,
      approxLng: -9.1327,
    },
    principe_real: {
      canonical: 'Príncipe Real',
      aliases: ['príncipe real', 'principe real'],
      approxLat: 38.7152,
      approxLng: -9.1480,
    },
  },

  // ── Tokyo ─────────────────────────────────────────────────────────────────
  tokyo: {
    shinjuku: {
      canonical: 'Shinjuku',
      aliases: ['shinjuku', 'kabukicho'],
      approxLat: 35.6938,
      approxLng: 139.7034,
    },
    asakusa: {
      canonical: 'Asakusa',
      aliases: ['asakusa', 'senso-ji', 'sensoji', 'senso ji'],
      approxLat: 35.7147,
      approxLng: 139.7966,
    },
    shibuya: {
      canonical: 'Shibuya',
      aliases: ['shibuya', 'daikanyama', 'nakameguro'],
      approxLat: 35.6598,
      approxLng: 139.7004,
    },
    harajuku: {
      canonical: 'Harajuku',
      aliases: ['harajuku', 'omotesando', 'takeshita'],
      approxLat: 35.6702,
      approxLng: 139.7027,
    },
    akihabara: {
      canonical: 'Akihabara',
      aliases: ['akihabara', 'electric town'],
      approxLat: 35.7023,
      approxLng: 139.7745,
    },
  },

  // ── Paris ─────────────────────────────────────────────────────────────────
  paris: {
    le_marais: {
      canonical: 'Le Marais',
      aliases: ['marais', 'le marais'],
      approxLat: 48.8571,
      approxLng: 2.3546,
    },
    montmartre: {
      canonical: 'Montmartre',
      aliases: ['montmartre', 'sacré-cœur', 'sacre coeur'],
      approxLat: 48.8863,
      approxLng: 2.3435,
    },
    saint_germain: {
      canonical: 'Saint-Germain-des-Prés',
      aliases: ['saint-germain', 'saint germain', 'saint germain des pres', 'st germain'],
      approxLat: 48.8540,
      approxLng: 2.3339,
    },
    latin_quarter: {
      canonical: 'Latin Quarter',
      aliases: ['latin quarter', 'quartier latin', 'quartier latin'],
      approxLat: 48.8497,
      approxLng: 2.3469,
    },
    belleville: {
      canonical: 'Belleville',
      aliases: ['belleville'],
      approxLat: 48.8720,
      approxLng: 2.3798,
    },
    champs_elysees: {
      canonical: 'Champs-Élysées',
      aliases: ['champs-élysées', 'champs elysees', 'champs-elysees'],
      approxLat: 48.8698,
      approxLng: 2.3078,
    },
  },

  // ── Rome ──────────────────────────────────────────────────────────────────
  rome: {
    trastevere: {
      canonical: 'Trastevere',
      aliases: ['trastevere'],
      approxLat: 41.8895,
      approxLng: 12.4701,
    },
    campo_de_fiori: {
      canonical: 'Campo de\' Fiori',
      aliases: ["campo de' fiori", 'campo dei fiori', 'campo de fiori'],
      approxLat: 41.8955,
      approxLng: 12.4722,
    },
    monti: {
      canonical: 'Monti',
      aliases: ['monti'],
      approxLat: 41.8942,
      approxLng: 12.4930,
    },
    prati: {
      canonical: 'Prati',
      aliases: ['prati'],
      approxLat: 41.9053,
      approxLng: 12.4620,
    },
    testaccio: {
      canonical: 'Testaccio',
      aliases: ['testaccio'],
      approxLat: 41.8810,
      approxLng: 12.4770,
    },
  },

  // ── Barcelona ─────────────────────────────────────────────────────────────
  barcelona: {
    gothic_quarter: {
      canonical: 'Gothic Quarter',
      aliases: ['gothic quarter', 'barri gòtic', 'barri gotic', 'gòtic'],
      approxLat: 41.3833,
      approxLng: 2.1763,
    },
    born: {
      canonical: 'El Born',
      aliases: ['el born', 'born', 'el born'],
      approxLat: 41.3859,
      approxLng: 2.1832,
    },
    gracia: {
      canonical: 'Gràcia',
      aliases: ['gràcia', 'gracia'],
      approxLat: 41.4033,
      approxLng: 2.1571,
    },
    eixample: {
      canonical: 'Eixample',
      aliases: ['eixample', 'l\'eixample'],
      approxLat: 41.3930,
      approxLng: 2.1617,
    },
    raval: {
      canonical: 'El Raval',
      aliases: ['raval', 'el raval'],
      approxLat: 41.3793,
      approxLng: 2.1683,
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function normalise(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // strip diacritics
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cityKey(destination: string): string | null {
  const d = normalise(destination);
  if (/\blisbon\b|\blisboa\b/.test(d)) return 'lisbon';
  if (/\btokyo\b/.test(d)) return 'tokyo';
  if (/\bparis\b/.test(d)) return 'paris';
  if (/\brome\b|\broma\b/.test(d)) return 'rome';
  if (/\bbarcelona\b/.test(d)) return 'barcelona';
  return null;
}

/**
 * Returns the neighborhood key(s) mentioned in `text` for the given city
 * dictionary, or an empty array if none are recognised.
 */
export function extractNeighborhoodMentions(
  text: string,
  cityHoods: CityNeighborhoods,
): string[] {
  if (!text) return [];
  const n = normalise(text);
  const found: string[] = [];
  for (const [key, entry] of Object.entries(cityHoods)) {
    if (entry.aliases.some((alias) => n.includes(normalise(alias)))) {
      found.push(key);
    }
  }
  return found;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface NeighborhoodCoherenceVerdict {
  /** True when the activity text explicitly names a neighborhood that
   *  contradicts the day theme. */
  mismatch: boolean;
  /** Neighborhood(s) extracted from the day title. */
  dayThemeHoods: string[];
  /** Neighborhood(s) extracted from the activity title + description. */
  activityHoods: string[];
  /** Human-readable explanation (populated only when mismatch = true). */
  detail: string;
}

/**
 * Checks whether an activity's title/description explicitly names a
 * neighborhood that contradicts the day theme, using the city-specific alias
 * dictionary.
 *
 * Called by enforceGeoCoherence when `neighborhoodOf(a)` returns "" (i.e. the
 * structured neighborhood field is missing) to provide a text-semantic
 * fallback that covers the Alfama-day / Av. da Liberdade-activity case.
 *
 * @param activity  Activity object (any shape — we read title/name/description)
 * @param dayTitle  Day title / theme string (e.g. "Alfama Wandering")
 * @param destination  City/destination string (e.g. "Lisbon, Portugal")
 */
export function checkNeighborhoodCoherence(
  activity: Record<string, any>,
  dayTitle: string | null | undefined,
  destination: string,
): NeighborhoodCoherenceVerdict {
  const nothing: NeighborhoodCoherenceVerdict = {
    mismatch: false,
    dayThemeHoods: [],
    activityHoods: [],
    detail: '',
  };

  if (!dayTitle) return nothing;

  const city = cityKey(destination);
  if (!city) return nothing;   // unknown city — never false-positive

  const cityHoods = CITY_NEIGHBORHOODS[city];
  if (!cityHoods) return nothing;

  const dayThemeHoods = extractNeighborhoodMentions(dayTitle, cityHoods);
  if (dayThemeHoods.length === 0) return nothing;  // day title has no known neighborhood

  // Aggregate text from the activity.
  const actText = [
    activity?.title,
    activity?.name,
    activity?.description,
    activity?.subtitle,
    // also scrape the address if it looks like a venue name rather than a coord
    typeof activity?.address === 'string' ? activity.address : null,
    typeof activity?.location === 'string' ? activity.location : null,
    typeof activity?.location?.name === 'string' ? activity.location.name : null,
    typeof activity?.location?.address === 'string' ? activity.location.address : null,
  ]
    .filter(Boolean)
    .join(' ');

  const activityHoods = extractNeighborhoodMentions(actText, cityHoods);
  if (activityHoods.length === 0) return { ...nothing, dayThemeHoods };  // no hood in activity → no contradiction

  // Mismatch = activity mentions at least one hood NOT in the day theme set.
  const conflicts = activityHoods.filter((h) => !dayThemeHoods.includes(h));
  if (conflicts.length === 0) return { ...nothing, dayThemeHoods, activityHoods };  // same hood → coherent

  const themeNames = dayThemeHoods.map((k) => cityHoods[k]?.canonical ?? k).join(', ');
  const conflictNames = conflicts.map((k) => cityHoods[k]?.canonical ?? k).join(', ');

  return {
    mismatch: true,
    dayThemeHoods,
    activityHoods,
    detail: `Activity mentions "${conflictNames}" but day theme is "${themeNames}"`,
  };
}

// Export the dictionary for tests and future extensions.
export { CITY_NEIGHBORHOODS };
