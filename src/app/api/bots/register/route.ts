import { NextResponse, type NextRequest } from "next/server";
import { registerBot } from "@/lib/engine/register-bot";

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

  let bot;
  try {
    bot = await registerBot(creatorId, botToken);
  } catch {
    return NextResponse.json({ error: "Token de bot inválido" }, { status: 400 });
  }

  return NextResponse.json({ id: bot.id, username: bot.bot_username });
}
