/* =============================================================
   Vettore — configuracoes.js — v0.2.0

   Cinco áreas, na ordem em que o cadastro precisa ser feito:
   Organização → Municípios → Unidades → Usuários → Permissões.
   Cada uma depende da anterior, e as telas dizem isso quando a
   anterior está vazia.

   A matriz de permissões continua sem nenhuma permissão escrita
   no código: é montada a partir de permissao_catalogo.
   ============================================================= */

let subAbaAtual = 'organizacao';
let listaUsuarios = [], listaMunicipios = [], listaUnidades = [];
let padroesPapel = {};
let usuarioSelecionado = null;
let editandoMunicipio = null, editandoUnidade = null, editandoUsuario = null;

function irParaSubAba(nome) {
  subAbaAtual = nome;
  document.querySelectorAll('.sub-aba').forEach(b =>
    b.setAttribute('aria-selected', b.dataset.sub === nome));
  document.querySelectorAll('.painel-config').forEach(p =>
    p.hidden = p.dataset.sub !== nome);

  ({
    organizacao: carregarOrganizacao,
    municipios:  carregarMunicipios,
    unidades:    carregarUnidades,
    usuarios:    carregarUsuarios,
    permissoes:  carregarMatrizPermissoes
  }[nome] || (() => {}))();
}

/* =============================================================
   ORGANIZAÇÃO
   ============================================================= */

async function carregarOrganizacao() {
  const { data } = await sb.from('organizacao').select('*').maybeSingle();
  if (!data) return;
  Sessao.organizacao = data;

  const campos = {
    'org-cnpj': 'cnpj', 'org-razao': 'razao_social', 'org-fantasia': 'nome_fantasia',
    'org-email': 'email_suporte', 'org-telefone': 'telefone',
    'org-cep': 'cep', 'org-logradouro': 'logradouro', 'org-numero': 'numero',
    'org-complemento': 'complemento', 'org-bairro': 'bairro',
    'org-cidade': 'cidade', 'org-uf': 'uf'
  };
  Object.entries(campos).forEach(([id, col]) => {
    const el = document.getElementById(id);
    if (el) el.value = data[col] || '';
  });

  mostrarLogoExistente('previa-logo-org', data.logo_data_url);
  montarSeletorTema(data);
}

async function salvarOrganizacao(evento) {
  evento.preventDefault();
  const aviso = document.getElementById('aviso-org');

  const dados = {
    cnpj:          document.getElementById('org-cnpj').value.trim(),
    razao_social:  document.getElementById('org-razao').value.trim(),
    nome_fantasia: document.getElementById('org-fantasia').value.trim(),
    email_suporte: document.getElementById('org-email').value.trim(),
    telefone:      document.getElementById('org-telefone').value.trim(),
    cep:           document.getElementById('org-cep').value.trim(),
    logradouro:    document.getElementById('org-logradouro').value.trim(),
    numero:        document.getElementById('org-numero').value.trim(),
    complemento:   document.getElementById('org-complemento').value.trim(),
    bairro:        document.getElementById('org-bairro').value.trim(),
    cidade:        document.getElementById('org-cidade').value.trim(),
    uf:            document.getElementById('org-uf').value.trim().toUpperCase(),
    cor_marca:      document.getElementById('cor-marca').value,
    cor_secundaria: document.getElementById('cor-destaque').value,
    cor_topo:       document.getElementById('cor-topo').value,
    cor_fundo:      document.getElementById('cor-fundo').value,
    tema:           document.getElementById('area-temas').dataset.tema || 'personalizado',
    atualizado_em: new Date().toISOString(),
    atualizado_por: Sessao.perfil.id
  };

  const logo = valorLogoParaSalvar('previa-logo-org');
  if (logo !== undefined) dados.logo_data_url = logo;

  const { error } = await sb.from('organizacao').update(dados).eq('id', Sessao.organizacao.id);
  if (error) return mostrarAviso(aviso, 'Não foi possível salvar: ' + error.message);

  mostrarAviso(aviso, 'Organização salva.', 'ok');
  registrarAuditoria('organizacao', Sessao.organizacao.id, 'ALTERAR');
  await carregarIdentidadeVisual();
}

/* -------- Tema -------- */

const CAMPOS_COR = [
  { id: 'cor-marca',    chave: 'marca',      rotulo: 'Cor principal',
    ajuda: 'Botões, abas ativas e links.' },
  { id: 'cor-destaque', chave: 'secundaria', rotulo: 'Destaque',
    ajuda: 'Confirmações e marcadores.' },
  { id: 'cor-topo',     chave: 'topo',       rotulo: 'Barra superior',
    ajuda: 'Fundo do cabeçalho.' },
  { id: 'cor-fundo',    chave: 'fundo',      rotulo: 'Fundo das telas',
    ajuda: 'Superfície atrás dos painéis.' }
];

function montarSeletorTema(org) {
  const area = document.getElementById('area-temas');

  area.innerHTML = Object.entries(TEMAS).map(([chave, t]) => `
    <button type="button" class="cartao-tema" data-tema="${chave}"
            aria-pressed="${(org.tema || TEMA_PADRAO) === chave}">
      <span class="amostra-tema" style="background:${t.fundo}">
        <span class="faixa-topo" style="background:${t.topo}"></span>
        <span class="faixa-corpo">
          <span class="pastilha" style="background:${t.marca}"></span>
          <span class="pastilha dois" style="background:${t.secundaria}"></span>
        </span>
      </span>
      <span class="rotulo-tema">${t.nome}</span>
    </button>`).join('');

  area.dataset.tema = org.tema || TEMA_PADRAO;
  area.querySelectorAll('.cartao-tema').forEach(b =>
    b.onclick = () => escolherTema(b.dataset.tema));

  const atual = {
    marca:      org.cor_marca      || TEMAS[TEMA_PADRAO].marca,
    secundaria: org.cor_secundaria || TEMAS[TEMA_PADRAO].secundaria,
    topo:       org.cor_topo       || TEMAS[TEMA_PADRAO].topo,
    fundo:      org.cor_fundo      || TEMAS[TEMA_PADRAO].fundo
  };

  CAMPOS_COR.forEach(c => {
    const input = document.getElementById(c.id);
    input.value = atual[c.chave];
    atualizarRotuloCor(c.id);
    input.oninput = () => {
      aplicarTema(lerCoresDaTela());
      atualizarRotuloCor(c.id);
      marcarPersonalizado();
    };
  });

  aplicarTema(atual);
}

