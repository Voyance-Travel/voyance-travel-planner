

## Fix: Strip ALL Parenthetical AI Notes From Descriptions

### Problem
The AI generates internal reasoning notes in parentheses (e.g., "(Note: Adjusting to user's 'Wellness' interest...)", "(Scheduled as an activity to...)") that leak into user-visible descriptions. Current regex only catches specific keywords like "archetype" and "hard block", missing many variants.

### Changes

**1. Broader parenthetical stripping in `sanitization.ts` — `sanitizeAITextField` function (around line 142)**

Replace the single narrow parenthetical regex with two broader patterns that catch all AI-indicator parentheticals:

```typescript
// Replace line 142's narrow pattern with:

// Strip parenthetical notes containing AI-indicator language (broad catch-all)
.replace(/\s*\((?:Note|NB|Scheduled|Adjusted|Adjusting|Selected|Chosen|Added|Included|Placed|Moved|Reason|Context|Rationale|Per|As per|Based on|Due to|Reflecting|To reflect|To match|To align|To satisfy|To address|This is a|This serves|This provides|This fulfills)\b[^)]*\)/gi, '')
// Strip parenthetical notes referencing user preferences/interests/system terms
.replace(/\s*\([^)]*(?:user's|user preference|archetype|arche\b|interest\b|hard block|soft block|constraint|slot\s+logic|post-process|as per)\b[^)]*\)/gi, '')
```

The first pattern catches any parenthetical starting with an AI reasoning verb/phrase. The second catches parentheticals mentioning system concepts regardless of opening words. Together they cover the existing narrow pattern plus all reported variants.

**2. Negative instruction in system prompt — `compile-prompt.ts` (after line 822, before the closing backtick)**

Add a new instruction block after "OUTPUT QUALITY":

```typescript
TEXT QUALITY — NO META-COMMENTARY:
Never include parenthetical notes, internal reasoning, scheduling logic, or explanations of why an activity was chosen in any user-visible text field (title, description, tips, voyanceInsight, whyThisFits). All text must read as polished travel copy written for the end user. Do not include "(Note: ...)", "(Scheduled as ...)", "(Adjusted for ...)", "(Reflecting ...)", or any similar meta-commentary.
```

### Files
- `supabase/functions/generate-itinerary/sanitization.ts` — replace 1 regex with 2 broader ones (~line 142)
- `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` — add 3-line instruction block (~line 822)

