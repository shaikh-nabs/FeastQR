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
    case "halted":
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
  try {
    const text = await request.text();
    const signature = request.headers.get("x-razorpay-signature") as string;

    const expectedSignature = crypto
      .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
      .update(text)
      .digest("hex");

    const isValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, "utf8"),
      Buffer.from(signature, "utf8"),
    );

    if (!isValid) {
      return new Response("Invalid signature.", {
        status: 400,
      });
    }

    const payload = JSON.parse(text) as RazorpayWebhookPayload;
    const { event } = payload;
    const subscriptionEntity = payload.payload?.subscription?.entity;

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

    switch (event) {
      case "subscription.activated":
      case "subscription.started":
      case "subscription.cancelled":
      case "subscription.resumed":
      case "subscription.completed":
      case "subscription.expired":
      case "subscription.paused":
      case "subscription.halted": {
        // Check if this subscription replaces an old one (payment method update)
        const replacesSubscriptionId =
          customData?.replacesSubscriptionId;

        if (
          replacesSubscriptionId &&
          (event === "subscription.activated" ||
            event === "subscription.started")
        ) {
          // Cancel the old subscription
          const tempRazorpay = new Razorpay({
            key_id: env.RAZORPAY_KEY_ID,
            key_secret: env.RAZORPAY_KEY_SECRET,
          });
          await tempRazorpay.subscriptions
            .cancel(replacesSubscriptionId, true)
            .catch(() => {
              // Old subscription may already be cancelled
            });
        }

        // eslint-disable-next-line padding-line-between-statements
        const { error } = await supabase().from("subscriptions").upsert(
          {
            profile_id: userId,
            razorpay_subscription_id: subscriptionEntity.id,
            renews_at: new Date(
              (subscriptionEntity.current_end ?? subscriptionEntity.charge_at) * 1000,
            ).toISOString(),
            ends_at: subscriptionEntity.ended_at
              ? new Date(subscriptionEntity.ended_at * 1000).toISOString()
              : null,
            status,
            json_data: JSON.stringify(subscriptionEntity, null, 5),
          },
          {
            onConflict: "profile_id",
          },
        );

        // eslint-disable-next-line padding-line-between-statements
        if (error) console.error(JSON.stringify(error));
        break;
      }
      case "subscription.charged": {
        // Recurring payment successfully charged
        // eslint-disable-next-line padding-line-between-statements
        const { error } = await supabase()
          .from("subscriptions")
          .update({
            status: "active",
            json_data: JSON.stringify(subscriptionEntity, null, 5),
          })
          .eq("razorpay_subscription_id", subscriptionEntity.id);

        // eslint-disable-next-line padding-line-between-statements
        if (error) console.error(JSON.stringify(error));
        break;
      }
      default: {
        throw new Error(`🤷‍♀️ Unhandled event: ${event ?? ""}`);
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
