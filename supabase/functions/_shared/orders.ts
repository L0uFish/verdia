import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

import type {
  InternalOrderStatus,
  InternalPaymentStatus,
} from "./mollie.ts";

const ORDER_STATUS_SELECT = `
  id,
  order_number,
  status,
  payment_status,
  customer_name,
  customer_email,
  customer_phone,
  pickup_note,
  total_amount,
  mollie_payment_id,
  mollie_checkout_url,
  payment_method,
  reservation_expires_at,
  created_at,
  paid_at,
  deleted_at,
  webhook_last_processed_at,
  order_items (
    id,
    order_id,
    product_id,
    product_name,
    product_price,
    image_url,
    created_at
  )
`;

export type OrderStatusRecord = {
  created_at: string;
  customer_email: string;
  customer_name: string;
  customer_phone: string;
  deleted_at: string | null;
  id: string;
  mollie_checkout_url: string | null;
  mollie_payment_id: string | null;
  order_items: Array<{
    created_at: string;
    id: string;
    image_url: string | null;
    order_id: string;
    product_id: string;
    product_name: string;
    product_price: number | string;
  }>;
  order_number: string;
  paid_at: string | null;
  payment_method: string | null;
  payment_status: InternalPaymentStatus;
  pickup_note: string | null;
  reservation_expires_at: string | null;
  status: InternalOrderStatus;
  total_amount: number | string;
  webhook_last_processed_at: string | null;
};

function toErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return fallback;
}

export async function releaseExpiredReservations(supabaseAdmin: SupabaseClient) {
  const { error } = await supabaseAdmin.rpc("release_expired_reservations");

  if (error) {
    throw new Error(toErrorMessage(error, "Reservaties konden niet vrijgegeven worden."));
  }
}

export async function createReservedOrder(
  supabaseAdmin: SupabaseClient,
  input: {
    customerEmail: string;
    customerName: string;
    customerPhone: string;
    customerUserId: string | null;
    pickupNote: string | null;
    productIds: string[];
  },
) {
  const { data, error } = await supabaseAdmin.rpc("create_checkout_order", {
    p_customer_email: input.customerEmail,
    p_customer_name: input.customerName,
    p_customer_phone: input.customerPhone,
    p_customer_user_id: input.customerUserId,
    p_pickup_note: input.pickupNote,
    p_product_ids: input.productIds,
  });

  if (error) {
    throw new Error(toErrorMessage(error, "Bestelling kon niet aangemaakt worden."));
  }

  const createdOrder = Array.isArray(data) ? data[0] : null;

  if (!createdOrder?.order_id || !createdOrder?.order_number) {
    throw new Error("Bestelling kon niet aangemaakt worden.");
  }

  return createdOrder as {
    order_id: string;
    order_number: string;
    reservation_expires_at: string;
    total_amount: number;
  };
}

export async function storeMolliePaymentOnOrder(
  supabaseAdmin: SupabaseClient,
  input: {
    checkoutUrl: string;
    molliePaymentId: string;
    orderId: string;
    paymentMethod: string;
    paymentStatus: InternalPaymentStatus;
  },
) {
  const { error } = await supabaseAdmin
    .from("orders")
    .update({
      mollie_checkout_url: input.checkoutUrl,
      mollie_payment_id: input.molliePaymentId,
      payment_method: input.paymentMethod,
      payment_status: input.paymentStatus,
    })
    .eq("id", input.orderId);

  if (error) {
    throw new Error(toErrorMessage(error, "Mollie-betaling kon niet aan de bestelling gekoppeld worden."));
  }
}

export async function getOrderForStatus(
  supabaseAdmin: SupabaseClient,
  orderId: string,
) {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select(ORDER_STATUS_SELECT)
    .eq("id", orderId)
    .is("deleted_at", null)
    .single();

  if (error) {
    throw new Error(toErrorMessage(error, "Bestelling kon niet opgehaald worden."));
  }

  return data as OrderStatusRecord;
}

export async function getOrderByPaymentId(
  supabaseAdmin: SupabaseClient,
  molliePaymentId: string,
) {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select(ORDER_STATUS_SELECT)
    .eq("mollie_payment_id", molliePaymentId)
    .is("deleted_at", null)
    .single();

  if (error) {
    throw new Error(toErrorMessage(error, "Bestelling bij deze betaling kon niet opgehaald worden."));
  }

  return data as OrderStatusRecord;
}

export async function releaseOrderAsFailedCheckout(
  supabaseAdmin: SupabaseClient,
  orderId: string,
) {
  const { error } = await supabaseAdmin.rpc("cancel_order", {
    p_order_id: orderId,
  });

  if (error) {
    throw new Error(toErrorMessage(error, "Mislukte checkout kon niet worden teruggedraaid."));
  }
}

export async function applyPaymentStatusToOrder(
  supabaseAdmin: SupabaseClient,
  input: {
    orderId: string;
    orderStatus: InternalOrderStatus;
    paymentMethod: string | null;
    paymentStatus: InternalPaymentStatus;
    markInventorySold: boolean;
    paidAt: string | null;
    processedAt: string;
    releaseInventory: boolean;
  },
) {
  const { data, error } = await supabaseAdmin.rpc("apply_order_payment_update", {
    p_mark_inventory_sold: input.markInventorySold,
    p_order_id: input.orderId,
    p_order_status: input.orderStatus,
    p_paid_at: input.paidAt,
    p_payment_method: input.paymentMethod,
    p_payment_status: input.paymentStatus,
    p_release_inventory: input.releaseInventory,
    p_webhook_processed_at: input.processedAt,
  });

  if (error) {
    throw new Error(toErrorMessage(error, "Bestelstatus kon niet bijgewerkt worden."));
  }

  return Array.isArray(data) ? data[0] : null;
}
