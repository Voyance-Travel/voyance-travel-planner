// Bulk generality check: every curated host-city event, several runs each,
// against the REAL prod generation path. Confirms the event system injects the
// right venue (not just Atlanta WC) and reports placement (late cards) honestly.
import { createClient } from 'npm:@supabase/supabase-js@2';
function loadEnv(p:string){try{for(const l of Deno.readTextFileSync(p).split('\n')){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n#]*)"?\s*$/);if(m&&!Deno.env.get(m[1])&&m[2].trim())Deno.env.set(m[1],m[2].trim());}}catch{}}
loadEnv(new URL('.env',import.meta.url).pathname);
const URL_=Deno.env.get('SUPABASE_URL')!,ANON=Deno.env.get('SUPABASE_ANON_KEY')!;
const sb=createClient(URL_,ANON);
const {data:auth}=await sb.auth.signInWithPassword({email:Deno.env.get('VOYANCE_EMAIL')!,password:Deno.env.get('VOYANCE_PASSWORD')!});
const uid=auth!.user!.id;
const pm=(s:string)=>{const m=String(s||'').match(/(\d{1,2}):(\d{2})/);return m?+m[1]*60+ +m[2]:-1;};

const EVENTS=[
  {label:'WC · Atlanta',     dest:'Atlanta, GA',      country:'United States', date:'2026-06-21', notes:'here for the FIFA World Cup — fan fest, watch the match, a couple bars', venueRe:/centennial|brewhouse/i, expect:'Fan Fest + watch party'},
  {label:'Oktoberfest · Munich', dest:'Munich, Germany', country:'Germany',     date:'2026-09-25', notes:'in Munich for Oktoberfest, want the beer tents', venueRe:/theresienwiese|wiesn|oktoberfest/i, expect:'Theresienwiese'},
  {label:'Mardi Gras · NOLA', dest:'New Orleans, LA',  country:'United States', date:'2027-02-09', notes:'in New Orleans for Mardi Gras, want to catch the parades', venueRe:/st\.? charles|mardi gras|parade/i, expect:'St. Charles parades'},
  {label:'Marathon · NYC',    dest:'New York, NY',     country:'United States', date:'2026-11-01', notes:'in NYC to watch the marathon', venueRe:/first avenue|marathon/i, expect:'First Ave spectating'},
];
const RUNS=2;

async function gen(e:any,i:number){
  const {data:trip}=await sb.from('trips').insert({user_id:uid,name:`QA evt ${e.label} ${i}`,destination:e.dest,start_date:e.date,end_date:e.date,travelers:2,trip_type:'vacation',budget_tier:'moderate',metadata:{additionalNotes:e.notes}}).select('id').single();
  const s=(await sb.auth.getSession()).data.session!;
  await fetch(`${URL_}/functions/v1/generate-itinerary`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${s.access_token}`,'apikey':ANON},body:JSON.stringify({action:'generate-trip-day',tripId:trip!.id,dayNumber:1,totalDays:1,destination:e.dest,destinationCountry:e.country,date:e.date,travelers:2,tripType:'vacation',budgetTier:'moderate'})}).then(r=>r.text());
  return trip!.id;
}

console.log(`\nBULK EVENT GENERALITY — ${EVENTS.length} events × ${RUNS} runs (live prod)\n${'═'.repeat(64)}`);
for(const e of EVENTS){
  const ids:string[]=[];
  for(let i=0;i<RUNS;i++) ids.push(await gen(e,i));
  await new Promise(r=>setTimeout(r,11000));
  console.log(`\n▼ ${e.label}  (expect: ${e.expect})`);
  for(const id of ids){
    const {data}=await sb.from('trips').select('itinerary_data').eq('id',id).single();
    const acts=((data as any)?.itinerary_data?.days?.[0]?.activities)||[];
    const evCard=acts.find((a:any)=>a.source==='host-city-event'||e.venueRe.test(`${a.title||a.name} ${a.location||''}`));
    const injected=acts.some((a:any)=>a.source==='host-city-event');
    const hotelFlight=acts.some((a:any)=>/\bflight\b|airport|hotel|check.?in|check.?out/i.test(`${a.title||a.name} ${a.category}`));
    const latest=Math.max(...acts.map((a:any)=>pm(a.startTime||a.time)).filter((n:number)=>n>=0),-1);
    const lateEvt=acts.filter((a:any)=>a.source==='host-city-event'&&pm(a.startTime||a.time)>pm('21:00'));
    console.log(`  ${injected?'✅inject':'❌none  '} venue=${evCard?(evCard.title||evCard.name).slice(0,38):'—'}  stops=${acts.length}  latest=${latest>=0?Math.floor(latest/60)+':'+String(latest%60).padStart(2,'0'):'--'}  ${hotelFlight?'🏨HOTEL/FLIGHT':''}${lateEvt.length?` ⚠️LATE-EVENT@${lateEvt.map((a:any)=>a.startTime).join(',')}`:''}`);
  }
}
console.log(`\n${'═'.repeat(64)}\nNOTE: event-snap fix (7d52867b3) not yet deployed — any ⚠️LATE-EVENT here is\npre-snap behavior the deploy will fix. Injection/venue generality is live now.`);
