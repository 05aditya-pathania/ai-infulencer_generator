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
LUMA_AGENTS_API_KEY=your-luma-agents-api-key
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

## Creator dashboard

The authenticated workspace includes a responsive sidebar with Dashboard, AI Studio, Calendar, Social accounts, Analytics, Media library, and Settings. The overview provides getting-started actions and shortcuts into those sections. AI influencer creation and the Luma-powered post composer are available. Direct social account connections, scheduling, publishing, analytics, and general media-library features still need their integrations and data models.

### AI influencer models

The AI Studio model builder uses Pollinations' `tongyi-mai/z-image-turbo` image model by default to generate a portrait and a full-body image from the selected creator traits and prompt. Set `POLLINATIONS_IMAGE_MODEL` to use a different model your key permits. Generation displays an in-memory preview without writing images or a model record to Supabase. When the user clicks **Save this model**, Postly reserves 50 credits, uploads both images to Supabase Storage, and completes the `influencer_models` row with the model name, selected traits, prompt, and both image storage paths. Failed saves clean up uploaded files and refund the reserved credits. The bucket is private, so the database stores durable storage paths rather than expiring signed URLs; the app creates fresh signed URLs when it displays saved images. Pollinations Pollen is separate from Postly credits. The `20260927020000_add_influencer_generation_credits.sql` migration adds the default 300-credit balance, private image storage, model records, and atomic credit reservation/refund/complete functions.

Keep `POLLINATIONS_API_KEY` on the server. The model images are stored in the private `influencer-models` Supabase Storage bucket; the app returns short-lived signed URLs for previews. See the [Pollinations image-generation API](https://github.com/pollinations/pollinations/blob/main/APIDOCS.md#image-generation).

### Social post composer

The **Create new post** page loads the signed-in user's saved creator models, lets them choose Instagram, TikTok, X, LinkedIn, Pinterest, or Facebook, and configure one of four visual formats, a campaign brief, goal, scene, tone, CTA, language, hashtag count, and up to three reference images. Reference files are compressed in the browser and sent to the server as small inline image references. The server adds the saved creator portrait and submits an image request to Luma Agents `uni-1`, polls for completion, then displays the generated image in a platform-style preview. Set `LUMA_AGENTS_API_KEY` as a server-only environment variable. Caption copy and hashtags are generated from the chosen copy settings and remain editable in the preview. Generation is preview-only: it does not save a post record, publish to a social network, or charge Postly credits. Reach figures in the creator picker are illustrative planning estimates, not connected analytics. See the [Luma Agents image-generation guide](https://docs.agents.lumalabs.ai/guides/images/generation/index.md).

## Checks

```bash
npm run lint
npm run build
```
