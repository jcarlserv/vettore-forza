// =============================================================
// Vettore — Edge Function "upload-drive"
// Sobe um arquivo da Prestação de Contas para o Drive Compartilhado
// e grava o metadado em prestacao_documento.
// Versão: v0.8.0
// -------------------------------------------------------------
// Pasta: Drive Compartilhado / Município / Ano / Mês / Bloco
// Busca a pasta pelo nome dentro da pasta pai e cria se não achar
// — idempotente, sem precisar guardar IDs de pasta no banco.
//
// O upload no Drive usa a conta de serviço (GOOGLE_SERVICE_ACCOUNT_JSON).
// A gravação em prestacao_documento usa o JWT de quem chamou, então
// a RLS de sempre decide se pode: o Drive não é atalho de permissão.
//
// Uso: POST /functions/v1/upload-drive  (multipart/form-data)
//   file          — o arquivo
//   prestacao_id  — uuid da prestacao_contas
//   chave         — chave do documento (ex: 'extrato_bancario')
//   municipio     — nome do município (nome da pasta)
//   ano, mes      — referência (nomes das pastas)
//   bloco         — 'organizacao' | 'financeiro' (nome da pasta)
// =============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const NOME_BLOCO: Record<string, string> = {
  organizacao: "Dados da Organização",
  financeiro: "Financeiro",
};

const MESES = [
  "01-Janeiro", "02-Fevereiro", "03-Março", "04-Abril", "05-Maio", "06-Junho",
  "07-Julho", "08-Agosto", "09-Setembro", "10-Outubro", "11-Novembro", "12-Dezembro",
];

/* -------- Autenticação com o Google (JWT da conta de serviço) -------- */

function base64Url(bytes: Uint8Array | string) {
  const bin = typeof bytes === "string" ? bytes : String.fromCharCode(...bytes);
  return btoa(bin).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function tokenGoogle(contaServico: { client_email: string; private_key: string }) {
  const agora = Math.floor(Date.now() / 1000);
  const cabecalho = { alg: "RS256", typ: "JWT" };
  const corpo = {
    iss: contaServico.client_email,
    scope: "https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    iat: agora,
    exp: agora + 3600,
  };

  const naoAssinado =
    base64Url(JSON.stringify(cabecalho)) + "." + base64Url(JSON.stringify(corpo));

  const pem = contaServico.private_key
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0));

  const chave = await crypto.subtle.importKey(
    "pkcs8", der.buffer, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]
  );
  const assinatura = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", chave, new TextEncoder().encode(naoAssinado))
  );

  const jwt = `${naoAssinado}.${base64Url(assinatura)}`;

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const d = await r.json();
  if (!d.access_token) throw new Error("Falha na autenticação com o Google: " + JSON.stringify(d));
  return d.access_token as string;
}

/* -------- Pastas: busca pelo nome dentro do pai, cria se faltar -------- */

async function pastaFilha(token: string, driveId: string, pai: string, nome: string) {
  const q = encodeURIComponent(
    `name='${nome.replace(/'/g, "\\'")}' and '${pai}' in parents ` +
    `and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const buscaUrl =
    `https://www.googleapis.com/drive/v3/files?q=${q}` +
    `&supportsAllDrives=true&includeItemsFromAllDrives=true` +
    `&corpora=drive&driveId=${driveId}&fields=files(id,name)`;

  const busca = await (await fetch(buscaUrl, { headers: { Authorization: `Bearer ${token}` } })).json();
  if (busca.files?.length) return busca.files[0].id as string;

  const criar = await fetch(
    `https://www.googleapis.com/drive/v3/files?supportsAllDrives=true`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: nome,
        mimeType: "application/vnd.google-apps.folder",
        parents: [pai],
      }),
    }
  );
  const nova = await criar.json();
  if (!criar.ok) throw new Error("Falha ao criar pasta '" + nome + "': " + JSON.stringify(nova));
  return nova.id as string;
}

