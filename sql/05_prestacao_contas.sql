-- =============================================================
-- Vettore — Prestação de Contas
-- 05_prestacao_contas.sql
-- Cabeçalho da prestação mensal + catálogo de documentos dos
-- blocos "Dados da Organização" e "Financeiro" + os arquivos
-- enviados (guardados no Google Drive, só o metadado fica aqui).
-- Versão: v0.8.0
-- =============================================================
-- Rode depois do 01, 02, 03 e 04. Idempotente.
-- =============================================================


-- -------------------------------------------------------------
-- 1. PRESTAÇÃO DE CONTAS (cabeçalho — um por unidade/mês/ano)
-- -------------------------------------------------------------

create table if not exists prestacao_contas (
  id                  uuid primary key default gen_random_uuid(),
  unidade_saude_id    uuid not null references unidade_saude(id) on delete restrict,
  contrato_gestao_id  uuid references contrato_gestao(id),
  edital              text,
  contrato            text,
  mes                 smallint not null check (mes between 1 and 12),
  ano                 smallint not null check (ano between 2000 and 2100),
  status              text not null default 'Rascunho'
                       check (status in ('Rascunho','Em_Revisao','Concluido')),
  criado_por          uuid references perfil(id),
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  unique (unidade_saude_id, mes, ano)
);

create index if not exists idx_prestacao_unidade on prestacao_contas(unidade_saude_id);

create or replace function _tocar_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists trg_prestacao_atualizado on prestacao_contas;
create trigger trg_prestacao_atualizado
  before update on prestacao_contas
  for each row execute function _tocar_atualizado_em();


-- -------------------------------------------------------------
-- 2. CATÁLOGO DE DOCUMENTOS
-- -------------------------------------------------------------
-- Mesmo princípio do permissao_catalogo: nenhum campo de upload
-- fica escrito no HTML. Um bloco novo entra só com SQL.

create table if not exists documento_catalogo (
  chave     text primary key,
  bloco     text not null check (bloco in ('organizacao','financeiro')),
  rotulo    text not null,
  multiplo  boolean not null default false,   -- true = aceita o "+"
  ordem     integer not null default 100,
  criado_em timestamptz not null default now()
);

