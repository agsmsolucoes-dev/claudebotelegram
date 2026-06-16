-- URL de checkout do Hotmart por oferta (ex: https://pay.hotmart.com/UCODE?offer=CODE)
-- Quando preenchido, o bot usa Hotmart em vez de GalioPay/Wompi para essa oferta
alter table offers
  add column if not exists hotmart_checkout_url text;

-- Evita aprovar a mesma transação Hotmart duas vezes
alter table payments
  add column if not exists hotmart_transaction_id text unique;
