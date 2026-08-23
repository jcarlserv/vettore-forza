-- =============================================================
-- Vettore — 04_municipio_cnpj.sql — v0.4.0
-- Dados da prefeitura vindos do CNPJ. Cole no SQL Editor e Run.
-- =============================================================

alter table municipio add column if not exists razao_social text;
alter table municipio add column if not exists cep         varchar(9);
alter table municipio add column if not exists logradouro  text;
alter table municipio add column if not exists numero      text;
alter table municipio add column if not exists complemento text;
alter table municipio add column if not exists bairro      text;

notify pgrst, 'reload schema';

select 'Pronto. Recarregue o sistema com Ctrl+Shift+R.' as resultado;
