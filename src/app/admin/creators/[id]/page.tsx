import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createGroup, createOffer, registerBotAction, toggleOfferActive } from "../../actions";
import { DashboardLink } from "./dashboard-link";

const PERIODS = ["weekly", "monthly", "quarterly", "yearly"] as const;

export default async function CreatorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: creator, error: creatorError } = await supabase
    .from("creators")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (creatorError) throw creatorError;
  if (!creator) notFound();

  const [{ data: bots, error: botsError }, { data: groups, error: groupsError }] =
    await Promise.all([
      supabase.from("bots").select("*").eq("creator_id", id),
      supabase.from("groups").select("*").eq("creator_id", id),
    ]);

  if (botsError) throw botsError;
  if (groupsError) throw groupsError;

  const groupIds = (groups ?? []).map((g) => g.id);

  const { data: offers, error: offersError } = groupIds.length
    ? await supabase.from("offers").select("*").in("group_id", groupIds)
    : { data: [], error: null };

  if (offersError) throw offersError;

  const offersByGroup = new Map<string, typeof offers>();
  for (const offer of offers ?? []) {
    const list = offersByGroup.get(offer.group_id) ?? [];
    list.push(offer);
    offersByGroup.set(offer.group_id, list);
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold">{creator.name}</h1>
        <p className="text-zinc-500">{creator.email}</p>
      </div>

      <section>
        <h2 className="text-lg font-semibold">Painel da criadora</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Link pessoal e sem login — envie pra ela acompanhar saldo e assinantes.
        </p>
        <div className="mt-3">
          <DashboardLink
            url={`${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/dashboard/${creator.dashboard_token}`}
          />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Bots</h2>

        <ul className="mt-2 space-y-1 text-sm">
          {(bots ?? []).map((bot) => (
            <li key={bot.id}>@{bot.bot_username}</li>
          ))}
          {(bots ?? []).length === 0 && (
            <li className="text-zinc-500">Nenhum bot registrado ainda.</li>
          )}
        </ul>

        <form action={registerBotAction} className="mt-4 flex max-w-md gap-2">
          <input type="hidden" name="creator_id" value={creator.id} />
          <input
            name="bot_token"
            placeholder="Token do @BotFather"
            required
            className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-700"
          >
            Registrar bot
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Grupos</h2>

        <ul className="mt-2 space-y-1 text-sm">
          {(groups ?? []).map((group) => (
            <li key={group.id}>
              {group.name} — chat_id {group.telegram_chat_id}
            </li>
          ))}
          {(groups ?? []).length === 0 && (
            <li className="text-zinc-500">Nenhum grupo cadastrado ainda.</li>
          )}
        </ul>

        {(bots ?? []).length > 0 ? (
          <form action={createGroup} className="mt-4 grid max-w-md gap-3">
            <input type="hidden" name="creator_id" value={creator.id} />

            <label className="grid gap-1">
              <span className="text-sm font-medium">Bot</span>
              <select
                name="bot_id"
                required
                className="rounded border border-zinc-300 px-3 py-2 text-sm"
              >
                {(bots ?? []).map((bot) => (
                  <option key={bot.id} value={bot.id}>
                    @{bot.bot_username}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1">
              <span className="text-sm font-medium">Telegram chat ID</span>
              <input
                type="number"
                name="telegram_chat_id"
                required
                className="rounded border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-sm font-medium">Nome do grupo</span>
              <input
                name="name"
                required
                className="rounded border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>

            <button
              type="submit"
              className="mt-2 rounded bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-700"
            >
              Criar grupo
            </button>
          </form>
        ) : (
          <p className="mt-4 text-sm text-zinc-500">Registre um bot antes de criar grupos.</p>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Ofertas</h2>

        {(groups ?? []).map((group) => (
          <div key={group.id} className="mt-4 rounded border border-zinc-200 p-4">
            <h3 className="font-medium">{group.name}</h3>

            <ul className="mt-2 space-y-1 text-sm">
              {(offersByGroup.get(group.id) ?? []).map((offer) => (
                <li key={offer.id} className="flex items-center gap-2">
                  <span>
                    {offer.name} — {offer.period} — {offer.price_amount} {offer.price_currency} —{" "}
                    {offer.active ? "ativa" : "inativa"}
                  </span>
                  <form action={toggleOfferActive}>
                    <input type="hidden" name="creator_id" value={creator.id} />
                    <input type="hidden" name="offer_id" value={offer.id} />
                    <input type="hidden" name="active" value={String(offer.active)} />
                    <button type="submit" className="text-blue-600 underline">
                      {offer.active ? "desativar" : "ativar"}
                    </button>
                  </form>
                </li>
              ))}
              {(offersByGroup.get(group.id) ?? []).length === 0 && (
                <li className="text-zinc-500">Nenhuma oferta cadastrada ainda.</li>
              )}
            </ul>

            <form action={createOffer} className="mt-3 grid max-w-md gap-3">
              <input type="hidden" name="creator_id" value={creator.id} />
              <input type="hidden" name="group_id" value={group.id} />

              <label className="grid gap-1">
                <span className="text-sm font-medium">Nome da oferta</span>
                <input
                  name="name"
                  required
                  className="rounded border border-zinc-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-sm font-medium">Periodicidade</span>
                <select
                  name="period"
                  required
                  className="rounded border border-zinc-300 px-3 py-2 text-sm"
                >
                  {PERIODS.map((period) => (
                    <option key={period} value={period}>
                      {period}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1">
                <span className="text-sm font-medium">Valor</span>
                <input
                  type="number"
                  step="0.01"
                  name="price_amount"
                  required
                  className="rounded border border-zinc-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-sm font-medium">Moeda</span>
                <input
                  name="price_currency"
                  placeholder="ARS"
                  className="rounded border border-zinc-300 px-3 py-2 text-sm"
                />
              </label>

              <button
                type="submit"
                className="mt-2 rounded bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-700"
              >
                Criar oferta
              </button>
            </form>
          </div>
        ))}

        {(groups ?? []).length === 0 && (
          <p className="mt-2 text-sm text-zinc-500">Crie um grupo antes de adicionar ofertas.</p>
        )}
      </section>
    </div>
  );
}
