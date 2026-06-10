import type { OfferPeriod } from "@/types/database";

const PERIOD_DAYS: Record<OfferPeriod, number> = {
  weekly: 7,
  monthly: 30,
  quarterly: 90,
  yearly: 365,
};

/** Calcula o fim do período de assinatura a partir de uma data base. */
export function addPeriod(from: Date, period: OfferPeriod): Date {
  const result = new Date(from);
  result.setDate(result.getDate() + PERIOD_DAYS[period]);
  return result;
}

/**
 * Aplica a comissão da plataforma (commission_pct + commission_fixed da criadora)
 * sobre o valor bruto pago. Retorna valores arredondados em 2 casas.
 */
export function applyCommission(
  amount: number,
  commissionPct: number,
  commissionFixed: number
): { commissionAmount: number; netAmount: number } {
  const commissionAmount = Number(
    (amount * (commissionPct / 100) + commissionFixed).toFixed(2)
  );
  const netAmount = Number((amount - commissionAmount).toFixed(2));
  return { commissionAmount, netAmount };
}
