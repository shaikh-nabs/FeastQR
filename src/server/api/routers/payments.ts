import { createTRPCRouter, privateProcedure } from "~/server/api/trpc";
import Razorpay from "razorpay";
import { env } from "~/env.mjs";
import { TRPCError } from "@trpc/server";
import { isSubscriptionActive } from "~/shared/hooks/useUserSubscription";
import { z } from "zod";

const razorpay = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID,
  key_secret: env.RAZORPAY_KEY_SECRET,
});

const createPremiumCheckoutSchema = z.object({
  language: z.enum(["en", "pl"]),
});

export const paymentsRouter = createTRPCRouter({
  createPremiumCheckout: privateProcedure
    .input(createPremiumCheckoutSchema)
    .mutation(async ({ ctx }) => {
      // Prevent a user who already has an active subscription from creating a
      // second one (which would result in a duplicate recurring charge).
      const existingSubscription = await ctx.db.subscriptions.findFirst({
        where: {
          profileId: ctx.user.id,
        },
      });

      if (isSubscriptionActive(existingSubscription)) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "You already have an active subscription",
        });
      }

      const subscription = await razorpay.subscriptions.create({
        plan_id: env.RAZORPAY_SUBSCRIPTION_PLAN_ID,
        total_count: 12,
        customer_notify: 1,
        notes: {
          userId: ctx.user.id,
        },
      });

      return {
        subscriptionId: subscription.id,
        razorpayKeyId: env.RAZORPAY_KEY_ID,
        userEmail: ctx.user.email || "",
        userName: ctx.user.email || "",
      };
    }),
  cancelSubscription: privateProcedure.mutation(async ({ ctx }) => {
    const subscription = await ctx.db.subscriptions.findFirst({
      where: {
        profileId: ctx.user.id,
      },
    });

    if (
      !subscription ||
      subscription.status === "cancelled" ||
      !isSubscriptionActive(subscription)
    ) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Subscription not found or not active",
      });
    }

    // Cancel at cycle end (Razorpay: true = cancel at cycle end). This throws
    // on API failure; on success the subscription stays "active" until the end
    // of the current period, so we do NOT check the returned status here.
    await razorpay.subscriptions.cancel(
      subscription.razorpaySubscriptionId,
      true,
    );

    // Optimistically reflect the cancellation so the UI updates immediately.
    // The user keeps access until `endsAt`; the webhook will later mark it
    // expired at the end of the period.
    await ctx.db.subscriptions.update({
      where: {
        profileId: ctx.user.id,
      },
      data: {
        status: "cancelled",
        endsAt: subscription.renewsAt,
      },
    });
  }),
  getSubscriptionInfo: privateProcedure.query(async ({ ctx }) => {
    return ctx.db.subscriptions.findFirst({
      where: {
        profileId: ctx.user.id,
      },
      select: {
        endsAt: true,
        renewsAt: true,
        status: true,
      },
    });
  }),
  getCustomerPortalUrl: privateProcedure.query(async ({ ctx }) => {
    const subscription = await ctx.db.subscriptions.findFirst({
      where: {
        profileId: ctx.user.id,
      },
    });

    if (!isSubscriptionActive(subscription)) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Subscription not found or not active",
      });
    }

    return "/dashboard/billing/portal" as string;
  }),
  getUpdatePaymentMethodCheckout: privateProcedure.mutation(async ({ ctx }) => {
    const subscription = await ctx.db.subscriptions.findFirst({
      where: {
        profileId: ctx.user.id,
      },
    });

    if (!subscription || !isSubscriptionActive(subscription)) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Subscription not found or not active",
      });
    }

    // Create a new subscription with same plan for updating payment method.
    // The old subscription will be cancelled in the webhook when the
    // new one becomes active.
    //
    // Start the new subscription's billing at the old subscription's renewal
    // date so the customer is not charged again for the period they already
    // paid for. The new mandate is authorized now, but the first charge only
    // happens when the old subscription would have renewed (no double charge).
    const nextRenewalSeconds = Math.floor(
      new Date(subscription.renewsAt).getTime() / 1000,
    );
    const nowSeconds = Math.floor(Date.now() / 1000);
    const shouldDeferStart = nextRenewalSeconds > nowSeconds;

    const newSubscription = await razorpay.subscriptions.create({
      plan_id: env.RAZORPAY_SUBSCRIPTION_PLAN_ID,
      total_count: 12,
      customer_notify: 0,
      ...(shouldDeferStart ? { start_at: nextRenewalSeconds } : {}),
      notes: {
        userId: ctx.user.id,
        replacesSubscriptionId: subscription.razorpaySubscriptionId,
      },
    });

    return {
      subscriptionId: newSubscription.id,
      razorpayKeyId: env.RAZORPAY_KEY_ID,
      userEmail: ctx.user.email || "",
      userName: ctx.user.email || "",
    };
  }),
});
