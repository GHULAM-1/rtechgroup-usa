import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { compare, hash } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return new Response(
        JSON.stringify({ error: 'Username and password are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Attempting login for username:', username);

    // Check rate limiting - if more than 5 failed attempts in last 15 minutes, block
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: attempts } = await supabase
      .from('login_attempts')
      .select('*')
      .eq('username', username.toLowerCase())
      .eq('success', false)
      .gte('attempted_at', fifteenMinutesAgo);

    if (attempts && attempts.length >= 5) {
      await supabase
        .from('login_attempts')
        .insert({
          username: username.toLowerCase(),
          success: false,
          ip_address: req.headers.get('x-forwarded-for') || 'unknown'
        });
      
      return new Response(
        JSON.stringify({ error: 'Account temporarily locked due to too many failed attempts' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Look up user by username (using service role to bypass RLS)
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .ilike('username', username)
      .eq('status', 'active')
      .single();

    console.log('User lookup result:', { user: user ? { id: user.id, username: user.username, role: user.role } : null, error: userError });

    if (userError || !user) {
      console.log('User not found or error:', userError);
      // Log failed attempt
      await supabase
        .from('login_attempts')
        .insert({
          username: username.toLowerCase(),
          success: false,
          ip_address: req.headers.get('x-forwarded-for') || 'unknown'
        });

      return new Response(
        JSON.stringify({ error: 'Invalid credentials' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify password using bcrypt
    let passwordMatch = false;
    try {
      passwordMatch = await compare(password, user.password_hash);
      console.log('Password verification result:', passwordMatch);
    } catch (bcryptError) {
      console.error('Bcrypt error:', bcryptError);
      passwordMatch = false;
    }

    if (!passwordMatch) {
      console.log('Password verification failed');
      // Log failed attempt
      await supabase
        .from('login_attempts')
        .insert({
          username: username.toLowerCase(),
          success: false,
          ip_address: req.headers.get('x-forwarded-for') || 'unknown'
        });

      return new Response(
        JSON.stringify({ error: 'Invalid credentials' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Success! Log successful attempt and update last login
    await Promise.all([
      supabase
        .from('login_attempts')
        .insert({
          username: username.toLowerCase(),
          success: true,
          ip_address: req.headers.get('x-forwarded-for') || 'unknown'
        }),
      supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id)
    ]);

    // Generate session token (JWT-like but simpler)
    const sessionData = {
      userId: user.id,
      username: user.username,
      role: user.role,
      exp: Date.now() + (12 * 60 * 60 * 1000) // 12 hours
    };

    const sessionToken = btoa(JSON.stringify(sessionData));

    console.log('Login successful for user:', user.username);

    const response = new Response(
      JSON.stringify({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          requirePasswordChange: user.require_password_change
        },
        sessionToken
      }),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Set-Cookie': `session=${sessionToken}; HttpOnly; Secure; SameSite=Lax; Max-Age=${12 * 60 * 60}; Path=/`
        } 
      }
    );

    return response;

  } catch (error) {
    console.error('Login error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});