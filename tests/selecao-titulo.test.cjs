// Verificação focada e local: sem Firebase e sem gravações.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const assert = require('node:assert/strict'), { createRequire } = require('node:module');
const deps = createRequire(path.join(process.env.DL_TEST_DEPS || path.join(os.tmpdir(), 'dl-textos-tests'), 'package.json'));
const { JSDOM } = deps('jsdom');
const root = path.resolve(__dirname, '..');
const texto = { id: 'local', titulo: 'Mein Land', conteudo: 'Ich lerne Deutsch. Noch ein Satz.' };
const dom = new JSDOM(fs.readFileSync(path.join(root, 'webapp/index.html'), 'utf8'), {
  url: 'https://example.test/', runScripts: 'outside-only', pretendToBeVisual: true
});
const w = dom.window, $ = id => w.document.getElementById(id);
const tick = () => new Promise(resolve => setTimeout(resolve, 10));
w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
w.HTMLDialogElement.prototype.close = function () { this.open = false; };
w.DL_AUTH = { pronta: true, usuario: { uid: 'WuXcMYo6m3OuQttlk7z22gRjlvn1' } };
w.DL_DADOS = { listarTextos: async () => [texto], carregarTexto: async () => texto, carregarResumo: async () => '' };
let copiado, aberto;
Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async value => { copiado = value; } } });
w.open = url => { aberto = url; };
function selecionar(id, trecho) {
  const node = $(id).firstChild, inicio = node.textContent.indexOf(trecho);
  const range = w.document.createRange(); range.setStart(node, inicio); range.setEnd(node, inicio + trecho.length);
  w.getSelection().removeAllRanges(); w.getSelection().addRange(range);
  w.document.dispatchEvent(new w.Event('selectionchange'));
}
function consultar(id) {
  const ev = new w.MouseEvent('mousedown', { button: 0, bubbles: true, cancelable: true });
  $(id).dispatchEvent(ev); assert(ev.defaultPrevented);
  $(id).click();
}
(async () => {
  w.eval(fs.readFileSync(path.join(root, 'webapp/textos.js'), 'utf8')); await tick();
  $('seletor-texto').value = texto.id; $('seletor-texto').dispatchEvent(new w.Event('change')); await tick();
  $('minha-pergunta').value = 'O que significa?'; $('texto-compreensao').value = 'Minha leitura';
  for (const [area, trecho] of [['titulo-texto', 'Land'], ['original-texto', 'Deutsch']]) {
    selecionar(area, trecho);
    assert.equal($('selecao-texto').textContent, trecho); assert(!$('consultar-leo').disabled);
    consultar('consultar-leo'); assert.equal(aberto, 'https://dict.leo.org/alem%C3%A3o-portugu%C3%AAs/' + trecho);
    assert.equal(w.getSelection().toString(), trecho);
    consultar('consultar-sda'); await tick();
    assert(copiado.includes('Trecho: ' + trecho)); assert(copiado.includes('Original:\n' + texto.conteudo));
    assert(copiado.includes('Título: ' + texto.titulo));
    assert(copiado.includes('Minha pergunta:\nO que significa?')); assert(copiado.includes('Minha compreensão:\nMinha leitura'));
    if (area === 'titulo-texto') {
      assert(copiado.includes('Origem do trecho: título')); assert(copiado.includes('Título de contexto: Mein Land'));
      assert(!copiado.includes('Frase de contexto:'));
    } else {
      assert(copiado.includes('Frase de contexto: Ich lerne Deutsch.')); assert(!copiado.includes('Origem do trecho: título'));
    }
    $('consulta-entendi').click();
    w.getSelection().removeAllRanges(); w.document.dispatchEvent(new w.Event('selectionchange'));
    $('consultar-leo').focus(); $('consultar-leo').click();
    assert.equal(aberto, 'https://dict.leo.org/alem%C3%A3o-portugu%C3%AAs/' + trecho);
  }
  console.log('PASS: Land no título → Ajuda rápida → LEO; SDA identifica título e preserva campos/original; corpo Deutsch sem regressão; seleção preservada nos controles. Zero acesso ao Firebase.');
})().finally(() => w.close()).catch(error => { console.error(error); process.exitCode = 1; });
