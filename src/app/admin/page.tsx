import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { createCreator } from "./actions";

export default async function AdminPage() {
  const supabase = createAdminClient();

  const [{ data: creators, error: creatorsError }, { data: balances }] = await Promise.all([
    supabase.from("creators").select("*").order("created_at", { ascending: false }),
    supabase.from("creator_balances").select("*"),
  ]);

  if (creatorsError) throw creatorsError;

  const balanceByCreator = new Map(
    (balances ?? []).map((b) => [b.creator_id, b.available_amount])
  );

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold">Creators</h1>

        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left">
              <th className="py-2 pr-4">Nome</th>
              <th className="py-2 pr-4">Email</th>
              <th className="py-2 pr-4">Comissão</th>
              <th className="py-2 pr-4">Saldo disponível</th>
              <th className="py-2 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {(creators ?? []).map((creator) => (
              <tr key={creator.id} className="border-b border-zinc-100">
                <td className="py-2 pr-4">{creator.name}</td>
                <td className="py-2 pr-4">{creator.email}</td>
                <td className="py-2 pr-4">
                  {creator.commission_pct}% + {creator.commission_fixed}
                </td>
                <td className="py-2 pr-4">
                  {(balanceByCreator.get(creator.id) ?? 0).toFixed(2)}
                </td>
                <td className="py-2 pr-4">
                  <Link className="text-blue-600 underline" href={`/admin/creators/${creator.id}`}>
                    gerenciar
                  </Link>
                </td>
              </tr>
            ))}
            {(creators ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-zinc-500">
                  Nenhum creator cadastrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Novo creator</h2>

        <form action={createCreator} className="mt-4 grid max-w-md gap-3">
          <label className="grid gap-1">
            <span className="text-sm font-medium">Nome</span>
            <input name="name" required className="rounded border border-zinc-300 px-3 py-2" />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium">Email</span>
            <input
              type="email"
              name="email"
              required
              className="rounded border border-zinc-300 px-3 py-2"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium">Contato de suporte</span>
            <input name="support_contact" className="rounded border border-zinc-300 px-3 py-2" />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium">Comissão (%)</span>
            <input
              type="number"
              step="0.01"
              name="commission_pct"
              placeholder="10"
              className="rounded border border-zinc-300 px-3 py-2"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium">Comissão fixa</span>
            <input
              type="number"
              step="0.01"
              name="commission_fixed"
              placeholder="0"
              className="rounded border border-zinc-300 px-3 py-2"
            />
          </label>

          <button
            type="submit"
            className="mt-2 rounded bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-700"
          >
            Criar creator
          </button>
        </form>
      </section>
    </div>
  );
}
