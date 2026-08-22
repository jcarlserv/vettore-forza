/* =============================================================
   api.js — v0.1.0
   Cliente Supabase, estado da sessão e leitura de permissões.
   ============================================================= */

const sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON);

// Estado vivo da sessão. Preenchido no login, limpo na saída.
const Sessao = {
  usuario: null,       // { id, email }
  perfil: null,        // linha da tabela perfil
  papeis: [],          // catálogo de papéis
  catalogo: [],        // catálogo de permissões
  permissoes: {},      // { chave: true|false } já resolvido para este usuário
  organizacao: null
};

/* -------- Permissões -------- */

// Resolve o que ESTE usuário pode fazer: padrão do papel + sobrescritas.
// Repete no cliente a mesma regra que tem_permissao() aplica no banco.
// O cliente decide o que MOSTRAR; o banco decide o que PERMITE.
// Se as duas discordarem, quem manda é o banco.
async function carregarPermissoes() {
  const [cat, padroes, individuais] = await Promise.all([
    sb.from('permissao_catalogo').select('*').order('ordem'),
    sb.from('permissao_papel').select('chave, permitido').eq('papel', Sessao.perfil.papel),
    sb.from('permissao_usuario').select('chave, permitido').eq('perfil_id', Sessao.perfil.id)
  ]);

  Sessao.catalogo = cat.data || [];
  Sessao.permissoes = {};

  (padroes.data || []).forEach(p => { Sessao.permissoes[p.chave] = p.permitido; });
  (individuais.data || []).forEach(p => { Sessao.permissoes[p.chave] = p.permitido; });
}

function pode(chave) {
  return Sessao.permissoes[chave] === true;
}

// Esconde da tela tudo que exige uma permissão que o usuário não tem.
// Uso: <button data-permissao="config.usuarios.editar">
function aplicarPermissoesNaTela(raiz = document) {
  raiz.querySelectorAll('[data-permissao]').forEach(el => {
    el.hidden = !pode(el.dataset.permissao);
  });
}

/* -------- Auditoria -------- */

async function registrarAuditoria(tabela, registroId, acao, detalhe = null) {
  if (!Sessao.perfil) return;
  await sb.from('log_auditoria').insert({
    perfil_id: Sessao.perfil.id,
    tabela,
    registro_id: registroId ? String(registroId) : null,
    acao,
    detalhe
  });
}

/* -------- Paginação -------- */

// O PostgREST corta em ~1000 linhas sem avisar. Qualquer consulta que
// possa crescer passa por aqui, senão o sistema mente calado.
async function buscarTudo(tabela, seletor = '*', montarFiltro = null, tamanho = 500) {
  let inicio = 0;
  const acumulado = [];

  while (true) {
    let q = sb.from(tabela).select(seletor).range(inicio, inicio + tamanho - 1);
    if (montarFiltro) q = montarFiltro(q);

    const { data, error } = await q;
    if (error) throw error;

    acumulado.push(...data);
    if (data.length < tamanho) break;
    inicio += tamanho;
  }
  return acumulado;
}

/* -------- Utilidades de tela -------- */

function mostrarAviso(elemento, texto, tipo = 'erro') {
  if (!elemento) return;
  elemento.className = 'aviso ' + tipo;
  elemento.textContent = texto;
  elemento.hidden = false;
}

function limparAviso(elemento) {
  if (elemento) elemento.hidden = true;
}

function escapar(texto) {
  const d = document.createElement('div');
  d.textContent = texto ?? '';
  return d.innerHTML;
}
