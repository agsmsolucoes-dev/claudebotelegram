import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pollPendingPayments } from "@/lib/engine/poll-payments";
import { processSubscriptionLifecycle } from "@/lib/engine/subscription-lifecycle";

/**
 * Job periódico (Vercel Cron, ex.: a cada 5-10min):
 * 1. Faz polling de pagamentos pendentes na GalioPay e libera acesso ao aprovar
 * 2. Envia lembretes D-7/D-3/D-1 e expulsa quem venceu
 *
 * Protegido por CRON_SECRET — configurar em vercel.json + env.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const supabase = createAdminClient();

  const payments = await pollPendingPayments(supabase);
  const lifecycle = await processSubscriptionLifecycle(supabase);

  return NextResponse.json({ ok: true, payments, lifecycle });
}
