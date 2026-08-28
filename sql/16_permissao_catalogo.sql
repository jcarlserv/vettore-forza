-- =============================================================
-- Vettore — Prestação de Contas
-- 16_permissao_catalogo.sql
-- registrar_bloco/registrar_documento passam a ser chamadas
-- direto da tela (Configurações → Organização), não só do SQL
-- Editor — por isso ganham checagem de permissão por dentro.
-- Versão: v0.25.0
-- =============================================================

create or replace function registrar_bloco(p_chave text, p_rotulo text, p_ordem integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not tem_permissao('config.organizacao.editar') then
    raise exception 'Sem permissão para editar blocos.';
  end if;

  insert into bloco_catalogo (chave, rotulo, ordem)
  values (p_chave, p_rotulo, coalesce(p_ordem, 100))
  on conflict (chave) do update
    set rotulo = excluded.rotulo,
        ordem  = excluded.ordem;
end;
$$;

create or replace function registrar_documento(
  p_chave       text,
  p_bloco       text,
  p_rotulo      text,
  p_multiplo    boolean,
  p_ordem       integer,
  p_tem_subcapa boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not tem_permissao('config.organizacao.editar') then
    raise exception 'Sem permissão para editar documentos.';
  end if;

  insert into documento_catalogo (chave, bloco, rotulo, multiplo, ordem, tem_subcapa)
  values (p_chave, p_bloco, p_rotulo, p_multiplo, coalesce(p_ordem, 100), coalesce(p_tem_subcapa, false))
  on conflict (chave) do update
    set bloco       = excluded.bloco,
        rotulo      = excluded.rotulo,
        multiplo    = excluded.multiplo,
        ordem       = excluded.ordem,
        tem_subcapa = excluded.tem_subcapa;
end;
$$;
