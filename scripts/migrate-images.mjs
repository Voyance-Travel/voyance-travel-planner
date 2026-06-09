/**
 * migrate-images.mjs — Port ALL image FILES from the OLD Lovable Supabase storage
 * to the NEW project's storage, preserving bucket+path, then repoint the DB URLs.
 *
 * Covers every at-risk record:
 *   - curated_images.image_url        (activities/hotels/restaurants/destinations cache)
 *   - destinations.hero_image_url
 *   - destinations.stock_image_url
 *   - trips.metadata->>hero_image     (JSONB; per-user saved trip heroes)
 *
 * Strategy per row: fetch bytes from the old public URL → upload to the SAME
 * bucket/path on the new project → UPDATE the row to the new URL.
 *
 * Idempotent + resumable: a migrated row no longer matches the OLD-host filter, and
 * if the new object already exists we just repoint. Re-run safely to retry failures.
 *
 * RUN:
 *   1. npm i @supabase/supabase-js   (already a dep in this repo)
 *   2. Preview with no writes first:
 *        SUPABASE_SERVICE_ROLE_KEY="<new project service_role secret>" \
 *          node scripts/migrate-images.mjs --dry-run
 *      Then run live (drop --dry-run):
 *        SUPABASE_SERVICE_ROLE_KEY="<new project service_role secret>" \
 *          node scripts/migrate-images.mjs
 *      (get the key from Supabase → Project Settings → API → `service_role` secret)
 *
 * Failures (if any) are written to migrate-images-failures.json — just re-run to retry.
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const OLD_HOST = 'jsxplunjjvxuejeouwob.supabase.co';
const NEW_HOST = 'qpwexpjqzsdkjkvgcntx.supabase.co';
const NEW_URL  = `https://${NEW_HOST}`;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
if (!KEY) {
  console.error('❌ Set SUPABASE_SERVICE_ROLE_KEY (new project service_role secret).');
  process.exit(1);
}

const sb = createClient(NEW_URL, KEY, { auth: { persistSession: false } });

const CONCURRENCY = 2;          // gentle — old Lovable rate-limits under heavier load
const BATCH_PAUSE_MS = 150;     // small breather between batches to avoid throttling
const PAGE = 500;               // rows per DB page (cursor-paginated by id)
const ensured = new Set();      // buckets we've confirmed/created
const failures = [];

const TARGETS = [
  { table: 'curated_images', col: 'image_url' },
  { table: 'destinations',  col: 'hero_image_url' },
  { table: 'destinations',  col: 'stock_image_url' },
];

function parseOld(url) {
  // https://<old>/storage/v1/object/public/<bucket>/<path...>
  const m = String(url).match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
  return m ? { bucket: m[1], path: decodeURIComponent(m[2]) } : null;
}

async function ensureBucket(bucket) {
  if (ensured.has(bucket)) return;
  const { data } = await sb.storage.getBucket(bucket);
  if (!data) {
    const { error } = await sb.storage.createBucket(bucket, { public: true });
    if (error && !/already exists/i.test(error.message)) throw error;
    console.log(`  + created public bucket "${bucket}"`);
  }
  ensured.add(bucket);
}

/**
 * Copy one old-host object to the new project (same bucket/path), idempotently.
 * Returns { newUrl, status } and does NOT touch any DB row, so it can back both
 * plain-column targets and the JSONB trips target. `status` is one of:
 *   'exists' (already on new host) | 'copied' | 'dry-copy' | 'dry-repoint' |
 *   'skip-unparseable' | 'fetch-<code>' | 'fetch-err:<msg>' | 'upload:<msg>' | 'bucket:<msg>'
 */
async function copyToNew(oldUrl) {
  const p = parseOld(oldUrl);
  if (!p) return { newUrl: null, status: 'skip-unparseable' };
  const newUrl = `${NEW_URL}/storage/v1/object/public/${p.bucket}/${encodeURI(p.path)}`;
  // already there?
  let exists = false;
  try { exists = (await fetch(newUrl, { method: 'HEAD' })).ok; } catch {}
  if (DRY_RUN) return { newUrl, status: exists ? 'dry-repoint' : 'dry-copy' };
  if (exists) return { newUrl, status: 'exists' };
  // Retry transient failures (429/5xx/network) but NOT 400/404 (file genuinely gone).
  let r, lastErr;
  for (let t = 0; t < 3; t++) {
    if (t) await new Promise(res => setTimeout(res, 500 * t));
    try { r = await fetch(oldUrl); } catch (e) { lastErr = e; r = null; continue; }
    if (r.ok || r.status === 404 || r.status === 400) break; // success or genuinely-gone → stop
  }
  if (!r) return { newUrl, status: `fetch-err:${lastErr?.message || 'network'}` };
  if (!r.ok) return { newUrl, status: `fetch-${r.status}` };
  const buf = Buffer.from(await r.arrayBuffer());
  const ct = r.headers.get('content-type') || 'image/jpeg';
  try { await ensureBucket(p.bucket); } catch (e) { return { newUrl, status: `bucket:${e.message}` }; }
  const { error } = await sb.storage.from(p.bucket).upload(p.path, buf, { contentType: ct, upsert: true });
  if (error) return { newUrl, status: `upload:${error.message}` };
  return { newUrl, status: 'copied' };
}

// Statuses that mean "the new-host object is ready" — safe to repoint the DB.
const OK = new Set(['exists', 'copied', 'dry-copy', 'dry-repoint']);

