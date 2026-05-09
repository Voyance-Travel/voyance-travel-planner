# S8.3 — SUPPORT_EMAIL env-driven

`supabase/functions/send-contact-email/index.ts:156` still hardcodes `contact@travelwithvoyance.com`. Replace with an env-driven constant, fall back to the current value so existing deploys don't break.

## Change

Near the top of `serve(...)` (or just above line 154), read the env var once:

```ts
const SUPPORT_EMAIL = Deno.env.get("SUPPORT_EMAIL") ?? "contact@travelwithvoyance.com";
```

Then line 156 becomes:

```ts
to: SUPPORT_EMAIL,
```

The user-confirmation send at line 206 (`to: email`) is unrelated and stays as-is.

## Verify

```
grep -n "SUPPORT_EMAIL\|contact@travelwithvoyance.com" supabase/functions/send-contact-email/index.ts
```
Expected: 2 hits — the `Deno.env.get` line and the fallback string inside it. The literal must NOT appear at line 156 anymore.

## Notes

- No secret-tool prompt needed: fallback preserves current behaviour. Operator can override per-environment via `SUPPORT_EMAIL` env var in the edge function settings.
- No client/UI changes. No DB changes.
