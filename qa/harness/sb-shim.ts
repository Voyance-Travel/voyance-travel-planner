/**
 * qa/harness/sb-shim.ts — stands in for `@/integrations/supabase/client` so
 * REAL frontend utils (splitJourneyIfNeeded) run under Deno against prod,
 * signed in as the QA account. Wired up via import_map.json.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

function loadEnvFile(path: string) {
  try {
    for (const line of Deno.readTextFileSync(path).split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n#]*)"?\s*$/);
      if (m && !Deno.env.get(m[1]) && m[2].trim()) Deno.env.set(m[1], m[2].trim());
    }
  } catch { /* absent */ }
}
loadEnvFile(new URL('.env', import.meta.url).pathname);

export const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);

const { error } = await supabase.auth.signInWithPassword({
  email: Deno.env.get('VOYANCE_EMAIL')!,
  password: Deno.env.get('VOYANCE_PASSWORD')!,
});
if (error) throw new Error(`sb-shim sign-in failed: ${error.message}`);
