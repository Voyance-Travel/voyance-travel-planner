import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BUCKET = 'trip-photos';
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// All static destination images from destinations.ts
const DESTINATION_IMAGES: Record<string, string[]> = {
  'paris': [
    'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1200&q=80',
    'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=1200&q=80',
    'https://images.unsplash.com/photo-1431274172761-fca41d930114?w=1200&q=80',
  ],
  'santorini': [
    'https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?w=1200&q=80',
    'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=1200&q=80',
    'https://images.unsplash.com/photo-1533105079780-92b9be482077?w=1200&q=80',
  ],
  'bali': [
    'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1200&q=80',
    'https://images.unsplash.com/photo-1573790387438-4da905039392?w=1200&q=80',
    'https://images.unsplash.com/photo-1552733407-5d5c46c3bb3b?w=1200&q=80',
  ],
  'new-york': [
    'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=1200&q=80',
    'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=1200&q=80',
    'https://images.unsplash.com/photo-1522083165195-3424ed129620?w=1200&q=80',
  ],
  'kyoto': [
    'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1200&q=80',
    'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=1200&q=80',
    'https://images.unsplash.com/photo-1624253321171-1be53e12f5f4?w=1200&q=80',
  ],
  'lisbon': [
    'https://images.unsplash.com/photo-1585208798174-6cedd86e019a?w=1200&q=80',
    'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=1200&q=80',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80',
  ],
  'cape-town': [
    'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=1200&q=80',
    'https://images.unsplash.com/photo-1576485290814-1c72aa4bbb8e?w=1200&q=80',
    'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=1200&q=80',
  ],
  'mexico-city': [
    'https://images.unsplash.com/photo-1518659526054-190340b32735?w=1200&q=80',
    'https://images.unsplash.com/photo-1585464231875-d9ef1f5ad396?w=1200&q=80',
    'https://images.unsplash.com/photo-1547995886-6dc09384c6e6?w=1200&q=80',
  ],
  'copenhagen': [
    'https://images.unsplash.com/photo-1513622470522-26c3c8a854bc?w=1200&q=80',
    'https://images.unsplash.com/photo-1552560880-2482cef14240?w=1200&q=80',
    'https://images.unsplash.com/photo-1551516594-56cb78394645?w=1200&q=80',
  ],
  'cartagena': [
    'https://images.unsplash.com/photo-1533690519961-46e5a84f1c17?w=1200&q=80',
    'https://images.unsplash.com/photo-1569012871812-f38ee64cd54c?w=1200&q=80',
    'https://images.unsplash.com/photo-1547149600-a6cdf8fce60c?w=1200&q=80',
  ],
  'marrakech': [
    'https://images.unsplash.com/photo-1518730518541-d0843268c287?w=1200&q=80',
    'https://images.unsplash.com/photo-1489493512598-d08130f49bea?w=1200&q=80',
    'https://images.unsplash.com/photo-1539020140153-e479b8c92e70?w=1200&q=80',
  ],
  'vancouver': [
    'https://images.unsplash.com/photo-1609825488888-3a766db05542?w=1200&q=80',
    'https://images.unsplash.com/photo-1578469550956-0e16b69c6a3d?w=1200&q=80',
    'https://images.unsplash.com/photo-1560814304-4f05976ef22e?w=1200&q=80',
  ],
  'bangkok': [
    'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=1200&q=80',
    'https://images.unsplash.com/photo-1563492065599-3520f775eeed?w=1200&q=80',
    'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200&q=80',
  ],
  'buenos-aires': [
    'https://images.unsplash.com/photo-1612294037637-ec328d0e075e?w=1200&q=80',
    'https://images.unsplash.com/photo-1589909202802-8f4aadce1849?w=1200&q=80',
    'https://images.unsplash.com/photo-1536086845234-586b4f845fa8?w=1200&q=80',
  ],
  'reykjavik': [
    'https://images.unsplash.com/photo-1529963183134-61a90db47eaf?w=1200&q=80',
    'https://images.unsplash.com/photo-1504233529578-6d46baba6d34?w=1200&q=80',
    'https://images.unsplash.com/photo-1476610182048-b716b8518aae?w=1200&q=80',
  ],
  'singapore': [
    'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=1200&q=80',
    'https://images.unsplash.com/photo-1496939376851-89342e90adcd?w=1200&q=80',
    'https://images.unsplash.com/photo-1508964942454-1a56651d54ac?w=1200&q=80',
  ],
  'florence': [
    'https://images.unsplash.com/photo-1541370976299-4d24ebbc9077?w=1200&q=80',
    'https://images.unsplash.com/photo-1504019347908-b45f9b0b8dd5?w=1200&q=80',
    'https://images.unsplash.com/photo-1534359265607-b39e67e08544?w=1200&q=80',
  ],
  'oaxaca': [
    'https://images.unsplash.com/photo-1518105779142-d975f22f1b0a?w=1200&q=80',
    'https://images.unsplash.com/photo-1547558840-8ad6c4dc309c?w=1200&q=80',
    'https://images.unsplash.com/photo-1518638150340-f706e86654de?w=1200&q=80',
  ],
  'seoul': [
    'https://images.unsplash.com/photo-1538485399081-7191377e8241?w=1200&q=80',
    'https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=1200&q=80',
    'https://images.unsplash.com/photo-1546874177-9e664107314e?w=1200&q=80',
  ],
  'vienna': [
    'https://images.unsplash.com/photo-1516550893923-42d28e5677af?w=1200&q=80',
    'https://images.unsplash.com/photo-1519677100203-a0e668c92439?w=1200&q=80',
    'https://images.unsplash.com/photo-1573599852326-2d4da0aea6c8?w=1200&q=80',
  ],
  'hanoi': [
    'https://images.unsplash.com/photo-1557750255-c76072a7aad1?w=1200&q=80',
    'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=1200&q=80',
    'https://images.unsplash.com/photo-1555921015-5532091f6026?w=1200&q=80',
  ],
  'barcelona': [
    'https://images.unsplash.com/photo-1583422409516-2895a77efed6?w=1200&q=80',
    'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=1200&q=80',
    'https://images.unsplash.com/photo-1523531294919-4bcd7c65e216?w=1200&q=80',
  ],
  'melbourne': [
    'https://images.unsplash.com/photo-1514395462725-fb4566210144?w=1200&q=80',
    'https://images.unsplash.com/photo-1545044846-351ba102b6d5?w=1200&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1200&q=80',
  ],
  'petra': [
    'https://images.unsplash.com/photo-1563177978-4c5fb3c0e3c9?w=1200&q=80',
    'https://images.unsplash.com/photo-1548786811-dd6e453ccca7?w=1200&q=80',
    'https://images.unsplash.com/photo-1553856622-d1b352e9a211?w=1200&q=80',
  ],
  'cusco': [
    'https://images.unsplash.com/photo-1526392060635-9d6019884377?w=1200&q=80',
    'https://images.unsplash.com/photo-1580619305218-8423a7ef79b4?w=1200&q=80',
    'https://images.unsplash.com/photo-1531065208531-4036c0dba3ca?w=1200&q=80',
  ],
  'porto': [
    'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=1200&q=80',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80',
    'https://images.unsplash.com/photo-1513735718075-2e2d37cb7952?w=1200&q=80',
  ],
};

