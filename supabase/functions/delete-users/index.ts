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
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

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

    console.log(`Found ${usersToDelete.length} users to delete`)

    const results = {
      deleted: [] as string[],
      failed: [] as { email: string; error: string }[]
    }

    for (const user of usersToDelete) {
      try {
        // First delete related data
        // Delete from profiles
        await supabase.from('profiles').delete().eq('id', user.id)
        
        // Delete from user_id_mappings
        await supabase.from('user_id_mappings').delete().eq('user_id', user.id)
        
        // Delete the auth user
        const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id)
        
        if (deleteError) {
          results.failed.push({ email: user.email || user.id, error: deleteError.message })
        } else {
          results.deleted.push(user.email || user.id)
          console.log(`Deleted user: ${user.email}`)
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
        message: 'Deletion completed',
        deleted: results.deleted.length,
        failed: results.failed.length,
        details: results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Delete error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
