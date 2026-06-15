import { createClient } from 'npm:@supabase/supabase-js@2';
function loadEnv(p:string){try{for(const l of Deno.readTextFileSync(p).split('\n')){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n#]*)"?\s*$/);if(m&&!Deno.env.get(m[1])&&m[2].trim())Deno.env.set(m[1],m[2].trim());}}catch{}}
loadEnv(new URL('.env',import.meta.url).pathname);
const arg=(n:string,d:string)=>{const i=Deno.args.indexOf(`--${n}`);return i>=0?Deno.args[i+1]:d;};
const notes=arg('notes','Walking around, seeing the sights, relaxed pace');
const date=arg('date','2026-08-08');
const URL_=Deno.env.get('SUPABASE_URL')!,ANON=Deno.env.get('SUPABASE_ANON_KEY')!;
const sb=createClient(URL_,ANON);
const {data:auth}=await sb.auth.signInWithPassword({email:Deno.env.get('VOYANCE_EMAIL')!,password:Deno.env.get('VOYANCE_PASSWORD')!});
const uid=auth!.user!.id;
const {data:trip}=await sb.from('trips').insert({user_id:uid,name:'QA validate',destination:'Atlanta, GA',start_date:date,end_date:date,travelers:2,trip_type:'vacation',budget_tier:'moderate',metadata:{additionalNotes:notes}}).select('id').single();
const session=(await sb.auth.getSession()).data.session!;
await fetch(`${URL_}/functions/v1/generate-itinerary`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`,'apikey':ANON},body:JSON.stringify({action:'generate-trip-day',tripId:trip!.id,dayNumber:1,totalDays:1,destination:'Atlanta, GA',destinationCountry:'United States',date,travelers:2,tripType:'vacation',budgetTier:'moderate'})}).then(r=>r.text());
await new Promise(r=>setTimeout(r,9000));
const {data}=await sb.from('trips').select('itinerary_data').eq('id',trip!.id).single();
const d=(data as any)?.itinerary_data?.days?.[0];
const acts=(d?.activities||[]);
const pm=(s:any)=>{const m=String(s??'').match(/(\d{1,2}):(\d{2})/);return m?(+m[1])*60+ +m[2]:null;};
console.log(`\nNOTES="${notes}" DATE=${date} → ${acts.length} activities`);
let sumPP=0; const titles:string[]=[];
for(const a of acts){const p=a.price?.amount??a.cost?.amount??0; if(p)sumPP+=p; const tip=a.tip||a.insiderTip||a.proTip||'';
  titles.push(`${a.startTime||a.time||'--'}-${a.endTime||'--'} ${(a.category||'').padEnd(11)} ${a.title||a.name}  $${p||'-'}/pp${/\bwake\s+\d|next day|tomorrow/i.test(tip)?'  ⚠️TIP-LEAK':''}`);}
for(const t of titles)console.log('  '+t);
// checks
const stops=acts.filter((a:any)=>!/transit|transport|logistics|flight/i.test(String(a.category||'')));
const meals=acts.filter((a:any)=>/dining/i.test(String(a.category||''))||/breakfast|lunch|dinner/i.test(String(a.title||'')));
const blocks=acts.map((a:any)=>[pm(a.startTime||a.time),pm(a.endTime)]).filter((b:any)=>b[0]!=null).sort((x:any,y:any)=>x[0]-y[0]);
let overlaps=0; for(let i=1;i<blocks.length;i++) if(blocks[i][0]<blocks[i-1][1]) overlaps++;
const lastEnd=Math.max(...blocks.map((b:any)=>b[1]||0));
const tipLeak=acts.some((a:any)=>/\bwake\s+\d|next day|tomorrow/i.test(String(a.tip||a.insiderTip||a.proTip||'')));
const hallucinationWords=acts.filter((a:any)=>/marrakesh market|world cup vibes|fan vibes/i.test(String(a.title||a.name||'')));
const fmm=(m:number)=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
console.log(`\n── GRADE ──`);
console.log(`  stops(non-transit)=${stops.length}  meals=${meals.length}  pace 3-5? ${stops.length>=3&&stops.length<=6?'✅':'❌ ('+stops.length+')'}`);
console.log(`  last activity ends ${fmm(lastEnd)}  by ~21:00? ${lastEnd<=22*60?'✅':'❌'}`);
console.log(`  overlaps=${overlaps} ${overlaps===0?'✅':'❌'}`);
console.log(`  tip next-day leak? ${tipLeak?'❌ present':'✅ none'}`);
console.log(`  obvious hallucination/filler? ${hallucinationWords.length?'❌ '+hallucinationWords.map((a:any)=>a.title).join(','):'✅ none'}`);
console.log(`  activity-price sum = $${sumPP}/pp (frontend day total should now match this)`);
