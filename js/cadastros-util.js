/* =============================================================
   Vettore — cadastros-util.js — v0.2.0
   Consulta de CNPJ, máscaras e tratamento de logomarca.
   Usado por Organização, Municípios e Unidades.
   ============================================================= */

/* -------- Máscaras -------- */

function apenasNumeros(v) { return (v || '').replace(/\D/g, ''); }

function mascaraCnpj(v) {
  const n = apenasNumeros(v).slice(0, 14);
  return n
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

function mascaraCep(v) {
  const n = apenasNumeros(v).slice(0, 8);
  return n.replace(/^(\d{5})(\d)/, '$1-$2');
}

function aplicarMascara(campo, fn) {
  campo.addEventListener('input', () => { campo.value = fn(campo.value); });
}

/* -------- Consulta de CNPJ -------- */

// BrasilAPI: pública, sem cadastro, aceita chamada do navegador.
// Devolve o que está na Receita Federal. Os campos continuam
// editáveis depois — a consulta preenche, não trava.
// Consulta de CEP — usada como rede de segurança quando o CNPJ não
// devolve município e UF com os nomes esperados.
async function consultarCep(cep) {
  const numero = apenasNumeros(cep);
  if (numero.length !== 8) return null;
  try {
    const r = await fetch('https://brasilapi.com.br/api/cep/v2/' + numero);
    if (!r.ok) return null;
    const d = await r.json();
    return { cidade: d.city || '', uf: (d.state || '').toUpperCase() };
  } catch {
    return null;
  }
}

async function consultarCnpj(cnpj) {
  const numero = apenasNumeros(cnpj);
  if (numero.length !== 14) throw new Error('CNPJ incompleto — precisa de 14 dígitos.');

  const resposta = await fetch('https://brasilapi.com.br/api/cnpj/v1/' + numero);

  if (resposta.status === 404) throw new Error('CNPJ não encontrado na Receita Federal.');
  if (resposta.status === 429) throw new Error('Muitas consultas seguidas. Espere um minuto.');
  if (!resposta.ok)            throw new Error('A consulta não respondeu. Preencha os campos à mão.');

  const d = await resposta.json();
  console.log('[Vettore] Resposta do CNPJ:', d);

  // Nomes de campo variam entre provedores e entre versões da API.
  // Aceitar as grafias conhecidas evita que só município e UF venham
  // vazios enquanto o resto preenche.
  const pegar = (...chaves) => {
    for (const c of chaves) {
      const v = c.split('.').reduce((o, k) => o?.[k], d);
      if (v) return String(v);
    }
    return '';
  };

  const dados = {
    razao_social:   d.razao_social || '',
    nome_fantasia:  d.nome_fantasia || '',
    cep:            mascaraCep(d.cep || ''),
    logradouro:     [d.descricao_tipo_de_logradouro, d.logradouro].filter(Boolean).join(' '),
    numero:         d.numero || '',
    complemento:    d.complemento || '',
    bairro:         d.bairro || '',
    cidade:         pegar('municipio', 'cidade', 'nome_municipio',
                           'municipio.nome', 'estabelecimento.cidade.nome'),
    uf:             pegar('uf', 'estado', 'sigla_uf',
                           'estado.sigla', 'estabelecimento.estado.sigla')
                      .toUpperCase().slice(0, 2),
    telefone:       d.ddd_telefone_1 || '',
    email:          d.email || '',
    situacao:       d.descricao_situacao_cadastral || '',
    natureza:       d.natureza_juridica || '',
    data_abertura:  d.data_inicio_atividade || '',

    // Quadro de responsáveis. Em prefeitura costuma trazer o
    // prefeito como administrador — quando a Receita tem o dado
    // atualizado, o que nem sempre acontece.
    responsavel:    (d.qsa || [])[0]?.nome_socio || '',
    qsa:            d.qsa || []
  };

  // Se município ou UF não vieram, o CEP resolve. O endereço da
  // Receita e o do CEP são o mesmo lugar, então não há conflito.
  if ((!dados.cidade || !dados.uf) && dados.cep) {
    const porCep = await consultarCep(dados.cep);
    if (porCep) {
      dados.cidade = dados.cidade || porCep.cidade;
      dados.uf     = dados.uf     || porCep.uf;
      console.log('[Vettore] Município/UF obtidos pelo CEP:', porCep);
    }
  }

  return dados;
}

// Liga o botão de busca a um conjunto de campos.
// mapa: { chaveRetornada: 'id-do-input' }
function ligarBuscaCnpj(idCampoCnpj, idBotao, idAviso, mapa) {
  const campo  = document.getElementById(idCampoCnpj);
  const botao  = document.getElementById(idBotao);
  const aviso  = document.getElementById(idAviso);
  if (!campo || !botao) return;

  aplicarMascara(campo, mascaraCnpj);

  const buscar = async () => {
    limparAviso(aviso);
    botao.disabled = true;
    const textoOriginal = botao.textContent;
    botao.textContent = 'Buscando…';

    try {
      const dados = await consultarCnpj(campo.value);

      Object.entries(mapa).forEach(([chave, idInput]) => {
        const input = document.getElementById(idInput);
        // Não sobrescreve o que a pessoa já digitou.
        if (input && dados[chave] && !input.value) input.value = dados[chave];
      });

      const encerrada = /baixada|inapta|suspensa/i.test(dados.situacao);
      mostrarAviso(aviso,
        encerrada
          ? `Dados preenchidos. Atenção: situação cadastral "${dados.situacao}".`
          : 'Dados preenchidos pela Receita Federal. Confira antes de salvar.',
        encerrada ? 'erro' : 'ok');

    } catch (e) {
      mostrarAviso(aviso, e.message);
    } finally {
      botao.disabled = false;
      botao.textContent = textoOriginal;
    }
  };

  botao.addEventListener('click', buscar);
  campo.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); buscar(); }
  });
}

