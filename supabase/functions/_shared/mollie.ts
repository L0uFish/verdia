import {
  MOLLIE_API_BASE_URL,
  MOLLIE_API_KEY,
  SITE_URL,
  SUPABASE_URL,
} from "./env.ts";

export const CHECKOUT_METHOD_LABELS = {
  applepay: "Apple Pay",
  bancontact: "Bancontact",
  mastercard: "Mastercard",
  visa: "Visa",
} as const;

export type CheckoutMethod = keyof typeof CHECKOUT_METHOD_LABELS;
export type InternalOrderStatus = "draft" | "reserved" | "paid" | "cancelled" | "expired" | "fulfilled";
export type InternalPaymentStatus = "open" | "paid" | "failed" | "expired" | "cancelled" | "pending";

type MollieStatus = "open" | "paid" | "failed" | "expired" | "canceled" | "pending" | "authorized";

export type PaymentStatusMapping = {
  markInventorySold: boolean;
  orderStatus: InternalOrderStatus;
  paymentStatus: InternalPaymentStatus;
  releaseInventory: boolean;
};

export type MolliePayment = {
  _links?: {
    checkout?: {
      href?: string;
    };
  };
  id: string;
  method?: string | null;
  metadata?: Record<string, unknown> | null;
  paidAt?: string | null;
  status: MollieStatus;
};

const mollieMethodByCheckoutMethod: Record<CheckoutMethod, string> = {
  applepay: "applepay",
  bancontact: "bancontact",
  mastercard: "creditcard",
  visa: "creditcard",
};

function buildMollieHeaders() {
  return {
    Authorization: `Bearer ${MOLLIE_API_KEY}`,
    "Content-Type": "application/json",
  };
}

async function mollieRequest<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${MOLLIE_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...buildMollieHeaders(),
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mollie fout (${response.status}): ${errorText || "onbekende fout"}`);
  }

  return response.json() as Promise<T>;
}

export function normalizeCheckoutMethod(method: string): CheckoutMethod {
  if (method in CHECKOUT_METHOD_LABELS) {
    return method as CheckoutMethod;
  }

  return "bancontact";
}

export function mapMollieStatus(status: string): PaymentStatusMapping {
  switch (status) {
    case "paid":
      return {
        markInventorySold: true,
        orderStatus: "paid",
        paymentStatus: "paid",
        releaseInventory: false,
      };
    case "failed":
      return {
        markInventorySold: false,
        orderStatus: "cancelled",
        paymentStatus: "failed",
        releaseInventory: true,
      };
    case "expired":
      return {
        markInventorySold: false,
        orderStatus: "expired",
        paymentStatus: "expired",
        releaseInventory: true,
      };
    case "canceled":
      return {
        markInventorySold: false,
        orderStatus: "cancelled",
        paymentStatus: "cancelled",
        releaseInventory: true,
      };
    case "pending":
    case "authorized":
      return {
        markInventorySold: false,
        orderStatus: "reserved",
        paymentStatus: "pending",
        releaseInventory: false,
      };
    case "open":
    default:
      return {
        markInventorySold: false,
        orderStatus: "reserved",
        paymentStatus: "open",
        releaseInventory: false,
      };
  }
}

export function getCheckoutRedirectUrl() {
  return `${SITE_URL}?payment=success`;
}

export function getCancelRedirectUrl() {
  return `${SITE_URL}?payment=cancelled`;
}

export function getWebhookUrl() {
  return `${SUPABASE_URL}/functions/v1/mollie-webhook`;
}

export function formatMollieAmount(value: number) {
  return Number(value || 0).toFixed(2);
}

export async function createMolliePayment(input: {
  amount: number;
  checkoutMethod: CheckoutMethod;
  customerEmail: string;
  customerName: string;
  orderId: string;
  orderNumber: string;
  productIds: string[];
}) {
  const payload = {
    amount: {
      currency: "EUR",
      value: formatMollieAmount(input.amount),
    },
    billingAddress: {
      email: input.customerEmail,
    },
    cancelUrl: getCancelRedirectUrl(),
    description: `Verdia bestelling ${input.orderNumber}`,
    locale: "nl_NL",
    metadata: {
      order_id: input.orderId,
      order_number: input.orderNumber,
      product_ids: input.productIds,
      requested_method: input.checkoutMethod,
    },
    method: mollieMethodByCheckoutMethod[input.checkoutMethod],
    redirectUrl: getCheckoutRedirectUrl(),
    webhookUrl: getWebhookUrl(),
  };

  return mollieRequest<MolliePayment>("/payments", {
    body: JSON.stringify(payload),
    method: "POST",
  });
}

export async function fetchMolliePayment(paymentId: string) {
  return mollieRequest<MolliePayment>(`/payments/${paymentId}`, {
    method: "GET",
  });
}
