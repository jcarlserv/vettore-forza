/* =============================================================
   Vettore — config.js — v0.2.0
   Credenciais e constantes do projeto.

   A chave abaixo é a publishable (anon). Ela É pública por desenho:
   num site estático não existe onde escondê-la, e não precisa —
   sozinha ela não abre nada, só identifica o projeto. Quem decide o
   que cada requisição pode ler ou gravar é o RLS do Postgres.

   A chave service_role NUNCA entra aqui nem em qualquer arquivo do
   frontend. O lugar dela é nos secrets da Edge Function.
   ============================================================= */

const CONFIG = {
  PRODUTO: 'Vettore',
  ASSINATURA: 'Tecnologia para Organizações Sociais de Saúde',
  MODULO: 'Prestação de Contas',
  DESENVOLVEDOR: 'JCARLSERV',

  // Só o domínio. Sem /rest/v1 e sem barra no fim — a biblioteca
  // monta o caminho sozinha. Com /rest/v1 aqui, toda chamada iria
  // parar em /rest/v1/rest/v1 e falharia calada.
  SUPABASE_URL:  'https://xaiqztvshgdwwxugjlow.supabase.co',
  SUPABASE_ANON: 'sb_publishable_5MdGLCMpnIs_nldAIlmHrA_73HjWVb1',

  VERSAO: 'v0.6.2'
};

/* -------------------------------------------------------------
   Temas

   O tema Vettore vem da logomarca: o azul royal das faixas
   superior e inferior, e o ciano da faixa central. O royal manda
   nas ações; o ciano aparece em destaques e confirmações, onde o
   verde antes ficava. O fundo saiu do bege para um cinza-azulado
   frio, que é a temperatura da marca.

   Os demais temas existem porque cada OSC tem sua identidade —
   a logo do cliente entra ao lado da marca do produto, e as cores
   do sistema acompanham a dela.
   ------------------------------------------------------------- */

const TEMAS = {
  vettore: {
    nome: 'Vettore',
    marca:      '#1F55A5',   // azul royal — faixas da logo
    secundaria: '#00A3E0',   // ciano — faixa central
    topo:       '#143A70',   // royal escurecido, para a barra
    fundo:      '#F4F6FA'
  },
  oceano: {
    nome: 'Oceano',
    marca: '#0E7490', secundaria: '#22D3EE', topo: '#0C4A5E', fundo: '#F2F7F9'
  },
  carimbo: {
    nome: 'Carimbo',
    marca: '#1B6B55', secundaria: '#3FA88A', topo: '#123F33', fundo: '#F5F4F0'
  },
  ferrugem: {
    nome: 'Ferrugem',
    marca: '#A8481B', secundaria: '#E08A4B', topo: '#5C2A11', fundo: '#FAF5F1'
  },
  vinho: {
    nome: 'Vinho',
    marca: '#7A2E3F', secundaria: '#C2607A', topo: '#4A1A26', fundo: '#FAF4F5'
  },
  grafite: {
    nome: 'Grafite',
    marca: '#3F4A5A', secundaria: '#7C8CA3', topo: '#222C39', fundo: '#F5F6F8'
  }
};

const TEMA_PADRAO = 'vettore';

// Aplica um conjunto de cores na página inteira, agora.
// As variações (hover, fundo suave, borda) são derivadas por
// color-mix no CSS — informar quatro cores basta.
function aplicarTema({ marca, secundaria, topo, fundo }) {
  const raiz = document.documentElement.style;
  if (marca)      raiz.setProperty('--marca', marca);
  if (secundaria) raiz.setProperty('--destaque', secundaria);
  if (topo)       raiz.setProperty('--topo-bg', topo);
  if (fundo)      raiz.setProperty('--papel', fundo);
}
