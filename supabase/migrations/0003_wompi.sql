-- Adiciona campo para rastrear payment links da Wompi (Colômbia/COP)
alter table payments
  add column if not exists wompi_payment_link_id text;

create index if not exists idx_payments_wompi_link on payments(wompi_payment_link_id)
  where wompi_payment_link_id is not null;
