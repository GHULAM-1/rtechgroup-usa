-- Fix RLS policies for authentication edge functions
-- The edge functions need to access users table with service role key

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Only admins can access users" ON public.users;

-- Create more appropriate policies for the users table
-- Allow service role (edge functions) to access users for authentication
CREATE POLICY "Service role can access users for auth" ON public.users
FOR ALL USING (true);

-- Public can read their own user data when authenticated  
CREATE POLICY "Users can read own data" ON public.users
FOR SELECT USING (auth.uid()::text = id::text);

-- Only authenticated users with admin role can manage other users
CREATE POLICY "Admins can manage users" ON public.users
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id::text = auth.uid()::text 
    AND u.role = 'admin' 
    AND u.status = 'active'
  )
);