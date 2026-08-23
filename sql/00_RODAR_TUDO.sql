-- =============================================================
-- Vettore — 00_RODAR_TUDO.sql
-- Cole INTEIRO no SQL Editor do Supabase e clique em Run.
-- Faz o que os scripts 02 e 03 fazem, de uma vez.
-- Pode rodar mais de uma vez sem quebrar nada.
-- =============================================================

-- =============================================================
-- Vettore — Prestação de Contas
-- 02_cadastros.sql
-- Municípios, unidades de saúde, endereços, logomarcas e os
-- vínculos de usuário com município e unidade.
-- Versão: v0.2.0
-- =============================================================
-- Rode depois do 01_fundacao_acesso.sql. Idempotente.
-- =============================================================


-- -------------------------------------------------------------
-- 1. ENDEREÇO E LOGO DA ORGANIZAÇÃO
-- -------------------------------------------------------------
-- Campos separados, não um texto único: o endereço vai impresso
-- nas capas do PDF e em ofício, onde cada parte tem seu lugar.

alter table organizacao add column if not exists nome_fantasia text;
alter table organizacao add column if not exists cep           varchar(9);
alter table organizacao add column if not exists logradouro    text;
alter table organizacao add column if not exists numero        text;
alter table organizacao add column if not exists complemento   text;
alter table organizacao add column if not exists bairro        text;
alter table organizacao add column if not exists cidade        text;
alter table organizacao add column if not exists uf            varchar(2);


-- -------------------------------------------------------------
-- 2. MUNICÍPIO
-- -------------------------------------------------------------
-- O contratante. A logo aqui é o brasão, que entra nas capas.

create table if not exists municipio (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  uf             varchar(2) not null,
  codigo_ibge    text,
  cnpj           varchar(18),
  prefeito       text,
  secretaria_saude text,
  email          text,
  telefone       text,
  logo_data_url  text,
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  criado_por     uuid references perfil(id)
);

create unique index if not exists idx_municipio_nome_uf
  on municipio (lower(nome), uf);


-- -------------------------------------------------------------
-- 3. UNIDADE DE SAÚDE
-- -------------------------------------------------------------

create table if not exists unidade_saude (
  id            uuid primary key default gen_random_uuid(),
  municipio_id  uuid not null references municipio(id) on delete restrict,
  nome          text not null,
  tipo          text not null default 'Hospital',
  cnpj          varchar(18),
  cnes          text,
  responsavel   text,
  email         text,
  telefone      text,
  cep           varchar(9),
  logradouro    text,
  numero        text,
  complemento   text,
  bairro        text,
  logo_data_url text,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  criado_por    uuid references perfil(id)
);

create unique index if not exists idx_unidade_nome_municipio
  on unidade_saude (municipio_id, lower(nome));

create index if not exists idx_unidade_municipio on unidade_saude(municipio_id);


-- -------------------------------------------------------------
-- 4. CONTRATO DE GESTÃO
-- -------------------------------------------------------------

create table if not exists contrato_gestao (
  id               uuid primary key default gen_random_uuid(),
  unidade_saude_id uuid not null references unidade_saude(id) on delete cascade,
  numero_contrato  text not null,
  objeto           text,
  valor_mensal     numeric(14,2),
  data_inicio      date,
  data_fim         date,
  criado_em        timestamptz not null default now()
);

create index if not exists idx_contrato_unidade on contrato_gestao(unidade_saude_id);


-- -------------------------------------------------------------
-- 5. VÍNCULOS DO USUÁRIO
-- -------------------------------------------------------------
-- Duas formas de alcance, propositalmente separadas:
--
--   usuario_unidade   → esta pessoa, nesta unidade.
--   usuario_municipio → esta pessoa, em TODAS as unidades deste
--                       município, inclusive as que forem criadas
--                       depois. É o caso do gerente do município.
--
-- São independentes do papel. Um Usuário pode ter cinco unidades;
-- um Gestor, uma só. Papel diz o que a pessoa faz; vínculo diz onde.

-- A FK ficou pendente no script 01, porque a tabela unidade_saude
-- ainda não existia. Agora existe.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'usuario_unidade_unidade_fk'
  ) then
    delete from usuario_unidade
     where unidade_saude_id not in (select id from unidade_saude);

    alter table usuario_unidade
      add constraint usuario_unidade_unidade_fk
      foreign key (unidade_saude_id) references unidade_saude(id) on delete cascade;
  end if;
end $$;

create table if not exists usuario_municipio (
  perfil_id    uuid not null references perfil(id) on delete cascade,
  municipio_id uuid not null references municipio(id) on delete cascade,
  primary key (perfil_id, municipio_id)
);


-- -------------------------------------------------------------
-- 6. ALCANCE — versão atualizada
-- -------------------------------------------------------------
-- Agora considera o vínculo por município.

