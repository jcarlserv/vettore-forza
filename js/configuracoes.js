/* =============================================================
   configuracoes.js — v0.1.0
   Aba Configurações: Organização, Identidade Visual, Usuários,
   Permissões.

   A matriz de permissões não tem nenhuma permissão escrita no
   código. Ela é montada a partir de permissao_catalogo. Uma
   parametrização nova aparece aqui sozinha assim que for
   registrada no banco com registrar_permissao().
   ============================================================= */

let subAbaAtual = 'organizacao';
let listaUsuarios = [];
let padroesPapel = {};       // { papel: { chave: bool } }
let usuarioSelecionado = null;

function irParaSubAba(nome) {
  subAbaAtual = nome;
  document.querySelectorAll('.sub-aba').forEach(b =>
    b.setAttribute('aria-selected', b.dataset.sub === nome));
  document.querySelectorAll('.painel-config').forEach(p =>
    p.hidden = p.dataset.sub !== nome);

  if (nome === 'organizacao') carregarOrganizacao();
  if (nome === 'visual')      carregarFormularioVisual();
  if (nome === 'usuarios')    carregarUsuarios();
  if (nome === 'permissoes')  carregarMatrizPermissoes();
}

/* ============ Organização ============ */

async function carregarOrganizacao() {
  const { data } = await sb.from('organizacao').select('*').maybeSingle();
  if (!data) return;
  Sessao.organizacao = data;
  document.getElementById('org-razao').value    = data.razao_social || '';
  document.getElementById('org-cnpj').value     = data.cnpj || '';
  document.getElementById('org-email').value    = data.email_suporte || '';
  document.getElementById('org-telefone').value = data.telefone || '';
}

async function salvarOrganizacao(evento) {
  evento.preventDefault();
  const aviso = document.getElementById('aviso-org');
  const { error } = await sb.from('organizacao').update({
    razao_social:  document.getElementById('org-razao').value.trim(),
    cnpj:          document.getElementById('org-cnpj').value.trim(),
    email_suporte: document.getElementById('org-email').value.trim(),
    telefone:      document.getElementById('org-telefone').value.trim(),
    atualizado_em: new Date().toISOString(),
    atualizado_por: Sessao.perfil.id
  }).eq('id', Sessao.organizacao.id);

  if (error) return mostrarAviso(aviso, 'Não foi possível salvar: ' + error.message);
  mostrarAviso(aviso, 'Dados da organização salvos.', 'ok');
  registrarAuditoria('organizacao', Sessao.organizacao.id, 'ALTERAR');
  document.getElementById('nome-osc').textContent =
    document.getElementById('org-razao').value.trim();
}

/* ============ Identidade visual ============ */

async function carregarIdentidadeVisual() {
  const { data } = await sb.from('organizacao').select('*').maybeSingle();
  if (!data) return;
  Sessao.organizacao = data;
  aplicarIdentidade(data.cor_marca, data.logo_data_url, data.razao_social);
}

// Vettore é o nome do produto e não muda. A logo e a cor configuradas
// aqui são da OSC que usa o sistema — entram como identidade do cliente,
// ao lado da marca, não no lugar dela.
function aplicarIdentidade(cor, logo, nome) {
  if (cor) document.documentElement.style.setProperty('--marca', cor);
  const img = document.getElementById('logo-topo');
  if (logo) { img.src = logo; img.hidden = false; } else { img.hidden = true; }
  if (nome) document.getElementById('nome-osc').textContent = nome;
}

function carregarFormularioVisual() {
  const paleta = document.getElementById('paleta-cores');
  const corAtual = Sessao.organizacao?.cor_marca || '#1B6B55';

  paleta.innerHTML = CORES_SUGERIDAS.map(c => `
    <button type="button" class="amostra-cor" data-cor="${c.valor}"
            style="background:${c.valor}" title="${c.nome}"
            aria-label="Cor ${c.nome}"
            aria-pressed="${c.valor.toLowerCase() === corAtual.toLowerCase()}"></button>
  `).join('');

  paleta.querySelectorAll('.amostra-cor').forEach(b => {
    b.onclick = () => escolherCor(b.dataset.cor);
  });

  document.getElementById('cor-livre').value = corAtual;
  const previa = document.getElementById('previa-logo');
  if (Sessao.organizacao?.logo_data_url) {
    previa.src = Sessao.organizacao.logo_data_url;
    previa.hidden = false;
  } else {
    previa.hidden = true;
  }
}

