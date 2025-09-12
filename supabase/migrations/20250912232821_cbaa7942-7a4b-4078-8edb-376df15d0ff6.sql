-- Clear failed login attempts for testing
DELETE FROM login_attempts WHERE username = 'zafditta' AND success = false;