interface RazorpayCheckoutOptions {
  razorpayKeyId: string;
  subscriptionId: string;
  userEmail: string;
  userName: string;
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
}

interface RazorpayInstance {
  open: () => void;
}

interface RazorpayConstructor {
  new (options: Record<string, unknown>): RazorpayInstance;
}

export const openRazorpayCheckout = (
  options: RazorpayCheckoutOptions,
): Promise<{ razorpayPaymentId: string; razorpaySubscriptionId: string }> => {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");

    script.src = "https://checkout.razorpay.com/v1/checkout.js";

    script.onload = () => {
      const RazorpayConstructor = (window as unknown as { Razorpay?: RazorpayConstructor }).Razorpay;

      if (!RazorpayConstructor) {
        reject(new Error("Razorpay SDK not loaded"));

        return;
      }

      const rzp = new RazorpayConstructor({
        key: options.razorpayKeyId,
        subscription_id: options.subscriptionId,
        name: "FeastQR Menu",
        description: "Premium Subscription",
        prefill: {
          name: options.userName,
          email: options.userEmail,
        },
        handler: (response: unknown) => {
          const rzpResponse = response as RazorpayResponse;

          resolve({
            razorpayPaymentId: rzpResponse.razorpay_payment_id,
            razorpaySubscriptionId: rzpResponse.razorpay_subscription_id,
          });
        },
        modal: {
          ondismiss: () => {
            reject(new Error("Payment cancelled"));
          },
        },
      });

      rzp.open();
    };

    script.onerror = () => {
      reject(new Error("Failed to load Razorpay SDK"));
    };

    document.body.appendChild(script);
  });
};
