// Simula a aprovação de um pagamento (sem GalioPay/CVU) pra validar a parte
// "pagamento aprovado -> bot libera acesso ao grupo Telegram", que é o único
// pedaço do motor v1 ainda não testado ponta a ponta.
//
// Replica a lógica de `approvePayment()` em src/lib/engine/poll-payments.ts
// diretamente via REST (Supabase + Telegram Bot API), sem depender da GalioPay.
//
// Uso: node scripts/test-approve-payment.mjs <payment_id>

import { readFileSync } from "node:fs";
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

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const TELEGRAM_API_BASE = env.TELEGRAM_API_BASE ?? "https://api.telegram.org";

const sbHeaders = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

const PERIOD_DAYS = { weekly: 7, monthly: 30, quarterly: 90, yearly: 365 };

function addPeriod(from, period) {
  const result = new Date(from);
  result.setDate(result.getDate() + PERIOD_DAYS[period]);
  return result;
}

async function sbGet(table, query) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: sbHeaders,
  });
  if (!res.ok) throw new Error(`GET ${table} -> ${res.status}: ${await res.text()}`);
  return res.json();
}

async function sbPatch(table, query, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: "PATCH",
    headers: { ...sbHeaders, Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${table} -> ${res.status}: ${await res.text()}`);
  return res.json();
}

async function tg(botToken, method, params) {
  const res = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram ${method} falhou: ${JSON.stringify(data)}`);
  return data.result;
}

async function main() {
  const paymentId = process.argv[2];
  if (!paymentId) {
    console.error("Uso: node scripts/test-approve-payment.mjs <payment_id>");
    process.exit(1);
  }

  console.log("=== 1) Carregando payment + subscription ===");
  const [payment] = await sbGet("payments", `id=eq.${paymentId}&select=*`);
  if (!payment) throw new Error("Payment não encontrado");
  console.log("payment:", payment.id, "status:", payment.status, "subscription_id:", payment.subscription_id);

  const [subscription] = await sbGet(
    "subscriptions",
    `id=eq.${payment.subscription_id}&select=*`
  );
  console.log("subscription:", subscription.id, "telegram_user_id:", subscription.telegram_user_id);

  const [offer] = await sbGet("offers", `id=eq.${subscription.offer_id}&select=*`);
  const [group] = await sbGet("groups", `id=eq.${offer.group_id}&select=*`);
  const [bot] = await sbGet("bots", `id=eq.${group.bot_id}&select=*`);
  console.log("offer:", offer.name, offer.period, offer.price_amount, offer.price_currency);
  console.log("group:", group.name, "chat_id:", group.telegram_chat_id);
  console.log("bot:", bot.bot_username);

  console.log("\n=== 2) Marcando payment como aprovado ===");
  await sbPatch("payments", `id=eq.${payment.id}`, {
    status: "approved",
    approved_at: new Date().toISOString(),
  });
  console.log("OK");

  console.log("\n=== 3) Ativando subscription ===");
  const base =
    subscription.current_period_end && new Date(subscription.current_period_end) > new Date()
      ? new Date(subscription.current_period_end)
      : new Date();
  const newPeriodEnd = addPeriod(base, offer.period);

  await sbPatch("subscriptions", `id=eq.${subscription.id}`, {
    status: "active",
    current_period_end: newPeriodEnd.toISOString(),
    reminder_7d_sent_at: null,
    reminder_3d_sent_at: null,
    reminder_1d_sent_at: null,
  });
  console.log("OK - novo current_period_end:", newPeriodEnd.toISOString());

  console.log("\n=== 4) Gerando invite link do grupo ===");
  const invite = await tg(bot.bot_token, "createChatInviteLink", {
    chat_id: group.telegram_chat_id,
    member_limit: 1,
  });
  console.log("invite_link:", invite.invite_link);

  console.log("\n=== 5) Enviando mensagem pro usuário no Telegram ===");
  await tg(bot.bot_token, "sendMessage", {
    chat_id: subscription.telegram_user_id,
    text: `Pagamento aprovado! Aqui está seu acesso a <b>${group.name}</b>:\n\n${invite.invite_link}\n\nEsse link é de uso único.`,
    parse_mode: "HTML",
  });
  console.log("OK - mensagem enviada");

  console.log("\n=== Fluxo completo simulado com sucesso ===");
}

main().catch((err) => {
  console.error("ERRO:", err);
  process.exit(1);
});
