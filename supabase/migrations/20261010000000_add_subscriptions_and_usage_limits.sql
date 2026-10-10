alter table public.profiles
  add column if not exists plan text not null default 'free',
  add column if not exists subscription_status text not null default 'inactive',
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;

alter table public.profiles
  drop constraint if exists profiles_plan_valid;
alter table public.profiles
  add constraint profiles_plan_valid
  check (plan in ('free', 'standard', 'pro'));

alter table public.profiles
  drop constraint if exists profiles_subscription_status_valid;
alter table public.profiles
  add constraint profiles_subscription_status_valid
  check (
    subscription_status in (
      'inactive', 'active', 'trialing', 'past_due', 'canceled',
      'unpaid', 'incomplete', 'incomplete_expired', 'paused'
    )
  );

create unique index if not exists profiles_stripe_customer_id_idx
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;
create unique index if not exists profiles_stripe_subscription_id_idx
  on public.profiles (stripe_subscription_id)
  where stripe_subscription_id is not null;

create table if not exists public.subscription_payments (
  invoice_id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  plan text not null check (plan in ('standard', 'pro')),
  credits_awarded integer not null check (credits_awarded in (2000, 10000)),
  created_at timestamptz not null default now()
);

alter table public.subscription_payments enable row level security;
revoke all on public.subscription_payments from public, anon, authenticated;

