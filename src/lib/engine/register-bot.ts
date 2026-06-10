import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMe, setWebhook } from "@/lib/telegram/client";

/**
 * Valida o token do BotFather, registra o bot pra uma criadora e configura
 * o webhook multi-tenant (/api/telegram/{botId}). Usado pelo dashboard e
 * por /api/bots/register.
 */
export async function registerBot(creatorId: string, botToken: string) {
  const me = await getMe(botToken);

  const supabase = createAdminClient();
  const webhookSecret = randomUUID();

  const { data: bot, error } = await supabase
    .from("bots")
    .insert({
      creator_id: creatorId,
      bot_token: botToken,
      bot_username: me.username,
      webhook_secret: webhookSecret,
    })
    .select()
    .single();

  if (error) throw error;

  const webhookUrl = `${process.env.APP_URL}/api/telegram/${bot.id}`;
  await setWebhook(botToken, webhookUrl, bot.webhook_secret);

  return bot;
}
