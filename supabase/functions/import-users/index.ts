import { createClient } from 'npm:@supabase/supabase-js@2.90.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

interface UserImport {
  id: string
  email: string
  name?: string
  display_name?: string
  handle?: string
  avatar_url?: string
  bio?: string
  quiz_completed?: boolean
  travel_dna?: string
  created_at?: string
}

// Maximum users allowed per import for rate limiting
const MAX_USERS_PER_IMPORT = 500

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // ========================================
    // AUTHENTICATION: Require valid JWT token
    // ========================================
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Missing authorization header' }),
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
        JSON.stringify({ error: 'Unauthorized: Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const adminUserId = userData.user.id
    const adminEmail = userData.user.email
    console.log(`Authenticated user: ${adminUserId}`)

    // ========================================
    // AUTHORIZATION: Require admin role
    // ========================================
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
    
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', adminUserId)
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
      console.log(`User ${adminUserId} attempted user import without admin role`)
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Admin access confirmed for user: ${adminUserId}`)

    // ========================================
    // VALIDATE REQUEST
    // ========================================
    const { users } = await req.json() as { users: UserImport[] }

    if (!users || !Array.isArray(users)) {
      return new Response(
        JSON.stringify({ error: 'users array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Rate limiting: cap the number of users per import
    if (users.length > MAX_USERS_PER_IMPORT) {
      return new Response(
        JSON.stringify({ error: `Too many users. Maximum ${MAX_USERS_PER_IMPORT} users per import allowed.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate email formats
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    for (const user of users) {
      if (user.email && !emailRegex.test(user.email)) {
        return new Response(
          JSON.stringify({ error: `Invalid email format: ${user.email}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    const results = {
      success: [] as string[],
      failed: [] as { email: string; error: string }[],
      skipped: [] as { email: string; reason: string }[]
    }

    for (const user of users) {
      try {
        if (!user.email) {
          results.skipped.push({ email: user.id, reason: 'No email provided' })
          continue
        }

        // Check if user already exists
        const { data: existingUsers } = await supabase.auth.admin.listUsers()
        const exists = existingUsers?.users?.some(u => u.email === user.email)
        
        if (exists) {
          results.skipped.push({ email: user.email, reason: 'User already exists' })
          continue
        }

        // Create auth user with specific ID if provided
        const createUserData: any = {
          email: user.email,
          email_confirm: true, // Auto-confirm email
          user_metadata: {
            name: user.name || user.display_name,
            full_name: user.display_name || user.name
          }
        }

        // Try to use the original ID if it's a valid UUID
        if (user.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id)) {
          // We can't directly set the user ID in Supabase Auth admin API
          // So we'll create the user and then update the profile with mapping
        }

        const { data: authUser, error: authError } = await supabase.auth.admin.createUser(createUserData)

        if (authError) {
          results.failed.push({ email: user.email, error: authError.message })
          continue
        }

        if (authUser?.user) {
          // Store legacy user ID mapping if the original had an ID
          if (user.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id)) {
            const { error: mappingError } = await supabase
              .from('user_id_mappings')
              .upsert({
                legacy_user_id: user.id,
                user_id: authUser.user.id,
                email: user.email,
                updated_at: new Date().toISOString()
              }, { onConflict: 'legacy_user_id' })

            if (mappingError) {
              console.error('User ID mapping error:', mappingError)
            } else {
              console.log(`Mapped legacy ${user.id} → ${authUser.user.id}`)
            }
          }

          // Update profile with additional data - handle empty strings as null
          const handleValue = user.handle && user.handle.trim() !== '' ? user.handle : null;
          
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
              id: authUser.user.id,
              display_name: user.display_name || user.name || user.email.split('@')[0],
              handle: handleValue,
              avatar_url: user.avatar_url && user.avatar_url.trim() !== '' ? user.avatar_url : null,
              bio: user.bio && user.bio.trim() !== '' ? user.bio : null,
              quiz_completed: Boolean(user.quiz_completed),
              travel_dna: user.travel_dna ? { archetype: user.travel_dna } : null,
              updated_at: new Date().toISOString()
            })

          if (profileError) {
            console.error('Profile update error:', profileError)
          }

          results.success.push(user.email)
        }
      } catch (err) {
        results.failed.push({ 
          email: user.email || user.id, 
          error: err instanceof Error ? err.message : 'Unknown error' 
        })
      }
    }

    // ========================================
    // AUDIT LOGGING
    // ========================================
    try {
      await supabase.rpc('insert_audit_log', {
        p_action: 'admin_import_users',
        p_user_id: adminUserId,
        p_actor: adminEmail || adminUserId,
        p_action_type: 'admin',
        p_metadata: { 
          imported: results.success.length, 
          failed: results.failed.length,
          skipped: results.skipped.length
        }
      })
    } catch (auditErr) {
      console.error('Audit log error:', auditErr)
      // Don't fail the import if audit logging fails
    }

    return new Response(
      JSON.stringify({
        message: 'Import completed',
        imported: results.success.length,
        failed: results.failed.length,
        skipped: results.skipped.length,
        details: results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Import error:', error)
    return new Response(
      JSON.stringify({ success: false, error: "User import failed", code: "IMPORT_ERROR" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
