-- =============================================================
-- Sistema de Prestação de Contas — OSC / Contrato de Gestão
-- 01_fundacao_acesso.sql
-- Fundação: perfis, papéis, catálogo de permissões, RLS
-- Versão: v0.1.0
-- =============================================================
-- Rodar no SQL Editor do Supabase, do início ao fim, uma vez.
-- Idempotente: pode rodar de novo sem quebrar.
-- =============================================================


-- -------------------------------------------------------------
-- 1. PAPÉIS
-- -------------------------------------------------------------
-- Os 5 papéis do sistema. Tabela (não enum) porque enum no Postgres
-- é doloroso de alterar depois, e papel é coisa que muda.

create table if not exists papel (
  codigo      text primary key,
  rotulo      text not null,
  descricao   text,
  nivel       integer not null,      -- 1 = mais amplo. Só ordena telas.
  ativo       boolean not null default true
);

insert into papel (codigo, rotulo, descricao, nivel) values
  ('Administrador', 'Administrador', 'Controle total do sistema, incluindo usuários e permissões.', 1),
  ('Gestao',        'Gestão',        'Visão institucional de todas as unidades. Acompanha, revisa e conclui prestações.', 2),
  ('Gestor',        'Gestor',        'Responsável pela prestação de contas das unidades atribuídas a ele.', 3),
  ('Coordenador',   'Coordenador',   'Opera as seções da prestação nas unidades atribuídas a ele.', 4),
  ('Usuario',       'Usuário',       'Consulta e envio de documentos nas unidades atribuídas a ele.', 5)
on conflict (codigo) do update
  set rotulo = excluded.rotulo,
      descricao = excluded.descricao,
      nivel = excluded.nivel;


-- -------------------------------------------------------------
-- 2. PERFIL (espelho de auth.users)
-- -------------------------------------------------------------
-- auth.users é gerenciado pelo Supabase e não deve ser alterado.
-- Tudo que é do negócio (papel, nome, status) mora aqui.

create table if not exists perfil (
  id           uuid primary key references auth.users(id) on delete cascade,
  nome         text not null,
  email        text not null,
  papel        text not null references papel(codigo),
  ativo        boolean not null default true,
  criado_em    timestamptz not null default now(),
  criado_por   uuid references perfil(id),
  ultimo_acesso timestamptz
);

create index if not exists idx_perfil_papel on perfil(papel);


-- -------------------------------------------------------------
-- 3. CATÁLOGO DE PERMISSÕES
-- -------------------------------------------------------------
-- Este é o mecanismo central: toda parametrização nova do sistema
-- vira UMA LINHA aqui + seus padrões por papel. A tela de
-- Configurações lê essa tabela e monta a matriz sozinha — nenhuma
-- permissão nova exige mexer no frontend.

create table if not exists permissao_catalogo (
  chave       text primary key,          -- 'fornecedor.nf.excluir'
  modulo      text not null,             -- agrupador na tela
  rotulo      text not null,             -- texto que o operador lê
  descricao   text,
  ordem       integer not null default 100,
  criado_em   timestamptz not null default now()
);

-- Padrão por papel: o que cada papel pode, salvo sobrescrita.
create table if not exists permissao_papel (
  papel      text not null references papel(codigo) on delete cascade,
  chave      text not null references permissao_catalogo(chave) on delete cascade,
  permitido  boolean not null default false,
  primary key (papel, chave)
);

-- Sobrescrita individual: exceção pontual para uma pessoa.
-- Ausência de linha = herda do papel.
create table if not exists permissao_usuario (
  perfil_id  uuid not null references perfil(id) on delete cascade,
  chave      text not null references permissao_catalogo(chave) on delete cascade,
  permitido  boolean not null,
  definido_por uuid references perfil(id),
  definido_em  timestamptz not null default now(),
  primary key (perfil_id, chave)
);


-- -------------------------------------------------------------
-- 4. ESCOPO POR UNIDADE
-- -------------------------------------------------------------
-- Permissão responde "o quê". Isto responde "onde".
-- Administrador e Gestão enxergam tudo; os demais só o que estiver aqui.

create table if not exists usuario_unidade (
  perfil_id       uuid not null references perfil(id) on delete cascade,
  unidade_saude_id uuid not null,   -- FK criada no script 02, junto da tabela
  primary key (perfil_id, unidade_saude_id)
);


