-- =============================================================
-- Vettore — Prestação de Contas
-- 14_fornecedores.sql
-- Bloco Fornecedores: lista de empresas (nome + CNPJ) que cresce
-- conforme a necessidade, um por prestação. Documentos de cada
-- fornecedor (NF, comprovante, CND) ficam pra próxima etapa.
-- Versão: v0.23.0
-- =============================================================

create table if not exists prestacao_fornecedor (
  id           uuid primary key default gen_random_uuid(),
  prestacao_id uuid not null references prestacao_contas(id) on delete cascade,
  nome         text not null,
  cnpj         text,
  ordem        integer not null default 0,
  criado_em    timestamptz not null default now(),
  criado_por   uuid references perfil(id)
);

create index if not exists idx_prestacao_fornecedor_prestacao on prestacao_fornecedor(prestacao_id);

alter table prestacao_fornecedor enable row level security;

drop policy if exists prestacao_fornecedor_ler on prestacao_fornecedor;
create policy prestacao_fornecedor_ler on prestacao_fornecedor
  for select to authenticated
  using (exists (
    select 1 from prestacao_contas pc
     where pc.id = prestacao_fornecedor.prestacao_id
       and tem_permissao('prestacao.ver')
       and alcanca_unidade(pc.unidade_saude_id)
  ));

drop policy if exists prestacao_fornecedor_escrever on prestacao_fornecedor;
create policy prestacao_fornecedor_escrever on prestacao_fornecedor
  for all to authenticated
  using (exists (
    select 1 from prestacao_contas pc
     where pc.id = prestacao_fornecedor.prestacao_id
       and tem_permissao('prestacao.criar')
       and alcanca_unidade(pc.unidade_saude_id)
  ))
  with check (exists (
    select 1 from prestacao_contas pc
     where pc.id = prestacao_fornecedor.prestacao_id
       and tem_permissao('prestacao.criar')
       and alcanca_unidade(pc.unidade_saude_id)
  ));
