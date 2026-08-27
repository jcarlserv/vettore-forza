/* =============================================================
   Vettore — prestacoes.js — v0.10.0
   Início (cards de município) + tela da Prestação de Contas:
   Bloco 1 (cabeçalho), Bloco 2 (Dados da Organização) e
   Bloco 3 (Financeiro), com upload para o Google Drive
   (Drive Compartilhado do Workspace, via Edge Function).
   ============================================================= */

const NOMES_MES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const StatusRotulo = { Rascunho: 'Rascunho', Em_Revisao: 'Em revisão', Concluido: 'Concluído' };
const StatusClasse = { Rascunho: 'rascunho', Em_Revisao: 'em-revisao', Concluido: 'concluido' };

// Contexto vivo da tela — um município, uma instituição, um mês.
const ContextoPC = {
  municipioId: null,
  municipioNome: '',
  unidadeId: null,
  prestacaoId: null,
  status: null,
  contratoGestaoId: null,
  contratoGestaoNumero: ''
};

let CATALOGO_DOCUMENTOS = null; // cache: carregado uma vez por sessão

/* -------- Início: cards de município -------- */

async function renderInicioMunicipios() {
  const grade = document.getElementById('grade-municipios');
  if (!grade) return;
  grade.innerHTML = '<div class="vazio">Carregando…</div>';

  const [{ data: municipios, error: erroMun }, { data: unidades }] = await Promise.all([
    sb.from('municipio').select('id, nome, uf').eq('ativo', true).order('nome'),
    sb.from('unidade_saude').select('id, municipio_id').eq('ativo', true)
  ]);

  if (erroMun) {
    grade.innerHTML = '<div class="vazio">Não foi possível carregar os municípios.</div>';
    console.error('[Vettore] municípios:', erroMun);
    return;
  }

  if (!municipios || municipios.length === 0) {
    grade.innerHTML = '<div class="vazio">Nenhum município cadastrado ainda.</div>';
    return;
  }

  const contagem = {};
  (unidades || []).forEach(u => { contagem[u.municipio_id] = (contagem[u.municipio_id] || 0) + 1; });

  grade.innerHTML = '';
  municipios.forEach(m => {
    const qtd = contagem[m.id] || 0;
    const cartao = document.createElement('button');
    cartao.type = 'button';
    cartao.className = 'cartao-municipio';
    cartao.dataset.municipioId = m.id;
    cartao.dataset.municipioNome = m.nome;
    cartao.innerHTML = `
      <span class="nome-municipio">${escapar(m.nome)}</span>
      <span class="uf-municipio">${escapar(m.uf || '')}</span>
      <span class="qtd-unidades">${qtd} unidade${qtd === 1 ? '' : 's'}</span>
    `;
    grade.appendChild(cartao);
  });
}

function abrirMunicipioNaPrestacao(municipioId, municipioNome) {
  ContextoPC.municipioId = municipioId;
  ContextoPC.municipioNome = municipioNome;
  ContextoPC.unidadeId = null;
  ContextoPC.prestacaoId = null;
  ContextoPC.status = null;

  document.getElementById('pc-municipio-nome').textContent = municipioNome;
  irParaAba('prestacoes');
  carregarInstituicoesDoMunicipio(municipioId);
  limparCabecalhoPC();
  esconderBlocos();
}

/* -------- Bloco 1: instituição, mês, ano, edital, contrato -------- */

function popularSelectMes() {
  const sel = document.getElementById('pc-mes');
  sel.innerHTML = NOMES_MES.map((n, i) =>
    `<option value="${i + 1}">${String(i + 1).padStart(2, '0')} — ${n}</option>`).join('');
}

async function carregarInstituicoesDoMunicipio(municipioId) {
  const sel = document.getElementById('pc-instituicao');
  sel.innerHTML = '<option value="">Carregando…</option>';

  const { data, error } = await sb.from('unidade_saude')
    .select('id, nome, tipo')
    .eq('municipio_id', municipioId)
    .eq('ativo', true)
    .order('nome');

  if (error) {
    sel.innerHTML = '<option value="">Falha ao carregar</option>';
    console.error('[Vettore] instituições:', error);
    return;
  }

  sel.innerHTML = '<option value="">Selecione…</option>' +
    data.map(u => `<option value="${u.id}">${escapar(u.nome)} (${escapar(u.tipo)})</option>`).join('');
}

