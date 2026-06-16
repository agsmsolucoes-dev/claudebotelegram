import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMessage } from "@/lib/telegram/client";
import { createPaymentLink as galioPayCreateLink } from "@/lib/galiopay/client";
import { createPaymentLink as wompiCreateLink } from "@/lib/wompi/client";
import { applyCommission } from "@/lib/subscriptions";
import type { TelegramMessage, TelegramUpdate } from "@/lib/telegram/types";

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
      "¡Hola! Usá el link de suscripción enviado por la creadora para acceder al grupo VIP."
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
    await sendMessage(bot.bot_token, chatId, "Esta oferta ya no está disponible.");
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

  let { data: subscription } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("offer_id", offer.id)
    .eq("telegram_user_id", from.id)
    .maybeSingle();

  if (!subscription) {
    const { data: newSub, error } = await supabase
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
    subscription = newSub;
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

  const isWompi = offer.price_currency === "COP";

  try {
    let paymentUrl: string;

    if (isWompi) {
      const link = await wompiCreateLink({
        name: `${group.name} — ${offer.name}`,
        description: `Suscripción ${offer.name} (${group.name})`,
        single_use: true,
        collect_shipping: false,
        amount_in_cents: Math.round(offer.price_amount * 100),
        currency: "COP",
      });

      await supabase
        .from("payments")
        .update({ wompi_payment_link_id: link.id, payment_url: link.url })
        .eq("id", payment.id);

      paymentUrl = link.url;
    } else {
      const link = await galioPayCreateLink({
        items: [
          {
            title: `${group.name} — ${offer.name}`,
            quantity: 1,
            unitPrice: offer.price_amount,
            currencyId: offer.price_currency,
          },
        ],
        referenceId,
        description: `Suscripción ${offer.name} (${group.name})`,
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

      paymentUrl = link.url;
    }

    await sendMessage(
      bot.bot_token,
      chatId,
      `Para acceder a <b>${group.name}</b> (${offer.name}), pagá a través del siguiente link:\n\n${paymentUrl}\n\nUna vez confirmado el pago, recibís la invitación al grupo automáticamente.`
    );
  } catch (err) {
    console.error("Error al crear payment link:", err);
    await sendMessage(
      bot.bot_token,
      chatId,
      "No pude generar el link de pago en este momento. Intentá de nuevo en unos minutos o contactá al soporte."
    );
  }
}
