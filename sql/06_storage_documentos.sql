-- =============================================================
-- Vettore — Prestação de Contas
-- 06_storage_documentos.sql
-- Bucket privado no Supabase Storage pros arquivos da prestação
-- (provisório, até o Google Workspace estar configurado).
-- Caminho de cada arquivo: {prestacao_id}/{chave}/{timestamp}_{nome}
-- Versão: v0.9.0
-- =============================================================
-- Rode depois do 05_prestacao_contas.sql. Idempotente.
-- =============================================================

insert into storage.buckets (id, name, public)
values ('prestacao-documentos', 'prestacao-documentos', false)
on conflict (id) do nothing;

-- O primeiro pedaço do caminho é o id da prestação — usamos isso
-- pra decidir, via prestacao_contas, se a pessoa alcança a unidade.

drop policy if exists prestacao_storage_ler on storage.objects;
create policy prestacao_storage_ler on storage.objects
  for select to authenticated
  using (
    bucket_id = 'prestacao-documentos'
    and exists (
      select 1 from prestacao_contas pc
       where pc.id::text = (storage.foldername(name))[1]
         and tem_permissao('prestacao.ver')
         and alcanca_unidade(pc.unidade_saude_id)
    )
  );

drop policy if exists prestacao_storage_inserir on storage.objects;
create policy prestacao_storage_inserir on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'prestacao-documentos'
    and exists (
      select 1 from prestacao_contas pc
       where pc.id::text = (storage.foldername(name))[1]
         and tem_permissao('prestacao.enviar_arquivo')
         and alcanca_unidade(pc.unidade_saude_id)
    )
  );

drop policy if exists prestacao_storage_excluir on storage.objects;
create policy prestacao_storage_excluir on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'prestacao-documentos'
    and exists (
      select 1 from prestacao_contas pc
       where pc.id::text = (storage.foldername(name))[1]
         and tem_permissao('prestacao.excluir_arquivo')
         and alcanca_unidade(pc.unidade_saude_id)
    )
  );