-- -------------------------------------------------------------
-- 5. FUNÇÕES DE APOIO
-- -------------------------------------------------------------
-- SECURITY DEFINER de propósito: estas funções são chamadas dentro
-- das próprias policies de RLS. Se respeitassem RLS, a policy da
-- tabela perfil chamaria uma função que lê perfil — recursão infinita.

create or replace function meu_papel()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select papel from perfil where id = auth.uid() and ativo = true;
$$;

create or replace function tem_permissao(p_chave text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    -- 1º: sobrescrita individual, se existir
    (select pu.permitido
       from permissao_usuario pu
       join perfil p on p.id = pu.perfil_id
      where pu.perfil_id = auth.uid()
        and pu.chave = p_chave
        and p.ativo = true),
    -- 2º: padrão do papel
    (select pp.permitido
       from permissao_papel pp
       join perfil p on p.papel = pp.papel
      where p.id = auth.uid()
        and p.ativo = true
        and pp.chave = p_chave),
    -- 3º: nada declarado = negado
    false
  );
$$;

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
       where perfil_id = auth.uid()
         and unidade_saude_id = p_unidade_id
    )
  end;
$$;

-- Registra uma parametrização nova e já define quem pode usá-la.
-- É a única forma de criar permissão neste projeto — cada feature
-- nova chama isto uma vez, e a tela de Configurações se atualiza sozinha.
create or replace function registrar_permissao(
  p_chave     text,
  p_modulo    text,
  p_rotulo    text,
  p_descricao text,
  p_ordem     integer,
  p_papeis    text[]        -- papéis que já nascem com ela liberada
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into permissao_catalogo (chave, modulo, rotulo, descricao, ordem)
  values (p_chave, p_modulo, p_rotulo, p_descricao, coalesce(p_ordem, 100))
  on conflict (chave) do update
    set modulo = excluded.modulo,
        rotulo = excluded.rotulo,
        descricao = excluded.descricao,
        ordem = excluded.ordem;

  -- toda combinação papel × chave existe explicitamente:
  -- a matriz da tela nunca fica com buraco
  insert into permissao_papel (papel, chave, permitido)
  select pa.codigo, p_chave, (pa.codigo = any(p_papeis))
    from papel pa
  on conflict (papel, chave) do nothing;
end;
$$;


-- -------------------------------------------------------------
-- 6. PERMISSÕES INICIAIS
-- -------------------------------------------------------------
-- Ponto de partida, não palavra final: tudo isso é editável na
-- aba Configurações sem tocar em SQL de novo.

select registrar_permissao('config.acessar',           'Configurações', 'Abrir a aba Configurações',        'Ver a área de configurações do sistema.',            10, array['Administrador','Gestao']);
select registrar_permissao('config.organizacao.editar','Configurações', 'Editar dados da organização',      'Alterar razão social, CNPJ e contatos da OSC.',      20, array['Administrador']);
select registrar_permissao('config.visual.editar',     'Configurações', 'Editar identidade visual',         'Trocar logo e cores do sistema.',                    30, array['Administrador']);
select registrar_permissao('config.usuarios.ver',      'Usuários',      'Ver usuários',                     'Listar as pessoas com acesso ao sistema.',           40, array['Administrador','Gestao']);
select registrar_permissao('config.usuarios.editar',   'Usuários',      'Criar e editar usuários',          'Cadastrar pessoas, trocar papel e inativar acesso.', 50, array['Administrador']);
select registrar_permissao('config.permissoes.editar', 'Usuários',      'Editar permissões',                'Alterar o padrão de cada papel e as exceções individuais.', 60, array['Administrador']);
select registrar_permissao('config.unidades.atribuir', 'Usuários',      'Atribuir unidades a usuários',     'Definir em quais unidades cada pessoa trabalha.',    70, array['Administrador','Gestao']);

select registrar_permissao('cadastro.ver',             'Cadastros',     'Ver cadastros',                    'Consultar municípios, unidades e contratos.',        80, array['Administrador','Gestao','Gestor','Coordenador','Usuario']);
select registrar_permissao('cadastro.editar',          'Cadastros',     'Editar cadastros',                 'Criar e alterar municípios, unidades e contratos.',  90, array['Administrador','Gestao']);

select registrar_permissao('prestacao.ver',            'Prestação',     'Consultar prestações',             'Abrir prestações de contas das unidades atribuídas.', 100, array['Administrador','Gestao','Gestor','Coordenador','Usuario']);
select registrar_permissao('prestacao.criar',          'Prestação',     'Abrir prestação do mês',           'Criar a prestação de um novo mês/ano.',             110, array['Administrador','Gestao','Gestor']);
select registrar_permissao('prestacao.enviar_arquivo', 'Prestação',     'Enviar documentos',                'Fazer upload de arquivos nas seções.',              120, array['Administrador','Gestao','Gestor','Coordenador']);
select registrar_permissao('prestacao.excluir_arquivo','Prestação',     'Excluir documentos',               'Remover arquivos já enviados.',                     130, array['Administrador','Gestao','Gestor']);
select registrar_permissao('prestacao.baixar',         'Prestação',     'Baixar documentos',                'Baixar arquivos e o PDF consolidado.',              140, array['Administrador','Gestao','Gestor','Coordenador','Usuario']);
select registrar_permissao('prestacao.compilar',       'Prestação',     'Compilar o PDF final',             'Gerar as capas e unir tudo no PDF do mês.',         150, array['Administrador','Gestao','Gestor']);
select registrar_permissao('prestacao.concluir',       'Prestação',     'Concluir prestação',               'Marcar a prestação como concluída e travar edição.', 160, array['Administrador','Gestao']);

select registrar_permissao('auditoria.ver',            'Auditoria',     'Ver trilha de auditoria',          'Consultar o histórico de quem fez o quê.',          170, array['Administrador','Gestao']);


-- -------------------------------------------------------------
-- 7. AUDITORIA
-- -------------------------------------------------------------

create table if not exists log_auditoria (
  id          bigserial primary key,
  perfil_id   uuid references perfil(id),
  tabela      text not null,
  registro_id text,
  acao        text not null check (acao in ('INSERIR','ALTERAR','EXCLUIR','LOGIN','BAIXAR')),
  detalhe     jsonb,
  ocorrido_em timestamptz not null default now()
);

create index if not exists idx_log_ocorrido on log_auditoria(ocorrido_em desc);


-- -------------------------------------------------------------
-- 8. RLS
-- -------------------------------------------------------------
-- Nada de USING (true) neste projeto.

alter table papel               enable row level security;
alter table perfil              enable row level security;
alter table permissao_catalogo  enable row level security;
alter table permissao_papel     enable row level security;
alter table permissao_usuario   enable row level security;
alter table usuario_unidade     enable row level security;
alter table log_auditoria       enable row level security;

-- papel e catálogo: leitura para qualquer autenticado (a tela precisa
-- dos rótulos), escrita só para quem administra permissões.
drop policy if exists papel_ler on papel;
create policy papel_ler on papel
  for select to authenticated using (true);

drop policy if exists catalogo_ler on permissao_catalogo;
create policy catalogo_ler on permissao_catalogo
  for select to authenticated using (true);

drop policy if exists catalogo_escrever on permissao_catalogo;
create policy catalogo_escrever on permissao_catalogo
  for all to authenticated
  using (tem_permissao('config.permissoes.editar'))
  with check (tem_permissao('config.permissoes.editar'));

-- perfil: cada um enxerga o próprio; quem tem a permissão enxerga todos.
drop policy if exists perfil_ler on perfil;
create policy perfil_ler on perfil
  for select to authenticated
  using (id = auth.uid() or tem_permissao('config.usuarios.ver'));

drop policy if exists perfil_escrever on perfil;
create policy perfil_escrever on perfil
  for all to authenticated
  using (tem_permissao('config.usuarios.editar'))
  with check (tem_permissao('config.usuarios.editar'));

-- permissões: leitura ampla (o frontend precisa saber o que mostrar),
-- escrita restrita.
drop policy if exists perm_papel_ler on permissao_papel;
create policy perm_papel_ler on permissao_papel
  for select to authenticated using (true);

drop policy if exists perm_papel_escrever on permissao_papel;
create policy perm_papel_escrever on permissao_papel
  for all to authenticated
  using (tem_permissao('config.permissoes.editar'))
  with check (tem_permissao('config.permissoes.editar'));

drop policy if exists perm_usuario_ler on permissao_usuario;
create policy perm_usuario_ler on permissao_usuario
  for select to authenticated
  using (perfil_id = auth.uid() or tem_permissao('config.usuarios.ver'));

drop policy if exists perm_usuario_escrever on permissao_usuario;
create policy perm_usuario_escrever on permissao_usuario
  for all to authenticated
  using (tem_permissao('config.permissoes.editar'))
  with check (tem_permissao('config.permissoes.editar'));

drop policy if exists usuario_unidade_ler on usuario_unidade;
create policy usuario_unidade_ler on usuario_unidade
  for select to authenticated
  using (perfil_id = auth.uid() or tem_permissao('config.usuarios.ver'));

drop policy if exists usuario_unidade_escrever on usuario_unidade;
create policy usuario_unidade_escrever on usuario_unidade
  for all to authenticated
  using (tem_permissao('config.unidades.atribuir'))
  with check (tem_permissao('config.unidades.atribuir'));

-- auditoria: qualquer autenticado grava, só quem tem permissão lê,
-- e ninguém apaga ou altera.
drop policy if exists log_inserir on log_auditoria;
create policy log_inserir on log_auditoria
  for insert to authenticated
  with check (perfil_id = auth.uid());

drop policy if exists log_ler on log_auditoria;
create policy log_ler on log_auditoria
  for select to authenticated
  using (tem_permissao('auditoria.ver'));


-- -------------------------------------------------------------
-- 9. PRIMEIRO ADMINISTRADOR
-- -------------------------------------------------------------
-- Ovo e galinha: só um Administrador cria usuários, então o
-- primeiro nasce aqui.
--
-- PRÉ-REQUISITO — no painel do Supabase:
--   Authentication > Users > Add user
--   Email: jcarlservicos@gmail.com
--   Marque "Auto Confirm User" (sem isso o login falha).
--
-- O bloco abaixo acha o UUID sozinho pelo email, não precisa copiar
-- nada. Se avisar "usuário não encontrado", a conta ainda não foi
-- criada no painel ou o email está diferente.

do $$
declare
  v_email text := 'jcarlservicos@gmail.com';
  v_nome  text := 'João Carlos';
  v_id    uuid;
begin
  select id into v_id from auth.users where email = v_email;

  if v_id is null then
    raise warning 'Usuário % não encontrado em auth.users. Crie a conta em Authentication > Users e rode este script de novo.', v_email;
    return;
  end if;

  insert into perfil (id, nome, email, papel)
  values (v_id, v_nome, v_email, 'Administrador')
  on conflict (id) do update
    set papel = 'Administrador',
        ativo = true,
        nome  = excluded.nome;

  raise notice 'Administrador liberado: %', v_email;
end $$;


-- -------------------------------------------------------------
-- 10. ORGANIZAÇÃO E IDENTIDADE VISUAL
-- -------------------------------------------------------------
-- Registro único da OSC. Os documentos institucionais (estatuto,
-- CNDs próprias) entram no script 02, junto do resto do modelo.
--
-- A logo fica como data URL nesta tabela, não no Google Drive:
-- é um recurso do sistema, não um documento da prestação, e assim
-- carrega junto com a configuração numa consulta só. Vale para
-- arquivos pequenos — o formulário limita a 300 KB.

create table if not exists organizacao (
  id            uuid primary key default gen_random_uuid(),
  razao_social  text not null,
  cnpj          varchar(18),
  email_suporte text,
  telefone      text,
  logo_data_url text,
  cor_marca     text default '#1B6B55',
  atualizado_em timestamptz default now(),
  atualizado_por uuid references perfil(id)
);

-- Uma única linha, sempre.
create unique index if not exists idx_organizacao_unica on organizacao((true));

insert into organizacao (razao_social)
select 'Organização Social'
where not exists (select 1 from organizacao);

alter table organizacao enable row level security;

drop policy if exists organizacao_ler on organizacao;
create policy organizacao_ler on organizacao
  for select to authenticated using (true);

drop policy if exists organizacao_escrever on organizacao;
create policy organizacao_escrever on organizacao
  for update to authenticated
  using (tem_permissao('config.organizacao.editar')
      or tem_permissao('config.visual.editar'))
  with check (tem_permissao('config.organizacao.editar')
           or tem_permissao('config.visual.editar'));
