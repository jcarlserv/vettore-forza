-- =============================================================
-- Vettore — Prestação de Contas
-- 09_subcapas.sql
-- Permite marcar, por documento do catálogo, se ele deve ter
-- uma subcapa antes dele no PDF baixado (subtítulo = nome do
-- próprio documento).
-- Versão: v0.15.0
-- =============================================================

alter table documento_catalogo
  add column if not exists tem_subcapa boolean not null default false;

create or replace function registrar_documento(
  p_chave      text,
  p_bloco      text,
  p_rotulo     text,
  p_multiplo   boolean,
  p_ordem      integer,
  p_tem_subcapa boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into documento_catalogo (chave, bloco, rotulo, multiplo, ordem, tem_subcapa)
  values (p_chave, p_bloco, p_rotulo, p_multiplo, coalesce(p_ordem, 100), coalesce(p_tem_subcapa, false))
  on conflict (chave) do update
    set bloco        = excluded.bloco,
        rotulo       = excluded.rotulo,
        multiplo     = excluded.multiplo,
        ordem        = excluded.ordem,
        tem_subcapa  = excluded.tem_subcapa;
end;
$$;

-- Exemplo: ligar subcapa em um documento específico, sem mexer
-- em mais nada dele:
-- update documento_catalogo set tem_subcapa = true where chave = 'estatuto_social';
