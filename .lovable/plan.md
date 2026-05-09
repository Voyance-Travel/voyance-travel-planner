## Fix 2.3a — Capacitor config: register `voyance` URL scheme

### Current state
`capacitor.config.ts` already matches the spec on every field except the two new `scheme: 'voyance'` declarations under `ios` and `android`. Nothing else needs to change — `appId`, `webDir`, `server.url/cleartext/allowNavigation`, and `appendUserAgent` are all correct.

### Change

Replace `capacitor.config.ts` with the spec-provided contents. Diff against current:

```diff
   ios: {
-    appendUserAgent: 'VoyanceApp'
+    appendUserAgent: 'VoyanceApp',
+    // Custom URL scheme for OAuth + magic-link returns. Must match
+    // CFBundleURLSchemes in Info.plist (see step 2.3c).
+    scheme: 'voyance'
   },
   android: {
-    appendUserAgent: 'VoyanceApp'
+    appendUserAgent: 'VoyanceApp',
+    // Match for Android intent-filter (set in AndroidManifest.xml).
+    scheme: 'voyance'
   }
```

### Scope

This is **2.3a only** — the config edit. Steps 2.3b (web/native branching in OAuth code) and 2.3c (Info.plist / AndroidManifest scheme registration) are separate tickets and not in scope here.

### Verify

```bash
grep -n "scheme: 'voyance'" capacitor.config.ts
# Expected: 2 hits (ios + android)
```

After this lands, `npx cap sync` on the user's local machine will propagate the scheme into the native projects.