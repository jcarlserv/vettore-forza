/* =============================================================
   Vettore — app.js — v0.3.0
   Arranque, navegação entre abas e ligação dos eventos.
   ============================================================= */

function irParaAba(nome) {
  document.querySelectorAll('.aba').forEach(b =>
    b.setAttribute('aria-selected', b.dataset.aba === nome));
  document.querySelectorAll('.secao').forEach(s =>
    s.hidden = s.dataset.aba !== nome);

  if (nome === 'configuracoes') irParaSubAba(subAbaAtual);
  if (nome === 'inicio' && typeof renderInicioMunicipios === 'function') renderInicioMunicipios();
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
  document.getElementById('adicionar-bloco')?.addEventListener('click', adicionarBlocoNovo);
  document.getElementById('area-blocos-editor')?.addEventListener('click', e => {
    const btnSalvarBloco = e.target.closest('[data-salvar-bloco]');
    if (btnSalvarBloco) return salvarBlocoEditor(btnSalvarBloco.closest('[data-bloco-chave]'));
    const btnAdicionarDoc = e.target.closest('[data-adicionar-doc]');
    if (btnAdicionarDoc) return adicionarDocEditor(btnAdicionarDoc.closest('[data-bloco-chave]'));
    const btnSalvarDoc = e.target.closest('[data-salvar-doc]');
    if (btnSalvarDoc) return salvarDocEditor(btnSalvarDoc.closest('[data-doc-chave]'));
  });
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
  aplicarMascara(document.getElementById('mun-cep'), mascaraCep);
  ligarBuscaCnpj('mun-cnpj', 'buscar-cnpj-mun', 'aviso-municipio', {
    razao_social: 'mun-razao-social', email: 'mun-email', telefone: 'mun-telefone',
    cep: 'mun-cep', logradouro: 'mun-logradouro', numero: 'mun-numero',
    complemento: 'mun-complemento', bairro: 'mun-bairro'
  });
  document.getElementById('mun-uf').addEventListener('input', e => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
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

/* =============================================================
   Preenchimento de Estado e Município no cadastro de município
   -------------------------------------------------------------
   Vive aqui, no último arquivo carregado, e sobrescreve o listener
   anterior do botão. Não depende de nada de outro arquivo além do
   fetch: se qualquer outro módulo estiver desatualizado, este bloco
   ainda funciona.

   Código IBGE não é preenchido automaticamente — é campo livre.
   ============================================================= */

function _vSemAcento(t) {
  return (t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
}

// Extrai o município da razão social da prefeitura.
// "MUNICIPIO DE CHORO" → "CHORO"
function _vMunicipioDaRazao(razao) {
  if (!razao) return '';
  return razao
    .replace(/^\s*(munic[ií]pio|prefeitura|pref\.?)\s+/i, '')
    .replace(/^\s*municipal\s+/i, '')
    .replace(/^\s*(de|do|da|dos|das)\s+/i, '')
    .trim();
}

async function _vBuscarMunicipioPorCnpj() {
  const campo = id => document.getElementById(id);
  const aviso = campo('aviso-municipio');
  const botao = campo('buscar-cnpj-mun');

  const cnpj = (campo('mun-cnpj').value || '').replace(/\D/g, '');
  if (cnpj.length !== 14) {
    mostrarAviso(aviso, 'Digite os 14 dígitos do CNPJ.');
    return;
  }

  limparAviso(aviso);
  botao.disabled = true;
  botao.textContent = 'Buscando…';

  try {
    const r = await fetch('https://brasilapi.com.br/api/cnpj/v1/' + cnpj);
    if (!r.ok) throw new Error('CNPJ não encontrado (HTTP ' + r.status + ').');

    const d = await r.json();
    console.log('[Vettore] CNPJ:', d);

    // ---- UF ----
    let uf = (d.uf || d.estado || '').toString().toUpperCase().slice(0, 2);

    // ---- Município ----
    let nome = (d.municipio || d.cidade || '').toString().trim();

    // Sem município na resposta: tira da razão social.
    if (!nome) nome = _vMunicipioDaRazao(d.razao_social || d.nome_empresarial || '');

    // O CEP completa o que faltar e traz o código IBGE de brinde.
    // Consulto sempre que houver CEP, não só quando falta algo.
    let ibgeDoCep = '';
    if (d.cep) {
      try {
        const rc = await fetch('https://brasilapi.com.br/api/cep/v2/' +
                               String(d.cep).replace(/\D/g, ''));
        if (rc.ok) {
          const c = await rc.json();
          console.log('[Vettore] CEP:', c);
          uf        = uf   || (c.state || '').toUpperCase();
          nome      = nome || (c.city  || '');
          ibgeDoCep = String(c.city_ibge || '');
        }
      } catch (e) {
        console.warn('[Vettore] CEP falhou:', e.message);
      }
    }

    campo('mun-uf').value   = uf;
    campo('mun-nome').value = nome;

    // Código IBGE continua editável — isto só poupa a digitação.
    if (ibgeDoCep && !campo('mun-codigo-ibge').value)
      campo('mun-codigo-ibge').value = ibgeDoCep;

    console.log('[Vettore] Preenchido → UF:', uf, '| Município:', nome,
                '| IBGE:', ibgeDoCep || '(em branco)');

    // Demais campos, sem sobrescrever o que já foi digitado.
    const porFora = (idCampo, valor) => {
      const el = campo(idCampo);
      if (el && valor && !el.value) el.value = valor;
    };

    porFora('mun-razao-social',      d.razao_social || d.nome_empresarial);
    porFora('mun-nome-fantasia',     d.nome_fantasia);
    porFora('mun-natureza-juridica', d.natureza_juridica);
    porFora('mun-data-abertura',     d.data_inicio_atividade);
    porFora('mun-situacao',          d.descricao_situacao_cadastral);
    porFora('mun-email',             d.email);
    porFora('mun-telefone',          d.ddd_telefone_1);
    porFora('mun-prefeito',          (d.qsa || [])[0]?.nome_socio);
    porFora('mun-cep',               d.cep);
    porFora('mun-logradouro',
      [d.descricao_tipo_de_logradouro, d.logradouro].filter(Boolean).join(' '));
    porFora('mun-numero',      d.numero);
    porFora('mun-complemento', d.complemento);
    porFora('mun-bairro',      d.bairro);

    if (!uf || !nome) {
      mostrarAviso(aviso, 'Dados preenchidos. Complete estado e município à mão.');
    } else {
      mostrarAviso(aviso,
        'Dados preenchidos pela Receita Federal. Confira antes de salvar.', 'ok');
    }

  } catch (e) {
    mostrarAviso(aviso, e.message);
    console.error('[Vettore] Falha na busca:', e);
  } finally {
    botao.disabled = false;
    botao.textContent = 'Buscar dados';
  }
}

// Substitui o botão por um clone, o que descarta qualquer listener
// registrado antes por outro arquivo, e liga só este.
document.addEventListener('DOMContentLoaded', () => {
  const antigo = document.getElementById('buscar-cnpj-mun');
  if (!antigo) return;

  const novo = antigo.cloneNode(true);
  antigo.parentNode.replaceChild(novo, antigo);
  novo.addEventListener('click', _vBuscarMunicipioPorCnpj);

  const campoCnpj = document.getElementById('mun-cnpj');
  if (campoCnpj) {
    campoCnpj.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); _vBuscarMunicipioPorCnpj(); }
    });
  }

  // Código IBGE: campo livre, sem preenchimento automático.
  const ibge = document.getElementById('mun-codigo-ibge');
  if (ibge) {
    ibge.removeAttribute('readonly');
    ibge.placeholder = 'Opcional';
  }
});


