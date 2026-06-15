#!/usr/bin/env -S deno run --no-lock -A
/**
 * Sample event integration rate across 5 Atlanta World Cup day trips
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

const URL = 'https://qpwexpjqzsdkjkvgcntx.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwd2V4cGpxenNka2prdmdjbnR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg0OTczMDQsImV4cCI6MjA2NDA3MzMwNH0.YkF_hVBVkYrRU2neFQhUKpHQzFBEp2GVNPbEO9PUXNc';
const EMAIL = 'alightfoot817@gmail.com';
const PASSWORD = 'Itinerant86!';

const sb = createClient(URL, ANON);

const { data: auth } = await sb.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
if (!auth?.user) {
  console.error('Auth failed');
  Deno.exit(1);
}

const userId = auth.user.id;
const session = (await sb.auth.getSession()).data.session!;

const sleep = (s: number) => new Promise(r => setTimeout(r, s * 1000));

const results = [];

for (let i = 1; i <= 5; i++) {
  console.log(`\n━━━ Sample ${i}/5 ━━━`);

  const d = new Date();
  d.setDate(d.getDate() + 60 + i);
  const day = d.toISOString().slice(0, 10);

  // Create trip
  const { data: trip } = await sb.from('trips').insert({
    user_id: userId,
    name: `Sample ${i} — Atlanta WC`,
    destination: 'Atlanta, GA',
    start_date: day,
    end_date: day,
    travelers: 2,
    trip_type: 'vacation',
    budget_tier: 'moderate',
    metadata: {
      additionalNotes: 'Walking around, World Cup vibes',
      interestCategories: ['sightseeing', 'food'],
    },
  }).select('id').single();

  if (!trip) {
    console.log(`❌ Trip ${i} creation failed`);
    continue;
  }

  // Generate day 1
  const res = await fetch(`${URL}/functions/v1/generate-itinerary`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': ANON,
    },
    body: JSON.stringify({
      tripId: trip.id,
      requestId: crypto.randomUUID(),
      mode: 'generate-trip-day',
      dayNumber: 1,
    }),
  });

  if (!res.ok) {
    console.log(`❌ Generation failed: ${res.status}`);
    continue;
  }

  await sleep(2);

  // Read result
  const { data: result } = await sb
    .from('trips')
    .select('itinerary_data')
    .eq('id', trip.id)
    .single();

  const day1 = result?.itinerary_data?.days?.[0];
  if (!day1) {
    console.log(`❌ No day 1`);
    continue;
  }

  const cards = day1.cards || [];
  const activities = cards.filter((c: any) =>
    ['activity', 'attraction'].includes(c.type)
  );

  // Check for event integration
  const eventCards = activities.filter((c: any) => {
    const title = (c.title || '').toLowerCase();
    return (
      title.includes('world cup') ||
      title.includes('fan fest') ||
      title.includes('fan zone') ||
      title.includes('watch party') ||
      (title.includes('fifa') && !title.includes('museum'))
    );
  });

  // Check for banned filler
  const fillerCards = activities.filter((c: any) => {
    const title = (c.title || '').toLowerCase();
    return (
      title.match(/world cup (vibes?|spirit|themed|atmosphere)/i) ||
      title.match(/(soak|embrace|experience) .* world cup/i)
    );
  });

  const hasEvent = eventCards.length > 0;
  const hasFiller = fillerCards.length > 0;

  console.log(`Trip ${trip.id.slice(0, 8)}`);
  console.log(`  Activities: ${activities.length}`);
  console.log(`  Event cards: ${eventCards.length}`);
  console.log(`  Filler cards: ${fillerCards.length}`);

  if (eventCards.length > 0) {
    console.log(`  ✅ Event integrated:`);
    eventCards.forEach((c: any) => {
      console.log(`     - ${c.title}`);
    });
  }

  if (fillerCards.length > 0) {
    console.log(`  ❌ FILLER DETECTED (scrub failed):`);
    fillerCards.forEach((c: any) => {
      console.log(`     - ${c.title}`);
    });
  }

  if (!hasEvent && !hasFiller) {
    console.log(`  ⚠️  No event integration, but clean (no filler)`);
  }

  results.push({
    sample: i,
    tripId: trip.id,
    hasEvent,
    hasFiller,
    eventCards: eventCards.map((c: any) => c.title),
    fillerCards: fillerCards.map((c: any) => c.title),
  });
}

console.log(`\n━━━ SUMMARY ━━━`);
console.log(`Samples: ${results.length}`);
console.log(`Event integrated: ${results.filter(r => r.hasEvent).length}/${results.length}`);
console.log(`Filler detected: ${results.filter(r => r.hasFiller).length}/${results.length}`);
console.log(`Clean (no filler): ${results.filter(r => !r.hasFiller).length}/${results.length}`);

const hitRate = (results.filter(r => r.hasEvent).length / results.length * 100).toFixed(0);
const fillerRate = (results.filter(r => r.hasFiller).length / results.length * 100).toFixed(0);

console.log(`\nIntegration rate: ${hitRate}%`);
console.log(`Filler rate: ${fillerRate}%`);

if (results.filter(r => r.hasFiller).length === 0) {
  console.log(`\n✅ PASS: Zero filler detected (scrub working)`);
} else {
  console.log(`\n❌ FAIL: Filler detected (scrub not working)`);
  Deno.exit(1);
}
