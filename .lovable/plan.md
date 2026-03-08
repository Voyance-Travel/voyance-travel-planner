

## Redesign: Travel DNA Predictions → Personality-Driven Trip Predictions

### Problem
The current implementation treats this as an engagement analytics dashboard (feedback counts, engagement scores, trait shifts). It should be fun, personality-driven predictions based on the user's archetype + destination + itinerary.

### Changes

#### 1. Edge Function (`supabase/functions/mid-trip-dna/index.ts`)

**Remove**: feedback query, memories query, rating analysis, engagement metrics from the prompt.

**Keep**: trip data (destination, itinerary, dates), DNA profile (archetype, trait scores).

**New prompt** — asks AI to generate fun, spontaneous predictions based on personality and destination. Example: "Your Culinary Cartographer DNA says you'll find a hole-in-the-wall restaurant that becomes your favorite."

**New tool schema** — replace current schema with:
- `predictions`: array of 3-4 objects, each with `emoji` (string), `text` (string, the fun prediction sentence)
- `archetypeInsight`: one-liner about how their archetype plays out in this destination
- `headline`: punchy personality-driven headline

Remove `engagementScore`, `traitShifts`, `travelingAs`, `surprisingPattern` from the tool schema.

**Simplified meta** returned: just `archetype`, `tripDay`, `totalDays`.

#### 2. Frontend (`src/components/trips/MidTripDNA.tsx`)

**New interfaces**:
```ts
interface TripPrediction { emoji: string; text: string; }
interface DNAData {
  headline: string;
  archetypeInsight: string;
  predictions: TripPrediction[];
}
```

**Remove**: Engagement Score card, Trait Shifts section, Progress bar import, TrendingUp/Down/Minus icons, Badge for "Traveling as".

**New results UI**:
- Header: "Your Trip Predictions" with `Day X of Y` subtitle (no feedback/photo counts)
- Headline card with archetype insight below
- Prediction cards: each is a lightweight card with emoji + prediction text, staggered animation
- Refresh button stays

**Initial state copy**: Change from "analyze your ratings" to "See what your Travel DNA predicts for this trip"

