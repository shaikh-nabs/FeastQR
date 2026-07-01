"use client";
/* eslint-disable padding-line-between-statements */

import * as React from "react";
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

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button, buttonVariants } from "~/components/ui/button";
import { Icons } from "~/components/Icons";
import { format } from "date-fns";
import { api } from "~/trpc/react";
import { useUserSubscription } from "~/shared/hooks/useUserSubscription";
import { useToast } from "~/components/ui/use-toast";
import { cn } from "~/utils/cn";
import { openRazorpayCheckout } from "~/utils/payments";
import { Skeleton } from "~/components/ui/skeleton";
import { useTranslation } from "react-i18next";

const CancelButton = () => {
  const { t } = useTranslation();
  const utils = api.useContext();

  const { isSubscribed, isSubscriptionLoading, subscriptionData } =
    useUserSubscription();
  const { toast } = useToast();
  const {
    mutateAsync: cancelSubscription,
    isLoading: isCancelSubscriptionLoading,
  } = api.payments.cancelSubscription.useMutation({
    onSuccess: () => {
      utils.payments.invalidate();
      toast({
        title: t("notifications.subscriptionCancelled"),
        description: t("notifications.subscriptionCancelledDescription"),
        variant: "default",
      });
    },
  });

  return isSubscribed && subscriptionData?.status !== "cancelled" ? (
    <>
      <AlertDialog>
        <AlertDialogTrigger
          disabled={isSubscriptionLoading || isCancelSubscriptionLoading}
        >
          <Button>{t("billing.cancel")}</Button>
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
            <AlertDialogAction onClick={() => void cancelSubscription()}>
              {t("billing.continue")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  ) : (
    <></>
  );
};

export function BillingForm() {
  const { t } = useTranslation();

  const { isSubscribed, isSubscriptionLoading, subscriptionData } =
    useUserSubscription();

  const { mutateAsync: createCheckout, isLoading: isCreatePremiumCheckoutLoading } =
    api.payments.createPremiumCheckout.useMutation();

  const { mutateAsync: getUpdatePaymentCheckout, isLoading: isUpdatePaymentLoading } =
    api.payments.getUpdatePaymentMethodCheckout.useMutation();

  const { data: customerPortalUrl } =
    api.payments.getCustomerPortalUrl.useQuery(undefined, {
      enabled: isSubscribed,
    });

  const utils = api.useContext();
  const { toast } = useToast();
  const cancelOrRenewDate = new Date(
    subscriptionData?.endsAt || subscriptionData?.renewsAt || new Date(),
  );

  const isPaymentLoading =
    isCreatePremiumCheckoutLoading || isUpdatePaymentLoading;

  if (isSubscriptionLoading)
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("billing.subscriptionPlan")}</CardTitle>
          <CardDescription>
            <Skeleton className="h-4 w-[250px]" />
          </CardDescription>
        </CardHeader>
        <CardContent>{t("billing.subscriptionDescription")}</CardContent>
        <CardFooter className="flex flex-col items-start space-y-2 md:flex-row md:justify-between md:space-x-0">
          <button className={cn(buttonVariants())} disabled={true}>
            <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
            {isSubscribed ? "Manage Subscription" : "Upgrade to PRO"}
          </button>
        </CardFooter>
      </Card>
    );

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t("billing.subscriptionPlan")}</CardTitle>
          <CardDescription>
            {t("billing.youAreCurrentlyOn.firstPart")}
            <strong>
              {isSubscribed
                ? t("billing.youAreCurrentlyOn.premium")
                : t("billing.youAreCurrentlyOn.free")}
            </strong>
          </CardDescription>
        </CardHeader>
        <CardContent>{t("billing.subscriptionDescription")}</CardContent>
        <CardFooter className="flex flex-col items-start space-y-2 md:flex-row md:justify-between md:space-x-0">
          <div className="flex gap-4">
            {subscriptionData?.status !== "cancelled" && (
              <button
                // eslint-disable-next-line @typescript-eslint/no-misused-promises
                onClick={async () => {
                  const runAction = async () => {
                    if (isSubscribed) {
                      const checkoutData = await getUpdatePaymentCheckout();
                      await openRazorpayCheckout(checkoutData);
                      utils.payments.invalidate();
                      toast({
                        title: "Payment method updated",
                        description:
                          "Your payment method has been updated successfully.",
                        variant: "default",
                      });

                      return;
                    }

                    const checkoutData = await createCheckout({
                      language: "en",
                    });

                    if (checkoutData) {
                      await openRazorpayCheckout(checkoutData);
                      utils.payments.invalidate();
                    } else {
                      toast({
                        title: "Error",
                        description: t("notifications.somethingWentWrong"),
                        variant: "destructive",
                      });
                    }
                  };

                  await runAction();
                }}
                className={cn(buttonVariants())}
                disabled={isPaymentLoading}
              >
                {isPaymentLoading ? (
                  <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {isSubscribed ? "Update payment details" : "Upgrade to PRO"}
              </button>
            )}
            <CancelButton />
          </div>
          {isSubscribed ? (
            <p className="rounded-full text-xs font-medium">
              {subscriptionData?.endsAt
                ? "Your plan will be canceled on "
                : "Your plan renews on "}
              {format(new Date(cancelOrRenewDate), "dd MMMM yyyy")}.
            </p>
          ) : null}
        </CardFooter>
      </Card>
      {isSubscribed && customerPortalUrl && (
        <Card>
          <CardHeader>
            <CardTitle>{t("billing.description")}</CardTitle>
            <CardDescription>
              {t("billing.customerPortal.goTo")}
            </CardDescription>
          </CardHeader>
          <CardContent>{t("billing.customerPortal.description")}</CardContent>
          <CardFooter className="flex flex-col items-start space-y-2 md:flex-row md:justify-between md:space-x-0">
            <div className="flex gap-4">
              <a href={customerPortalUrl} target="_blank">
                <Button className="flex gap-2">
                  {t("billing.customerPortal.title")}
                  <Icons.external size={16} />
                </Button>
              </a>
            </div>
          </CardFooter>
        </Card>
      )}
    </>
  );
}
