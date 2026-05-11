## Three AI-Gateway functions — already remediated, memorialize only

### Live verification (just curled)

| Function | Unauth POST result |
|---|---|
| `/analyze-itinerary` | **401** `{"error":"Authentication required","code":"UNAUTHORIZED"}` ✅ |
| `/discover-proactive` | **401** `{"error":"Authentication required","code":"UNAUTHORIZED"}` ✅ |
| `/budget-coach` | **401** `{"error":"Authentication required","code":"UNAUTHORIZED"}` ✅ |

### Code audit (current state)

All three already use `parseAuth` + Pattern B cost attribution exactly as the finding requests:

| Function | parseAuth gate | setUserId | setTripId | recordAiUsage + save |
|---|---|---|---|---|
| `budget-coach` | L78 | L393 | L394 | L418–419 |
| `analyze-itinerary` | L34 | L129 | n/a (pre-trip) | L130–131 |
| `discover-proactive` | L33 | L135 | L136 | L169–170 |

`discover-proactive` no longer contains the "best-effort, optional" `try { authHeader }` pattern — it's a hard reject. The only `optional` matches in `budget-coach` are inside the system-prompt copy ("optional museums beyond the daily anchor"), not auth code.

### Action — memorialize only

1. **Extend `mem://constraints/security/edge-function-auth-required.md`** (the existing R3 "Paid-API Auth + Cost Attribution" entry) to add these three functions to the covered-functions list, bumping the count from 10 → 13. Add a note that `discover-proactive` previously used a "best-effort, optional" auth pattern that was a silent vulnerability and must never be reintroduced for paid-API endpoints — read the JWT and reject, or don't read it at all and stay public; never read-and-ignore.

2. **No new R-number entry** — this is a coverage extension of the existing constraint, not a new pattern.

3. **No code changes, no migration, no security-finding tool call** (the finding doesn't appear in the live scanner results — it was raised in chat).