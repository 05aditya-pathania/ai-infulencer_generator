create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles as profile (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'user_name'), '')
    )
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(profile.display_name, excluded.display_name);

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

update public.profiles as profile
set display_name = coalesce(
  nullif(trim(user_data.raw_user_meta_data ->> 'display_name'), ''),
  nullif(trim(user_data.raw_user_meta_data ->> 'full_name'), ''),
  nullif(trim(user_data.raw_user_meta_data ->> 'name'), ''),
  nullif(trim(user_data.raw_user_meta_data ->> 'user_name'), '')
)
from auth.users as user_data
where profile.id = user_data.id
  and profile.display_name is null;
