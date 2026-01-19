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

    const userId = userData.user.id
    console.log(`[delete-users] Authenticated user: ${userId}`)

    // ==========================================================================
    // AUTHORIZATION: Check admin role using service client
    // ==========================================================================
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle()

    if (roleError || !roleData) {
      console.error(`[delete-users] User ${userId} is not an admin`)
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[delete-users] Admin access confirmed for user: ${userId}`)

    // ==========================================================================
    // ADMIN OPERATION: Delete users
    // ==========================================================================
    const { emails } = await req.json() as { emails?: string[] }

    // List all users
    const { data: allUsers, error: listError } = await supabase.auth.admin.listUsers()
    
    if (listError) {
      return new Response(
        JSON.stringify({ error: listError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Filter users to delete
    let usersToDelete = allUsers?.users || []
    
    if (emails && emails.length > 0) {
      // Delete only specified emails
      usersToDelete = usersToDelete.filter(u => emails.includes(u.email || ''))
    }

    // Safety check: prevent mass deletion without explicit email list
    if (!emails || emails.length === 0) {
      console.error('[delete-users] Attempted mass deletion without email list - blocked')
      return new Response(
        JSON.stringify({ error: 'Safety check: Must specify emails array to delete users' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[delete-users] Found ${usersToDelete.length} users to delete`)

    const results = {
      deleted: [] as string[],
      failed: [] as { email: string; error: string }[]
    }

    for (const user of usersToDelete) {
      try {
        // First delete related data
        await supabase.from('profiles').delete().eq('id', user.id)
        await supabase.from('user_id_mappings').delete().eq('user_id', user.id)
        
        // Delete the auth user
        const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id)
        
        if (deleteError) {
          results.failed.push({ email: user.email || user.id, error: deleteError.message })
        } else {
          results.deleted.push(user.email || user.id)
          console.log(`[delete-users] Deleted user: ${user.email}`)
        }
      } catch (err) {
        results.failed.push({ 
          email: user.email || user.id, 
          error: err instanceof Error ? err.message : 'Unknown error' 
        })
      }
    }

    // Log admin action
    await supabase.rpc('insert_audit_log', {
      p_action: 'admin_delete_users',
      p_user_id: userId,
      p_actor: userData.user.email || userId,
      p_action_type: 'admin',
      p_metadata: { deleted: results.deleted.length, failed: results.failed.length, emails }
    })

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
    console.error('[delete-users] Error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})