function escolherCor(cor) {
  document.documentElement.style.setProperty('--marca', cor);
  document.getElementById('cor-livre').value = cor;
  document.querySelectorAll('.amostra-cor').forEach(b =>
    b.setAttribute('aria-pressed', b.dataset.cor.toLowerCase() === cor.toLowerCase()));
}

// Lê a logo e sugere a cor mais presente nela, ignorando pixels
// quase brancos, quase pretos e transparentes — que são fundo,
// não identidade.
function tratarArquivoLogo(evento) {
  const arquivo = evento.target.files[0];
  const aviso = document.getElementById('aviso-visual');
  if (!arquivo) return;

  if (arquivo.size > 300 * 1024) {
    return mostrarAviso(aviso, 'A logo precisa ter até 300 KB. Reduza o arquivo e envie de novo.');
  }
  limparAviso(aviso);

  const leitor = new FileReader();
  leitor.onload = e => {
    const dataUrl = e.target.result;
    const previa = document.getElementById('previa-logo');
    previa.src = dataUrl;
    previa.hidden = false;
    previa.dataset.novaLogo = dataUrl;
    sugerirCorDaLogo(dataUrl);
  };
  leitor.readAsDataURL(arquivo);
}

function sugerirCorDaLogo(dataUrl) {
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    const lado = 60;
    c.width = lado; c.height = lado;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, lado, lado);

    const px = ctx.getImageData(0, 0, lado, lado).data;
    const contagem = {};

    for (let i = 0; i < px.length; i += 4) {
      const [r, g, b, a] = [px[i], px[i+1], px[i+2], px[i+3]];
      if (a < 200) continue;
      const soma = r + g + b;
      if (soma > 690 || soma < 60) continue;         // fundo claro/escuro
      const chave = `${r >> 4},${g >> 4},${b >> 4}`; // agrupa tons vizinhos
      contagem[chave] = (contagem[chave] || 0) + 1;
    }

    const dominante = Object.entries(contagem).sort((a, b) => b[1] - a[1])[0];
    if (!dominante) return;

    const [r, g, b] = dominante[0].split(',').map(n => (parseInt(n) << 4) + 8);
    const hex = '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('');
    escolherCor(hex);
    mostrarAviso(document.getElementById('aviso-visual'),
      'Cor sugerida a partir da logo. Troque se não for a certa.', 'ok');
  };
  img.src = dataUrl;
}

async function salvarIdentidadeVisual() {
  const aviso = document.getElementById('aviso-visual');
  const previa = document.getElementById('previa-logo');
  const atualizacao = {
    cor_marca: document.getElementById('cor-livre').value,
    atualizado_em: new Date().toISOString(),
    atualizado_por: Sessao.perfil.id
  };
  if (previa.dataset.novaLogo) atualizacao.logo_data_url = previa.dataset.novaLogo;

  const { error } = await sb.from('organizacao').update(atualizacao)
    .eq('id', Sessao.organizacao.id);

  if (error) return mostrarAviso(aviso, 'Não foi possível salvar: ' + error.message);
  mostrarAviso(aviso, 'Identidade visual salva.', 'ok');
  registrarAuditoria('organizacao', Sessao.organizacao.id, 'ALTERAR', { visual: true });
  await carregarIdentidadeVisual();
}

async function removerLogo() {
  await sb.from('organizacao').update({ logo_data_url: null })
    .eq('id', Sessao.organizacao.id);
  document.getElementById('previa-logo').hidden = true;
  delete document.getElementById('previa-logo').dataset.novaLogo;
  await carregarIdentidadeVisual();
}

/* ============ Usuários ============ */

