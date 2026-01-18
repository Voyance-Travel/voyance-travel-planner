import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { table, rows } = await req.json()
    
    if (!table || !rows || !Array.isArray(rows)) {
      return new Response(
        JSON.stringify({ error: 'Missing table or rows' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Importing ${rows.length} rows into ${table}`)

    // Process rows based on table type
    let processedRows = rows

    if (table === 'activities') {
      processedRows = rows.map((row) => ({
        id: row.id,
        destination_id: row.destination_id,
        name: row.name,
        description: row.description || null,
        category: row.category || null,
        duration_minutes: row.duration_minutes ? parseInt(String(row.duration_minutes)) : null,
        price_range: typeof row.price_range === 'string' ? JSON.parse(row.price_range) : (row.price_range || {}),
        booking_required: row.booking_required === true || row.booking_required === 'true',
        booking_url: row.booking_url || null,
        best_times: typeof row.best_times === 'string' ? JSON.parse(row.best_times) : (row.best_times || {}),
        crowd_levels: row.crowd_levels || null,
        coordinates: typeof row.coordinates === 'string' ? JSON.parse(row.coordinates) : (row.coordinates || { lat: 0, lng: 0 }),
        accessibility_info: typeof row.accessibility_info === 'string' ? JSON.parse(row.accessibility_info) : (row.accessibility_info || {}),
        tags: row.tags || null,
        created_at: row.created_at || new Date().toISOString(),
        updated_at: row.updated_at || new Date().toISOString(),
      }))
    } else if (table === 'airports') {
      processedRows = rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        type: row.type || 'international',
        city: row.city || null,
        country: row.country || null,
        latitude: row.latitude ? parseFloat(String(row.latitude)) : null,
        longitude: row.longitude ? parseFloat(String(row.longitude)) : null,
        distance_km: row.distance_km ? parseFloat(String(row.distance_km)) : null,
        created_at: row.created_at || new Date().toISOString(),
        updated_at: row.updated_at || new Date().toISOString(),
      }))
    } else if (table === 'attractions') {
      processedRows = rows.map((row) => ({
        id: row.id,
        destination_id: row.destination_id || null,
        name: row.name,
        description: row.description || null,
        address: row.address || null,
        latitude: row.latitude ? parseFloat(String(row.latitude)) : null,
        longitude: row.longitude ? parseFloat(String(row.longitude)) : null,
        category: row.category || null,
        subcategory: row.subcategory || null,
        visit_duration_mins: row.visit_duration_mins ? parseInt(String(row.visit_duration_mins)) : null,
        price_range: typeof row.price_range === 'string' ? JSON.parse(row.price_range) : (row.price_range || {}),
        opening_hours: row.opening_hours ? (typeof row.opening_hours === 'string' ? JSON.parse(row.opening_hours) : row.opening_hours) : null,
        peak_hours: row.peak_hours ? (typeof row.peak_hours === 'string' ? JSON.parse(row.peak_hours) : row.peak_hours) : null,
        crowd_patterns: row.crowd_patterns ? (typeof row.crowd_patterns === 'string' ? JSON.parse(row.crowd_patterns) : row.crowd_patterns) : null,
        average_rating: row.average_rating ? parseFloat(String(row.average_rating)) : null,
        tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags || []),
        created_at: row.created_at || new Date().toISOString(),
        updated_at: row.updated_at || new Date().toISOString(),
      }))
    } else if (table === 'activity_catalog') {
      processedRows = rows.map((row) => ({
        id: row.id,
        destination_id: row.destination_id || null,
        title: row.title,
        description: row.description || null,
        category: row.category || null,
        cost_usd: row.cost_usd ? parseFloat(String(row.cost_usd)) : null,
        estimated_duration_hours: row.estimated_duration_hours ? parseFloat(String(row.estimated_duration_hours)) : null,
        location: typeof row.location === 'string' ? JSON.parse(row.location) : (row.location || {}),
        ai_generated: row.ai_generated === true || row.ai_generated === 'true',
        source: row.source || null,
        created_at: row.created_at || new Date().toISOString(),
        updated_at: row.updated_at || new Date().toISOString(),
      }))
    } else if (table === 'destination_images') {
      processedRows = rows.map((row) => ({
        id: row.id,
        destination_id: row.destination_id,
        image_url: row.image_url,
        source: row.source || 'wikimedia',
        created_at: row.created_at || new Date().toISOString(),
        updated_at: row.updated_at || new Date().toISOString(),
        is_primary: row.is_primary === true || row.is_primary === 'true',
        confidence_score: row.confidence_score ? parseFloat(String(row.confidence_score)) : null,
        alt_text: row.alt_text || null,
        is_hero: row.is_hero === true || row.is_hero === 'true',
      }))
    }

    const { error } = await supabase
      .from(table)
      .upsert(processedRows, { onConflict: 'id' })

    if (error) {
      console.error('Insert error:', error)
      return new Response(
        JSON.stringify({ error: error.message, details: error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, imported: rows.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.error('Bulk import error:', errorMessage)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})