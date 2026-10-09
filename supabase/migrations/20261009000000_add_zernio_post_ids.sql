alter table public.social_posts
  add column if not exists zernio_post_id text;

create unique index if not exists social_posts_zernio_post_id_unique
  on public.social_posts (zernio_post_id)
  where zernio_post_id is not null;