async function carregarUsuarios() {
  const corpo = document.getElementById('corpo-usuarios');
  corpo.innerHTML = '<tr><td colspan="5" class="vazio">Carregando…</td></tr>';

  listaUsuarios = await buscarTudo('perfil', '*', q => q.order('nome'));

  if (!listaUsuarios.length) {
    corpo.innerHTML = '<tr><td colspan="5" class="vazio">Nenhum usuário cadastrado ainda.</td></tr>';
    return;
  }

  const rotulos = Object.fromEntries(Sessao.papeis.map(p => [p.codigo, p.rotulo]));

  corpo.innerHTML = listaUsuarios.map(u => `
    <tr>
      <td>
        <strong>${escapar(u.nome)}</strong><br>
        <span class="dado" style="font-size:12px;color:var(--tinta-40)">${escapar(u.email)}</span>
      </td>
      <td>${escapar(rotulos[u.papel] || u.papel)}</td>
      <td><span class="tag ${u.ativo ? 'ativo' : 'inativo'}">${u.ativo ? 'Ativo' : 'Inativo'}</span></td>
      <td class="dado" style="font-size:12px">
        ${u.ultimo_acesso ? new Date(u.ultimo_acesso).toLocaleDateString('pt-BR') : '—'}
      </td>
      <td style="text-align:right">
        <button class="botao neutro" data-permissao="config.usuarios.editar"
                onclick="abrirEdicaoUsuario('${u.id}')">Editar</button>
        <button class="botao neutro" data-permissao="config.permissoes.editar"
                onclick="abrirPermissoesDoUsuario('${u.id}')">Permissões</button>
      </td>
    </tr>
  `).join('');

  aplicarPermissoesNaTela(corpo);
}

function abrirEdicaoUsuario(id) {
  const u = listaUsuarios.find(x => x.id === id);
  if (!u) return;
  usuarioSelecionado = u;

  document.getElementById('edit-nome').value = u.nome;
  document.getElementById('edit-email').value = u.email;
  document.getElementById('edit-ativo').checked = u.ativo;

  const sel = document.getElementById('edit-papel');
  sel.innerHTML = Sessao.papeis.map(p =>
    `<option value="${p.codigo}" ${p.codigo === u.papel ? 'selected' : ''}>${escapar(p.rotulo)}</option>`
  ).join('');

  document.getElementById('modal-usuario').hidden = false;
}

async function salvarUsuario() {
  const { error } = await sb.from('perfil').update({
    nome:  document.getElementById('edit-nome').value.trim(),
    papel: document.getElementById('edit-papel').value,
    ativo: document.getElementById('edit-ativo').checked
  }).eq('id', usuarioSelecionado.id);

  if (error) return alert('Não foi possível salvar: ' + error.message);
  registrarAuditoria('perfil', usuarioSelecionado.id, 'ALTERAR');
  document.getElementById('modal-usuario').hidden = true;
  carregarUsuarios();
}

/* ============ Matriz de permissões ============ */

async function carregarMatrizPermissoes() {
  const alvo = document.getElementById('area-matriz');
  alvo.innerHTML = '<div class="vazio">Carregando…</div>';

  const [cat, padroes] = await Promise.all([
    sb.from('permissao_catalogo').select('*').order('ordem'),
    sb.from('permissao_papel').select('*')
  ]);

  padroesPapel = {};
  (padroes.data || []).forEach(p => {
    (padroesPapel[p.papel] ||= {})[p.chave] = p.permitido;
  });

  desenharMatriz(alvo, cat.data || [], null);
}

