const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const assert = require('node:assert/strict'), {spawn} = require('node:child_process'), {pathToFileURL} = require('node:url');
const {criarServidor, demo, registro} = require('../local-preview/memorizar/servidor.cjs');
const root = path.resolve(__dirname, '..'), port = 8797, debug = 9397;
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'dl-memorizar-test-'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
let servidor, chrome, ws, id = 0, checks = 0;
const pendentes = new Map(), externas = [], erros = [];
const verificar = (condicao, mensagem) => { assert(condicao, mensagem); checks++; };
const ler = arquivo => JSON.parse(fs.readFileSync(path.join(root, 'webapp', 'data', arquivo + '.json'), 'utf8'));
async function modelo() {
  const m = await import(pathToFileURL(path.join(root, 'webapp', 'memorizar', 'modelo.js')));
  const acervos = {substantivos: ler('substantivos'), verbos: ler('verbos'), adverbios: ler('adjetivos_adverbios')};
  const resultado = m.identificar(demo.texto, registro, acervos, demo.revisao);
  assert.deepEqual(Object.values(resultado.itens).map(a => a.length), [16, 14, 4]); checks++;
  verificar(resultado.itens.substantivos.some(n => n.lema === 'Moment' && n.artigo === 'der' && n.plural === 'die Momente' && n.significado === 'momento'), 'Moment entra no conjunto a partir do acervo');
  verificar(!resultado.pendencias.some(p => p.palavra === 'Moment'), 'Moment deixa de ser pendência');
  verificar(resultado.itens.verbos.every(v => v.classificacao === m.SEM_CLASSIFICACAO), 'Não inferir classificação pelas formas');
  verificar(!resultado.itens.adverbios.some(v => v.lema === 'zurück'), 'Não promover partícula a advérbio');
  verificar(resultado.itens.substantivos.find(n => n.lema === 'Wasser').plural === '—', 'Preservar sentido do Card sobre plural geral');
  verificar(resultado.itens.substantivos.find(n => n.lema === 'Kaffee').nota.includes('porções'), 'Preservar nota de uso do acervo');
  verificar(resultado.itens.substantivos.some(n => n.lema === 'Sonne'), 'Sonne consta no acervo e no texto, embora ausente do Card');
  verificar(resultado.itens.verbos.find(v => v.lema === 'mögen').significado.includes('Konjunktiv'), 'Manter sentido contextual de möchte');
  assert.throws(() => m.identificar({...demo.texto, id: 'outro'}, registro, acervos)); checks++;
  assert.throws(() => m.identificar(demo.texto, {...registro, original: 'outro'}, acervos)); checks++;
  const ruim = structuredClone(registro); ruim.card.secoes.verbos[0].origem = 'Frase ausente';
  assert.throws(() => m.identificar(demo.texto, ruim, acervos)); checks++;
  assert.throws(() => m.identificar(demo.texto, registro, acervos, [{...demo.revisao[0], origem: 'Não consta.'}])); checks++;
  const sem = m.identificar(demo.semCard, null, acervos);
  verificar(Object.values(sem.itens).every(a => a.length === 0) && sem.pendencias.length === 0, 'Não inventar identificação nem pendências sem Card');
  assert.throws(() => m.criarCiclo(demo.semCard, sem, 1, 'dias')); checks++;
  for (const q of [0, -1, 1.5, Infinity, 11, 20]) { assert.throws(() => m.criarCiclo(demo.texto, resultado, q, 'dias')); checks++; }
  assert.throws(() => m.criarCiclo(demo.texto, resultado, 2, 'semanas')); checks++;
  const dia = n => new Date(2025, 0, 10 + n, 9, 0, 0).getTime();
  for (const q of [1, 3, 10]) {
    const c = m.criarCiclo(demo.texto, resultado, q, 'dias', dia(0));
    verificar(c.quantidade === q && c.unidade === 'dias', 'Prazo criado em dias: ' + q);
    verificar(m.marcador(c, dia(0)).texto === `${q} ${q === 1 ? 'dia restante' : 'dias restantes'}`, 'Dia de início conta o prazo cheio: ' + q);
    verificar(m.marcador(c, dia(0) + 6 * 3600000).restantes === q, 'Mesmo dia local não avança a contagem: ' + q);
    verificar(!m.marcador(c, dia(q - 1)).concluido && m.marcador(c, dia(q - 1)).restantes === 1, 'Último dia mostra 1 dia restante: ' + q);
    verificar(m.marcador(c, dia(q)).concluido && m.marcador(c, dia(q)).texto === 'Prazo concluído.', 'Conclui na virada do calendário: ' + q);
  }
  const ciclo = m.criarCiclo(demo.texto, resultado, 3, 'dias', dia(0));
  const antes = JSON.stringify(ciclo.identificacao);
  resultado.itens.substantivos.length = 0;
  verificar(JSON.stringify(ciclo.identificacao) === antes, 'Snapshot não muda com o acervo');
  const continuado = m.continuarCiclo(ciclo, 5, 'dias', dia(3));
  verificar(JSON.stringify(continuado.identificacao) === antes && continuado.inicio === dia(3) && continuado.quantidade === 5, 'Renovação mantém os mesmos itens e reinicia a contagem');
  verificar(m.marcador(continuado, dia(3)).restantes === 5, 'Renovação conta o novo prazo incluindo o dia escolhido');
  // Ciclo antigo em semanas é preservado como dias de calendário, sem perda de dados.
  const legado = {versao: 1, textoId: ciclo.textoId, titulo: ciclo.titulo, original: ciclo.original,
    identificacao: JSON.parse(antes), inicio: dia(0), fim: dia(0) + 14 * 86400000, quantidade: 2, unidade: 'semanas'};
  verificar(JSON.stringify(m.validarCiclo(legado)) === JSON.stringify(legado), 'Ciclo antigo em semanas continua válido');
  verificar(m.marcador(legado, dia(0)).restantes === 14 && m.marcador(legado, dia(14)).concluido, 'Semana antiga preservada como 14 dias de calendário');
  verificar(m.classificacaoConferida({classificacao: 'regular'}) === m.SEM_CLASSIFICACAO, 'Exigir conferência explícita');
  verificar(m.classificacaoConferida({classificacao: 'misto', classificacaoConferida: true, fonteClassificacao: 'Ficha revisada'}) === 'misto', 'Exibir classificação conferida quando existir');
  verificar(m.classificacaoConferida({classificacao: 'forte', classificacaoConferida: true, fonteClassificacao: 'Ficha'}) === m.SEM_CLASSIFICACAO, 'Não inventar enumeração');
  verificar(!resultado.pendencias.some(p => p.motivo === m.SEM_CLASSIFICACAO), 'Verbos não geram pendência de classificação não informada');
  const grande = structuredClone(ciclo.identificacao);
  grande.itens.adverbios = Array.from({length: 160}, (_, i) => ({lema: 'item-' + i, significado: 'demonstração'}));
  verificar(m.criarCiclo(demo.texto, grande, 1, 'dias', dia(0)).identificacao.itens.adverbios.length === 160, 'Não limitar quantidade');
  assert.throws(() => m.validarCiclo({...ciclo, fim: ciclo.fim + 1})); checks++;
  console.log('Modelo: vínculos, cobertura, campos, classificação, ausência segura, snapshot e prazo conferidos.');
}
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const n = ++id; pendentes.set(n, {resolve, reject}); ws.send(JSON.stringify({id: n, method, params}));
});
async function ev(expression) {
  const r = await send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
  if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}
