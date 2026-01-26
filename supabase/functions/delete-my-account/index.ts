import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Self-service account deletion endpoint
 * Allows authenticated users to delete their own account
 * Uses service role to delete from auth.users which cascades all related data
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
    // DELETE USER: Use service role to delete from auth.users
    // This cascades to all related tables via ON DELETE CASCADE
    // ==========================================================================
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Log the deletion attempt first
    await supabase.rpc('insert_audit_log', {
      p_action: 'account_deletion_requested',
      p_user_id: userId,
      p_actor: userEmail || userId,
      p_action_type: 'user',
      p_metadata: { email: userEmail, initiated_at: new Date().toISOString() }
    })

    // Delete the auth user - this cascades to profiles, user_preferences, 
    // user_roles, trips, etc. via ON DELETE CASCADE foreign keys
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