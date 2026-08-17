# Supabase setup

The dashboard uses Supabase for both the database (Postgres) and authentication (Google sign-in).

Without it, the app still runs: it falls back to a local JSON store at `apps/web/.data/db.json`
under a fixed development identity. That fallback is refused in production.

## 1. Create the project

1. Create a project at [supabase.com](https://supabase.com)
2. **Project Settings → API** — copy the project URL, the publishable (`anon`) key and the
   `service_role` key

## 2. Apply the schema

Paste [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql) into the SQL editor
and run it, or use the CLI:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

This creates the tables, the row-level security policies, and the trigger that provisions a profile
row on first sign-in.

## 3. Enable Google sign-in

**In Google Cloud Console** ([console.cloud.google.com](https://console.cloud.google.com)):

1. **APIs & Services → OAuth consent screen** — configure it, and add the `email`, `profile` and
   `openid` scopes. Nothing else is needed; this app does not read Gmail, Drive or contacts.
2. **Credentials → Create credentials → OAuth client ID → Web application**
3. Authorized redirect URI:

   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```

4. Copy the client ID and client secret

**In Supabase** — **Authentication → Providers → Google**: enable it and paste the client ID and
secret.

**In Supabase** — **Authentication → URL Configuration**:

- Site URL: `http://localhost:3000` (your production origin when you deploy)
- Redirect URLs: add `http://localhost:3000/auth/callback` and your production equivalent

## 4. Configure the app

```bash
cp apps/web/.env.example apps/web/.env.local
```

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

The first two are safe in the browser — access is constrained by row-level security. **Never** give
the service-role key a `NEXT_PUBLIC_` prefix: it bypasses RLS entirely and is used only for reading
BYOK credentials and deleting accounts.

```bash
npm run dev:web
```

The sign-in page now shows **Continue with Google**.

## Deploying

Set the same four variables in your host's environment, update the Supabase Site URL and Redirect
URLs to your production origin, and add the production callback to the Google OAuth client.

```bash
npm run build:web && npm run start --workspace @job-ai/web
```

## Data model notes

Every user-owned table carries `user_id references auth.users(id) on delete cascade` and RLS
policies of the form `auth.uid() = user_id`. Isolation is enforced by the database, not by
application code.

`public.ai_credentials` has RLS enabled and **no policies**, which denies the `anon` and
`authenticated` roles every operation — BYOK keys are reachable only through the service role,
server-side.

Deleting an account removes the auth user; the cascades remove everything else.