/* -------- Logomarca -------- */

const LIMITE_LOGO_KB = 300;

// Lê o arquivo, valida o tamanho e devolve o data URL pelo retorno
// da promessa. Mesma regra nas três telas que aceitam logo.
function lerLogo(arquivo) {
  return new Promise((resolve, reject) => {
    if (!arquivo) return resolve(null);
    if (arquivo.size > LIMITE_LOGO_KB * 1024)
      return reject(new Error(`A imagem precisa ter até ${LIMITE_LOGO_KB} KB.`));

    const leitor = new FileReader();
    leitor.onload  = e => resolve(e.target.result);
    leitor.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    leitor.readAsDataURL(arquivo);
  });
}

// Monta o bloco de logo de um formulário: prévia + botão + remover.
// guarda o valor em previa.dataset.novaLogo até salvar.
function ligarCampoLogo(idInput, idPrevia, idAviso, idRemover) {
  const input   = document.getElementById(idInput);
  const previa  = document.getElementById(idPrevia);
  const aviso   = document.getElementById(idAviso);
  const remover = idRemover ? document.getElementById(idRemover) : null;
  if (!input) return;

  input.addEventListener('change', async e => {
    try {
      const dataUrl = await lerLogo(e.target.files[0]);
      if (!dataUrl) return;
      previa.src = dataUrl;
      previa.hidden = false;
      previa.dataset.novaLogo = dataUrl;
      limparAviso(aviso);
    } catch (erro) {
      mostrarAviso(aviso, erro.message);
      input.value = '';
    }
  });

  if (remover) {
    remover.addEventListener('click', () => {
      previa.hidden = true;
      previa.removeAttribute('src');
      previa.dataset.novaLogo = '';   // string vazia = apagar ao salvar
      input.value = '';
    });
  }
}

function mostrarLogoExistente(idPrevia, dataUrl) {
  const previa = document.getElementById(idPrevia);
  if (!previa) return;
  delete previa.dataset.novaLogo;
  if (dataUrl) { previa.src = dataUrl; previa.hidden = false; }
  else         { previa.hidden = true; previa.removeAttribute('src'); }
}

// Devolve o que gravar: undefined = não mexer, null = apagar.
function valorLogoParaSalvar(idPrevia) {
  const previa = document.getElementById(idPrevia);
  if (!previa || !('novaLogo' in previa.dataset)) return undefined;
  return previa.dataset.novaLogo || null;
}

/* -------- Ícones das ações -------- */

const ICONES = {
  lapis: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>`,
  lixo: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
           <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg>`,
  engrenagem: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                 <circle cx="12" cy="12" r="3"/>
                 <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/></svg>`,
  mais: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
           stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`
};


/* -------------------------------------------------------------
   Estados e municípios (IBGE)
   ------------------------------------------------------------- */

const UFS = [
  ['AC','Acre'],['AL','Alagoas'],['AP','Amapá'],['AM','Amazonas'],
  ['BA','Bahia'],['CE','Ceará'],['DF','Distrito Federal'],['ES','Espírito Santo'],
  ['GO','Goiás'],['MA','Maranhão'],['MT','Mato Grosso'],['MS','Mato Grosso do Sul'],
  ['MG','Minas Gerais'],['PA','Pará'],['PB','Paraíba'],['PR','Paraná'],
  ['PE','Pernambuco'],['PI','Piauí'],['RJ','Rio de Janeiro'],['RN','Rio Grande do Norte'],
  ['RS','Rio Grande do Sul'],['RO','Rondônia'],['RR','Roraima'],['SC','Santa Catarina'],
  ['SP','São Paulo'],['SE','Sergipe'],['TO','Tocantins']
];

// A lista de municípios de uma UF não muda; buscar uma vez por
// sessão basta.
const _cacheMunicipios = {};

async function municipiosDaUf(uf) {
  if (_cacheMunicipios[uf]) return _cacheMunicipios[uf];

  const r = await fetch(
    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`);
  if (!r.ok) throw new Error('Não foi possível carregar os municípios de ' + uf + '.');

  const lista = (await r.json())
    .map(m => ({ codigo: String(m.id), nome: m.nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  _cacheMunicipios[uf] = lista;
  return lista;
}
