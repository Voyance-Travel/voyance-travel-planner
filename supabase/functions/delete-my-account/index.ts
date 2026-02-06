import { createClient } from 'npm:@supabase/supabase-js@2.90.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
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

/**
 * Self-service account deletion endpoint
 * Allows authenticated users to delete their own account
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // ==========================================================================
    // AUTHENTICATION: Validate JWT to get the requesting user
    // ==========================================================================
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('[delete-my-account] Missing authorization header')
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
      console.error('[delete-my-account] Invalid JWT:', userError?.message)
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = userData.user.id
    const userEmail = userData.user.email
    console.log(`[delete-my-account] User requesting account deletion: ${userEmail} (${userId})`)

    // ==========================================================================
    // DELETE USER DATA: Manually delete from all tables since no CASCADE
    // ==========================================================================
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Log the deletion attempt first
    try {
      await supabase.rpc('insert_audit_log', {
        p_action: 'account_deletion_requested',
        p_user_id: userId,
        p_actor: userEmail || userId,
        p_action_type: 'user',
        p_metadata: { email: userEmail, initiated_at: new Date().toISOString() }
      })
    } catch (auditErr) {
      console.warn('[delete-my-account] Failed to log audit:', auditErr)
    }

    // Delete from all user data tables
    console.log(`[delete-my-account] Deleting data from ${USER_DATA_TABLES.length} tables...`)
    
    for (const table of USER_DATA_TABLES) {
      try {
        const { error: tableError } = await supabase
          .from(table)
          .delete()
          .eq('user_id', userId)
        
        if (tableError) {
          console.warn(`[delete-my-account] Warning deleting from ${table}: ${tableError.message}`)
        }
      } catch (tableErr) {
        console.warn(`[delete-my-account] Could not delete from ${table}: ${tableErr}`)
      }
    }
    
    // Also delete where id = user_id (for profiles table)
    await supabase.from('profiles').delete().eq('id', userId)

    // Delete the auth user
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId)
    
    if (deleteError) {
      console.error(`[delete-my-account] Failed to delete user ${userId}:`, deleteError.message)
      return new Response(
        JSON.stringify({ error: 'Failed to delete account. Please try again or contact support.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[delete-my-account] Successfully deleted user: ${userEmail} (${userId})`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Your account has been permanently deleted',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[delete-my-account] Error:', error instanceof Error ? error.message : 'Unknown error')
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})