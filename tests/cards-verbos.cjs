const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'../webapp'),profile=fs.mkdtempSync(path.join(os.tmpdir(),'dl-verbal-')),port=8775,debug=9355;
const card=JSON.parse(fs.readFileSync(path.join(root,'cards/texto-01.json'),'utf8'));
const F=require('../webapp/cards/formato.js');F.validar(card);const c=structuredClone(card);c.secoes.verbos[0].infinitivo='machen';F.validar(c);c.secoes.verbos[0].infinitivo=3;assert.throws(()=>F.validar(c));
const fixture=structuredClone(card);fixture.secoes.verbos[0].origem='Am fr\u00fchen Morgen gehe ich zum See.';
const harness=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="cards.css"><div id="card"></div><script type="module" src="cards.js"></script>`;
const server=http.createServer((req,res)=>{let rel=new URL(req.url,'http://local').pathname;if(rel.endsWith('/'))rel+='index.html';let file=path.join(root,rel);try{let b=fs.readFileSync(file);if(rel==='/cards/index.html')b=harness;if(rel==='/cards/cards.js'){b=b.toString().replace("import * as dados from './dados.js?v=blocos-15';",'').replace("import { listarLocal, guardarLocal, removerLocal } from './offline.js?v=blocos-15';",'');b=b.slice(0,b.indexOf('async function atualizar(u,g)'));b+=`\nrender(document.getElementById('card'),${JSON.stringify(fixture)});window.pronto=true;`;}
res.setHeader('Content-Type',({'.js':'text/javascript','.json':'application/json','.html':'text/html','.css':'text/css'})[path.extname(file)]||'application/octet-stream');res.end(b);}catch{res.writeHead(404);res.end();}});
let chrome,ws,n=0;const pending=new Map(),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++n;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
async function ev(expression){let r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
async function until(s){for(let i=0;i<100;i++){if(await ev(s))return;await sleep(100);}throw Error(s);}
async function check(){
 await until('window.pronto');await ev("document.querySelector('[data-secao=verbos]').click()");
 assert.equal(await ev("document.querySelectorAll('.verbo-consulta').length"),0);
 assert.equal(await ev("document.querySelectorAll('.consulta-verbal').length"),card.secoes.verbos.length);
 await ev("document.querySelector('.conjugar-verbos').click()");
 await until("[...document.querySelectorAll('.consulta-verbal')].every(p=>!p.hidden && p.textContent.length)");
 assert.equal(await ev("document.querySelectorAll('.consulta-verbal table').length"),13);
 for(let i=0;i<card.secoes.verbos.length;i++){
  const item=card.secoes.verbos[i];
  assert(await ev(`document.querySelectorAll('.linha')[${i}].textContent.includes(${JSON.stringify(item.de)}) && document.querySelectorAll('.linha')[${i}].textContent.includes(${JSON.stringify(item.pt)})`));
  const lemma=item.de.split(';').at(-1).trim(),special=item.de.startsWith('m\u00f6chte');
  const acervo=JSON.parse(fs.readFileSync(path.join(root,'cards/verbos-consulta.json'),'utf8'));
  const entry=acervo[special?'m\u00f6chte':lemma];assert(entry && entry.fontes.conferencia.length);
  const actual=await ev(`(()=>{const t=document.querySelectorAll('.consulta-verbal table')[${i}];return {headers:[...t.querySelectorAll('thead th')].map(x=>x.textContent),rows:[...t.querySelectorAll('tbody tr')].map(r=>[...r.children].map(x=>x.textContent)),text:t.parentElement.parentElement.textContent};})()`);
  const persons=['ich','du','er/sie/es','wir','ihr','sie/Sie'];
  assert.equal(actual.rows.length,6);
  assert.deepEqual(actual.headers,special?['Pessoa','Konjunktiv II']:['Pessoa','Pr\u00e4sens','Perfekt','Pr\u00e4teritum']);
  assert.deepEqual(actual.rows,persons.map(p=>[p,...(special?['konjunktiv_ii']:['presens','perfekt','praeteritum']).map(t=>entry.tabelas[t][p])]));
  assert(!actual.text.includes('Ainda n\u00e3o dispon\u00edvel no acervo'));
  const anchors={'gehen':['gingst','seid gegangen'],'liegen':['lagst','habt gelegen'],'h\u00f6ren':['h\u00f6rtest','habt geh\u00f6rt'],'stehen bleiben':['bliebst stehen','seid stehen geblieben'],'scheinen':['schienst','habt geschienen'],'sehen':['sahst','habt gesehen'],'sitzen':['sa\u00dfest','habt gesessen'],'schauen':['schautest','habt geschaut'],'zur\u00fcckgehen':['gingst zur\u00fcck','seid zur\u00fcckgegangen'],'machen':['machtest','habt gemacht'],'denken':['dachtest','habt gedacht'],'arbeiten':['arbeitetest','habt gearbeitet']};
  if(!special){assert.equal(actual.rows[1][3],anchors[lemma][0]);assert.equal(actual.rows[4][2],anchors[lemma][1]);}
  if(i===0)assert(await ev("document.querySelector('.contexto').textContent.includes('gehe ich zum See.')"));
  if(special){assert(actual.text.includes('gostaria'));assert(!actual.text.includes('gemocht'));assert(!actual.text.includes('mochte'));}

 }
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});assert(await ev('document.documentElement.scrollWidth<=innerWidth'));await send('Emulation.clearDeviceMetricsOverride');
 await ev("document.querySelector('.conjugar-verbos').click()");
 assert(await ev("[...document.querySelectorAll('.consulta-verbal')].every(p=>p.hidden) && document.querySelector('.conjugar-verbos').getAttribute('aria-expanded')==='false'"));
}
(async()=>{await new Promise(r=>server.listen(port,'127.0.0.1',r));chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port='+debug,'--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});let tabs;for(let i=0;i<100;i++){try{tabs=await(await fetch('http://127.0.0.1:'+debug+'/json')).json();break;}catch{await sleep(100);}}ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));ws.addEventListener('message',e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}});await send('Network.enable');await send('Page.navigate',{url:`http://127.0.0.1:${port}/cards/`});await check();await ev("navigator.serviceWorker.register('./sw.js',{scope:'/cards/'}).then(()=>navigator.serviceWorker.ready).then(()=>true)");await until('!!navigator.serviceWorker.controller');await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});await send('Page.reload',{ignoreCache:true});await check();console.log('PASS: Texto 01 antigo: 13 tabelas de seis pessoas, 12x3 tempos, Konjunktiv II contextual, formas conferidas, fontes, significado/contexto, abrir/recolher, 390px e recarga offline com SW real.');})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(ws){await send('Browser.close').catch(()=>{});ws.close();}if(chrome)chrome.kill();server.close();});

