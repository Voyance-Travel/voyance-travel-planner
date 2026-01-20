# Travel DNA V2 - Technical Documentation

> Source of truth for the Travel DNA scoring system, archetype matching, and confidence calibration.

---

## Table of Contents

1. [Overview](#overview)
2. [Trait Scoring System](#trait-scoring-system)
3. [Archetype Matching](#archetype-matching)
4. [Confidence Calculation](#confidence-calculation)
5. [Multi-Select Normalization](#multi-select-normalization)
6. [Negative Evidence / Bipolar Scoring](#negative-evidence--bipolar-scoring)
7. [Saturation Logic](#saturation-logic)
8. [Data Schema](#data-schema)
9. [Frontend Components](#frontend-components)
10. [Adding New Archetypes](#adding-new-archetypes)
11. [Adding New Quiz Questions](#adding-new-quiz-questions)
12. [Testing Guidelines](#testing-guidelines)

---

## Overview

Travel DNA V2 is an upgrade to the original quiz-based personality system. Key improvements:

- **Negative evidence**: Answers can subtract from traits (bipolar scoring)
- **Multi-select normalization**: Selecting many options doesn't inflate scores
- **Saturation**: Prevents scores from hitting extremes too easily
- **Archetype blends**: Top 2-5 matches with percentages instead of single match
- **Calibrated confidence**: Based on margin + entropy, no baseline inflation
- **Transparency**: Shows "why" with top contributing answers
- **User refinement**: Accuracy feedback and trait override sliders

### Edge Function Location
```
supabase/functions/calculate-travel-dna/index.ts
```

### Database Tables
- `travel_dna_profiles` - Stores computed DNA with V2 fields
- `profiles.travel_dna_overrides` - User trait adjustments
- `voyance_events` - Analytics events for accuracy feedback

---

## Trait Scoring System

### The 8 Core Traits

| Trait | Scale | Negative End | Positive End |
|-------|-------|--------------|--------------|
| `planning` | -10 to +10 | Spontaneous | Detailed Planner |
| `social` | -10 to +10 | Solo/Intimate | Social/Group |
| `comfort` | -10 to +10 | Budget-Conscious | Luxury-Seeking |
| `pace` | -10 to +10 | Relaxed | Fast-Paced |
| `authenticity` | -10 to +10 | Tourist-Friendly | Local Explorer |
| `adventure` | -10 to +10 | Safe & Comfortable | Thrill-Seeker |
| `budget` | -10 to +10 | Splurge | Frugal |
| `transformation` | -10 to +10 | Pure Leisure | Growth-Focused |

### Score Calculation Flow

```
Quiz Answers → Deltas + Multipliers → Raw Scores → Saturation → Final Scores
```

1. **Apply deltas**: Each answer contributes deltas to traits
2. **Normalize multi-select**: Apply `1/min(k,N)` multiplier
3. **Sum raw scores**: Accumulate all contributions
4. **Apply saturation**: `score = 10 * tanh(raw / 10)`
5. **Clamp & round**: Final score in [-10, +10], 1 decimal

---

## Archetype Matching

### Schema Per Archetype

```typescript
interface ArchetypeDefinition {
  id: string;
  name: string;
  category: 'EXPLORER' | 'CONNECTOR' | 'ACHIEVER' | 'RESTORER' | 'CURATOR' | 'TRANSFORMER';
  
  // Primary traits with sweet spots
  primaryTraits: Array<{
    trait: string;
    weight: number;      // 0-10, importance
    sweetSpot: number;   // Ideal score (-10 to +10)
    range: [number, number]; // Acceptable range
  }>;
  
  // Penalty zones (optional)
  hardNo?: Array<{
    trait: string;
    range: [number, number]; // If score in this range, apply penalty
    penalty: number;         // Negative points
  }>;
  
  // Bonus for specific quiz answers (optional)
  signatureAnswers?: string[];  // Answer IDs that boost this archetype
}
```

### Scoring Algorithm

```typescript
function scoreArchetype(archetype, traitScores, answerIds) {
  let score = 0;
  
  // 1. Primary trait matching
  for (const { trait, weight, sweetSpot, range } of archetype.primaryTraits) {
    const userScore = traitScores[trait] || 0;
    const [min, max] = range;
    const rangeWidth = max - min;
    
    if (userScore >= min && userScore <= max) {
      // Distance from sweet spot, normalized
      const distance = Math.abs(userScore - sweetSpot) / rangeWidth;
      const matchQuality = 1 - distance;
      score += matchQuality * weight;
    }
  }
  
  // 2. Hard no penalties
  for (const { trait, range, penalty } of archetype.hardNo || []) {
    const userScore = traitScores[trait] || 0;
    if (userScore >= range[0] && userScore <= range[1]) {
      score += penalty; // penalty is negative
    }
  }
  
  // 3. Signature answer bonuses
  for (const answerId of archetype.signatureAnswers || []) {
    if (answerIds.includes(answerId)) {
      score += 2; // Bonus for signature answer
    }
  }
  
  return Math.max(0, score);
}
```

### Blend Calculation

After scoring all archetypes:

1. Take top 5 by raw score
2. Apply softmax with temperature 2.0
3. Convert to percentages summing to 100%

```typescript
function softmax(scores, temperature = 2.0) {
  const maxScore = Math.max(...scores);
  const exps = scores.map(s => Math.exp((s - maxScore) / temperature));
  const sumExps = exps.reduce((a, b) => a + b, 0);
  return exps.map(e => (e / sumExps) * 100);
}
```

---

## Confidence Calculation

**No baseline!** Confidence is purely derived from the data.

### Formula

```typescript
function calculateConfidence(archetypeMatches) {
  const top1 = archetypeMatches[0]?.score || 0;
  const top2 = archetypeMatches[1]?.score || 0;
  
  // Margin: difference between top 2
  const margin = top1 - top2;
  const marginContribution = Math.min(margin / 10, 1) * 50; // 0-50
  
  // Entropy: distribution of blend percentages
  const probs = archetypeMatches.slice(0, 5).map(a => a.pct / 100);
  const entropy = -probs.reduce((sum, p) => {
    return p > 0 ? sum + p * Math.log2(p) : sum;
  }, 0);
  const maxEntropy = Math.log2(5); // ~2.32
  const normalizedEntropy = entropy / maxEntropy;
  const entropyContribution = (1 - normalizedEntropy) * 50; // 0-50
  
  return Math.round(marginContribution + entropyContribution);
}
```

### Interpretation

| Confidence | Meaning |
|------------|---------|
| 80-100 | Strong match, dominant archetype |
| 60-80 | Good match, clear preference |
| 40-60 | Mixed signals, blend is meaningful |
| 0-40 | Uncertain, recommend more variety |

---

## Multi-Select Normalization

For questions where users can select multiple options (vibes, interests, etc.), we normalize to prevent inflation.

### Formula

```typescript
const k = selectedAnswers.length;
const N = 3; // Normalization cap
const multiplier = 1 / Math.min(k, N);
```

### Example

| Selected | Multiplier | Effect |
|----------|------------|--------|
| 1 item | 1.0 | Full weight |
| 2 items | 0.5 | Half weight each |
| 3 items | 0.33 | Third weight each |
| 6 items | 0.33 | Still third weight each |

### Rationale

- Prevents "more is better" gaming
- User who selects 6 interests shouldn't have 6x the signal
- Cap at 3 ensures selecting more still contributes but doesn't dominate

---

## Negative Evidence / Bipolar Scoring

Answers can now subtract from traits, not just add.

### Examples

| Answer | Trait Deltas |
|--------|--------------|
| "Spontaneous" | `planning: -5` |
| "Relaxed pace" | `pace: -4` |
| "Budget-conscious" | `comfort: -3` |
| "Quiet mornings" | `pace: -5, social: -3` |
| "Thrill-seeker" | `adventure: +6, comfort: -2` |

### Implementation

```typescript
const ANSWER_DELTAS: Record<string, Record<string, number>> = {
  'spontaneous': { planning: -5 },
  'relaxed_pace': { pace: -4 },
  'budget_conscious': { comfort: -3, budget: 4 },
  'thrill_seeker': { adventure: 6, comfort: -2 },
  // ... more mappings
};
```

---

## Saturation Logic

Prevents scores from hitting ±10 too easily from repeated signals.

### Formula

```typescript
function applySaturation(rawScore: number): number {
  // tanh naturally saturates at ±1, scaled to ±10
  return 10 * Math.tanh(rawScore / 10);
}
```

### Behavior

| Raw Score | Saturated Score |
|-----------|-----------------|
| 5 | 4.6 |
| 10 | 7.6 |
| 15 | 9.1 |
| 20 | 9.6 |
| 30 | 10.0 (capped) |

### Benefits

- Preserves ordering (higher raw = higher final)
- Diminishing returns for extreme signals
- Natural ±10 boundaries without hard clamps

---

## Data Schema

### travel_dna_profiles Table (V2 Fields)

```sql
travel_dna_v2 JSONB -- Full V2 output object
dna_version SMALLINT DEFAULT 1
trait_contributions JSONB -- Array of contribution records
archetype_matches JSONB -- Array of archetype match objects
```

### V2 Output Object

```typescript
interface TravelDNAv2Result {
  version: 2;
  raw_trait_scores: Record<string, number>;
  trait_scores: Record<string, number>;
  trait_signal_strength: Record<string, number>;
  trait_contributions: TraitContribution[];
  archetype_matches: ArchetypeMatch[];
  confidence: number;
}

interface TraitContribution {
  question_id: string;
  answer_id: string;
  label?: string;
  deltas: Partial<Record<string, number>>;
  normalized_multiplier: number;
}

interface ArchetypeMatch {
  archetype_id: string;
  name: string;
  category?: string;
  score: number;
  pct: number;
  reasons?: Array<{
    trait: string;
    effect: 'boost' | 'penalty';
    amount: number;
    note?: string;
  }>;
}
```

### profiles.travel_dna_overrides

```typescript
Record<string, number> // e.g., { "pace": 3, "adventure": -5 }
```

### voyance_events Table

```sql
CREATE TABLE voyance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  event_name TEXT NOT NULL,
  properties JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Frontend Components

### TravelDNATransparency

Location: `src/components/profile/TravelDNATransparency.tsx`

Displays:
- Archetype blend with percentages
- Trait scores with visual sliders
- "Why we think this" with top contributing answers
- Low confidence warning

### DNAAccuracyFeedback

Location: `src/components/profile/DNAAccuracyFeedback.tsx`

Features:
- 1-5 accuracy rating
- Correction chips (pace too high/low, etc.)
- Optional archetype selection
- Free-text feedback
- Saves to `voyance_events`

### TraitOverrideSliders

Location: `src/components/profile/TraitOverrideSliders.tsx`

Features:
- 8 sliders for each trait (-10 to +10)
- Shows "Modified" badge when changed
- Reset to computed values
- Saves to `profiles.travel_dna_overrides`

### MicroDisambiguation

Location: `src/components/profile/MicroDisambiguation.tsx`

Features:
- Shows when confidence < 60%
- Single clarifying question
- Reruns DNA calculation with new signal

---

## Adding New Archetypes

1. Add to `ARCHETYPES_V2` in `calculate-travel-dna/index.ts`:

```typescript
{
  id: 'your_archetype_id',
  name: 'Your Archetype Name',
  category: 'EXPLORER', // Pick appropriate category
  primaryTraits: [
    { trait: 'adventure', weight: 8, sweetSpot: 7, range: [3, 10] },
    { trait: 'authenticity', weight: 6, sweetSpot: 5, range: [0, 10] },
  ],
  hardNo: [
    { trait: 'comfort', range: [8, 10], penalty: -5 },
  ],
  signatureAnswers: ['off_beaten_path', 'solo_travel'],
}
```

2. Add narrative in `src/data/archetypeNarratives.ts`

3. Test with fixture quiz responses

---

## Adding New Quiz Questions

1. Add question to quiz config (`src/config/quiz-questions-v1.json`)

2. Add answer deltas in `calculate-travel-dna/index.ts`:

```typescript
const ANSWER_DELTAS: Record<string, Record<string, number>> = {
  // ... existing
  'your_new_answer_id': { 
    trait1: 3, 
    trait2: -2 
  },
};
```

3. If multi-select, add to `MULTI_SELECT_QUESTIONS`:

```typescript
const MULTI_SELECT_QUESTIONS = [
  'travel_vibes',
  'interests',
  'your_new_question_id', // Add here
];
```

4. Optionally add as signature answer for relevant archetypes

---

## Testing Guidelines

### Unit Tests Required

1. **Multi-select normalization**
   - 3 vs 6 selections shouldn't double magnitude

2. **Negative evidence**
   - "Spontaneous" reduces planning score

3. **Saturation**
   - Repeated signals don't hit ±10 too early
   - Ordering preserved

4. **Confidence**
   - Close top1/top2 → low confidence
   - Dominant top1 → high confidence

5. **Blend percentages**
   - Sum to 100%
   - Stable ordering

### Fixture Users

Create test fixtures for:

| Profile | Expected Traits | Expected Archetype |
|---------|-----------------|-------------------|
| Slow Relaxed Restorer | pace: -5, comfort: 3 | Wellness Wanderer |
| High Adventure Achiever | adventure: 8, pace: 6 | Adrenaline Junkie |
| Mixed Uncertain | all near 0 | Low confidence, blend |

### Running Tests

```bash
# Run DNA calculation tests
npx vitest run --grep "Travel DNA"

# Test edge function locally
supabase functions serve calculate-travel-dna --no-verify-jwt
```

---

## Migration Notes

### V1 → V2 Compatibility

- V1 fields (`primary_archetype_name`, `secondary_archetype_name`, etc.) still populated
- V2 fields added alongside, not replacing
- Lazy migration: V2 calculated on next quiz or itinerary generation
- `dna_version` column tracks which version was used

### Rollback Plan

If issues arise:
1. Set `dna_version = 1` to flag V1 profiles
2. Itinerary generation falls back to V1 fields if V2 missing
3. Frontend gracefully handles missing V2 data

---

## Event Tracking

### dna_accuracy_rating

Triggered when user submits accuracy feedback.

```typescript
{
  rating: number,           // 1-5
  dna_version: number,
  selected_corrections: string[],
  correction_details: Array<{ trait: string, direction: string }>,
  chosen_archetype_id?: string,
  top_matches_snapshot: ArchetypeMatch[],
  additional_feedback?: string,
}
```

### dna_overrides_saved

Triggered when user saves trait overrides.

```typescript
{
  overrides: Record<string, number>,
  override_count: number,
  computed_traits: Record<string, number>,
}
```

---

## FAQ

**Q: Why tanh for saturation?**
A: Natural S-curve that preserves ordering while preventing extremes. Differentiable, well-understood.

**Q: Why cap multi-select at 3?**
A: Sweet spot between "all selections matter" and "prevent gaming". Tested with user data.

**Q: How often should archetypes be recalculated?**
A: On quiz retake, or when significant new behavioral data is available.

**Q: Can users see their raw scores?**
A: Only if they expand the "View Trait Scores" section. Final saturated scores shown by default.
