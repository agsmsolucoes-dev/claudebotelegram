"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { registerBot } from "@/lib/engine/register-bot";
import type { OfferPeriod } from "@/types/database";

function str(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function createCreator(formData: FormData) {
  const supabase = createAdminClient();

  const email = str(formData, "email");
  const name = str(formData, "name");
  const supportContact = str(formData, "support_contact");
  const commissionPct = str(formData, "commission_pct");
  const commissionFixed = str(formData, "commission_fixed");

  const { error } = await supabase.from("creators").insert({
    email,
    name,
    support_contact: supportContact || null,
    commission_pct: commissionPct ? Number(commissionPct) : undefined,
    commission_fixed: commissionFixed ? Number(commissionFixed) : undefined,
  });

  if (error) throw error;

  revalidatePath("/admin");
}

export async function registerBotAction(formData: FormData) {
  const creatorId = str(formData, "creator_id");
  const botToken = str(formData, "bot_token");

  await registerBot(creatorId, botToken);

  revalidatePath(`/admin/creators/${creatorId}`);
}

export async function createGroup(formData: FormData) {
  const supabase = createAdminClient();

  const creatorId = str(formData, "creator_id");
  const botId = str(formData, "bot_id");
  const telegramChatId = str(formData, "telegram_chat_id");
  const name = str(formData, "name");

  const { error } = await supabase.from("groups").insert({
    creator_id: creatorId,
    bot_id: botId,
    telegram_chat_id: Number(telegramChatId),
    name,
  });

  if (error) throw error;

  revalidatePath(`/admin/creators/${creatorId}`);
}

export async function createOffer(formData: FormData) {
  const supabase = createAdminClient();

  const creatorId = str(formData, "creator_id");
  const groupId = str(formData, "group_id");
  const name = str(formData, "name");
  const period = str(formData, "period") as OfferPeriod;
  const priceAmount = str(formData, "price_amount");
  const priceCurrency = str(formData, "price_currency");

  const { error } = await supabase.from("offers").insert({
    group_id: groupId,
    name,
    period,
    price_amount: Number(priceAmount),
    price_currency: priceCurrency || undefined,
  });

  if (error) throw error;

  revalidatePath(`/admin/creators/${creatorId}`);
}

export async function registerWithdrawal(formData: FormData) {
  const supabase = createAdminClient();

  const creatorId = str(formData, "creator_id");
  const amount = str(formData, "amount");
  const currency = str(formData, "currency");

  const { error } = await supabase.from("withdrawals").insert({
    creator_id: creatorId,
    amount: Number(amount),
    currency: currency || undefined,
    status: "completed",
    processed_at: new Date().toISOString(),
  });

  if (error) throw error;

  revalidatePath(`/admin/creators/${creatorId}`);
}

export async function toggleOfferActive(formData: FormData) {
  const supabase = createAdminClient();

  const creatorId = str(formData, "creator_id");
  const offerId = str(formData, "offer_id");
  const active = str(formData, "active") === "true";

  const { error } = await supabase
    .from("offers")
    .update({ active: !active })
    .eq("id", offerId);

  if (error) throw error;

  revalidatePath(`/admin/creators/${creatorId}`);
}