function lerCoresDaTela() {
  return {
    marca:      document.getElementById('cor-marca').value,
    secundaria: document.getElementById('cor-destaque').value,
    topo:       document.getElementById('cor-topo').value,
    fundo:      document.getElementById('cor-fundo').value
  };
}

function escolherTema(chave) {
  const t = TEMAS[chave];
  if (!t) return;

  document.getElementById('cor-marca').value    = t.marca;
  document.getElementById('cor-destaque').value = t.secundaria;
  document.getElementById('cor-topo').value     = t.topo;
  document.getElementById('cor-fundo').value    = t.fundo;
  CAMPOS_COR.forEach(c => atualizarRotuloCor(c.id));

  aplicarTema(t);

  const area = document.getElementById('area-temas');
  area.dataset.tema = chave;
  area.querySelectorAll('.cartao-tema').forEach(b =>
    b.setAttribute('aria-pressed', b.dataset.tema === chave));
}

// Mexeu numa cor à mão: nenhum tema pronto representa mais a
// escolha, então nenhum fica marcado.
function marcarPersonalizado() {
  const area = document.getElementById('area-temas');
  area.dataset.tema = 'personalizado';
  area.querySelectorAll('.cartao-tema').forEach(b =>
    b.setAttribute('aria-pressed', 'false'));
}

function atualizarRotuloCor(id) {
  const input = document.getElementById(id);
  const alvo = document.querySelector(`[data-valor-de="${id}"]`);
  if (alvo) alvo.textContent = input.value.toUpperCase();
}

async function carregarIdentidadeVisual() {
  const { data } = await sb.from('organizacao').select('*').maybeSingle();
  if (!data) return;
  Sessao.organizacao = data;
  aplicarTema({
    marca:      data.cor_marca,
    secundaria: data.cor_secundaria,
    topo:       data.cor_topo,
    fundo:      data.cor_fundo
  });

  const img = document.getElementById('logo-topo');
  if (data.logo_data_url) { img.src = data.logo_data_url; img.hidden = false; }
  else img.hidden = true;

  document.getElementById('nome-osc').textContent =
    data.nome_fantasia || data.razao_social || '';
}

/* =============================================================
   MUNICÍPIOS
   ============================================================= */

async function carregarMunicipios() {
  const corpo = document.getElementById('corpo-municipios');
  corpo.innerHTML = linhaCarregando(4);

  listaMunicipios = await buscarTudo('municipio', '*', q => q.order('nome'));
  if (!listaUnidades.length)
    listaUnidades = await buscarTudo('unidade_saude', '*', q => q.order('nome'));

  if (!listaMunicipios.length) {
    corpo.innerHTML = linhaVazia(4,
      'Nenhum município cadastrado. Comece por aqui — toda unidade pertence a um município.');
    return;
  }

  corpo.innerHTML = listaMunicipios.map(m => `
    <tr>
      <td>${celulaComLogo(m.logo_data_url, m.nome, m.codigo_ibge ? 'IBGE ' + m.codigo_ibge : '')}</td>
      <td class="dado">${escapar(m.uf)}</td>
      <td>${escapar(m.secretaria_saude || '—')}</td>
      <td>${contarUnidadesDo(m.id)}</td>
      <td class="acoes">${botoesAcao('municipio', m.id, false)}</td>
    </tr>`).join('');

  aplicarPermissoesNaTela(corpo);
}

function contarUnidadesDo(municipioId) {
  const n = listaUnidades.filter(u => u.municipio_id === municipioId).length;
  return n ? `<span class="dado">${n}</span>` : '<span style="color:var(--tinta-40)">—</span>';
}

async function abrirMunicipio(id) {
  editandoMunicipio = id ? listaMunicipios.find(m => m.id === id) : null;
  const m = editandoMunicipio || {};

  document.getElementById('titulo-municipio').textContent =
    id ? 'Editar município' : 'Novo município';

  ['uf','nome','codigo-ibge','cnpj','prefeito','secretaria-saude','email','telefone',
   'razao-social','nome-fantasia','natureza-juridica','data-abertura','situacao',
   'cep','logradouro','numero','complemento','bairro'].forEach(c => {
    const el = document.getElementById('mun-' + c);
    if (el) el.value = m[c.replace(/-/g, '_')] || '';
  });

  mostrarLogoExistente('previa-logo-mun', m.logo_data_url);
  limparAviso(document.getElementById('aviso-municipio'));
  await carregarCapasDoMunicipio(id);
  document.getElementById('modal-municipio').hidden = false;
}

