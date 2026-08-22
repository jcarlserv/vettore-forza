/* =============================================================
   app.js — v0.1.0
   Arranque, navegação entre abas e ligação dos eventos.
   ============================================================= */

function irParaAba(nome) {
  document.querySelectorAll('.aba').forEach(b =>
    b.setAttribute('aria-selected', b.dataset.aba === nome));
  document.querySelectorAll('.secao').forEach(s =>
    s.hidden = s.dataset.aba !== nome);

  if (nome === 'configuracoes') irParaSubAba(subAbaAtual);
  if (nome === 'inicio') montarInicio();
}

function montarInicio() {
  const liberadas = Sessao.catalogo.filter(c => pode(c.chave)).length;
  document.getElementById('resumo-permissoes').textContent =
    `${liberadas} de ${Sessao.catalogo.length}`;
  document.getElementById('resumo-papel').textContent =
    Sessao.perfil.papel_info?.rotulo || Sessao.perfil.papel;
}

async function iniciar() {
  document.getElementById('rodape-versao').textContent =
    CONFIG.PRODUTO + ' · ' + CONFIG.MODULO + ' · ' + CONFIG.VERSAO;

  // Catálogo de papéis é usado em vários lugares; carrega uma vez.
  const { data } = await sb.from('papel').select('*').eq('ativo', true).order('nivel');
  Sessao.papeis = data || [];

  // Login
  document.getElementById('form-login').addEventListener('submit', tratarLogin);
  document.getElementById('link-recuperar').addEventListener('click', e => {
    e.preventDefault(); recuperarSenha();
  });

  // Navegação
  document.querySelectorAll('.aba').forEach(b =>
    b.addEventListener('click', () => irParaAba(b.dataset.aba)));
  document.querySelectorAll('.sub-aba').forEach(b =>
    b.addEventListener('click', () => irParaSubAba(b.dataset.sub)));
  document.getElementById('botao-sair').addEventListener('click', sair);

  // Configurações
  document.getElementById('form-org').addEventListener('submit', salvarOrganizacao);
  document.getElementById('arquivo-logo').addEventListener('change', tratarArquivoLogo);
  document.getElementById('cor-livre').addEventListener('input', e => escolherCor(e.target.value));
  document.getElementById('salvar-visual').addEventListener('click', salvarIdentidadeVisual);
  document.getElementById('remover-logo').addEventListener('click', removerLogo);
  document.getElementById('voltar-padroes').addEventListener('click', voltarParaPadroes);

  // Modal de usuário
  document.getElementById('salvar-usuario').addEventListener('click', salvarUsuario);
  document.getElementById('fechar-usuario').addEventListener('click', () => {
    document.getElementById('modal-usuario').hidden = true;
  });

  await iniciarSessao();
}

document.addEventListener('DOMContentLoaded', iniciar);
