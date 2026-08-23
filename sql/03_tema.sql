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
