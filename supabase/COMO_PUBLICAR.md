# Publicar a Edge Function "cnes"

## Opção A — pelo painel (sem instalar nada)

1. Supabase → Edge Functions → **Deploy a new function**
2. Nome: `cnes`
3. Cole o conteúdo de `supabase/functions/cnes/index.ts`
4. Deploy

## Opção B — pela CLI

```bash
npm i -g supabase
supabase login
supabase link --project-ref xaiqztvshgdwwxugjlow
supabase functions deploy cnes --no-verify-jwt
```

## Testar

Abra no navegador:

```
https://xaiqztvshgdwwxugjlow.supabase.co/functions/v1/cnes?cnes=2303932328070
```

Resposta esperada: JSON com `fonte`, `dados` e `bruto`.
Se vier `erro`, o campo `tentativas` diz o que cada fonte respondeu.

## Importante

Marque a função como pública (sem verificação de JWT) ou envie o
header `Authorization: Bearer <chave anon>`. O frontend já envia.
