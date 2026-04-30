/**
 * weather-fetch.ts — best-effort weather lookup for Day Brief enrichment.
 *
 * Uses Open-Meteo (no API key) when network is available. Returns null on any
 * failure — weather is enrichment only, never a hard requirement.
 *
 * Currently a stub that always returns null to avoid network calls during
 * synchronous prompt assembly. Wire up when a caching strategy is in place.
 */

export interface WeatherSummary {
  summary: string;       // e.g. "18°C, light rain in afternoon"
  rainProb?: number;     // 0–100
  tempCelsius?: number;
}

export async function fetchWeatherSummary(
  _city: string,
  _dateYMD: string,
): Promise<WeatherSummary | null> {
  // Stub. Production wire-up should call open-meteo and cache by trip.
  return null;
}
