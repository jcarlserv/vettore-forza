-- =============================================================
-- Vettore — Prestação de Contas
-- 12_excluir_prestacao.sql
-- Permissão pra excluir a prestação inteira (o "mês" inteiro).
-- Diferente de prestacao.excluir_arquivo (que já existe, um
-- arquivo por vez) — essa apaga tudo: cabeçalho, arquivos e
-- marcações de subcapa daquele mês.
-- Versão: v0.21.0
-- =============================================================

select registrar_permissao(
  'prestacao.excluir', 'Prestações', 'Excluir prestação de contas',
  'Apaga o mês inteiro — cabeçalho, arquivos e configurações de capa.',
  260, array['Administrador','Gestor']
);
