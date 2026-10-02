// Focused UI regression: no Firebase connection and no production writes.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const assert = require('node:assert/strict'), { createRequire } = require('node:module');
const deps = createRequire(path.join(process.env.DL_TEST_DEPS || path.join(os.tmpdir(), 'dl-textos-tests'), 'package.json'));
const { JSDOM } = deps('jsdom');
const root = path.resolve(__dirname, '..');
const uid = 'WuXcMYo6m3OuQttlk7z22gRjlvn1', id = 'bc6DK46exhYZpk2eBLmJ';
const textos = [ { id, titulo: 'Vorstellung', conteudo: 'Mein Name ist Anna. Ich komme aus Österreich.\nNoch ein Satz.' },
  { id: 'second', titulo: 'Outro', conteudo: 'Anderer Text.' } ];
const dom = new JSDOM(fs.readFileSync(path.join(root, 'webapp/index.html'), 'utf8'), {
  url: 'https://example.test/', runScripts: 'outside-only', pretendToBeVisual: true });
const w = dom.window, $ = id => w.document.getElementById(id);
w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
w.HTMLDialogElement.prototype.close = function () { this.open = false; };
const tick = () => new Promise(resolve => setTimeout(resolve, 10));
const input = (id, value) => { $(id).value = value; $(id).dispatchEvent(new w.Event('input')); };
const choose = async id => { $('seletor-texto').value = id; $('seletor-texto').dispatchEvent(new w.Event('change')); await tick(); };
let copied = '', opened = [], writes = 0;
w.DL_AUTH = { pronta: true, usuario: { uid } };
w.DL_DADOS = { listarTextos: async () => textos, carregarTexto: async id => textos.find(t => t.id === id),
  carregarResumo: async () => 'Resumo existente', salvarResumo: async () => { writes++; }, salvarTexto: async () => { throw Error('Unexpected write'); } };
Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { writeText: async text => { copied = text; } } });
w.open = (...args) => { opened = args; };
function select(text) {
  const node = $('original-texto').firstChild, start = node.textContent.indexOf(text);
  const range = w.document.createRange(); range.setStart(node, start); range.setEnd(node, start + text.length);
  w.getSelection().removeAllRanges(); w.getSelection().addRange(range);
  w.document.dispatchEvent(new w.Event('selectionchange'));
}
(async () => {
  w.eval(fs.readFileSync(path.join(root, 'webapp/textos.js'), 'utf8')); await tick();
  assert.equal($('abertura-textos').querySelectorAll('select, li').length, 0);
  assert(!$('copiar-duvida') && !$('copiar-estudo'));
  await choose(id);
  assert.equal($('resumo-status').textContent, '');
  assert.equal($('resumo-conteudo').value, 'Resumo existente');
  assert(!$('resumo-secao').closest('.compreensao'));
  input('texto-compreensao', 'Minha leitura\n<segura>');
  select('Anna'); $('minha-pergunta').focus(); w.getSelection().removeAllRanges();
  input('minha-pergunta', 'Qual é o sentido?');
  $('consultar-sda').click(); await tick();
  assert(copied.includes('Trecho: Anna')); assert(copied.includes('Frase de contexto: Mein Name ist Anna.'));
  assert(copied.includes('Minha pergunta:\nQual é o sentido?')); assert(copied.includes('Minha compreensão:\nMinha leitura\n<segura>'));
  assert(copied.includes('Título: Vorstellung')); assert(copied.includes('Original:'));
  assert(copied.includes('S + V + (OI) + (OD) + [Te → Ka → Mo → Lo] + (Neg).'));
  assert.equal($('copia-status').textContent, ''); assert($('consulta-confirmacao').open);
  $('consulta-entendi').click();
  assert(!$('fase-textos').textContent.includes('S + V + (OI)'));
  select('Österreich.\nNoch'); $('minha-pergunta').focus(); w.getSelection().removeAllRanges();
  $('consultar-leo').click();
  assert.equal(opened[0], 'https://dict.leo.org/alem%C3%A3o-portugu%C3%AAs/' + encodeURIComponent('Österreich.\nNoch'));
  assert.equal(opened[1], '_blank'); assert.equal(opened[2], 'noopener,noreferrer');
  await choose('second'); assert.equal($('minha-pergunta').value, ''); assert($('consultar-leo').disabled);
  assert.equal($('selecao-texto').textContent, ''); assert.equal($('copia-status').textContent, '');
  $('consultar-sda').click(); await tick(); assert(copied.includes('Original:\nAnderer Text.'));
  assert(!copied.includes('Minha pergunta:')); assert(!copied.includes('Minha compreensão:'));
  await choose(id); assert.equal($('minha-pergunta').value, 'Qual é o sentido?');
  $('consultar-sda').click(); await tick(); assert(copied.includes(textos[0].conteudo)); assert(!copied.includes('Trecho:'));
  Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw Error('Denied'); } } });
  $('consultar-sda').click(); await tick(); assert(!$('copia-manual').hidden);
  assert($('copia-conteudo').readOnly); assert($('copia-conteudo').value.includes(textos[0].conteudo));
  assert.equal($('copia-conteudo').children.length, 0);
  input('minha-pergunta', 'Outra pergunta'); assert($('copia-manual').hidden); assert.equal($('copia-status').textContent, '');
  const summary = $('resumo-secao').querySelector('summary');
  summary.click(); assert($('resumo-secao').open);
  input('resumo-conteudo', 'Rascunho explícito'); summary.click(); assert(!$('resumo-secao').open);
  summary.click(); assert.equal($('resumo-conteudo').value, 'Rascunho explícito'); assert.equal(writes, 0);
  w.DL_AUTH.usuario = { uid: 'other' }; w.dispatchEvent(new w.Event('dl-auth-alterado'));
  assert.equal($('minha-pergunta').value, ''); assert($('estudo-texto').hidden);
  w.DL_AUTH.usuario = { uid }; w.dispatchEvent(new w.Event('dl-auth-alterado')); await tick(); await choose(id);
  assert.equal($('minha-pergunta').value, 'Outra pergunta'); assert($('consultar-leo').disabled);
  assert.equal(w.localStorage.length, 0); assert.equal(w.sessionStorage.length, 0); assert.equal(writes, 0);
  console.log('PASS: seleção/foco, pergunta por UID/texto, SDA com/sem seleção, contexto, cópia/manual, LEO codificado, resumo recolhível e abertura sem lista duplicada. Zero gravações.');
})().finally(() => w.close()).catch(error => { console.error(error); process.exitCode = 1; });
