export interface WompiPaymentLinkInput {
  name: string;
  description: string;
  single_use: boolean;
  collect_shipping: boolean;
  amount_in_cents?: number;
  currency?: string;
}

export interface WompiPaymentLinkOutput {
  id: string;
  active: boolean;
  created_at: string;
  url: string;
}

export type WompiTransactionStatus = "PENDING" | "APPROVED" | "DECLINED" | "VOIDED" | "ERROR";

export interface WompiTransaction {
  id: string;
  amount_in_cents: number;
  reference: string;
  status: WompiTransactionStatus;
  payment_method_type: string;
  payment_link_id?: string;
  currency?: string;
}

export interface WompiWebhookPayload {
  event: string;
  data: {
    transaction: WompiTransaction;
  };
  environment: string;
  signature: {
    properties: string[];
    checksum: string;
  };
  timestamp: number;
  sent_at: string;
}
