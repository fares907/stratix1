-- مفاتيح الموديلات بتتحفظ مشفّرة في Supabase Vault (مثلًا: select vault.create_secret('<key>', 'GROQ_API_KEY');)
-- الدالة دي بتقراها، ومسموح بيها لـ service_role بس (يعني الـ edge functions)، مش لأي مستخدم.
create or replace function public.agent_secret(secret_name text) returns text
language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = secret_name limit 1;
$$;
revoke all on function public.agent_secret(text) from public, anon, authenticated;
grant execute on function public.agent_secret(text) to service_role;
