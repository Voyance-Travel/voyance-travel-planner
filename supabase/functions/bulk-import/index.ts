import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ActivityRow {
  id: string
  destination_id: string
  name: string
  description: string | null
  category: string | null
  duration_minutes: number | string | null
  price_range: Record<string, unknown> | string | null
  booking_required: boolean | string
  booking_url: string | null
  best_times: Record<string, unknown> | string | null
  crowd_levels: string | null
  coordinates: Record<string, unknown> | string | null
  accessibility_info: Record<string, unknown> | string | null
  tags: string | null
  created_at: string | null
  updated_at: string | null
}

Deno.serve(async (req) => {
  // Handle CORS preflight
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

    if (table === 'activities') {
      // Process activities
      const processedRows = rows.map((row: ActivityRow) => ({
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

      const { error } = await supabase
        .from('activities')
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
    }

    // Generic table insert for other tables
    const { error } = await supabase
      .from(table)
      .upsert(rows, { onConflict: 'id' })

    if (error) {
      console.error('Insert error:', error)
      return new Response(
        JSON.stringify({ error: error.message }),
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