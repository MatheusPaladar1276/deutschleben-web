// Executa o Web de produção com autenticação/dados sintéticos só no servidor de teste.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const web=path.resolve(__dirname,'..','webapp'),port=8799,debug=9459;
const out=fs.mkdtempSync(path.join(os.tmpdir(),'dl-estudo-web-'));
const frase='Am frühen Morgen gehe ich zum See',texto={id:'teste-estudo',titulo:'Estudo isolado',conteudo:frase+'. Über dem Wasser liegt leichter Nebel.'};
const uid='WuXcMYo6m3OuQttlk7z22gRjlvn1';
const fixture=`window.DL_AUTH={pronta:true,usuario:{uid:'${uid}'}};const texto=${JSON.stringify(texto)},resumos=new Map();window.DL_DADOS={listarTextos:async()=>[texto],carregarTexto:async()=>texto,carregarResumo:async id=>resumos.get(id)||'',listarResumos:async()=>[...resumos].map(([id,conteudo])=>({...texto,id,conteudo})),salvarResumo:async(id,uid,conteudo)=>{resumos.set(id,conteudo);},carregarCaminhadas:async()=>null};window.dispatchEvent(new Event('dl-auth-alterado'));`;
const server=http.createServer((req,res)=>{
  const nome=decodeURIComponent(new URL(req.url,'http://local').pathname),rel=nome.endsWith('/')?nome+'index.html':nome;
  const file=path.resolve(web,'.'+rel);
  if(!file.startsWith(web+path.sep)){res.writeHead(403);res.end();return;}
  if(!fs.existsSync(file)){res.writeHead(404);res.end('Recurso inexistente');return;}
  const body=rel==='/firebase-dados.js'?fixture:rel==='/memorizar/entrada.js'?'':fs.readFileSync(file);
  res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8'})[path.extname(file)]||'application/octet-stream');
  res.setHeader('Cache-Control','no-store');res.end(body);
});
let chrome,ws,id=0;const pendentes=new Map(),erros=[],sleep=ms=>new Promise(r=>setTimeout(r,ms));
function send(method,params={}){return new Promise((resolve,reject)=>{const n=++id;pendentes.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});}
async function ev(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
async function until(expression){for(let i=0;i<150;i++){if(await ev(expression))return;await sleep(100);}throw Error('Tempo esgotado: '+expression);}
const click=selector=>ev(`document.querySelector(${JSON.stringify(selector)}).click()`);
async function main(){
  await new Promise(r=>server.listen(port,'127.0.0.1',r));
  chrome=spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port='+debug,'--user-data-dir='+path.join(out,'profile'),'about:blank'],{stdio:'ignore',windowsHide:true});
  let tabs;
  for(let i=0;i<100;i++){try{tabs=await(await fetch('http://127.0.0.1:'+debug+'/json')).json();if(tabs.some(t=>t.type==='page'))break;}catch(e){if(i===99)throw e;}await sleep(100);}
  ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise(r=>ws.addEventListener('open',r,{once:true}));
  ws.addEventListener('message',e=>{const m=JSON.parse(e.data),p=pendentes.get(m.id);if(p){pendentes.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')erros.push(m.params.exceptionDetails.text);});
  await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
  await send('Network.setBlockedURLs',{urls:['https://*/*']});
  await send('Page.navigate',{url:'http://127.0.0.1:'+port+'/'});
  await until(`!!window.DL_REFERENCIA&&!!document.querySelector('#escolha-lista .escolha-abrir')`);
  await click('#escolher-textos');await click('#escolha-lista .escolha-abrir');
  await until(`document.getElementById('original-texto').textContent===${JSON.stringify(texto.conteudo)}`);
  assert(await ev(`['.compreensao','.consulta-sda'].every(s=>{const n=document.querySelector('#fase-textos '+s);return n.hidden&&n.inert&&!n.getClientRects().length;})`));
  await ev(`(()=>{const n=document.getElementById('original-texto').firstChild,r=document.createRange();r.setStart(n,0);r.setEnd(n,${frase.length});getSelection().removeAllRanges();getSelection().addRange(r);document.dispatchEvent(new Event('selectionchange'));})()`);
  await click('#nav-referencia');await until(`!!document.querySelector('#rg-modulo option[value="04"]')`);
  await ev(`document.getElementById('rg-modulo').value='04';document.getElementById('rg-modulo').dispatchEvent(new Event('change'))`);
  assert.equal(await ev(`document.getElementById('rg-busca').value`),'');
  assert.equal(await ev(`document.getElementById('rg-contexto').textContent`),'Trecho: '+frase);
  assert(await ev(`document.getElementById('rg-lista').firstChild.id==='rg-quadro-preposicoes'&&!document.getElementById('rg-quadro-preposicoes').open`));
  const medidas=[];
  for(const width of [1280,390,320]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<500});
    const r=await ev(`(()=>{const p=document.querySelector('#rg-contexto p'),s=document.querySelector('#rg-quadro-preposicoes summary'),q=document.getElementById('rg-quadro-preposicoes'),o=document.getElementById('rg-overlay'),a=s.getBoundingClientRect(),b=o.getBoundingClientRect();return {viewport:innerWidth,fonte:getComputedStyle(p).fontSize,linha:getComputedStyle(p).whiteSpace,botao:a.width,bloco:q.getBoundingClientRect().width,contido:a.left>=b.left&&a.right<=b.right,paginaSemOverflow:document.documentElement.scrollWidth<=innerWidth,padding:getComputedStyle(s).paddingLeft};})()`);
    assert.equal(r.fonte,'18px');assert.equal(r.linha,'nowrap');assert.equal(r.padding,'10px');
    assert(r.contido&&r.paginaSemOverflow,JSON.stringify(r));assert(r.botao<360,JSON.stringify(r));
    await click('#rg-quadro-preposicoes summary');
    assert(await ev(`document.getElementById('rg-quadro-preposicoes').open`));
    assert(await ev(`(()=>{const n=document.querySelector('#rg-quadro-preposicoes .rg-tabela');return getComputedStyle(n).overflowX==='auto'&&document.documentElement.scrollWidth<=innerWidth;})()`));
    const png=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'modulo-04-'+width+'.png'),Buffer.from(png.data,'base64'));
    await click('#rg-quadro-preposicoes summary');assert(!await ev(`document.getElementById('rg-quadro-preposicoes').open`));
    medidas.push(r);
  }
  await ev(`document.getElementById('rg-busca').value='zu';document.getElementById('rg-busca').dispatchEvent(new Event('input'));document.getElementById('rg-modulo').value='10';document.getElementById('rg-modulo').dispatchEvent(new Event('change'))`);
  assert.equal(await ev(`document.getElementById('rg-contexto').textContent`),'Trecho: '+frase);
  assert.equal(await ev(`document.getElementById('rg-busca').value`),'');assert(!await ev(`!!document.getElementById('rg-quadro-preposicoes')`));
  await click('#rg-voltar');
  await click('#resumo-secao summary');
  await ev(`document.getElementById('resumo-conteudo').value='Resumo de teste';document.getElementById('resumo-conteudo').dispatchEvent(new Event('input'))`);
  await click('#salvar-resumo');await until(`document.getElementById('resumo-status').textContent==='✓ Resumo salvo com sucesso'`);
  await click('#nav-progresso');await until(`!!document.querySelector('#memoria-lista .memoria-item')`);
  assert.equal(await ev(`document.querySelector('#memoria-lista .memoria-conteudo').textContent`),'Resumo de teste');
  assert.deepEqual(erros,[]);
  console.log('PASS Web de produção: quadro, trecho/busca, ocultações, resumo/Memória e larguras 1280/390/320. Medidas: '+JSON.stringify(medidas));
  console.log('Capturas: '+out);
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
  if(ws&&ws.readyState===WebSocket.OPEN){await send('Browser.close');ws.close();}
  if(chrome)chrome.kill();
  server.close();
});
