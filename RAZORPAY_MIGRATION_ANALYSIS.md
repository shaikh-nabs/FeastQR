# Razorpay Migration Analysis: Replacing LemonSqueezy

## Overview

This document analyzes the effort required to replace **LemonSqueezy** with **Razorpay** as the payment provider in FeastQR. The current LemonSqueezy integration handles subscription-based payments for restaurant menu access.

---

## Current LemonSqueezy Integration (What Exists)

The existing payment integration consists of **3 main components**:

| # | File | Purpose | Lines |
|---|------|---------|-------|
| 1 | `src/server/api/routers/payments.ts` | TRPC router: create checkout, cancel subscription, get customer portal URL | ~163 |
| 2 | `src/app/payments-api/subscription-updated/route.ts` | Webhook handler for subscription lifecycle events | ~129 |
| 3 | `src/utils/payments.ts` | Client-side utility to open LemonSqueezy popup | ~10 |

**Database table** (`subscriptions`):
- `profile_id` (PK), `update_payment_url`, `renews_at`, `ends_at`, `status`, `created_at`, `lemon_squeezy_id`, `json_data`

**Environment variables** used:
- `LEMON_SQUEEZY_API_KEY`
- `LEMON_SQUEEZY_STORE_ID`
- `LEMONS_SQUEEZY_SIGNATURE_SECRET`
- `LEMON_SQUEEZY_SUBSCRIPTION_VARIANT_ID`

---

## Effort Estimate: **Medium (4–6 days for a single developer)**

### Breakdown by Phase

---

### Phase 1: Setup & Configuration (0.5 day)