// modoUsuario null = editando o padrão dos papéis.
// modoUsuario = perfil → editando as exceções de uma pessoa.
function desenharMatriz(alvo, catalogo, modoUsuario, sobrescritas = {}) {
  if (!catalogo.length) {
    alvo.innerHTML = '<div class="vazio">Nenhuma parametrização registrada ainda.</div>';
    return;
  }

  const colunas = modoUsuario
    ? [{ codigo: modoUsuario.papel, rotulo: 'Permitido' }]
    : Sessao.papeis;

  let html = '<div class="matriz-rolagem"><table class="matriz"><thead><tr>';
  html += '<th>Parametrização</th>';
  colunas.forEach(c => html += `<th>${escapar(c.rotulo)}</th>`);
  html += '</tr></thead><tbody>';

  let moduloAtual = null;
  catalogo.forEach(perm => {
    if (perm.modulo !== moduloAtual) {
      moduloAtual = perm.modulo;
      html += `<tr class="grupo"><td colspan="${colunas.length + 1}">${escapar(moduloAtual)}</td></tr>`;
    }

    html += '<tr>';
    html += `<td>
      <span class="rotulo-perm">${escapar(perm.rotulo)}</span>
      <span class="chave-perm">${escapar(perm.chave)}</span>
    </td>`;

    colunas.forEach(col => {
      if (modoUsuario) {
        const herdado = padroesPapel[modoUsuario.papel]?.[perm.chave] === true;
        const temSobrescrita = perm.chave in sobrescritas;
        const marcado = temSobrescrita ? sobrescritas[perm.chave] : herdado;
        html += `<td class="${temSobrescrita ? 'sobrescrito' : ''}"
                     title="${temSobrescrita ? 'Exceção individual' : 'Herdado do papel'}">
          <input type="checkbox" ${marcado ? 'checked' : ''}
                 onchange="alterarPermissaoUsuario('${perm.chave}', this)">
        </td>`;
      } else {
        const marcado = padroesPapel[col.codigo]?.[perm.chave] === true;
        const bloqueado = col.codigo === 'Administrador' && perm.chave.startsWith('config.permissoes');
        html += `<td>
          <input type="checkbox" ${marcado ? 'checked' : ''} ${bloqueado ? 'disabled' : ''}
                 title="${bloqueado ? 'O Administrador não pode perder o controle de permissões' : ''}"
                 onchange="alterarPadraoPapel('${col.codigo}', '${perm.chave}', this)">
        </td>`;
      }
    });
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  alvo.innerHTML = html;
}

async function alterarPadraoPapel(papel, chave, caixa) {
  const valor = caixa.checked;
  const { error } = await sb.from('permissao_papel')
    .update({ permitido: valor })
    .eq('papel', papel).eq('chave', chave);

  if (error) {
    caixa.checked = !valor;
    return alert('Não foi possível alterar: ' + error.message);
  }
  (padroesPapel[papel] ||= {})[chave] = valor;
  registrarAuditoria('permissao_papel', `${papel}/${chave}`, 'ALTERAR', { permitido: valor });
  if (papel === Sessao.perfil.papel) await carregarPermissoes();
}

async function abrirPermissoesDoUsuario(id) {
  const u = listaUsuarios.find(x => x.id === id);
  if (!u) return;
  usuarioSelecionado = u;

  irParaSubAba('permissoes');
  document.getElementById('titulo-matriz').textContent = 'Permissões de ' + u.nome;
  document.getElementById('legenda-matriz').textContent =
    'Cada item começa herdando o padrão do papel ' + u.papel +
    '. Marcar ou desmarcar aqui cria uma exceção só para esta pessoa.';
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

  // Voltou a coincidir com o papel: some a exceção em vez de gravar
  // uma linha que só repete o padrão.
  if (valor === herdado) {
    await sb.from('permissao_usuario').delete()
      .eq('perfil_id', usuarioSelecionado.id).eq('chave', chave);
    celula.classList.remove('sobrescrito');
    celula.title = 'Herdado do papel';
  } else {
    const { error } = await sb.from('permissao_usuario').upsert({
      perfil_id: usuarioSelecionado.id,
      chave,
      permitido: valor,
      definido_por: Sessao.perfil.id,
      definido_em: new Date().toISOString()
    });
    if (error) {
      caixa.checked = !valor;
      return alert('Não foi possível alterar: ' + error.message);
    }
    celula.classList.add('sobrescrito');
    celula.title = 'Exceção individual';
  }

  registrarAuditoria('permissao_usuario', `${usuarioSelecionado.id}/${chave}`, 'ALTERAR',
    { permitido: valor });
  if (usuarioSelecionado.id === Sessao.perfil.id) await carregarPermissoes();
}

function voltarParaPadroes() {
  document.getElementById('titulo-matriz').textContent = 'Padrão por papel';
  document.getElementById('legenda-matriz').textContent =
    'O que cada papel pode fazer, valendo para todo mundo com aquele papel. As exceções de uma pessoa ficam na lista de Usuários.';
  document.getElementById('voltar-padroes').hidden = true;
  usuarioSelecionado = null;
  carregarMatrizPermissoes();
}
