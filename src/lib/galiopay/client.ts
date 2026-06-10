import type {
  CreatePaymentLinkInput,
  CreatePaymentLinkOutput,
  GalioPayPayment,
  PaymentLinkProof,
  RefundInput,
  RefundOutput,
  UpdatePaymentLinkInput,
} from "./types";

const BASE_URL = process.env.GALIOPAY_BASE_URL ?? "https://pay.galio.app/api";

function authHeaders(): HeadersInit {
  const apiKey = process.env.GALIOPAY_API_KEY;
  const clientId = process.env.GALIOPAY_CLIENT_ID;

  if (!apiKey || !clientId) {
    throw new Error(
      "GALIOPAY_API_KEY e GALIOPAY_CLIENT_ID precisam estar configurados (.env)"
    );
  }

  return {
    Authorization: `Bearer ${apiKey}`,
    "x-client-id": clientId,
    "Content-Type": "application/json",
  };
}

async function request<T>(
  path: string,
  init?: RequestInit & { auth?: boolean }
): Promise<T> {
  const { auth = true, ...rest } = init ?? {};

  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: {
      ...(auth ? authHeaders() : { "Content-Type": "application/json" }),
      ...rest.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GalioPay ${rest.method ?? "GET"} ${path} -> ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

/** Cria um link de pagamento (CVU). `referenceId` deve ser o id interno do nosso `payments`. */
export function createPaymentLink(input: CreatePaymentLinkInput) {
  return request<CreatePaymentLinkOutput>("/payment-links", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updatePaymentLink(id: string, input: UpdatePaymentLinkInput) {
  return request<CreatePaymentLinkOutput>(`/payment-links/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

/** Endpoint público (sem auth) — usa o `proofToken` retornado pelo link. */
export function getPaymentLinkProof(id: string, proofToken: string) {
  return request<PaymentLinkProof>(
    `/payment-links/${id}?proof=${encodeURIComponent(proofToken)}`,
    { auth: false }
  );
}

/**
 * Consulta o status de um pagamento. Sem webhook documentado — usado em
 * polling pelo cron de assinaturas (ver app/api/cron/subscriptions).
 */
export function getPayment(id: string) {
  return request<GalioPayPayment>(`/payments/${id}`);
}

export function refundPayment(id: string, input: RefundInput) {
  return request<RefundOutput>(`/payments/${id}/refund`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
