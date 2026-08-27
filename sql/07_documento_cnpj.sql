-- =============================================================
-- Vettore — Prestação de Contas
-- 07_documento_cnpj.sql
-- Adiciona "CNPJ" ao final do Bloco 2 (Dados da Organização).
-- Versão: v0.10.1
-- =============================================================

select registrar_documento('cnpj', 'organizacao', 'CNPJ', false, 70);
