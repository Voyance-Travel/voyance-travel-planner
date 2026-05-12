# Fix `persist-day-contract.test.ts` parse error + glob CI

## STEP 1 — Root cause (already diagnosed)

`supabase/functions/_shared/persist-day-contract.test.ts` line 35-39:

```ts
Deno.test('does NOT drop legit acronyms in parens like (NYC)', () => {
  const acts = [{ title: 'Visit MoMA (NYC)', startTime: '11:00', category: 'museum' }];
  const { activities } = enforcePersistDayContract(acts);
  assertEquals(activities.length, 1);
                                        ← missing `});`
Deno.test('drops "find a local spot"', () => {
```

The next `Deno.test(...)` is parsed as a positional argument to the prior call, then EOF hits inside the unclosed expression at line 111 — exactly what Deno reports (`Expected ',', got '<eof>' at 111:4`).

Fix is a single-line insertion of `});` after the `assertEquals(activities.length, 1);` line. No logic change.

## STEP 2 — Verify

```
deno test --no-run supabase/functions/_shared/persist-day-contract.test.ts   # parses
deno test --allow-read --allow-env supabase/functions/_shared/persist-day-contract.test.ts  # runs
```

Both must succeed. Test failures (if any) are out of scope — only the parse error is being closed.

## STEP 3 — Update `.github/workflows/tests.yml`

Replace the explicit two-file Deno step with a glob covering both layout conventions:

```yaml
- name: Deno (edge function tests)
  run: |
    deno test --allow-read --allow-env --allow-net \
      'supabase/functions/**/__tests__/*.test.ts' \
      'supabase/functions/**/*.test.ts'
```

Deno dedupes when both patterns match the same file. This auto-picks up new test files going forward (the original task's stated motivation).

## STEP 4 — Sanity-sweep other test files

Run `deno test --no-run 'supabase/functions/**/*.test.ts' 2>&1 | grep -iE "error|cannot"` and confirm zero hits. If any other file has the same class of error, fix it the same way (add missing `});`); otherwise no further edits.

## STEP 5 — Local CI dry-run

`deno test --no-run 'supabase/functions/**/__tests__/*.test.ts' 'supabase/functions/**/*.test.ts'` to confirm the glob resolves under bash and parses everything. Push verification (`git commit --allow-empty`) is out of scope for this agent — note in closing message that the workflow will fire on the next real push.

## Files

- **Edit** `supabase/functions/_shared/persist-day-contract.test.ts` — insert `});` after line 38
- **Edit** `.github/workflows/tests.yml` — replace explicit file list with glob
- **Possibly edit** any other file flagged by STEP 4 (none expected)
