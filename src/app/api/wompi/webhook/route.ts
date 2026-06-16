import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTransaction, verifyWebhookSignature } from "@/lib/wompi/client";
import { approvePayment } from "@/lib/engine/approve-payment";
import type { WompiWebhookPayload } from "@/lib/wompi/types";

export async function POST(req: NextRequest) {
  const payload: WompiWebhookPayload = await req.json();

  if (payload.event !== "transaction.updated") {
    return NextResponse.json({ ok: true });
  }

  const { transaction } = payload.data;

  if (transaction.status !== "APPROVED") {
    return NextResponse.json({ ok: true });
  }

  if (!verifyWebhookSignature(payload, transaction)) {
    console.error("Wompi webhook: assinatura inválida", transaction.id);
    return new Response("unauthorized", { status: 401 });
  }

  // Busca a transação completa para obter payment_link_id (pode não vir no payload resumido)
  let paymentLinkId = transaction.payment_link_id;
  if (!paymentLinkId) {
    try {
      const full = await getTransaction(transaction.id);
      paymentLinkId = full.payment_link_id;
    } catch (err) {
      console.error("Wompi webhook: erro ao buscar transação completa", err);
    }
  }

  if (!paymentLinkId) {
    console.error("Wompi webhook: sem payment_link_id na transação", transaction.id);
    return NextResponse.json({ ok: true });
  }

  const supabase = createAdminClient();

  const { data: payment } = await supabase
    .from("payments")
    .select("id")
    .eq("wompi_payment_link_id", paymentLinkId)
    .eq("status", "pending")
    .maybeSingle();

  if (!payment) {
    console.error("Wompi webhook: pagamento não encontrado para link", paymentLinkId);
    return NextResponse.json({ ok: true });
  }

  try {
    await approvePayment(supabase, payment.id);
  } catch (err) {
    console.error("Wompi webhook: erro ao aprovar pagamento", payment.id, err);
    return new Response("internal error", { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
