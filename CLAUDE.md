# CLAUDE.md — Voyance house rules

Repo-level conventions for anyone (human or AI) changing this codebase. These
have been enforced in practice but never written down; they are now normative.
When a change conflicts with a rule below, fix the rule violation or stop and
flag it — do not work around it.

---

## 1. File size — hard ceiling 500 lines

- No single source file should exceed **500 lines**.
- If a component is approaching the limit, **decompose it before adding new
  features** — don't grow it further and promise to split "later."
- Prefer extracting cohesive sub-components/hooks into their own files over
  adding branches to a large file.

## 2. Database — UNIQUE constraints on natural business keys

- Every table that represents a **business entity** must have a `UNIQUE`
  constraint on its natural business key(s): client/user email, booking
  reference, itinerary slug, etc.
- If duplicate rows of a table would corrupt a report, the CRM, or a lookup,
  that key must be enforced at the database level — not just in application code.
- Add these as **new migrations**. Never edit an already-applied migration.

## 3. Edge functions — always validate authentication

- Every Supabase edge function must validate the caller. **No edge function may
  trust a `userId` / `tripId` (or any identity) passed in the request body**
  without verifying it against the caller's JWT.
- ~108 functions run with `verify_jwt = false`, so the gateway does NOT gate
  them — auth is entirely in-code. Use the shared helper:

  ```ts
  import { parseAuth } from "../_shared/require-auth.ts";
  const auth = await parseAuth(req);
  if (auth instanceof Response) return auth;      // 401
  // auth.userId === 'service_role' → trusted internal/server-to-server call
  //   → a body userId/tripId may be used
  // else → a real user JWT:
  //   - WRITES: force the id to auth.userId (never a body value)
  //   - READS:  verify ownership (e.g. trips.user_id === auth.userId)
  ```

- A function that writes user data with the service-role key while trusting a
  body id is an IDOR. This rule exists because four such functions shipped.

## 4. Queries — no `select('*')` on user-facing paths

- Use explicit columns — `select('column1, column2, ...')` — on any query that
  serves a **user-facing page or a paginated/list view**.
- `select('*')` is acceptable only in admin-only or genuinely low-traffic paths
  where the full row is actually needed. Prefer explicit columns by default.

## 5. TypeScript — strict is the goal

- **Do not add new `any` types.** Prefer explicit types, especially on all
  **function signatures** (parameters and return types).
- The codebase is moving toward `strict: true` / `noImplicitAny: true`; write
  new code as if strict is already on so the eventual flip is small.

## 6. Sensitive changes — require a review note

- Any change that touches **auth, credits, payments, or RLS policies** requires a
  **manual review note in the PR description** stating exactly what changed and
  why.
- No silent edits to these surfaces. Reviewers should be able to reason about the
  security/financial impact from the PR body alone.

---

*Scope note: these are guardrails, not a refactor mandate. Apply them to code you
touch; large decompositions to bring existing files under the 500-line ceiling are
tracked as their own deliberate work, not incidental changes.*
