# Quiz Flow - Lovable Adaptation

<!--
@keywords: quiz, questions, answers, flow, travel DNA, archetype, onboarding, user setup
@category: QUIZ
@searchTerms: quiz flow, user onboarding, questions, save answers, quiz completion
-->

**Last Updated**: January 2025  
**Status**: ✅ Implemented (Simplified)  
**See also**: [SYSTEM_SOT.md](./SYSTEM_SOT.md) | [PREFERENCES_LOVABLE.md](./PREFERENCES_LOVABLE.md)

> **Adapted from**: quiz-data-flow.md, PREFERENCES_DATA_FIELDS.md

This document describes how the quiz works in the Lovable codebase.

---

## Current Implementation (Simplified)

<!--
@section: current
@keywords: flow, diagram, steps, save, completion
-->

### Flow Overview

```
/quiz route
    │
    ▼
Quiz.tsx (5 questions)
    │
    ▼
handleNext() on final step
    │
    ▼
setPreferences() → Saves to Neon
    │
    ▼
QuizCompletion screen
    │
    ▼
Navigate to /profile
```

### Questions

| Step | Question | Field | Options |
|------|----------|-------|---------|
| 1 | Travel style? | `style` | luxury, adventure, cultural, relaxation |
| 2 | Budget? | `budget` | budget, moderate, premium, luxury |
| 3 | Pace? | `pace` | slow, moderate, fast |
| 4 | Interests? | `interests` | food, nature, art, nightlife, shopping, wellness |
| 5 | Accommodation? | `accommodation` | hotel, boutique, airbnb, hostel |

### Code Location

| File | Purpose | Keywords |
|------|---------|----------|
| `src/pages/Quiz.tsx` | Main quiz page | page, route |
| `src/components/quiz/QuizProgress.tsx` | Progress indicator | progress, steps |
| `src/components/quiz/QuizOption.tsx` | Individual option card | option, select |
| `src/components/quiz/QuizCompletion.tsx` | Completion screen | done, complete |

---

## Data Storage

<!--
@section: data-storage
@keywords: save, persist, API, database, neon
-->

### On Quiz Completion

```typescript
// In Quiz.tsx handleNext()
await setPreferences({
  style: answers.style as string,
  budget: answers.budget as string,
  pace: answers.pace as string,
  interests: answers.interests as string[],
  accommodation: answers.accommodation as string,
});
```

### AuthContext.setPreferences()

```typescript
// Saves to Neon via edge function
const result = await preferencesApi.update(user.id, preferences);

// Updates local state
setUser({ 
  ...user, 
  preferences,
  quizCompleted: true,
});
```

---

## Differences from Original System

<!--
@section: differences
@keywords: original, migration, comparison, simplified
-->

| Feature | Original | Lovable | Keywords |
|---------|----------|---------|----------|
| Steps | 11 | 5 | steps, questions |
| Session tracking | quiz_sessions table | None (stateless) | session, resume |
| Response storage | quiz_responses table | Direct to preferences | responses, answers |
| Resume support | Yes | No | resume, continue |
| Travel DNA calc | Backend | Frontend (simple) | DNA, archetype |
| Retake history | travel_dna_history | Overwrites previous | history, retake |

---

## Future: Full Quiz Implementation

<!--
@section: future
@keywords: planned, roadmap, tables, endpoints
-->

To match original system:

### 1. Add Quiz Tables in Neon

```sql
-- Quiz sessions (track progress)
CREATE TABLE quiz_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  quiz_version TEXT DEFAULT 'v1',
  status TEXT DEFAULT 'in_progress',  -- in_progress, completed, abandoned
  current_step INTEGER DEFAULT 1,
  total_steps INTEGER DEFAULT 11,
  completion_percentage INTEGER DEFAULT 0,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  is_complete BOOLEAN DEFAULT FALSE
);

-- Quiz responses (individual answers)
CREATE TABLE quiz_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  session_id UUID REFERENCES quiz_sessions(id),
  field_id TEXT NOT NULL,
  field_type TEXT,
  answer_value TEXT,
  step_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 2. Add Edge Function Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/neon-db/quiz/start` | Start new session |
| POST | `/neon-db/quiz/save-step` | Save step answer |
| POST | `/neon-db/quiz/finalize` | Complete quiz |
| GET | `/neon-db/quiz/session?userId=X` | Get current session |

### 3. Implement 11-Step Quiz

From `quiz-data-flow.md`:
- Steps 1-3: Travel style & pace
- Steps 4-5: Budget & accommodation
- Steps 6-7: Activities & interests
- Steps 8-9: Food & mobility
- Steps 10-11: Final preferences & confirmation

### 4. Add Travel DNA Calculation

Backend process that:
1. Reads all quiz_responses
2. Calculates archetype scores
3. Determines primary/secondary archetype
4. Generates confidence score
5. Saves to travel_dna_profiles

---

## Travel DNA Archetypes

<!--
@section: archetypes
@keywords: DNA, archetype, personality, traveler type
-->

From `TRAVEL_ARCHETYPES.md`, implement these 6 categories:

| Category | Description | Keywords |
|----------|-------------|----------|
| **EXPLORER** | Discovery-driven | explore, discover, adventure |
| **CONNECTOR** | Relationship-driven | social, people, community |
| **ACHIEVER** | Goal-driven | goals, accomplishment, bucket list |
| **RESTORER** | Wellness-driven | relax, wellness, recharge |
| **CURATOR** | Experience-driven | experiences, curate, collect |
| **TRANSFORMER** | Change-driven | growth, change, transform |

Each has 4+ sub-archetypes for 25+ total personalities.

### Simple Frontend Calculation (Current)

```typescript
// In Profile.tsx
const archetype = user.preferences?.style === 'luxury' ? 'Refined Explorer' 
                : user.preferences?.style === 'adventure' ? 'Bold Adventurer'
                : user.preferences?.style === 'cultural' ? 'Culture Seeker'
                : 'Mindful Traveler';
```

### Advanced Backend Calculation (Future)

Would use quiz responses to calculate:
- Primary archetype ID
- Secondary archetype ID
- Rarity level (common, moderate, uncommon, very rare)
- Confidence percentage
- Trait scores
- Emotional drivers

---

## Related SOT Documents

| Document | Purpose | Keywords |
|----------|---------|----------|
| [quiz-data-flow.md](./quiz-data-flow.md) | Full original quiz flow | original, flow |
| [TRAVEL_ARCHETYPES.md](./TRAVEL_ARCHETYPES.md) | 25+ travel personalities | DNA, personality |
| [PREFERENCES_SYSTEM_SOT.md](./PREFERENCES_SYSTEM_SOT.md) | Preferences system | preferences, schema |
| [PREFERENCES_LOVABLE.md](./PREFERENCES_LOVABLE.md) | Lovable preferences | current, implemented |
| [profile-system-source-of-truth.md](./profile-system-source-of-truth.md) | Profile display | profile, UI |
