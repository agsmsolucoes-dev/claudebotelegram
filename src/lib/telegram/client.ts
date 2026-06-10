const TELEGRAM_API_BASE = process.env.TELEGRAM_API_BASE ?? "https://api.telegram.org";

async function call<T = unknown>(
  botToken: string,
  method: string,
  params?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: params ? JSON.stringify(params) : undefined,
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram ${method} falhou: ${JSON.stringify(data)}`);
  }
  return data.result as T;
}

export function getMe(botToken: string) {
  return call<{ id: number; username: string; first_name: string }>(botToken, "getMe");
}

export function sendMessage(
  botToken: string,
  chatId: number | string,
  text: string,
  extra?: Record<string, unknown>
) {
  return call(botToken, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    ...extra,
  });
}

export function answerCallbackQuery(
  botToken: string,
  callbackQueryId: string,
  text?: string
) {
  return call(botToken, "answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
  });
}

/**
 * Aponta o webhook do bot para nosso endpoint multi-tenant.
 * `secretToken` é validado no header `X-Telegram-Bot-Api-Secret-Token` de cada update recebido.
 */
export function setWebhook(botToken: string, url: string, secretToken: string) {
  return call(botToken, "setWebhook", { url, secret_token: secretToken });
}

/** Expulsa o assinante do grupo (assinatura vencida). `until_date` opcional permite re-entrada futura. */
export function banChatMember(
  botToken: string,
  chatId: number,
  userId: number,
  untilDateUnix?: number
) {
  return call(botToken, "banChatMember", {
    chat_id: chatId,
    user_id: userId,
    until_date: untilDateUnix,
  });
}

/** Remove o ban para permitir reentrada (chamado após `banChatMember` com kick imediato). */
export function unbanChatMember(botToken: string, chatId: number, userId: number) {
  return call(botToken, "unbanChatMember", {
    chat_id: chatId,
    user_id: userId,
    only_if_banned: true,
  });
}

/** Gera link de convite de uso único para reativação após pagamento. */
export function createChatInviteLink(
  botToken: string,
  chatId: number,
  options?: { member_limit?: number; expire_date?: number }
) {
  return call<{ invite_link: string }>(botToken, "createChatInviteLink", {
    chat_id: chatId,
    member_limit: options?.member_limit ?? 1,
    expire_date: options?.expire_date,
  });
}
