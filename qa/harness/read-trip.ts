import { createClient } from 'npm:@supabase/supabase-js@2';
function loadEnv(p:string){try{for(const l of Deno.readTextFileSync(p).split('\n')){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n#]*)"?\s*$/);if(m&&!Deno.env.get(m[1])&&m[2].trim())Deno.env.set(m[1],m[2].trim());}}catch{}}
loadEnv(new URL('.env',import.meta.url).pathname);
const sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!);
await sb.auth.signInWithPassword({email:Deno.env.get('VOYANCE_EMAIL')!,password:Deno.env.get('VOYANCE_PASSWORD')!});
const {data,error}=await sb.from('trips').select('itinerary_data,metadata,itinerary_status').eq('id','8cd4f0c5-edcc-439b-b68d-f5d259107a2d').single();
if(error)console.log('ERR',error.message);
const it=(data as any)?.itinerary_data;
console.log('status=',(data as any)?.itinerary_status,'itinerary_data keys=',it?Object.keys(it):null);
const days=it?.days||it?.itinerary?.days||it?.itinerary;
console.log('days len=',Array.isArray(days)?days.length:typeof days);
const d=Array.isArray(days)?days[0]:null;
console.log('day0 keys=',d?Object.keys(d):null);
const acts=d?.activities||d?.items||d?.schedule;
console.log('acts len=',Array.isArray(acts)?acts.length:typeof acts);
if(Array.isArray(acts)&&acts[0]) console.log('act0 keys=',Object.keys(acts[0]),'\nact0=',JSON.stringify(acts[0]).slice(0,600));
