import type { createAdminClient } from "@/lib/supabase/admin";
import { sendMessage, banChatMember, unbanChatMember } from "@/lib/telegram/client";
import { loadSubscriptionContext } from "./context";

const ONE_DAY_MS = 1000 * 60 * 60 * 24;

/**
 * Para cada assinatura ativa: envia lembretes D-7/D-3/D-1 antes do vencimento,
 * e expulsa do grupo (kick + unban, pra permitir reentrada futura) quem venceu.
 */
export async function processSubscriptionLifecycle(supabase: ReturnType<typeof createAdminClient>) {
  const now = new Date();
  let remindersSent = 0;
  let expired = 0;

  const { data: activeSubs } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("status", "active")
    .not("current_period_end", "is", null);

  for (const sub of activeSubs ?? []) {
    const periodEnd = new Date(sub.current_period_end!);
    const daysLeft = (periodEnd.getTime() - now.getTime()) / ONE_DAY_MS;

    const { offer, group, bot } = await loadSubscriptionContext(supabase, sub.id);

    if (daysLeft <= 0) {
      await supabase.from("subscriptions").update({ status: "expired" }).eq("id", sub.id);

      await banChatMember(bot.bot_token, group.telegram_chat_id, sub.telegram_user_id);
      await unbanChatMember(bot.bot_token, group.telegram_chat_id, sub.telegram_user_id);

      await sendMessage(
        bot.bot_token,
        sub.telegram_user_id,
        `Tu suscripción a <b>${group.name}</b> venció y se removió el acceso. Usá el link de suscripción nuevamente para renovar.`
      );
      expired++;
      continue;
    }

    if (daysLeft <= 1 && !sub.reminder_1d_sent_at) {
      await sendMessage(
        bot.bot_token,
        sub.telegram_user_id,
        `Tu suscripción a <b>${group.name}</b> (${offer.name}) vence mañana. Renovás para no perder el acceso.`
      );
      await supabase
        .from("subscriptions")
        .update({ reminder_1d_sent_at: now.toISOString() })
        .eq("id", sub.id);
      remindersSent++;
    } else if (daysLeft <= 3 && !sub.reminder_3d_sent_at) {
      await sendMessage(
        bot.bot_token,
        sub.telegram_user_id,
        `Tu suscripción a <b>${group.name}</b> (${offer.name}) vence en 3 días.`
      );
      await supabase
        .from("subscriptions")
        .update({ reminder_3d_sent_at: now.toISOString() })
        .eq("id", sub.id);
      remindersSent++;
    } else if (daysLeft <= 7 && !sub.reminder_7d_sent_at) {
      await sendMessage(
        bot.bot_token,
        sub.telegram_user_id,
        `Tu suscripción a <b>${group.name}</b> (${offer.name}) vence en 7 días.`
      );
      await supabase
        .from("subscriptions")
        .update({ reminder_7d_sent_at: now.toISOString() })
        .eq("id", sub.id);
      remindersSent++;
    }
  }

  return { remindersSent, expired };
}
