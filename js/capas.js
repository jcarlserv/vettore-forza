/* =============================================================
   Vettore — capas.js — v0.11.0
   Junta capa da prestação + capa do bloco + todos os arquivos
   do bloco (na ordem do catálogo) num único PDF pra baixar.
   Usa pdf-lib (carregado via CDN no index.html).
   Só junta PDF, PNG e JPG — outros formatos ficam de fora e
   são avisados no fim.
   ============================================================= */

const MESES_EXTENSO = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
];
const A4 = [595.28, 841.89];

async function baixarBloco(nomeBloco, rotuloBloco) {
  const botao = document.querySelector(`[data-baixar-bloco="${nomeBloco}"]`);
  const textoOriginal = botao.textContent;
  botao.disabled = true;
  botao.textContent = 'Preparando…';

  try {
    if (!ContextoPC.prestacaoId) throw new Error('Salve a prestação antes de baixar.');

    const { PDFDocument, StandardFonts } = PDFLib;
    const pdfFinal = await PDFDocument.create();
    const ctx = await montarContexto(pdfFinal);

    await desenharCapaPrestacao(pdfFinal, ctx);
    const ignorados = await montarConteudoBloco(pdfFinal, ctx, nomeBloco, rotuloBloco);

    const bytes = await pdfFinal.save();
    const nomeArquivo = `${rotuloBloco}_${ctx.municipio.nome}_${ctx.ano}-${String(ctx.mes).padStart(2, '0')}.pdf`
      .replace(/\s+/g, '_');
    baixarBytesComoArquivo(bytes, nomeArquivo);

    if (ignorados.length) {
      alert('Baixado. Alguns arquivos não puderam ser incluídos (formato não suportado): ' + ignorados.join(', '));
    }
  } catch (e) {
    alert('Não foi possível gerar o PDF: ' + e.message);
    console.error('[Vettore] baixarBloco:', e);
  } finally {
    botao.disabled = false;
    botao.textContent = textoOriginal;
  }
}

async function baixarTudo() {
  const botao = document.getElementById('pc-baixar-tudo');
  const textoOriginal = botao.textContent;
  botao.disabled = true;
  botao.textContent = 'Preparando…';

  try {
    if (!ContextoPC.prestacaoId) throw new Error('Salve a prestação antes de baixar.');

    const { PDFDocument } = PDFLib;
    const pdfFinal = await PDFDocument.create();
    const ctx = await montarContexto(pdfFinal);
    await desenharCapaPrestacao(pdfFinal, ctx);

    const catalogo = await garantirCatalogoDocumentos();
    const blocos = [...new Set(catalogo.map(c => c.bloco))];

    let ignorados = [];
    for (const bloco of blocos) {
      const dosIgnorados = await montarConteudoBloco(pdfFinal, ctx, bloco, ROTULO_BLOCO[bloco] || bloco);
      ignorados = ignorados.concat(dosIgnorados);
    }

    const bytes = await pdfFinal.save();
    const nomeArquivo = `PrestacaoDeContas_${ctx.municipio.nome}_${ctx.ano}-${String(ctx.mes).padStart(2, '0')}.pdf`
      .replace(/\s+/g, '_');
    baixarBytesComoArquivo(bytes, nomeArquivo);

    if (ignorados.length) {
      alert('Baixado. Alguns arquivos não puderam ser incluídos (formato não suportado): ' + ignorados.join(', '));
    }
  } catch (e) {
    alert('Não foi possível gerar o PDF: ' + e.message);
    console.error('[Vettore] baixarTudo:', e);
  } finally {
    botao.disabled = false;
    botao.textContent = textoOriginal;
  }
}

async function montarContexto(pdfFinal) {
  const { StandardFonts } = PDFLib;
  const [{ data: municipio }, { data: unidade }, { data: organizacao }, { data: capaMun }] = await Promise.all([
    sb.from('municipio').select('*').eq('id', ContextoPC.municipioId).single(),
    sb.from('unidade_saude').select('*').eq('id', ContextoPC.unidadeId).single(),
    sb.from('organizacao').select('*').maybeSingle(),
    sb.from('capa_municipio').select('*').eq('municipio_id', ContextoPC.municipioId).maybeSingle()
  ]);
  return {
    municipio, unidade, organizacao, capaMun,
    mes: Number(document.getElementById('pc-mes').value),
    ano: document.getElementById('pc-ano').value,
    edital: document.getElementById('pc-edital').value,
    fonteNormal: await pdfFinal.embedFont(StandardFonts.Helvetica),
    fonteNegrito: await pdfFinal.embedFont(StandardFonts.HelveticaBold)
  };
}

