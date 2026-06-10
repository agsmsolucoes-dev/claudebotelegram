import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OfferPeriod } from "@/types/database";

const PERIOD_LABELS: Record<OfferPeriod, string> = {
  weekly: "Semanal",
  monthly: "Mensal",
  quarterly: "Trimestral",
  yearly: "Anual",
};

export default async function CreatorDashboardPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: creator, error: creatorError } = await supabase
    .from("creators")
    .select("*")
    .eq("dashboard_token", token)
    .maybeSingle();

  if (creatorError) throw creatorError;
  if (!creator) notFound();

  const { data: groups, error: groupsError } = await supabase
    .from("groups")
    .select("*")
    .eq("creator_id", creator.id);
  if (groupsError) throw groupsError;

  const { data: bots, error: botsError } = await supabase
    .from("bots")
    .select("*")
    .eq("creator_id", creator.id);
  if (botsError) throw botsError;

  const botById = new Map((bots ?? []).map((bot) => [bot.id, bot]));
  const groupIds = (groups ?? []).map((g) => g.id);

  const { data: offers, error: offersError } = groupIds.length
    ? await supabase.from("offers").select("*").in("group_id", groupIds).eq("active", true)
    : { data: [], error: null };
  if (offersError) throw offersError;

  const offersByGroup = new Map<string, typeof offers>();
  for (const offer of offers ?? []) {
    const list = offersByGroup.get(offer.group_id) ?? [];
    list.push(offer);
    offersByGroup.set(offer.group_id, list);
  }

  const offerIds = (offers ?? []).map((o) => o.id);

  const { count: activeSubscribers } = offerIds.length
    ? await supabase
        .from("subscriptions")
        .select("*", { count: "exact", head: true })
        .in("offer_id", offerIds)
        .eq("status", "active")
    : { count: 0 };

  const { data: balance } = await supabase
    .from("creator_balances")
    .select("available_amount")
    .eq("creator_id", creator.id)
    .maybeSingle();

  const currency = (offers ?? [])[0]?.price_currency ?? "ARS";
  const availableAmount = balance?.available_amount ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-3xl space-y-8">
        <header>
          <p className="text-sm font-medium text-slate-500">Painel da criadora</p>
          <h1 className="text-3xl font-bold tracking-tight">Olá, {creator.name} 👋</h1>
        </header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Saldo disponível</p>
            <p className="mt-2 text-3xl font-bold">
              {currency} {availableAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Assinantes ativos</p>
            <p className="mt-2 text-3xl font-bold">{activeSubscribers ?? 0}</p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Seus grupos</h2>

          {(groups ?? []).length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
              Nenhum grupo configurado ainda. Fale com o suporte pra finalizar a configuração.
            </div>
          )}

          {(groups ?? []).map((group) => {
            const bot = botById.get(group.bot_id);
            const groupOffers = offersByGroup.get(group.id) ?? [];

            return (
              <div key={group.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-semibold">{group.name}</h3>
                  {bot && (
                    <a
                      href={`https://t.me/${bot.bot_username}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
                    >
                      Abrir bot
                    </a>
                  )}
                </div>

                {bot && (
                  <p className="mt-1 text-sm text-slate-500">
                    Link pra divulgar: t.me/{bot.bot_username}
                  </p>
                )}

                <div className="mt-4 space-y-2">
                  {groupOffers.length === 0 && (
                    <p className="text-sm text-slate-500">Nenhuma oferta ativa.</p>
                  )}
                  {groupOffers.map((offer) => (
                    <div
                      key={offer.id}
                      className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm"
                    >
                      <span className="font-medium">{offer.name}</span>
                      <span className="text-slate-500">{PERIOD_LABELS[offer.period]}</span>
                      <span className="font-semibold">
                        {offer.price_currency} {offer.price_amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
