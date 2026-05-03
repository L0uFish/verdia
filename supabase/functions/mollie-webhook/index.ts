import {
  applyPaymentStatusToOrder,
  getOrderByPaymentId,
  getOrderForStatus,
  releaseExpiredReservations,
} from "../_shared/orders.ts";
import {
  fetchMolliePayment,
  mapMollieStatus,
} from "../_shared/mollie.ts";
import { createSupabaseAdminClient } from "../_shared/supabase.ts";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function extractWebhookPaymentId(req: Request) {
  const queryId = normalizeText(new URL(req.url).searchParams.get("id"));

  if (queryId) {
    return queryId;
  }

  const rawBody = await req.text();

  if (!rawBody) {
    return "";
  }

  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      const parsed = JSON.parse(rawBody);
      return normalizeText(parsed?.id || parsed?.paymentId);
    } catch (_error) {
      return "";
    }
  }

  const params = new URLSearchParams(rawBody);
  return normalizeText(params.get("id") || params.get("paymentId"));
}

async function resolveOrderId(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  molliePaymentId: string,
  metadata: Record<string, unknown> | null | undefined,
) {
  try {
    const order = await getOrderByPaymentId(supabaseAdmin, molliePaymentId);
    return order.id;
  } catch (_error) {
    const metadataOrderId = normalizeText(metadata?.order_id);

    if (!metadataOrderId) {
      throw new Error("Bestelling bij deze Mollie-betaling kon niet gevonden worden.");
    }

    const order = await getOrderForStatus(supabaseAdmin, metadataOrderId);
    return order.id;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const molliePaymentId = await extractWebhookPaymentId(req);

    if (!molliePaymentId) {
      return new Response("Missing payment id", { status: 400 });
    }

    const supabaseAdmin = createSupabaseAdminClient();

    await releaseExpiredReservations(supabaseAdmin);

    const payment = await fetchMolliePayment(molliePaymentId);
    const orderId = await resolveOrderId(
      supabaseAdmin,
      payment.id,
      payment.metadata ?? null,
    );
    const mapping = mapMollieStatus(payment.status);

    await applyPaymentStatusToOrder(supabaseAdmin, {
      markInventorySold: mapping.markInventorySold,
      orderId,
      orderStatus: mapping.orderStatus,
      paidAt: payment.paidAt || null,
      paymentMethod: payment.method || null,
      paymentStatus: mapping.paymentStatus,
      processedAt: new Date().toISOString(),
      releaseInventory: mapping.releaseInventory,
    });

    return new Response("ok", { status: 200 });
  } catch (error) {
    console.error("mollie-webhook error", error);
    return new Response(
      error instanceof Error ? error.message : "Webhook kon niet verwerkt worden.",
      { status: 500 },
    );
  }
});
