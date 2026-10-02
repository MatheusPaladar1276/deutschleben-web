// Regressão única: a consulta deve usar os campos atuais, mesmo se o espelho estiver desatualizado.
// Apenas jsdom e adaptador local; nenhum acesso ao Firebase ou a documentos de produção.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const assert = require('node:assert/strict'), { createRequire } = require('node:module');
const deps = createRequire(path.join(process.env.DL_TEST_DEPS || path.join(os.tmpdir(), 'dl-textos-tests'), 'package.json'));
const { JSDOM } = deps('jsdom');
const root = path.resolve(__dirname, '..'), uid = 'WuXcMYo6m3OuQttlk7z22gRjlvn1';
const html = fs.readFileSync(path.join(root, 'webapp/index.html'), 'utf8');
const source = fs.readFileSync(path.join(root, 'webapp/textos.js'), 'utf8');
const texto = { id: 'local', titulo: 'Vorstellung', conteudo: 'Mein Name ist Anna. Ich lerne Deutsch.' };
const tick = () => new Promise(r => setTimeout(r, 10));
const casos = [
  { nome: 'pergunta isolada', pergunta: 'Pergunta atual: o que significa?', compreensao: '' },
  { nome: 'compreensão isolada', pergunta: '', compreensao: 'Compreensão atual:\nAnna apresenta-se. <texto literal>' },
  { nome: 'ambas', pergunta: 'Pergunta atual: por quê?', compreensao: 'Compreensão atual: Anna estuda alemão.' }
];
async function caso(campos, selecionar) {
  const dom = new JSDOM(html, { url: 'https://example.test/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window, $ = id => w.document.getElementById(id);
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  w.DL_AUTH = { pronta: true, usuario: { uid } };
  w.DL_DADOS = { listarTextos: async () => [texto], carregarTexto: async () => texto, carregarResumo: async () => '' };
  let copiado = '';
  Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async value => { copiado = value; } } });
  try {
    w.eval(source); await tick();
    $('seletor-texto').value = texto.id; $('seletor-texto').dispatchEvent(new w.Event('change')); await tick();
    // Reproduz a divergência: o espelho tem valores antigos; os campos exibem os atuais.
    for (const [id, valor] of [['minha-pergunta', 'Pergunta anterior'], ['texto-compreensao', 'Compreensão anterior']]) {
      $(id).value = valor; $(id).dispatchEvent(new w.Event('input'));
    }
    $('minha-pergunta').value = campos.pergunta;
    $('texto-compreensao').value = campos.compreensao;
    if (selecionar) {
      const node = $('original-texto').firstChild, inicio = node.textContent.indexOf('Anna');
      const range = w.document.createRange(); range.setStart(node, inicio); range.setEnd(node, inicio + 4);
      w.getSelection().removeAllRanges(); w.getSelection().addRange(range);
      w.document.dispatchEvent(new w.Event('selectionchange'));
    }
    $('minha-pergunta').focus(); $('texto-compreensao').focus();
    w.getSelection().removeAllRanges(); w.document.dispatchEvent(new w.Event('selectionchange'));
    $('consultar-sda').focus(); $('consultar-sda').click(); await tick();
    assert(copiado.includes('Título: Vorstellung'));
    for (const [rotulo, valor] of [['Minha pergunta', campos.pergunta], ['Minha compreensão', campos.compreensao]]) {
      if (valor) assert(copiado.includes(rotulo + ':\n' + valor), campos.nome + ': campo atual omitido — ' + rotulo);
      else assert(!copiado.includes(rotulo + ':'), campos.nome + ': incluiu espelho antigo — ' + rotulo);
    }
    assert(!copiado.includes('Pergunta anterior') && !copiado.includes('Compreensão anterior'));
    if (selecionar) {
      assert(copiado.includes('Trecho: Anna')); assert(copiado.includes('Frase de contexto: Mein Name ist Anna.'));
      assert(copiado.includes('Original:\n' + texto.conteudo)); assert.equal($('selecao-texto').textContent, 'Anna');
    } else { assert(copiado.includes('Original:\n' + texto.conteudo)); assert(!copiado.includes('Trecho:')); }
    assert(copiado.includes('S + V + (OI) + (OD) + [Te → Ka → Mo → Lo] + (Neg).'));
    assert(copiado.includes('sem substituir minha reflexão')); assert(copiado.includes('não como regra rígida nem análise automática'));
    assert($('consulta-confirmacao').open); assert.equal($('consulta-confirmacao-titulo').textContent, '✓ Consulta copiada! Envie ao SDA');
    assert.equal($('copia-status').textContent, ''); $('consulta-entendi').click();
    assert.equal(w.document.activeElement, $('consultar-sda'));
    assert.equal($('minha-pergunta').value, campos.pergunta); assert.equal($('texto-compreensao').value, campos.compreensao);
    assert.equal(w.document.querySelectorAll('#consultar-sda').length, 1);
    assert(!$('consultar-sda').closest('.ajuda, .compreensao'));
    const acao = $('consultar-sda').parentElement;
    assert.equal(w.document.querySelector('.compreensao').nextElementSibling, acao);
    assert(acao.nextElementSibling.classList.contains('resumo-caixa'));
    assert.equal($('consulta-sda-indicacao').textContent, 'Copiar pergunta e compreensão para conversar com o SDA.');
    assert($('consultar-leo').closest('.ajuda'));
    assert.equal(w.localStorage.length, 0); assert.equal(w.sessionStorage.length, 0);
  } finally { w.close(); }
}
(async () => {
  for (const campos of casos) for (const selecionar of [false, true]) await caso(campos, selecionar);
  console.log('PASS: seis casos SDA — pergunta, compreensão e ambas, com/sem seleção; campos atuais, contexto/original, orientação, botão externo único e confirmação preservados. Zero acesso ao Firebase.');
})().catch(e => { console.error(e); process.exitCode = 1; });
