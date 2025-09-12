import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Look up user by username
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .ilike('username', username)
      .eq('status', 'active')
      .single();

    if (userError || !user) {
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

    // Verify password using SQL query with crypt function directly
    const { data: passwordResult, error: passwordError } = await supabase
      .from('users')
      .select('id')
      .ilike('username', username)
      .eq('status', 'active')
      .eq('password_hash', `crypt('${password.replace(/'/g, "''")}', password_hash)`)
      .single();

    console.log('Password verification result:', passwordResult, passwordError);

    if (passwordError || !passwordResult) {
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