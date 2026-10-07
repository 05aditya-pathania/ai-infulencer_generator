alter table public.social_posts
  add column if not exists platforms text[] not null default '{}';

update public.social_posts
set platforms = array[platform]
where platform is not null
  and cardinality(platforms) = 0;

alter table public.social_posts
  drop constraint if exists social_posts_platforms_supported;

alter table public.social_posts
  add constraint social_posts_platforms_supported
  check (
    platforms <@ array['instagram', 'tiktok', 'x', 'linkedin', 'pinterest', 'facebook']::text[]
  );

alter table public.social_posts
  drop constraint if exists social_posts_platforms_required_for_delivery;

alter table public.social_posts
  add constraint social_posts_platforms_required_for_delivery
  check (cardinality(platforms) > 0 or status = 'draft');
