/* =============================================================
   autenticacao.js — v0.1.0
   Login por email/senha via Supabase Auth, carga do perfil e saída.
   ============================================================= */

async function iniciarSessao() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return abrirTelaLogin();
  await entrarComSessao(session.user);
}

function abrirTelaLogin() {
  document.getElementById('tela-login').hidden = false;
  document.getElementById('tela-app').hidden = true;
}

async function entrarComSessao(usuario) {
  Sessao.usuario = usuario;

  const { data: perfil, error } = await sb
    .from('perfil')
    .select('*, papel_info:papel(rotulo)')
    .eq('id', usuario.id)
    .maybeSingle();

  if (error || !perfil) {
    await sb.auth.signOut();
    abrirTelaLogin();
    mostrarAviso(
      document.getElementById('aviso-login'),
      'Este acesso ainda não tem perfil no sistema. Peça a um administrador para liberar.'
    );
    return;
  }

  if (!perfil.ativo) {
    await sb.auth.signOut();
    abrirTelaLogin();
    mostrarAviso(document.getElementById('aviso-login'), 'Este acesso está inativo.');
    return;
  }

  Sessao.perfil = perfil;
  await carregarPermissoes();

  sb.from('perfil').update({ ultimo_acesso: new Date().toISOString() })
    .eq('id', perfil.id).then(() => {});
  registrarAuditoria('perfil', perfil.id, 'LOGIN');

  document.getElementById('tela-login').hidden = true;
  document.getElementById('tela-app').hidden = false;

  document.getElementById('nome-usuario').textContent = perfil.nome;
  document.getElementById('papel-usuario').textContent = perfil.papel_info?.rotulo || perfil.papel;

  await carregarIdentidadeVisual();
  aplicarPermissoesNaTela();
  irParaAba('inicio');
}

async function tratarLogin(evento) {
  evento.preventDefault();
  const aviso = document.getElementById('aviso-login');
  const botao = document.getElementById('botao-entrar');
  limparAviso(aviso);
  botao.disabled = true;
  botao.textContent = 'Entrando…';

  const { data, error } = await sb.auth.signInWithPassword({
    email: document.getElementById('login-email').value.trim(),
    password: document.getElementById('login-senha').value
  });

  botao.disabled = false;
  botao.textContent = 'Entrar';

  if (error) {
    mostrarAviso(aviso, explicarErroLogin(error));
    console.error('[Vettore] Falha no login:', error);
    return;
  }
  await entrarComSessao(data.user);
}

// Cada causa tem um caminho de solução diferente. Uma mensagem única
// para tudo economiza código e custa uma tarde de tentativa e erro.
function explicarErroLogin(error) {
  const msg = (error.message || '').toLowerCase();

  if (msg.includes('invalid login') || msg.includes('invalid credentials'))
    return 'Email ou senha não conferem. Confira e tente de novo.';

  if (msg.includes('email not confirmed'))
    return 'Esta conta ainda não foi confirmada. Um administrador precisa confirmá-la no painel de autenticação.';

  if (msg.includes('failed to fetch') || msg.includes('networkerror'))
    return 'Sem resposta do servidor. Verifique a conexão e o endereço configurado em config.js.';

  if (msg.includes('invalid api key') || msg.includes('no api key') || error.status === 401)
    return 'A chave de acesso do sistema não foi aceita. Confira a chave publishable em config.js.';

  if (msg.includes('too many') || error.status === 429)
    return 'Muitas tentativas seguidas. Espere alguns minutos antes de tentar de novo.';

  return 'Não foi possível entrar: ' + (error.message || 'erro desconhecido') +
         '. Detalhes no console do navegador.';
}

async function sair() {
  await sb.auth.signOut();
  Sessao.usuario = null;
  Sessao.perfil = null;
  Sessao.permissoes = {};
  location.reload();
}

async function recuperarSenha() {
  const email = document.getElementById('login-email').value.trim();
  const aviso = document.getElementById('aviso-login');
  if (!email) {
    mostrarAviso(aviso, 'Escreva seu email no campo acima para receber o link.');
    return;
  }
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.href });
  if (error) mostrarAviso(aviso, 'Não foi possível enviar o link agora. Tente em alguns minutos.');
  else mostrarAviso(aviso, 'Link enviado. Verifique a caixa de entrada de ' + email + '.', 'ok');
}
