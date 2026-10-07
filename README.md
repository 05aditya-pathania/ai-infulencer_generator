# Postly

Postly is a social content creation and scheduling app built with Next.js and Supabase.

## Getting started

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and set the Supabase project URL and publishable key. Both values are available in your Supabase project's **Connect** dialog:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
POLLINATIONS_API_KEY=your-pollinations-api-key
POLLINATIONS_IMAGE_MODEL=tongyi-mai/z-image-turbo
CLOUDFLARE_ACCOUNT_ID=your-cloudflare-account-id
CLOUDFLARE_API_TOKEN=your-cloudflare-workers-ai-token
APP_URL=http://localhost:3000
ZERNIO_API_KEY=your-zernio-api-key
```

Create a server-side secret key (`sk_*`) at [Pollinations](https://enter.pollinations.ai/keys), then set `POLLINATIONS_API_KEY`. The default image model is `tongyi-mai/z-image-turbo`; set `POLLINATIONS_IMAGE_MODEL` only to a model your Pollinations account allows. A `403 FORBIDDEN` means the Pollinations key/account cannot access the selected model; changing the model name alone will not grant access. Use a secret key with image-model access, and contact Pollinations support if a secret key is still denied. Keep the key server-only: never rename it with a `NEXT_PUBLIC_` prefix. Never put a Supabase secret or service-role key in a `NEXT_PUBLIC_` variable.

Keep the settings in separate variables: `POLLINATIONS_API_KEY=sk_...` and `POLLINATIONS_IMAGE_MODEL=tongyi-mai/z-image-turbo`. Do not put the API key in the model variable. The server validates both settings before reserving credits and returns a configuration error without charging credits if a key is in the wrong variable.

## Supabase authentication setup

1. In the Supabase dashboard, enable **Email**, **Google**, and **GitHub** under **Authentication → Sign In / Providers**.
2. Configure the Google and GitHub OAuth client IDs and secrets in their provider settings. Use the provider callback URL shown by Supabase in each provider's OAuth app configuration.
3. Add `http://localhost:3000/auth/callback` to **Authentication → URL Configuration → Redirect URLs**. Add the corresponding callback URL for each deployed environment.
4. Run the SQL migrations in [`supabase/migrations`](./supabase/migrations) in timestamp order using the Supabase SQL Editor, or apply them using the Supabase CLI.
5. Restart the Next.js development server after setting `.env.local`.

Email/password sign-up and sign-in are available at `/auth`. If email confirmation is enabled in Supabase, new users receive a confirmation email before their first sign-in. The callback exchanges the confirmation code for a session.

The same page offers **Continue with Google** and **Continue with GitHub**. Both providers return to `/auth/callback`, exchange the authorization code for a session, and send the user to the dashboard.

The SQL migration creates `public.profiles` with row-level security and an `auth.users` database trigger. The trigger writes a user's ID, email, and display name to the profile table in the same database transaction as account creation; no webhook or privileged service key is used. It also backfills profiles for existing Auth users.

The `/dashboard` route requires a verified Supabase session. Supabase sessions are stored in cookies and refreshed by the Next.js 16 `proxy.ts`.

## Connecting social accounts

