
# Value-First Homepage: Show the Magic Before Asking for Anything

## The Problem You Identified

The current funnel demands commitment before delivering value:

```text
Homepage → Quiz → Archetype → Trip Form → Itinerary
   ↓         ↓        ↓           ↓
 BOUNCE   ABANDON  "SO WHAT?"   TOO MUCH    (few arrive)
```

All the AI enhancements we built (explain recommendations, inline modifications, conversational onboarding) are useless if users never reach the itinerary.

## The Solution: Value First

```text
Instant Value → "Want more?" → Easy personalization → Deep value
     ↓              ↓                 ↓                  ↓
  "Oh wow"     "Yes please"      "This is fun"       "I need this"
```

Show them magic in 10 seconds. THEN they want to invest.

---

## What We're Building

### Phase 0: Value-First Homepage Hero

Replace the current `TravelDNAHero` (static headline + CTA buttons) with an **interactive hero** that has three entry modes:

| Mode | User Action | Immediate Value |
|------|-------------|-----------------|
| **Destination** | Types "Tokyo" | 3-day preview in 5 seconds |
| **Style Quiz** | Answers ONE question | Archetype teaser with comparison |
| **Fix Trip** | Pastes existing itinerary | "Roast" with specific issues |

### Entry Point 1: Instant Trip Preview (Primary)

```text
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│           Where do you want to go?                              │
│                                                                 │
│      [ Tokyo________________________________ ]                  │
│                                                                 │
│      [Tokyo] [Paris] [Bali] [Rome] [Barcelona]                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

User types "Tokyo" → **5 seconds later**:

```text
┌─────────────────────────────────────────────────────────────────┐
│  Tokyo                                                          │
│                                                                 │
│  Here's a taste of what we'd build for you:                     │
│                                                                 │
│  Day 1 │ Arrive slow. One quiet dinner in Shinjuku.             │
│  Day 2 │ Senso-ji at 7am. Then: nothing until lunch.            │
│  Day 3 │ Get lost in Yanaka. That's the whole plan.             │
│                                                                 │
│  + 4 more days                                                  │
│                                                                 │
│  This is a "Slow Traveler" trip. Yours might be different.      │
│                                                                 │
│  [ Make it mine ] ← Now they WANT personalization               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Entry Point 2: One-Question Hook

```text
┌─────────────────────────────────────────────────────────────────┐
│  It's 2pm on vacation and you're fading. You...                 │
│                                                                 │
│  ○ Push through. Sleep when I'm dead.                           │
│  ○ Find a café and people-watch for an hour.                    │
│  ○ Head back to the hotel. Nap is calling.                      │
│  ○ Get lost somewhere new. Tired but curious.                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

User clicks one option → **Instant archetype teaser**:

```text
┌─────────────────────────────────────────────────────────────────┐
│  You might be a Slow Traveler.                                  │
│                                                                 │
│  ┌─────────────────────┐  ┌─────────────────────┐               │
│  │ TYPICAL TRIP        │  │ YOUR TRIP           │               │
│  │ 6am alarm           │  │ Wake when ready     │               │
│  │ 4 museums/day       │  │ One neighborhood    │               │
│  │ 45-min dinner       │  │ 3-hour lunch        │               │
│  │ Exhausted by day 3  │  │ Actually relaxed    │               │
│  └─────────────────────┘  └─────────────────────┘               │
│                                                                 │
│  [ Find out for sure ]    [ Or just plan a trip ]               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Entry Point 3: Fix My Itinerary

```text
┌─────────────────────────────────────────────────────────────────┐
│  Already have a trip planned?                                   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Paste your itinerary...                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [ Roast my itinerary ]                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

AI analyzes and responds:

```text
┌─────────────────────────────────────────────────────────────────┐
│  Honest feedback on your Tokyo trip:                            │
│                                                                 │
│  🚨 Day 2 is a disaster                                         │
│  TeamLab, Shibuya, AND Harajuku on the same day?                │
│  You'll spend 3 hours on trains.                                │
│                                                                 │
│  🚨 Day 4 dinner won't happen                                   │
│  Sukiyabashi Jiro needs 30-day reservations.                    │
│                                                                 │
│  😐 You're eating at tourist traps                              │
│  That ramen place near Senso-ji? There are 10 better options.   │
│                                                                 │
│  [ Fix this mess ]                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technical Architecture

### New Edge Function: `generate-quick-preview`

A **fast, lightweight** version of itinerary generation:
- Uses `google/gemini-2.5-flash` (fastest model)
- Generates only 3 days, 2-3 sentences each
- No database lookups, no truth anchors
- Target: < 5 second response time
- Uses a default archetype ("Slow Traveler") for the preview