**Steps:**
1. Create a Razorpay account at [razorpay.com](https://razorpay.com)
2. Complete KYC verification (requires Indian business documents: PAN, GST, bank account)
3. Create a subscription plan in Razorpay Dashboard
4. Generate API keys (Key ID & Key Secret)
5. Install Razorpay SDK:
   ```bash
   npm install razorpay
   ```

**Complexity:** Low
**Blockers:** Razorpay requires Indian business registration. If you're outside India, you cannot use Razorpay.

---

### Phase 2: Backend TRPC Router Rewrite (`payments.ts`) — 1.5 days

**What needs to change:**

| Function | LemonSqueezy Implementation | Razorpay Equivalent |
|----------|---------------------------|---------------------|
| `createPremiumCheckout` | `client.createCheckout()` → returns a checkout URL | `razorpay.subscriptions.create()` → create a subscription + `razorpay.orders.create()` → generate payment link/checkout |
| `cancelSubscription` | `client.updateSubscription({ cancelled: true })` | `razorpay.subscriptions.cancel(subscriptionId)` |
| `getSubscriptionInfo` | Reads from local DB | Reads from local DB (mostly same) |
| `getCustomerPortalUrl` | LemonSqueezy provides `urls.customer_portal` on subscription | **Razorpay does NOT have a built-in customer portal.** You must build one yourself or create a UI for managing plans, cancellations, and payment methods. |

**Key Differences:**
- LemonSqueezy's `lemonsqueezy.ts` SDK provides `createCheckout` with product options, redirect URLs, and embedded checkout — all in one call
- Razorpay requires separate API calls for subscription creation and order initiation
- LemonSqueezy's customer portal is a hosted page — Razorpay has no equivalent; you'd need to build a custom subscription management page
- Razorpay uses `razorpay` npm package (server-side), not `lemonsqueezy.ts`

---

### Phase 3: Webhook Handler Rewrite (`subscription-updated/route.ts`) — 1 day

**What needs to change:**

| Aspect | LemonSqueezy | Razorpay |
|--------|-------------|----------|
| Webhook events | Single endpoint handles ~12 event types (subscription_created, cancelled, etc.) | Multi-endpoint recommended: `payments-api/razorpay/` — handles `subscription.charged`, `subscription.cancelled`, `subscription.paused`, `subscription.resumed`, `subscription.completed`, `payment.failed` |
| Signature verification | HMAC-SHA256 using `LEMONS_SQUEEZY_SIGNATURE_SECRET` | HMAC-SHA256 using Razorpay webhook secret (different format) |
| Webhook payload | Wraps subscription data with `meta.event_name` and `meta.custom_data` | Different JSON structure with `payload.subscription.entity` |
| Webhook setup | Register URL at LemonSqueezy dashboard | Register URL at Razorpay Dashboard → Webhooks (must enable specific events) |

**Razorpay specific:**
```typescript
// Razorpay webhook verification uses crypto like LemonSqueezy but with a different secret
import crypto from "crypto";
const expectedSignature = crypto
  .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
  .update(JSON.stringify(request.body))
  .digest("hex");
```

---

### Phase 4: Client-Side Payment Flow (`utils/payments.ts` and UI changes) — 1 day

| LemonSqueezy | Razorpay |
|-------------|----------|
| `window.LemonSqueezy.Url.Open(url)` — simple popup | Requires Razorpay checkout modal: load `razorpay` script → create `new Razorpay(options)` → call `open()` |
| No client-side SDK needed | Requires loading `https://checkout.razorpay.com/v1/checkout.js` on the page |
| Checkout handled entirely on LemonSqueezy | Razorpay checkout requires options like `key`, `amount`, `currency`, `name`, `description`, `order_id`, `prefill`, `theme` |
| No callback complexity | Must handle `payment.success`, `payment.failed` callbacks in JS |

**Sample Razorpay checkout integration:**
```typescript
// In src/utils/payments.ts — completely new implementation
export const openRazorpayCheckout = (options: {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  prefill: { email: string; contact: string };
}) => {
  return new Promise((resolve, reject) => {
    const rzp = new (window as any).Razorpay({
      ...options,
      handler: (response: any) => resolve(response),
      modal: { ondismiss: () => reject(new Error("Payment cancelled")) },
    });
    rzp.open();
  });
};
```

---

### Phase 5: Database Schema Changes — 0.5 day

The `subscriptions` table needs to be updated to work with Razorpay IDs instead of LemonSqueezy IDs.

**Current schema fields:**
- `lemon_squeezy_id` → rename to `razorpay_subscription_id`
- `update_payment_url` → no Razorpay equivalent (remove or keep as nullable)
- `json_data` → keep, will store Razorpay response data
- May need new fields: `razorpay_order_id`, `razorpay_payment_id`

**Migration SQL:**
```sql
ALTER TABLE subscriptions 
  RENAME COLUMN lemon_squeezy_id TO razorpay_subscription_id;
ALTER TABLE subscriptions 
  ADD COLUMN razorpay_order_id TEXT,
  ADD COLUMN razorpay_payment_id TEXT;
ALTER TABLE subscriptions 
  DROP COLUMN update_payment_url; -- optional, Razorpay has no equivalent
```

---

### Phase 6: Environment Variables & Configuration — 0.25 day

**Remove:**
- `LEMON_SQUEEZY_API_KEY`
- `LEMON_SQUEEZY_STORE_ID`
- `LEMONS_SQUEEZY_SIGNATURE_SECRET`
- `LEMON_SQUEEZY_SUBSCRIPTION_VARIANT_ID`

**Add:**
- `RAZORPAY_KEY_ID` (from Razorpay Dashboard → API Keys)
- `RAZORPAY_KEY_SECRET` (from Razorpay Dashboard → API Keys)
- `RAZORPAY_WEBHOOK_SECRET` (generate in Razorpay Dashboard → Webhooks)
- `RAZORPAY_SUBSCRIPTION_PLAN_ID` (from Razorpay Dashboard → Plans)

---

### Phase 7: Testing — 0.75 day

- Test subscription creation flow (create → redirect → payment → webhook)
- Test cancellation
- Test webhook with various events (create, cancel, fail, renew)
- Test error handling (payment failures, expired cards, insufficient funds)
- Test with Razorpay test mode (key ends with `_test`)
- Verify the subscription status syncs correctly to the database

---

## Total Effort Summary

| Phase | Task | Estimated Time |
|-------|------|---------------|
| 1 | Razorpay account setup & KYC | 0.5 day |
| 2 | Rewrite backend TRPC payment router | 1.5 days |
| 3 | Rewrite webhook handler | 1 day |
| 4 | Rewrite client-side payment flow | 1 day |
| 5 | Database schema migration | 0.5 day |
| 6 | Environment variables & config | 0.25 day |
| 7 | Testing | 0.75 day |
| **Total** | | **~4.5–6 days** |

---

## Files That Need Modification

| File | Action |
|------|--------|
| `src/server/api/routers/payments.ts` | **Rewrite** — replace `LemonsqueezyClient` with `Razorpay` |
| `src/app/payments-api/subscription-updated/route.ts` | **Rewrite** — replace webhook handler logic |
| `src/utils/payments.ts` | **Rewrite** — replace `openLemonSqueezy` with `openRazorpayCheckout` |
| `prisma/schema.prisma` | **Modify** — update `Subscriptions` model (rename field, add new fields) |
| `.env.example` | **Modify** — replace LemonSqueezy env vars with Razorpay env vars |
| `package.json` | **Modify** — remove `lemonsqueezy.ts`, add `razorpay` |
| UI components (checkout button, subscription page) | **Modify** — update how they call the payment flow |

---

## Important Considerations

### ✅ Advantages of Razorpay
- **Indian payment methods**: UPI, RuPay cards, Net Banking, wallets (Paytm, PhonePe, etc.)
- **Recurring payments**: Strong subscription API with retry logic
- **Lower fees**: ~2% for cards, ~1.5% for UPI vs LemonSqueezy's ~5% + $0.50
- **Indian bank settlements**: Direct settlement to Indian bank accounts
- **RazorpayX**: Integrated neobanking for payouts if needed

### ⚠️ Disadvantages / Challenges
- **Indian-only**: Razorpay requires Indian business registration (PAN, GST, bank account). Not usable for non-Indian entities.
- **No built-in tax compliance**: LemonSqueezy automatically handles global VAT/GST — with Razorpay you must handle taxes yourself
- **No customer portal**: You must build the subscription management UI yourself (update card, change plan, view invoices)
- **No hosted checkout page**: LemonSqueezy provides a beautiful hosted checkout — with Razorpay you either use their modal (which is less customizable) or build your own page
- **Subscription management complexity**: Razorpay subscriptions require more manual handling (e.g., adding `offer_id`, handling `auth_attempts`, managing `payment_methods`)
- **International customers**: Razorpay is designed for INR payments — international card payments have higher fees (~3.5%)

### 🎯 Recommendation
**If your target market is India:** Migrate to Razorpay. It's worth the effort for better Indian payment support and lower fees.

**If your target market is global or outside India:** Keep LemonSqueezy. It handles tax compliance (VAT/GST) automatically and provides a simpler, hosted subscription management experience that would take much longer to replicate.

**Hybrid approach (highest effort, ~8–10 days):** Keep both LemonSqueezy and Razorpay, letting users choose. This requires abstracting the payment layer, maintaining two webhook endpoints, and duplicating subscription logic.