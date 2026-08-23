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

  VERSAO: 'v0.2.0'
};

// Cores sugeridas na aba Identidade Visual.
const CORES_SUGERIDAS = [
  { nome: 'Carimbo',   valor: '#1B6B55' },
  { nome: 'Tinta',     valor: '#16202E' },
  { nome: 'Ferrugem',  valor: '#A8481B' },
  { nome: 'Índigo',    valor: '#2F4B7C' },
  { nome: 'Vinho',     valor: '#7A2E3F' },
  { nome: 'Grafite',   valor: '#4A5563' }
];

/* -------------------------------------------------------------
   Teste de conexão automático

   Roda sozinho ao abrir a página e imprime o resultado no console,
   sem precisar colar nada. Lê a tabela papel, que é pública para
   qualquer autenticado e existe desde o script 01 — se ela responde,
   a conexão está de pé e o problema é outro.
   ------------------------------------------------------------- */

async function testarConexao() {
  const marca = 'color:#1B6B55;font-weight:600';
  console.log('%c[Vettore] Testando conexão…', marca);
  console.log('[Vettore] URL:', CONFIG.SUPABASE_URL);
  console.log('[Vettore] Chave:', CONFIG.SUPABASE_ANON.slice(0, 22) + '…');

  if (typeof sb === 'undefined') {
    console.error('[Vettore] O cliente não foi criado. Verifique se api.js carregou depois de config.js.');
    return;
  }

  try {
    const { data, error } = await sb.from('papel').select('codigo');

    if (error) {
      console.error('%c[Vettore] O banco respondeu com erro:', 'color:#A8481B;font-weight:600', error.message);
      if (/api key/i.test(error.message))
        console.warn('[Vettore] A chave não foi aceita. Pegue a anon public em Project Settings > API.');
      else if (/relation .* does not exist/i.test(error.message))
        console.warn('[Vettore] Conexão OK, mas as tabelas não existem. Rode o sql/01_fundacao_acesso.sql.');
      return;
    }

    console.log('%c[Vettore] Conexão OK.', marca, data.length + ' papéis encontrados:',
                data.map(p => p.codigo).join(', '));

    const { count } = await sb.from('perfil').select('*', { count: 'exact', head: true });
    if (count === 0)
      console.warn('[Vettore] Nenhum perfil cadastrado. Rode o sql/99_reset_usuarios.sql.');
    else
      console.log('[Vettore] Perfis cadastrados:', count);

  } catch (e) {
    console.error('%c[Vettore] Não houve resposta do servidor.', 'color:#A8481B;font-weight:600', e.message);
    console.warn('[Vettore] Causas comuns: URL errada, projeto pausado no Supabase, ou sem internet.');
  }
}

window.addEventListener('load', () => setTimeout(testarConexao, 300));
