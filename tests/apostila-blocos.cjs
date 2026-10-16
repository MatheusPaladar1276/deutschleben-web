// Chrome isolado, Auth REST simulado e Firestore emulador. Sem produção.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=fs.mkdtempSync(path.join(os.tmpdir(),'dl-apostila-blocos-'));
const UID='WuXcMYo6m3OuQttlk7z22gRjlvn1', PORT=8776, DEBUG=9356;
const {createRequire}=require('node:module'), deps=createRequire(path.join(os.tmpdir(),'mapc-coleta-web-envio-tests/package.json'));
const {initializeTestEnvironment}=deps('@firebase/rules-unit-testing'),sdk=deps('firebase/firestore');sdk.setLogLevel('silent');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let chrome,ws,env,n=0;const pending=new Map();
function jwt(uid){const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');const now=Math.floor(Date.now()/1000);return enc({alg:'none',typ:'JWT'})+'.'+enc({iss:'https://securetoken.google.com/demo-dl-textos',aud:'demo-dl-textos',auth_time:now,user_id:uid,sub:uid,iat:now,exp:now+3600,firebase:{sign_in_provider:'custom'}})+'.';}
let legacy=false, pacoteFalha=false, aceitarConfirmacao=true;const confirmacoes=[];
const previous=new Map();
const modelo=JSON.parse(fs.readFileSync(path.join(root,'webapp/cards/texto-01.json'),'utf8'));

const server=http.createServer(async(req,res)=>{
 if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','*');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.writeHead(204);res.end();return;}
 res.setHeader('Access-Control-Allow-Origin','*');
 if(req.method==='POST')console.log('Auth local: '+req.url.split('?')[0]);
 if(req.method==='POST'&&req.url.includes('accounts:signInWithCustomToken')){let body='';for await(const c of req)body+=c;const uid=JSON.parse(body).token;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({idToken:jwt(uid),refreshToken:'fixture-refresh-'+uid,expiresIn:'3600',isNewUser:false}));return;}
 if(req.method==='POST'&&req.url.includes('accounts:lookup')){let body='';for await(const c of req)body+=c;const token=JSON.parse(body).idToken;const uid=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()).sub;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({users:[{localId:uid,email:uid+'@example.test',emailVerified:true,providerUserInfo:[],createdAt:String(Date.now()),lastLoginAt:String(Date.now())}]}));return;}
 const u=new URL(req.url,'http://local');let relative=decodeURIComponent(u.pathname).replace(/^\//,'');if(relative.endsWith('/'))relative+='index.html';if(!relative)relative='index.html';const f=path.resolve(root,'webapp',relative);if(!f.startsWith(path.resolve(root,'webapp')+path.sep)){res.writeHead(403);res.end();return;}
 if(relative==='cards/texto-01.json' && pacoteFalha){res.writeHead(503);res.end('falha local simulada');return;}
 try{let b=legacy && previous.has(relative)?previous.get(relative):fs.readFileSync(f);if(relative==='cards/dados.js'){
   b=b.toString().replace('onAuthStateChanged }','onAuthStateChanged, connectAuthEmulator, signInWithCustomToken }').replace('deleteDoc }','deleteDoc, connectFirestoreEmulator }').replace("projectId:'ricardo-d6119'","projectId:'demo-dl-textos'");
   b=b.replace('const auth=getAuth(app), db=getFirestore(app);',`const auth=getAuth(app), db=getFirestore(app); connectAuthEmulator(auth,'http://127.0.0.1:${PORT}',{disableWarnings:true});connectFirestoreEmulator(db,'127.0.0.1',8188);window.DL_TEST={signIn:u=>signInWithCustomToken(auth,u).then(()=>true)};`);
   b=b.replace('export const entrar=()=>signInWithPopup(auth,new GoogleAuthProvider());',`export const entrar=()=>signInWithCustomToken(auth,'${UID}');`);
 }
 if(relative==='cards/dados.js'){b=b.toString().replace('export async function salvar(id,u,c){',`export async function salvar(id,u,c){if(window.DL_TEST.falharSalvar)await runTransaction(db,tx=>{tx.set(doc(db,'textos',id,'cards','invalido'),{teste:true});});if(window.DL_TEST.atrasarSalvar)await new Promise(ok=>window.DL_TEST.liberarSalvar=ok);`).replace('export async function carregar(id,u){',`export async function carregar(id,u){if(window.DL_TEST.falharCarregar)throw Error('Leitura local simulada indispon?vel.');if(window.DL_TEST.atrasarCarregar)await new Promise(ok=>window.DL_TEST.liberarCarregar=ok);`);}
 if(relative==='firebase-dados.js'){
  b=b.toString().replace('onAuthStateChanged }','onAuthStateChanged, connectAuthEmulator, signInWithCustomToken }').replace('runTransaction }','runTransaction, connectFirestoreEmulator }').replace(/ricardo-d6119/g,'demo-dl-textos');
  b=b.replace('db = getFirestore(app);',"db = getFirestore(app);connectFirestoreEmulator(db,'127.0.0.1',8188);");
  b=b.replace('if (app) auth = getAuth(app);',`if(app){auth=getAuth(app);connectAuthEmulator(auth,'http://127.0.0.1:${PORT}',{disableWarnings:true});window.DL_TEST={signIn:u=>signInWithCustomToken(auth,u).then(()=>true)};}`);
  b=b.replace("const c=await getDocFromServer(doc(db,'textos',t.id,'cards',uid));","if(window.DL_TEST.falharCard===t.id)throw Error('falha simulada');const c=await getDocFromServer(doc(db,'textos',t.id,'cards',uid));");
 }
 if(relative==='data/blocos.json'){const arr=JSON.parse(b);arr.push({bloco:modelo.secoes.blocos[0].de,sentido:modelo.secoes.blocos[0].pt,tipo:'expressao temporal',origem:'Acervo coincidente'});b=JSON.stringify(arr);}
 const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png'};res.setHeader('Content-Type',mime[path.extname(f)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(b);
 }catch{res.writeHead(404);res.end();}
});
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++n;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
async function until(expression){for(let i=0;i<100;i++){if(await evaluate(expression))return;await sleep(100);}throw Error('Tempo esgotado: '+expression+'\n'+await evaluate('document.body.innerText'));}
async function start(){chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port='+DEBUG,'--user-data-dir='+path.join(out,'profile'),'about:blank'],{windowsHide:true,stdio:'ignore'});let tabs;for(let i=0;i<60;i++){try{tabs=await(await fetch('http://127.0.0.1:'+DEBUG+'/json')).json();if(tabs.some(t=>t.type==='page'))break;}catch{}await sleep(200);}ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));ws.addEventListener('message',e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}});ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Page.javascriptDialogOpening'){confirmacoes.push(m.params.message);send('Page.handleJavaScriptDialog',{accept:aceitarConfirmacao}).catch(()=>{});}});await send('Page.enable');await send('Network.enable');await send('Network.setBlockedURLs',{urls:['https://identitytoolkit.googleapis.com/*','https://securetoken.googleapis.com/*','https://firestore.googleapis.com/*','https://www.gstatic.com/*','https://ricardo-d6119*/*']});}
async function stop(){try{await send('Browser.close');}catch{}ws.close();await sleep(600);}
const click=async id=>{await until(`!document.getElementById(${JSON.stringify(id)}).disabled`);return evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);};
const value=(id,v)=>evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(v)};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
async function escolher(id){await value('texto',id);await evaluate(`document.getElementById('texto').dispatchEvent(new Event('change'))`);await until(`!document.getElementById('validar').disabled`);}
async function texto(id){await until(`!document.querySelector('#lista [data-texto-id="${id}"]')?.disabled`);await evaluate(`document.querySelector('#lista [data-texto-id="${id}"]').click()`);await until(`!document.getElementById('estudo').hidden && !document.getElementById('disponibilizar').disabled`);}
async function secao(id,dest='card'){await evaluate(`document.querySelector('#${dest} [data-secao="${id}"]').click()`);}
async function escape(){await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});}
async function verificar(){await click('validar');await until(`!document.getElementById('salvar').hidden && !document.getElementById('salvar').disabled`);}
async function snapshot(nome){const s=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,nome+'.png'),Buffer.from(s.data,'base64'));}
async function main(){
 await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
 env=await initializeTestEnvironment({projectId:'demo-dl-textos',firestore:{host:'127.0.0.1',port:8188,rules:fs.readFileSync(path.join(root,'firestore.rules'),'utf8')}});await env.clearFirestore();
 const F=require('../webapp/cards/formato.js'),old=structuredClone(modelo);for(const b of old.secoes.blocos)delete b.outroExemplo;F.validar(old);F.validar(modelo);
 for(const value of [null,{de:'x'},{de:'x',pt:'y',extra:'z'},'x']){const bad=structuredClone(old);bad.secoes.blocos[0].outroExemplo=value;assert.throws(()=>F.validar(bad));}
 const other=structuredClone(old);other.numero=2;other.titulo='Outra origem';other.secoes.blocos=[{...old.secoes.blocos[0],de:' AM  FR\u00dcHEN MORGEN ',pt:'  BEM CEDO, PELA MANH\u00c3 ',origem:'Am fr\u00fchen Morgen lese ich.',outroExemplo:{de:'Am fr\u00fchen Morgen laufe ich.',pt:'Bem cedo, corro.'}},{...old.secoes.blocos[0],pt:'outro sentido',origem:'Am fr\u00fchen Morgen lese ich.'}];
 const original=c=>[...new Set(Object.values(c.secoes).flat().map(i=>i.origem).filter(Boolean))].join('\n');
 await env.withSecurityRulesDisabled(async ctx=>{for(const [id,c] of [['texto-01',old],['texto-02',other]]){const db=ctx.firestore();await sdk.setDoc(sdk.doc(db,'textos',id),{titulo:c.titulo,conteudo:original(c),estado:'recebido',criadoEm:sdk.Timestamp.now()});await sdk.setDoc(sdk.doc(db,'textos',id,'cards',UID),{uid:UID,textoId:id,versao:1,conteudo:JSON.stringify(c),criadoEm:sdk.Timestamp.now(),atualizadoEm:sdk.Timestamp.now()});}});
 try{
  await start();await send('Page.navigate',{url:`http://127.0.0.1:${PORT}/`});await until('!!window.DL_TEST && window.DL_AUTH?.pronta');await evaluate(`window.DL_TEST.signIn('${UID}')`);await until(`window.DL_AUTH?.usuario?.uid==='${UID}'`);
  // Teste de normalizacao e separacao de sentidos com o modulo real.
  const unit=await evaluate(`import('./blocos.js').then(m=>{const a=m.agruparBlocos([{grupo:'bloco',termo:' A  B ',sentido:'C',origem:'um',contexto:'frase1'},{grupo:'bloco',termo:'a b',sentido:' c ',origem:'dois',contexto:'frase2'},{grupo:'bloco',termo:'a b',sentido:'outro',origem:'tres'}]);return {n:a.length,ocorrencias:a.find(x=>x.ocorrencias.length===2)?.ocorrencias.length};})`);assert.deepEqual(unit,{n:2,ocorrencias:2});
  assert.equal(await evaluate(`import('./cards/offline.js').then(m=>m.listarLocal('${UID}')).then(x=>x.length)`),0);
  await evaluate('abrirEstrada()');await until(`document.querySelector('#estrada-lista').textContent.includes('Outra origem') && !document.querySelector('#apostila-status').textContent`);
  await evaluate(`document.querySelector('.estrada-filtro[data-grupo=bloco]').click()`);
  const group=await evaluate(`(()=>{const rows=[...document.querySelectorAll('.estrada-item')];const match=rows.filter(x=>x.querySelector('.estrada-sentido').textContent.trim().toLowerCase()==='bem cedo, pela manh\u00e3');return {n:match.length,text:match[0]?.textContent,details:match[0]?.querySelector('details')?.open};})()`);
  assert.equal(group.n,1);assert(group.text.includes('Acervo coincidente')&&group.text.includes('Card 01')&&group.text.includes('Card 02')&&group.text.includes('gehe ich zum See.')&&group.text.includes('lese ich.')&&group.text.includes('trinke ich einen Tee.')&&group.text.includes('laufe ich.'));assert.equal(group.details,false);
  assert(await evaluate(`document.querySelector('#estrada-lista').textContent.includes('outro sentido')`));
  assert.equal(await evaluate(`document.querySelectorAll('#estrada-lista details').length`),5);
  await evaluate(`document.querySelector('#estrada-lista details summary').click()`);assert(await evaluate(`document.querySelector('#estrada-lista details').open`));
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));await evaluate("[...document.querySelectorAll('.estrada-item')].find(x=>x.textContent.includes('Card 01')).scrollIntoView()");await snapshot('apostila-mobile');await send('Emulation.clearDeviceMetricsOverride');
  const respected=await evaluate(`import('./blocos.js').then(m=>{const c=${JSON.stringify(modelo)};c.secoes.blocos[0].outroExemplo={de:'Mein Beispiel.',pt:'Meu exemplo.'};return m.completarExemplos(c,${JSON.stringify(modelo)}).secoes.blocos[0].outroExemplo.de;})`);assert.equal(respected,'Mein Beispiel.');
  // Uma unica copia local: o segundo card deve continuar disponivel online.
  const registro={uid:UID,textoId:'texto-01',titulo:old.titulo,original:original(old),card:old};
  await evaluate(`import('./cards/offline.js').then(m=>m.guardarLocal(${JSON.stringify(registro)})).then(()=>true)`);
  await evaluate(`window.DL_TEST.falharCard='texto-02';abrirEstrada()`);await until(`document.querySelector('#apostila-status').textContent.includes('Alguns Cards')`);assert(!await evaluate(`document.querySelector('#estrada-lista').textContent.includes('Outra origem')`));
  await evaluate(`window.DL_TEST.falharCard=null;abrirEstrada()`);await until(`document.querySelector('#estrada-lista').textContent.includes('Outra origem')`);
  // Troca de conta: remove blocos pessoais mesmo com a Apostila aberta.
  await evaluate(`window.DL_TEST.signIn('outra-conta')`);await until(`window.DL_AUTH?.usuario?.uid==='outra-conta' && !document.querySelector('#estrada-lista').textContent.includes('Card 01')`);
  await evaluate(`window.DL_TEST.signIn('${UID}')`);await until(`document.querySelector('#estrada-lista').textContent.includes('Card 01')`);
  await until(`!!navigator.serviceWorker.controller`);await evaluate(`navigator.serviceWorker.ready.then(()=>true)`);
  // Cards reais: prepara em leitura o card antigo sem gravar a alteracao remota.
  await send('Page.navigate',{url:`http://127.0.0.1:${PORT}/cards/`});await until(`document.querySelectorAll('#lista button').length===2`);await evaluate(`document.querySelector('#lista [data-texto-id="texto-01"]').click()`);await until(`!document.getElementById('estudo').hidden`);await secao('blocos');
  assert.equal(await evaluate(`document.querySelectorAll('#card .outro-exemplo').length`),5);assert(await evaluate(`[...document.querySelectorAll('#card .outro-exemplo')].every(x=>!x.open)`));await evaluate(`document.querySelector('#card .outro-exemplo summary').click()`);assert(await evaluate(`document.querySelector('#card .outro-exemplo').open`));
  await evaluate(`navigator.serviceWorker.ready.then(()=>true)`);await until('!!navigator.serviceWorker.controller');
  // Reinicia o navegador e bloqueia a rede; nenhuma exigencia de cache completo.
  await stop();await start();await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});await send('Page.navigate',{url:`http://127.0.0.1:${PORT}/`});await until(`window.DL_AUTH?.usuario?.uid==='${UID}' && typeof abrirEstrada==='function'`);await evaluate('abrirEstrada()');await until(`document.querySelector('#apostila-status').textContent.includes('Sem internet') && document.querySelector('#estrada-lista').textContent.includes('Card 01')`);assert(!await evaluate(`document.querySelector('#estrada-lista').textContent.includes('Card 02')`));assert.equal(await evaluate(`document.querySelectorAll('#estrada-lista details').length`),5);
  await send('Page.navigate',{url:`http://127.0.0.1:${PORT}/cards/`});await until(`document.querySelectorAll('#lista button').length===1`);await evaluate(`document.querySelector('#lista button').click()`);await until(`!document.getElementById('estudo').hidden`);await secao('blocos');assert.equal(await evaluate(`document.querySelectorAll('#card .outro-exemplo').length`),5);
  await env.withSecurityRulesDisabled(async ctx=>{const d=await sdk.getDoc(sdk.doc(ctx.firestore(),'textos','texto-01','cards',UID));assert.equal(d.data().conteudo,JSON.stringify(old));});
  const wrong=env.authenticatedContext('outra-conta').firestore();await assert.rejects(sdk.getDoc(sdk.doc(wrong,'textos','texto-01','cards',UID)));const own=env.authenticatedContext(UID).firestore();await sdk.getDoc(sdk.doc(own,'textos','texto-01','cards',UID));await assert.rejects(sdk.getDocs(sdk.collection(own,'textos','texto-01','cards')));
  console.log('Evidencias: '+out);console.log('PASS: acervo + Cards sem cache previo; agrupamento por bloco/sentido, todas as origens/contextos, cinco exemplos recolhidos, falha parcial, troca de conta, regras intactas, nenhum write de integracao, novo processo offline com somente 1 de 2 Cards, Cards antigos enriquecidos em leitura.');
 }finally{if(ws)await stop();await env.cleanup();server.close();}
}
main().catch(e=>{console.error(e);server.close();if(chrome)chrome.kill();process.exitCode=1;});