async function until(expression) {
  for (let i = 0; i < 160; i++) { if (await ev(expression)) return; await sleep(100); }
  throw Error('Tempo esgotado: ' + expression + '\n' + await ev('document.body.innerText'));
}
async function click(seletor) {
  await until(`!!document.querySelector(${JSON.stringify(seletor)})&&!document.querySelector(${JSON.stringify(seletor)}).disabled`);
  const ponto = await ev(`(()=>{const e=document.querySelector(${JSON.stringify(seletor)});e.scrollIntoView({block:'center',behavior:'instant'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  await send('Input.dispatchMouseEvent', {type: 'mousePressed', ...ponto, button: 'left', clickCount: 1});
  await send('Input.dispatchMouseEvent', {type: 'mouseReleased', ...ponto, button: 'left', clickCount: 1});
}
async function navegar() {
  await send('Page.navigate', {url: `http://127.0.0.1:${port}/`});
  await until(`document.readyState==='complete'&&!!document.getElementById('nav-memorizar')&&!!window.DL_TEXTOS`);
}
async function escolher(id = demo.texto.id) {
  await until(`!!document.querySelector('#seletor-texto option[value="${id}"]')`);
  await ev(`document.getElementById('seletor-texto').value=${JSON.stringify(id)};document.getElementById('seletor-texto').dispatchEvent(new Event('change'))`);
  await until(`window.DL_TEXTOS.obterAtivo()?.id===${JSON.stringify(id)}`);
}
async function captura(nome) {
  const r = await send('Page.captureScreenshot', {format: 'png', captureBeyondViewport: false});
  fs.writeFileSync(path.join(out, nome + '.png'), Buffer.from(r.data, 'base64'));
}
async function iniciarChrome() {
  chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=' + debug, '--user-data-dir=' + path.join(out, 'perfil'), 'about:blank'], {windowsHide: true, stdio: 'ignore'});
  let tabs;
  for (let i = 0; i < 100; i++) {
    try { tabs = await (await fetch(`http://127.0.0.1:${debug}/json`)).json(); if (tabs.some(t => t.type === 'page')) break; } catch {}
    await sleep(100);
  }
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, {once: true}));
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data), p = pendentes.get(m.id);
    if (p) { pendentes.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result); }
    if (m.method === 'Runtime.exceptionThrown') erros.push(m.params.exceptionDetails.text);
    if (m.method === 'Network.requestWillBeSent' && /^https?:/.test(m.params.request.url) &&
      !m.params.request.url.startsWith(`http://127.0.0.1:${port}/`)) externas.push(m.params.request.url);
  });
  await send('Network.enable'); await send('Runtime.enable'); await send('Page.enable');
  await send('Network.setBlockedURLs', {urls: ['https://*/*']});
}
async function pararChrome() {
  const saiu = new Promise(resolve => chrome.once('exit', resolve));
  await send('Browser.close'); ws.close(); ws = null;
  await saiu; chrome = null;
}
async function browser() {
  servidor = criarServidor(); await new Promise((resolve, reject) => { servidor.once('error', reject); servidor.listen(port, '127.0.0.1', resolve); });
  await iniciarChrome();
  await send('Emulation.setDeviceMetricsOverride', {width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false});
  await navegar(); await escolher();
  await click('#nav-memorizar'); await until(`document.getElementById('mem-contagem').textContent.includes('16 substantivos')`);
  verificar(await ev(`document.getElementById('mem-contagem').textContent==='16 substantivos · 14 verbos · 4 advérbios'`), 'Contagem da prévia no navegador');
  verificar(await ev(`document.querySelectorAll('.mem-item').length===34`), 'Todos os itens disponíveis, sem sorteio');
  for (const g of ['substantivos', 'verbos', 'adverbios']) {
    await click('#mem-grupo-' + g + '-botao');
    await until(`!document.getElementById('mem-grupo-${g}').hidden`);
    verificar(await ev(`document.querySelectorAll('#mem-grupo-${g} .mem-item').length>0`), 'Categoria abre itens pela interface: ' + g);
  }
  verificar(await ev(`!document.getElementById('mem-itens').textContent.includes('classificação não informada')`), 'Verbos sem mensagem de classificação não informada');
  verificar(await ev(`getComputedStyle(document.querySelector('.ajuda')).display==='none'`), 'Ajuda preservada e apenas recolhida enquanto Memorizar abre');
  await until(`document.getElementById('mem-offline').textContent.startsWith('Pacote de demonstração conferido')`);
  await captura('computador-conferencia');
  await click('#mem-iniciar'); await until(`document.getElementById('mem-status').textContent.startsWith('Ciclo salvo')`);
  const snapshot = await ev(`document.getElementById('mem-itens').textContent`);
  await captura('computador-ciclo');
  await navegar(); await escolher(); await click('#nav-memorizar');
  await until(`document.getElementById('mem-status').textContent.startsWith('Ciclo restaurado')`);
  verificar(await ev(`document.getElementById('mem-itens').textContent`) === snapshot, 'Restaurar ciclo completo após recarregar');
  await ev(`window.__agora=Date.now;Date.now=()=>window.__agora()+8*86400000;document.dispatchEvent(new Event('visibilitychange'))`);
  await until(`!document.getElementById('mem-fim').hidden`);
  verificar(await ev(`document.getElementById('mem-tempo').textContent==='Prazo concluído.'`), 'Mensagem exata de conclusão');
  verificar(await ev(`document.getElementById('mem-itens').textContent`) === snapshot, 'Vencimento não remove nem troca palavras');
  await captura('prazo-concluido');
  await click('#mem-continuar');
  await ev(`document.getElementById('mem-quantidade').value='5'`);
  await click('#mem-iniciar'); await until(`document.getElementById('mem-tempo').textContent==='5 dias restantes'`);
  verificar(await ev(`document.getElementById('mem-itens').textContent`) === snapshot, 'Continuar conserva todos os campos');
  await ev(`Date.now=()=>window.__agora()+23*86400000;document.dispatchEvent(new Event('visibilitychange'))`);
  await until(`!document.getElementById('mem-fim').hidden`);
  await escolher(demo.semCard.id);
  verificar(await ev(`document.getElementById('mem-vinculo').textContent.includes('texto aberto ao lado é outro')&&!document.getElementById('mem-releitura').hidden`), 'Trocar texto não substitui ciclo e mantém original para releitura');
  await click('#mem-novo'); await until(`document.querySelectorAll('.mem-item').length===0`);
  verificar(await ev(`document.getElementById('mem-auditoria')===null`), 'Seção de identificação e pendências removida da interface');
  await click('#mem-iniciar'); await until(`document.getElementById('mem-status').textContent.includes('Nenhum item identificado')`);
  await click('#mem-cancelar');
  verificar(await ev(`document.getElementById('mem-itens').textContent`) === snapshot, 'Novo conjunto inválido ou cancelado preserva ciclo anterior');
  await escolher();
  await ev(`window.DL_MEMORIZAR_DEMO.registros[0].card.secoes.adverbios.shift()`);
  await click('#mem-novo'); await until(`document.querySelectorAll('.mem-item').length===33`);
  await click('#mem-iniciar'); await until(`document.getElementById('mem-status').textContent.startsWith('Ciclo salvo')`);
  verificar(await ev(`document.querySelectorAll('.mem-item').length===33`), 'Novo conjunto incorpora fonte revisada somente após confirmação');
  const novo = await ev(`document.getElementById('mem-itens').textContent`);
  await ev(`(async()=>{const p=await import('/memorizar/persistencia.js');const c=await p.carregarCiclo();try{await p.salvarCiclo(c,null);return 'falhou';}catch(e){return e.message;}})()`).then(s => verificar(s.includes('outra aba'), 'Conflito entre abas explícito e sem sobrescrita'));
  await click('#mem-fechar');
  verificar(await ev(`getComputedStyle(document.querySelector('.ajuda')).display!=='none'&&document.activeElement.id==='nav-memorizar'`), 'Fechar restaura Ajuda e foco');
  await click('#nav-memorizar'); await until(`document.getElementById('mem-status').textContent.startsWith('Ciclo restaurado')`);
  for (const width of [390, 768, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', {width, height: 1000, deviceScaleFactor: 1, mobile: width < 600});
    await ev(`document.body.style.fontSize='22px';document.getElementById('memorizar').scrollIntoView({block:'start',behavior:'instant'})`);
    verificar(await ev(`document.documentElement.scrollWidth<=innerWidth`), 'Sem overflow horizontal em ' + width);
    verificar(await ev(`(()=>{const r=document.getElementById('memorizar').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})()`), 'Card dentro do viewport ' + width);
    if (width === 1440) verificar(await ev(`Math.abs(document.getElementById('memorizar').getBoundingClientRect().top-document.querySelector('#estudo-texto .grade > section').getBoundingClientRect().top)<5`), 'Texto e Card paralelos no computador');
    await captura('layout-' + width);
  }
  await send('Network.emulateNetworkConditions', {offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0});
  // O servidor é desligado: nem uma resposta localhost pode mascarar o teste offline.
  await new Promise(r => servidor.close(r)); servidor = null;
  await navegar(); await escolher(); await click('#nav-memorizar');
  await until(`document.getElementById('mem-status').textContent.startsWith('Ciclo restaurado')`);
  verificar(await ev(`document.getElementById('mem-itens').textContent`) === novo, 'Reload offline com servidor desligado preserva novo conjunto e prazo');
  await pararChrome(); await iniciarChrome();
  await send('Network.emulateNetworkConditions', {offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0});
  await navegar(); await escolher(); await click('#nav-memorizar');
  await until(`document.getElementById('mem-status').textContent.startsWith('Ciclo restaurado')`);
  verificar(await ev(`document.getElementById('mem-itens').textContent`) === novo, 'Reiniciar o processo do navegador sem servidor restaura cópia durável');
  await ev(`(async()=>{const p=await import('/memorizar/persistencia.js');const c=await p.carregarCiclo();const m=await import('/memorizar/modelo.js');await p.salvarCiclo(m.continuarCiclo(c,1,'dias',Date.now()-2*86400000),c);})()`);
  await click('#mem-fechar'); await click('#nav-memorizar'); await until(`!document.getElementById('mem-fim').hidden`);
  await click('#mem-continuar'); await click('#mem-iniciar');
  await until(`document.getElementById('mem-status').textContent.startsWith('Ciclo salvo')`);
  verificar(await ev(`document.getElementById('mem-itens').textContent`) === novo, 'Renovação funciona offline sem mudar itens');
  const antigoIDB = await ev(`window.__idbOpen=indexedDB.open;indexedDB.open=()=>{throw Error('Falha simulada de armazenamento');};true`);
  verificar(antigoIDB, 'Injeção de falha local disponível');
  await click('#mem-fechar'); await click('#nav-memorizar');
  await until(`document.getElementById('mem-status').textContent.includes('Falha simulada')`);
  verificar(await ev(`document.getElementById('mem-prazo').hidden`), 'Falha de armazenamento não oferece sucesso nem formulário perigoso');
  await ev(`indexedDB.open=window.__idbOpen`);
  await click('#mem-fechar'); await click('#nav-memorizar');
  await until(`document.getElementById('mem-status').textContent.startsWith('Ciclo restaurado')`);
  verificar(await ev(`document.getElementById('mem-itens').textContent`) === novo, 'Falha local não apaga ciclo');
  // Alterar prazo durante o ciclo em andamento, offline, mantendo itens e preservando até confirmar.
  const antesAlterar = await ev(`document.getElementById('mem-itens').textContent`);
  await until(`!document.getElementById('mem-alterar-prazo').hidden`);
  verificar(await ev(`document.getElementById('mem-alterar-prazo').textContent==='Alterar prazo'`), 'Botão Alterar prazo junto à contagem do ciclo');
  await click('#mem-alterar-prazo');
  await ev(`document.getElementById('mem-quantidade').value='7'`);
  verificar(await ev(`document.getElementById('mem-iniciar').textContent==='Iniciar nova contagem'`), 'Confirmação rotulada Iniciar nova contagem');
  await click('#mem-iniciar'); await until(`document.getElementById('mem-tempo').textContent==='7 dias restantes'`);
  verificar(await ev(`document.getElementById('mem-itens').textContent`) === antesAlterar, 'Alterar prazo para 7 dias mantém os mesmos itens');
  await click('#mem-alterar-prazo');
  await ev(`document.getElementById('mem-quantidade').value='10'`);
  await click('#mem-cancelar'); await until(`document.getElementById('mem-tempo').textContent==='7 dias restantes'`);
  verificar(await ev(`document.getElementById('mem-itens').textContent`) === antesAlterar, 'Cancelar preserva o prazo anterior e os itens');
  await click('#mem-alterar-prazo');
  await ev(`document.getElementById('mem-quantidade').value='10'`);
  await click('#mem-iniciar'); await until(`document.getElementById('mem-tempo').textContent==='10 dias restantes'`);
  verificar(await ev(`document.getElementById('mem-itens').textContent`) === antesAlterar, 'Nova contagem de 10 dias mantém os mesmos itens');
  await captura('alterar-prazo-10-dias');
  await click('#mem-fechar'); await click('#nav-memorizar');
  await until(`document.getElementById('mem-status').textContent.startsWith('Ciclo restaurado')`);
  await until(`document.getElementById('mem-tempo').textContent==='10 dias restantes'`);
  verificar(await ev(`document.getElementById('mem-itens').textContent`) === antesAlterar, 'Reabrir offline preserva o novo prazo de 10 dias e os itens');
  verificar(externas.length === 0, 'Nenhuma requisição externa: ' + externas.join(','));
  verificar(erros.length === 0, 'Nenhuma exceção não tratada: ' + erros.join(','));
  await pararChrome();
  fs.rmSync(path.join(out, 'perfil'), {recursive: true, force: true});
  console.log('Navegador: ciclo, renovação, troca explícita, conflitos, falha local, layout e offline conferidos.');
}
(async () => {
  try { await modelo(); await browser(); console.log(`${checks} verificações passaram. Capturas locais: ${out}`); }
  finally {
    if (ws?.readyState === WebSocket.OPEN) { await send('Browser.close').catch(() => {}); ws.close(); }
    if (chrome && chrome.exitCode === null) chrome.kill();
    if (servidor) await new Promise(r => servidor.close(r));
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
