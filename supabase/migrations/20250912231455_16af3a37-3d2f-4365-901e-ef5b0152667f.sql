-- Enable pgcrypto extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create users table for custom authentication
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT CHECK (role IN ('admin', 'ops', 'viewer')) NOT NULL DEFAULT 'viewer',
  status TEXT CHECK (status IN ('active', 'disabled')) NOT NULL DEFAULT 'active',
  require_password_change BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_login TIMESTAMPTZ
);

-- Create index for efficient username lookups
CREATE INDEX IF NOT EXISTS ix_users_username ON public.users(lower(username));

-- Create login attempts table for rate limiting
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  attempted_at TIMESTAMPTZ DEFAULT now(),
  success BOOLEAN NOT NULL DEFAULT false,
  ip_address TEXT
);

-- Create index for efficient attempt lookups
CREATE INDEX IF NOT EXISTS ix_login_attempts_username ON public.login_attempts(username, attempted_at);

-- Enable RLS on both tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- RLS policies for users table (admin only)
CREATE POLICY "Only admins can access users" ON public.users
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = current_setting('app.current_user_id')::uuid 
    AND u.role = 'admin' 
    AND u.status = 'active'
  )
);

-- RLS policies for login attempts (system only)
CREATE POLICY "System can manage login attempts" ON public.login_attempts
FOR ALL USING (true);

-- Seed initial admin user: ZafDitta with password RTech1!
INSERT INTO public.users (id, username, password_hash, role, status, require_password_change)
VALUES (
  gen_random_uuid(),
  'ZafDitta',
  crypt('RTech1!', gen_salt('bf')),
  'admin',
  'active',
  true
)
ON CONFLICT (username) DO NOTHING;