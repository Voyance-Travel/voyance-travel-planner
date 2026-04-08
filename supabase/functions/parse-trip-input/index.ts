import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const EXTRACT_TOOL = {
  type: "function" as const,
  function: {
    name: "extract_trip_data",
    description: "Extract structured trip data from pasted text, separating user preferences/prompt from itinerary output.",
    parameters: {
      type: "object",
      properties: {
        preferences: {
          type: "object",
          description: "User preferences extracted from their original prompt (if present). Null if no prompt section detected.",
          properties: {
            budget: { type: "string", description: "Budget text as stated, e.g. '$150-200/day'" },
            budgetLevel: { type: "string", enum: ["budget", "mid-range", "luxury"] },
            focus: { type: "array", items: { type: "string" }, description: "Trip focus areas, e.g. ['food', 'live music']" },
            avoid: { type: "array", items: { type: "string" }, description: "Things to avoid, e.g. ['crowds', 'touristy']" },
            dietary: { type: "array", items: { type: "string" }, description: "Dietary restrictions, e.g. ['vegetarian']" },
            walkability: { type: "string", description: "Walkability preference" },
            pace: { type: "string", description: "Trip pace preference" },
            accessibility: { type: "array", items: { type: "string" } },
            rawPreferenceText: { type: "string", description: "The original prompt text verbatim" },
          },
          additionalProperties: false,
        },
        destination: { type: "string" },
        dates: {
          type: "object",
          properties: {
            start: { type: "string" },
            end: { type: "string" },
          },
          additionalProperties: false,
        },
        duration: { type: "number", description: "Trip duration in days" },
        travelers: { type: "number" },
        tripType: { type: "string" },
        days: {
          type: "array",
          items: {
            type: "object",
            properties: {
              dayNumber: { type: "number" },
              date: { type: "string" },
              theme: { type: "string" },
              dailyBudget: { type: "number" },
              activities: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    time: { type: "string", description: "Time like '9:00 AM', 'Morning', 'Afternoon', 'Evening', 'Lunch', 'Dinner'" },
                    location: { type: "string", description: "Venue/place name or address if provided" },
                    cost: { type: "number" },
                    currency: { type: "string", description: "ISO currency code detected from symbols like $, €, ¥" },
                    notes: { type: "string", description: "Tips, descriptions, parenthetical comments" },
                    description: { type: "string" },
                    category: { type: "string", enum: ["dining", "attraction", "activity", "transport", "lodging", "shopping", "nightlife", "relaxation", "cultural"] },
                    isOption: { type: "boolean", description: "True if this is one of multiple either/or choices" },
                    optionGroup: { type: "string", description: "Shared ID for either/or options, e.g. 'dinner-d1', 'morning-d2'" },
                    bookingRequired: { type: "boolean" },
                  },
                  required: ["name"],
                  additionalProperties: false,
                },
              },
            },
            required: ["dayNumber", "activities"],
            additionalProperties: false,
          },
        },
        accommodationNotes: { type: "array", items: { type: "string" } },
        practicalTips: { type: "array", items: { type: "string" } },
        unparsed: { type: "array", items: { type: "string" }, description: "Text that couldn't be parsed into structured data" },
        tripVibe: { type: "string", description: "The overall vibe/intent of the trip inferred from the pasted text, e.g. 'foodie adventure', 'relaxing wellness retreat', 'party and nightlife', 'cultural deep dive', 'outdoor exploration', 'romantic getaway'. Capture the TONE and PURPOSE the user clearly intended." },
        tripPriorities: { type: "array", items: { type: "string" }, description: "Top 3-5 specific priorities extracted from the text, e.g. ['food carts', 'craft breweries', 'late-night dining', 'live music']. These are the concrete things the user most wants to experience." },
      },
      required: ["days"],
      additionalProperties: false,
    },
  },
};

