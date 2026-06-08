/**
 * migrate-images.mjs — Port ALL image FILES from the OLD Lovable Supabase storage
 * to the NEW project's storage, preserving bucket+path, then repoint the DB URLs.
 *
 * Covers every at-risk record (≈11,624):
 *   - curated_images.image_url   (activities/hotels/restaurants/destinations cache)
 *   - destinations.hero_image_url
 *   - destinations.stock_image_url
 *
 * Strategy per row: fetch bytes from the old public URL → upload to the SAME
 * bucket/path on the new project → UPDATE the row to the new URL.
 *
 * Idempotent + resumable: a migrated row no longer matches the OLD-host filter, and
 * if the new object already exists we just repoint. Re-run safely to retry failures.
 *
 * RUN:
 *   1. npm i @supabase/supabase-js   (already a dep in this repo)
 *   2. SUPABASE_SERVICE_ROLE_KEY="<new project service_role secret>" \
 *        node scripts/migrate-images.mjs
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

const CONCURRENCY = 6;          // parallel transfers per page
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

async function migrateOne(table, col, id, oldUrl) {
  const p = parseOld(oldUrl);
  if (!p) return { id, status: 'skip-unparseable', oldUrl };
  const newUrl = `${NEW_URL}/storage/v1/object/public/${p.bucket}/${encodeURI(p.path)}`;
  // already there?
  let exists = false;
  try { exists = (await fetch(newUrl, { method: 'HEAD' })).ok; } catch {}
  if (DRY_RUN) return { id, status: exists ? 'dry-repoint' : 'dry-copy', bucket: p.bucket };
  if (!exists) {
    // Retry transient failures (429/5xx/network) but NOT 400/404 (file genuinely gone).
    let r, lastErr;
    for (let t = 0; t < 3; t++) {
      if (t) await new Promise(res => setTimeout(res, 500 * t));
      try { r = await fetch(oldUrl); } catch (e) { lastErr = e; r = null; continue; }
      if (r.ok || r.status === 404 || r.status === 400) break; // success or genuinely-gone → stop
    }
    if (!r) return { id, status: `fetch-err:${lastErr?.message || 'network'}`, oldUrl };
    if (!r.ok) return { id, status: `fetch-${r.status}`, oldUrl };
    const buf = Buffer.from(await r.arrayBuffer());
    const ct = r.headers.get('content-type') || 'image/jpeg';
    try { await ensureBucket(p.bucket); } catch (e) { return { id, status: `bucket:${e.message}`, oldUrl }; }
    const { error } = await sb.storage.from(p.bucket).upload(p.path, buf, { contentType: ct, upsert: true });
    if (error) return { id, status: `upload:${error.message}`, oldUrl };
  }
  const { error: ue } = await sb.from(table).update({ [col]: newUrl }).eq('id', id);
  if (ue) return { id, status: `db:${ue.message}`, oldUrl };
  return { id, status: exists ? 'repointed' : 'copied' };
}

async function migrateTarget({ table, col }) {
  console.log(`\n=== ${table}.${col} ===`);
  let cursor = null, done = 0, copied = 0, repoint = 0;
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
      for (const x of res) {
        done++;
        if (x.status === 'copied' || x.status === 'dry-copy') copied++;
        else if (x.status === 'repointed' || x.status === 'dry-repoint') repoint++;
        else failures.push({ table, col, ...x });
      }
      if (done % 200 === 0) console.log(`  ${done} processed (copied ${copied}, repointed ${repoint}, failed ${failures.length})`);
    }
  }
  console.log(`  ✓ ${table}.${col}: copied ${copied}, repointed ${repoint}, failed-so-far ${failures.length}`);
}

(async () => {
  console.log(`Porting images  ${OLD_HOST}  →  ${NEW_HOST}  ${DRY_RUN ? '[🔍 DRY RUN — no changes]' : '[🚀 LIVE]'}\n`);
  for (const t of TARGETS) await migrateTarget(t);
  if (failures.length) {
    fs.writeFileSync('migrate-images-failures.json', JSON.stringify(failures, null, 2));
    console.log(`\n⚠️  ${failures.length} failures → migrate-images-failures.json. Re-run to retry (idempotent).`);
  } else {
    console.log('\n✅ All image files ported + URLs repointed. Zero old-project dependencies remain.');
  }
  // Final verification
  for (const { table, col } of TARGETS) {
    const { count } = await sb.from(table).select('id', { count: 'exact', head: true }).ilike(col, `%${OLD_HOST}%`);
    console.log(`   remaining old-host in ${table}.${col}: ${count ?? '?'}`);
  }
})().catch(e => { console.error(e); process.exit(1); });
