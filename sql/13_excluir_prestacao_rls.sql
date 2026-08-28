-- =============================================================
-- Vettore — Prestação de Contas
-- 13_excluir_prestacao_rls.sql
-- Faltava a política de DELETE em prestacao_contas — sem ela,
-- o Supabase recusa a exclusão em silêncio (sem erro nenhum).
-- Versão: v0.21.1
-- =============================================================

drop policy if exists prestacao_excluir on prestacao_contas;
create policy prestacao_excluir on prestacao_contas
  for delete to authenticated
  using (tem_permissao('prestacao.excluir') and alcanca_unidade(unidade_saude_id));
