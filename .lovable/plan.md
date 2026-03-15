

# Make the Itinerary Assistant Proactive & Conversational

## What Changes

### 1. Proactive, Context-Aware Welcome Message (`ItineraryAssistant.tsx`)
Instead of a generic bullet-point list, the welcome message will be **dynamically built** from the actual itinerary context. Examples:

- *"I see you've got a packed Day 2 with 6 activities — want me to space things out a bit?"*
- *"Day 3 doesn't have dinner planned yet. Want me to find a spot near your hotel?"*
- *"You're staying in Frisco — did you know The Star district has some great walkable restaurants?"*

**Implementation:** Add a `buildContextualGreeting()` function that inspects the `days` array, accommodation info, and blended DNA to generate 1-2 proactive observations + a question. This runs client-side using the itinerary data already available — no AI call needed for the greeting.

### 2. Update System Prompt Tone (`supabase/functions/itinerary-chat/index.ts`)
Add a new `## CONVERSATIONAL TONE` section to the system prompt:

```
## CONVERSATIONAL TONE & PROACTIVE SUGGESTIONS
- Be warm, enthusiastic, and opinionated — like a well-traveled friend, not a command interface.
- After answering a request, ALWAYS offer a natural follow-up observation or suggestion based on what you see in the itinerary. Examples:
  - "Done! By the way, I notice Day 4 is pretty light — want me to add a sunset spot?"
  - "That swap looks great. Since you mentioned you love food, Day 2 has a gap around lunch — want me to find a local gem?"
- Reference specific activities, neighborhoods, and times from the itinerary to show you've "read" their plan.
- Use the traveler's DNA/archetype to make personalized observations: "As someone who loves hidden gems, you might want to swap that tourist-heavy spot on Day 1..."
- Don't just wait for commands — anticipate needs. If a day has no breakfast, mention it. If two days visit the same neighborhood, flag it.
- Keep follow-up suggestions to ONE per response — don't overwhelm.
```

### 3. Context-Aware Greeting Builder (`ItineraryAssistant.tsx`)
Replace the static welcome with smart observations:

```typescript
function buildContextualGreeting(destination, days, accommodationInfo, blendedDna) {
  // Analyze: gaps (no breakfast/dinner), overloaded days (6+ activities),
  // light days (<3 activities), repeated neighborhoods, DNA mismatches
  // Return 1-2 specific observations + an open question
}
```

Checks to run (pick top 1-2):
- **Packed day** (6+ activities) → "Day X looks ambitious! Want me to trim it?"
- **Light day** (<3 activities) → "Day X has some free time — want suggestions?"
- **Missing meal** (no breakfast or dinner slot) → "Day X doesn't have dinner — want me to find a spot?"
- **Accommodation proximity** → "Since you're in [neighborhood], did you know [nearby highlight]?"
- **DNA-based** → "Your Travel DNA says you love hidden gems — I spotted a touristy spot on Day X..."
- **Fallback** → warm, personalized intro with 2-3 example phrases

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/itinerary-chat/index.ts` | Add `CONVERSATIONAL TONE` section to system prompt for proactive follow-ups |
| `src/components/itinerary/ItineraryAssistant.tsx` | Replace static welcome with `buildContextualGreeting()` that analyzes the actual itinerary |

