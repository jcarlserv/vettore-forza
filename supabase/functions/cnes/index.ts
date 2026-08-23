// =============================================================
// Vettore — Edge Function "cnes"
// Consulta um estabelecimento de saúde pelo código CNES.
// Versão: v0.7.0
// -------------------------------------------------------------
// Existe porque o CNES não libera CORS: o navegador não pode
// chamar direto. Aqui a chamada sai do servidor, sem essa trava.
//
// Uso: GET /functions/v1/cnes?cnes=2303932328070
// =============================================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

// Duas fontes para o mesmo dado. A primeira que responder vence.
const FONTES = [
  {
    nome: 'apidadosabertos',
    url: (cnes: string) =>
      `https://apidadosabertos.saude.gov.br/cnes/estabelecimentos/${cnes}`,
    mapear: (d: any) => ({
      cnes:        String(d.codigo_cnes ?? ''),
      nome:        d.nome_fantasia || d.nome_razao_social || '',
      razao_social: d.nome_razao_social || '',
      cnpj:        d.numero_cnpj || d.numero_cnpj_entidade || '',
      tipo:        d.descricao_tipo_unidade || d.descricao_natureza_juridica || '',
      logradouro:  d.endereco_estabelecimento || '',
      numero:      String(d.numero_estabelecimento ?? ''),
      complemento: d.complemento_estabelecimento || '',
      bairro:      d.bairro_estabelecimento || '',
      cep:         String(d.codigo_cep_estabelecimento ?? ''),
      municipio:   d.codigo_municipio || '',
      uf:          d.codigo_uf || '',
      telefone:    d.numero_telefone_estabelecimento || '',
      email:       d.endereco_email_estabelecimento || '',
      responsavel: d.nome_diretor_clinico || ''
    })
  },
  {
    nome: 'cnes-datasus',
    url: (cnes: string) =>
      `https://cnes.datasus.gov.br/services/estabelecimentos/${cnes}`,
    mapear: (d: any) => ({
      cnes:        String(d.cnes ?? ''),
      nome:        d.nomeFantasia || d.nome || '',
      razao_social: d.razaoSocial || '',
      cnpj:        d.cnpj || '',
      tipo:        d.tpUnidade || d.tipoUnidade || '',
      logradouro:  d.logradouro || '',
      numero:      String(d.numero ?? ''),
      complemento: d.complemento || '',
      bairro:      d.bairro || '',
      cep:         String(d.cep ?? ''),
      municipio:   d.municipio || d.noMunicipio || '',
      uf:          d.uf || '',
      telefone:    d.telefone || '',
      email:       d.email || '',
      responsavel: d.diretorClinico || ''
    })
  }
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const cnes = (new URL(req.url).searchParams.get('cnes') || '').replace(/\D/g, '');

  if (!cnes) {
    return new Response(
      JSON.stringify({ erro: 'Informe o código CNES.' }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }

  const tentativas: any[] = [];

  for (const fonte of FONTES) {
    try {
      const r = await fetch(fonte.url(cnes), {
        headers: { 'Accept': 'application/json', 'User-Agent': 'Vettore/0.7' }
      });

      if (!r.ok) {
        tentativas.push({ fonte: fonte.nome, status: r.status });
        continue;
      }

      const bruto = await r.json();
      const dados = fonte.mapear(Array.isArray(bruto) ? bruto[0] : bruto);

      if (!dados.nome) {
        tentativas.push({ fonte: fonte.nome, status: 'sem nome no retorno' });
        continue;
      }

      // O retorno bruto vai junto: com ele dá para ajustar o
      // mapeamento sem adivinhar nomes de campo.
      return new Response(
        JSON.stringify({ fonte: fonte.nome, dados, bruto }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } }
      );

    } catch (e) {
      tentativas.push({ fonte: fonte.nome, status: String(e) });
    }
  }

  return new Response(
    JSON.stringify({
      erro: 'Nenhuma fonte respondeu para o CNES ' + cnes,
      tentativas
    }),
    { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } }
  );
});
