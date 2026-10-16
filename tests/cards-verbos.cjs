const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'../webapp'),profile=fs.mkdtempSync(path.join(os.tmpdir(),'dl-verbal-')),port=8775,debug=9355;
const card=JSON.parse(fs.readFileSync(path.join(root,'cards/texto-01.json'),'utf8'));
const F=require('../webapp/cards/formato.js');F.validar(card);const c=structuredClone(card);c.secoes.verbos[0].infinitivo='machen';F.validar(c);c.secoes.verbos[0].infinitivo=3;assert.throws(()=>F.validar(c));
const fixture=structuredClone(card);
const harness=`<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="cards.css"><div id="card"></div><script type="module" src="cards.js"></script>`;
const server=http.createServer((req,res)=>{let rel=new URL(req.url,'http://local').pathname;if(rel.endsWith('/'))rel+='index.html';let file=path.join(root,rel);try{let b=fs.readFileSync(file);if(rel==='/cards/index.html')b=harness;if(rel==='/cards/cards.js'){b=b.toString().replace("import * as dados from './dados.js';",'').replace("import { listarLocal, guardarLocal, removerLocal } from './offline.js';",'');b=b.slice(0,b.indexOf('async function atualizar(u,g)'));b+=`\nrender(document.getElementById('card'),${JSON.stringify(fixture)});window.pronto=true;`;}
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
 assert(await ev("document.querySelector('.consulta-verbal').textContent.includes('ich: gehe') && document.querySelector('.consulta-verbal').textContent.includes('ist gegangen')"));
 for(let i=0;i<card.secoes.verbos.length;i++){
  const item=card.secoes.verbos[i];
  assert(await ev(`document.querySelectorAll('.linha')[${i}].textContent.includes(${JSON.stringify(item.de)}) && document.querySelectorAll('.linha')[${i}].textContent.includes(${JSON.stringify(item.pt)})`));
  const text=await ev(`document.querySelectorAll('.consulta-verbal')[${i}].textContent`);
  if(item.de.includes('m\u00f6chte'))assert(text.includes('Ainda n\u00e3o dispon\u00edvel no acervo'));
  if(item.de==='denke; denken')assert(text.includes('hat gedacht'));
 }
 await ev("document.querySelector('.conjugar-verbos').click()");
 assert(await ev("[...document.querySelectorAll('.consulta-verbal')].every(p=>p.hidden) && document.querySelector('.conjugar-verbos').getAttribute('aria-expanded')==='false'"));
}
(async()=>{await new Promise(r=>server.listen(port,'127.0.0.1',r));chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port='+debug,'--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});let tabs;for(let i=0;i<100;i++){try{tabs=await(await fetch('http://127.0.0.1:'+debug+'/json')).json();break;}catch{await sleep(100);}}ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));ws.addEventListener('message',e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}});await send('Network.enable');await send('Page.navigate',{url:`http://127.0.0.1:${port}/cards/`});await check();await ev("navigator.serviceWorker.register('./sw.js',{scope:'/cards/'}).then(()=>navigator.serviceWorker.ready).then(()=>true)");await until('!!navigator.serviceWorker.controller');await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});await send('Page.reload',{ignoreCache:true});await check();console.log('PASS: Texto 01 antigo, botao coletivo, gehe; gehen, fechar e offline.  formato antigo/opcional, abrir/recolher, seis pessoas, referências, contexto, ausência e möchte sem inferência; reload e consulta offline com SW real.');})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(ws){await send('Browser.close').catch(()=>{});ws.close();}if(chrome)chrome.kill();server.close();});

