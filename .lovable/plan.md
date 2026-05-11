# Reduce Initial JS Bundle (~1.3 MB unused → target <500 KB)

Currently every page in `src/pages/` (~55 files including admin + agent CRM) is statically imported at the top of `src/App.tsx`, so React Router cannot code-split anything. We'll convert routes to `React.lazy`, lazy-load a few heavy in-page components, and add explicit vendor chunks in Vite.

## 1. Lazy-load route components in `src/App.tsx`

Keep eager (needed for fast first paint / above-the-fold landing):
- `Home`, `NotFound`, `SignIn`, `SignUp` (auth is a frequent first hop and tiny)

Convert the remaining ~50 page imports to `lazy(() => import(...))`. Wrap `<Routes>` in a single top-level `<Suspense fallback={<RouteFallback />}>` rather than per-route — simpler and avoids flicker between sibling routes. Fallback = a lightweight branded spinner component (new `src/components/common/RouteFallback.tsx`).

Group lazy imports by section (Public / Auth / Onboarding / Profile / Planner / Trip / Itinerary / Legal / Admin / Agent) to mirror current comments.

## 2. Lazy-load heavy in-page components

Audit + convert these to `lazy` + `Suspense` at their render sites (only mount when actually shown):

- `components/itinerary/ItineraryAssistant` (chat UI, large)
- `components/itinerary/ActivityConciergeSheet` (if present)
- Budget tab / charts inside `TripDetail` (anything pulling `recharts`)
- DNA reveal animations (quiz result screens)
- Admin dashboard charts in `pages/admin/UnitEconomics`

Each gated behind an existing `showX` / tab-active condition, so `Suspense fallback={null}` is fine.

## 3. Vendor chunk splitting in `vite.config.ts`

Add `build.rollupOptions.output.manualChunks`:

```ts
manualChunks: {
  'react-vendor': ['react', 'react-dom', 'react-router-dom'],
  'supabase':    ['@supabase/supabase-js'],
  'radix':       [/* all @radix-ui/* actually in package.json */],
  'charts':      ['recharts'],
  'date':        ['date-fns'],
  'motion':      ['framer-motion'],
}
```

Resolve actual package names from `package.json` before writing (skip libs not installed). Keep `sourcemap: 'hidden'` and existing dev settings unchanged.

## 4. Defer non-critical scripts in `index.html`

Audit `<script>` tags. Currently only `/src/main.tsx` (module, already deferred). If any tracking pixels/widgets are added later, mark them `defer`. Likely no-op today — confirm during implementation.

## 5. Verification

- `bun run build` (via harness) → list top 10 chunks: `ls -lS dist/assets/*.js | head -10`
- Confirm initial entry chunk < 500 KB and per-page chunks appear
- Smoke-test routes in preview: `/`, `/signin`, `/trip/dashboard`, `/itinerary/:id`, `/admin/dashboard`, `/agent` — watch network tab for failed chunk loads
- Re-run Lighthouse on landing + trip dashboard; expect Unused JS to drop ~800 KB+

## Out of scope

- No backend / RLS / edge-fn changes
- No UX redesign of loading states (single shared fallback)
- No removal of unused deps (separate task)

## Risk

- Suspense boundary at the Routes level briefly unmounts current page during navigation → mitigated by lightweight fallback and React Router's built-in transition.
- `manualChunks` can cause circular-chunk warnings if a vendor is referenced from another vendor chunk; will adjust per build output.