/* =============================================================
   Busca de unidade pelo CNES
   -------------------------------------------------------------
   Passa pela Edge Function porque o CNES bloqueia chamada direta
   do navegador. Preenche só o que estiver vazio.
   ============================================================= */

async function _vBuscarPorCnes() {
  const campo = id => document.getElementById(id);
  const aviso = campo('aviso-unidade');
  const botao = campo('buscar-cnes');

  const cnes = (campo('uni-cnes').value || '').replace(/\D/g, '');
  if (!cnes) {
    mostrarAviso(aviso, 'Digite o código CNES.');
    return;
  }

  limparAviso(aviso);
  botao.disabled = true;
  botao.textContent = 'Buscando…';

  try {
    const r = await fetch(
      `${CONFIG.SUPABASE_URL}/functions/v1/cnes?cnes=${cnes}`,
      { headers: { Authorization: 'Bearer ' + CONFIG.SUPABASE_ANON } }
    );

    const json = await r.json();
    console.log('[Vettore] CNES:', json);

    if (!r.ok || json.erro) {
      throw new Error(json.erro || 'A consulta ao CNES não respondeu.');
    }

    const d = json.dados;
    const porFora = (idCampo, valor) => {
      const el = campo(idCampo);
      if (el && valor && !el.value) el.value = valor;
    };

    porFora('uni-nome',        d.nome);
    porFora('uni-cnpj',        d.cnpj);
    porFora('uni-responsavel', d.responsavel);
    porFora('uni-email',       d.email);
    porFora('uni-telefone',    d.telefone);
    porFora('uni-cep',         d.cep);
    porFora('uni-logradouro',  d.logradouro);
    porFora('uni-numero',      d.numero);
    porFora('uni-complemento', d.complemento);
    porFora('uni-bairro',      d.bairro);

    mostrarAviso(aviso, `Dados do CNES (${json.fonte}). Confira antes de salvar.`, 'ok');

  } catch (e) {
    mostrarAviso(aviso, e.message);
    console.error('[Vettore] Falha no CNES:', e);
  } finally {
    botao.disabled = false;
    botao.textContent = 'Buscar';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const b = document.getElementById('buscar-cnes');
  if (b) b.addEventListener('click', _vBuscarPorCnes);
});
