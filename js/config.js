/* =============================================================
   config.js — v0.1.1
   Credenciais e constantes do projeto.

   A chave abaixo é a publishable (anon). Ela É pública por desenho:
   num site estático não existe onde escondê-la, e não precisa —
   sozinha ela não abre nada, só identifica o projeto. Quem decide o
   que cada requisição pode ler ou gravar é o RLS do Postgres.

   Por isso o RLS deste projeto é restritivo de verdade: ele é a
   única barreira real. Se alguma tabela ficar com USING (true),
   esta chave passa a valer acesso livre ao dado.

   A chave service_role NUNCA entra aqui nem em qualquer arquivo do
   frontend. O lugar dela é nos secrets da Edge Function.
   ============================================================= */

const CONFIG = {
  PRODUTO: 'Vettore',
  ASSINATURA: 'Tecnologia para Organizações Sociais de Saúde',
  MODULO: 'Prestação de Contas',
  DESENVOLVEDOR: 'JCARLSERV',
  // Sem /rest/v1 no fim — a biblioteca acrescenta o caminho sozinha.
  SUPABASE_URL:  'https://xaiqztvshgdwwxugjlow.supabase.co',
  SUPABASE_ANON: 'sb_publishable_5MdGLCMpnIs_nldAIlmHrA_73HjWVb1',
  VERSAO: 'v0.1.1'
};

// Cores sugeridas na aba Identidade Visual.
// Escolhidas para funcionar sobre fundo claro e escuro.
const CORES_SUGERIDAS = [
  { nome: 'Carimbo',   valor: '#1B6B55' },
  { nome: 'Tinta',     valor: '#16202E' },
  { nome: 'Ferrugem',  valor: '#A8481B' },
  { nome: 'Índigo',    valor: '#2F4B7C' },
  { nome: 'Vinho',     valor: '#7A2E3F' },
  { nome: 'Grafite',   valor: '#4A5563' }
];
