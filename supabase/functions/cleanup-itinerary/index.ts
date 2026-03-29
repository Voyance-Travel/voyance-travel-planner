import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tripId } = await req.json();
    if (!tripId) {
      return new Response(
        JSON.stringify({ success: false, error: "tripId required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Load trip metadata
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('destination, hotel_selection')
      .eq('id', tripId)
      .single();

    if (tripError || !trip) {
      return new Response(
        JSON.stringify({ success: false, error: "Trip not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const destination = (trip.destination as string) || '';
    const hasHotel = !!trip.hotel_selection;

    // 2. Load all itinerary days
    const { data: days, error: daysError } = await supabase
      .from('itinerary_days')
      .select('*')
      .eq('trip_id', tripId)
      .order('day_number', { ascending: true });

    if (daysError || !days || days.length === 0) {
      return new Response(
        JSON.stringify({ success: true, totalFixes: 0, daysProcessed: 0, message: "No itinerary days found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Clean each day
    let totalFixes = 0;
    const previousVenues = new Set<string>();

    for (const day of days) {
      const activities = (day.activities as any[]) || [];
      let changed = false;
      const cleanedActivities: any[] = [];

      for (const act of activities) {
        const a = { ...act };

        // --- CLEAN TEXT FIELDS ---
        const textFields = ['title', 'name', 'description', 'tips', 'practicalTips', 'voyanceInsight', 'bestTime', 'personalization'];
        for (const field of textFields) {
          if (a[field] && typeof a[field] === 'string') {
            const original = a[field];
            a[field] = cleanAIText(a[field], destination);
            if (a[field] !== original) { changed = true; totalFixes++; }
          }
        }

        // --- DEDUPLICATE TIPS === DESCRIPTION ---
        if (a.tips && a.description && typeof a.tips === 'string' && typeof a.description === 'string') {
          if (a.tips.trim() === a.description.trim()) {
            a.tips = '';
            changed = true;
            totalFixes++;
          }
        }

        // --- STRIP PHANTOM HOTELS (if no hotel booked) ---
        if (!hasHotel) {
          const title = (a.title || a.name || '').toLowerCase();
          const category = (a.category || '').toLowerCase();
          if (
            category === 'hotel_checkin' || category === 'hotel_checkout' ||
            (category === 'accommodation' && /\b(?:check.?in|check.?out)\b/i.test(title))
          ) {
            totalFixes++;
            changed = true;
            continue; // skip this activity
          }
        }

        // --- CROSS-DAY VENUE DEDUP (attractions only, meals exempt) ---
        const venueName = (a.title || a.name || '').toLowerCase().trim();
        const attractionCategories = ['sightseeing', 'attraction', 'museum', 'landmark', 'tour', 'cultural', 'historical'];
        const isAttraction = attractionCategories.includes((a.category || '').toLowerCase());
        if (isAttraction && venueName.length > 5 && previousVenues.has(venueName)) {
          console.log(`[cleanup] Removing duplicate "${venueName}" from day ${day.day_number}`);
          totalFixes++;
          changed = true;
          continue; // skip duplicate
        }

        cleanedActivities.push(a);
      }

      // --- SORT BY TIME ---
      cleanedActivities.sort((a: any, b: any) => {
        const tA = parseTime(a.startTime || a.start_time || a.time || '');
        const tB = parseTime(b.startTime || b.start_time || b.time || '');
        return tA - tB;
      });

      // Track venues for cross-day dedup
      for (const a of cleanedActivities) {
        const name = (a.title || a.name || '').toLowerCase().trim();
        if (name.length > 5) previousVenues.add(name);
      }

      // --- CLEAN DAY-LEVEL TEXT ---
      const updatedFields: Record<string, any> = { activities: cleanedActivities };
      const dayTextFields = ['title', 'theme', 'narrative'] as const;
      for (const field of dayTextFields) {
        if (day[field] && typeof day[field] === 'string') {
          const original = day[field] as string;
          const cleaned = cleanAIText(original, destination);
          if (cleaned !== original) {
            changed = true;
            totalFixes++;
            updatedFields[field] = cleaned;
          }
        }
      }

      // 4. Save back if anything changed
      if (changed) {
        await supabase
          .from('itinerary_days')
          .update(updatedFields)
          .eq('id', day.id);
      }
    }

    console.log(`[cleanup-itinerary] Trip ${tripId}: ${totalFixes} fixes across ${days.length} days`);

    return new Response(
      JSON.stringify({ success: true, totalFixes, daysProcessed: days.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[cleanup-itinerary] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ============================================================
// TEXT CLEANING
// ============================================================

function cleanAIText(text: string, destination: string): string {
  if (!text) return text;
  let t = text;

  // Schema field leaks: ,type ,category ,slot etc
  t = t.replace(/,\s*(?:type|category|slot|isVoyancePick|optionGroup|isOption|tags|bookingRequired)\b[^,.]*/gi, '');

  // Leaked field names at start or after comma
  t = t.replace(/[,;|]*\s*(?:title|name|duration|practicalTips|voyanceInsight|bestTime|personalization|category)\s*[:=]\s*/gi, '');

  // Booking urgency in ALL CAPS
  t = t.replace(/\b(?:BOOK|RESERVE|SECURE)\s+\d[\d-]*\s*(?:WEEKS?|MONTHS?|DAYS?)\s*(?:AHEAD|IN ADVANCE|BEFORE|OUT|EARLY)?\b/gi, '');

  // Emoji booking flags
  t = t.replace(/[🔴🟡🟢🔵]\s*(?:Book|Reserve|BOOK|RESERVE)[^.]*\.?\s*/g, '');

  // System prefixes
  t = t.replace(/\b(?:EDGE_ACTIVITY|SIGNATURE_MEAL|LINGER_BLOCK|TRANSIT_NODE|RECOVERY_SLOT)\b[^.]*/gi, '');

  // AI self-commentary
  t = t.replace(/(?:^|\.\s*)This\s+(?:addresses|fulfills|satisfies|aligns with|caters to|speaks to|reflects)\s+(?:the|your|their)\s+\w+\s+(?:interest|preference|request|need|requirement)\b[^.]*\.?/gi, '');

  // "Profile updated" style
  t = t.replace(/(?:^|\.\s*)(?:Profile updated|Updated pre)[^.]*\.?\s*/gi, '');

  // Reservation urgency labels
  t = t.replace(/\b[Rr]eservation\s*[Uu]rgency[:\s]+\S+[^.]*/g, '');
  t = t.replace(/(?:^|\.\s*)\s*(?:Urgency|Reservation\s*urgency)[:\s]+\w+\.?\s*/gi, '');

  // book_now, book_soon code patterns
  t = t.replace(/\bbook_(?:now|soon|week_before)\b(?:\s+via\s+[^.]+)?\.?\s*/gi, '');

  // Boolean field leaks
  t = t.replace(/\s+(?:is[A-Z]\w+):\s*(?:true|false|null)\.?\s*/g, '');
  t = t.replace(/\b(?:is[A-Z]\w+|book_(?:now|soon|week_before))\b/g, '');

  // ALL CAPS meta in parentheses
  t = t.replace(/\((?:Paid\s+activity|Free\s+to\s+explore)[^)]*\)/gi, '');
  t = t.replace(/\([A-Z][A-Z\s_]{3,}\)/g, '');

  // Walking/transport emoji
  t = t.replace(/🚶\s*\d+\s*min\.\s*/g, '');

  // Distance/cost meta
  t = t.replace(/,?\s*~\d+(?:\.\d+)?(?:km|mi|m)\b,?\s*~\$?\d+/gi, '');

  // "Alternative:" suggestions
  t = t.replace(/\s*Alternative:\s*[^.]+\.?\s*/g, '');

  // Next day planning
  t = t.replace(/(?:Tomorrow|Next\s+(?:morning|day))[:\s]*[A-Z][^.]*\.\s*/g, '');

  // Slot prefix
  t = t.replace(/^slot:\s*/i, '');

  // Forward references
  t = t.replace(/\.\s*(?:rest|recharge|prepare|get ready)\s+for\s+(?:tomorrow|the next day|day \d)[^.]*\.?\s*/gi, '');

  // Walk-in OK meta
  t = t.replace(/\bWalk-in\s+OK\b[^.]*\.\s*/gi, '');

  // "or similar" trailing qualifiers
  t = t.replace(/\s+or\s+(?:high.end|similar|equivalent)[^.]*$/gi, '');

  // AI qualifiers in parentheses
  t = t.replace(/\s*\((?:[^)]*?\b(?:alternative|satellite|or\s+head)[^)]*)\)/gi, '');

  // Generic "the destination" → actual city name
  if (destination) {
    t = t.replace(/\b(?:the destination|the city|this destination|this city)\b/gi, destination);
  }

  // Clean up multiple spaces and trailing punctuation
  t = t.replace(/\s{2,}/g, ' ').trim();
  t = t.replace(/^[,;.\s]+/, '').replace(/[,;]+$/, '').trim();

  return t;
}

function parseTime(time: string): number {
  if (!time) return 0;
  // Handle 12h format
  const match12 = time.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
  if (match12) {
    let h = parseInt(match12[1], 10);
    const m = parseInt(match12[2], 10);
    if (match12[3].toLowerCase() === 'pm' && h !== 12) h += 12;
    if (match12[3].toLowerCase() === 'am' && h === 12) h = 0;
    return h * 60 + m;
  }
  // Handle 24h format
  const match24 = time.match(/(\d{1,2}):(\d{2})/);
  if (!match24) return 0;
  return parseInt(match24[1], 10) * 60 + parseInt(match24[2], 10);
}
