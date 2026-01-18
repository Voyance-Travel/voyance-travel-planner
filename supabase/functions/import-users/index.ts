import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const { users } = await req.json() as { users: UserImport[] }

    if (!users || !Array.isArray(users)) {
      return new Response(
        JSON.stringify({ error: 'users array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
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
          // Update profile with additional data
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
              id: authUser.user.id,
              display_name: user.display_name || user.name || user.email.split('@')[0],
              handle: user.handle,
              avatar_url: user.avatar_url,
              bio: user.bio,
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
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
