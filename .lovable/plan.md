
# AI Integration Plan: Brain, Not Face
## Adding Natural Language Without Breaking What Works

---

## Executive Summary

Voyance already uses AI for itinerary **generation**. This plan adds AI for **input parsing** (natural language → same data structure) and **post-generation interaction** (explain + modify). The 27-archetype rules engine, trip type modifiers, and personalization matrix remain unchanged—AI becomes a better interface TO this intelligence, not a replacement.

---

## Current System Architecture (Preserved)

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         EXISTING SYSTEM                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  INPUT (Structured Forms)           INTELLIGENCE (Rules Engine)    │
│  ─────────────────────────          ──────────────────────────     │
│  • Start.tsx                        • 27 Archetype definitions     │
│  • ItineraryContextForm.tsx         • 14 Trip type modifiers       │
│  • Quiz.tsx (27 questions)          • 378 Interaction matrix       │
│  • Date/traveler selectors          • Pacing/budget/forced slots   │
│                                     • Destination essentials       │
│                                                                     │
│  GENERATION (Already AI)            OUTPUT (Static Display)        │
│  ─────────────────────────          ──────────────────────────     │
│  • generate-itinerary edge fn       • EditorialItinerary.tsx       │
│  • prompt-library.ts                • DayTimeline components       │
│  • profile-loader.ts                • Activity cards               │
│  • archetype-data.ts                                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**What stays unchanged:**
- All archetype definitions and constraints
- Trip type modifier logic 
- Pacing, budget, forced slot rules
- Profile loader and prompt library
- Existing forms (as fallback option)
- Generation pipeline

---

## What We're Adding

### 1. Natural Language Trip Input (Alternative to Form)

**Location:** New edge function + new UI component on Start page

**How it works:**
```text
User types: "Beach trip in March, 2 kids (6 and 9), somewhere warm, around $4k"

AI extracts → TripInput structure:
{
  tripType: "family",
  childrenAges: [6, 9],
  season: "march",
  vibe: "beach",
  budget: 4000,
  travelers: 4
}

Same structure the form produces → Same generation pipeline
```

**Components:**
- `supabase/functions/parse-trip-input/index.ts` - AI parsing endpoint
- `src/components/planner/NaturalTripInput.tsx` - Text input with suggestions
- Modification to `Start.tsx` - Dual mode toggle (natural | form)

---

### 2. Natural Language Itinerary Modification (Enhanced)

**Existing:** `itinerary-chat` edge function already handles structured modifications

**Enhancement:** Make it smarter, expose it better in UI

**Current flow:**
```text
User clicks chat icon → Types "make day 3 lighter" → Gets structured action → Clicks approve
```

**Enhanced flow:**
```text
User types in inline input → Sees preview of changes → One click to apply

"Make day 3 lighter"
→ AI: "Moving museum to Day 4, pushing dinner back 1hr. Day 3 now has free afternoon."
→ [Apply] [Undo]
```

**Components:**
- `src/components/itinerary/InlineModifier.tsx` - Text input on itinerary page
- Enhance `itinerary-chat` to return diff previews
- No new edge function needed

---

### 3. Explainable Recommendations

**Location:** Activity cards in itinerary

**How it works:**
```text
Activity card shows: "Trattoria da Enzo"
User clicks: "Why this?"

AI generates explanation using:
- User's archetype (from profile-loader)
- Trip context (honeymoon, budget, etc.)
- The activity metadata

Returns: "This family-run spot since 1935 is where Romans actually eat. 
You mentioned avoiding tourist traps—this qualifies. It's walkable from 
your hotel in Trastevere, and their cacio e pepe is the real thing."
```

**Components:**
- `supabase/functions/explain-recommendation/index.ts` - New edge function
- `src/components/itinerary/ExplainableActivity.tsx` - Wraps activity card
- Add `onExplain` callback to existing `TripActivityCard.tsx`

---

### 4. Alternative Quiz Path (Conversational)

**Location:** New page parallel to existing Quiz

**How it works:**
```text
User selects: "Just tell us how you like to travel"

Prompt: "Describe a trip you loved. What made it great?"

User writes: "Japan was amazing but exhausting. Best day was getting lost 
in Kyoto and finding a tiny soba shop. Wish the whole trip was like that."

AI extracts:
- Pace: slow (exhaustion from over-scheduling)
- Style: wandering, discovery
- Dining: local spots, long meals
- What went wrong: too packed

Maps to archetype: "Slow Traveler" (same as quiz would produce)
```

