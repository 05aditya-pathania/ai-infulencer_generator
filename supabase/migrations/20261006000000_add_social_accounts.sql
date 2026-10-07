alter table public.profiles
  add column if not exists zernio_profile_id text unique;

drop policy if exists "Users can save their own Zernio profile"
  on public.profiles;
create policy "Users can save their own Zernio profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

grant update (zernio_profile_id) on public.profiles to authenticated;

create table if not exists public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  zernio_account_id text not null,
  platform text not null check (
    platform in ('instagram', 'facebook', 'pinterest', 'twitter', 'youtube')
  ),
  username text,
  display_name text,
  profile_url text,
  connected_at timestamptz not null default now(),
  constraint social_accounts_user_zernio_account_unique
    unique (user_id, zernio_account_id)
);

create index if not exists social_accounts_user_connected_idx
  on public.social_accounts (user_id, connected_at desc);

alter table public.social_accounts enable row level security;

drop policy if exists "Users can read their own social accounts"
  on public.social_accounts;
create policy "Users can read their own social accounts"
  on public.social_accounts for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can add their own social accounts"
  on public.social_accounts;
create policy "Users can add their own social accounts"
  on public.social_accounts for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can remove their own social accounts"
  on public.social_accounts;
create policy "Users can remove their own social accounts"
  on public.social_accounts for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, delete on public.social_accounts to authenticated;
