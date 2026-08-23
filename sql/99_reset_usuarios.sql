-- =============================================================
-- Vettore — Prestação de Contas
-- 99_reset_usuarios.sql
-- Apaga TODOS os usuários e recria um único Administrador.
-- Versão: v0.1.1
-- =============================================================
--
-- QUANDO USAR: só quando o acesso travar e você quiser começar do
-- zero. Este script APAGA CONTAS. Não rode num ambiente com gente
-- trabalhando — leva junto os perfis, as exceções de permissão e os
-- vínculos de unidade de todo mundo.
--
-- O que ele NÃO apaga: papéis, catálogo de permissões, padrões por
-- papel, organização. Nada da estrutura se perde.
--
-- Rode o 01_fundacao_acesso.sql antes deste. Se a tabela perfil não
-- existir, é porque aquele script ainda não passou.
-- =============================================================


-- -------------------------------------------------------------
-- 1. AJUSTE AQUI ANTES DE RODAR
-- -------------------------------------------------------------
-- Troque a senha. 'admin' serve para o primeiro login e nada mais:
-- é a primeira palavra de qualquer lista de ataque, e esta conta
-- manda em permissões, documentos e auditoria.

do $$
declare
  v_email text := 'jcarlservicos@gmail.com';
  v_senha text := 'admin';              -- <<< TROQUE
  v_nome  text := 'Carlito Junior';
  v_id    uuid;
begin

  -- -----------------------------------------------------------
  -- 2. LIMPEZA
  -- -----------------------------------------------------------
  -- A ordem importa: o que depende de perfil sai primeiro.
  delete from permissao_usuario;
  delete from usuario_unidade;
  update log_auditoria set perfil_id = null;   -- o histórico fica, sem dono
  update organizacao set atualizado_por = null;
  delete from perfil;

  -- auth.users em cascata leva sessões, identidades e tokens
  delete from auth.users;

  raise notice 'Usuários removidos.';

  -- -----------------------------------------------------------
  -- 3. CRIAR A CONTA DE LOGIN
  -- -----------------------------------------------------------
  -- pgcrypto gera o hash bcrypt no mesmo formato que o Supabase usa.
  create extension if not exists pgcrypto;

  v_id := gen_random_uuid();

  insert into auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_id, 'authenticated', 'authenticated', v_email,
    crypt(v_senha, gen_salt('bf')),
    now(),                              -- já nasce confirmada
    now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('nome', v_nome),
    '', '', '', ''                      -- vazio, não nulo: o Auth
                                        -- quebra se estas colunas
                                        -- vierem null
  );

  -- A identidade é o que amarra o login por email à conta.
  -- Sem ela o Supabase até guarda o usuário, mas recusa a senha.
  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_id, v_id::text,
    jsonb_build_object('sub', v_id::text, 'email', v_email,
                       'email_verified', true, 'phone_verified', false),
    'email', now(), now(), now()
  );

  -- -----------------------------------------------------------
  -- 4. DAR O PAPEL DE ADMINISTRADOR
  -- -----------------------------------------------------------
  -- O Auth só sabe autenticar. Quem diz que esta pessoa é
  -- Administrador é a tabela perfil.
  insert into perfil (id, nome, email, papel, ativo)
  values (v_id, v_nome, v_email, 'Administrador', true);

  raise notice 'Administrador criado: % (senha: %)', v_email, v_senha;

end $$;


-- -------------------------------------------------------------
-- 5. CONFERÊNCIA
-- -------------------------------------------------------------
-- Esperado: uma linha, com confirmada e identidade ambos true.

select
  u.email,
  p.nome,
  p.papel,
  p.ativo,
  (u.email_confirmed_at is not null) as confirmada,
  exists (select 1 from auth.identities i where i.user_id = u.id) as identidade
from auth.users u
left join perfil p on p.id = u.id;
