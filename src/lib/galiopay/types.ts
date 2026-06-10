// Tipos validados com conta real GalioPay em 2026-06 (ver scripts/test-galiopay.mjs).
// Pendente ainda: shape de `payments.status` após um pagamento real ser aprovado
// (ver "O que falta validar com conta real" em ../../../CLAUDE.md).

export interface PaymentLinkItem {
  title: string;
  quantity: number;
  unitPrice: number;
  currencyId: "ARS" | "BRL" | string;
}

export interface CreatePaymentLinkInput {
  items: PaymentLinkItem[];
  referenceId: string; // nosso id interno (payments.reference_id) — chave de mapeamento
  description?: string;
  establishmentName?: string;
  sellerName?: string;
  backUrl?: {
    success?: string;
    failure?: string;
  };
}

export interface CreatePaymentLinkOutput {
  // A API NÃO retorna `id` diretamente — é extraído do path da `url`
  // (ex: https://pay.galio.app/payment/{id}?proof=...) por createPaymentLink().
  id: string;
  url: string;
  proofToken: string;
  referenceId: string;
  sandbox: boolean;
}

export interface UpdatePaymentLinkInput {
  referenceId?: string;
  items?: PaymentLinkItem[];
  description?: string;
  backUrl?: CreatePaymentLinkInput["backUrl"];
  subClientId?: string;
}

export interface PaymentLinkProof {
  id: string;
  proofToken: string;
  items: PaymentLinkItem[];
  referenceId: string;
  status: GalioPayPaymentStatus;
  sandbox: boolean;
  backUrl?: CreatePaymentLinkInput["backUrl"];
  // TODO: confirmar nome/formato deste campo quando um pagamento real for aprovado
  // (não aparece enquanto status === "pending").
  paymentId?: string;
}

// TODO: confirmar valores reais de `status` ao processar o primeiro pagamento real.
export type GalioPayPaymentStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "refunded"
  | (string & {});

export interface GalioPayPayment {
  id: string;
  amount: number;
  netAmount: number;
  currency: string;
  status: GalioPayPaymentStatus;
  date: string;
  referenceId: string;
  type: string;
  moneyReleaseDate: string | null;
}

export interface RefundInput {
  reason: string;
  refundType: "total" | "parcial";
  refundAmount?: number; // obrigatório se refundType === "parcial"
}

export interface RefundOutput {
  success: boolean;
  message: string;
  payment: {
    id: string;
    status: GalioPayPaymentStatus;
  };
}
