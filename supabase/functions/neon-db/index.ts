import { Pool } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Connection pool for Neon
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const databaseUrl = Deno.env.get('NEON_DATABASE_URL');
    if (!databaseUrl) {
      throw new Error('NEON_DATABASE_URL is not configured');
    }
    pool = new Pool(databaseUrl, 3, true);
  }
  return pool;
}

// Helper to run queries
async function query(sql: string, params?: unknown[]) {
  const pool = getPool();
  const connection = await pool.connect();
  try {
    const result = await connection.queryObject(sql, params);
    return { data: result.rows, error: null };
  } catch (error) {
    console.error('Database query error:', error);
    return { data: null, error: (error as Error).message };
  } finally {
    connection.release();
  }
}

// Ensure profiles table exists (for first-time setup)
async function ensureProfilesTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS profiles (
      user_id UUID PRIMARY KEY,
      name TEXT,
      avatar_url TEXT,
      home_airport TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
}

// Authenticate user from request
async function authenticateUser(req: Request): Promise<{ user: { id: string } | null; error: string | null }> {
  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader) {
    return { user: null, error: 'No authorization header' };
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: {
        headers: { Authorization: authHeader },
      },
    }
  );

  const { data: { user }, error } = await supabaseClient.auth.getUser();
  
  if (error || !user) {
    return { user: null, error: error?.message || 'Invalid token' };
  }

  return { user: { id: user.id }, error: null };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace('/neon-db', '');
    
    console.log(`[neon-db] ${req.method} ${path}`);

    // Health check is public
    if (path === '/health' && req.method === 'GET') {
      await ensureProfilesTable();
      const result = await query('SELECT NOW() as time');
      return new Response(
        JSON.stringify({ 
          status: 'healthy', 
          database: result.error ? 'disconnected' : 'connected',
          time: (result.data?.[0] as Record<string, unknown>)?.time 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PUBLIC: Search airports (no auth required)
    if (path === '/airports' && req.method === 'GET') {
      const searchQuery = url.searchParams.get('q') || '';
      const limit = parseInt(url.searchParams.get('limit') || '20');
      
      let result;
      if (searchQuery.length >= 2) {
        // Search by code, city, or name
        result = await query(
          `SELECT id, code, name, city, country, latitude, longitude, type
           FROM airports 
           WHERE code ILIKE $1 OR city ILIKE $2 OR name ILIKE $2
           ORDER BY 
             CASE WHEN code ILIKE $1 THEN 0 ELSE 1 END,
             city ASC
           LIMIT $3`,
          [`${searchQuery}%`, `%${searchQuery}%`, limit]
        );
      } else {
        // Return major international airports
        result = await query(
          `SELECT id, code, name, city, country, latitude, longitude, type
           FROM airports 
           WHERE type = 'large_airport' OR type = 'international'
           ORDER BY city ASC
           LIMIT $1`,
          [limit]
        );
      }
      
      return new Response(
        JSON.stringify({ data: result.data, error: result.error }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PUBLIC: Search destinations (no auth required)
    if (path === '/destinations' && req.method === 'GET') {
      const searchQuery = url.searchParams.get('q') || '';
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const featured = url.searchParams.get('featured') === 'true';
      
      let result;
      if (searchQuery.length >= 2) {
        // Search by city, country, or region
        result = await query(
          `SELECT id, city, country, region, description, airport_codes, featured, cost_tier, best_time_to_visit
           FROM destinations 
           WHERE city ILIKE $1 OR country ILIKE $1 OR region ILIKE $1
           ORDER BY 
             CASE WHEN featured THEN 0 ELSE 1 END,
             city ASC
           LIMIT $2`,
          [`%${searchQuery}%`, limit]
        );
      } else if (featured) {
        // Return featured destinations
        result = await query(
          `SELECT id, city, country, region, description, airport_codes, featured, cost_tier, best_time_to_visit
           FROM destinations 
           WHERE featured = true
           ORDER BY city ASC
           LIMIT $1`,
          [limit]
        );
      } else {
        // Return popular destinations
        result = await query(
          `SELECT id, city, country, region, description, airport_codes, featured, cost_tier, best_time_to_visit
           FROM destinations 
           ORDER BY featured DESC, city ASC
           LIMIT $1`,
          [limit]
        );
      }
      
      return new Response(
        JSON.stringify({ data: result.data, error: result.error }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PUBLIC: Create anonymous trip (no auth required)
    // Generates a temporary session ID for tracking
    if (path === '/trips/anonymous' && req.method === 'POST') {
      let body: Record<string, unknown> | null = null;
      try {
        body = await req.json();
      } catch {
        return new Response(
          JSON.stringify({ error: 'Invalid JSON body' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { 
        origin, 
        destination, 
        startDate, 
        endDate, 
        travelers = 1,
        sessionId 
      } = body as {
        origin?: string;
        destination?: string;
        startDate?: string;
        endDate?: string;
        travelers?: number;
        sessionId?: string;
      };

      if (!destination || !startDate || !endDate) {
        return new Response(
          JSON.stringify({ error: 'destination, startDate, and endDate are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate or use provided session ID
      const tripSessionId = sessionId || crypto.randomUUID();

      const result = await query(
        `INSERT INTO anonymous_trips (
          session_id, origin_city, destination, start_date, end_date, travelers, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'draft', NOW(), NOW())
        ON CONFLICT (session_id) DO UPDATE SET
          origin_city = EXCLUDED.origin_city,
          destination = EXCLUDED.destination,
          start_date = EXCLUDED.start_date,
          end_date = EXCLUDED.end_date,
          travelers = EXCLUDED.travelers,
          updated_at = NOW()
        RETURNING *`,
        [tripSessionId, origin || null, destination, startDate, endDate, travelers]
      );

      if (result.error) {
        // Table might not exist, try creating it
        if (result.error.includes('does not exist')) {
          await query(`
            CREATE TABLE IF NOT EXISTS anonymous_trips (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              session_id TEXT UNIQUE NOT NULL,
              origin_city TEXT,
              destination TEXT NOT NULL,
              start_date DATE NOT NULL,
              end_date DATE NOT NULL,
              travelers INTEGER DEFAULT 1,
              status TEXT DEFAULT 'draft',
              flight_data JSONB,
              hotel_data JSONB,
              metadata JSONB DEFAULT '{}',
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
          `);
          // Retry insert
          const retryResult = await query(
            `INSERT INTO anonymous_trips (
              session_id, origin_city, destination, start_date, end_date, travelers, status, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, 'draft', NOW(), NOW())
            RETURNING *`,
            [tripSessionId, origin || null, destination, startDate, endDate, travelers]
          );
          return new Response(
            JSON.stringify({ data: retryResult.data, sessionId: tripSessionId, error: retryResult.error }),
            { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        return new Response(
          JSON.stringify({ error: result.error }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[neon-db] Anonymous trip created: ${tripSessionId}`);
      return new Response(
        JSON.stringify({ data: result.data, sessionId: tripSessionId, error: null }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PUBLIC: Get anonymous trip by session ID
    if (path.startsWith('/trips/anonymous/') && req.method === 'GET') {
      const sessionId = path.replace('/trips/anonymous/', '');
      
      const result = await query(
        'SELECT * FROM anonymous_trips WHERE session_id = $1',
        [sessionId]
      );

      return new Response(
        JSON.stringify({ data: result.data, error: result.error }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PUBLIC: Update anonymous trip
    if (path.startsWith('/trips/anonymous/') && req.method === 'PUT') {
      const sessionId = path.replace('/trips/anonymous/', '');
      let body: Record<string, unknown> | null = null;
      try {
        body = await req.json();
      } catch {
        body = {};
      }

      const updates = body as Record<string, unknown>;
      const allowedFields = ['origin_city', 'destination', 'start_date', 'end_date', 'travelers', 'flight_data', 'hotel_data', 'metadata', 'status'];
      const setClause: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      for (const field of allowedFields) {
        if (field in updates) {
          if (field === 'flight_data' || field === 'hotel_data' || field === 'metadata') {
            setClause.push(`${field} = $${paramIndex}::jsonb`);
            values.push(JSON.stringify(updates[field]));
          } else {
            setClause.push(`${field} = $${paramIndex}`);
            values.push(updates[field]);
          }
          paramIndex++;
        }
      }

      if (setClause.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No valid fields to update' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      setClause.push('updated_at = NOW()');
      values.push(sessionId);

      const result = await query(
        `UPDATE anonymous_trips SET ${setClause.join(', ')} WHERE session_id = $${paramIndex} RETURNING *`,
        values
      );

      return new Response(
        JSON.stringify({ data: result.data, error: result.error }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // All other endpoints require authentication
    const { user, error: authError } = await authenticateUser(req);
    if (!user) {
      console.log('[neon-db] Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: authError }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[neon-db] Authenticated user: ${user.id}`);

    // Parse request body for POST/PUT/DELETE
    let body: Record<string, unknown> | null = null;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      try {
        body = await req.json();
      } catch {
        // No body or invalid JSON
      }
    }

    // Route handlers
    switch (true) {
      // Get user profile - only own profile
      case path === '/profiles' && req.method === 'GET': {
        const userId = url.searchParams.get('userId');
        
        // Users can only access their own profile
        if (userId !== user.id) {
          return new Response(
            JSON.stringify({ error: 'Forbidden: Cannot access other users profiles' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        await ensureProfilesTable();
        const result = await query(
          'SELECT * FROM profiles WHERE user_id = $1',
          [userId]
        );
        
        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create or update user profile - only own profile
      case path === '/profiles' && req.method === 'PUT': {
        const { userId, name, avatarUrl, homeAirport } = (body || {}) as { 
          userId?: string; 
          name?: string;
          avatarUrl?: string;
          homeAirport?: string;
        };
        
        // Users can only update their own profile
        if (userId !== user.id) {
          return new Response(
            JSON.stringify({ error: 'Forbidden: Cannot modify other users profiles' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        await ensureProfilesTable();
        const result = await query(
          `INSERT INTO profiles (user_id, name, avatar_url, home_airport, updated_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (user_id) 
           DO UPDATE SET 
             name = COALESCE(EXCLUDED.name, profiles.name),
             avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
             home_airport = COALESCE(EXCLUDED.home_airport, profiles.home_airport),
             updated_at = NOW()
           RETURNING *`,
          [userId, name || null, avatarUrl || null, homeAirport || null]
        );
        
        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get user preferences - only own preferences
      case path === '/preferences' && req.method === 'GET': {
        const userId = url.searchParams.get('userId');
        
        if (userId !== user.id) {
          return new Response(
            JSON.stringify({ error: 'Forbidden: Cannot access other users preferences' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const result = await query(
          'SELECT * FROM user_preferences WHERE user_id = $1',
          [userId]
        );
        
        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update user preferences - only own preferences
      case path === '/preferences' && req.method === 'PUT': {
        const { userId, preferences } = (body || {}) as { userId?: string; preferences?: Record<string, unknown> };
        
        if (userId !== user.id) {
          return new Response(
            JSON.stringify({ error: 'Forbidden: Cannot modify other users preferences' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        if (!preferences) {
          return new Response(
            JSON.stringify({ error: 'preferences are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const result = await query(
          `INSERT INTO user_preferences (user_id, travel_style, budget, pace, interests, accommodation, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())
           ON CONFLICT (user_id) 
           DO UPDATE SET 
             travel_style = EXCLUDED.travel_style,
             budget = EXCLUDED.budget,
             pace = EXCLUDED.pace,
             interests = EXCLUDED.interests,
             accommodation = EXCLUDED.accommodation,
             updated_at = NOW()
           RETURNING *`,
          [
            userId,
            preferences.style || null,
            preferences.budget || null,
            preferences.pace || null,
            preferences.interests || null,
            preferences.accommodation || null
          ]
        );
        
        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get user trips - only own trips
      case path === '/trips' && req.method === 'GET': {
        const userId = url.searchParams.get('userId');
        
        if (userId !== user.id) {
          return new Response(
            JSON.stringify({ error: 'Forbidden: Cannot access other users trips' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const result = await query(
          'SELECT * FROM trips WHERE user_id = $1 ORDER BY created_at DESC',
          [userId]
        );
        
        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get single trip - verify ownership
      case path.startsWith('/trips/') && req.method === 'GET': {
        const tripId = path.replace('/trips/', '');
        const result = await query(
          'SELECT * FROM trips WHERE id = $1 AND user_id = $2',
          [tripId, user.id]
        );
        
        if (!result.data || result.data.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Trip not found or access denied' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create trip - automatically set to current user
      case path === '/trips' && req.method === 'POST': {
        const tripData = (body || {}) as Record<string, unknown>;
        
        const result = await query(
          `INSERT INTO trips (user_id, destination, start_date, end_date, travelers, status, data, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
           RETURNING *`,
          [
            user.id, // Always use authenticated user's ID
            tripData.destination || null,
            tripData.startDate || null,
            tripData.endDate || null,
            tripData.travelers || 1,
            tripData.status || 'draft',
            JSON.stringify(tripData) || '{}'
          ]
        );
        
        return new Response(
          JSON.stringify(result),
          { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update trip - verify ownership first
      case path.startsWith('/trips/') && req.method === 'PUT': {
        const tripId = path.replace('/trips/', '');
        const tripData = (body || {}) as Record<string, unknown>;
        
        // Verify ownership
        const ownerCheck = await query(
          'SELECT user_id FROM trips WHERE id = $1',
          [tripId]
        );
        
        if (!ownerCheck.data || ownerCheck.data.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Trip not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const tripOwner = (ownerCheck.data[0] as { user_id: string }).user_id;
        if (tripOwner !== user.id) {
          return new Response(
            JSON.stringify({ error: 'Forbidden: Cannot modify other users trips' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const result = await query(
          `UPDATE trips SET 
             destination = COALESCE($2, destination),
             start_date = COALESCE($3, start_date),
             end_date = COALESCE($4, end_date),
             travelers = COALESCE($5, travelers),
             status = COALESCE($6, status),
             data = COALESCE($7, data),
             updated_at = NOW()
           WHERE id = $1 AND user_id = $8
           RETURNING *`,
          [
            tripId,
            tripData.destination,
            tripData.startDate,
            tripData.endDate,
            tripData.travelers,
            tripData.status,
            tripData.data ? JSON.stringify(tripData.data) : null,
            user.id
          ]
        );
        
        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Delete trip - verify ownership
      case path.startsWith('/trips/') && req.method === 'DELETE': {
        const tripId = path.replace('/trips/', '');
        
        const result = await query(
          'DELETE FROM trips WHERE id = $1 AND user_id = $2 RETURNING id',
          [tripId, user.id]
        );
        
        if (!result.data || result.data.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Trip not found or access denied' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // NOTE: /query endpoint has been REMOVED for security reasons
      // It allowed arbitrary SQL execution which is a critical vulnerability

      default:
        return new Response(
          JSON.stringify({ error: 'Not found', path }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('[neon-db] Error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});