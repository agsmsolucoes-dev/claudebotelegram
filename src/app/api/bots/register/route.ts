import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMe, setWebhook } from "@/lib/telegram/client";

/**
 * Chamado pela dashboard quando a criadora cola o token gerado pelo @BotFather.
 * Valida o token (getMe), registra o bot e já configura o webhook multi-tenant
 * apontando pra /api/telegram/{botId}.
 *
 * Body: { creatorId: string, botToken: string }
 */
export async function POST(req: NextRequest) {
  const { creatorId, botToken } = await req.json();

  if (!creatorId || !botToken) {
    return NextResponse.json(
      { error: "creatorId e botToken são obrigatórios" },
      { status: 400 }
    );
  }

  let me;
  try {
    me = await getMe(botToken);
  } catch {
    return NextResponse.json({ error: "Token de bot inválido" }, { status: 400 });
  }

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

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const webhookUrl = `${process.env.APP_URL}/api/telegram/${bot.id}`;
  await setWebhook(botToken, webhookUrl, bot.webhook_secret);

  return NextResponse.json({ id: bot.id, username: bot.bot_username });
}
