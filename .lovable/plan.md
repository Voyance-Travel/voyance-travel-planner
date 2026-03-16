

# Remove Dashes from Founders Guides

## Problem
The founders guides in `src/data/founders-guides.ts` use " - " as separators extensively (e.g. `**Noble Rot** - delicious`, `**The British Museum** - free`). These should be replaced with commas or restructured sentences per editorial standards.

## Scope
**File**: `src/data/founders-guides.ts` — all 7 guides (London, Paris, Barcelona, Japan, Vienna, Las Vegas, Atlanta)

There are roughly 60+ instances of " - " used as separators across the guide content, summaries, and subtitles. Each will be converted to a comma, period, or sentence restructure depending on context. Examples:

| Before | After |
|--------|-------|
| `**Heathrow Express** - take it.` | `**Heathrow Express**, take it.` |
| `**Noble Rot** - delicious.` | `**Noble Rot**, delicious.` |
| `**The British Museum** - free.` | `**The British Museum**, free.` |
| `incredible architecture, world-class food - and a vibe` | `incredible architecture, world-class food, and a vibe` |
| `the food - seasonal British` | `the food, seasonal British` |
| `**Laduree** - I'll say it` | `**Laduree**, I'll say it` |

Legitimate dashes in compound phrases like "Indo-Chinese", "5am", "see-and-be-seen", "chef-driven", or hyphenated words will be left alone. Only separator dashes (" - ") will be converted.

## Changes
Single file edit to `src/data/founders-guides.ts`, replacing all " - " separator patterns across all guide content blocks, summaries, and subtitles with commas or restructured phrasing. Also removes the Ganko Yakiniku entry from the Japan guide (line 208) as previously approved.

