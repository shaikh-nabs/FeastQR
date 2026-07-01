/* eslint-disable padding-line-between-statements */
import crypto from "crypto";
import Razorpay from "razorpay";
import { type NextRequest } from "next/server";
import { env } from "~/env.mjs";
import { supabase } from "~/server/supabase/supabaseClient";

type RazorpaySubscriptionStatus =
  | "created"
  | "authenticated"
  | "active"
  | "pending"
  | "halted"
  | "cancelled"
  | "completed"
  | "expired";

// Map Razorpay subscription statuses to our db status strings
const mapStatus = (razorpayStatus: RazorpaySubscriptionStatus): string => {
  switch (razorpayStatus) {
    case "active":
      return "active";
    case "cancelled":
      return "cancelled";
    case "completed":
    case "expired":
      return "expired";
    case "paused" as RazorpaySubscriptionStatus:
      return "paused";
    case "pending":
    case "halted":
      // Payment failed / retrying (pending) or all retries exhausted (halted).
      // Treated as a grace period so the user keeps access while Razorpay retries.
      return "past_due";
    case "created":
    case "authenticated":
      return "on_trial";
    default:
      return razorpayStatus;
  }
};

type RazorpayEvent =
  | "subscription.activated"
  | "subscription.cancelled"
  | "subscription.resumed"
  | "subscription.completed"
  | "subscription.expired"
  | "subscription.paused"
  | "subscription.halted"
  | "subscription.pending"
  | "subscription.started"
  | "subscription.charged";

type RazorpayWebhookPayload = {
  entity: string;
  account_id: string;
  event: RazorpayEvent;
  created_at: number;
  contains: string[];
  payload: {
    subscription?: {
      entity: {
        id: string;
        status: RazorpaySubscriptionStatus;
        notes: Record<string, string>;
        current_start?: number | null;
        current_end?: number | null;
        charge_at: number;
        ended_at?: number | null;
        created_at: number;
        customer_id: string | null;
      };
    };
    payment?: {
      entity: {
        id: string;
        status: string;
        amount: number;
      };
    };
  };
};

const isError = (error: unknown): error is Error => {
  return error instanceof Error;
};

export const runtime = "nodejs";

export const POST = async (request: NextRequest) => {
  console.log("[razorpay-webhook] received request");

  try {
    const text = await request.text();
    const signature = request.headers.get("x-razorpay-signature");

    if (!signature) {
      console.warn("[razorpay-webhook] missing signature header");

      return new Response("Missing signature.", {
        status: 400,
      });
    }

    const expectedSignature = crypto
      .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
      .update(text)
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature, "utf8");
    const signatureBuffer = Buffer.from(signature, "utf8");

    // timingSafeEqual throws if the buffers differ in length, so guard first.
    const isValid =
      expectedBuffer.length === signatureBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, signatureBuffer);

    if (!isValid) {
      console.warn("[razorpay-webhook] invalid signature");

      return new Response("Invalid signature.", {
        status: 400,
      });
    }

    const payload = JSON.parse(text) as RazorpayWebhookPayload;
    const { event } = payload;
    const subscriptionEntity = payload.payload?.subscription?.entity;

    console.log(
      `[razorpay-webhook] hit event=${event ?? "unknown"} subscription=${
        subscriptionEntity?.id ?? "none"
      } status=${subscriptionEntity?.status ?? "none"}`,
    );

    if (!subscriptionEntity) {
      return new Response("No subscription entity in payload.", {
        status: 400,
      });
    }

    const customData = subscriptionEntity.notes;
    const userId = customData?.userId;

    if (!userId) {
      return new Response("No userId in subscription notes.", {
        status: 400,
      });
    }

    const status = mapStatus(subscriptionEntity.status);

    const toIso = (seconds?: number | null): string | null =>
      seconds ? new Date(seconds * 1000).toISOString() : null;

    const endsAt = toIso(subscriptionEntity.ended_at);
    const jsonData = JSON.stringify(subscriptionEntity, null, 5);

    switch (event) {
      // Events that establish this subscription as the current one for the
      // profile. These upsert by profile_id so a brand-new subscription (e.g.
      // after a payment-method update) takes over the row.
      case "subscription.activated":
      case "subscription.started":
      case "subscription.resumed": {
        const replacesSubscriptionId = customData?.replacesSubscriptionId;

        if (replacesSubscriptionId) {
          // A new subscription replaced an old one (payment-method update):
          // cancel the old subscription now that the new one is live.
          const tempRazorpay = new Razorpay({
            key_id: env.RAZORPAY_KEY_ID,
            key_secret: env.RAZORPAY_KEY_SECRET,
          });
          await tempRazorpay.subscriptions
            .cancel(replacesSubscriptionId, true)
            .catch(() => {
              // Old subscription may already be cancelled.
            });
        }

        const renewsAt =
          toIso(subscriptionEntity.current_end ?? subscriptionEntity.charge_at) ??
          new Date().toISOString();

        // eslint-disable-next-line padding-line-between-statements
        const { error } = await supabase().from("subscriptions").upsert(
          {
            profile_id: userId,
            razorpay_subscription_id: subscriptionEntity.id,
            renews_at: renewsAt,
            ends_at: endsAt,
            status,
            json_data: jsonData,
          },
          {
            onConflict: "profile_id",
          },
        );

        // eslint-disable-next-line padding-line-between-statements
        if (error) console.error(JSON.stringify(error));
        break;
      }

      // Recurring payment succeeded: refresh status and the next renewal date.
      // Matched by subscription id so a stale/replaced subscription cannot
      // touch a different row.
      case "subscription.charged": {
        const renewsAt = toIso(subscriptionEntity.current_end);

        // eslint-disable-next-line padding-line-between-statements
        const { error } = await supabase()
          .from("subscriptions")
          .update({
            status: "active",
            ...(renewsAt ? { renews_at: renewsAt } : {}),
            json_data: jsonData,
          })
          .eq("razorpay_subscription_id", subscriptionEntity.id);

        // eslint-disable-next-line padding-line-between-statements
        if (error) console.error(JSON.stringify(error));
        break;
      }

      // Status transitions on an EXISTING subscription. Matched by subscription
      // id (not profile_id) so an old/replaced subscription's terminal events
      // can never overwrite the profile's current subscription row.
      case "subscription.cancelled":
      case "subscription.paused":
      case "subscription.pending":
      case "subscription.halted":
      case "subscription.completed":
      case "subscription.expired": {
        // eslint-disable-next-line padding-line-between-statements
        const { error } = await supabase()
          .from("subscriptions")
          .update({
            status,
            ends_at: endsAt,
            json_data: jsonData,
          })
          .eq("razorpay_subscription_id", subscriptionEntity.id);

        // eslint-disable-next-line padding-line-between-statements
        if (error) console.error(JSON.stringify(error));
        break;
      }

      default: {
        // Acknowledge unhandled events with 200 so Razorpay does not keep
        // retrying the webhook for events we intentionally ignore.
        console.log(`[razorpay-webhook] unhandled event: ${event ?? ""}`);
        break;
      }
    }
  } catch (error: unknown) {
    console.error(JSON.stringify(error));
    if (isError(error)) {
      return new Response(`Webhook error: ${error.message}`, {
        status: 400,
      });
    }

    return new Response("Webhook error", {
      status: 400,
    });
  }

  return new Response(null, {
    status: 200,
  });
};
