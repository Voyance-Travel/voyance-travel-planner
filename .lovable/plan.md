## Add JWT auth gate to `activity-concierge`

Currently `supabase/functions/activity-concierge/index.ts` has no authentication — any unauthenticated caller can invoke the AI gateway. Add a JWT check at the top of the handler.

### Changes (single file)

`supabase/functions/activity-concierge/index.ts`:

1. Add import:
   ```ts
   import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
   ```
2. Inside `serve()`, after the CORS preflight (after line 119), before the `try` body parses JSON:
   ```ts
   const authHeader = req.headers.get("Authorization");
   if (!authHeader?.startsWith("Bearer ")) {
     return new Response(
       JSON.stringify({ error: "Authentication required" }),
       { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   }
   const supabase = createClient(
     Deno.env.get("SUPABASE_URL")!,
     Deno.env.get("SUPABASE_ANON_KEY")!
   );
   const { data: { user }, error: authError } = await supabase.auth.getUser(
     authHeader.replace("Bearer ", "")
   );
   if (authError || !user) {
     return new Response(
       JSON.stringify({ error: "Invalid token" }),
       { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   }
   ```
   Note: spec writes `headers: corsHeaders` for the 401 responses, but every other response in this file uses `{ ...corsHeaders, "Content-Type": "application/json" }` for JSON — I'll follow the file's convention so the client parses errors correctly.

### Out of scope

No rate limiting, no other behavior changes. The function will continue to deploy with `verify_jwt = false` (Lovable default) — the in-code check is what enforces auth.