```typescript
// supabase/functions/generate-quick-preview/index.ts

interface QuickPreviewRequest {
  destination: string;
}

interface QuickPreviewResponse {
  destination: string;
  days: Array<{
    dayNumber: number;
    headline: string;
    description: string;
  }>;
  totalDays: number;
  archetypeUsed: string;
  archetypeTagline: string;
}
```

### New Edge Function: `analyze-itinerary`

Analyzes user-pasted itinerary for issues:

```typescript
// supabase/functions/analyze-itinerary/index.ts

interface AnalyzeItineraryRequest {
  itineraryText: string;
}

interface AnalyzeItineraryResponse {
  destination: string | null;
  issues: Array<{
    emoji: string;
    headline: string;
    detail: string;
    severity: 'critical' | 'warning' | 'suggestion';
  }>;
  positives: string[];
  canFix: boolean;
}
```

### New UI Components

```text
NEW FILES:
├── src/components/home/
│   ├── ValueFirstHero.tsx           # Main interactive hero container
│   ├── DestinationEntry.tsx         # "Where do you want to go?" input
│   ├── QuickPreviewDisplay.tsx      # 3-day preview card
│   ├── OneQuestionEntry.tsx         # Single question archetype hook
│   ├── ArchetypeTeaser.tsx          # Side-by-side comparison
│   ├── FixItineraryEntry.tsx        # "Roast my itinerary" input
│   └── ItineraryAnalysis.tsx        # Issues display

MODIFIED FILES:
├── src/pages/Home.tsx               # Replace TravelDNAHero with ValueFirstHero
└── src/lib/strangerCopy.ts          # Add hook question + archetype teasers
```

### Data: Archetype Teasers

Leverage existing `src/data/archetypeReveals.ts` and `src/data/archetypeNarratives.ts` to build teaser comparisons. Add mapping from single-question answers to archetypes:

```typescript
// src/lib/archetypeTeasers.ts

export const ONE_QUESTION_HOOK = {
  question: "It's 2pm on vacation and you're fading. You...",
  options: [
    { value: 'push', label: "Push through. Sleep when I'm dead.", archetype: 'adrenaline_architect' },
    { value: 'cafe', label: "Find a café and people-watch for an hour.", archetype: 'slow_traveler' },
    { value: 'hotel', label: "Head back to the hotel. Nap is calling.", archetype: 'retreat_regular' },
    { value: 'explore', label: "Get lost somewhere new. Tired but curious.", archetype: 'flexible_wanderer' },
  ],
};

export const ARCHETYPE_TEASERS: Record<string, {
  name: string;
  oneLiner: string;
  typicalTrip: string[];
  yourTrip: string[];
}> = {
  slow_traveler: {
    name: "Slow Traveler",
    oneLiner: "You'd rather do 3 things well than 10 things rushed.",
    typicalTrip: ["6am alarm for sunrise", "4 museums in one day", "45-minute dinner", "Exhausted by day 3"],
    yourTrip: ["Wake up when you wake up", "One neighborhood per day", "3-hour lunch", "Actually relaxed"],
  },
  // ... other archetypes
};
```

---

## File Changes Summary

| File | Action | Purpose |
|------|--------|---------|
| `supabase/functions/generate-quick-preview/index.ts` | Create | Fast 3-day preview generation |
| `supabase/functions/analyze-itinerary/index.ts` | Create | Roast user's existing itinerary |
| `src/components/home/ValueFirstHero.tsx` | Create | Main interactive hero with 3 modes |
| `src/components/home/DestinationEntry.tsx` | Create | Destination input + preview |
| `src/components/home/QuickPreviewDisplay.tsx` | Create | Display generated preview |
| `src/components/home/OneQuestionEntry.tsx` | Create | Single question hook |
| `src/components/home/ArchetypeTeaser.tsx` | Create | Side-by-side comparison |
| `src/components/home/FixItineraryEntry.tsx` | Create | Paste itinerary input |
| `src/components/home/ItineraryAnalysis.tsx` | Create | Display issues found |
| `src/lib/archetypeTeasers.ts` | Create | Teaser data for each archetype |
| `src/pages/Home.tsx` | Modify | Replace TravelDNAHero with ValueFirstHero |
| `supabase/config.toml` | Modify | Add new edge functions |

---

## Implementation Priority

| Phase | What | Why |
|-------|------|-----|
| **0a** | `generate-quick-preview` + `DestinationEntry` | Core value-first experience |
| **0b** | `OneQuestionEntry` + `ArchetypeTeaser` | For users without a destination |
| **0c** | `analyze-itinerary` + `FixItineraryEntry` | For skeptics with existing plans |

---

## Key Principle

**Show value in 10 seconds. THEN ask for commitment.**

The quiz, the form, the full system—all still there. But now people arrive at them already wanting what you have, instead of being asked to trust you first.