async function carregarCapasDoMunicipio(municipioId) {
  const catalogo = typeof garantirCatalogoDocumentos === 'function'
    ? await garantirCatalogoDocumentos() : [];
  const blocos = [...new Set(catalogo.map(c => c.bloco))];
  const rotulos = { organizacao: 'Dados da Organização', financeiro: 'Financeiro' };

  let capaGeral = null, titulosBloco = {};
  if (municipioId) {
    const [{ data: cg }, { data: tb }] = await Promise.all([
      sb.from('capa_municipio').select('*').eq('municipio_id', municipioId).maybeSingle(),
      sb.from('capa_bloco_titulo').select('*').eq('municipio_id', municipioId)
    ]);
    capaGeral = cg;
    (tb || []).forEach(t => { titulosBloco[t.bloco] = t.titulo; });
  }

  document.getElementById('mun-capa-subtitulo').value =
    capaGeral?.subtitulo_prestacao || 'GESTÃO DOS SERVIÇOS DE SAÚDE MUNICIPAL';

  document.getElementById('capas-blocos').innerHTML = blocos.map(b => `
    <div class="campo">
      <label for="capa-bloco-${b}">${escapar(rotulos[b] || b)}</label>
      <input type="text" id="capa-bloco-${b}" data-bloco="${b}"
             value="${escapar(titulosBloco[b] || (rotulos[b] || b).toUpperCase())}">
    </div>`).join('');
}

async function salvarCapasDoMunicipio(municipioId) {
  if (!municipioId) return;
  const subtitulo = document.getElementById('mun-capa-subtitulo').value.trim();

  await sb.from('capa_municipio').upsert({
    municipio_id: municipioId,
    subtitulo_prestacao: subtitulo || 'GESTÃO DOS SERVIÇOS DE SAÚDE MUNICIPAL',
    atualizado_em: new Date().toISOString(),
    atualizado_por: Sessao.perfil.id
  });

  const linhas = [...document.querySelectorAll('#capas-blocos [data-bloco]')].map(el => ({
    municipio_id: municipioId,
    bloco: el.dataset.bloco,
    titulo: el.value.trim() || el.dataset.bloco.toUpperCase()
  }));
  if (linhas.length)
    await sb.from('capa_bloco_titulo').upsert(linhas, { onConflict: 'municipio_id,bloco' });
}

// Preenche o código IBGE quando o nome digitado bate com a lista.
async function preencherCodigoIbge() {
  const uf = document.getElementById('mun-uf').value.trim().toUpperCase();
  const nome = document.getElementById('mun-nome').value.trim();
  const campo = document.getElementById('mun-codigo-ibge');
  if (!uf || !nome || campo.value) return;

  try {
    const achado = (await municipiosDaUf(uf))
      .find(mun => normalizar(mun.nome) === normalizar(nome));
    if (achado) campo.value = achado.codigo;
    else console.warn('[Vettore] Município não encontrado na lista do IBGE:', nome, uf);
  } catch (e) {
    console.warn('[Vettore] Falha ao consultar o IBGE:', e.message);
  }
}

// A busca do município não usa o ligarBuscaCnpj genérico: aqui os
// dois primeiros campos são selects encadeados. É preciso escolher a
// UF, esperar a lista do IBGE carregar e só então marcar o município.
// A Receita devolve o nome em caixa alta e às vezes sem acento, então
// a comparação ignora acento e caixa.
async function buscarCnpjMunicipio() {
  const aviso = document.getElementById('aviso-municipio');
  const botao = document.getElementById('buscar-cnpj-mun');
  limparAviso(aviso);
  botao.disabled = true;
  botao.textContent = 'Buscando…';

  try {
    const d = await consultarCnpj(document.getElementById('mun-cnpj').value);

    // ---- Município e UF ----
    // Não dependem de um campo específico da resposta. Três fontes,
    // da mais confiável para a menos, e a primeira que der resultado
    // vence.
    let uf   = d.uf   || '';
    let nome = d.cidade || '';

    // Fonte 2: o CEP. Formato fixo, sempre traz cidade e estado.
    if ((!uf || !nome) && d.cep) {
      const porCep = await consultarCep(d.cep);
      if (porCep) {
        uf   = uf   || porCep.uf;
        nome = nome || porCep.cidade;
      }
    }

    // Fonte 3: a razão social, conferida contra a lista embutida.
    // Não usa rede — funciona mesmo com todas as APIs fora do ar.
    let codigo = '';
    const daRazao = municipioPelaRazaoSocial(d.razao_social);
    if (daRazao) {
      nome   = nome || daRazao.nome;
      uf     = uf   || daRazao.uf;
      codigo = daRazao.codigo;
    }

    // Grafia oficial e código IBGE pela lista embutida.
    const naLista = municipioCePorNome(nome);
    if (naLista) {
      nome = naLista.nome;
      uf = uf || 'CE';
      codigo = naLista.codigo;
    }

    document.getElementById('mun-uf').value   = uf;
    document.getElementById('mun-nome').value = nome;
    document.getElementById('mun-codigo-ibge').value = codigo;
    console.log('[Vettore] Preenchido — UF:', uf, '| Município:', nome, '| IBGE:', codigo);

    if (uf && nome) {

      const repetido = listaMunicipios.some(x =>
        x.uf === uf && normalizar(x.nome) === normalizar(nome) &&
        x.id !== editandoMunicipio?.id);
      if (repetido) {
        mostrarAviso(aviso, `${nome}/${uf} já está cadastrado.`);
        return;
      }
    }

    preencherSeVazio('mun-email', d.email);
    preencherSeVazio('mun-telefone', d.telefone);
    preencherSeVazio('mun-prefeito', d.responsavel);
    preencherSeVazio('mun-razao-social', d.razao_social);
    preencherSeVazio('mun-nome-fantasia', d.nome_fantasia);
    preencherSeVazio('mun-natureza-juridica', d.natureza);
    preencherSeVazio('mun-data-abertura', d.data_abertura);
    preencherSeVazio('mun-situacao', d.situacao);
    preencherSeVazio('mun-cep', d.cep);
    preencherSeVazio('mun-logradouro', d.logradouro);
    preencherSeVazio('mun-numero', d.numero);
    preencherSeVazio('mun-complemento', d.complemento);
    preencherSeVazio('mun-bairro', d.bairro);

    mostrarAviso(aviso, 'Dados preenchidos pela Receita Federal. Confira antes de salvar.', 'ok');

  } catch (e) {
    mostrarAviso(aviso, e.message);
  } finally {
    botao.disabled = false;
    botao.textContent = 'Buscar dados';
  }
}