const currentYear = new Date().getFullYear();
const SYSTEM_PROMPT = `You are a travel itinerary parser. Your job is to extract structured trip data from user-pasted text, which may come from ChatGPT, Claude, blogs, notes, or other sources.

## CURRENT DATE
Today's date is ${new Date().toISOString().split('T')[0]}. The current year is ${currentYear}.

## CRITICAL DATE RULES — READ CAREFULLY
- The current year is ${currentYear}. NEVER output dates in ${currentYear - 1} or earlier.
- When a user provides only month and day (e.g., "March 15"), assume the current year (${currentYear}).
  If that date has already passed this year, use next year (${currentYear + 1}).
- ALL dates in the output MUST be in the future. Zero exceptions.
- When resolving relative date references (like "next weekend", "this March", "in April"), always use today's date as the reference point.
- Double-check every date you output: if the year is ${currentYear - 1} or earlier, you have made an error.
- CRITICAL: When extracting dates like "June 10–15", the start day is 10, NOT 1. Read the FULL number after the month name. "10" is not "1", "15" is not "1", "22" is not "2". Always preserve the complete day-of-month digits.

## CRITICAL PARSING RULES

### 1. Time Headers Are NOT Activities

These words are TIME SLOTS, not activity names:
- Morning, Afternoon, Evening, Night, Late Night
- Breakfast, Brunch, Lunch, Dinner
- Early Morning, Mid-Morning, Midday, Sunset, Dusk

When you see a time header followed by content, attach the time to the content:

WRONG:
  Input: "Dinner\\n* Uchi"
  Output: [{ name: "Dinner" }, { name: "Uchi" }]

CORRECT:
  Input: "Dinner\\n* Uchi"
  Output: [{ name: "Uchi", time: "Dinner", category: "dining" }]

### 2. Merge Time Headers With Their Content

| Input Pattern | Parsed Output |
|---------------|---------------|
| "Dinner\\n* Uchi" | name: "Uchi", time: "Dinner" |
| "Dinner at Uchi" | name: "Uchi", time: "Dinner" |
| "Dinner — Uchi" | name: "Uchi", time: "Dinner" |
| "Dinner: Uchi" | name: "Uchi", time: "Dinner" |
| "7pm — Dinner at Uchi" | name: "Uchi", time: "7:00 PM" |
| "Evening: Live music at C-Boy's" | name: "C-Boy's", time: "Evening", notes: "live music" |
| "Morning\\n* Meiji Shrine (free)" | name: "Meiji Shrine", time: "Morning", cost: 0 |

### 3. Meal Words Indicate Dining Category

When any of these words appear as a time indicator, set category to "dining":
- Breakfast, Brunch, Lunch, Dinner

Example:
  Input: "Lunch\\n* Franklin BBQ"
  Output: { name: "Franklin BBQ", time: "Lunch", category: "dining" }

### 4. Either/Or Options Must Be Grouped

When the text presents choices (using "or", "OR", parenthetical alternatives), create separate activities with:
- isOption: true
- optionGroup: a unique identifier (e.g., "dinner-day1", "activity-day2-afternoon")

Input:
  "Dinner\\n* Uchi (if you want elevated) or Loro (casual but excellent)"

Output:
  [
    { name: "Uchi", time: "Dinner", category: "dining", notes: "elevated", isOption: true, optionGroup: "dinner-day1" },
    { name: "Loro", time: "Dinner", category: "dining", notes: "casual but excellent", isOption: true, optionGroup: "dinner-day1" }
  ]

### 5. Extract Venue Names From Descriptive Text

Strip action words to get the actual venue/activity name:

| Input | Extracted Name |
|-------|----------------|
| "Live music at The Continental Club" | "The Continental Club" |
| "Swim at Barton Springs Pool" | "Barton Springs Pool" |
| "Coffee at Cosmic Coffee" | "Cosmic Coffee" |
| "Visit the Texas State Capitol" | "Texas State Capitol" |
| "Walk around Omotesando" | "Omotesando" |
| "Explore Harajuku" | "Harajuku" |

Keep the action as a note if it adds context:
  Input: "Swim at Barton Springs Pool (go early; water is cold)"
  Output: { name: "Barton Springs Pool", notes: "swim, go early, water is cold" }

### 6. Extract Costs and Notes From Parentheticals

| Input | Parsed |
|-------|--------|
| "Meiji Shrine (free)" | name: "Meiji Shrine", cost: 0 |
| "teamLab Planets ($30)" | name: "teamLab Planets", cost: 30 |
| "Afuri Ramen (~$15)" | name: "Afuri Ramen", cost: 15 |
| "Franklin BBQ (preorder required)" | name: "Franklin BBQ", notes: "preorder required", bookingRequired: true |
| "Uchi (elevated, $$$)" | name: "Uchi", notes: "elevated, $$$" |

### 7. Recognize Day Structures

Look for day markers in various formats:
- "Day 1", "Day 1:", "Day 1 —", "Day 1 -"
- "Day 1 – Arrival + Easy Austin Vibes" (theme after dash)
- "## Day 1", "**Day 1**" (markdown)
- "Thursday", "Thursday, May 15" (dates as day markers)
- "DAY ONE", "First Day"

Extract:
- dayNumber: sequential integer (1, 2, 3...)
- date: if a specific date is mentioned
- theme: text after the day number (e.g., "Arrival + Easy Austin Vibes")

### 8. Handle Table Formats

For markdown tables, map columns dynamically:

| Their Column Header | Maps To |
|---------------------|---------|
| Time, When, Hour | time |
| Activity, What, Experience, Name | name |
| Location, Where, Place, Venue | location |
| Cost, Price, $, Budget, Amount | cost |
| Notes, Tips, Why, Vibe, Description | notes |
| Duration, Length, Time Spent | duration |
| Reserve?, Book?, Reservation | bookingRequired |

### 9. Preserve Practical Tips Separately

Sections like these go into practicalTips array, NOT activities:
- "Practical Tips", "Tips", "Good to Know", "Notes"
- "Where to Stay" (→ accommodationNotes)

### 10. Ignore Meta Content

Do NOT parse these as activities:
- "If you want, I can...", "Tell me what kind of trip..."
- "Let me know if you'd like...", "I can adjust this for..."

### 11. Detect User Prompt vs AI Output

If the paste contains BOTH a user's original prompt AND an AI's response:

1. Extract **preferences** from the prompt section:
   - Budget signals ("$150-200/day", "mid-range", "budget")
   - Dietary restrictions ("vegetarian", "vegan", "halal")
   - Pace preferences ("relaxed", "packed", "slow")
   - Avoidances ("skip touristy", "avoid crowds")
   - Interests ("food-focused", "music-heavy", "nature")

2. Extract **itinerary** from the output section

Prompt detection signals:
- "Build me a...", "I want...", "My budget is..."
- Text before "---", "===", "Output:", "Here's"
- First-person imperative tone

## CATEGORY VALUES

Use these exact category values:
- "dining" — restaurants, cafes, bars, food experiences
- "attraction" — museums, landmarks, temples, viewpoints
- "activity" — tours, experiences, shows, sports, shopping
- "transport" — flights, trains, transfers
- "lodging" — hotels, check-in/check-out
- "nightlife" — bars, clubs, live music venues
- "relaxation" — spas, beaches, parks for rest
- "cultural" — cultural experiences, ceremonies, workshops
- "shopping" — markets, malls, boutiques

## IMPORTANT

1. NEVER output a time header as an activity name
2. ALWAYS merge time context with the actual venue/activity
3. ALWAYS group either/or options with matching optionGroup
4. If something cannot be parsed, add the raw text to "unparsed" array
5. Prefer extracting too much detail over too little
6. When in doubt about category, use "activity"
7. Detect currency from symbols: $ → USD, € → EUR, ¥ → JPY, £ → GBP
8. "Free" or "free" → cost: 0
9. Be thorough but don't hallucinate data that isn't in the text.`;