async function pastaDoDocumento(
  token: string, driveId: string,
  municipio: string, ano: string, mes: string, bloco: string
) {
  const nomeMes = MESES[Number(mes) - 1] || mes;
  const nomeBloco = NOME_BLOCO[bloco] || bloco;

  const pMunicipio = await pastaFilha(token, driveId, driveId, municipio);
  const pAno       = await pastaFilha(token, driveId, pMunicipio, ano);
  const pMes       = await pastaFilha(token, driveId, pAno, nomeMes);
  return pastaFilha(token, driveId, pMes, nomeBloco);
}

/* -------- Upload multipart do arquivo -------- */

async function subirArquivo(token: string, pastaId: string, arquivo: File) {
  const boundary = "vettore-" + crypto.randomUUID();
  const metadata = JSON.stringify({ name: arquivo.name, parents: [pastaId] });

  const partes = [
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
    `--${boundary}\r\nContent-Type: ${arquivo.type || "application/octet-stream"}\r\n\r\n`,
  ];
  const cabeca = new TextEncoder().encode(partes.join(""));
  const cauda  = new TextEncoder().encode(`\r\n--${boundary}--`);
  const dados  = new Uint8Array(await arquivo.arrayBuffer());

  const corpo = new Uint8Array(cabeca.length + dados.length + cauda.length);
  corpo.set(cabeca, 0);
  corpo.set(dados, cabeca.length);
  corpo.set(cauda, cabeca.length + dados.length);

  const r = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: corpo,
    }
  );
  const arquivoDrive = await r.json();
  if (!r.ok) throw new Error("Falha no upload ao Drive: " + JSON.stringify(arquivoDrive));
  return arquivoDrive as { id: string; webViewLink: string };
}

/* -------- Handler -------- */

export default {
  async fetch(req: Request): Promise<Response> {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
    if (req.method !== "POST") return json({ erro: "Use POST." }, 405);

    try {
      const contaServicoTexto = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
      const driveId = Deno.env.get("GOOGLE_DRIVE_ID");
      if (!contaServicoTexto || !driveId) {
        throw new Error("Secrets do Google ausentes (GOOGLE_SERVICE_ACCOUNT_JSON / GOOGLE_DRIVE_ID).");
      }
      const contaServico = JSON.parse(contaServicoTexto);

      const forma = await req.formData();
      const arquivo     = forma.get("file") as File | null;
      const prestacaoId = forma.get("prestacao_id") as string | null;
      const chave       = forma.get("chave") as string | null;
      const municipio   = (forma.get("municipio") as string | null) || "";
      const ano         = (forma.get("ano") as string | null) || "";
      const mes         = (forma.get("mes") as string | null) || "";
      const bloco       = (forma.get("bloco") as string | null) || "";

      if (!arquivo || !prestacaoId || !chave || !municipio || !ano || !mes || !bloco) {
        return json({ erro: "Faltam campos: file, prestacao_id, chave, municipio, ano, mes, bloco." }, 400);
      }

      // Cliente com o JWT de quem chamou — a RLS de prestacao_documento
      // decide se esta pessoa pode gravar aqui, igual a qualquer insert do app.
      const sbUsuario = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
      );
      const { data: quem } = await sbUsuario.auth.getUser();
      if (!quem?.user) return json({ erro: "Sessão inválida." }, 401);

      const token = await tokenGoogle(contaServico);
      const pastaId = await pastaDoDocumento(token, driveId, municipio, ano, mes, bloco);
      const arquivoDrive = await subirArquivo(token, pastaId, arquivo);

      const { data: registro, error: erroDb } = await sbUsuario
        .from("prestacao_documento")
        .insert({
          prestacao_id: prestacaoId,
          chave,
          nome_arquivo: arquivo.name,
          arquivo_drive_id: arquivoDrive.id,
          arquivo_url: arquivoDrive.webViewLink,
          enviado_por: quem.user.id,
        })
        .select()
        .single();

      if (erroDb) throw erroDb;

      return json({ ok: true, registro });
    } catch (e) {
      console.error("[Vettore] upload-drive falhou:", e);
      return json({ erro: String((e as Error).message ?? e) }, 500);
    }
  },
};