create or replace function registrar_documento(
  p_chave    text,
  p_bloco    text,
  p_rotulo   text,
  p_multiplo boolean,
  p_ordem    integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into documento_catalogo (chave, bloco, rotulo, multiplo, ordem)
  values (p_chave, p_bloco, p_rotulo, p_multiplo, coalesce(p_ordem, 100))
  on conflict (chave) do update
    set bloco    = excluded.bloco,
        rotulo   = excluded.rotulo,
        multiplo = excluded.multiplo,
        ordem    = excluded.ordem;
end;
$$;


-- -------------------------------------------------------------
-- 3. DOCUMENTOS DO BLOCO 2 — Dados da Organização
-- -------------------------------------------------------------

select registrar_documento('estatuto_social',               'organizacao', 'Estatuto Social',                     false, 10);
select registrar_documento('plano_estrategico',              'organizacao', 'Plano Estratégico',                   false, 20);
select registrar_documento('politica_financas',              'organizacao', 'Política de Finanças',                false, 30);
select registrar_documento('politica_rh',                    'organizacao', 'Política de Recursos Humanos',        false, 40);
select registrar_documento('programa_integridade',           'organizacao', 'Programa de Integridade',             false, 50);
select registrar_documento('programa_logistica_sustentavel', 'organizacao', 'Programa de Logística Sustentável',   false, 60);


-- -------------------------------------------------------------
-- 4. DOCUMENTOS DO BLOCO 3 — Financeiro
-- -------------------------------------------------------------
-- As 5 CNDs são fixas aqui (regra do blueprint: exceção de CND é
-- por fornecedor, nunca configurável globalmente neste catálogo).

select registrar_documento('extrato_bancario',       'financeiro', 'Extrato Bancário',         true,  10);
select registrar_documento('balancete',               'financeiro', 'Balancete',                false, 20);
select registrar_documento('demonstrativo_financeiro','financeiro', 'Demonstrativo Financeiro', false, 30);
select registrar_documento('medicao',                 'financeiro', 'Medição',                  true,  40);
select registrar_documento('oficio_fechamento',       'financeiro', 'Ofício de Fechamento',     true,  50);
select registrar_documento('cnd_municipal',           'financeiro', 'CND Municipal',            false, 60);
select registrar_documento('cnd_estadual',            'financeiro', 'CND Estadual',             false, 70);
select registrar_documento('cnd_federal',             'financeiro', 'CND Federal',              false, 80);
select registrar_documento('cnd_fgts',                'financeiro', 'CND FGTS (CRF)',           false, 90);
select registrar_documento('cnd_trabalhista',         'financeiro', 'CND Trabalhista',          false, 100);


-- -------------------------------------------------------------
-- 5. ARQUIVOS ENVIADOS
-- -------------------------------------------------------------
-- O arquivo em si vive no Google Drive (Edge Function upload-drive).
-- Aqui fica só o metadado de onde achá-lo.

create table if not exists prestacao_documento (
  id               uuid primary key default gen_random_uuid(),
  prestacao_id     uuid not null references prestacao_contas(id) on delete cascade,
  chave            text not null references documento_catalogo(chave),
  nome_arquivo     text not null,
  arquivo_drive_id text not null,
  arquivo_url      text not null,
  enviado_por      uuid references perfil(id),
  enviado_em       timestamptz not null default now()
);

create index if not exists idx_prestacao_doc_prestacao on prestacao_documento(prestacao_id);
create index if not exists idx_prestacao_doc_chave      on prestacao_documento(chave);


-- -------------------------------------------------------------
-- 6. RLS
-- -------------------------------------------------------------

alter table prestacao_contas    enable row level security;
alter table documento_catalogo  enable row level security;
alter table prestacao_documento enable row level security;

-- Catálogo: leitura para qualquer autenticado, sem escrita pelo app.
drop policy if exists doc_catalogo_ler on documento_catalogo;
create policy doc_catalogo_ler on documento_catalogo
  for select to authenticated using (true);

-- Prestação: só quem alcança a unidade e tem a permissão.
drop policy if exists prestacao_ler on prestacao_contas;
create policy prestacao_ler on prestacao_contas
  for select to authenticated
  using (tem_permissao('prestacao.ver') and alcanca_unidade(unidade_saude_id));

drop policy if exists prestacao_inserir on prestacao_contas;
create policy prestacao_inserir on prestacao_contas
  for insert to authenticated
  with check (tem_permissao('prestacao.criar') and alcanca_unidade(unidade_saude_id));

drop policy if exists prestacao_alterar on prestacao_contas;
create policy prestacao_alterar on prestacao_contas
  for update to authenticated
  using (tem_permissao('prestacao.criar') and alcanca_unidade(unidade_saude_id))
  with check (tem_permissao('prestacao.criar') and alcanca_unidade(unidade_saude_id));

-- Documentos: alcance decidido pela unidade da prestação-pai.
drop policy if exists prestacao_doc_ler on prestacao_documento;
create policy prestacao_doc_ler on prestacao_documento
  for select to authenticated
  using (exists (
    select 1 from prestacao_contas pc
     where pc.id = prestacao_documento.prestacao_id
       and tem_permissao('prestacao.ver')
       and alcanca_unidade(pc.unidade_saude_id)
  ));

drop policy if exists prestacao_doc_inserir on prestacao_documento;
create policy prestacao_doc_inserir on prestacao_documento
  for insert to authenticated
  with check (exists (
    select 1 from prestacao_contas pc
     where pc.id = prestacao_documento.prestacao_id
       and tem_permissao('prestacao.enviar_arquivo')
       and alcanca_unidade(pc.unidade_saude_id)
  ));

drop policy if exists prestacao_doc_excluir on prestacao_documento;
create policy prestacao_doc_excluir on prestacao_documento
  for delete to authenticated
  using (exists (
    select 1 from prestacao_contas pc
     where pc.id = prestacao_documento.prestacao_id
       and tem_permissao('prestacao.excluir_arquivo')
       and alcanca_unidade(pc.unidade_saude_id)
  ));
