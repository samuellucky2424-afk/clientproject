-- Admin reports run as the server-only service_role, not as the database owner.
-- Limit Auth access to the fields displayed or counted by those reports.
grant usage on schema auth to service_role;
grant select (id,email,created_at,last_sign_in_at,email_confirmed_at,is_anonymous)
 on auth.users to service_role;
