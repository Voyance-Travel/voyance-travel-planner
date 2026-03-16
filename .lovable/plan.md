

# Voyance Picks Batch 1: Alabama + Florida

## Verified

- The `voyance_picks` table exists with the correct schema (destination, name, category, why_essential, description, insider_tip, neighborhood, price_range, best_time, tags, priority, etc.)
- Only one existing entry (Zeerovers / Aruba) — will not be touched
- None of the 4 new destinations exist yet, so no conflict risk

## Plan

Use the data insertion tool to run a single SQL INSERT with 4 rows:

| Destination | Name | Category |
|---|---|---|
| Birmingham | Renaissance Birmingham Ross Bridge Golf Resort & Spa | accommodation |
| Miami | The Ritz-Carlton South Beach | accommodation |
| Fort Lauderdale | Coconuts | dining |
| Orlando | Walt Disney World | experience |

All fields match the provided SQL exactly. After insertion, run a verification query to confirm all 4 rows landed correctly.

This is a data-only operation — no schema changes, no code changes needed.