// Desenha a capa do bloco + anexa os arquivos dele, na ordem do catálogo.
// Devolve a lista de nomes que não puderam ser incluídos.
async function montarConteudoBloco(pdfFinal, ctx, nomeBloco, rotuloBloco) {
  const { data: capaBloco } = await sb.from('capa_bloco_titulo').select('*')
    .eq('municipio_id', ContextoPC.municipioId).eq('bloco', nomeBloco).maybeSingle();

  await desenharCapaBloco(pdfFinal, ctx, capaBloco?.titulo || rotuloBloco.toUpperCase());

  const catalogo = await garantirCatalogoDocumentos();
  const itens = catalogo.filter(c => c.bloco === nomeBloco);
  const { data: arquivos } = await sb.from('prestacao_documento')
    .select('*').eq('prestacao_id', ContextoPC.prestacaoId).order('enviado_em');

  const ignorados = [];
  for (const item of itens) {
    const doItem = (arquivos || []).filter(a => a.chave === item.chave);
    if (item.tem_subcapa && doItem.length) {
      desenharSubcapa(pdfFinal, ctx, item.rotulo.toUpperCase());
    }
    for (const a of doItem) await anexarArquivo(pdfFinal, a, ignorados);
  }
  return ignorados;
}

// Subcapa simples: só o subtítulo do documento, sem cabeçalho
// completo — separa visualmente cada documento dentro do bloco.
function desenharSubcapa(pdf, ctx, subtitulo) {
  const pagina = pdf.addPage(A4);
  centralizar(pagina, ctx.fonteNegrito, subtitulo, 20, 420);
}

/* -------- Buscar e anexar cada arquivo -------- */

async function anexarArquivo(pdfFinal, arquivo, ignorados) {
  try {
    const bytes = await buscarBytesArquivo(arquivo);
    if (!bytes) { ignorados.push(arquivo.nome_arquivo); return; }

    const tipo = (arquivo.nome_arquivo.split('.').pop() || '').toLowerCase();
    if (tipo === 'pdf') {
      const doc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
      const paginas = await pdfFinal.copyPages(doc, doc.getPageIndices());
      paginas.forEach(p => pdfFinal.addPage(p));
    } else if (tipo === 'png' || tipo === 'jpg' || tipo === 'jpeg') {
      const img = tipo === 'png' ? await pdfFinal.embedPng(bytes) : await pdfFinal.embedJpg(bytes);
      const pagina = pdfFinal.addPage([img.width, img.height]);
      pagina.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
    } else {
      ignorados.push(arquivo.nome_arquivo);
    }
  } catch (e) {
    console.error('[Vettore] anexar', arquivo.nome_arquivo, e);
    ignorados.push(arquivo.nome_arquivo);
  }
}

// Storage (Supabase): caminho com "/" e sem arquivo_url — baixa direto.
// Drive: passa pela Edge Function, que busca com a conta de serviço
// e devolve os bytes — evita o bloqueio de CORS do domínio do Drive.
async function buscarBytesArquivo(arquivo) {
  if (arquivo.arquivo_drive_id?.includes('/') && !arquivo.arquivo_url) {
    const { data, error } = await sb.storage.from('prestacao-documentos').download(arquivo.arquivo_drive_id);
    if (error) return null;
    return new Uint8Array(await data.arrayBuffer());
  }

  const { data: { session } } = await sb.auth.getSession();
  const r = await fetch(
    `${CONFIG.SUPABASE_URL}/functions/v1/upload-drive?baixar=${encodeURIComponent(arquivo.arquivo_drive_id)}`,
    { headers: { Authorization: 'Bearer ' + session.access_token } }
  );
  if (!r.ok) return null;
  return new Uint8Array(await r.arrayBuffer());
}

function baixarBytesComoArquivo(bytes, nomeArquivo) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nomeArquivo;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

/* -------- Desenho das capas -------- */

async function desenharCapaPrestacao(pdf, ctx) {
  const pagina = pdf.addPage(A4);
  await desenharCabecalho(pdf, pagina, ctx);
  centralizar(pagina, ctx.fonteNegrito, 'PRESTAÇÃO DE CONTAS', 34, 660);
  centralizar(pagina, ctx.fonteNegrito, `${ctx.municipio.nome.toUpperCase()} - ${ctx.municipio.uf}`, 34, 615);
  centralizar(pagina, ctx.fonteNegrito,
    ctx.capaMun?.subtitulo_prestacao || 'GESTÃO DOS SERVIÇOS DE SAÚDE MUNICIPAL', 18, 480);
  if (ctx.edital) centralizar(pagina, ctx.fonteNegrito, `EDITAL DE CHAMAMENTO PÚBLICO N° ${ctx.edital}`, 18, 456);
  centralizar(pagina, ctx.fonteNegrito, `${MESES_EXTENSO[ctx.mes - 1] || ''} - ${ctx.ano}`, 14, 140);
}

