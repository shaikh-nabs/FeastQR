import { api } from "~/trpc/react";

// Number of days a user keeps access after a failed renewal payment before
// they are treated as unsubscribed. Razorpay retries during this window; if it
// still cannot charge, the subscription eventually expires via webhook.
export const GRACE_PERIOD_DAYS = 7;

type SubscriptionLike = {
  status?: string | null;
  renewsAt?: string | Date | null;
  endsAt?: string | Date | null;
};

const toTime = (value?: string | Date | null): number | null => {
  if (!value) return null;
  const time = new Date(value).getTime();

  return Number.isNaN(time) ? null : time;
};

/**
 * Coarse, status-only check. Kept for places that only have a status string.
 * Prefer `isSubscriptionActive` where the full subscription row is available,
 * as it also enforces the grace period and cancellation end date.
 */
export const checkIfSubscribed = (status?: string | null) => {
  return (
    status === "active" ||
    status === "cancelled" ||
    status === "on_trial" ||
    status === "past_due"
  );
};

/**
 * Authoritative subscription gate. Considers status AND the relevant dates:
 * - active / on_trial          -> subscribed
 * - cancelled (at cycle end)   -> subscribed until `endsAt`
 * - past_due (payment failed)  -> subscribed only within the grace window
 * - expired / paused / other   -> not subscribed
 */
export const isSubscriptionActive = (
  subscription?: SubscriptionLike | null,
): boolean => {
  const status = subscription?.status;

  if (!status) return false;

  if (status === "active" || status === "on_trial") return true;

  if (status === "cancelled") {
    const endsAt = toTime(subscription?.endsAt);

    // Keep access until the paid period ends. If we don't know the end date,
    // err on the side of keeping access (a cancel webhook will expire it).
    return endsAt === null || endsAt > Date.now();
  }

  if (status === "past_due") {
    const renewsAt = toTime(subscription?.renewsAt);

    if (renewsAt === null) return false;

    return Date.now() < renewsAt + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;
  }

  return false;
};

export const useUserSubscription = (options?: {
  // While set, poll the subscription info at this interval (ms). Used to wait
  // for the Razorpay webhook to activate a just-created subscription.
  refetchInterval?: number | false;
}) => {
  const { data, isLoading } = api.payments.getSubscriptionInfo.useQuery(
    undefined,
    {
      refetchInterval: options?.refetchInterval ?? false,
    },
  );
  const isSubscribed = isSubscriptionActive(data);

  return {
    subscriptionData: data,
    isSubscriptionLoading: isLoading,
    isSubscribed,
  };
};
