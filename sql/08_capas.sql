-- =============================================================
-- Vettore — Prestação de Contas
-- 08_capas.sql
-- Layout das capas do PDF, editável por município.
-- Versão: v0.11.0
-- =============================================================

create table if not exists capa_municipio (
  municipio_id        uuid primary key references municipio(id) on delete cascade,
  subtitulo_prestacao text not null default 'GESTÃO DOS SERVIÇOS DE SAÚDE MUNICIPAL',
  texto_organizacao   text,
  atualizado_em        timestamptz not null default now(),
  atualizado_por        uuid references perfil(id)
);

create table if not exists capa_bloco_titulo (
  municipio_id uuid not null references municipio(id) on delete cascade,
  bloco        text not null,
  titulo       text not null,
  primary key (municipio_id, bloco)
);

alter table capa_municipio    enable row level security;
alter table capa_bloco_titulo enable row level security;

drop policy if exists capa_municipio_ler on capa_municipio;
create policy capa_municipio_ler on capa_municipio
  for select to authenticated
  using (tem_permissao('prestacao.ver') and alcanca_municipio(municipio_id));

drop policy if exists capa_municipio_escrever on capa_municipio;
create policy capa_municipio_escrever on capa_municipio
  for all to authenticated
  using (tem_permissao('config.municipios.editar') and alcanca_municipio(municipio_id))
  with check (tem_permissao('config.municipios.editar') and alcanca_municipio(municipio_id));

drop policy if exists capa_bloco_ler on capa_bloco_titulo;
create policy capa_bloco_ler on capa_bloco_titulo
  for select to authenticated
  using (tem_permissao('prestacao.ver') and alcanca_municipio(municipio_id));

drop policy if exists capa_bloco_escrever on capa_bloco_titulo;
create policy capa_bloco_escrever on capa_bloco_titulo
  for all to authenticated
  using (tem_permissao('config.municipios.editar') and alcanca_municipio(municipio_id))
  with check (tem_permissao('config.municipios.editar') and alcanca_municipio(municipio_id));
