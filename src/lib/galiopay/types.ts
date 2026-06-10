// Tipos baseados no repo público GalioPay/galiopay-integration-example (2026-06).
// Status real e shapes completos ainda não validados com conta própria —
// ver "O que falta validar com conta real" em ../../../CLAUDE.md (raiz do agente DARWIN).

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
  id: string;
  url: string;
  // TODO: confirmar se o create retorna proofToken diretamente (necessário pra
  // resolver o paymentId via GET /payment-links/{id}?proof= no polling do cron).
  proofToken?: string;
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
  status: string;
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
