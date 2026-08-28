-- =============================================================
-- Vettore — Prestação de Contas
-- 11_subcapas_por_prestacao.sql
-- Move a configuração de subcapa de "por município" pra "por
-- prestação" — cada mês pode ter uma configuração diferente.
-- Substitui capa_documento_config (removida).
-- Versão: v0.17.0
-- =============================================================

create table if not exists prestacao_documento_capa (
  prestacao_id uuid not null references prestacao_contas(id) on delete cascade,
  chave        text not null references documento_catalogo(chave),
  tem_subcapa  boolean not null default false,
  titulo       text,
  primary key (prestacao_id, chave)
);

alter table prestacao_documento_capa enable row level security;

drop policy if exists prestacao_doc_capa_ler on prestacao_documento_capa;
create policy prestacao_doc_capa_ler on prestacao_documento_capa
  for select to authenticated
  using (exists (
    select 1 from prestacao_contas pc
     where pc.id = prestacao_documento_capa.prestacao_id
       and tem_permissao('prestacao.ver')
       and alcanca_unidade(pc.unidade_saude_id)
  ));

drop policy if exists prestacao_doc_capa_escrever on prestacao_documento_capa;
create policy prestacao_doc_capa_escrever on prestacao_documento_capa
  for all to authenticated
  using (exists (
    select 1 from prestacao_contas pc
     where pc.id = prestacao_documento_capa.prestacao_id
       and tem_permissao('prestacao.criar')
       and alcanca_unidade(pc.unidade_saude_id)
  ))
  with check (exists (
    select 1 from prestacao_contas pc
     where pc.id = prestacao_documento_capa.prestacao_id
       and tem_permissao('prestacao.criar')
       and alcanca_unidade(pc.unidade_saude_id)
  ));

-- A configuração por município não é mais usada — pode remover.
drop table if exists capa_documento_config;
