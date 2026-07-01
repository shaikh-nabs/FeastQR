# Razorpay Payment Setup

This guide covers everything needed to complete the Razorpay subscription payment
integration (migrated from LemonSqueezy).

## Overview of what changed

The app was switched **from LemonSqueezy → Razorpay** for subscription payments.

| Area       | File | Change |
|------------|------|--------|
| Package    | `package.json` | Removed `lemonsqueezy.ts`, added `razorpay@^2.9.6` |
| Server API | `src/server/api/routers/payments.ts` | Creates / cancels Razorpay subscriptions; creates "replacement" subscriptions for payment-method updates |
| Checkout   | `src/utils/payments.ts` | Loads Razorpay `checkout.js` and opens the modal client-side |
| Webhook    | `src/app/payments-api/subscription-updated/route.ts` | Verifies `x-razorpay-signature`, upserts subscription status |
| DB schema  | `prisma/schema.prisma` | Dropped `lemon_squeezy_id` + `update_payment_url`; added `razorpay_subscription_id`, `razorpay_order_id`, `razorpay_payment_id` |
| UI         | `src/pageComponents/Billing/molecules/BillingForm.tsx`, `src/app/(authenticatedRoutes)/dashboard/billing/portal/page.tsx` | Upgrade / manage / cancel UI |

---

## Step 1 — Environment variables

Add these 4 variables to your `.env`. They are declared as **required** in
`src/env.mjs`, so the app will not build without them.

```env
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
RAZORPAY_SUBSCRIPTION_PLAN_ID=plan_xxxxxxxxxxxxx
```

Where each value comes from in the **Razorpay Dashboard** (https://dashboard.razorpay.com):

- **`RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`** → Settings → API Keys → Generate Key.
  Start with **Test Mode** keys (`rzp_test_…`).
- **`RAZORPAY_SUBSCRIPTION_PLAN_ID`** → Subscriptions → Plans → Create Plan.
  Copy the `plan_...` id.
  > ⚠️ The code hardcodes `total_count: 12` in `payments.ts`, so use a **monthly**
  > plan to give a 12-month subscription.
- **`RAZORPAY_WEBHOOK_SECRET`** → you invent this string when creating the webhook
  (Step 3), then paste the same value here.

---

## Step 2 — Database migration (⚠️ required — currently missing)

The Prisma schema and `supabaseTypes.ts` were updated, but **no SQL migration was
created**. The real DB table still has the old LemonSqueezy columns, so webhook
inserts will fail until this is applied.

Create a new Supabase migration (e.g. `supabase/migrations/<timestamp>_razorpay-columns.sql`)
with:

```sql
alter table "public"."subscriptions" drop column "lemon_squeezy_id";
alter table "public"."subscriptions" drop column "update_payment_url";
alter table "public"."subscriptions" add column "razorpay_subscription_id" text not null;
alter table "public"."subscriptions" add column "razorpay_order_id" text;
alter table "public"."subscriptions" add column "razorpay_payment_id" text;
```

Then apply it (Supabase CLI):

```bash
supabase db push
# or, if using migrations locally:
supabase migration up
```

---

## Step 3 — Configure the Razorpay webhook

The webhook endpoint is `POST /payments-api/subscription-updated`.

In the dashboard: **Settings → Webhooks → Add New Webhook**

1. **URL:** `https://your-domain.com/payments-api/subscription-updated`
   - For local testing, expose your dev server with a tunnel (e.g. `ngrok http 3000`)
     and use the tunnel URL.

   <!-- TEMPORARY DEV ONLY — inspect payloads, does NOT update the app/DB.
        Swap back to the real endpoint above once you have a tunnel/deploy.
   URL: https://webhook.site/5103aa68-4347-4763-8ff8-c318dd1a64aa
   -->

   > ⚠️ **webhook.site is an inspector only.** Using
   > `https://webhook.site/5103aa68-4347-4763-8ff8-c318dd1a64aa` lets you *see* the
   > events Razorpay fires and view their JSON, but it does **not** forward anything
   > to your app — so your `subscriptions` table will **not** update and the billing
   > page will **not** flip to Premium. It also can't pass the signature check in
   > `route.ts`. Use it only to confirm events fire / inspect payloads. For the
   > actual flow to work locally you still need a tunnel or a deployed URL.
2. **Secret:** set a value, and put the **same** value in `RAZORPAY_WEBHOOK_SECRET`.
3. **Active events** (all handled in the code):
   - `subscription.activated`
   - `subscription.started`
   - `subscription.charged`
   - `subscription.cancelled`
   - `subscription.resumed`
   - `subscription.completed`
   - `subscription.expired`
   - `subscription.paused`
   - `subscription.halted`

---

## Step 4 — Install, generate, run, and test

```bash
npm install                 # picks up razorpay, drops lemonsqueezy
npx prisma generate         # regenerate client for new columns
# apply the DB migration from Step 2 (supabase db push)
npm run dev
```

**Manual test flow:**

1. Go to `/dashboard/billing`.
2. Click **Upgrade to PRO** → Razorpay modal opens.
3. Pay with a Razorpay [test card](https://razorpay.com/docs/payments/payments/test-card-details/).
4. Confirm the webhook fires and a row appears in the `subscriptions` table with
   `status = active`.
5. Verify the billing page now shows **Premium** and the `/dashboard/billing/portal`
   page shows subscription status + renewal date.
6. Test **Cancel Subscription** and **Update Payment Method** from the portal.

---

## Known gaps / notes

- **DB migration is not committed** (Step 2) — must-fix, or the flow breaks at runtime.
- `userName` is set to the user's email in `payments.ts` — the checkout modal will
  prefill the email as the name (cosmetic).
- The webhook stores `razorpay_subscription_id` but never populates
  `razorpay_order_id` / `razorpay_payment_id` (they stay `null`) — fine unless needed.

---

## Go-live checklist

- [ ] Swap Test Mode keys for **Live** keys (`rzp_live_…`).
- [ ] Create a **Live** plan and update `RAZORPAY_SUBSCRIPTION_PLAN_ID`.
- [ ] Point the webhook to the production URL with the production secret.
- [ ] Confirm production `.env` has all 4 Razorpay variables.
- [ ] Run one real (or live-test) end-to-end subscription.
