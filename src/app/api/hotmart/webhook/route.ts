import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { approvePayment } from "@/lib/engine/approve-payment";
import { applyCommission } from "@/lib/subscriptions";
import type { HotmartWebhookPayload } from "@/lib/hotmart/types";

export async function POST(req: NextRequest) {
  const payload: HotmartWebhookPayload = await req.json();

  // Verificação simples via hottok — configure HOTMART_HOTTOK no painel:
  // Hotmart → Ferramentas → Notificações de compra → Hottok
  if (payload.hottok !== process.env.HOTMART_HOTTOK) {
    console.error("Hotmart webhook: hottok inválido");
    return new Response("unauthorized", { status: 401 });
  }

  if (payload.event !== "PURCHASE_APPROVED") {
    return NextResponse.json({ ok: true });
  }

  const { purchase, buyer } = payload.data;
  const transactionId = purchase.transaction;
  const subscriptionId = purchase.tracking?.source;

  if (!subscriptionId) {
    console.error("Hotmart webhook: sem subscription_id no tracking.source", transactionId);
    return NextResponse.json({ ok: true });
  }

  const supabase = createAdminClient();

  // Idempotência — ignora se essa transação já foi processada
  const { data: existing } = await supabase
    .from("payments")
    .select("id")
    .eq("hotmart_transaction_id", transactionId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true });
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("id, offer_id")
    .eq("id", subscriptionId)
    .maybeSingle();

  if (!subscription) {
    console.error("Hotmart webhook: subscription não encontrada", subscriptionId);
    return NextResponse.json({ ok: true });
  }

  const { data: offer, error: offerErr } = await supabase
    .from("offers")
    .select("group_id")
    .eq("id", subscription.offer_id)
    .single();
  if (offerErr || !offer) {
    console.error("Hotmart webhook: offer não encontrada", subscription.offer_id);
    return NextResponse.json({ ok: true });
  }

  const { data: group, error: groupErr } = await supabase
    .from("groups")
    .select("creator_id")
    .eq("id", offer.group_id)
    .single();
  if (groupErr || !group) {
    console.error("Hotmart webhook: group não encontrado", offer.group_id);
    return NextResponse.json({ ok: true });
  }

  const { data: creator, error: creatorErr } = await supabase
    .from("creators")
    .select("commission_pct, commission_fixed")
    .eq("id", group.creator_id)
    .single();
  if (creatorErr || !creator) {
    console.error("Hotmart webhook: creator não encontrada", group.creator_id);
    return NextResponse.json({ ok: true });
  }

  const amount = purchase.full_price.value;
  const currency = purchase.full_price.currency_value;
  const { commissionAmount, netAmount } = applyCommission(
    amount,
    creator.commission_pct,
    creator.commission_fixed
  );

  // Cria o registro de pagamento e aprova em seguida
  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .insert({
      subscription_id: subscriptionId,
      reference_id: transactionId,
      hotmart_transaction_id: transactionId,
      amount,
      currency,
      commission_amount: commissionAmount,
      net_amount: netAmount,
      status: "pending",
    })
    .select()
    .single();

  if (paymentError) {
    console.error("Hotmart webhook: erro ao criar payment", paymentError);
    return new Response("internal error", { status: 500 });
  }

  try {
    await approvePayment(supabase, payment.id);
  } catch (err) {
    console.error("Hotmart webhook: erro ao aprovar payment", payment.id, err);
    return new Response("internal error", { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
