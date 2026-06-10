import type { createAdminClient } from "@/lib/supabase/admin";
import { getPayment, getPaymentLinkProof } from "@/lib/galiopay/client";
import { sendMessage, createChatInviteLink } from "@/lib/telegram/client";
import { addPeriod } from "@/lib/subscriptions";
import { loadSubscriptionContext } from "./context";

/**
 * Resolve `galiopay_payment_id` a partir do `proofToken` salvo na criação do link
 * (GET /payment-links/{id}?proof= -> paymentId), e em seguida consulta o status
 * de pagamentos pendentes (GET /payments/{id}). Sem webhook documentado — chamado
 * periodicamente pelo cron.
 *
 * TODO: validar com conta real se `status === "approved"`/"rejected" são os
 * valores corretos retornados pela GalioPay.
 */
export async function pollPendingPayments(supabase: ReturnType<typeof createAdminClient>) {
  let resolved = 0;
  let approved = 0;
  let rejected = 0;

  const { data: unresolvedLinks } = await supabase
    .from("payments")
    .select("*")
    .eq("status", "pending")
    .is("galiopay_payment_id", null)
    .not("galiopay_payment_link_id", "is", null);

  for (const payment of unresolvedLinks ?? []) {
    if (!payment.galiopay_payment_link_id || !payment.galiopay_proof_token) continue;

    try {
      const proof = await getPaymentLinkProof(
        payment.galiopay_payment_link_id,
        payment.galiopay_proof_token
      );

      if (proof.paymentId) {
        await supabase
          .from("payments")
          .update({ galiopay_payment_id: proof.paymentId })
          .eq("id", payment.id);
        resolved++;
      }
    } catch (err) {
      console.error(`Erro ao resolver proof do payment ${payment.id}:`, err);
    }
  }

  const { data: pendingPayments } = await supabase
    .from("payments")
    .select("*")
    .eq("status", "pending")
    .not("galiopay_payment_id", "is", null);

  for (const payment of pendingPayments ?? []) {
    if (!payment.galiopay_payment_id) continue;

    try {
      const result = await getPayment(payment.galiopay_payment_id);

      if (result.status === "approved") {
        await approvePayment(supabase, payment.id);
        approved++;
      } else if (result.status === "rejected") {
        await supabase.from("payments").update({ status: "rejected" }).eq("id", payment.id);
        rejected++;
      }
    } catch (err) {
      console.error(`Erro ao consultar status do payment ${payment.id}:`, err);
    }
  }

  return { resolved, approved, rejected };
}

async function approvePayment(supabase: ReturnType<typeof createAdminClient>, paymentId: string) {
  const { data: payment, error } = await supabase
    .from("payments")
    .select("*")
    .eq("id", paymentId)
    .single();
  if (error) throw error;

  await supabase
    .from("payments")
    .update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("id", payment.id);

  const { subscription, offer, group, bot } = await loadSubscriptionContext(
    supabase,
    payment.subscription_id
  );

  const base =
    subscription.current_period_end && new Date(subscription.current_period_end) > new Date()
      ? new Date(subscription.current_period_end)
      : new Date();
  const newPeriodEnd = addPeriod(base, offer.period);

  await supabase
    .from("subscriptions")
    .update({
      status: "active",
      current_period_end: newPeriodEnd.toISOString(),
      reminder_7d_sent_at: null,
      reminder_3d_sent_at: null,
      reminder_1d_sent_at: null,
    })
    .eq("id", subscription.id);

  const invite = await createChatInviteLink(bot.bot_token, group.telegram_chat_id);

  await sendMessage(
    bot.bot_token,
    subscription.telegram_user_id,
    `Pagamento aprovado! Aqui está seu acesso a <b>${group.name}</b>:\n\n${invite.invite_link}\n\nEsse link é de uso único.`
  );
}