async function migrateOne(table, col, id, oldUrl) {
  const { newUrl, status } = await copyToNew(oldUrl);
  if (!OK.has(status)) return { id, status, oldUrl };
  if (DRY_RUN) return { id, status };
  const { error: ue } = await sb.from(table).update({ [col]: newUrl }).eq('id', id);
  if (ue) return { id, status: `db:${ue.message}`, oldUrl };
  return { id, status: status === 'copied' ? 'copied' : 'repointed' };
}

function tally(res, counters, label) {
  for (const x of res) {
    counters.done++;
    if (x.status === 'copied' || x.status === 'dry-copy') counters.copied++;
    else if (x.status === 'repointed' || x.status === 'dry-repoint') counters.repoint++;
    else failures.push({ ...label, ...x });
  }
}

async function migrateTarget({ table, col }) {
  console.log(`\n=== ${table}.${col} ===`);
  let cursor = null;
  const c = { done: 0, copied: 0, repoint: 0 };
  while (true) {
    let q = sb.from(table).select('id, ' + col).ilike(col, `%${OLD_HOST}%`).order('id').limit(PAGE);
    if (cursor) q = q.gt('id', cursor);
    const { data, error } = await q;
    if (error) { console.error('  query error:', error.message); break; }
    if (!data?.length) break;
    cursor = data[data.length - 1].id;
    for (let i = 0; i < data.length; i += CONCURRENCY) {
      const batch = data.slice(i, i + CONCURRENCY);
      const res = await Promise.all(batch.map(r => migrateOne(table, col, r.id, r[col])));
      tally(res, c, { table, col });
      if (c.done % 200 === 0) console.log(`  ${c.done} processed (copied ${c.copied}, repointed ${c.repoint}, failed ${failures.length})`);
      await new Promise(r => setTimeout(r, BATCH_PAUSE_MS));
    }
  }
  console.log(`  ✓ ${table}.${col}: copied ${c.copied}, repointed ${c.repoint}, failed-so-far ${failures.length}`);
}

// trips.metadata.hero_image is JSONB — copy the file, then rewrite the nested key
// while preserving the rest of metadata (read-modify-write the whole object).
async function migrateTrips() {
  const filterPath = 'metadata->>hero_image';
  console.log(`\n=== trips.${filterPath} ===`);
  let cursor = null;
  const c = { done: 0, copied: 0, repoint: 0 };
  while (true) {
    let q = sb.from('trips').select('id, metadata').filter(filterPath, 'ilike', `%${OLD_HOST}%`).order('id').limit(PAGE);
    if (cursor) q = q.gt('id', cursor);
    const { data, error } = await q;
    if (error) { console.error('  query error:', error.message); break; }
    if (!data?.length) break;
    cursor = data[data.length - 1].id;
    for (let i = 0; i < data.length; i += CONCURRENCY) {
      const batch = data.slice(i, i + CONCURRENCY);
      const res = await Promise.all(batch.map(async (row) => {
        const oldUrl = row.metadata?.hero_image;
        const { newUrl, status } = await copyToNew(oldUrl);
        if (!OK.has(status)) return { id: row.id, status, oldUrl };
        if (DRY_RUN) return { id: row.id, status };
        const newMeta = { ...row.metadata, hero_image: newUrl };
        const { error: ue } = await sb.from('trips').update({ metadata: newMeta }).eq('id', row.id);
        if (ue) return { id: row.id, status: `db:${ue.message}`, oldUrl };
        return { id: row.id, status: status === 'copied' ? 'copied' : 'repointed' };
      }));
      tally(res, c, { table: 'trips', col: 'metadata.hero_image' });
      await new Promise(r => setTimeout(r, BATCH_PAUSE_MS));
    }
  }
  console.log(`  ✓ trips.metadata.hero_image: copied ${c.copied}, repointed ${c.repoint}, failed-so-far ${failures.length}`);
}

(async () => {
  console.log(`Porting images  ${OLD_HOST}  →  ${NEW_HOST}  ${DRY_RUN ? '[🔍 DRY RUN — no changes]' : '[🚀 LIVE]'}\n`);
  for (const t of TARGETS) await migrateTarget(t);
  await migrateTrips();
  if (failures.length) {
    fs.writeFileSync('migrate-images-failures.json', JSON.stringify(failures, null, 2));
    console.log(`\n⚠️  ${failures.length} failures → migrate-images-failures.json. Re-run to retry (idempotent).`);
    console.log('   (fetch-400/fetch-404 = the source file is genuinely gone from the old host and');
    console.log('    cannot be copied; those rows keep their old-host URL but still self-heal at runtime.)');
  } else {
    console.log('\n✅ All image files ported + URLs repointed. Zero old-project dependencies remain.');
  }
  // Final verification — should read 0 (modulo genuinely-gone source files above).
  for (const { table, col } of TARGETS) {
    const { count } = await sb.from(table).select('id', { count: 'exact', head: true }).ilike(col, `%${OLD_HOST}%`);
    console.log(`   remaining old-host in ${table}.${col}: ${count ?? '?'}`);
  }
  const { count: tripsLeft } = await sb.from('trips').select('id', { count: 'exact', head: true }).filter('metadata->>hero_image', 'ilike', `%${OLD_HOST}%`);
  console.log(`   remaining old-host in trips.metadata.hero_image: ${tripsLeft ?? '?'}`);
})().catch(e => { console.error(e); process.exit(1); });
