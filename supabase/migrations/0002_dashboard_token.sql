-- Token de acesso ao painel da criadora (/dashboard/[token]).
-- Acesso por link único (sem login/senha) — suficiente para o beta com poucas criadoras.
alter table creators
  add column dashboard_token text unique not null default encode(gen_random_bytes(16), 'hex');