/**
 * Infer the canonical currency for a destination string.
 * Priority: US states/cities → USD, Eurozone → EUR, UK → GBP, JP → JPY, etc.
 * Returns null if the destination is too ambiguous to determine.
 */
function inferDestinationCurrency(destination: string): string | null {
  const d = destination.toLowerCase();
  if (!d) return null;

  // United States — state names, abbreviations, and major cities
  const usIndicators = [
    'united states', ', usa', ', us', 'u.s.a', 'u.s.',
    // States
    'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado',
    'connecticut', 'delaware', 'florida', 'georgia', 'hawaii', 'idaho',
    'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana',
    'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota',
    'mississippi', 'missouri', 'montana', 'nebraska', 'nevada',
    'new hampshire', 'new jersey', 'new mexico', 'new york', 'north carolina',
    'north dakota', 'ohio', 'oklahoma', 'oregon', 'pennsylvania',
    'rhode island', 'south carolina', 'south dakota', 'tennessee', 'texas',
    'utah', 'vermont', 'virginia', 'washington', 'west virginia',
    'wisconsin', 'wyoming', 'district of columbia', 'washington d.c.',
    // State abbreviations (as suffix ", TX" etc.)
    ', tx', ', ca', ', ny', ', fl', ', il', ', pa', ', oh', ', ga',
    ', nc', ', mi', ', wa', ', az', ', ma', ', tn', ', in', ', mo',
    ', md', ', wi', ', co', ', mn', ', sc', ', al', ', la', ', ky',
    ', or', ', ok', ', ct', ', ut', ', ia', ', nv', ', ar', ', ms',
    ', ks', ', nm', ', ne', ', wv', ', id', ', hi', ', nh', ', me',
    ', mt', ', ri', ', de', ', sd', ', nd', ', ak', ', vt', ', wy',
    // Major US cities that could be ambiguous
    'austin', 'nashville', 'denver', 'portland', 'seattle', 'chicago',
    'los angeles', 'san francisco', 'new orleans', 'miami', 'boston',
    'atlanta', 'dallas', 'houston', 'phoenix', 'philadelphia', 'detroit',
    'las vegas', 'minneapolis', 'salt lake city', 'san diego', 'san antonio',
    'jacksonville', 'memphis', 'louisville', 'baltimore', 'milwaukee',
  ];
  if (usIndicators.some(i => d.includes(i))) return 'USD';

  // Canada
  if (d.includes('canada') || d.includes('ontario') || d.includes('british columbia') ||
      d.includes('quebec') || d.includes('alberta') || d.includes('toronto') ||
      d.includes('vancouver') || d.includes('montreal') || d.includes(', bc') ||
      d.includes(', on') || d.includes(', qc') || d.includes(', ab')) return 'CAD';

  // UK
  if (d.includes('united kingdom') || d.includes('england') || d.includes('scotland') ||
      d.includes('wales') || d.includes('northern ireland') || d.includes('london') ||
      d.includes('manchester') || d.includes('edinburgh') || d.includes(', uk') ||
      d.includes(', gb')) return 'GBP';

  // Eurozone countries
  const euCountries = [
    'france', 'paris', 'germany', 'berlin', 'spain', 'madrid', 'barcelona',
    'italy', 'rome', 'milan', 'portugal', 'lisbon', 'netherlands', 'amsterdam',
    'belgium', 'brussels', 'austria', 'vienna', 'greece', 'athens',
    'ireland', 'dublin', 'finland', 'helsinki', 'luxembourg',
    'malta', 'cyprus', 'slovakia', 'slovenia', 'estonia', 'latvia',
    'lithuania', 'croatia', 'europe',
  ];
  if (euCountries.some(i => d.includes(i))) return 'EUR';

  // Japan
  if (d.includes('japan') || d.includes('tokyo') || d.includes('osaka') ||
      d.includes('kyoto') || d.includes('hiroshima') || d.includes('sapporo')) return 'JPY';

  // Australia
  if (d.includes('australia') || d.includes('sydney') || d.includes('melbourne') ||
      d.includes('brisbane') || d.includes('perth') || d.includes(', au')) return 'AUD';

  // Mexico
  if (d.includes('mexico') || d.includes('cancun') || d.includes('mexico city') ||
      d.includes('oaxaca') || d.includes('guadalajara') || d.includes('tulum')) return 'MXN';

  // Thailand
  if (d.includes('thailand') || d.includes('bangkok') || d.includes('chiang mai') ||
      d.includes('phuket') || d.includes('koh samui')) return 'THB';

  // India
  if (d.includes('india') || d.includes('mumbai') || d.includes('delhi') ||
      d.includes('bangalore') || d.includes('goa') || d.includes('kerala')) return 'INR';

  // Return null if destination is too ambiguous
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();

    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'Text input is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (text.length > 50000) {
      return new Response(JSON.stringify({ error: 'Input too long. Please paste a shorter itinerary.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text },
        ],
        tools: [EXTRACT_TOOL],
        tool_choice: { type: "function", function: { name: "extract_trip_data" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait a moment and try again." }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Service temporarily unavailable. Please try again later." }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({
        error: "AI service error — please try again",
        stage: "ai_gateway",
        details: `Status ${response.status}`,
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let result: any;
    try {
      result = await response.json();
    } catch (jsonErr) {
      console.error("AI response JSON parse error:", jsonErr);
      return new Response(JSON.stringify({
        error: "AI returned an invalid response — please try again",
        stage: "ai_response_parse",
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response:", JSON.stringify(result).slice(0, 500));
      return new Response(JSON.stringify({
        error: "Could not extract structured data from your input — try reformatting",
        stage: "tool_call_extraction",
      }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch (parseErr) {
      console.error("Tool call arguments JSON parse error:", parseErr, toolCall.function.arguments?.slice(0, 300));
      return new Response(JSON.stringify({
        error: "AI returned malformed data — please try again",
        stage: "arguments_parse",
      }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- CJK / schema-leak sanitization ---
    // AI models sometimes inject Chinese characters or leak schema field names
    // (e.g. "宣,duration:4,practicalTips;|") into text values.
    const CJK_RE = /[\u4E00-\u9FFF\u3400-\u4DBF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF\uF900-\uFAFF]/g;
    const SCHEMA_LEAK_RE = /[,;|]*\s*(?:duration|practicalTips|accommodationNotes|tripVibe|tripPriorities|theme|dayNumber|activities|unparsed|dates|travelers|tripType)\s*[:;|]\s*[^,;|]*/gi;
    
    function sanitizeStr(s: string): string {
      if (!s || typeof s !== 'string') return s;
      let cleaned = s.replace(CJK_RE, '').replace(SCHEMA_LEAK_RE, '').trim();
      // Remove leading/trailing punctuation artifacts
      cleaned = cleaned.replace(/^[,;|:\s]+|[,;|:\s]+$/g, '').trim();
      return cleaned;
    }
    
    function sanitizeDeep(obj: unknown): unknown {
      if (typeof obj === 'string') return sanitizeStr(obj);
      if (Array.isArray(obj)) return obj.map(sanitizeDeep);
      if (obj && typeof obj === 'object') {
        const result: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
          result[k] = sanitizeDeep(v);
        }
        return result;
      }
      return obj;
    }
    
    // Sanitize all string fields in the parsed output
    parsed = sanitizeDeep(parsed) as typeof parsed;
    // Apply in-place to top-level fields
    if (parsed.destination && typeof parsed.destination === 'string') {
      parsed.destination = sanitizeStr(parsed.destination);
      // Strip IANA timezone identifiers that the AI sometimes appends (e.g. "Barcelona Africa/Casablanca")
      parsed.destination = parsed.destination.replace(/\s+[A-Z][a-z]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?/g, '').trim();
    }
    if (parsed.tripVibe && typeof parsed.tripVibe === 'string') parsed.tripVibe = sanitizeStr(parsed.tripVibe);
    if (parsed.days) {
      for (const day of parsed.days) {
        if (day.theme) day.theme = sanitizeStr(day.theme);
        if (day.activities) {
          for (const act of day.activities) {
            if (act.name) act.name = sanitizeStr(act.name);
            if (act.notes) act.notes = sanitizeStr(act.notes);
            if (act.description) act.description = sanitizeStr(act.description);
            if (act.location) act.location = sanitizeStr(act.location);
          }
        }
      }
    }
    if (parsed.accommodationNotes) parsed.accommodationNotes = parsed.accommodationNotes.map((n: string) => sanitizeStr(n)).filter(Boolean);
    if (parsed.practicalTips) parsed.practicalTips = parsed.practicalTips.map((t: string) => sanitizeStr(t)).filter(Boolean);
    if (parsed.unparsed) parsed.unparsed = parsed.unparsed.map((u: string) => sanitizeStr(u)).filter(Boolean);
    if (parsed.tripPriorities) parsed.tripPriorities = parsed.tripPriorities.map((p: string) => sanitizeStr(p)).filter(Boolean);

    // --- Time truncation fix ---
    // The AI sometimes truncates multi-digit hours: "11:00 AM" → "1:00 AM".
    // Cross-reference extracted times against the raw text to catch this.
    if (parsed.days) {
      const timePatternGlobal = /(\d{1,2}):(\d{2})\s*(am|pm)?/gi;
      const rawTimes: Array<{ hour: string; min: string; ampm: string; pos: number; full: string }> = [];
      let tm: RegExpExecArray | null;
      while ((tm = timePatternGlobal.exec(text)) !== null) {
        rawTimes.push({
          hour: tm[1],
          min: tm[2],
          ampm: (tm[3] || '').toLowerCase(),
          pos: tm.index,
          full: tm[0],
        });
      }

      if (rawTimes.length > 0) {
        for (const day of parsed.days) {
          if (!day.activities) continue;
          for (const act of day.activities) {
            if (!act.time) continue;
            const aiTimeMatch = act.time.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
            if (!aiTimeMatch) continue;
            const aiHour = aiTimeMatch[1];
            const aiMin = aiTimeMatch[2];
            const aiAmpm = (aiTimeMatch[3] || '').toLowerCase();

            const actName = (act.name || act.title || '').toLowerCase();
            const keywords = actName.split(/[\s,\-–—&]+/).filter((w: string) => w.length > 3).slice(0, 3);
            if (keywords.length === 0) continue;

            const textLower = text.toLowerCase();
            let namePos = -1;
            for (const kw of keywords) {
              const idx = textLower.indexOf(kw);
              if (idx !== -1) { namePos = idx; break; }
            }
            if (namePos === -1) continue;

            let bestRaw: typeof rawTimes[0] | null = null;
            let bestDist = 151;
            for (const rt of rawTimes) {
              const dist = Math.abs(rt.pos - namePos);
              if (dist < bestDist && rt.min === aiMin) {
                if (aiAmpm && rt.ampm && aiAmpm !== rt.ampm) continue;
                bestDist = dist;
                bestRaw = rt;
              }
            }

            if (bestRaw && bestRaw.hour !== aiHour) {
              if (bestRaw.hour.endsWith(aiHour) && bestRaw.hour.length > aiHour.length) {
                console.log(`[parse-trip-input] Time truncation fix: "${act.time}" → "${bestRaw.full}" for activity "${act.name}" (raw text had "${bestRaw.full}")`);
                act.time = bestRaw.full.trim();
              }
            }
          }
        }
      }
    }

    // --- Month-reference date fixing ---
    // When users type "in March", "next June", etc., the AI often defaults
    // start_date to today. Detect month names in the original text and
    // override start_date to the 1st of the nearest upcoming occurrence.
    if (parsed.dates?.start || !parsed.dates) {
      const monthNames: Record<string, number> = {
        january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
        july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
        jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
      };
      // Match patterns like "in March", "in march", "next April", "next april"
      const monthMatch = text.match(/\b(?:in|next|this coming)\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\b/i);
      if (monthMatch) {
        const targetMonth = monthNames[monthMatch[1].toLowerCase()];
        if (targetMonth !== undefined) {
          const now = new Date();
          let year = now.getFullYear();
          const currentMonth = now.getMonth();
          const currentDay = now.getDate();

          // "next" keyword always means next occurrence even if current month
          const isNext = /^next\b/i.test(monthMatch[0]);

          if (targetMonth < currentMonth || (targetMonth === currentMonth && !isNext && currentDay > 1)) {
            // Month already passed this year (or we're past the 1st of current month) → next year
            year += 1;
          } else if (targetMonth === currentMonth && isNext) {
            year += 1;
          }

          const startDate = `${year}-${String(targetMonth + 1).padStart(2, '0')}-01`;

          if (!parsed.dates) {
            parsed.dates = { start: startDate, end: null };
          } else {
            parsed.dates.start = startDate;
          }

          // Recalculate end date if we have duration
          const duration = parsed.duration || parsed.days?.length;
          if (duration && duration > 0) {
            const startD = new Date(year, targetMonth, 1);
            startD.setDate(startD.getDate() + duration - 1);
            parsed.dates.end = `${startD.getFullYear()}-${String(startD.getMonth() + 1).padStart(2, '0')}-${String(startD.getDate()).padStart(2, '0')}`;
          }
        }
      }
    }

    // --- Bare "Month Day" date fixing ---
    // Catches patterns like "March 15", "March 15-28", "Mar 15 to Mar 28"
    // that the above regex misses (it only handles "in March" / "next March")
    if (parsed.dates?.start) {
      const bareMonthDayRe = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}\b/i;
      const bareMatch = text.match(bareMonthDayRe);
      if (bareMatch) {
        const monthNames2: Record<string, number> = {
          january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
          july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
          jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
        };
        const mentionedMonth = monthNames2[bareMatch[1].toLowerCase()];
        if (mentionedMonth !== undefined) {
          const startParts = parsed.dates.start.split('-').map(Number);
          const startYear = startParts[0];
          const now2 = new Date();
          const currentYr = now2.getFullYear();
          
          // If the AI output a past year, fix it
          if (startYear < currentYr) {
            // Determine the next upcoming occurrence of this month
            let fixedYear = currentYr;
            const testDate = new Date(currentYr, mentionedMonth, startParts[2] || 1);
            if (testDate < now2) {
              fixedYear = currentYr + 1;
            }
            const yearDelta = fixedYear - startYear;
            parsed.dates.start = `${fixedYear}-${String(startParts[1]).padStart(2, '0')}-${String(startParts[2]).padStart(2, '0')}`;
            if (parsed.dates.end) {
              const endParts = parsed.dates.end.split('-').map(Number);
              parsed.dates.end = `${endParts[0] + yearDelta}-${String(endParts[1]).padStart(2, '0')}-${String(endParts[2]).padStart(2, '0')}`;
            }
            if (parsed.days) {
              for (const day of parsed.days) {
                if (day.date) {
                  const dp = day.date.split('-').map(Number);
                  if (dp.length === 3) {
                    day.date = `${dp[0] + yearDelta}-${String(dp[1]).padStart(2, '0')}-${String(dp[2]).padStart(2, '0')}`;
                  }
                }
              }
            }
            console.log(`[parse-trip-input] Bare month-day fix: bumped year ${startYear} → ${fixedYear} (detected "${bareMatch[0]}" in input)`);
          }
        }
      }
    }

    // --- Past-date safety net ---
    // If the AI resolved dates to the past, bump them forward.
    // Primary check: if year < current year, always bump (no month/day comparison needed).
    if (parsed.dates?.start) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startParts = parsed.dates.start.split('-').map(Number);
      const currentYearNow = today.getFullYear();
      
      // If the year is strictly less than current year, always bump — don't even compare month/day
      let yearsToAdd = 0;
      if (startParts[0] < currentYearNow) {
        yearsToAdd = currentYearNow - startParts[0];
        // After bumping to current year, check if the date is still in the past
        const bumped = new Date(startParts[0] + yearsToAdd, startParts[1] - 1, startParts[2]);
        if (bumped < today) {
          yearsToAdd += 1;
        }
      } else {
        // Year is current or future — check if the specific date is past
        const startCheck = new Date(startParts[0], startParts[1] - 1, startParts[2]);
        if (startCheck < today) {
          yearsToAdd = 1;
        }
      }
      
      if (yearsToAdd > 0) {
        const newStartYear = startParts[0] + yearsToAdd;
        parsed.dates.start = `${newStartYear}-${String(startParts[1]).padStart(2, '0')}-${String(startParts[2]).padStart(2, '0')}`;
        
        if (parsed.dates.end) {
          const endParts = parsed.dates.end.split('-').map(Number);
          const newEndYear = endParts[0] + yearsToAdd;
          parsed.dates.end = `${newEndYear}-${String(endParts[1]).padStart(2, '0')}-${String(endParts[2]).padStart(2, '0')}`;
        }
        
        // Also fix individual day dates
        if (parsed.days) {
          for (const day of parsed.days) {
            if (day.date) {
              const dayParts = day.date.split('-').map(Number);
              if (dayParts.length === 3) {
                day.date = `${dayParts[0] + yearsToAdd}-${String(dayParts[1]).padStart(2, '0')}-${String(dayParts[2]).padStart(2, '0')}`;
              }
            }
          }
        }
        
        console.log(`[parse-trip-input] Past-date safety net: bumped dates forward by ${yearsToAdd} year(s): ${startParts[0]} → ${newStartYear}`);
      }
    }

    // --- Day-of-month validation against raw text ---
    // The AI sometimes truncates multi-digit days: "June 10" → day 1 instead of 10.
    // Extract explicit day numbers from the user's raw text and compare.
    if (parsed.dates?.start) {
      const monthNamesMap: Record<string, number> = {
        january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
        july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
        jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
      };

      // Pattern: "Month DD" with optional range "Month DD–DD", "Month DD - DD", "Month DD to DD", "Month DD to Month DD"
      const monthDayRangeRe = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?\s*(?:[–\-—]|to)\s*(?:(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+)?(\d{1,2})(?:st|nd|rd|th)?\b/i;
      // Pattern: "DD–DD Month" or "DD to DD Month"
      const dayRangeMonthRe = /\b(\d{1,2})(?:st|nd|rd|th)?\s*(?:[–\-—]|to)\s*(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\b/i;
      // Pattern: single "Month DD" (no range)
      const singleMonthDayRe = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i;

      let rawStartDay: number | null = null;
      let rawEndDay: number | null = null;
      let rawMonth: number | null = null;

      const rangeMatch1 = text.match(monthDayRangeRe);
      const rangeMatch2 = text.match(dayRangeMonthRe);

      if (rangeMatch1) {
        rawMonth = monthNamesMap[rangeMatch1[1].toLowerCase()] || null;
        rawStartDay = parseInt(rangeMatch1[2], 10);
        rawEndDay = parseInt(rangeMatch1[3], 10);
      } else if (rangeMatch2) {
        rawStartDay = parseInt(rangeMatch2[1], 10);
        rawEndDay = parseInt(rangeMatch2[2], 10);
        rawMonth = monthNamesMap[rangeMatch2[3].toLowerCase()] || null;
      } else {
        const singleMatch = text.match(singleMonthDayRe);
        if (singleMatch) {
          rawMonth = monthNamesMap[singleMatch[1].toLowerCase()] || null;
          rawStartDay = parseInt(singleMatch[2], 10);
        }
      }

      if (rawStartDay !== null && rawStartDay >= 1 && rawStartDay <= 31) {
        const sp = parsed.dates.start.split('-').map(Number);
        const aiStartDay = sp[2];
        const monthMatches = rawMonth === null || rawMonth === sp[1];
        if (monthMatches && aiStartDay !== rawStartDay) {
          console.log(`[parse-trip-input] Day-of-month fix: start day ${aiStartDay} → ${rawStartDay} (raw text had "${rangeMatch1?.[0] || rangeMatch2?.[0] || text.match(singleMonthDayRe)?.[0]}")`);
          parsed.dates.start = `${sp[0]}-${String(sp[1]).padStart(2, '0')}-${String(rawStartDay).padStart(2, '0')}`;
        }

        if (rawEndDay !== null && rawEndDay >= 1 && rawEndDay <= 31 && parsed.dates.end) {
          const ep = parsed.dates.end.split('-').map(Number);
          const aiEndDay = ep[2];
          const endMonthMatches = rawMonth === null || rawMonth === ep[1];
          if (endMonthMatches && aiEndDay !== rawEndDay) {
            console.log(`[parse-trip-input] Day-of-month fix: end day ${aiEndDay} → ${rawEndDay}`);
            parsed.dates.end = `${ep[0]}-${String(ep[1]).padStart(2, '0')}-${String(rawEndDay).padStart(2, '0')}`;
          }
        }

        // Recalculate individual day.date values from corrected start
        if (parsed.days && parsed.dates.start) {
          const [sy, sm, sd] = parsed.dates.start.split('-').map(Number);
          for (let i = 0; i < parsed.days.length; i++) {
            const dayDate = new Date(sy, sm - 1, sd + i);
            parsed.days[i].date = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, '0')}-${String(dayDate.getDate()).padStart(2, '0')}`;
          }
        }
      }
    }

    // Detect the canonical currency for the destination so that trips to
    // e.g. Austin, Texas are always USD even if the source material used € signs.
    const destinationCurrency = inferDestinationCurrency(parsed.destination || '');

    // Add source: 'parsed' to all activities and normalize currency
    if (parsed.days) {
      for (const day of parsed.days) {
        if (day.activities) {
          for (const activity of day.activities) {
            activity.source = 'parsed';
            if (activity.currency && destinationCurrency) {
              activity.currency = destinationCurrency;
            } else if (!activity.currency && destinationCurrency) {
              activity.currency = destinationCurrency;
            }
          }
        }
      }
    }

    // Attach the resolved destination currency at the top level so
    // createTripFromParsed can use it when inserting the trip record.
    if (destinationCurrency) {
      parsed.detectedCurrency = destinationCurrency;
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error("parse-trip-input error:", err);
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : "Unknown error",
      stage: "unexpected",
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
