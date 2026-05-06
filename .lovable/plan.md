## Bug

Two-part gap, same root cause:

1. **`/archetypes/:slug` returns 404.** No route is registered. `App.tsx` only mounts `/archetypes` → `<Archetypes>`; the per-type detail lives inside `ArchetypeDetailSheet` (modal-only).
2. **The "Share this archetype" button shares the index page, not the type.** `ArchetypeDetailSheet.tsx:31` and `TravelDNAReveal.tsx:218` both hard-code `${getAppUrl()}/archetypes` regardless of which archetype is open. Anyone clicking that link lands on the carousel and has to find the type themselves.

## Fix

### 1. New permalink route `/archetypes/:slug`

- Add `ARCHETYPE_DETAIL: '/archetypes/:slug'` to `src/config/routes.ts`.
- Register `<Route path="/archetypes/:slug" element={<Archetypes />} />` in `App.tsx` (reuse the same page — no new page component).
- In `Archetypes.tsx`:
  - Read `useParams<{ slug?: string }>()`.
  - Build a `narrativeIdFromSlug(slug)` helper. Slug = kebab-case of `narrativeId` (e.g. `luxury-luminary` → `luxury_luminary`).
  - On mount / slug change, if a valid slug is present, call the existing `handleSelectArchetype(narrativeId)` so the sheet opens against the matching archetype and the carousel scrolls to its index (`emblaApi.scrollTo(index)`).
  - When the sheet closes, `navigate('/archetypes', { replace: true })` so the URL doesn't keep a stale slug.
  - Bad/unknown slug → silently fall back to the index (no detail open). Avoids the "Wrong turn" page.

### 2. SEO + share metadata per slug

- Replace the static `<Head>` block in `Archetypes.tsx` with a slug-aware variant:
  - **No slug:** existing copy.
  - **Valid slug:** `title = "${archetype.name} — Travel DNA | Voyance"`, `description = archetype.tagline`, `canonical = https://travelwithvoyance.com/archetypes/${slug}`, plus `og:title` / `og:description` / `og:image` (use `archetype.icon` only if no real image — leave OG image empty otherwise to avoid broken previews).

### 3. Share buttons emit the permalink

- `src/components/archetypes/ArchetypeDetailSheet.tsx` line 31 → `${getAppUrl()}/archetypes/${slug(archetype.id || narrativeId)}`. Pass the originating `narrativeId` into the sheet (currently only the merged `ArchetypeDetail` is passed) so we share the user-facing slug, not the internal detail-id.
- `src/components/profile/TravelDNAReveal.tsx` line 218 → same change, using the user's resolved primary archetype's slug.
- Web Share API payload: keep title/text the same; only swap `url`.

### 4. Slug helper + fixture

- New `src/utils/archetypeSlug.ts` exporting `archetypeIdToSlug(id)` and `slugToArchetypeId(slug)`. Pure underscore↔hyphen conversion plus a lookup against `Object.keys(ARCHETYPE_NARRATIVES)` so unknown slugs return `null` (not an injected lookup).
- Test fixture: every key in `ARCHETYPE_NARRATIVES` round-trips through `archetypeIdToSlug` → `slugToArchetypeId` and matches.

### 5. Regression tests

- `src/utils/__tests__/archetypeSlug.test.ts` — round-trip for all 29 narrative ids; unknown slugs return `null`; case-insensitive match (`Luxury-Luminary` resolves).
- `src/test/navigation.test.ts` — extend the public route list with one valid `/archetypes/luxury-luminary` and one invalid `/archetypes/not-a-thing`; both must render without 404. (The page itself renders even for invalid slugs.)

## Files

**Edited**
- `src/config/routes.ts` — add `ARCHETYPE_DETAIL`
- `src/App.tsx` — register `/archetypes/:slug`
- `src/pages/Archetypes.tsx` — read slug, auto-open sheet, scroll carousel, slug-aware `<Head>`, sync URL on sheet close
- `src/components/archetypes/ArchetypeDetailSheet.tsx` — share permalink + accept narrative id
- `src/components/profile/TravelDNAReveal.tsx` — share permalink for the user's resolved type
- `src/test/navigation.test.ts` — coverage for permalink + invalid slug

**Created**
- `src/utils/archetypeSlug.ts`
- `src/utils/__tests__/archetypeSlug.test.ts`

No backend changes. Pure frontend / routing fix.