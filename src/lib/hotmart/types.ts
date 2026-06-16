export interface HotmartWebhookPayload {
  event: string;
  id: string;
  version: string;
  creation_date: number;
  hottok: string;
  data: {
    buyer: {
      email: string;
      name: string;
      checkout_phone?: string;
    };
    product: {
      id: number;
      name: string;
      ucode: string;
    };
    purchase: {
      status: "APPROVED" | "CANCELED" | "REFUNDED" | "BILLET_PRINTED" | "CHARGEBACK" | "COMPLETE" | "NO_FUNDS";
      transaction: string; // HP... — ID único da transação Hotmart
      approved_date: number;
      full_price: {
        value: number;
        currency_value: string; // "BRL", "COP", "USD", "MXN", etc.
      };
      tracking: {
        source?: string;       // valor do ?src= — usamos para guardar subscription_id
        source_sck?: string;
        external_code?: string;
      };
      offer: {
        code: string;
      };
    };
  };
}
