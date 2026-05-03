import { getCorsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
  applyPaymentStatusToOrder,
  createReservedOrder,
  getOrderForStatus,
  releaseExpiredReservations,
  releaseOrderAsFailedCheckout,
  storeMolliePaymentOnOrder,
} from "../_shared/orders.ts";
import {
  createMolliePayment,
  fetchMolliePayment,
  mapMollieStatus,
  normalizeCheckoutMethod,
} from "../_shared/mollie.ts";
import {
  createSupabaseAdminClient,
  createSupabaseRequestClient,
} from "../_shared/supabase.ts";

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptionalText(value: unknown) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function validateEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validatePhone(value: string) {
  return /^[0-9+()\s/-]{7,}$/.test(value);
}

function extractProductIds(cartItems: unknown) {
  if (!Array.isArray(cartItems)) {
    return [];
  }

  return cartItems
    .map((item) => {
      if (!item || typeof item !== "object") {
        return "";
      }

      if (typeof item.id === "string") {
        return item.id;
      }

      if (typeof item.productId === "string") {
        return item.productId;
      }

      return "";
    })
    .filter(Boolean);
}

async function getOptionalCustomerUserId(authorizationHeader: string | null) {
  if (!authorizationHeader) {
    return null;
  }

  const requestClient = createSupabaseRequestClient(authorizationHeader);
  const { data, error } = await requestClient.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  return data.user.id;
}

async function syncOrderWithMollie(supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>, orderId: string) {
  let order = await getOrderForStatus(supabaseAdmin, orderId);

  if (!order.mollie_payment_id) {
    return order;
  }

  if (
    ["paid", "cancelled", "expired", "fulfilled"].includes(order.status)
    && ["paid", "failed", "expired", "cancelled"].includes(order.payment_status)
  ) {
    return order;
  }

  const payment = await fetchMolliePayment(order.mollie_payment_id);
  const paymentMapping = mapMollieStatus(payment.status);

  await applyPaymentStatusToOrder(supabaseAdmin, {
    markInventorySold: paymentMapping.markInventorySold,
    orderId,
    orderStatus: paymentMapping.orderStatus,
    paidAt: payment.paidAt || null,
    paymentMethod: payment.method || order.payment_method || null,
    paymentStatus: paymentMapping.paymentStatus,
    processedAt: new Date().toISOString(),
    releaseInventory: paymentMapping.releaseInventory,
  });

  order = await getOrderForStatus(supabaseAdmin, orderId);
  return order;
}

async function handleStatusLookup(
  req: Request,
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  body: Record<string, unknown>,
) {
  const orderId = normalizeText(body.orderId);

  if (!orderId) {
    throw new HttpError(400, "Order-ID ontbreekt.");
  }

  await releaseExpiredReservations(supabaseAdmin);
  const order = await syncOrderWithMollie(supabaseAdmin, orderId);

  return jsonResponse(
    {
      items: order.order_items.map((item) => ({
        productId: item.product_id,
        productName: item.product_name,
      })),
      orderId: order.id,
      orderNumber: order.order_number,
      orderStatus: order.status,
      paidAt: order.paid_at,
      paymentMethod: order.payment_method,
      paymentStatus: order.payment_status,
      reservationExpiresAt: order.reservation_expires_at,
      totalAmount: Number(order.total_amount || 0),
    },
    { status: 200 },
    req.headers.get("origin"),
  );
}

async function handleCheckoutCreation(
  req: Request,
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  body: Record<string, unknown>,
) {
  const customer = typeof body.customer === "object" && body.customer !== null
    ? body.customer as Record<string, unknown>
    : {};
  const customerName = normalizeText(customer.name);
  const customerEmail = normalizeText(customer.email).toLowerCase();
  const customerPhone = normalizeText(customer.phone);
  const pickupNote = normalizeOptionalText(body.pickupNote ?? customer.pickupNote ?? customer.note);
  const checkoutMethod = normalizeCheckoutMethod(normalizeText(body.paymentMethod));
  const productIds = extractProductIds(body.cartItems);

  if (!customerName) {
    throw new HttpError(400, "Naam is verplicht.");
  }

  if (!validateEmail(customerEmail)) {
    throw new HttpError(400, "Vul een geldig e-mailadres in.");
  }

  if (!validatePhone(customerPhone)) {
    throw new HttpError(400, "Vul een geldig telefoonnummer in.");
  }

  if (!productIds.length) {
    throw new HttpError(400, "Je mandje is leeg.");
  }

  const customerUserId = await getOptionalCustomerUserId(req.headers.get("authorization"));

  await releaseExpiredReservations(supabaseAdmin);

  const createdOrder = await createReservedOrder(supabaseAdmin, {
    customerEmail,
    customerName,
    customerPhone,
    customerUserId,
    pickupNote,
    productIds,
  });

  try {
    const molliePayment = await createMolliePayment({
      amount: Number(createdOrder.total_amount || 0),
      checkoutMethod,
      customerEmail,
      customerName,
      orderId: createdOrder.order_id,
      orderNumber: createdOrder.order_number,
      productIds,
    });
    const checkoutUrl = molliePayment._links?.checkout?.href;

    if (!checkoutUrl) {
      throw new Error("Mollie gaf geen checkout-url terug.");
    }

    await storeMolliePaymentOnOrder(supabaseAdmin, {
      checkoutUrl,
      molliePaymentId: molliePayment.id,
      orderId: createdOrder.order_id,
      paymentMethod: checkoutMethod,
      paymentStatus: mapMollieStatus(molliePayment.status).paymentStatus,
    });

    return jsonResponse(
      {
        checkoutUrl,
        orderId: createdOrder.order_id,
        orderNumber: createdOrder.order_number,
      },
      { status: 200 },
      req.headers.get("origin"),
    );
  } catch (error) {
    console.error("Checkout-aanmaak mislukt, reservatie wordt vrijgegeven.", error);

    try {
      await releaseOrderAsFailedCheckout(supabaseAdmin, createdOrder.order_id);
    } catch (rollbackError) {
      console.error("Rollback van mislukte checkout mislukte.", rollbackError);
    }

    throw new HttpError(500, error instanceof Error ? error.message : "Checkout kon niet gestart worden.");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: getCorsHeaders(req.headers.get("origin")),
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      { error: "Alleen POST is toegestaan." },
      { status: 405 },
      req.headers.get("origin"),
    );
  }

  try {
    const body = await req.json();

    if (!body || typeof body !== "object") {
      throw new HttpError(400, "Ongeldige aanvraag.");
    }

    const action = normalizeText((body as Record<string, unknown>).action) || "create";
    const supabaseAdmin = createSupabaseAdminClient();

    if (action === "status") {
      return await handleStatusLookup(req, supabaseAdmin, body as Record<string, unknown>);
    }

    return await handleCheckoutCreation(req, supabaseAdmin, body as Record<string, unknown>);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout.";
    const status = error instanceof HttpError ? error.status : 500;

    console.error("create-checkout error", error);

    return jsonResponse(
      { error: message },
      { status },
      req.headers.get("origin"),
    );
  }
});
