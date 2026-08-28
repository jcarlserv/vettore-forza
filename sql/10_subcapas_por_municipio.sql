-- =============================================================
-- Vettore — Prestação de Contas
-- 10_subcapas_por_municipio.sql
-- Liga/desliga subcapa por documento, com título opcional,
-- editável na tela (por município). Sem essa linha aqui pro
-- documento, vale o padrão do documento_catalogo (tem_subcapa
-- global, título = rótulo do documento).
-- Versão: v0.16.0
-- =============================================================

create table if not exists capa_documento_config (
  municipio_id uuid not null references municipio(id) on delete cascade,
  chave        text not null references documento_catalogo(chave),
  tem_subcapa  boolean not null default false,
  titulo       text,
  primary key (municipio_id, chave)
);

alter table capa_documento_config enable row level security;

drop policy if exists capa_documento_ler on capa_documento_config;
create policy capa_documento_ler on capa_documento_config
  for select to authenticated
  using (tem_permissao('prestacao.ver') and alcanca_municipio(municipio_id));

drop policy if exists capa_documento_escrever on capa_documento_config;
create policy capa_documento_escrever on capa_documento_config
  for all to authenticated
  using (tem_permissao('config.municipios.editar') and alcanca_municipio(municipio_id))
  with check (tem_permissao('config.municipios.editar') and alcanca_municipio(municipio_id));