create or replace function public.apply_subscription_payment(
  p_user_id uuid,
  p_plan text,
  p_customer_id text,
  p_subscription_id text,
  p_invoice_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_credits integer;
  v_inserted_invoice text;
  v_profile_customer_id text;
  v_profile_subscription_id text;
begin
  if p_plan = 'standard' then
    v_credits := 2000;
  elsif p_plan = 'pro' then
    v_credits := 10000;
  else
    raise exception using errcode = '22023', message = 'INVALID_SUBSCRIPTION_PLAN';
  end if;

  if p_user_id is null
    or p_customer_id is null
    or p_subscription_id is null
    or p_invoice_id is null then
    raise exception using errcode = '22023', message = 'INVALID_SUBSCRIPTION_PAYMENT';
  end if;

  select stripe_customer_id, stripe_subscription_id
  into v_profile_customer_id, v_profile_subscription_id
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'SUBSCRIPTION_PROFILE_NOT_FOUND';
  end if;

  if (v_profile_customer_id is not null and v_profile_customer_id <> p_customer_id)
    or (v_profile_subscription_id is not null and v_profile_subscription_id <> p_subscription_id) then
    return false;
  end if;

  insert into public.subscription_payments (invoice_id, user_id, plan, credits_awarded)
  values (p_invoice_id, p_user_id, p_plan, v_credits)
  on conflict (invoice_id) do nothing
  returning invoice_id into v_inserted_invoice;

  if v_inserted_invoice is null then
    return false;
  end if;

  update public.profiles
  set credits = credits + v_credits,
      plan = p_plan,
      subscription_status = 'active',
      stripe_customer_id = p_customer_id,
      stripe_subscription_id = p_subscription_id
  where id = p_user_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'SUBSCRIPTION_PROFILE_MISMATCH';
  end if;

  return true;
end;
$$;

revoke all on function public.apply_subscription_payment(uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.apply_subscription_payment(uuid, text, text, text, text)
  to service_role;

create table if not exists public.post_credit_reservations (
  post_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  credits_charged integer not null default 20 check (credits_charged = 20),
  refunded_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.post_credit_reservations enable row level security;
revoke all on public.post_credit_reservations from public, anon, authenticated;

create or replace function public.reserve_post_creation(p_post_id uuid)
returns integer
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

  update public.profiles
  set credits = credits - 20
  where id = v_user_id and credits >= 20
  returning credits into v_remaining_credits;

  if not found then
    raise exception using errcode = 'P0001', message = 'INSUFFICIENT_CREDITS';
  end if;

  insert into public.post_credit_reservations (post_id, user_id)
  values (p_post_id, v_user_id);

  return v_remaining_credits;
end;
$$;

revoke all on function public.reserve_post_creation(uuid) from public, anon;
grant execute on function public.reserve_post_creation(uuid) to authenticated;

create or replace function public.refund_post_creation(p_post_id uuid)
returns integer
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

  update public.post_credit_reservations
  set refunded_at = now()
  where post_id = p_post_id
    and user_id = v_user_id
    and refunded_at is null
    and not exists (
      select 1
      from public.social_posts as post
      where post.id = p_post_id
        and post.user_id = v_user_id
    );

  if not found then
    raise exception using errcode = 'P0002', message = 'POST_CREDIT_NOT_REFUNDABLE';
  end if;

  update public.profiles
  set credits = credits + 20
  where id = v_user_id
  returning credits into v_remaining_credits;

  if not found then
    raise exception using errcode = 'P0002', message = 'PROFILE_NOT_FOUND';
  end if;

  return v_remaining_credits;
end;
$$;

revoke all on function public.refund_post_creation(uuid) from public, anon;
grant execute on function public.refund_post_creation(uuid) to authenticated;

create or replace function public.require_post_creation_credit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.post_credit_reservations as reservation
    where reservation.post_id = new.id
      and reservation.user_id = new.user_id
      and reservation.refunded_at is null
  ) then
    raise exception using errcode = '23514', message = 'POST_CREATION_CREDIT_REQUIRED';
  end if;
  return new;
end;
$$;

drop trigger if exists social_posts_require_creation_credit on public.social_posts;
create trigger social_posts_require_creation_credit
  before insert on public.social_posts
  for each row execute function public.require_post_creation_credit();
revoke all on function public.require_post_creation_credit() from public, anon, authenticated;

create or replace function public.enforce_social_account_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan text;
  v_count integer;
begin
  select plan into v_plan
  from public.profiles
  where id = new.user_id
  for update;

  if not found then
    raise exception using errcode = '23503', message = 'PROFILE_NOT_FOUND';
  end if;

  if v_plan = 'standard' then
    select count(*) into v_count
    from public.social_accounts
    where user_id = new.user_id;

    if v_count >= 5 then
      raise exception using errcode = '23514', message = 'SOCIAL_ACCOUNT_LIMIT_REACHED';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists social_accounts_enforce_plan_limit on public.social_accounts;
create trigger social_accounts_enforce_plan_limit
  before insert on public.social_accounts
  for each row execute function public.enforce_social_account_limit();
revoke all on function public.enforce_social_account_limit() from public, anon, authenticated;

create or replace function public.enforce_scheduled_post_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan text;
  v_count integer;
begin
  if tg_op = 'UPDATE' then
    if new.status <> 'scheduled' then
      return new;
    end if;
    if old.status = 'scheduled'
      and old.scheduled_at > now()
      and old.user_id = new.user_id then
      return new;
    end if;
  elsif new.status <> 'scheduled' then
    return new;
  end if;

  select plan into v_plan
  from public.profiles
  where id = new.user_id
  for update;

  if not found then
    raise exception using errcode = '23503', message = 'PROFILE_NOT_FOUND';
  end if;

  if v_plan = 'free' then
    select count(*) into v_count
    from public.social_posts
    where user_id = new.user_id
      and status = 'scheduled'
      and scheduled_at > now()
      and id <> new.id;

    if v_count >= 5 then
      raise exception using errcode = '23514', message = 'FREE_SCHEDULE_LIMIT_REACHED';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists social_posts_enforce_scheduled_limit on public.social_posts;
create trigger social_posts_enforce_scheduled_limit
  before insert or update on public.social_posts
  for each row execute function public.enforce_scheduled_post_limit();
revoke all on function public.enforce_scheduled_post_limit() from public, anon, authenticated;
