

# Fix: Chinese Characters Appearing During Itinerary Loading

## Problem
When the itinerary is being generated, Chinese characters occasionally appear in the loading/streaming view. These come from the AI model's raw response data (day themes, activity names, descriptions, locations) which is displayed directly without sanitization.

## Root Cause
The `convertGeneratedToBackendDay` function in `useLovableItinerary.ts` passes all AI-generated text fields straight through without running them through the existing sanitization utilities (`sanitizeAIOutput`, `sanitizeActivityName`). The streaming day cards then render this unsanitized text immediately.

The project already has robust sanitization utilities:
- `sanitizeAIOutput()` in `textSanitizer.ts` -- strips CJK characters, schema leaks, and garbled text
- `sanitizeActivityName()` in `activityNameSanitizer.ts` -- strips system prefixes and CJK characters

They're just not being applied at the right point in the pipeline.

## Solution
Add sanitization in `convertGeneratedToBackendDay` so every text field from the AI response is cleaned before it reaches the UI or gets saved to the database.

### Change: `src/hooks/useLovableItinerary.ts`

Import `sanitizeAIOutput` from `@/utils/textSanitizer` and apply it to all string fields in `convertGeneratedToBackendDay`:

- `day.theme` -- sanitized
- `a.name` -- sanitized
- `a.description` -- sanitized
- `a.location` (string form) -- sanitized
- `a.tips` -- sanitized
- `a.category` -- sanitized (less likely to have CJK but costs nothing)

This is a single-point fix that covers both the streaming UI display and the data saved to the database, preventing Chinese characters from appearing anywhere downstream.

## Why this approach
- Fixes the problem at the source (data entry point) rather than patching every display point
- Uses existing, battle-tested sanitization functions
- Also cleans the data before it's saved to the database, so future page loads won't show stale Chinese characters either
- Zero risk of breaking anything -- these sanitizers gracefully handle clean text (no-op)
