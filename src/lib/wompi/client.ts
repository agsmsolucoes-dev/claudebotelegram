import { createHash } from "node:crypto";
import type {
  WompiPaymentLinkInput,
  WompiPaymentLinkOutput,
  WompiTransaction,
  WompiWebhookPayload,
} from "./types";

const BASE_URL = process.env.WOMPI_BASE_URL ?? "https://sandbox.wompi.co/v1";

function authHeaders(): HeadersInit {
  const key = process.env.WOMPI_PRIVATE_KEY;
  if (!key) throw new Error("WOMPI_PRIVATE_KEY não configurada (.env)");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Wompi ${init?.method ?? "GET"} ${path} -> ${res.status}: ${body}`);
  }
  const json = await res.json();
  return (json.data ?? json) as T;
}

export async function createPaymentLink(
  input: WompiPaymentLinkInput
): Promise<{ id: string; url: string }> {
  const raw = await request<WompiPaymentLinkOutput>("/payment_links", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return { id: raw.id, url: `https://checkout.wompi.co/l/${raw.id}` };
}

export function getTransaction(id: string): Promise<WompiTransaction> {
  return request<WompiTransaction>(`/transactions/${id}`);
}

export function verifyWebhookSignature(
  payload: WompiWebhookPayload,
  transaction: WompiTransaction
): boolean {
  const eventsSecret = process.env.WOMPI_EVENTS_SECRET ?? "";
  const values = payload.signature.properties.map((prop) => {
    const field = prop.split(".").pop()!;
    return String((transaction as unknown as Record<string, unknown>)[field] ?? "");
  });
  const raw = [...values, payload.timestamp, eventsSecret].join("");
  const hash = createHash("sha256").update(raw).digest("hex");
  return hash === payload.signature.checksum;
}
