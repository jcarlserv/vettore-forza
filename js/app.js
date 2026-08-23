/* =============================================================
   Vettore — app.js — v0.2.0
   Arranque, navegação entre abas e ligação dos eventos.
   ============================================================= */

function irParaAba(nome) {
  document.querySelectorAll('.aba').forEach(b =>
    b.setAttribute('aria-selected', b.dataset.aba === nome));
  document.querySelectorAll('.secao').forEach(s =>
    s.hidden = s.dataset.aba !== nome);

  if (nome === 'configuracoes') irParaSubAba(subAbaAtual);
}

async function iniciar() {
  const assinatura =
    `${CONFIG.PRODUTO} ${CONFIG.VERSAO}•Desenvolvido por ${CONFIG.DESENVOLVEDOR}`;
  document.querySelectorAll('.assinatura').forEach(el => el.textContent = assinatura);

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

  // Qualquer botão com data-fechar fecha o modal indicado.
  document.querySelectorAll('[data-fechar]').forEach(b =>
    b.addEventListener('click', () => {
      document.getElementById(b.dataset.fechar).hidden = true;
    }));

  // Clique fora do modal fecha; Esc também.
  document.querySelectorAll('.fundo-modal').forEach(fundo =>
    fundo.addEventListener('click', e => { if (e.target === fundo) fundo.hidden = true; }));
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('.fundo-modal:not([hidden])').forEach(m => m.hidden = true);
  });

  // Organização
  document.getElementById('form-org').addEventListener('submit', salvarOrganizacao);
  ligarCampoLogo('arquivo-logo-org', 'previa-logo-org', 'aviso-org', 'remover-logo-org');
  ligarBuscaCnpj('org-cnpj', 'buscar-cnpj-org', 'aviso-org', {
    razao_social: 'org-razao', nome_fantasia: 'org-fantasia',
    email: 'org-email', telefone: 'org-telefone',
    cep: 'org-cep', logradouro: 'org-logradouro', numero: 'org-numero',
    complemento: 'org-complemento', bairro: 'org-bairro',
    cidade: 'org-cidade', uf: 'org-uf'
  });

  // Municípios
  document.getElementById('novo-municipio').addEventListener('click', () => abrirMunicipio(null));
  document.getElementById('salvar-municipio').addEventListener('click', salvarMunicipio);
  ligarCampoLogo('arquivo-logo-mun', 'previa-logo-mun', 'aviso-municipio', 'remover-logo-mun');
  aplicarMascara(document.getElementById('mun-cnpj'), mascaraCnpj);
  document.getElementById('mun-uf').addEventListener('change', e => {
    if (e.target.value) carregarListaMunicipios(e.target.value, null);
  });
  document.getElementById('mun-nome').addEventListener('change', preencherCodigoIbge);

  // Unidades
  document.getElementById('nova-unidade').addEventListener('click', () => abrirUnidade(null));
  document.getElementById('salvar-unidade').addEventListener('click', salvarUnidade);
  ligarCampoLogo('arquivo-logo-uni', 'previa-logo-uni', 'aviso-unidade', 'remover-logo-uni');
  ligarBuscaCnpj('uni-cnpj', 'buscar-cnpj-uni', 'aviso-unidade', {
    razao_social: 'uni-nome', email: 'uni-email', telefone: 'uni-telefone',
    cep: 'uni-cep', logradouro: 'uni-logradouro', numero: 'uni-numero',
    complemento: 'uni-complemento', bairro: 'uni-bairro'
  });
  aplicarMascara(document.getElementById('uni-cep'), mascaraCep);
  aplicarMascara(document.getElementById('org-cep'), mascaraCep);

  // Usuários
  document.getElementById('novo-usuario').addEventListener('click', () => abrirUsuario(null));
  document.getElementById('salvar-usuario').addEventListener('click', salvarUsuario);

  // Permissões
  document.getElementById('voltar-padroes').addEventListener('click', voltarParaPadroes);

  await iniciarSessao();
}

document.addEventListener('DOMContentLoaded', iniciar);