function limparCabecalhoPC() {
  document.getElementById('pc-edital').value = '';
  document.getElementById('pc-contrato').value = '';
  const mes = new Date().getMonth() + 1, ano = new Date().getFullYear();
  document.getElementById('pc-mes').value = String(mes);
  document.getElementById('pc-ano').value = String(ano);
  limparAviso(document.getElementById('pc-aviso'));
  const statusEl = document.getElementById('pc-status');
  statusEl.hidden = true;
}

function esconderBlocos() {
  document.getElementById('pc-blocos').hidden = true;
}

async function tratarMudancaInstituicao() {
  ContextoPC.unidadeId = document.getElementById('pc-instituicao').value || null;
  ContextoPC.contratoGestaoId = null;
  ContextoPC.contratoGestaoNumero = '';

  if (ContextoPC.unidadeId) {
    const { data } = await sb.from('contrato_gestao')
      .select('id, numero_contrato')
      .eq('unidade_saude_id', ContextoPC.unidadeId)
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      ContextoPC.contratoGestaoId = data.id;
      ContextoPC.contratoGestaoNumero = data.numero_contrato || '';
    }
  }
  await tentarLocalizarPrestacao();
}

async function tentarLocalizarPrestacao() {
  esconderBlocos();
  const aviso = document.getElementById('pc-aviso');
  limparAviso(aviso);
  const statusEl = document.getElementById('pc-status');
  statusEl.hidden = true;

  const mes = Number(document.getElementById('pc-mes').value);
  const ano = Number(document.getElementById('pc-ano').value);
  const editalCampo = document.getElementById('pc-edital');
  const contratoCampo = document.getElementById('pc-contrato');

  if (!ContextoPC.unidadeId || !mes || !ano) {
    ContextoPC.prestacaoId = null;
    return;
  }

  const { data, error } = await sb.from('prestacao_contas')
    .select('*')
    .eq('unidade_saude_id', ContextoPC.unidadeId)
    .eq('mes', mes).eq('ano', ano)
    .maybeSingle();

  if (error) {
    mostrarAviso(aviso, 'Não foi possível consultar esta prestação.');
    console.error('[Vettore] prestacao_contas:', error);
    return;
  }

  if (data) {
    ContextoPC.prestacaoId = data.id;
    ContextoPC.status = data.status;
    editalCampo.value = data.edital || '';
    contratoCampo.value = data.contrato || '';
    statusEl.hidden = false;
    statusEl.textContent = StatusRotulo[data.status] || data.status;
    statusEl.className = 'tag ' + (StatusClasse[data.status] || '');
    document.getElementById('pc-blocos').hidden = false;
    await carregarDocumentos();
  } else {
    ContextoPC.prestacaoId = null;
    ContextoPC.status = null;
    editalCampo.value = '';
    if (!contratoCampo.value) contratoCampo.value = ContextoPC.contratoGestaoNumero;
    if (pode('prestacao.criar')) {
      mostrarAviso(aviso, 'Prestação ainda não aberta para este mês. Preencha e clique em Salvar.', 'ok');
    } else {
      mostrarAviso(aviso, 'A prestação deste mês ainda não foi aberta pelo Gestor.');
    }
  }
}

async function salvarCabecalhoPC() {
  const aviso = document.getElementById('pc-aviso');
  const botao = document.getElementById('pc-salvar-cabecalho');
  limparAviso(aviso);

  const mes = Number(document.getElementById('pc-mes').value);
  const ano = Number(document.getElementById('pc-ano').value);

  if (!ContextoPC.unidadeId) return mostrarAviso(aviso, 'Escolha a instituição.');
  if (!mes || !ano) return mostrarAviso(aviso, 'Informe mês e ano.');

  botao.disabled = true;
  botao.textContent = 'Salvando…';

  const payload = {
    unidade_saude_id: ContextoPC.unidadeId,
    contrato_gestao_id: ContextoPC.contratoGestaoId,
    mes, ano,
    edital: document.getElementById('pc-edital').value.trim() || null,
    contrato: document.getElementById('pc-contrato').value.trim() || null
  };
  if (!ContextoPC.prestacaoId) payload.criado_por = Sessao.perfil.id;

  const { data, error } = await sb.from('prestacao_contas')
    .upsert(payload, { onConflict: 'unidade_saude_id,mes,ano' })
    .select().single();

  botao.disabled = false;
  botao.textContent = 'Salvar';

  if (error) {
    mostrarAviso(aviso, 'Não foi possível salvar. Confira as permissões.');
    console.error('[Vettore] salvar prestacao_contas:', error);
    return;
  }

  const eraNova = !ContextoPC.prestacaoId;
  ContextoPC.prestacaoId = data.id;
  ContextoPC.status = data.status;
  registrarAuditoria('prestacao_contas', data.id, eraNova ? 'INSERIR' : 'ALTERAR');

  const statusEl = document.getElementById('pc-status');
  statusEl.hidden = false;
  statusEl.textContent = StatusRotulo[data.status] || data.status;
  statusEl.className = 'tag ' + (StatusClasse[data.status] || '');
  mostrarAviso(aviso, 'Prestação salva.', 'ok');

  document.getElementById('pc-blocos').hidden = false;
  await carregarDocumentos();
}

