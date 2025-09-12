-- Create password verification function
CREATE OR REPLACE FUNCTION public.verify_password(stored_hash TEXT, provided_password TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT crypt(provided_password, stored_hash) = stored_hash;
$$;

-- Create password hashing function
CREATE OR REPLACE FUNCTION public.hash_password(password TEXT)
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT crypt(password, gen_salt('bf'));
$$;