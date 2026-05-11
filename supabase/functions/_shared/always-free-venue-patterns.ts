/**
 * Shared list of ALWAYS-FREE venue regex patterns.
 *
 * Lives in _shared (not in generate-itinerary/) so consumers outside the
 * generate-itinerary function (e.g. _shared/write-activity-costs.ts, used by
 * sync-trip-cost-table) can import it without the deploy bundler trying to
 * pull in the entire generate-itinerary module graph.
 *
 * generate-itinerary/sanitization.ts re-exports this constant so existing
 * call sites continue to work unchanged.
 */
export const ALWAYS_FREE_VENUE_PATTERNS: RegExp[] = [
  // Parks and gardens (multilingual)
  /\b(garden|jardin|garten|giardino|jardim|park|parc|parque|tuin)\b/i,
  // Public squares and plazas
  /\b(plaza|piazza|place\s|platz|praça|praca|square|largo|campo|plein)\b/i,
  // German `platz` glued onto place names (Alexanderplatz, Potsdamerplatz) — \b fails after a letter run
  /platz(?![\p{L}])/iu,
  // Bridges
  /\b(pont\s|bridge|puente|ponte|br[üu]cke|brug)\b/i,
  // German `brücke` glued onto place names (Oberbaumbrücke) — \b is unreliable around `ü`
  /br[üu]cke(?![\p{L}])/iu,
  // Waterfront walks
  /\b(promenade|esplanade|boardwalk|waterfront|riverside|riverbank|seafront|canal\s+walk|corniche|malec[oó]n|lungomare|lakefront)\b/i,
  // Walks and strolls
  /\b(neighborhood\s+walk|stroll|wander|walking\s+tour|evening\s+(?:walk|stroll)|morning\s+(?:walk|stroll)|historic\s+walk)\b/i,
  // Viewpoints (not observation decks)
  /\b(viewpoint|miradouro|miradouros|mirador|outlook|overlook|belvedere|vista|panoram\w*)\b/i,
  // Religious sites (usually free entry)
  /\b(church|[eé]glise|chiesa|kirche|iglesia|igreja|cathedral|cath[eé]drale|cattedrale|kathedrale|dom|basilica|basilique|basilika|mosque|mosqu[eé]e|moschee|temple|shrine|synagogue|pagoda)\b/i,
  // Unicode-aware match for `église` / `Église` — \b is unreliable when the word starts with `é`/`É`
  /(?:^|[^\p{L}])[eé]glise(?![\p{L}])/iu,
  // Markets (entry free, food priced separately)
  /\b(market|march[eé]|mercato|markt|mercado|feira|bazar|bazaar|souk)\b/i,
  // Monuments and memorials
  /\b(monument|memorial|statue|fountain|fontaine|fontana|brunnen|fuente)\b/i,
  // Districts / neighborhoods
  /\b(district|neighborhood|neighbourhood|bairro|quarter|old\s+town|bookstore|bookshop|livraria|library|biblioteca)\b/i,
  // Paseo
  /\b(paseo)\b/i,
  // Paris-specific free venues
  /\b(champs.?[eé]lys[eé]es|montmartre|sacr[eé].?c[oœ]ur|tuileries|champ\s+de\s+mars|palais.?royal.*garden|seine.*walk|walk.*seine|[iî]le\s+saint.?louis)\b/i,
  // Unicode-aware fallback for `Île Saint-Louis` / `île saint-louis` — \b is unreliable when starting with `Î`/`î`
  /(?:^|[^\p{L}])[iî]le\s+saint.?louis(?![\p{L}])/iu,
];
