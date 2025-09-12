-- Drop the failed functions first
DROP FUNCTION IF EXISTS public.verify_password(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.hash_password(TEXT);

-- Create password verification function using pgcrypto extension properly
CREATE OR REPLACE FUNCTION public.verify_password(stored_hash TEXT, provided_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN stored_hash = crypt(provided_password, stored_hash);
END;
$$;

-- Create password hashing function using pgcrypto extension properly
CREATE OR REPLACE FUNCTION public.hash_password(password TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN crypt(password, gen_salt('bf'));
END;
$$;