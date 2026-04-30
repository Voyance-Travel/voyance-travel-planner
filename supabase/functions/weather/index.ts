import { trackCost } from "../_shared/cost-tracker.ts";
import { corsHeaders, handleCorsPreflightRequest, jsonResponse, errorResponse } from '../_shared/cors.ts';

// ============================================================================
// Types
// ============================================================================

interface WeatherData {
  destination: string;
  current: {
    temp: number;
    feelsLike: number;
    condition: string;
    icon: string;
    humidity: number;
    windSpeed: number;
    precipitation: number;
    uvIndex?: number;
  };
  forecast: Array<{
    date: string;
    high: number;
    low: number;
    condition: string;
    icon: string;
    precipitation: number; // precipChance as percentage
  }>;
  source: 'weatherkit' | 'open-meteo' | 'fallback';
}

// ============================================================================
// Apple WeatherKit JWT
// ============================================================================

async function getWeatherKitToken(): Promise<string> {
  const teamId = Deno.env.get('APPLE_TEAM_ID');
  const keyId = Deno.env.get('APPLE_MAPKIT_KEY_ID'); // Same key for WeatherKit
  const privateKeyPem = Deno.env.get('APPLE_PRIVATE_KEY');

  if (!teamId || !keyId || !privateKeyPem) {
    throw new Error('Apple WeatherKit credentials not configured');
  }

  const pemContent = privateKeyPem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');

  const binaryKey = Uint8Array.from(atob(pemContent), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'ES256', kid: keyId, id: `${teamId}.com.voyancetravel.app` };
  const payload = {
    iss: teamId,
    iat: now,
    exp: now + 3600,
    sub: 'com.voyancetravel.app',
  };

  const b64url = (data: Uint8Array) =>
    btoa(String.fromCharCode(...data))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

  const enc = new TextEncoder();
  const headerB64 = b64url(enc.encode(JSON.stringify(header)));
  const payloadB64 = b64url(enc.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    enc.encode(signingInput)
  );

  const sigBytes = new Uint8Array(signature);
  let sigB64: string;

  if (sigBytes.length === 64) {
    sigB64 = b64url(sigBytes);
  } else {
    const r = extractDERInt(sigBytes, 3);
    const s = extractDERInt(sigBytes, 3 + 1 + sigBytes[3] + 1);
    const raw = new Uint8Array(64);
    raw.set(padTo32(r), 0);
    raw.set(padTo32(s), 32);
    sigB64 = b64url(raw);
  }

  return `${signingInput}.${sigB64}`;
}

function extractDERInt(buf: Uint8Array, offset: number): Uint8Array {
  const len = buf[offset + 1];
  return buf.slice(offset + 2, offset + 2 + len);
}

function padTo32(bytes: Uint8Array): Uint8Array {
  if (bytes.length === 32) return bytes;
  if (bytes.length > 32) return bytes.slice(bytes.length - 32);
  const padded = new Uint8Array(32);
  padded.set(bytes, 32 - bytes.length);
  return padded;
}

// ============================================================================
// Condition code mapping
// ============================================================================

function mapConditionCode(code: string): string {
  const map: Record<string, string> = {
    Clear: 'Clear', MostlyClear: 'Mostly Clear',
    PartlyCloudy: 'Partly Cloudy', MostlyCloudy: 'Mostly Cloudy',
    Cloudy: 'Cloudy', Overcast: 'Overcast',
    Rain: 'Rain', HeavyRain: 'Heavy Rain', Drizzle: 'Light Rain',
    Snow: 'Snow', HeavySnow: 'Heavy Snow', Flurries: 'Flurries',
    Thunderstorms: 'Thunderstorms', SevereThunderstorm: 'Severe Thunderstorm',
    Foggy: 'Foggy', Haze: 'Haze', Windy: 'Windy', Breezy: 'Breezy',
    Hail: 'Hail', Sleet: 'Sleet', FreezingRain: 'Freezing Rain',
    BlowingSnow: 'Blowing Snow', Blizzard: 'Blizzard',
    TropicalStorm: 'Tropical Storm', Hurricane: 'Hurricane',
  };
  return map[code] || code;
}

