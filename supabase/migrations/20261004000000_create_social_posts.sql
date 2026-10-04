create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  model_id uuid references public.influencer_models (id) on delete set null,
  model_name text not null check (char_length(model_name) between 1 and 60),
  platform text not null check (
    platform in ('instagram', 'tiktok', 'x', 'linkedin', 'pinterest', 'facebook')
  ),
  format text not null check (format in ('single', 'carousel', 'story', 'landscape')),
  campaign text not null check (char_length(campaign) between 1 and 80),
  product text not null check (char_length(product) between 1 and 80),
  goal text not null,
  scene text not null,
  tone text not null,
  call_to_action text not null,
  language text not null,
  hashtag_count integer not null check (hashtag_count between 0 and 20),
  caption text not null check (char_length(caption) <= 600),
  hashtags text[] not null default '{}',
  image_path text not null,
  status text not null check (status in ('draft', 'scheduled', 'ready_to_publish')),
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_posts_schedule_consistency check (
    (status = 'scheduled' and scheduled_at is not null)
    or (status <> 'scheduled' and scheduled_at is null)
  )
);

create index if not exists social_posts_user_created_at_idx
  on public.social_posts (user_id, created_at desc);

create index if not exists social_posts_scheduled_at_idx
  on public.social_posts (scheduled_at)
  where status = 'scheduled';

alter table public.social_posts enable row level security;

drop policy if exists "Users can read their own social posts"
  on public.social_posts;
create policy "Users can read their own social posts"
  on public.social_posts for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own social posts"
  on public.social_posts;
create policy "Users can create their own social posts"
  on public.social_posts for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own social posts"
  on public.social_posts;
create policy "Users can update their own social posts"
  on public.social_posts for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own social posts"
  on public.social_posts;
create policy "Users can delete their own social posts"
  on public.social_posts for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.social_posts to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'social-posts',
  'social-posts',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can upload their own social post images"
  on storage.objects;
create policy "Users can upload their own social post images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'social-posts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can read their own social post images"
  on storage.objects;
create policy "Users can read their own social post images"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'social-posts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can delete their own social post images"
  on storage.objects;
create policy "Users can delete their own social post images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'social-posts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );