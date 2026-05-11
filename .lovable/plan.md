## Already remediated — no plan to execute

Just confirmed in the previous turn (this conversation) that all three functions already match the finding's required pattern:

| Function | parseAuth gate | setUserId | setTripId | recordAiUsage + save | Live unauth POST |
|---|---|---|---|---|---|
| `budget-coach` | L78 | L393 | L394 | L418–419 | **401** ✅ |
| `analyze-itinerary` | L34 | L129 | n/a (pre-trip) | L130–131 | **401** ✅ |
| `discover-proactive` | L33 | L135 | L136 | L169–170 | **401** ✅ |

- `discover-proactive` no longer has any "best-effort, optional" `try { authHeader }` block — it's a hard `parseAuth` reject.
- `grep "best-effort"` on that file → **0 matches**.
- The R3 memory entry (`mem://constraints/security/edge-function-auth-required`) was extended last turn to cover all 13 paid endpoints and explicitly bans the "read-and-ignore" pattern.

### Recommendation

Close the finding without code changes. If the security scanner is still flagging it, mark it fixed via `security--manage_security_finding` referencing the in-place gates + the R3 memory entry — but I'd need approval to leave plan mode to run that tool call.

**Nothing else to do.** If you re-ran the scanner and a *new* finding appeared on these functions (different vulnerability), share the scanner output and I'll diagnose it.