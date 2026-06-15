// Tests the "Build It Myself" converter: POSTs realistic ChatGPT/Claude paste
// text to the live parse-trip-input edge fn and grades the structured output
// against the parser's own contract (time-headers≠activities, either/or
// grouping, cost/date extraction, no CJK leak, day structure).
import { createClient } from 'npm:@supabase/supabase-js@2';
function loadEnv(p:string){try{for(const l of Deno.readTextFileSync(p).split('\n')){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n#]*)"?\s*$/);if(m&&!Deno.env.get(m[1])&&m[2].trim())Deno.env.set(m[1],m[2].trim());}}catch{}}
loadEnv(new URL('.env',import.meta.url).pathname);
const URL_=Deno.env.get('SUPABASE_URL')!,ANON=Deno.env.get('SUPABASE_ANON_KEY')!;
const sb=createClient(URL_,ANON);
const {data:auth}=await sb.auth.signInWithPassword({email:Deno.env.get('VOYANCE_EMAIL')!,password:Deno.env.get('VOYANCE_PASSWORD')!});
if(!auth?.user){console.log('AUTH FAILED');Deno.exit(1);}

async function parse(text:string){
  const s=(await sb.auth.getSession()).data.session!;
  const r=await fetch(`${URL_}/functions/v1/parse-trip-input`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${s.access_token}`,'apikey':ANON},body:JSON.stringify({text})});
  const t=await r.text();try{return {status:r.status,data:JSON.parse(t)};}catch{return {status:r.status,data:{raw:t.slice(0,300)}};}
}

// ── Realistic pastes (the kind a user copies out of ChatGPT) ──────────────────
const SAMPLES:Array<{label:string;text:string;city:string}>=[{
  label:'ChatGPT Austin 3-day (time-headers, either/or, costs)',city:'Austin',
  text:`Here's a 3-day Austin trip for 2, mid-range, focused on food & live music. Budget ~$200/day.

Day 1 – Arrival + Easy Austin Vibes
Morning
* Coffee at Cosmic Coffee
Lunch
* Franklin BBQ (preorder required, ~$25)
Afternoon
* Swim at Barton Springs Pool (go early; water is cold, $9)
Dinner
* Uchi (elevated, $$$) or Loro (casual but excellent)
Evening: Live music at The Continental Club

Day 2 – Culture + Tacos
* Breakfast: Veracruz All Natural (tacos, ~$12)
* Visit the Texas State Capitol (free)
* Dinner at Suerte ($$)

Day 3 — Departure
* Brunch at Jacoby's then head to ABIA airport`,
},{
  label:'Claude Tokyo 2-day (markdown, ¥ currency, free items)',city:'Tokyo',
  text:`## Day 1
- Morning: Meiji Shrine (free)
- teamLab Planets (¥3800)
- Lunch: Afuri Ramen (~¥1500)
- Walk around Omotesando
- Evening: dinner in Shibuya

## Day 2
- Tsukiji Outer Market (breakfast, street food)
- Explore Harajuku
- Dinner — Uobei sushi (cheap, conveyor belt)`,
}];

function pm(t:string){const m=String(t||'').match(/(\d{1,2}):(\d{2})/);return m?+m[1]*60+ +m[2]:-1;}
const TIME_HEADERS=/^(morning|afternoon|evening|night|late night|breakfast|brunch|lunch|dinner|midday|sunset)$/i;
const thisYear=new Date().getFullYear();

console.log(`\nBUILD-IT-MYSELF CONVERTER — live parse-trip-input\n${'═'.repeat(64)}`);
for(const s of SAMPLES){
  const {status,data}=await parse(s.text);
  console.log(`\n▼ ${s.label}  [HTTP ${status}]`);
  if(status!==200||!data?.days){console.log('  ❌ no days parsed:',JSON.stringify(data).slice(0,200));continue;}
  const days=data.days;
  const allActs=days.flatMap((d:any)=>d.activities||[]);
  // Grading
  const headerAsAct=allActs.filter((a:any)=>TIME_HEADERS.test(String(a.name||'').trim()));
  const cjk=allActs.filter((a:any)=>/[　-鿿가-힯]/.test(`${a.name} ${a.notes||''} ${a.location||''}`));
  const optGroups=new Set(allActs.filter((a:any)=>a.isOption).map((a:any)=>a.optionGroup));
  const withCost=allActs.filter((a:any)=>typeof a.cost==='number');
  const dining=allActs.filter((a:any)=>a.category==='dining');
  const badDates=[...(data.dates?[data.dates.start,data.dates.end]:[]),...days.map((d:any)=>d.date)].filter(Boolean).filter((d:string)=>{const y=+String(d).slice(0,4);return y&&y<thisYear;});
  console.log(`  days=${days.length} acts=${allActs.length} dest=${data.destination||'—'} dur=${data.duration||'—'} travelers=${data.travelers||'—'} vibe=${data.tripVibe||'—'}`);
  console.log(`  ${headerAsAct.length===0?'✅':'❌'} time-headers not activities${headerAsAct.length?': '+headerAsAct.map((a:any)=>a.name).join(','):''}`);
  console.log(`  ${cjk.length===0?'✅':'❌'} no CJK/schema leak${cjk.length?': '+cjk.map((a:any)=>a.name).join(','):''}`);
  console.log(`  ${optGroups.size>0?'✅':'⚠️ '} either/or grouped (${optGroups.size} group${optGroups.size===1?'':'s'})`);
  console.log(`  ${withCost.length>0?'✅':'⚠️ '} costs extracted (${withCost.length} priced)`);
  console.log(`  ${dining.length>0?'✅':'⚠️ '} dining categorized (${dining.length})`);
  console.log(`  ${badDates.length===0?'✅':'❌'} dates not in the past${badDates.length?': '+badDates.join(','):''}`);
  // show the actual parse so we can eyeball "how it comes across"
  for(const d of days){
    console.log(`   Day ${d.dayNumber}${d.theme?' · '+d.theme:''}:`);
    for(const a of (d.activities||[])) console.log(`     • ${(a.time||'--').toString().padEnd(10)} ${a.name}${a.category?` [${a.category}]`:''}${typeof a.cost==='number'?` $${a.cost}`:''}${a.isOption?` (opt:${a.optionGroup})`:''}`);
  }
}
console.log(`\n${'═'.repeat(64)}`);
