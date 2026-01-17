import { Pool } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

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
      email TEXT,
      name TEXT,
      avatar_url TEXT,
      home_airport TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
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
      // Health check
      case path === '/health' && req.method === 'GET': {
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

      // Get user profile
      case path === '/profiles' && req.method === 'GET': {
        const userId = url.searchParams.get('userId');
        if (!userId) {
          return new Response(
            JSON.stringify({ error: 'userId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

      // Create or update user profile
      case path === '/profiles' && req.method === 'PUT': {
        const { userId, email, name, avatarUrl, homeAirport } = (body || {}) as { 
          userId?: string; 
          email?: string;
          name?: string;
          avatarUrl?: string;
          homeAirport?: string;
        };
        if (!userId) {
          return new Response(
            JSON.stringify({ error: 'userId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        await ensureProfilesTable();
        const result = await query(
          `INSERT INTO profiles (user_id, email, name, avatar_url, home_airport, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW())
           ON CONFLICT (user_id) 
           DO UPDATE SET 
             email = COALESCE(EXCLUDED.email, profiles.email),
             name = COALESCE(EXCLUDED.name, profiles.name),
             avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
             home_airport = COALESCE(EXCLUDED.home_airport, profiles.home_airport),
             updated_at = NOW()
           RETURNING *`,
          [userId, email || null, name || null, avatarUrl || null, homeAirport || null]
        );
        
        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get user preferences
      case path === '/preferences' && req.method === 'GET': {
        const userId = url.searchParams.get('userId');
        if (!userId) {
          return new Response(
            JSON.stringify({ error: 'userId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

      // Update user preferences
      case path === '/preferences' && req.method === 'PUT': {
        const { userId, preferences } = (body || {}) as { userId?: string; preferences?: Record<string, unknown> };
        if (!userId || !preferences) {
          return new Response(
            JSON.stringify({ error: 'userId and preferences are required' }),
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

      // Get user trips
      case path === '/trips' && req.method === 'GET': {
        const userId = url.searchParams.get('userId');
        if (!userId) {
          return new Response(
            JSON.stringify({ error: 'userId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

      // Get single trip
      case path.startsWith('/trips/') && req.method === 'GET': {
        const tripId = path.replace('/trips/', '');
        const result = await query(
          'SELECT * FROM trips WHERE id = $1',
          [tripId]
        );
        
        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create trip
      case path === '/trips' && req.method === 'POST': {
        const { userId, ...tripData } = (body || {}) as { userId?: string; [key: string]: unknown };
        if (!userId) {
          return new Response(
            JSON.stringify({ error: 'userId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const result = await query(
          `INSERT INTO trips (user_id, destination, start_date, end_date, travelers, status, data, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
           RETURNING *`,
          [
            userId,
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

      // Update trip
      case path.startsWith('/trips/') && req.method === 'PUT': {
        const tripId = path.replace('/trips/', '');
        const tripData = (body || {}) as Record<string, unknown>;
        
        const result = await query(
          `UPDATE trips SET 
             destination = COALESCE($2, destination),
             start_date = COALESCE($3, start_date),
             end_date = COALESCE($4, end_date),
             travelers = COALESCE($5, travelers),
             status = COALESCE($6, status),
             data = COALESCE($7, data),
             updated_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [
            tripId,
            tripData.destination,
            tripData.startDate,
            tripData.endDate,
            tripData.travelers,
            tripData.status,
            tripData.data ? JSON.stringify(tripData.data) : null
          ]
        );
        
        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Delete trip
      case path.startsWith('/trips/') && req.method === 'DELETE': {
        const tripId = path.replace('/trips/', '');
        
        const result = await query(
          'DELETE FROM trips WHERE id = $1 RETURNING id',
          [tripId]
        );
        
        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generic query endpoint (be careful with this in production!)
      case path === '/query' && req.method === 'POST': {
        const { table, operation, filters } = (body || {}) as { 
          table?: string; 
          operation?: string; 
          filters?: Record<string, unknown>; 
        };
        
        if (!table || !operation) {
          return new Response(
            JSON.stringify({ error: 'table and operation are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        let result;
        switch (operation) {
          case 'select': {
            let sql = `SELECT * FROM ${table}`;
            const params: unknown[] = [];
            
            if (filters && Object.keys(filters).length > 0) {
              const conditions = Object.entries(filters).map(([key], i) => {
                params.push(filters[key]);
                return `${key} = $${i + 1}`;
              });
              sql += ` WHERE ${conditions.join(' AND ')}`;
            }
            
            result = await query(sql, params);
            break;
          }
          default:
            return new Response(
              JSON.stringify({ error: `Operation ${operation} not supported` }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }
        
        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

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
