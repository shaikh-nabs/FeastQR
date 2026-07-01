import { createTRPCRouter, privateProcedure } from "~/server/api/trpc";
import Razorpay from "razorpay";
import { env } from "~/env.mjs";
import { TRPCError } from "@trpc/server";
import { checkIfSubscribed } from "~/shared/hooks/useUserSubscription";
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

    if (!subscription || subscription.status !== "active") {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Subscription not found or not active",
      });
    }

    // Cancel at cycle end (Razorpay: true = cancel at cycle end)
    const result = await razorpay.subscriptions.cancel(
      subscription.razorpaySubscriptionId,
      true,
    );

    const didCancelSuccessfully = result.status === "cancelled";

    if (!didCancelSuccessfully) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to cancel subscription",
      });
    }
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

    const isSubscribed = checkIfSubscribed(subscription?.status);

    if (!subscription || !isSubscribed) {
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

    if (!subscription || !checkIfSubscribed(subscription?.status)) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Subscription not found or not active",
      });
    }

    // Create a new subscription with same plan for updating payment method.
    // The old subscription will be cancelled in the webhook when the
    // new one becomes active.
    const newSubscription = await razorpay.subscriptions.create({
      plan_id: env.RAZORPAY_SUBSCRIPTION_PLAN_ID,
      total_count: 12,
      customer_notify: 0,
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
