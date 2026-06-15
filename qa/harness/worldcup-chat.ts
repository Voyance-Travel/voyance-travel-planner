// Drives the REAL "Just Tell Us" chat flow for a World Cup day trip, then
// generates + inspects the content.
import { createClient } from 'npm:@supabase/supabase-js@2';
function loadEnv(p:string){try{for(const l of Deno.readTextFileSync(p).split('\n')){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n#]*)"?\s*$/);if(m&&!Deno.env.get(m[1])&&m[2].trim())Deno.env.set(m[1],m[2].trim());}}catch{}}
loadEnv(new URL('.env',import.meta.url).pathname);
const URL_=Deno.env.get('SUPABASE_URL')!,ANON=Deno.env.get('SUPABASE_ANON_KEY')!;
const sb=createClient(URL_,ANON);
const {data:auth}=await sb.auth.signInWithPassword({email:Deno.env.get('VOYANCE_EMAIL')!,password:Deno.env.get('VOYANCE_PASSWORD')!});
const uid=auth!.user!.id;
async function chat(messages:any[]){const s=(await sb.auth.getSession()).data.session!;
  const r=await fetch(`${URL_}/functions/v1/chat-trip-planner`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${s.access_token}`,'apikey':ANON},body:JSON.stringify({messages})});
  const raw=await r.text();let arg='',txt='';for(const l of raw.split('\n')){const m=l.match(/^data:\s*(\{.*\})\s*$/);if(!m)continue;try{const c=JSON.parse(m[1]);const d=c?.choices?.[0]?.delta;if(Array.isArray(d?.tool_calls))for(const tc of d.tool_calls)arg+=tc?.function?.arguments??'';if(typeof d?.content==='string')txt+=d.content;}catch{}}
  let ex=null;try{ex=JSON.parse(arg);}catch{}return {ex,txt};}
const msg="I'm in Atlanta for the FIFA World Cup on 2026-06-21, just for that one day — I live here so no flights or hotel. I want to go to the fan fest, watch the match, hit a couple bars, and see some sights around the games.";
let {ex,txt}=await chat([{role:'user',content:msg}]);
if(!ex&&txt){({ex,txt}=await chat([{role:'user',content:msg},{role:'assistant',content:txt},{role:'user',content:'Just that one day, June 21 2026, 2 of us, moderate budget. No flights or hotel.'}]));}
console.log('CHAT EXTRACTION:',JSON.stringify({dest:ex?.destination,start:ex?.startDate,end:ex?.endDate,travelers:ex?.travelers,multiCity:ex?.isMultiCity,mustDo:ex?.mustDoActivities,notes:ex?.additionalNotes||ex?.tripContext},null,0));
const start=ex?.startDate||'2026-06-21', end=ex?.endDate||'2026-06-21';
console.log(`DAY TRIP? start===end: ${start===end?'YES ✅':'NO ❌ ('+start+'→'+end+')'}`);
// create + generate (mirrors the confirm-card path)
const {data:trip}=await sb.from('trips').insert({user_id:uid,name:'QA WC chat',destination:ex?.destination||'Atlanta, GA',start_date:start,end_date:end,travelers:ex?.travelers||2,trip_type:'vacation',budget_tier:'moderate',metadata:{additionalNotes:ex?.additionalNotes||msg,mustDoActivities:ex?.mustDoActivities}}).select('id').single();
const session=(await sb.auth.getSession()).data.session!;
await fetch(`${URL_}/functions/v1/generate-itinerary`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`,'apikey':ANON},body:JSON.stringify({action:'generate-trip-day',tripId:trip!.id,dayNumber:1,totalDays:1,destination:ex?.destination||'Atlanta, GA',destinationCountry:'United States',date:start,travelers:ex?.travelers||2,tripType:'vacation',budgetTier:'moderate'})}).then(r=>r.text());
await new Promise(r=>setTimeout(r,9000));
const {data}=await sb.from('trips').select('itinerary_data,metadata').eq('id',trip!.id).single();
console.log('TRIP',trip!.id,'storedNotes=',JSON.stringify(((data as any)?.metadata?.additionalNotes||'').slice(0,90)));
const acts=((data as any)?.itinerary_data?.days?.[0]?.activities)||[];
console.log(`\nGENERATED DAY (${acts.length} activities):`);
for(const a of acts){const fh=/\bflight\b|airport|hotel|check.?in|check.?out/i.test(`${a.title||a.name} ${a.category}`)?'  🏨FLIGHT/HOTEL':'';console.log(`  ${a.startTime||'--'} ${(a.category||'').padEnd(11)} ${a.title||a.name}  src=${a.source||'-'}${fh}`);if(a.description)console.log(`       "${String(a.description).slice(0,110)}"`);}
const fanfest=acts.some((a:any)=>/fan fest|fan zone/i.test(`${a.title||a.name}`));
const bareVenue=acts.some((a:any)=>/centennial olympic park/i.test(`${a.title||a.name}`)&&!/fan fest|fan zone|world cup/i.test(`${a.title||a.name}`));
const flightHotel=acts.some((a:any)=>/\bflight\b|airport|hotel|check.?in|check.?out/i.test(`${a.title||a.name} ${a.category}`));
console.log(`\n── GRADE ──`);
console.log(`  flights/hotel cards? ${flightHotel?'❌ PRESENT':'✅ none'}`);
console.log(`  Fan Fest framing present? ${fanfest?'✅':'❌'}`);
console.log(`  bare "Centennial Olympic Park" (no WC framing)? ${bareVenue?'❌ yes':'✅ no'}`);
