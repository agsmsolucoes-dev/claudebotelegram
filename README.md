# Plataforma — Telegram VIP SaaS (Argentina/LATAM)

Motor de automação de assinaturas VIP no Telegram para criadoras de conteúdo,
com pagamentos via [GalioPay](https://pay.galio.app) (CVU/transferência, Argentina).
Inspirado no SharkBot/Vibx — contexto de produto e decisões em
`../CLAUDE.md` (agente "DARWIN").

## Stack

- **Next.js 16** (App Router, Route Handlers como API)
- **Supabase** (Postgres) — schema em `supabase/migrations/0001_init.sql`
- **GalioPay** — processamento de pagamento (CVU)
- **Telegram Bot API** — um bot por criadora, webhook multi-tenant

## Arquitetura (motor)

```
src/
  app/api/
    telegram/[botId]/route.ts    # webhook multi-tenant — 1 endpoint p/ todos os bots
    cron/subscriptions/route.ts  # job periódico: poll GalioPay + lembretes/expiração
    bots/register/route.ts       # registra bot da criadora (token BotFather) + setWebhook
  lib/
    galiopay/                    # cliente da API GalioPay (payment-links, payments, refund)
    telegram/                    # cliente da Bot API (sendMessage, kick, invite links...)
    engine/                      # lógica de negócio: poll de pagamentos, ciclo de vida da assinatura
    subscriptions.ts             # cálculo de período/comissão
    supabase/admin.ts            # client Supabase (service role, server-only)
  types/database.ts              # tipos das tabelas (espelha a migration)
```

### Fluxo de assinatura

1. Criadora cola o token do bot (gerado via @BotFather) na dashboard →
   `POST /api/bots/register` valida o token, salva o bot e chama `setWebhook`
   apontando para `/api/telegram/{botId}`.
2. Criadora cria grupo + oferta na dashboard (escreve direto nas tabelas
   `groups`/`offers` via Supabase).
3. Assinante clica no link `https://t.me/{bot}?start=offer_{offerId}` →
   webhook gera o payment link na GalioPay e responde no chat.
4. Cron (`/api/cron/subscriptions`, a cada 10min via `vercel.json`) faz
   polling do status na GalioPay; ao aprovar, ativa a assinatura e envia
   convite de uso único pro grupo.
5. Mesmo cron cuida de lembretes D-7/D-3/D-1 e expulsão automática (kick)
   quando a assinatura vence.

## Setup local

```bash
npm install
cp .env.example .env.local   # preencher com as credenciais (ver abaixo)
npm run dev
```

### Variáveis de ambiente (`.env.local`)

| Variável | Onde conseguir |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Painel do projeto Supabase → Settings → API |
| `GALIOPAY_API_KEY` / `GALIOPAY_CLIENT_ID` | `admin-pay.galio.app` → Configuración |
| `APP_URL` | Domínio público da aplicação (produção) ou URL do túnel (dev) |
| `CRON_SECRET` | String aleatória — Vercel injeta automaticamente como Bearer token nas chamadas de cron |

### Banco de dados

Aplicar a migration em `supabase/migrations/0001_init.sql` no projeto Supabase
(via SQL editor do painel ou `supabase db push` com a CLI).

## Pendências conhecidas (validar com conta GalioPay real)

Ver seção "O que falta validar com conta real" em `../CLAUDE.md`:
valores reais de `status` em `GET /payments/{id}`, se `proofToken` vem no
retorno do `POST /payment-links`, e taxas/condições de saque.

## Deploy

Vercel (Next.js + cron nativo via `vercel.json`). Conectar o repositório
GitHub ao projeto Vercel e configurar as variáveis de ambiente acima.
