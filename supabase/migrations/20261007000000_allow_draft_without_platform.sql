alter table public.social_posts
  alter column platform drop not null;

alter table public.social_posts
  drop constraint if exists social_posts_platform_required_for_delivery;

alter table public.social_posts
  add constraint social_posts_platform_required_for_delivery
  check (platform is not null or status = 'draft');
