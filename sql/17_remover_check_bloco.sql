-- =============================================================
-- Vettore — Prestação de Contas
-- 17_remover_check_bloco.sql
-- documento_catalogo.bloco tinha uma trava de quando só existiam
-- 2 blocos fixos (organizacao/financeiro) — bloqueava criar
-- documento em qualquer bloco novo.
-- Versão: v0.25.1
-- =============================================================

alter table documento_catalogo drop constraint if exists documento_catalogo_bloco_check;
