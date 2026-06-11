# QA Harness — fire trips via the wizard's own API path + judge them automatically

Replaces pixel-driving the wizard. Each trip = `trips` insert → `spend-credits`
(`trip_generation`, days×60) → `generate-itinerary` (`generate-trip`) — the exact
sequence the Confirm & Generate button runs — then poll → settle → audit.

## Files
- `audit.ts` — the verdict. Every gate this project ever failed on (G1–G12: status/
  completeness, integrity, meal timing, late dinner, placeholder venues, garble,
  variant-title venue dups, thin middle days, post-departure, vague/leak, must-do count).
  Importable (`auditTripRow`, `auditDays`) and a CLI.
- `soak.ts` — the streak runner. Default 20-city matrix (catalog-rich / thin-catalog /
  CJK / accents, 3–7 days). Stops on first FAIL (streak rule) unless `--no-stop`.

## Setup (secrets stay in your shell — never committed)
```sh
export SUPABASE_URL="https://qpwexpjqzsdkjkvgcntx.supabase.co"
export SUPABASE_ANON_KEY="<anon key>"
export VOYANCE_EMAIL="<test account email>"
export VOYANCE_PASSWORD="<test account password>"
```

## Usage
```sh
# judge an existing trip (no credits)
SUPABASE_KEY="$SUPABASE_ANON_KEY" deno run -A qa/harness/audit.ts --trip <uuid>

# judge a local dump (no network)
deno run -A qa/harness/audit.ts --file days.json --city "Athens" --days 5

# one targeted live trip (~days×60 credits)
deno run -A qa/harness/soak.ts --city "Athens, Greece" --days 5

# THE 20-STREAK (~5,520 credits for a full clean run)
deno run -A qa/harness/soak.ts
```

Any FAIL prints the exact gate + day + detail; the streak resets per the owner's rule —
root-cause, fix, deploy, re-run. After every future edge-function deploy, re-run at least
`soak.ts --count 2` as the regression smoke.