The dashboard’s **Social accounts** page connects Instagram, TikTok, LinkedIn, Facebook, Pinterest, X (Twitter), and YouTube through [Zernio](https://zernio.com). Set the server-only `ZERNIO_API_KEY` from your Zernio API keys page and set `APP_URL` to the app’s public origin (for example, `http://localhost:3000` locally and `https://postly.example.com` in production). Do not prefix the Zernio key with `NEXT_PUBLIC_`.

Postly creates one Zernio profile per signed-in user, requests the platform authorization URL from the Zernio API, and uses a short-lived, HTTP-only state cookie to validate the return to `/api/accounts/callback`. The callback verifies the returned account against that user’s Zernio profile before persisting only its account ID and public profile details in Supabase. You can connect multiple accounts for the same platform; use **Add another** on that platform to authorize another profile. Provider credentials remain with Zernio and are never stored in Postly. Disconnecting removes the account through Zernio and then removes its Postly record.

If a connection return fails, the Social accounts page identifies whether authorization was rejected, the callback state or account details were invalid, profile verification failed, or Postly could not save the account. When the provider returns a recognized OAuth error code, Postly shows the code and a targeted next step. For YouTube's `no_youtube_channel`, authorize with the Google account that owns a YouTube channel, or create a channel for that account before retrying. Use your platform/Zernio app settings to fix permission or callback URL errors. For a state error, make sure `APP_URL` exactly matches the origin used to open Postly, including the domain and HTTPS setting.

Complete social sign-in in a regular browser such as Chrome or Edge. Embedded browsers, including VS Code's Simple Browser, may block Google sign-in windows opened by a social platform.

Apply the migrations in timestamp order, including `20261006000000_add_social_accounts.sql`, `20261007010000_add_tiktok_linkedin_social_accounts.sql`, and `20261007020000_support_multi_platform_posts.sql`, before connecting accounts. For production, set `APP_URL` to the exact HTTPS site origin and allow that app callback URL (`/api/accounts/callback`) in your Zernio integration’s redirect configuration, if your Zernio account requires an allowlist. Zernio’s OAuth app handles the provider-specific consent screens; configure the needed social platforms/permissions in your Zernio account. See the official [Zernio connect API](https://docs.zernio.com/connect/get-connect-url), [account API](https://docs.zernio.com/accounts/list-accounts), and [connecting accounts guide](https://docs.zernio.com/guides/connecting-accounts).

## Creator dashboard

The authenticated workspace includes a responsive sidebar with Dashboard, AI Studio, Calendar, Social accounts, Analytics, Media library, and Settings. The overview provides getting-started actions and shortcuts into those sections. AI influencer creation and the Cloudflare-powered post composer are available. Drafts, publish intents, and scheduled post details are saved to the private `social-posts` storage bucket and `social_posts` table. Social accounts can be connected and disconnected through Zernio; automatic publishing still needs a publishing workflow and scheduler, so saving a scheduled time does not publish a post by itself.

### AI influencer models

The AI Studio model builder uses Pollinations' `tongyi-mai/z-image-turbo` image model by default to generate a portrait and a full-body image from the selected creator traits and prompt. Set `POLLINATIONS_IMAGE_MODEL` to use a different model your key permits. Generation displays an in-memory preview without writing images or a model record to Supabase. When the user clicks **Save this model**, Postly reserves 50 credits, uploads both images to Supabase Storage, and completes the `influencer_models` row with the model name, selected traits, prompt, and both image storage paths. Failed saves clean up uploaded files and refund the reserved credits. The bucket is private, so the database stores durable storage paths rather than expiring signed URLs; the app creates fresh signed URLs when it displays saved images. Pollinations Pollen is separate from Postly credits. The `20260927020000_add_influencer_generation_credits.sql` migration adds the default 300-credit balance, private image storage, model records, and atomic credit reservation/refund/complete functions.

Keep `POLLINATIONS_API_KEY` on the server. The model images are stored in the private `influencer-models` Supabase Storage bucket; the app returns short-lived signed URLs for previews. See the [Pollinations image-generation API](https://github.com/pollinations/pollinations/blob/main/APIDOCS.md#image-generation).

### Social post composer

The **Create new post** page shows platforms with connected accounts by default. **Show all platforms** reveals all supported destinations and their connection status. Select multiple destinations by clicking their cards; use **Connect [platform]** to begin authorization for selected unconnected destinations directly from the composer. After a successful connection, Postly returns to the composer. Without every selected destination connected, schedule and publish-intent actions are unavailable, but drafts can still be saved with all selected platform IDs. Postly stores the complete destination selection in `social_posts.platforms`; the legacy `platform` field continues to hold the first selected destination. One of four visual formats, a campaign brief, goal, scene, tone, CTA, language, hashtag count, and up to three reference images can be configured. Reference files are compressed in the browser and sent to the server as small inline image references. The server adds the saved creator portrait and submits the prompt and references to Cloudflare Workers AI `@cf/black-forest-labs/flux-2-klein-9b`, then displays the generated image in a platform-style preview. Set `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` as server-only environment variables. Captions and hashtags remain editable before saving as a draft, marking ready to publish, or storing a scheduled time. These actions save the image and post details in Supabase and do not charge Postly credits. Scheduled times and publish intents are stored in Postly but are not sent to networks automatically. Apply `20261007000000_allow_draft_without_platform.sql` after the existing social-post migration to allow drafts without a destination, then apply `20261007020000_support_multi_platform_posts.sql` to store every selected destination. Cloudflare Workers AI includes a limited free daily neuron allocation; see the [Workers AI pricing page](https://developers.cloudflare.com/workers-ai/platform/pricing/).

## Checks

```bash
npm run lint
npm run build
```
