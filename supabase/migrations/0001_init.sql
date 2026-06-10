-- Schema inicial do motor (creators, bots, grupos, ofertas, assinaturas, pagamentos, saques)

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────
-- CREATORS
-- ─────────────────────────────────────────────
create table creators (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text not null,
  support_contact text,                 -- @usuario do Telegram para suporte aos assinantes
  commission_pct numeric(5,2) not null default 10.00,   -- % cobrado pela plataforma
  commission_fixed numeric(10,2) not null default 0,    -- fee fixo por transação (mesma moeda do pagamento)
  payout_account jsonb,                 -- dados de recebimento (CVU/conta GalioPay)
  auto_withdraw boolean not null default false,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- BOTS (1 bot do Telegram por criadora, via BotFather)
-- ─────────────────────────────────────────────
create table bots (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  bot_token text not null,              -- token do BotFather (TODO: criptografar em produção)
  bot_username text not null,
  webhook_secret text not null default encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now(),
  unique (bot_username)
);

-- ─────────────────────────────────────────────
-- GROUPS (grupo/canal VIP no Telegram)
-- ─────────────────────────────────────────────
create table groups (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  bot_id uuid not null references bots(id) on delete cascade,
  telegram_chat_id bigint not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (bot_id, telegram_chat_id)
);

-- ─────────────────────────────────────────────
-- OFFERS (planos de assinatura de um grupo)
-- ─────────────────────────────────────────────
create type offer_period as enum ('weekly', 'monthly', 'quarterly', 'yearly');

create table offers (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  name text not null,
  period offer_period not null,
  price_amount numeric(10,2) not null,
  price_currency text not null default 'ARS',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- SUBSCRIPTIONS (assinante de uma oferta)
-- ─────────────────────────────────────────────
create type subscription_status as enum ('pending', 'active', 'expired', 'cancelled');

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references offers(id) on delete cascade,
  telegram_user_id bigint not null,
  telegram_username text,
  status subscription_status not null default 'pending',
  current_period_end timestamptz,
  reminder_7d_sent_at timestamptz,
  reminder_3d_sent_at timestamptz,
  reminder_1d_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (offer_id, telegram_user_id)
);

-- ─────────────────────────────────────────────
-- PAYMENTS (pagamentos via GalioPay)
-- ─────────────────────────────────────────────
create type payment_status as enum ('pending', 'approved', 'rejected', 'refunded');

create table payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references subscriptions(id) on delete cascade,
  reference_id text not null unique,         -- nosso ID interno, mapeado no GalioPay
  galiopay_payment_link_id text,
  galiopay_payment_id text,
  galiopay_proof_token text,                 -- token usado em GET /payment-links/{id}?proof= (sem auth)
  payment_url text,                          -- link de pagamento gerado pela GalioPay
  status payment_status not null default 'pending',
  amount numeric(10,2) not null,             -- valor bruto pago pelo assinante
  currency text not null default 'ARS',
  commission_amount numeric(10,2) not null,  -- nosso corte (% + fixo)
  net_amount numeric(10,2) not null,         -- valor líquido da criadora
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

-- ─────────────────────────────────────────────
-- WITHDRAWALS (saques solicitados pela criadora)
-- ─────────────────────────────────────────────
create type withdrawal_status as enum ('pending', 'processing', 'completed', 'failed');

create table withdrawals (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  amount numeric(10,2) not null,
  currency text not null default 'ARS',
  status withdrawal_status not null default 'pending',
  requested_at timestamptz not null default now(),
  processed_at timestamptz
);

-- ─────────────────────────────────────────────
-- VIEW: saldo por criadora (disponível vs. pendente)
-- "pendente" = pagamentos aprovados ainda dentro da janela de liberação do GalioPay (moneyReleaseDate)
-- como o motor não guarda moneyReleaseDate por enquanto, tratamos via campo a adicionar futuramente;
-- v1: disponível = aprovados - já sacados
-- ─────────────────────────────────────────────
create view creator_balances as
select
  c.id as creator_id,
  coalesce(sum(p.net_amount) filter (where p.status = 'approved'), 0)
    - coalesce((select sum(w.amount) from withdrawals w
                where w.creator_id = c.id and w.status in ('completed', 'processing')), 0)
    as available_amount
from creators c
left join groups g on g.creator_id = c.id
left join offers o on o.group_id = g.id
left join subscriptions s on s.offer_id = o.id
left join payments p on p.subscription_id = s.id
group by c.id;

-- ─────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────
create index idx_bots_creator on bots(creator_id);
create index idx_groups_creator on groups(creator_id);
create index idx_groups_bot on groups(bot_id);
create index idx_offers_group on offers(group_id);
create index idx_subscriptions_offer on subscriptions(offer_id);
create index idx_subscriptions_status on subscriptions(status);
create index idx_payments_subscription on payments(subscription_id);
create index idx_payments_status on payments(status);
create index idx_withdrawals_creator on withdrawals(creator_id);
