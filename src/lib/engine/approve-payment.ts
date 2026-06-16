import type { createAdminClient } from "@/lib/supabase/admin";
import { sendMessage, createChatInviteLink } from "@/lib/telegram/client";
import { addPeriod } from "@/lib/subscriptions";
import { loadSubscriptionContext } from "./context";

export async function approvePayment(
  supabase: ReturnType<typeof createAdminClient>,
  paymentId: string
) {
  const { data: payment, error } = await supabase
    .from("payments")
    .select("*")
    .eq("id", paymentId)
    .single();
  if (error) throw error;

  await supabase
    .from("payments")
    .update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("id", payment.id);

  const { subscription, offer, group, bot } = await loadSubscriptionContext(
    supabase,
    payment.subscription_id
  );

  const base =
    subscription.current_period_end && new Date(subscription.current_period_end) > new Date()
      ? new Date(subscription.current_period_end)
      : new Date();
  const newPeriodEnd = addPeriod(base, offer.period);

  await supabase
    .from("subscriptions")
    .update({
      status: "active",
      current_period_end: newPeriodEnd.toISOString(),
      reminder_7d_sent_at: null,
      reminder_3d_sent_at: null,
      reminder_1d_sent_at: null,
    })
    .eq("id", subscription.id);

  const invite = await createChatInviteLink(bot.bot_token, group.telegram_chat_id);

  await sendMessage(
    bot.bot_token,
    subscription.telegram_user_id,
    `¡Pago aprobado! Acá está tu acceso a <b>${group.name}</b>:\n\n${invite.invite_link}\n\nEste link es de uso único.`
  );
}
