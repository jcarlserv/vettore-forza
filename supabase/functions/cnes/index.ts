// =============================================================
// Vettore — Edge Function "cnes"
// Consulta um estabelecimento de saúde pelo código CNES.
// Versão: v0.7.1
// -------------------------------------------------------------
// Existe porque o CNES não libera CORS: o navegador não pode
// chamar direto. Aqui a chamada sai do servidor, sem essa trava.
//
// Uso: GET /functions/v1/cnes?cnes=2303932328070
// =============================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

// Duas fontes para o mesmo dado. A primeira que responder vence.
const FONTES = [
  {
    nome: "apidadosabertos",
    url: (cnes: string) =>
      `https://apidadosabertos.saude.gov.br/cnes/estabelecimentos/${cnes}`,
    mapear: (d: Record<string, unknown>) => ({
      cnes: String(d.codigo_cnes ?? ""),
      nome: (d.nome_fantasia || d.nome_razao_social || "") as string,
      razao_social: (d.nome_razao_social || "") as string,
      cnpj: (d.numero_cnpj || d.numero_cnpj_entidade || "") as string,
      tipo: (d.descricao_tipo_unidade || "") as string,
      logradouro: (d.endereco_estabelecimento || "") as string,
      numero: String(d.numero_estabelecimento ?? ""),
      complemento: (d.complemento_estabelecimento || "") as string,
      bairro: (d.bairro_estabelecimento || "") as string,
      cep: String(d.codigo_cep_estabelecimento ?? ""),
      municipio: String(d.codigo_municipio ?? ""),
      uf: String(d.codigo_uf ?? ""),
      telefone: (d.numero_telefone_estabelecimento || "") as string,
      email: (d.endereco_email_estabelecimento || "") as string,
      responsavel: (d.nome_diretor_clinico || "") as string,
    }),
  },
  {
    nome: "cnes-datasus",
    url: (cnes: string) =>
      `https://cnes.datasus.gov.br/services/estabelecimentos/${cnes}`,
    mapear: (d: Record<string, unknown>) => ({
      cnes: String(d.cnes ?? ""),
      nome: (d.nomeFantasia || d.nome || "") as string,
      razao_social: (d.razaoSocial || "") as string,
      cnpj: (d.cnpj || "") as string,
      tipo: (d.tpUnidade || d.tipoUnidade || "") as string,
      logradouro: (d.logradouro || "") as string,
      numero: String(d.numero ?? ""),
      complemento: (d.complemento || "") as string,
      bairro: (d.bairro || "") as string,
      cep: String(d.cep ?? ""),
      municipio: (d.municipio || d.noMunicipio || "") as string,
      uf: (d.uf || "") as string,
      telefone: (d.telefone || "") as string,
      email: (d.email || "") as string,
      responsavel: (d.diretorClinico || "") as string,
    }),
  },
];

export default {
  async fetch(req: Request): Promise<Response> {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

    const cnes = (new URL(req.url).searchParams.get("cnes") || "").replace(/\D/g, "");
    if (!cnes) return json({ erro: "Informe o código CNES." }, 400);

    const tentativas: unknown[] = [];

    for (const fonte of FONTES) {
      try {
        const r = await fetch(fonte.url(cnes), {
          headers: { Accept: "application/json", "User-Agent": "Vettore/0.7" },
        });

        if (!r.ok) {
          tentativas.push({ fonte: fonte.nome, status: r.status });
          continue;
        }

        const bruto = await r.json();
        const dados = fonte.mapear(Array.isArray(bruto) ? bruto[0] : bruto);

        if (!dados.nome) {
          tentativas.push({ fonte: fonte.nome, status: "sem nome no retorno" });
          continue;
        }

        // O retorno bruto vai junto: com ele dá para ajustar o
        // mapeamento sem adivinhar nomes de campo.
        return json({ fonte: fonte.nome, dados, bruto });
      } catch (e) {
        tentativas.push({ fonte: fonte.nome, status: String(e) });
      }
    }

    return json({ erro: `Nenhuma fonte respondeu para o CNES ${cnes}`, tentativas }, 502);
  },
};
