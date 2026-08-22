/* =============================================================
   config.js — v0.1.0
   Credenciais e constantes do projeto.
   A chave anon é pública por natureza (vai no navegador de qualquer
   jeito). Quem protege o dado aqui é o RLS do Postgres, não o segredo
   desta chave. A chave service_role NUNCA entra neste arquivo.
   ============================================================= */

const CONFIG = {
  PRODUTO: 'Vettore',
  ASSINATURA: 'Tecnologia para Organizações Sociais de Saúde',
  MODULO: 'Prestação de Contas',
  SUPABASE_URL:  'https://SEU-PROJETO.supabase.co',
  SUPABASE_ANON: 'COLE-AQUI-A-CHAVE-ANON',
  VERSAO: 'v0.1.0'
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
