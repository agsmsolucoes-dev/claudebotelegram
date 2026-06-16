import type { createAdminClient } from "@/lib/supabase/admin";
import { getPayment, getPaymentLinkProof } from "@/lib/galiopay/client";
import { approvePayment } from "./approve-payment";

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

  // Wompi payments are handled via webhook — skip them here
  const { data: unresolvedLinks } = await supabase
    .from("payments")
    .select("*")
    .eq("status", "pending")
    .is("galiopay_payment_id", null)
    .is("wompi_payment_link_id", null)
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
    .is("wompi_payment_link_id", null)
    .not("galiopay_payment_id", "is", null);

  for (const payment of pendingPayments ?? []) {
    if (!payment.galiopay_payment_id) continue;

    try {
      const result = await getPayment(payment.galiopay_payment_id);

      if (result.status === "approved") {
        await approvePayment(supabase, payment.id);
        approved++;
      } else if (result.status === "rejected" || result.status === "cancelled") {
        await supabase.from("payments").update({ status: "rejected" }).eq("id", payment.id);
        rejected++;
      }
    } catch (err) {
      console.error(`Erro ao consultar status do payment ${payment.id}:`, err);
    }
  }

  return { resolved, approved, rejected };
}