function getWeatherIcon(condition: string): string {
  const c = condition.toLowerCase();
  if (c.includes('clear') || c.includes('sunny')) return '☀️';
  if (c.includes('mostly clear')) return '🌤️';
  if (c.includes('partly')) return '⛅';
  if (c.includes('cloudy') || c.includes('overcast')) return '☁️';
  if (c.includes('fog')) return '🌫️';
  if (c.includes('rain') || c.includes('drizzle') || c.includes('shower')) return '🌧️';
  if (c.includes('thunder') || c.includes('storm')) return '⛈️';
  if (c.includes('snow') || c.includes('flurr') || c.includes('blizzard')) return '❄️';
  if (c.includes('sleet') || c.includes('freezing')) return '🌨️';
  if (c.includes('hail')) return '🌨️';
  if (c.includes('wind') || c.includes('breezy')) return '💨';
  return '⛅';
}

// Celsius to Fahrenheit
function cToF(c: number): number {
  return Math.round((c * 9) / 5 + 32);
}

// m/s to mph
function msToMph(ms: number): number {
  return Math.round(ms * 2.237);
}

// ============================================================================
// Geocoding (Open-Meteo, free)
// ============================================================================

async function geocodeDestination(destination: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(destination)}&count=1&language=en&format=json`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.results || data.results.length === 0) return null;
    return { lat: data.results[0].latitude, lon: data.results[0].longitude };
  } catch {
    return null;
  }
}

// ============================================================================
// Apple WeatherKit Fetcher
// ============================================================================

async function fetchWeatherKit(
  lat: number,
  lon: number,
  destination: string,
  startDate: string,
  days: number
): Promise<WeatherData | null> {
  try {
    const token = await getWeatherKitToken();

    const weatherUrl = `https://weatherkit.apple.com/api/v1/weather/en-US/${lat}/${lon}?dataSets=currentWeather,forecastDaily`;
    console.log('[Weather] Fetching WeatherKit for:', destination, lat, lon);

    const response = await fetch(weatherUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      console.error('[Weather] WeatherKit HTTP error:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const current = data.currentWeather;
    const daily = data.forecastDaily?.days || [];

    // Filter forecast to trip dates
    const tripStart = new Date(startDate);
    tripStart.setHours(0, 0, 0, 0);

    const filteredDays = daily
      .filter((day: any) => {
        const dayDate = new Date(day.forecastStart);
        dayDate.setHours(0, 0, 0, 0);
        return dayDate >= tripStart;
      })
      .slice(0, days);

    // If WeatherKit returns ZERO days overlapping the trip, fall through.
    // Previously we silently substituted today's window — wrong dates, but
    // displayed as if successful. Now the caller will try Open-Meteo (16-day
    // window) or seasonal estimates instead.
    if (filteredDays.length === 0) {
      console.log('[Weather] WeatherKit returned no days overlapping trip start', startDate, '— falling through');
      return null;
    }

    const conditionStr = current ? mapConditionCode(current.conditionCode) : 'Unknown';

    return {
      destination,
      current: current ? {
        temp: cToF(current.temperature),
        feelsLike: cToF(current.temperatureApparent),
        condition: conditionStr,
        icon: getWeatherIcon(conditionStr),
        humidity: Math.round((current.humidity || 0) * 100),
        windSpeed: msToMph(current.windSpeed || 0),
        precipitation: current.precipitationIntensity || 0,
        uvIndex: current.uvIndex,
      } : {
        temp: 0, feelsLike: 0, condition: 'Unknown', icon: '⛅',
        humidity: 0, windSpeed: 0, precipitation: 0,
      },
      forecast: filteredDays.map((day: any) => {
        const cond = mapConditionCode(day.conditionCode);
        return {
          date: day.forecastStart?.split('T')[0],
          condition: cond,
          icon: getWeatherIcon(cond),
          high: cToF(day.temperatureMax),
          low: cToF(day.temperatureMin),
          precipitation: Math.round((day.precipitationChance || 0) * 100),
        };
      }),
      source: 'weatherkit' as const,
    };
  } catch (error) {
    console.error('[Weather] WeatherKit error:', error);
    return null;
  }
}

// ============================================================================
// Open-Meteo Fallback (free, no API key)
// ============================================================================

