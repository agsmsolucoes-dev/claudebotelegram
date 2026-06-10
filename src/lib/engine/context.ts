import type { createAdminClient } from "@/lib/supabase/admin";

/** Carrega assinatura + oferta + grupo + bot a partir do id da assinatura. */
export async function loadSubscriptionContext(
  supabase: ReturnType<typeof createAdminClient>,
  subscriptionId: string
) {
  const { data: subscription, error: subErr } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("id", subscriptionId)
    .single();
  if (subErr) throw subErr;

  const { data: offer, error: offerErr } = await supabase
    .from("offers")
    .select("*")
    .eq("id", subscription.offer_id)
    .single();
  if (offerErr) throw offerErr;

  const { data: group, error: groupErr } = await supabase
    .from("groups")
    .select("*")
    .eq("id", offer.group_id)
    .single();
  if (groupErr) throw groupErr;

  const { data: bot, error: botErr } = await supabase
    .from("bots")
    .select("*")
    .eq("id", group.bot_id)
    .single();
  if (botErr) throw botErr;

  return { subscription, offer, group, bot };
}