/* -------- Blocos 2 e 3: documentos -------- */

async function garantirCatalogoDocumentos() {
  if (CATALOGO_DOCUMENTOS) return CATALOGO_DOCUMENTOS;
  const { data, error } = await sb.from('documento_catalogo').select('*').order('ordem');
  if (error) { console.error('[Vettore] documento_catalogo:', error); return []; }
  CATALOGO_DOCUMENTOS = data;
  return data;
}

async function carregarDocumentos() {
  if (!ContextoPC.prestacaoId) return;
  const catalogo = await garantirCatalogoDocumentos();

  const { data: arquivos, error } = await sb.from('prestacao_documento')
    .select('*')
    .eq('prestacao_id', ContextoPC.prestacaoId)
    .order('enviado_em');

  if (error) { console.error('[Vettore] prestacao_documento:', error); return; }

  // Arquivos enviados na fase Supabase Storage (arquivo_url vazia, caminho com "/")
  // ainda precisam de link assinado. Os do Google Drive já vêm com arquivo_url pronta.
  const semUrl = (arquivos || []).filter(a => !a.arquivo_url && a.arquivo_drive_id?.includes('/'));
  if (semUrl.length) {
    const assinadas = await Promise.all(semUrl.map(a =>
      sb.storage.from('prestacao-documentos').createSignedUrl(a.arquivo_drive_id, 3600)
    ));
    semUrl.forEach((a, i) => { a._urlAssinada = assinadas[i]?.data?.signedUrl || null; });
  }

  const porChave = {};
  (arquivos || []).forEach(a => { (porChave[a.chave] = porChave[a.chave] || []).push(a); });

  renderBlocoDocumentos('organizacao', 'pc-doc-organizacao', catalogo, porChave);
  renderBlocoDocumentos('financeiro', 'pc-doc-financeiro', catalogo, porChave);
}

function renderBlocoDocumentos(nomeBloco, idContainer, catalogo, porChave) {
  const container = document.getElementById(idContainer);
  const itens = catalogo.filter(c => c.bloco === nomeBloco);
  const podeEnviar = pode('prestacao.enviar_arquivo');
  const podeExcluir = pode('prestacao.excluir_arquivo');

  container.innerHTML = itens.map(item => {
    const arquivos = porChave[item.chave] || [];
    const mostrarBotaoEnviar = podeEnviar && (item.multiplo || arquivos.length === 0);

    const chips = arquivos.map(a => {
      const link = a.arquivo_url || a._urlAssinada;
      return `
      <span class="chip-arquivo">
        ${link ? `<a href="${escapar(link)}" target="_blank" rel="noopener">${escapar(a.nome_arquivo)}</a>`
               : `<span>${escapar(a.nome_arquivo)}</span>`}
        ${podeExcluir ? `<button type="button" class="excluir-arquivo" data-excluir-id="${a.id}" data-excluir-caminho="${escapar(a.arquivo_drive_id || '')}" title="Excluir">✕</button>` : ''}
      </span>`;
    }).join('') || '<span class="sub-linha">Nenhum arquivo enviado.</span>';

    return `
      <div class="linha-documento" data-chave="${item.chave}">
        <span class="rotulo-documento">${escapar(item.rotulo)}</span>
        <span class="arquivos-documento">${chips}</span>
        <span class="acoes-documento">
          ${mostrarBotaoEnviar ? `
            <label class="botao neutro pequeno">
              Enviar
              <input type="file" data-enviar-chave="${item.chave}" data-enviar-bloco="${nomeBloco}" hidden>
            </label>` : ''}
        </span>
      </div>`;
  }).join('') || '<div class="vazio">Nada registrado neste bloco.</div>';
}

