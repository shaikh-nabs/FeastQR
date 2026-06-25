# FeastQR - Complete Setup Guide 🚀

This guide provides step-by-step instructions to set up the FeastQR project from scratch, covering Supabase configuration, environment variables, and deployment.

---

## Prerequisites

- **Node.js** (v18 or later)
- **npm** or **pnpm** (project uses `pnpm` but `npm` works too)
- **Git**
- **Supabase Account** (free tier works) — [Create account](https://supabase.com)
- **LemonSqueezy Account** — [Create account](https://lemonsqueezy.com)
- **Vercel Account** (for deployment) — [Create account](https://vercel.com)
- **Supabase CLI** (for local development) — [Install guide](https://supabase.com/docs/guides/cli)

---

## Step 1: Clone the Repository

```bash
git clone https://github.com/shaikh-nabs/FeastQR.git
cd FeastQR
```

---

## Step 2: Install Dependencies

```bash
npm install
# or if you have pnpm installed:
pnpm install
```

---

## Step 3: Set Up Supabase (Cloud)

### 3.1 Create a Supabase Project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard) and click **"New project"**
2. Fill in:
   - **Name**: `FeastQR` (or any name you prefer)
   - **Database Password**: Create a strong password — **save this**, you'll need it
   - **Region**: Choose the closest to your target audience
   - **Pricing Plan**: Free tier is fine to start
3. Click **"Create new project"**
4. Wait ~2 minutes for the database to provision

### 3.2 Get Your Supabase Credentials

From your project dashboard:

1. Go to **Project Settings** (gear icon) → **API**
2. Copy these values:
   - **Project URL** (looks like `https://xxxxxxxxxxxxxxxxxxxx.supabase.co`) → This is `NEXT_PUBLIC_SUPABASE_URL`
   - **Project API Keys** → **`anon public`** key → This is `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **`service_role`** key → This is `SUPABASE_SERVICE_KEY`

3. Go to **Project Settings** → **Database**
   - Find **Connection string** → **URI**
   - Select `Mode: Session` (with PgBouncer) — you'll see:
     ```
     postgres://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:6543/postgres?pgbouncer=true
     ```
     This is your `DATABASE_URL`
   - Select `Mode: Direct` (without PgBouncer) — you'll see:
     ```
     postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
     ```
     This is your `DIRECT_URL`

> **⚠️ Important**: Replace `[YOUR-PASSWORD]` with the database password you set in Step 3.1. Replace `[YOUR-PROJECT-REF]` with your project ID (it's the same as the subdomain in your project URL).

### 3.3 Apply Database Migrations

1. Make sure the Supabase CLI is installed:
   ```bash
   # Windows (PowerShell as Admin)
   scoop install supabase
   # OR using npm
   npm install -g supabase
   ```

2. Link your local project to Supabase:
   ```bash
   supabase link --project-ref <YOUR_PROJECT_REF>
   ```
   (Your project ref is the same subdomain as in your Supabase URL)

3. Push the migrations to your Supabase database:
   ```bash
   supabase db push
   ```

   This will apply all migrations from `supabase/migrations/` in order.

### 3.4 Set Up Supabase Auth

1. In Supabase Dashboard → **Authentication** → **Providers**
2. Make sure **Email** provider is enabled
3. Optional: Configure additional providers (Google, GitHub, etc.)

### 3.5 Enable Row Level Security (RLS)

The migrations should already set up RLS, but verify in Supabase Dashboard:
1. Go to **SQL Editor**
2. Run a quick check:
   ```sql
   SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
   ```
   All tables should have `rowsecurity = true`

---

## Step 4: Set Up LemonSqueezy

### 4.1 Create a LemonSqueezy Account

1. Go to [LemonSqueezy](https://lemonsqueezy.com) and sign up
2. Complete your store setup

### 4.2 Create a Subscription Product

1. In LemonSqueezy dashboard → **Products** → **Create Product**
2. Name it: `FeastQR Menu` (or whatever you prefer)
3. Create a **subscription variant** (e.g., monthly at $9.99)
4. After creating, go to the variant and note down:
   - The **Variant ID** from the URL (e.g., `https://app.lemonsqueezy.com/variants/123456` → ID is `123456`) → This is `LEMON_SQUEEZY_SUBSCRIPTION_VARIANT_ID`

### 4.3 Get Your LemonSqueezy API Keys

1. Go to **Settings** → **API Keys**
   - Generate an API key → This is `LEMON_SQUEEZY_API_KEY`
2. Go to **Settings** → **Store**
   - Copy your **Store ID** → This is `LEMON_SQUEEZY_STORE_ID`

### 4.4 Set Up Webhook

1. In LemonSqueezy → **Settings** → **Webhooks**
2. Click **"Create webhook"**
3. **URL**: `https://your-domain.com/payments-api/subscription-updated` (replace with your actual domain, or use `https://your-vercel-url.vercel.app/payments-api/subscription-updated` for staging)
4. **Events to send**: Select all subscription-related events:
   - `subscription_created`
   - `subscription_cancelled`
   - `subscription_resumed`
   - `subscription_expired`
   - `subscription_paused`
   - `subscription_unpaused`
   - `subscription_payment_failed`
   - `subscription_payment_success`
   - `subscription_payment_recovered`
   - `subscription_updated`
   - `order_created`
   - `order_refunded`
5. Copy the **Signing Secret** → This is `LEMONS_SQUEEZY_SIGNATURE_SECRET`

---

## Step 5: Configure Environment Variables

### 5.1 Create `.env` File

Copy the example env file to `.env`:

```bash
cp .env.example .env
```

### 5.2 Fill in the Variables

Open `.env` and fill in:

```env
# ---- SHARED ENVS ------------------------------------------------

NEXT_PUBLIC_UMAMI_WEBSITE_ID=
NEXT_PUBLIC_UMAMI_URL=

LEMON_SQUEEZY_API_KEY=<from Step 4.3>
LEMON_SQUEEZY_STORE_ID=<from Step 4.3>
LEMONS_SQUEEZY_SIGNATURE_SECRET=<from Step 4.4>
LEMON_SQUEEZY_SUBSCRIPTION_VARIANT_ID=<from Step 4.2>

# ---- STAGING ENVS (for production/Vercel deployment) -------------

NEXT_PUBLIC_SUPABASE_URL=https://<YOUR_PROJECT_ID>.supabase.co  <from Step 3.2>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from Step 3.2>
SUPABASE_SERVICE_KEY=<from Step 3.2>
DATABASE_URL="postgres://postgres:<YOUR_PASSWORD>@db.<YOUR_PROJECT_ID>.supabase.co:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres:<YOUR_PASSWORD>@db.<YOUR_PROJECT_ID>.supabase.co:5432/postgres"

# ---- LOCAL ENVS (uncomment these for local development) ----------
# NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
# NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
# SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
# DIRECT_URL="postgresql://postgres:postgres@localhost:54322/postgres"
# DATABASE_URL="postgresql://postgres:postgres@localhost:54322/postgres"
```

> For **local development**, comment out the staging envs and uncomment the local envs. The default local Supabase values are pre-filled in `.env.example`.

---

## Step 6: Run Prisma and Check Typing

```bash
# Regenerate Prisma client
npx prisma generate

# Check types
npx tsc --noEmit
```

---

## Step 7: Run the Development Server

```bash
npm run dev
# or
pnpm dev
```

Your app should now be running at **http://localhost:3000**

---

## Step 8: Deploy to Vercel

### 8.1 Connect Your Repository

1. Go to [Vercel](https://vercel.com) and click **"Add New"** → **"Project"**
2. Import your `FeastQR` repository
3. Framework preset: `Next.js` (auto-detected)

### 8.2 Add Environment Variables

In Vercel project settings → **Environment Variables**, add **all** the variables from your `.env` file:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your anon key |
| `SUPABASE_SERVICE_KEY` | Your service key |
| `DATABASE_URL` | Your database URL (with PgBouncer) |
| `DIRECT_URL` | Your direct database URL |
| `LEMON_SQUEEZY_API_KEY` | Your LemonSqueezy API key |
| `LEMON_SQUEEZY_STORE_ID` | Your store ID |
| `LEMONS_SQUEEZY_SIGNATURE_SECRET` | Your webhook secret |
| `LEMON_SQUEEZY_SUBSCRIPTION_VARIANT_ID` | Your subscription variant ID |

Mark all as **"Production"** and **"Preview"**.

### 8.3 Deploy

Click **"Deploy"**. Vercel will build and deploy your app.

---

## Step 9: Update LemonSqueezy Webhook URL

After deployment, go back to LemonSqueezy webhook settings and update the URL to your production domain:

```
https://your-domain.com/payments-api/subscription-updated
```

---

## Local Development with Supabase (Alternative)

If you want to develop locally with a full Supabase instance:

### Start Local Supabase

```bash
supabase start
```

This will start Docker containers for:
- Postgres database
- Supabase Studio (at http://localhost:54323)
- Auth service
- Storage service
- etc.

### Get Local Credentials

After `supabase start`, it will output the local credentials. They match the pre-filled values in `.env.example`.

### Configure Your `.env`

Comment out staging envs and uncomment local envs in `.env` as shown in Step 5.2.

### Apply Migrations Locally

```bash
supabase db push
```

### Run Prep Script

```bash
npx prisma generate
npx prisma db push
```

### Start Dev Server

```bash
npm run dev
```

---

## Useful Commands

```bash
# Generate Prisma client and sync local database
npm run prepare:local

# Generate Prisma client and sync remote database
npm run prepare:remote

# Create a new migration from schema changes
npm run db:diff <migration_name>

# Open Supabase Studio (local)
supabase studio

# Reset local database
supabase db reset

# Stop local Supabase
supabase stop

# Pull remote DB changes into Prisma
npx prisma db pull
```

---

## Troubleshooting

### "npm install" ERESOLVE errors

If you get peer dependency conflicts (like `@tanstack/react-query` vs `@tanstack/react-query-devtools`), ensure the versions are compatible. See `package.json` — both should use the same major version (e.g., both `^4.x.x`).

### Prisma schema doesn't match database

Run:
```bash
npx prisma generate
npx prisma db pull
```

### "Database connection refused"

- Ensure Supabase is running (for local: `supabase start`)
- Check that your `DATABASE_URL` is correct
- For cloud Supabase, check IP restrictions in Supabase dashboard

### "Invalid Supabase credentials"

Double-check your `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SUPABASE_URL` from Supabase Project Settings → API.

### Webhook returns 400

Verify the `LEMONS_SQUEEZY_SIGNATURE_SECRET` in your env matches exactly what's shown in LemonSqueezy webhook settings.