async function desenharCapaBloco(pdf, ctx, titulo) {
  const pagina = pdf.addPage(A4);
  await desenharCabecalho(pdf, pagina, ctx);
  centralizar(pagina, ctx.fonteNegrito, `${ctx.municipio.nome.toUpperCase()} - ${ctx.municipio.uf}`, 24, 540);
  centralizar(pagina, ctx.fonteNegrito, titulo, 18, 460);
}

// Cabeçalho em 3 colunas: logo da organização à esquerda, texto
// centralizado (horizontal e verticalmente) no meio, logo do
// município à direita — igual à tabela do modelo em Word.
async function desenharCabecalho(pdf, pagina, ctx) {
  const { width } = pagina.getSize();
  const faixaSuperior = 800, faixaInferior = 758; // banda onde tudo fica centralizado
  const meioVertical = (faixaSuperior + faixaInferior) / 2;

  const colEsquerdaFim = 130, colDireitaInicio = width - 130;
  const larguraColunaMeio = colDireitaInicio - colEsquerdaFim;

  const linha1 = `PREFEITURA MUNICIPAL DE ${ctx.municipio.nome.toUpperCase()}`;
  const linha2 = 'SECRETARIA MUNICIPAL DE SAÚDE';
  const tamanho1 = 10, tamanho2 = 9;
  const alturaBloco = tamanho1 + 4 + tamanho2;
  let y = meioVertical + alturaBloco / 2;

  const largura1 = ctx.fonteNegrito.widthOfTextAtSize(linha1, tamanho1);
  pagina.drawText(linha1, { x: colEsquerdaFim + (larguraColunaMeio - largura1) / 2, y, size: tamanho1, font: ctx.fonteNegrito });
  y -= tamanho1 + 4;
  const largura2 = ctx.fonteNormal.widthOfTextAtSize(linha2, tamanho2);
  pagina.drawText(linha2, { x: colEsquerdaFim + (larguraColunaMeio - largura2) / 2, y, size: tamanho2, font: ctx.fonteNormal });

  if (ctx.organizacao?.logo_data_url)
    await desenharLogo(pdf, pagina, ctx.organizacao.logo_data_url, 20, faixaInferior, 'esquerda', meioVertical);
  if (ctx.municipio?.logo_data_url)
    await desenharLogo(pdf, pagina, ctx.municipio.logo_data_url, width - 20, faixaInferior, 'direita', meioVertical);
}

async function desenharLogo(pdf, pagina, dataUrl, xReferencia, yBase, alinhamento, yCentro) {
  try {
    if (!/^data:image\/(png|jpe?g)/.test(dataUrl)) return; // svg não entra no PDF
    const base64 = dataUrl.split(',')[1];
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const img = dataUrl.includes('png') ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    const altura = 40, largura = altura * (img.width / img.height);
    const x = alinhamento === 'esquerda' ? xReferencia : xReferencia - largura;
    pagina.drawImage(img, { x, y: yCentro - altura / 2, width: largura, height: altura });
  } catch (e) {
    console.warn('[Vettore] logo não pôde ser embutida na capa:', e.message);
  }
}

function centralizar(pagina, fonte, texto, tamanho, y) {
  const { width } = pagina.getSize();
  const largura = fonte.widthOfTextAtSize(texto, tamanho);
  pagina.drawText(texto, { x: (width - largura) / 2, y, size: tamanho, font: fonte });
}

function quebrarLinhasCentralizado(pagina, fonte, texto, tamanho, yInicial, larguraMax) {
  const palavras = texto.split(' ');
  let linha = '', y = yInicial;
  palavras.forEach((p, i) => {
    const tentativa = linha ? linha + ' ' + p : p;
    if (fonte.widthOfTextAtSize(tentativa, tamanho) > larguraMax && linha) {
      centralizar(pagina, fonte, linha, tamanho, y);
      linha = p; y -= tamanho + 6;
    } else {
      linha = tentativa;
    }
    if (i === palavras.length - 1) centralizar(pagina, fonte, linha, tamanho, y);
  });
}