async function enviarDocumento(inputEl) {
  const arquivo = inputEl.files[0];
  if (!arquivo) return;
  const chave = inputEl.dataset.enviarChave;
  const bloco = inputEl.dataset.enviarBloco;
  const label = inputEl.closest('label');
  const textoOriginal = label.firstChild.textContent;
  label.firstChild.textContent = 'Enviando…';
  inputEl.disabled = true;

  try {
    const { data: { session } } = await sb.auth.getSession();
    const forma = new FormData();
    forma.append('file', arquivo);
    forma.append('prestacao_id', ContextoPC.prestacaoId);
    forma.append('chave', chave);
    forma.append('municipio', ContextoPC.municipioNome);
    forma.append('ano', String(document.getElementById('pc-ano').value));
    forma.append('mes', String(document.getElementById('pc-mes').value));
    forma.append('bloco', bloco);

    const r = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/upload-drive`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + session.access_token },
      body: forma
    });
    const json = await r.json();
    if (!r.ok || json.erro) throw new Error(json.erro || 'Falha no upload.');

    registrarAuditoria('prestacao_documento', json.registro.id, 'INSERIR', { chave });
    await carregarDocumentos();
  } catch (e) {
    alert('Não foi possível enviar: ' + e.message);
    console.error('[Vettore] upload-drive:', e);
  } finally {
    label.firstChild.textContent = textoOriginal;
    inputEl.disabled = false;
  }
}

async function excluirDocumento(id, caminho) {
  // Caminho com "/" = era Supabase Storage, apaga o arquivo de verdade.
  // Sem "/" = era Google Drive (fileId), o arquivo fica lá como segurança.
  const eraStorage = caminho && caminho.includes('/');
  if (!confirm(eraStorage
    ? 'Excluir este arquivo?'
    : 'Excluir este arquivo da lista? O arquivo continua guardado no Drive.')) return;

  if (eraStorage) {
    const { error: erroStorage } = await sb.storage.from('prestacao-documentos').remove([caminho]);
    if (erroStorage) console.error('[Vettore] remover do storage:', erroStorage);
  }

  const { error } = await sb.from('prestacao_documento').delete().eq('id', id);
  if (error) {
    alert('Não foi possível excluir. Confira as permissões.');
    console.error('[Vettore] excluir prestacao_documento:', error);
    return;
  }
  registrarAuditoria('prestacao_documento', id, 'EXCLUIR');
  await carregarDocumentos();
}

/* -------- Ligações -------- */

document.addEventListener('DOMContentLoaded', () => {
  popularSelectMes();

  document.getElementById('grade-municipios')?.addEventListener('click', e => {
    const cartao = e.target.closest('.cartao-municipio');
    if (!cartao) return;
    abrirMunicipioNaPrestacao(cartao.dataset.municipioId, cartao.dataset.municipioNome);
  });

  document.getElementById('pc-voltar')?.addEventListener('click', () => irParaAba('inicio'));
  document.getElementById('pc-instituicao')?.addEventListener('change', tratarMudancaInstituicao);
  document.getElementById('pc-mes')?.addEventListener('change', tentarLocalizarPrestacao);
  document.getElementById('pc-ano')?.addEventListener('change', tentarLocalizarPrestacao);
  document.getElementById('pc-salvar-cabecalho')?.addEventListener('click', salvarCabecalhoPC);

  document.getElementById('pc-blocos')?.addEventListener('change', e => {
    if (e.target.matches('[data-enviar-chave]')) enviarDocumento(e.target);
  });
  document.getElementById('pc-blocos')?.addEventListener('click', e => {
    const botaoExcluir = e.target.closest('[data-excluir-id]');
    if (botaoExcluir) return excluirDocumento(botaoExcluir.dataset.excluirId, botaoExcluir.dataset.excluirCaminho);
    const botaoBaixar = e.target.closest('[data-baixar-bloco]');
    if (botaoBaixar) baixarBloco(botaoBaixar.dataset.baixarBloco, botaoBaixar.closest('.painel').querySelector('h3').textContent.replace(/^\d+\s*·\s*/, ''));
  });
});