create or replace function alcanca_unidade(p_unidade_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when meu_papel() in ('Administrador','Gestao') then true
    else exists (
      select 1 from usuario_unidade
       where perfil_id = auth.uid() and unidade_saude_id = p_unidade_id
    ) or exists (
      select 1
        from usuario_municipio um
        join unidade_saude u on u.municipio_id = um.municipio_id
       where um.perfil_id = auth.uid() and u.id = p_unidade_id
    )
  end;
$$;

create or replace function alcanca_municipio(p_municipio_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when meu_papel() in ('Administrador','Gestao') then true
    else exists (
      select 1 from usuario_municipio
       where perfil_id = auth.uid() and municipio_id = p_municipio_id
    ) or exists (
      select 1 from usuario_unidade uu
        join unidade_saude u on u.id = uu.unidade_saude_id
       where uu.perfil_id = auth.uid() and u.municipio_id = p_municipio_id
    )
  end;
$$;


-- -------------------------------------------------------------
-- 7. PERMISSÕES NOVAS
-- -------------------------------------------------------------

select registrar_permissao('config.municipios.ver',    'Cadastros', 'Ver municípios',
  'Consultar a lista de municípios contratantes.', 72, array['Administrador','Gestao','Gestor','Coordenador','Usuario']);

select registrar_permissao('config.municipios.editar', 'Cadastros', 'Criar e editar municípios',
  'Cadastrar municípios, brasão e dados de contato.', 74, array['Administrador','Gestao']);

select registrar_permissao('config.municipios.excluir','Cadastros', 'Excluir municípios',
  'Remover um município sem unidades vinculadas.', 76, array['Administrador']);

select registrar_permissao('config.unidades.ver',      'Cadastros', 'Ver unidades',
  'Consultar as unidades de saúde.', 78, array['Administrador','Gestao','Gestor','Coordenador','Usuario']);

select registrar_permissao('config.unidades.editar',   'Cadastros', 'Criar e editar unidades',
  'Cadastrar unidades, logo, endereço e responsável.', 79, array['Administrador','Gestao']);

select registrar_permissao('config.unidades.excluir',  'Cadastros', 'Excluir unidades',
  'Remover uma unidade sem prestações lançadas.', 79, array['Administrador']);

select registrar_permissao('config.usuarios.excluir',  'Usuários',  'Excluir usuários',
  'Remover o acesso de uma pessoa ao sistema.', 55, array['Administrador']);


-- -------------------------------------------------------------
-- 8. RLS
-- -------------------------------------------------------------

alter table municipio          enable row level security;
alter table unidade_saude      enable row level security;
alter table contrato_gestao    enable row level security;
alter table usuario_municipio  enable row level security;

-- Município e unidade: cada um enxerga só onde tem alcance.
drop policy if exists municipio_ler on municipio;
create policy municipio_ler on municipio
  for select to authenticated
  using (tem_permissao('config.municipios.ver') and alcanca_municipio(id));

drop policy if exists municipio_escrever on municipio;
create policy municipio_escrever on municipio
  for all to authenticated
  using (tem_permissao('config.municipios.editar'))
  with check (tem_permissao('config.municipios.editar'));

drop policy if exists unidade_ler on unidade_saude;
create policy unidade_ler on unidade_saude
  for select to authenticated
  using (tem_permissao('config.unidades.ver') and alcanca_unidade(id));

drop policy if exists unidade_escrever on unidade_saude;
create policy unidade_escrever on unidade_saude
  for all to authenticated
  using (tem_permissao('config.unidades.editar'))
  with check (tem_permissao('config.unidades.editar'));

drop policy if exists contrato_ler on contrato_gestao;
create policy contrato_ler on contrato_gestao
  for select to authenticated
  using (alcanca_unidade(unidade_saude_id));

drop policy if exists contrato_escrever on contrato_gestao;
create policy contrato_escrever on contrato_gestao
  for all to authenticated
  using (tem_permissao('cadastro.editar'))
  with check (tem_permissao('cadastro.editar'));

drop policy if exists usuario_municipio_ler on usuario_municipio;
create policy usuario_municipio_ler on usuario_municipio
  for select to authenticated
  using (perfil_id = auth.uid() or tem_permissao('config.usuarios.ver'));

drop policy if exists usuario_municipio_escrever on usuario_municipio;
create policy usuario_municipio_escrever on usuario_municipio
  for all to authenticated
  using (tem_permissao('config.unidades.atribuir'))
  with check (tem_permissao('config.unidades.atribuir'));


-- -------------------------------------------------------------
-- 9. CONFERÊNCIA
-- -------------------------------------------------------------

select
  (select count(*) from permissao_catalogo) as permissoes,
  (select count(*) from municipio)          as municipios,
  (select count(*) from unidade_saude)      as unidades;
-- =============================================================
-- Vettore — Prestação de Contas
-- 03_tema.sql
-- Amplia a identidade visual: além da cor da marca, agora a
-- organização define destaque, barra superior e fundo.
-- Versão: v0.3.0
-- =============================================================
-- Rode depois do 02_cadastros.sql. Idempotente.
-- =============================================================

alter table organizacao add column if not exists cor_secundaria text default '#00A3E0';
alter table organizacao add column if not exists cor_topo       text default '#143A70';
alter table organizacao add column if not exists cor_fundo      text default '#F4F6FA';
alter table organizacao add column if not exists tema           text default 'vettore';

-- Quem já tinha só a cor da marca continua funcionando: os campos
-- novos nascem com o tema Vettore e podem ser trocados na tela.
update organizacao
   set cor_marca = coalesce(cor_marca, '#1F55A5'),
       cor_secundaria = coalesce(cor_secundaria, '#00A3E0'),
       cor_topo = coalesce(cor_topo, '#143A70'),
       cor_fundo = coalesce(cor_fundo, '#F4F6FA')
 where cor_secundaria is null or cor_topo is null or cor_fundo is null;

select razao_social, cor_marca, cor_secundaria, cor_topo, cor_fundo, tema
  from organizacao;


-- -------------------------------------------------------------
-- FIM: avisar a API que o banco mudou
-- -------------------------------------------------------------
-- Sem isto o erro "Could not find the column ... in the schema
-- cache" continua aparecendo mesmo com a coluna já criada.

notify pgrst, 'reload schema';

select 'Pronto. Recarregue o sistema com Ctrl+Shift+R.' as resultado;
