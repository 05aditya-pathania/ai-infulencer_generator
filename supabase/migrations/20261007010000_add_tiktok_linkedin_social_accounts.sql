alter table public.social_accounts
  drop constraint if exists social_accounts_platform_check;

alter table public.social_accounts
  add constraint social_accounts_platform_check
  check (
    platform in (
      'instagram',
      'tiktok',
      'linkedin',
      'facebook',
      'pinterest',
      'twitter',
      'youtube'
    )
  );
