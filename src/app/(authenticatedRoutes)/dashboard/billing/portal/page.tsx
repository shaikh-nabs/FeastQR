"use client";
/* eslint-disable padding-line-between-statements */

import { useUserSubscription } from "~/shared/hooks/useUserSubscription";
import { useTranslation } from "react-i18next";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Icons } from "~/components/Icons";
import { Skeleton } from "~/components/ui/skeleton";
import { openRazorpayCheckout } from "~/utils/payments";
import { useToast } from "~/components/ui/use-toast";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import Link from "next/link";

const getRenewalText = (
  renewsAt?: string | Date | null,
  endsAt?: string | Date | null,
) => {
  if (renewsAt) {
    return format(new Date(renewsAt), "dd MMMM yyyy");
  }

  if (endsAt) {
    return `Cancels on ${format(new Date(endsAt), "dd MMMM yyyy")}`;
  }

  return "N/A";
};

const CustomerPortalPage = () => {
  const { t } = useTranslation();
  const { isSubscribed, isSubscriptionLoading, subscriptionData } =
    useUserSubscription();
  const utils = api.useContext();
  const { toast } = useToast();

  const { mutateAsync: getUpdatePaymentCheckout, isLoading: isUpdatePaymentLoading } =
    api.payments.getUpdatePaymentMethodCheckout.useMutation();

  const { mutateAsync: cancelSubscription, isLoading: isCancelSubscriptionLoading } =
    api.payments.cancelSubscription.useMutation({
      onSuccess: () => {
        utils.payments.invalidate();
        toast({
          title: t("notifications.subscriptionCancelled"),
          description: t("notifications.subscriptionCancelledDescription"),
          variant: "default",
        });
      },
    });

  if (isSubscriptionLoading) {
    return (
      <div className="flex w-full flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Subscription Portal</CardTitle>
            <CardDescription>
              <Skeleton className="h-4 w-[250px]" />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isSubscribed) {
    return (
      <div className="flex w-full flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Subscription Portal</CardTitle>
            <CardDescription>
              You don&apos;t have an active subscription.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Upgrade to a premium plan to access the subscription portal.
            </p>
          </CardContent>
          <CardFooter>
            <Link href="/dashboard/billing">
              <Button>View Plans</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Subscription Portal</CardTitle>
          <CardDescription>
            Manage your subscription and payment methods.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">Subscription Status</h3>
            <p className="mt-1 text-sm capitalize text-muted-foreground">
              {subscriptionData?.status ?? "Unknown"}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">Renewal Date</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {getRenewalText(
                subscriptionData?.renewsAt,
                subscriptionData?.endsAt,
              )}
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex gap-4">
          <Button
            disabled={isUpdatePaymentLoading}
            onClick={async () => {
              try {
                // eslint-disable-next-line padding-line-between-statements
                const checkoutData = await getUpdatePaymentCheckout();
                await openRazorpayCheckout(checkoutData);
                utils.payments.invalidate();
                toast({
                  title: "Payment method updated",
                  description:
                    "Your payment method has been updated successfully.",
                  variant: "default",
                });

              } catch {
                toast({
                  title: "Error",
                  description: "Failed to update payment method.",
                  variant: "destructive",
                });
              }
            }}
          >
            {isUpdatePaymentLoading ? (
              <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Icons.billing className="mr-2 h-4 w-4" />
            )}
            Update Payment Method
          </Button>
          {subscriptionData?.status !== "cancelled" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  disabled={isCancelSubscriptionLoading}
                >
                  {isCancelSubscriptionLoading ? (
                    <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Cancel Subscription
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t("billing.areYouSureYouWantToCancelSubscription")}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("billing.sadToSeeYouGo")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("billing.cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => void cancelSubscription()}
                  >
                    {t("billing.continue")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </CardFooter>
      </Card>
    </div>
  );
};

export default CustomerPortalPage;