function normalizar(t) {
  return (t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
}

function preencherSeVazio(id, valor) {
  const el = document.getElementById(id);
  if (el && valor && !el.value) el.value = valor;
}

function preencherCodigoIbge() {
  const sel = document.getElementById('mun-nome');
  const op = sel.selectedOptions[0];
  const campo = document.getElementById('mun-codigo-ibge');
  if (op && op.dataset.ibge) campo.value = op.dataset.ibge;
}

async function salvarMunicipio() {
  const aviso = document.getElementById('aviso-municipio');
  const nome = document.getElementById('mun-nome').value.trim();
  const uf   = document.getElementById('mun-uf').value.trim().toUpperCase();

  if (!uf)   return mostrarAviso(aviso, 'Escolha o estado.');
  if (!nome) return mostrarAviso(aviso, 'Escolha o município.');

  const repetido = listaMunicipios.some(x =>
    x.uf === uf &&
    x.nome.toLowerCase() === nome.toLowerCase() &&
    x.id !== editandoMunicipio?.id);

  if (repetido)
    return mostrarAviso(aviso, `${nome}/${uf} já está cadastrado.`);

  const dados = {
    nome, uf,
    codigo_ibge:      document.getElementById('mun-codigo-ibge').value.trim(),
    cnpj:             document.getElementById('mun-cnpj').value.trim(),
    razao_social:     document.getElementById('mun-razao-social').value.trim(),
    cep:              document.getElementById('mun-cep').value.trim(),
    logradouro:       document.getElementById('mun-logradouro').value.trim(),
    numero:           document.getElementById('mun-numero').value.trim(),
    complemento:      document.getElementById('mun-complemento').value.trim(),
    bairro:           document.getElementById('mun-bairro').value.trim(),
    prefeito:         document.getElementById('mun-prefeito').value.trim(),
    secretaria_saude: document.getElementById('mun-secretaria-saude').value.trim(),
    email:            document.getElementById('mun-email').value.trim(),
    telefone:         document.getElementById('mun-telefone').value.trim(),
    razao_social:      document.getElementById('mun-razao-social').value.trim(),
    nome_fantasia:     document.getElementById('mun-nome-fantasia').value.trim(),
    natureza_juridica: document.getElementById('mun-natureza-juridica').value.trim(),
    data_abertura:     document.getElementById('mun-data-abertura').value || null,
    situacao:          document.getElementById('mun-situacao').value.trim(),
    cep:               document.getElementById('mun-cep').value.trim(),
    logradouro:        document.getElementById('mun-logradouro').value.trim(),
    numero:            document.getElementById('mun-numero').value.trim(),
    complemento:       document.getElementById('mun-complemento').value.trim(),
    bairro:            document.getElementById('mun-bairro').value.trim()
  };

  const logo = valorLogoParaSalvar('previa-logo-mun');
  if (logo !== undefined) dados.logo_data_url = logo;

  let error, registro;
  if (editandoMunicipio) {
    ({ error } = await sb.from('municipio').update(dados).eq('id', editandoMunicipio.id));
    registro = editandoMunicipio;
  } else {
    dados.criado_por = Sessao.perfil.id;
    ({ data: registro, error } = await sb.from('municipio').insert(dados).select().single());
  }

  if (error) {
    return mostrarAviso(aviso, /duplicate|unique/i.test(error.message)
      ? 'Já existe um município com esse nome nessa UF.'
      : 'Não foi possível salvar: ' + error.message);
  }

  await salvarCapasDoMunicipio(registro?.id);

  registrarAuditoria('municipio', editandoMunicipio?.id, editandoMunicipio ? 'ALTERAR' : 'INSERIR');
  document.getElementById('modal-municipio').hidden = true;
  await carregarMunicipios();
}

async function excluirMunicipio(id) {
  const m = listaMunicipios.find(x => x.id === id);
  const vinculadas = listaUnidades.filter(u => u.municipio_id === id).length;

  if (vinculadas)
    return alert(`${m.nome} tem ${vinculadas} unidade(s) vinculada(s). Exclua ou transfira as unidades primeiro.`);

  if (!confirm(`Excluir o município ${m.nome}? Esta ação não pode ser desfeita.`)) return;

  const { error } = await sb.from('municipio').delete().eq('id', id);
  if (error) return alert('Não foi possível excluir: ' + error.message);

  registrarAuditoria('municipio', id, 'EXCLUIR', { nome: m.nome });
  await carregarMunicipios();
}

/* =============================================================
   UNIDADES
   ============================================================= */

const TIPOS_UNIDADE = ['Hospital','UPA','UBS','Policlínica','CAPS','SAMU','Laboratório','Outro'];

async function carregarUnidades() {
  const corpo = document.getElementById('corpo-unidades');
  corpo.innerHTML = linhaCarregando(4);

  if (!listaMunicipios.length)
    listaMunicipios = await buscarTudo('municipio', '*', q => q.order('nome'));

  listaUnidades = await buscarTudo('unidade_saude', '*', q => q.order('nome'));

  if (!listaMunicipios.length) {
    corpo.innerHTML = linhaVazia(4, 'Cadastre um município antes — toda unidade pertence a um.');
    return;
  }
  if (!listaUnidades.length) {
    corpo.innerHTML = linhaVazia(4, 'Nenhuma unidade cadastrada ainda.');
    return;
  }

  const nomeMunicipio = Object.fromEntries(
    listaMunicipios.map(m => [m.id, `${m.nome}/${m.uf}`]));

  corpo.innerHTML = listaUnidades.map(u => `
    <tr>
      <td>${celulaComLogo(u.logo_data_url, u.nome, u.cnes ? 'CNES ' + u.cnes : '')}</td>
      <td>${escapar(u.tipo)}</td>
      <td>${escapar(nomeMunicipio[u.municipio_id] || '—')}</td>
      <td>${escapar(u.responsavel || '—')}</td>
      <td class="acoes">${botoesAcao('unidade', u.id, false)}</td>
    </tr>`).join('');

  aplicarPermissoesNaTela(corpo);
}

function abrirUnidade(id) {
  editandoUnidade = id ? listaUnidades.find(u => u.id === id) : null;
  const u = editandoUnidade || {};

  document.getElementById('titulo-unidade').textContent = id ? 'Editar unidade' : 'Nova unidade';

  document.getElementById('uni-municipio').innerHTML = listaMunicipios.map(m =>
    `<option value="${m.id}" ${m.id === u.municipio_id ? 'selected' : ''}>${escapar(m.nome)}/${m.uf}</option>`
  ).join('');

  document.getElementById('uni-tipo').innerHTML = TIPOS_UNIDADE.map(t =>
    `<option ${t === u.tipo ? 'selected' : ''}>${t}</option>`).join('');

  ['nome','cnpj','cnes','responsavel','email','telefone',
   'cep','logradouro','numero','complemento','bairro'].forEach(c => {
    const el = document.getElementById('uni-' + c);
    if (el) el.value = u[c] || '';
  });

  mostrarLogoExistente('previa-logo-uni', u.logo_data_url);
  limparAviso(document.getElementById('aviso-unidade'));
  document.getElementById('modal-unidade').hidden = false;
}

async function salvarUnidade() {
  const aviso = document.getElementById('aviso-unidade');
  const nome = document.getElementById('uni-nome').value.trim();
  if (!nome) return mostrarAviso(aviso, 'O nome da unidade é obrigatório.');

  const dados = {
    municipio_id: document.getElementById('uni-municipio').value,
    nome,
    tipo:        document.getElementById('uni-tipo').value,
    cnpj:        document.getElementById('uni-cnpj').value.trim(),
    cnes:        document.getElementById('uni-cnes').value.trim(),
    responsavel: document.getElementById('uni-responsavel').value.trim(),
    email:       document.getElementById('uni-email').value.trim(),
    telefone:    document.getElementById('uni-telefone').value.trim(),
    cep:         document.getElementById('uni-cep').value.trim(),
    logradouro:  document.getElementById('uni-logradouro').value.trim(),
    numero:      document.getElementById('uni-numero').value.trim(),
    complemento: document.getElementById('uni-complemento').value.trim(),
    bairro:      document.getElementById('uni-bairro').value.trim()
  };

  const logo = valorLogoParaSalvar('previa-logo-uni');
  if (logo !== undefined) dados.logo_data_url = logo;

  let error;
  if (editandoUnidade) {
    ({ error } = await sb.from('unidade_saude').update(dados).eq('id', editandoUnidade.id));
  } else {
    dados.criado_por = Sessao.perfil.id;
    ({ error } = await sb.from('unidade_saude').insert(dados));
  }

  if (error) {
    return mostrarAviso(aviso, /duplicate|unique/i.test(error.message)
      ? 'Já existe uma unidade com esse nome nesse município.'
      : 'Não foi possível salvar: ' + error.message);
  }

  registrarAuditoria('unidade_saude', editandoUnidade?.id, editandoUnidade ? 'ALTERAR' : 'INSERIR');
  document.getElementById('modal-unidade').hidden = true;
  await carregarUnidades();
}

async function excluirUnidade(id) {
  const u = listaUnidades.find(x => x.id === id);
  if (!confirm(`Excluir a unidade ${u.nome}? Esta ação não pode ser desfeita.`)) return;

  const { error } = await sb.from('unidade_saude').delete().eq('id', id);
  if (error) {
    return alert(/foreign key/i.test(error.message)
      ? 'Esta unidade já tem registros vinculados e não pode ser excluída.'
      : 'Não foi possível excluir: ' + error.message);
  }

  registrarAuditoria('unidade_saude', id, 'EXCLUIR', { nome: u.nome });
  await carregarUnidades();
}

/* =============================================================
   USUÁRIOS
   ============================================================= */

async function carregarUsuarios() {
  const corpo = document.getElementById('corpo-usuarios');
  corpo.innerHTML = linhaCarregando(4);

  const [perfis, vincUnidade, vincMunicipio] = await Promise.all([
    buscarTudo('perfil', '*', q => q.order('nome')),
    buscarTudo('usuario_unidade', '*'),
    buscarTudo('usuario_municipio', '*')
  ]);

  if (!listaMunicipios.length)
    listaMunicipios = await buscarTudo('municipio', '*', q => q.order('nome'));
  if (!listaUnidades.length)
    listaUnidades = await buscarTudo('unidade_saude', '*', q => q.order('nome'));

  listaUsuarios = perfis.map(p => ({
    ...p,
    unidades:   vincUnidade.filter(v => v.perfil_id === p.id).map(v => v.unidade_saude_id),
    municipios: vincMunicipio.filter(v => v.perfil_id === p.id).map(v => v.municipio_id)
  }));

  const rotuloPapel   = Object.fromEntries(Sessao.papeis.map(p => [p.codigo, p.rotulo]));
  const nomeUnidade   = Object.fromEntries(listaUnidades.map(u => [u.id, u.nome]));
  const nomeMunicipio = Object.fromEntries(listaMunicipios.map(m => [m.id, m.nome]));

  corpo.innerHTML = listaUsuarios.map(u => `
    <tr>
      <td>
        <strong>${escapar(u.nome)}</strong><br>
        <span class="dado sub-linha">${escapar(u.email)}</span>
      </td>
      <td>${escapar(rotuloPapel[u.papel] || u.papel)}</td>
      <td>${descreverAlcance(u, nomeMunicipio, nomeUnidade)}</td>
      <td><span class="tag ${u.ativo ? 'ativo' : 'inativo'}">${u.ativo ? 'Ativo' : 'Inativo'}</span></td>
      <td class="acoes">${botoesAcao('usuario', u.id, true)}</td>
    </tr>`).join('');

  aplicarPermissoesNaTela(corpo);
}

// Administrador e Gestão alcançam tudo por definição do papel;
// listar unidades para eles seria mentira na tela.
function descreverAlcance(u, nomeMunicipio, nomeUnidade) {
  if (['Administrador','Gestao'].includes(u.papel))
    return '<span class="tag">Todas as unidades</span>';

  const partes = [];
  u.municipios.forEach(id =>
    partes.push(`<span class="tag">${escapar(nomeMunicipio[id] || '?')} — todas</span>`));
  u.unidades.forEach(id =>
    partes.push(`<span class="tag">${escapar(nomeUnidade[id] || '?')}</span>`));

  return partes.length
    ? `<div class="pilha-tags">${partes.join('')}</div>`
    : '<span style="color:var(--alerta);font-size:12.5px">Sem unidade — não vê nada</span>';
}

function abrirUsuario(id) {
  editandoUsuario = id ? listaUsuarios.find(u => u.id === id) : null;
  const u = editandoUsuario || {};
  const novo = !id;

  document.getElementById('titulo-usuario').textContent = novo ? 'Novo usuário' : 'Editar usuário';
  document.getElementById('usu-nome').value  = u.nome || '';
  document.getElementById('usu-email').value = u.email || '';
  document.getElementById('usu-email').disabled = !novo;
  document.getElementById('usu-ativo').checked = novo ? true : u.ativo;

  document.getElementById('bloco-senha').hidden = !novo;
  document.getElementById('usu-senha').value = '';
  document.getElementById('nota-email').textContent = novo
    ? 'Será o login da pessoa. Não pode ser alterado depois.'
    : 'O email é a chave do login e só muda pelo painel de autenticação.';

  document.getElementById('usu-papel').innerHTML = Sessao.papeis.map(p =>
    `<option value="${p.codigo}" ${p.codigo === u.papel ? 'selected' : ''}>${escapar(p.rotulo)}</option>`
  ).join('');

  montarSeletorAlcance(u);
  document.getElementById('usu-papel').onchange = () => montarSeletorAlcance(u);

  limparAviso(document.getElementById('aviso-usuario'));
  document.getElementById('modal-usuario').hidden = false;
}

function montarSeletorAlcance(u) {
  const papel = document.getElementById('usu-papel').value;
  const area  = document.getElementById('area-alcance');

  if (['Administrador','Gestao'].includes(papel)) {
    area.innerHTML = `<p class="rodape-nota" style="margin:0">
      Este papel alcança todas as unidades por definição. Não é preciso escolher.</p>`;
    return;
  }

  const marcadosM = new Set(u.municipios || []);
  const marcadosU = new Set(u.unidades || []);

  area.innerHTML = listaMunicipios.map(m => {
    const doMunicipio = listaUnidades.filter(x => x.municipio_id === m.id);
    return `
      <div class="grupo-alcance">
        <label class="linha-alcance forte">
          <input type="checkbox" class="chk-municipio" value="${m.id}"
                 ${marcadosM.has(m.id) ? 'checked' : ''}>
          <span>${escapar(m.nome)}/${m.uf} — todas as unidades</span>
        </label>
        ${doMunicipio.length
          ? doMunicipio.map(x => `
            <label class="linha-alcance recuo">
              <input type="checkbox" class="chk-unidade" value="${x.id}"
                     ${marcadosU.has(x.id) ? 'checked' : ''}>
              <span>${escapar(x.nome)}</span>
            </label>`).join('')
          : '<p class="rodape-nota recuo">Sem unidades cadastradas.</p>'}
      </div>`;
  }).join('') || '<p class="rodape-nota">Cadastre municípios e unidades primeiro.</p>';

  // Marcar o município cobre todas as unidades dele, inclusive as
  // que forem criadas depois — então as caixas filhas saem de cena.
  area.querySelectorAll('.chk-municipio').forEach(chk => {
    const sincronizar = () => {
      chk.closest('.grupo-alcance').querySelectorAll('.chk-unidade').forEach(f => {
        f.disabled = chk.checked;
        f.closest('label').style.opacity = chk.checked ? .45 : 1;
      });
    };
    chk.addEventListener('change', sincronizar);
    sincronizar();
  });
}

async function salvarUsuario() {
  const aviso = document.getElementById('aviso-usuario');
  const nome  = document.getElementById('usu-nome').value.trim();
  const email = document.getElementById('usu-email').value.trim().toLowerCase();
  const papel = document.getElementById('usu-papel').value;
  const ativo = document.getElementById('usu-ativo').checked;
  const novo  = !editandoUsuario;

  if (!nome)  return mostrarAviso(aviso, 'Informe o nome da pessoa.');
  if (!email) return mostrarAviso(aviso, 'Informe o email de acesso.');

  const botao = document.getElementById('salvar-usuario');
  botao.disabled = true;

  try {
    let perfilId;

    if (novo) {
      const senha = document.getElementById('usu-senha').value;
      if (senha.length < 6) throw new Error('A senha provisória precisa de pelo menos 6 caracteres.');

      // Cliente separado, sem guardar sessão: sem isso o signUp
      // trocaria a sua sessão pela do usuário recém-criado e você
      // seria deslogado no meio do cadastro.
      const sbCadastro = window.supabase.createClient(
        CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON,
        { auth: { persistSession: false, autoRefreshToken: false } }
      );

      const { data, error } = await sbCadastro.auth.signUp({
        email, password: senha, options: { data: { nome } }
      });
      if (error) throw new Error(/already registered/i.test(error.message)
        ? 'Já existe uma conta com esse email.' : error.message);

      perfilId = data.user?.id;
      if (!perfilId) throw new Error('A conta foi criada, mas o sistema não recebeu o identificador.');

      const { error: erroPerfil } = await sb.from('perfil')
        .insert({ id: perfilId, nome, email, papel, ativo, criado_por: Sessao.perfil.id });
      if (erroPerfil) throw new Error(erroPerfil.message);

    } else {
      perfilId = editandoUsuario.id;
      const { error } = await sb.from('perfil')
        .update({ nome, papel, ativo }).eq('id', perfilId);
      if (error) throw new Error(error.message);
    }

    await salvarAlcance(perfilId, papel);

    registrarAuditoria('perfil', perfilId, novo ? 'INSERIR' : 'ALTERAR');
    document.getElementById('modal-usuario').hidden = true;
    await carregarUsuarios();

  } catch (e) {
    mostrarAviso(aviso, e.message);
  } finally {
    botao.disabled = false;
  }
}

async function salvarAlcance(perfilId, papel) {
  await sb.from('usuario_municipio').delete().eq('perfil_id', perfilId);
  await sb.from('usuario_unidade').delete().eq('perfil_id', perfilId);

  if (['Administrador','Gestao'].includes(papel)) return;

  const municipios = [...document.querySelectorAll('.chk-municipio:checked')].map(c => c.value);
  const unidades   = [...document.querySelectorAll('.chk-unidade:checked:not(:disabled)')].map(c => c.value);

  if (municipios.length)
    await sb.from('usuario_municipio')
      .insert(municipios.map(id => ({ perfil_id: perfilId, municipio_id: id })));

  if (unidades.length)
    await sb.from('usuario_unidade')
      .insert(unidades.map(id => ({ perfil_id: perfilId, unidade_saude_id: id })));
}

async function excluirUsuario(id) {
  const u = listaUsuarios.find(x => x.id === id);

  if (id === Sessao.perfil.id)
    return alert('Você não pode excluir o próprio acesso.');

  if (!confirm(`Excluir o acesso de ${u.nome}? O histórico de auditoria é preservado, mas sem o nome.`))
    return;

  // A conta em auth.users continua existindo — apagá-la exige a
  // chave service_role, que não pode viver no navegador. Sem perfil,
  // porém, o login não passa da tela de entrada.
  const { error } = await sb.from('perfil').delete().eq('id', id);
  if (error) return alert('Não foi possível excluir: ' + error.message);

  registrarAuditoria('perfil', id, 'EXCLUIR', { nome: u.nome, email: u.email });
  await carregarUsuarios();
}

/* =============================================================
   MATRIZ DE PERMISSÕES
   ============================================================= */

async function carregarMatrizPermissoes() {
  const alvo = document.getElementById('area-matriz');
  alvo.innerHTML = '<div class="vazio">Carregando…</div>';

  const [cat, padroes] = await Promise.all([
    sb.from('permissao_catalogo').select('*').order('ordem'),
    sb.from('permissao_papel').select('*')
  ]);

  padroesPapel = {};
  (padroes.data || []).forEach(p => { (padroesPapel[p.papel] ||= {})[p.chave] = p.permitido; });

  desenharMatriz(alvo, cat.data || [], null);
}

function desenharMatriz(alvo, catalogo, modoUsuario, sobrescritas = {}) {
  if (!catalogo.length) {
    alvo.innerHTML = '<div class="vazio">Nenhuma parametrização registrada ainda.</div>';
    return;
  }

  const colunas = modoUsuario
    ? [{ codigo: modoUsuario.papel, rotulo: 'Permitido' }]
    : Sessao.papeis;

  let html = '<div class="matriz-rolagem"><table class="matriz"><thead><tr><th>Parametrização</th>';
  colunas.forEach(c => html += `<th>${escapar(c.rotulo)}</th>`);
  html += '</tr></thead><tbody>';

  let moduloAtual = null;
  catalogo.forEach(perm => {
    if (perm.modulo !== moduloAtual) {
      moduloAtual = perm.modulo;
      html += `<tr class="grupo"><td colspan="${colunas.length + 1}">${escapar(moduloAtual)}</td></tr>`;
    }

    html += `<tr><td>
      <span class="rotulo-perm">${escapar(perm.rotulo)}</span>
      <span class="chave-perm">${escapar(perm.chave)}</span></td>`;

    colunas.forEach(col => {
      if (modoUsuario) {
        const herdado = padroesPapel[modoUsuario.papel]?.[perm.chave] === true;
        const temSobrescrita = perm.chave in sobrescritas;
        const marcado = temSobrescrita ? sobrescritas[perm.chave] : herdado;
        html += `<td class="${temSobrescrita ? 'sobrescrito' : ''}"
          title="${temSobrescrita ? 'Exceção individual' : 'Herdado do papel'}">
          <input type="checkbox" ${marcado ? 'checked' : ''}
                 onchange="alterarPermissaoUsuario('${perm.chave}', this)"></td>`;
      } else {
        const marcado = padroesPapel[col.codigo]?.[perm.chave] === true;
        const travado = col.codigo === 'Administrador' && perm.chave.startsWith('config.permissoes');
        html += `<td><input type="checkbox" ${marcado ? 'checked' : ''} ${travado ? 'disabled' : ''}
          title="${travado ? 'O Administrador não pode perder o controle de permissões' : ''}"
          onchange="alterarPadraoPapel('${col.codigo}', '${perm.chave}', this)"></td>`;
      }
    });
    html += '</tr>';
  });

  alvo.innerHTML = html + '</tbody></table></div>';
}

async function alterarPadraoPapel(papel, chave, caixa) {
  const valor = caixa.checked;
  const { error } = await sb.from('permissao_papel')
    .update({ permitido: valor }).eq('papel', papel).eq('chave', chave);

  if (error) { caixa.checked = !valor; return alert('Não foi possível alterar: ' + error.message); }

  (padroesPapel[papel] ||= {})[chave] = valor;
  registrarAuditoria('permissao_papel', `${papel}/${chave}`, 'ALTERAR', { permitido: valor });
  if (papel === Sessao.perfil.papel) { await carregarPermissoes(); aplicarPermissoesNaTela(); }
}

async function abrirPermissoesDoUsuario(id) {
  const u = listaUsuarios.find(x => x.id === id);
  if (!u) return;
  usuarioSelecionado = u;

  irParaSubAba('permissoes');
  document.getElementById('titulo-matriz').textContent = 'Permissões de ' + u.nome;
  document.getElementById('legenda-matriz').textContent =
    `Cada item começa herdando o padrão do papel ${u.papel}. Marcar ou desmarcar aqui cria uma exceção só para esta pessoa.`;
  document.getElementById('voltar-padroes').hidden = false;

  const [cat, sobre] = await Promise.all([
    sb.from('permissao_catalogo').select('*').order('ordem'),
    sb.from('permissao_usuario').select('chave, permitido').eq('perfil_id', id)
  ]);

  const mapa = {};
  (sobre.data || []).forEach(s => { mapa[s.chave] = s.permitido; });
  desenharMatriz(document.getElementById('area-matriz'), cat.data || [], u, mapa);
}

async function alterarPermissaoUsuario(chave, caixa) {
  const valor = caixa.checked;
  const herdado = padroesPapel[usuarioSelecionado.papel]?.[chave] === true;
  const celula = caixa.closest('td');

  if (valor === herdado) {
    await sb.from('permissao_usuario').delete()
      .eq('perfil_id', usuarioSelecionado.id).eq('chave', chave);
    celula.classList.remove('sobrescrito');
    celula.title = 'Herdado do papel';
  } else {
    const { error } = await sb.from('permissao_usuario').upsert({
      perfil_id: usuarioSelecionado.id, chave, permitido: valor,
      definido_por: Sessao.perfil.id, definido_em: new Date().toISOString()
    });
    if (error) { caixa.checked = !valor; return alert('Não foi possível alterar: ' + error.message); }
    celula.classList.add('sobrescrito');
    celula.title = 'Exceção individual';
  }

  registrarAuditoria('permissao_usuario', `${usuarioSelecionado.id}/${chave}`, 'ALTERAR', { permitido: valor });
  if (usuarioSelecionado.id === Sessao.perfil.id) { await carregarPermissoes(); aplicarPermissoesNaTela(); }
}

function voltarParaPadroes() {
  document.getElementById('titulo-matriz').textContent = 'Padrão por papel';
  document.getElementById('legenda-matriz').textContent =
    'O que cada papel pode fazer, valendo para todo mundo com aquele papel. As exceções de uma pessoa ficam na lista de Usuários.';
  document.getElementById('voltar-padroes').hidden = true;
  usuarioSelecionado = null;
  carregarMatrizPermissoes();
}

/* =============================================================
   PEDAÇOS DE TELA REUTILIZADOS
   ============================================================= */

function linhaCarregando(colunas) {
  return `<tr><td colspan="${colunas + 1}" class="vazio">Carregando…</td></tr>`;
}

function linhaVazia(colunas, texto) {
  return `<tr><td colspan="${colunas + 1}" class="vazio">${escapar(texto)}</td></tr>`;
}

function celulaComLogo(logo, titulo, subtitulo) {
  return `<div class="celula-logo">
    ${logo ? `<img src="${logo}" alt="">` : '<span class="sem-logo"></span>'}
    <div><strong>${escapar(titulo)}</strong>
    ${subtitulo ? `<br><span class="dado sub-linha">${escapar(subtitulo)}</span>` : ''}</div>
  </div>`;
}

function botoesAcao(entidade, id, comPermissoes) {
  const nome = maiuscula(entidade);
  return `
    <button class="icone" title="Editar" aria-label="Editar"
            data-permissao="config.${entidade}s.editar" onclick="abrir${nome}('${id}')">
      ${ICONES.lapis}</button>
    ${comPermissoes ? `
    <button class="icone" title="Permissões" aria-label="Permissões"
            data-permissao="config.permissoes.editar" onclick="abrirPermissoesDoUsuario('${id}')">
      ${ICONES.engrenagem}</button>` : ''}
    <button class="icone perigo" title="Excluir" aria-label="Excluir"
            data-permissao="config.${entidade}s.excluir" onclick="excluir${nome}('${id}')">
      ${ICONES.lixo}</button>`;
}

function maiuscula(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
