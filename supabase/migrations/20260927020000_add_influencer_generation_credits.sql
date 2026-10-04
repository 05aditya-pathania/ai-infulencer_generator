alter table public.profiles
  add column if not exists credits integer not null default 300;

alter table public.profiles
  drop constraint if exists profiles_credits_nonnegative;

alter table public.profiles
  add constraint profiles_credits_nonnegative check (credits >= 0);

create table if not exists public.influencer_models (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  traits jsonb not null,
  prompt text not null,
  portrait_path text,
  full_body_path text,
  status text not null default 'processing'
    check (status in ('processing', 'completed', 'failed')),
  credits_charged integer not null default 50 check (credits_charged = 50),
  credits_refunded_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now()
);

create index if not exists influencer_models_user_created_at_idx
  on public.influencer_models (user_id, created_at desc);

alter table public.influencer_models enable row level security;

drop policy if exists "Users can read their own influencer models"
  on public.influencer_models;
create policy "Users can read their own influencer models"
  on public.influencer_models
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.influencer_models to authenticated;
grant select on public.profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'influencer-models',
  'influencer-models',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can upload their own influencer images"
  on storage.objects;
create policy "Users can upload their own influencer images"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'influencer-models'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can read their own influencer images"
  on storage.objects;
create policy "Users can read their own influencer images"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'influencer-models'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can delete their own influencer images"
  on storage.objects;
create policy "Users can delete their own influencer images"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'influencer-models'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create or replace function public.reserve_influencer_generation(
  p_name text,
  p_traits jsonb,
  p_prompt text
)
returns table (generation_id uuid, remaining_credits integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_remaining_credits integer;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED';
  end if;

  if char_length(trim(p_name)) not between 1 and 60 then
    raise exception using errcode = '22023', message = 'INVALID_INFLUENCER_NAME';
  end if;

  update public.profiles
  set credits = credits - 50
  where id = v_user_id
    and credits >= 50
  returning credits into v_remaining_credits;

  if not found then
    raise exception using errcode = 'P0001', message = 'INSUFFICIENT_CREDITS';
  end if;

  insert into public.influencer_models as model (user_id, name, traits, prompt)
  values (v_user_id, trim(p_name), p_traits, p_prompt)
  returning model.id into generation_id;

  remaining_credits := v_remaining_credits;
  return next;
end;
$$;

revoke all on function public.reserve_influencer_generation(text, jsonb, text)
  from public, anon;
grant execute on function public.reserve_influencer_generation(text, jsonb, text)
  to authenticated;

create or replace function public.refund_influencer_generation(
  p_generation_id uuid,
  p_failure_reason text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_credits_to_refund integer;
  v_remaining_credits integer;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED';
  end if;

  update public.influencer_models
  set status = 'failed',
      failure_reason = left(p_failure_reason, 500),
      credits_refunded_at = now()
  where id = p_generation_id
    and user_id = v_user_id
    and status = 'processing'
    and credits_refunded_at is null
  returning credits_charged into v_credits_to_refund;

  if not found then
    raise exception using errcode = 'P0002', message = 'GENERATION_NOT_REFUNDABLE';
  end if;

  update public.profiles
  set credits = credits + v_credits_to_refund
  where id = v_user_id
  returning credits into v_remaining_credits;

  if not found then
    raise exception using errcode = 'P0002', message = 'PROFILE_NOT_FOUND';
  end if;

  return v_remaining_credits;
end;
$$;

revoke all on function public.refund_influencer_generation(uuid, text)
  from public, anon;
grant execute on function public.refund_influencer_generation(uuid, text)
  to authenticated;

create or replace function public.complete_influencer_generation(
  p_generation_id uuid,
  p_portrait_path text,
  p_full_body_path text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_prefix text;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED';
  end if;

  v_prefix := v_user_id::text || '/' || p_generation_id::text || '/';

  if p_portrait_path not like (v_prefix || 'portrait.%')
    or p_full_body_path not like (v_prefix || 'full-body.%') then
    raise exception using errcode = '22023', message = 'INVALID_INFLUENCER_IMAGE_PATH';
  end if;

  update public.influencer_models
  set portrait_path = p_portrait_path,
      full_body_path = p_full_body_path,
      status = 'completed',
      failure_reason = null
  where id = p_generation_id
    and user_id = v_user_id
    and status = 'processing'
    and credits_refunded_at is null;

  if not found then
    raise exception using errcode = 'P0002', message = 'GENERATION_NOT_COMPLETABLE';
  end if;
end;
$$;

revoke all on function public.complete_influencer_generation(uuid, text, text)
  from public, anon;
grant execute on function public.complete_influencer_generation(uuid, text, text)
  to authenticated;