async function downloadAndUpload(
  supabase: any,
  slug: string,
  index: number,
  url: string,
): Promise<{ slug: string; index: number; storageUrl: string | null; error?: string }> {
  const storagePath = `destination/${slug}-${index}.jpg`;
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;

  // Check if already uploaded
  try {
    const headResp = await fetch(publicUrl, { method: 'HEAD' });
    if (headResp.ok) {
      const len = parseInt(headResp.headers.get('content-length') || '0', 10);
      if (len > 1000) {
        return { slug, index, storageUrl: publicUrl };
      }
    }
  } catch { /* fall through */ }

  // Download from Unsplash
  try {
    const resp = await fetch(url, {
      headers: { 'Accept': 'image/*' },
      redirect: 'follow',
    });
    if (!resp.ok) {
      return { slug, index, storageUrl: null, error: `Download failed: ${resp.status}` };
    }
    const blob = await resp.blob();
    if (!blob.type.startsWith('image/')) {
      return { slug, index, storageUrl: null, error: `Not an image: ${blob.type}` };
    }

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, blob, {
        contentType: blob.type,
        upsert: true,
        cacheControl: '31536000',
      });

    if (uploadError) {
      return { slug, index, storageUrl: null, error: `Upload failed: ${uploadError.message}` };
    }

    return { slug, index, storageUrl: publicUrl };
  } catch (e: any) {
    return { slug, index, storageUrl: null, error: e.message };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Parse optional filter: { slugs: ["paris", "bali"] } or empty for all
  let filterSlugs: string[] | null = null;
  try {
    const body = await req.json();
    if (body.slugs && Array.isArray(body.slugs)) {
      filterSlugs = body.slugs;
    }
  } catch { /* no body = process all */ }

  const destinations = filterSlugs
    ? Object.entries(DESTINATION_IMAGES).filter(([slug]) => filterSlugs!.includes(slug))
    : Object.entries(DESTINATION_IMAGES);

  const results: Record<string, { images: (string | null)[]; errors: string[] }> = {};
  
  // Process 3 destinations at a time to avoid overwhelming
  const BATCH_SIZE = 3;
  for (let i = 0; i < destinations.length; i += BATCH_SIZE) {
    const batch = destinations.slice(i, i + BATCH_SIZE);
    const batchPromises = batch.flatMap(([slug, urls]) =>
      urls.map((url, idx) => downloadAndUpload(supabase, slug, idx, url))
    );
    const batchResults = await Promise.all(batchPromises);

    for (const r of batchResults) {
      if (!results[r.slug]) {
        results[r.slug] = { images: [], errors: [] };
      }
      results[r.slug].images[r.index] = r.storageUrl;
      if (r.error) {
        results[r.slug].errors.push(`[${r.index}] ${r.error}`);
      }
    }
  }

  // Build a mapping of slug -> storage URLs for easy consumption
  const urlMapping: Record<string, string[]> = {};
  for (const [slug, data] of Object.entries(results)) {
    urlMapping[slug] = data.images.filter(Boolean) as string[];
  }

  return new Response(
    JSON.stringify({
      processed: Object.keys(results).length,
      totalImages: Object.values(results).reduce((a, b) => a + b.images.filter(Boolean).length, 0),
      errors: Object.entries(results)
        .filter(([, d]) => d.errors.length > 0)
        .map(([slug, d]) => ({ slug, errors: d.errors })),
      urlMapping,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