**Components:**
- `supabase/functions/parse-travel-story/index.ts` - Story → archetype
- `src/pages/OnboardConversation.tsx` - Conversational alternative
- Modification to Quiz landing to offer choice

---

## File Structure

```text
NEW FILES:
├── supabase/functions/
│   ├── parse-trip-input/index.ts        # NL → TripInput structure
│   ├── explain-recommendation/index.ts  # Activity explanations
│   └── parse-travel-story/index.ts      # Story → archetype
│
├── src/components/planner/
│   └── NaturalTripInput.tsx             # "Just tell us" input
│
├── src/components/itinerary/
│   ├── InlineModifier.tsx               # Inline modification input
│   └── ExplainableActivity.tsx          # "Why this?" wrapper
│
└── src/pages/
    └── OnboardConversation.tsx          # Alternative to quiz

MODIFIED FILES:
├── src/pages/Start.tsx                  # Add mode toggle
├── src/pages/Quiz.tsx                   # Add choice at start
├── src/components/planner/TripActivityCard.tsx  # Add onExplain
└── src/components/itinerary/EditorialItinerary.tsx  # Add InlineModifier
```

---

## Technical Details

### Parse Trip Input Edge Function

```typescript
// supabase/functions/parse-trip-input/index.ts

interface ParsedTripInput {
  destination?: string;
  dates?: { start: string; end: string };
  travelers?: number;
  childrenAges?: number[];
  tripType?: string;
  budget?: number;
  vibe?: string[];
  constraints?: string[];
  needsClarification?: { field: string; question: string }[];
}

// Uses Lovable AI to extract structure from natural language
// Returns SAME shape that Start.tsx form produces
// If ambiguous, returns clarification questions
```

### Explain Recommendation Edge Function

```typescript
// supabase/functions/explain-recommendation/index.ts

// Loads user profile using profile-loader.ts (reuse existing)
// Gets archetype context using archetype-data.ts (reuse existing)
// Generates 2-3 sentence explanation specific to THIS user
// References their traits, trip type, stated preferences
```

### UI Integration Points

**Start.tsx modification:**
```tsx
// Add toggle at top of form
<div className="flex gap-2 mb-6">
  <button 
    onClick={() => setMode('natural')}
    className={mode === 'natural' ? 'active' : ''}
  >
    Just tell us
  </button>
  <button 
    onClick={() => setMode('form')}
    className={mode === 'form' ? 'active' : ''}
  >
    Use form
  </button>
</div>

{mode === 'natural' && <NaturalTripInput onExtracted={setTripData} />}
{mode === 'form' && <ExistingFormComponents />}
```

**Activity card modification:**
```tsx
// Add to TripActivityCard.tsx
<button 
  onClick={() => onExplain?.(activity)}
  className="text-sm text-muted-foreground"
>
  Why this?
</button>
```

---

## What This Does NOT Change

| Component | Status |
|-----------|--------|
| 27 Archetype definitions | Unchanged |
| 14 Trip type modifiers | Unchanged |
| Archetype × Trip Type matrix | Unchanged |
| Pacing/budget/forced slot rules | Unchanged |
| Profile loader logic | Reused, not modified |
| Prompt library | Reused, not modified |
| Generation pipeline | Unchanged |
| Existing forms | Kept as option |
| Existing quiz | Kept as option |

---

## Implementation Priority

| Phase | What | Why First |
|-------|------|-----------|
| **1** | Explain recommendations | Highest value, no risk to core flow |
| **2** | Inline modifications | Enhances existing chat, users have itineraries |
| **3** | Natural trip input | Alternative path, form stays as fallback |
| **4** | Conversational onboarding | Nice-to-have, quiz works well |

---

## Key Principle

**AI is a better interface to the same intelligence.**

Your rules engine (archetypes, trip types, matrices, pacing, forced slots) IS the intelligence. AI just makes it easier to:
- **Tell** the system what you want (input)
- **Understand** why it recommended something (explain)
- **Change** it without rebuilding (modify)

The brain stays the same. AI is a better mouth and ears.
