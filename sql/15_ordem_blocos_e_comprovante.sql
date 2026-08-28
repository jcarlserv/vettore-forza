-- =============================================================
-- Vettore — Prestação de Contas
-- 15_ordem_blocos_e_comprovante.sql
-- 1) Catálogo de blocos, com ordem própria (corrige blocos
--    embaralhados — antes a ordenação usava só o "ordem" de
--    cada documento, que se repete em cada bloco).
-- 2) Comprovante de Pagamento, no Financeiro, logo após o
--    Ofício de Fechamento.
-- Versão: v0.24.0
-- =============================================================

create table if not exists bloco_catalogo (
  chave  text primary key,
  rotulo text not null,
  ordem  integer not null default 100
);

create or replace function registrar_bloco(p_chave text, p_rotulo text, p_ordem integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into bloco_catalogo (chave, rotulo, ordem)
  values (p_chave, p_rotulo, coalesce(p_ordem, 100))
  on conflict (chave) do update
    set rotulo = excluded.rotulo,
        ordem  = excluded.ordem;
end;
$$;

select registrar_bloco('organizacao', 'Dados da Organização', 10);
select registrar_bloco('financeiro',  'Financeiro',            20);

select registrar_documento('comprovante_pagamento', 'financeiro', 'Comprovante de Pagamento', true, 55);

alter table bloco_catalogo enable row level security;
drop policy if exists bloco_catalogo_ler on bloco_catalogo;
create policy bloco_catalogo_ler on bloco_catalogo
  for select to authenticated using (true);

-- Pra mudar a ordem ou o nome de um bloco depois, uma linha assim:
-- select registrar_bloco('financeiro', 'Financeiro', 15);
