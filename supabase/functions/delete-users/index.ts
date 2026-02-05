import { createClient } from 'npm:@supabase/supabase-js@2.90.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

/**
 * Tables with user_id column that need to be cleared before deleting auth user.
 * Ordered to handle any potential dependencies (children before parents).
 */
const USER_DATA_TABLES = [
  // Trip-related (delete first as they may reference other user data)
  'trip_photos',
  'trip_notes',
  'trip_learnings',
  'trip_go_back_list',
  'trip_feedback_responses',
  'trip_departure_summaries',
  'trip_day_summaries',
  'trip_rental_cars',
  'trip_notifications',
  'trip_payments',
  'trip_collaborators',
  'trip_members',
  'trip_activities',
  'trip_hotels',
  'trip_flights',
  'trips',
  'trip_intents',
  'trip_cost_tracking',
  
  // Activity & feedback
  'activity_feedback',
  'itinerary_customization_requests',
  'itinerary_templates',
  
  // User data
  'achievement_unlocks',
  'consent_records',
  'credit_balances',
  'credit_ledger',
  'credit_transactions',
  'customer_reviews',
  'daily_usage',
  'day_balances',
  'day_ledger',
  'feedback_prompt_log',
  'image_votes',
  'quiz_responses',
  'quiz_sessions',
  'rate_limits',
  'saved_items',
  'travel_dna_history',
  'travel_dna_profiles',
  'user_credit_bonuses',
  'user_credits',
  'user_enrichment',
  'user_entitlement_overrides',
  'user_preference_insights',
  'user_preferences',
  'user_usage',
  'voyance_events',
  
  // Core user tables (delete last)
  'user_roles',
  'user_id_mappings',
  'profiles',
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // ==========================================================================
    // AUTHENTICATION: Validate JWT and require admin role
    // ==========================================================================
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('[delete-users] Missing authorization header')
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create auth client to validate the user's JWT
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: userError } = await authClient.auth.getUser(token)
    
    if (userError || !userData?.user) {
      console.error('[delete-users] Invalid JWT:', userError?.message)
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const adminUserId = userData.user.id
    console.log(`[delete-users] Authenticated user: ${adminUserId}`)

    // ==========================================================================
    // AUTHORIZATION: Check admin role using service client
    // ==========================================================================
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', adminUserId)
      .eq('role', 'admin')
      .maybeSingle()

    if (roleError || !roleData) {
      console.error(`[delete-users] User ${adminUserId} is not an admin`)
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[delete-users] Admin access confirmed for user: ${adminUserId}`)

    // ==========================================================================
    // ADMIN OPERATION: Delete users
    // ==========================================================================
    const { emails, userIds } = await req.json() as { emails?: string[]; userIds?: string[] }

    // Safety check: require explicit targets
    if ((!emails || emails.length === 0) && (!userIds || userIds.length === 0)) {
      console.error('[delete-users] No emails or userIds provided - blocked')
      return new Response(
        JSON.stringify({ error: 'Must specify emails or userIds array to delete users' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get users to delete
    let usersToDelete: { id: string; email: string | undefined }[] = []

    if (userIds && userIds.length > 0) {
      // Direct user IDs provided
      for (const id of userIds) {
        const { data: authUser } = await supabase.auth.admin.getUserById(id)
        if (authUser?.user) {
          usersToDelete.push({ id: authUser.user.id, email: authUser.user.email })
        }
      }
    } else if (emails && emails.length > 0) {
      // Find users by email
      const { data: allUsers, error: listError } = await supabase.auth.admin.listUsers()
      if (listError) {
        return new Response(
          JSON.stringify({ error: listError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      usersToDelete = (allUsers?.users || [])
        .filter(u => emails.includes(u.email || ''))
        .map(u => ({ id: u.id, email: u.email }))
    }

    console.log(`[delete-users] Found ${usersToDelete.length} users to delete`)

    const results = {
      deleted: [] as string[],
      failed: [] as { email: string; error: string }[]
    }

    for (const user of usersToDelete) {
      const userId = user.id
      const identifier = user.email || userId
      
      try {
        console.log(`[delete-users] Deleting data for user: ${identifier}`)
        
        // Delete from all user data tables
        for (const table of USER_DATA_TABLES) {
          try {
            const { error: tableError } = await supabase
              .from(table)
              .delete()
              .eq('user_id', userId)
            
            if (tableError) {
              // Some tables might not exist or have different column names - log but continue
              console.warn(`[delete-users] Warning deleting from ${table}: ${tableError.message}`)
            }
          } catch (tableErr) {
            console.warn(`[delete-users] Could not delete from ${table}: ${tableErr}`)
          }
        }
        
        // Also delete where id = user_id (for profiles table)
        await supabase.from('profiles').delete().eq('id', userId)
        
        // Delete the auth user
        const { error: deleteError } = await supabase.auth.admin.deleteUser(userId)
        
        if (deleteError) {
          results.failed.push({ email: identifier, error: deleteError.message })
          console.error(`[delete-users] Failed to delete auth user ${identifier}: ${deleteError.message}`)
        } else {
          results.deleted.push(identifier)
          console.log(`[delete-users] Successfully deleted user: ${identifier}`)
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error'
        results.failed.push({ email: identifier, error: errMsg })
        console.error(`[delete-users] Error deleting user ${identifier}: ${errMsg}`)
      }
    }

    // Log admin action
    try {
      await supabase.rpc('insert_audit_log', {
        p_action: 'admin_delete_users',
        p_user_id: adminUserId,
        p_actor: userData.user.email || adminUserId,
        p_action_type: 'admin',
        p_metadata: { deleted: results.deleted.length, failed: results.failed.length, emails, userIds }
      })
    } catch (auditErr) {
      console.warn('[delete-users] Failed to log audit:', auditErr)
    }

    return new Response(
      JSON.stringify({
        message: 'Deletion completed',
        deleted: results.deleted.length,
        failed: results.failed.length,
        details: results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[delete-users] Error:', error instanceof Error ? error.message : 'Unknown error')
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})