-- أي حساب يتعمل بإيميل من القائمة دي بياخد صلاحية رئيس مجلس الإدارة أوتوماتيك.
-- القائمة في schema "private" مش ظاهرة في الـ API.

create table if not exists private.owner_emails (email text primary key);
revoke all on private.owner_emails from public, anon, authenticated;
insert into private.owner_emails (email) values ('stratix255@gmail.com') on conflict do nothing;

create or replace function private.grant_owner_on_signup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from private.owner_emails where email = lower(new.email)) then
    insert into public.owners (user_id) values (new.id) on conflict do nothing;
  end if;
  return new;
end $$;
revoke all on function private.grant_owner_on_signup() from public, anon, authenticated;

drop trigger if exists grant_owner_on_signup on auth.users;
create trigger grant_owner_on_signup after insert on auth.users
  for each row execute function private.grant_owner_on_signup();

insert into public.owners (user_id)
select u.id from auth.users u join private.owner_emails o on lower(u.email) = o.email
on conflict do nothing;
