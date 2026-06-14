import { createClient } from 'npm:@supabase/supabase-js@2';
function loadEnv(p:string){try{for(const l of Deno.readTextFileSync(p).split('\n')){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n#]*)"?\s*$/);if(m&&!Deno.env.get(m[1])&&m[2].trim())Deno.env.set(m[1],m[2].trim());}}catch{}}
loadEnv(new URL('.env',import.meta.url).pathname);
const URL_=Deno.env.get('SUPABASE_URL')!,ANON=Deno.env.get('SUPABASE_ANON_KEY')!;
const sb=createClient(URL_,ANON);
const {data:auth}=await sb.auth.signInWithPassword({email:Deno.env.get('VOYANCE_EMAIL')!,password:Deno.env.get('VOYANCE_PASSWORD')!});
const uid=auth!.user!.id;
const {data:trip}=await sb.from('trips').insert({user_id:uid,name:'QA content dump',destination:'Atlanta, GA',start_date:'2026-06-21',end_date:'2026-06-21',travelers:2,trip_type:'vacation',budget_tier:'moderate',metadata:{additionalNotes:'Here for the World Cup, walking around, I live in Atlanta, no flights or hotel.'}}).select('id').single();
const session=(await sb.auth.getSession()).data.session!;
await fetch(`${URL_}/functions/v1/generate-itinerary`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`,'apikey':ANON},body:JSON.stringify({action:'generate-trip-day',tripId:trip!.id,dayNumber:1,totalDays:1,destination:'Atlanta, GA',destinationCountry:'United States',date:'2026-06-21',travelers:2,tripType:'vacation',budgetTier:'moderate'})}).then(r=>r.text());
await new Promise(r=>setTimeout(r,8000));
const {data}=await sb.from('trips').select('itinerary_data').eq('id',trip!.id).single();
const d=(data as any)?.itinerary_data?.days?.[0];
const acts=d?.activities||[];
console.log(`trip ${trip!.id} — ${acts.length} activities`);
for(const a of acts){
  const price=a.price??a.cost??a.estimatedCost??a.priceLevel??a.pricePerPerson;
  const travel=a.travelTime??a.transitTime??a.travelFromPrevious??a.travelTimeMinutes;
  const tip=a.tip||a.insiderTip||a.proTip||(a.tips&&JSON.stringify(a.tips));
  console.log(`\n[${a.startTime||a.time||'--'} → ${a.endTime||'--'}] ${(a.category||'').toUpperCase()} | ${a.title||a.name}`);
  console.log(`   price=${JSON.stringify(price)}  travelFromPrev=${JSON.stringify(travel)}`);
  if(a.description) console.log(`   desc=${String(a.description).slice(0,140)}`);
  if(tip) console.log(`   tip=${String(tip).slice(0,180)}`);
}
console.log('\nday cost fields:',JSON.stringify({dayTotal:d?.dayTotal,total:d?.total,estimatedCost:d?.estimatedCost,perPerson:d?.perPerson}));
