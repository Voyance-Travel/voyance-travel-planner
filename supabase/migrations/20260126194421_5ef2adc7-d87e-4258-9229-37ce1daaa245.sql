-- Update generate_share_token to use cryptographically secure random bytes
-- PostgreSQL's gen_random_bytes is cryptographically secure

CREATE OR REPLACE FUNCTION public.generate_share_token(
    size integer DEFAULT 32
)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    result text;
BEGIN
    -- Use gen_random_bytes for cryptographic randomness, encode as base64 url-safe
    -- This generates a cryptographically secure random token
    result := encode(gen_random_bytes(size), 'base64');
    -- Make URL-safe: replace + with -, / with _, remove =
    result := replace(replace(result, '+', '-'), '/', '_');
    result := replace(result, '=', '');
    -- Trim to desired size
    RETURN substr(result, 1, size);
END;
$$;