async function fetchOpenMeteo(
  lat: number,
  lon: number,
  destination: string,
  startDate: string,
  days: number
): Promise<WeatherData | null> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tripStart = new Date(startDate);
    tripStart.setHours(0, 0, 0, 0);
    const daysUntilTrip = Math.floor((tripStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilTrip >= 16) return null;

    const totalDaysNeeded = Math.min(daysUntilTrip + days, 16);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,precipitation,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum&timezone=auto&forecast_days=${totalDaysNeeded}&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch`;

    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (!data.current || !data.daily) return null;

    const daily = data.daily;
    const tripStartStr = tripStart.toISOString().split('T')[0];
    const startIndex = daily.time.findIndex((d: string) => d >= tripStartStr);
    if (startIndex === -1) return null;

    const getCondition = (code: number) => {
      if (code === 0) return 'Clear';
      if (code <= 3) return 'Partly Cloudy';
      if (code <= 48) return 'Foggy';
      if (code <= 67) return 'Rain';
      if (code <= 77) return 'Snow';
      if (code <= 82) return 'Rain';
      if (code <= 86) return 'Snow';
      return 'Thunderstorms';
    };

    const forecast = daily.time.slice(startIndex, startIndex + days).map((date: string, i: number) => {
      const cond = getCondition(daily.weather_code[startIndex + i]);
      return {
        date,
        high: Math.round(daily.temperature_2m_max[startIndex + i]),
        low: Math.round(daily.temperature_2m_min[startIndex + i]),
        condition: cond,
        icon: getWeatherIcon(cond),
        precipitation: Math.round(daily.precipitation_sum[startIndex + i] || 0),
      };
    });

    const cond = getCondition(data.current.weather_code);

    return {
      destination,
      current: {
        temp: Math.round(data.current.temperature_2m),
        feelsLike: Math.round(data.current.apparent_temperature),
        condition: cond,
        icon: getWeatherIcon(cond),
        humidity: data.current.relative_humidity_2m || 0,
        windSpeed: Math.round(data.current.wind_speed_10m || 0),
        precipitation: Math.round(data.current.precipitation || 0),
      },
      forecast,
      source: 'open-meteo' as const,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// Seasonal Fallback
// ============================================================================

const seasonalPatterns: Record<string, Record<string, { high: number; low: number; condition: string }>> = {
  'europe': { winter: { high: 46, low: 36, condition: 'Cloudy' }, spring: { high: 61, low: 46, condition: 'Partly Cloudy' }, summer: { high: 79, low: 64, condition: 'Clear' }, fall: { high: 57, low: 45, condition: 'Cloudy' } },
  'tropical': { winter: { high: 86, low: 75, condition: 'Clear' }, spring: { high: 90, low: 79, condition: 'Partly Cloudy' }, summer: { high: 91, low: 81, condition: 'Rain' }, fall: { high: 88, low: 77, condition: 'Partly Cloudy' } },
  'mediterranean': { winter: { high: 57, low: 46, condition: 'Partly Cloudy' }, spring: { high: 68, low: 54, condition: 'Clear' }, summer: { high: 90, low: 72, condition: 'Clear' }, fall: { high: 72, low: 57, condition: 'Clear' } },
  'default': { winter: { high: 50, low: 36, condition: 'Cloudy' }, spring: { high: 64, low: 50, condition: 'Partly Cloudy' }, summer: { high: 82, low: 64, condition: 'Clear' }, fall: { high: 61, low: 46, condition: 'Partly Cloudy' } },
};

const regionMapping: Record<string, string> = {
  'paris': 'europe', 'london': 'europe', 'berlin': 'europe', 'amsterdam': 'europe',
  'rome': 'mediterranean', 'barcelona': 'mediterranean', 'lisbon': 'mediterranean', 'athens': 'mediterranean',
  'dubai': 'tropical', 'singapore': 'tropical', 'bangkok': 'tropical', 'bali': 'tropical', 'miami': 'tropical',
  'los angeles': 'mediterranean',
};

function generateFallbackForecast(destination: string, startDate: string, days: number): WeatherData {
  const normalized = destination.toLowerCase();
  let region = 'default';
  for (const [city, r] of Object.entries(regionMapping)) {
    if (normalized.includes(city)) { region = r; break; }
  }
  const patterns = seasonalPatterns[region] || seasonalPatterns['default'];
  const start = new Date(startDate);
  const month = start.getMonth();
  const season = month >= 2 && month <= 4 ? 'spring' : month >= 5 && month <= 7 ? 'summer' : month >= 8 && month <= 10 ? 'fall' : 'winter';
  const base = patterns[season];

  const forecast = Array.from({ length: days }, (_, i) => {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    const v = Math.random() * 4 - 2;
    return {
      date: date.toISOString().split('T')[0],
      high: Math.round(base.high + v),
      low: Math.round(base.low + v),
      condition: base.condition,
      icon: getWeatherIcon(base.condition),
      precipitation: base.condition.toLowerCase().includes('rain') ? 60 : 10,
    };
  });

  return {
    destination,
    current: {
      temp: Math.round(base.high - 3),
      feelsLike: Math.round(base.high - 4),
      condition: base.condition,
      icon: getWeatherIcon(base.condition),
      humidity: 55,
      windSpeed: 12,
      precipitation: forecast[0].precipitation,
    },
    forecast,
    source: 'fallback',
  };
}

// ============================================================================
// Main Handler
// ============================================================================

Deno.serve(async (req) => {
  const corsResp = handleCorsPreflightRequest(req);
  if (corsResp) return corsResp;

  const costTracker = trackCost('weather', 'weatherkit');

  try {
    const body = await req.json();
    const { destination, startDate, days = 7, lat, lng } = body;

    if (!destination) {
      return errorResponse('Destination is required', 400);
    }

    const tripStartDate = startDate || new Date().toISOString().split('T')[0];

    // Resolve coordinates
    let latitude = lat;
    let longitude = lng;

    if (!latitude || !longitude) {
      const geo = await geocodeDestination(destination);
      if (geo) {
        latitude = geo.lat;
        longitude = geo.lon;
      }
    }

    let weather: WeatherData;
    let wkCount = 0;
    let omCount = 0;
    let fbCount = 0;

    if (latitude && longitude) {
      // 1) Try Apple WeatherKit first (~10-day window from today).
      const wk = await fetchWeatherKit(latitude, longitude, destination, tripStartDate, days);

      if (wk && wk.forecast.length >= days) {
        // Full coverage from WeatherKit.
        weather = wk;
        wkCount = wk.forecast.length;
      } else {
        // 2) Either no WeatherKit data, or partial coverage. Get Open-Meteo
        //    (up to 16 days) and merge — WeatherKit days win on overlap.
        const om = await fetchOpenMeteo(latitude, longitude, destination, tripStartDate, days);

        if (wk && om) {
          const wkDates = new Set(wk.forecast.map((d) => d.date));
          const merged = [...wk.forecast];
          for (const omDay of om.forecast) {
            if (merged.length >= days) break;
            if (!wkDates.has(omDay.date)) merged.push(omDay);
          }
          merged.sort((a, b) => a.date.localeCompare(b.date));
          weather = {
            ...wk,
            forecast: merged.slice(0, days),
            source: wk.forecast.length >= Math.ceil(days / 2) ? 'weatherkit' : 'open-meteo',
          };
          wkCount = wk.forecast.length;
          omCount = merged.length - wk.forecast.length;
        } else if (om) {
          weather = om;
          omCount = om.forecast.length;
        } else if (wk) {
          weather = wk;
          wkCount = wk.forecast.length;
        } else {
          weather = generateFallbackForecast(destination, tripStartDate, days);
          fbCount = weather.forecast.length;
        }

        // 3) Pad with seasonal estimates if trip extends past Open-Meteo's
        //    16-day horizon so the UI always shows the full requested window
        //    with correct dates.
        if (weather.forecast.length < days) {
          const fallback = generateFallbackForecast(destination, tripStartDate, days);
          const haveDates = new Set(weather.forecast.map((d) => d.date));
          for (const fbDay of fallback.forecast) {
            if (weather.forecast.length >= days) break;
            if (!haveDates.has(fbDay.date)) {
              weather.forecast.push(fbDay);
              fbCount++;
            }
          }
          weather.forecast.sort((a, b) => a.date.localeCompare(b.date));
        }
      }

      costTracker.addMetadata('source', weather.source);
    } else {
      weather = generateFallbackForecast(destination, tripStartDate, days);
      fbCount = weather.forecast.length;
      console.log('[Weather] ⚠️ No coordinates, using fallback for:', destination);
      costTracker.addMetadata('source', 'fallback');
    }

    console.log(
      `[Weather] coverage "${destination}": weatherkit=${wkCount}, open-meteo=${omCount}, fallback=${fbCount}, requested=${days}, tripStart=${tripStartDate}, source=${weather.source}`
    );

    await costTracker.save();

    return jsonResponse({ weather, success: true });
  } catch (error: unknown) {
    console.error('[Weather] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return errorResponse(message, 500);
  }
});
