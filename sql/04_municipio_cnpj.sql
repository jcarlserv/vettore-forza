-- =============================================================
-- Vettore — 04_municipio_cnpj.sql
-- Campos do cartão CNPJ no cadastro de município.
-- Versão: v0.4.0
-- Cole no SQL Editor e rode. Pode rodar mais de uma vez.
-- =============================================================

alter table municipio add column if not exists razao_social      text;
alter table municipio add column if not exists nome_fantasia     text;
alter table municipio add column if not exists natureza_juridica text;
alter table municipio add column if not exists data_abertura     date;
alter table municipio add column if not exists situacao          text;
alter table municipio add column if not exists cep               varchar(9);
alter table municipio add column if not exists logradouro        text;
alter table municipio add column if not exists numero            text;
alter table municipio add column if not exists complemento       text;
alter table municipio add column if not exists bairro            text;

notify pgrst, 'reload schema';

select 'Pronto. Recarregue o sistema com Ctrl+Shift+R.' as resultado;
