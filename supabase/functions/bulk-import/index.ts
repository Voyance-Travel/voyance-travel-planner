import { createClient } from 'npm:@supabase/supabase-js@2.90.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// Whitelist of allowed tables for bulk import
const ALLOWED_TABLES = [
  'activities',
  'airports', 
  'attractions',
  'activity_catalog',
  'destination_images',
  'destinations',
  'guides',
  'trips',
  'trip_activities'
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // ========================================
    // AUTHENTICATION: Require valid JWT token
    // ========================================
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the user's session using the anon key with auth header
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    
    const { data: userData, error: userError } = await authClient.auth.getUser()
    if (userError || !userData?.user) {
      console.error('Auth error:', userError?.message)
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = userData.user.id
    console.log(`Authenticated user: ${userId}`)

    // ========================================
    // AUTHORIZATION: Require admin role
    // ========================================
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle()

    if (roleError) {
      console.error('Role check error:', roleError.message)
      return new Response(
        JSON.stringify({ error: 'Failed to verify permissions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!roleData) {
      console.log(`User ${userId} attempted bulk import without admin role`)
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Admin access confirmed for user: ${userId}`)

    // ========================================
    // VALIDATE REQUEST
    // ========================================
    const body = await req.json()
    const table = body.table
    const rows = body.rows || body.data // Accept both "rows" and "data"
    
    if (!table || !rows || !Array.isArray(rows)) {
      return new Response(
        JSON.stringify({ error: 'Missing table or rows' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate table is in whitelist
    if (!ALLOWED_TABLES.includes(table)) {
      console.log(`Rejected bulk import attempt for unauthorized table: ${table}`)
      return new Response(
        JSON.stringify({ error: `Table '${table}' is not allowed for bulk import` }),
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
    } else if (table === 'destinations') {
      processedRows = rows.map((row) => {
        const parseJsonField = (field: unknown) => {
          if (!field) return null
          if (typeof field === 'string') {
            try { return JSON.parse(field) } catch { return field }
          }
          return field
        }
        
        return {
          id: row.id || crypto.randomUUID(),
          city: row.city,
          country: row.country,
          region: row.region || null,
          timezone: row.timezone || null,
          currency_code: row.currency_code || null,
          description: row.description || null,
          temperature_range: row.temperature_range || null,
          seasonality: row.seasonality || null,
          best_time_to_visit: row.best_time_to_visit || null,
          cost_tier: row.cost_tier || null,
          known_for: parseJsonField(row.known_for) || [],
          points_of_interest: parseJsonField(row.points_of_interest) || [],
          stock_image_url: row.stock_image_url || null,
          featured: row.featured === true || row.featured === 'true',
          tier: row.tier ? parseInt(String(row.tier)) : 1,
          alternative_names: parseJsonField(row.alternative_names) || [],
          safe_search_keywords: parseJsonField(row.safe_search_keywords) || [],
          default_transport_modes: parseJsonField(row.default_transport_modes) || [],
          dynamic_weather: parseJsonField(row.dynamic_weather),
          dynamic_currency_conversion: parseJsonField(row.dynamic_currency_conversion),
          seasonal_events: parseJsonField(row.seasonal_events) || {},
          last_content_update: row.last_content_update || null,
          last_weather_update: row.last_weather_update || null,
          last_currency_update: row.last_currency_update || null,
          population: row.population ? parseInt(String(row.population)) : 0,
          tags: parseJsonField(row.tags) || [],
          google_place_id: row.google_place_id || null,
          airport_codes: parseJsonField(row.airport_codes),
          currency_data: parseJsonField(row.currency_data),
          weather_data: parseJsonField(row.weather_data),
          enrichment_status: parseJsonField(row.enrichment_status) || {},
          last_enriched: row.last_enriched || null,
          enrichment_priority: row.enrichment_priority ? parseInt(String(row.enrichment_priority)) : 0,
          coordinates: parseJsonField(row.coordinates),
          airport_lookup_codes: row.airport_lookup_codes || null,
          created_at: row.created_at || new Date().toISOString(),
          updated_at: row.updated_at || new Date().toISOString(),
        }
      })
    } else if (table === 'guides') {
      processedRows = rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        subtitle: row.subtitle || null,
        author: row.author || null,
        image_url: row.image_url || null,
        excerpt: row.excerpt || null,
        content: typeof row.content === 'string' ? JSON.parse(row.content) : (row.content || {}),
        category: row.category || null,
        reading_time: row.reading_time ? parseInt(String(row.reading_time)) : null,
        destination_city: row.destination_city || null,
        destination_country: row.destination_country || null,
        tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags || []),
        featured: row.featured === true || row.featured === 'true',
        published: row.published === true || row.published === 'true',
        created_at: row.created_at || new Date().toISOString(),
        updated_at: row.updated_at || new Date().toISOString(),
      }))
    } else if (table === 'trips') {
      // First, fetch all user_id_mappings to translate legacy user IDs
      const { data: mappings, error: mappingsError } = await supabase
        .from('user_id_mappings')
        .select('legacy_user_id, user_id')

      if (mappingsError) {
        console.error('Failed to fetch user ID mappings:', mappingsError)
      }

      const userIdMap = new Map<string, string>()
      if (mappings) {
        for (const m of mappings) {
          userIdMap.set(m.legacy_user_id, m.user_id)
        }
      }
      console.log(`Loaded ${userIdMap.size} user ID mappings`)

      processedRows = rows.map((row) => {
        const parseJsonField = (field: unknown) => {
          if (!field || field === '') return null
          if (typeof field === 'string') {
            try {
              return JSON.parse(field)
            } catch {
              return null
            }
          }
          return field
        }

        const normalizeTripStatus = (value: unknown) => {
          const v = String(value ?? '')
            .trim()
            .toLowerCase()

          // Allowed: draft | planning | booked | active | completed | cancelled
          if (!v) return 'draft'
          if (v === 'complete' || v === 'completed' || v === 'done') return 'completed'
          if (v === 'cancel' || v === 'canceled' || v === 'cancelled') return 'cancelled'
          if (v === 'in_progress' || v === 'in progress' || v === 'ongoing') return 'active'
          if (v === 'plan' || v === 'planning') return 'planning'
          if (v === 'book' || v === 'booked') return 'booked'
          if (v === 'active') return 'active'
          if (v === 'draft') return 'draft'

          // Fallback to draft if unknown to avoid enum errors
          return 'draft'
        }

        const normalizeItineraryStatus = (value: unknown) => {
          const v = String(value ?? '')
            .trim()
            .toLowerCase()

          // Allowed: not_started | queued | generating | ready | failed
          if (!v) return 'not_started'
          if (v === 'complete' || v === 'completed' || v === 'ready') return 'ready'
          if (v === 'generating' || v === 'in_progress' || v === 'in progress') return 'generating'
          if (v === 'queued') return 'queued'
          if (v === 'failed' || v === 'error') return 'failed'
          if (v === 'not_started' || v === 'not started') return 'not_started'
          return 'not_started'
        }

        // Translate legacy user_id to new auth user_id
        const legacyUserId = row.user_id
        const resolvedUserId = userIdMap.get(legacyUserId) || legacyUserId
        if (legacyUserId && userIdMap.has(legacyUserId)) {
          console.log(`Mapped user_id: ${legacyUserId} → ${resolvedUserId}`)
        }

        return {
          id: row.id || crypto.randomUUID(),
          user_id: resolvedUserId,
          name: row.name || `Trip to ${row.destination}`,
          destination: row.destination,
          destination_country: row.destination_country || null,
          origin_city: row.origin_city || row.departure_city || null,
          start_date: row.start_date,
          end_date: row.end_date,
          status: normalizeTripStatus(row.status),
          itinerary_status: normalizeItineraryStatus(row.itinerary_status),
          travelers: row.travelers ? parseInt(String(row.travelers)) : 1,
          budget_tier: row.budget_tier || null,
          trip_type: row.trip_type || null,
          flight_selection: parseJsonField(row.flight_selection),
          hotel_selection: parseJsonField(row.hotel_selection),
          itinerary_data: parseJsonField(row.itinerary_data),
          metadata: parseJsonField(row.metadata) || {},
          price_lock_expires_at: row.price_lock_expires_at || null,
          created_at: row.created_at || new Date().toISOString(),
          updated_at: row.updated_at || new Date().toISOString(),
        }
      })
    } else if (table === 'trip_activities') {
      processedRows = rows.map((row) => ({
        id: row.id,
        trip_id: row.trip_id || row.itinerary_id || null,
        itinerary_day_id: row.itinerary_day_id || null,
        type: row.type || 'activity',
        title: row.title,
        description: row.description || null,
        start_time: row.start_time || null,
        end_time: row.end_time || null,
        venue_id: row.venue_id || null,
        location: row.location || null,
        address: row.address || null,
        latitude: row.latitude ? parseFloat(String(row.latitude)) : null,
        longitude: row.longitude ? parseFloat(String(row.longitude)) : null,
        place_id: row.place_id || null,
        block_order: row.block_order ? parseInt(String(row.block_order)) : 0,
        locked: row.locked === true || row.locked === 'true',
        recommendation_score: row.recommendation_score ? parseFloat(String(row.recommendation_score)) : null,
        added_by_user: row.added_by_user === true || row.added_by_user === 'true',
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {}),
        booking_status: row.booking_status || 'not_booked',
        booking_required: row.booking_required === true || row.booking_required === 'true',
        cost: row.cost ? parseFloat(String(row.cost)) : null,
        currency: row.currency || 'USD',
        tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags || []),
        photos: typeof row.photos === 'string' ? JSON.parse(row.photos) : (row.photos || []),
        operating_hours: row.operating_hours ? (typeof row.operating_hours === 'string' ? JSON.parse(row.operating_hours) : row.operating_hours) : null,
        transportation: row.transportation ? (typeof row.transportation === 'string' ? JSON.parse(row.transportation) : row.transportation) : null,
        verified: row.verified === true || row.verified === 'true',
        verification_confidence: row.verification_confidence ? parseInt(String(row.verification_confidence)) : null,
        rating_value: row.rating_value ? parseFloat(String(row.rating_value)) : null,
        rating_count: row.rating_count ? parseInt(String(row.rating_count)) : null,
        created_at: row.created_at || new Date().toISOString(),
        updated_at: row.updated_at || new Date().toISOString(),
      }))
    }

    const { error } = await supabase
      .from(table)
      .upsert(processedRows, { onConflict: 'id' })

    if (error) {
      console.error('Insert error:', error)
      return new Response(
        JSON.stringify({ success: false, error: "Data import failed", code: "INSERT_ERROR" }),
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
      JSON.stringify({ success: false, error: "Import processing failed", code: "IMPORT_ERROR" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
