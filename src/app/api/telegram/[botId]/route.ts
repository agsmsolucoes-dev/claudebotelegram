import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMessage } from "@/lib/telegram/client";
import { createPaymentLink } from "@/lib/galiopay/client";
import { applyCommission } from "@/lib/subscriptions";
import type { TelegramMessage, TelegramUpdate } from "@/lib/telegram/types";

/**
 * Webhook multi-tenant: cada bot (1 por criadora) aponta para
 * /api/telegram/{bots.id}, com `secret_token` = bots.webhook_secret
 * (ver lib/telegram/client.ts -> setWebhook).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params;
  const secret = req.headers.get("x-telegram-bot-api-secret-token");

  const supabase = createAdminClient();

  const { data: bot } = await supabase
    .from("bots")
    .select("*")
    .eq("id", botId)
    .maybeSingle();

  if (!bot || bot.webhook_secret !== secret) {
    return new Response("unauthorized", { status: 401 });
  }

  const update: TelegramUpdate = await req.json();
  const message = update.message;

  if (message?.text?.startsWith("/start")) {
    await handleStart(supabase, bot, message);
  }

  // Sempre 200 — Telegram reenvia o update se receber erro/timeout.
  return NextResponse.json({ ok: true });
}

async function handleStart(
  supabase: ReturnType<typeof createAdminClient>,
  bot: { id: string; bot_token: string },
  message: TelegramMessage
) {
  const chatId = message.chat.id;
  const from = message.from;
  if (!from) return;

  const payload = message.text?.split(" ")[1];

  if (!payload?.startsWith("offer_")) {
    await sendMessage(
      bot.bot_token,
      chatId,
      "Olá! Use o link de assinatura enviado pela criadora para acessar o grupo VIP."
    );
    return;
  }

  const offerId = payload.slice("offer_".length);

  const { data: offer } = await supabase
    .from("offers")
    .select("*")
    .eq("id", offerId)
    .eq("active", true)
    .maybeSingle();

  if (!offer) {
    await sendMessage(bot.bot_token, chatId, "Essa oferta não está mais disponível.");
    return;
  }

  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("*")
    .eq("id", offer.group_id)
    .single();
  if (groupError) throw groupError;

  const { data: creator, error: creatorError } = await supabase
    .from("creators")
    .select("*")
    .eq("id", group.creator_id)
    .single();
  if (creatorError) throw creatorError;

  // Garante uma assinatura (pending) para esse usuário + oferta.
  let { data: subscription } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("offer_id", offer.id)
    .eq("telegram_user_id", from.id)
    .maybeSingle();

  if (!subscription) {
    const { data: newSubscription, error } = await supabase
      .from("subscriptions")
      .insert({
        offer_id: offer.id,
        telegram_user_id: from.id,
        telegram_username: from.username,
        status: "pending",
      })
      .select()
      .single();

    if (error) throw error;
    subscription = newSubscription;
  }

  const { commissionAmount, netAmount } = applyCommission(
    offer.price_amount,
    creator.commission_pct,
    creator.commission_fixed
  );

  const referenceId = randomUUID();

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .insert({
      subscription_id: subscription.id,
      reference_id: referenceId,
      amount: offer.price_amount,
      currency: offer.price_currency,
      commission_amount: commissionAmount,
      net_amount: netAmount,
      status: "pending",
    })
    .select()
    .single();

  if (paymentError) throw paymentError;

  try {
    const link = await createPaymentLink({
      items: [
        {
          title: `${group.name} — ${offer.name}`,
          quantity: 1,
          unitPrice: offer.price_amount,
          currencyId: offer.price_currency,
        },
      ],
      referenceId,
      description: `Assinatura ${offer.name} (${group.name})`,
      establishmentName: creator.name,
      sellerName: creator.name,
      backUrl: {
        success: `${process.env.APP_URL}/pay/success`,
        failure: `${process.env.APP_URL}/pay/failure`,
      },
    });

    await supabase
      .from("payments")
      .update({
        galiopay_payment_link_id: link.id,
        galiopay_proof_token: link.proofToken,
        payment_url: link.url,
      })
      .eq("id", payment.id);

    await sendMessage(
      bot.bot_token,
      chatId,
      `Para liberar o acesso a <b>${group.name}</b> (${offer.name}), pague pelo link abaixo:\n\n${link.url}\n\nAssim que o pagamento for aprovado, você recebe o convite do grupo automaticamente.`
    );
  } catch (err) {
    console.error("Erro ao criar payment link GalioPay:", err);
    await sendMessage(
      bot.bot_token,
      chatId,
      "Não consegui gerar o link de pagamento agora. Tente novamente em instantes ou fale com o suporte."
    );
  }
}
