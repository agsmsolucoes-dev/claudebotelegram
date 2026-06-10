// Script de validação manual da integração GalioPay com credenciais reais.
// Uso: node scripts/test-galiopay.mjs
// Lê GALIOPAY_API_KEY / GALIOPAY_CLIENT_ID / GALIOPAY_BASE_URL de .env.local

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv(path) {
  const content = readFileSync(path, "utf-8");
  const env = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return env;
}

const env = loadEnv(join(__dirname, "..", ".env.local"));

const BASE_URL = env.GALIOPAY_BASE_URL ?? "https://pay.galio.app/api";
const headers = {
  Authorization: `Bearer ${env.GALIOPAY_API_KEY}`,
  "x-client-id": env.GALIOPAY_CLIENT_ID,
  "Content-Type": "application/json",
};

async function main() {
  const referenceId = randomUUID();
  console.log("=== 1) Criando payment link de teste ===");
  console.log("referenceId:", referenceId);

  const createBody = {
    items: [
      {
        title: "Teste DARWIN - assinatura VIP",
        quantity: 1,
        unitPrice: 100,
        currencyId: "ARS",
      },
    ],
    referenceId,
    description: "Teste de integração GalioPay",
    establishmentName: "Teste SaaS VIP LATAM",
    sellerName: "Teste SaaS VIP LATAM",
    backUrl: {
      success: "https://example.com/pay/success",
      failure: "https://example.com/pay/failure",
    },
  };

  const createRes = await fetch(`${BASE_URL}/payment-links`, {
    method: "POST",
    headers,
    body: JSON.stringify(createBody),
  });

  const createText = await createRes.text();
  console.log("status:", createRes.status);
  console.log("body:", createText);

  if (!createRes.ok) {
    console.log("\n>>> Falhou ao criar payment link. Abortando.");
    return;
  }

  const created = JSON.parse(createText);
  console.log("\n>>> Campos recebidos no create:", Object.keys(created));

  // O create NÃO retorna `id` — extrai do path da `url` (ObjectId do Mongo).
  const idFromUrl = created.url?.match(/\/payment\/([a-f0-9]+)/)?.[1];
  console.log(">>> id extraído da url:", idFromUrl);

  console.log("\n=== 2) Consultando proof do payment link ===");
  if (!created.proofToken || !idFromUrl) {
    console.log(">>> Sem proofToken ou id — não dá pra consultar proof.");
  } else {
    const proofRes = await fetch(
      `${BASE_URL}/payment-links/${idFromUrl}?proof=${encodeURIComponent(created.proofToken)}`,
      { headers: { "Content-Type": "application/json" } }
    );
    const proofText = await proofRes.text();
    console.log("status:", proofRes.status);
    console.log("body:", proofText);
  }

  console.log("\n=== Link de pagamento (abra para inspecionar o checkout) ===");
  console.log(created.url);
}

main().catch((err) => {
  console.error("ERRO:", err);
  process.exit(1);
});
