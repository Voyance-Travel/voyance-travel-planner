

# Handle Pre-Planned Itinerary Input in Chat Flow

## Summary
Add instructions to the system prompt so the AI correctly handles detailed, pre-planned itineraries pasted by users, and expand the `mustDoActivities` description to support verbose day-by-day extraction.

## Changes

### File: `supabase/functions/chat-trip-planner/index.ts`

**1. Add PRE-PLANNED ITINERARY HANDLING section** (after line 170, before the CRITICAL TEMPORAL MAPPING RULES block at line 171)

Insert a new 10-rule block covering: don't refuse, don't ask unnecessary follow-ups, call tool immediately, extract all venues/times into mustDoActivities with day numbers, put meetings into userConstraints, handle TBD items, extract per-city hotels, default travelers to 1, populate cities array, and never refuse to generate.

**2. Expand `mustDoActivities` description** (line 341)

Append to the existing description string: `" When the user provides a full day-by-day plan, extract ALL venue names, restaurants, and timed activities as 'Day N Time Activity' entries. This can be a very long string — that is fine. Capture EVERYTHING."`

### What's NOT changed
- No schema structure changes (no new properties/types)
- No generation chain changes
- No streaming logic changes
- No validation or auth changes

