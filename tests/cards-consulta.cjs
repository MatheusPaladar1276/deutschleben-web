// Chrome isolado, Auth REST simulado e Firestore emulador. Sem produção.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=fs.mkdtempSync(path.join(os.tmpdir(),'dl-cards-consulta-'));
const UID='WuXcMYo6m3OuQttlk7z22gRjlvn1', PORT=8767, DEBUG=9342;
const {createRequire}=require('node:module'), deps=createRequire(path.join(os.tmpdir(),'dl-textos-tests/package.json'));
const {initializeTestEnvironment}=deps('@firebase/rules-unit-testing'),sdk=deps('firebase/firestore');sdk.setLogLevel('silent');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let chrome,ws,env,n=0;const pending=new Map();
function jwt(uid){const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');const now=Math.floor(Date.now()/1000);return enc({alg:'none',typ:'JWT'})+'.'+enc({iss:'https://securetoken.google.com/demo-dl-textos',aud:'demo-dl-textos',auth_time:now,user_id:uid,sub:uid,iat:now,exp:now+3600,firebase:{sign_in_provider:'custom'}})+'.';}
let legacy=true, pacoteFalha=false;
const previous=new Map(['index.html','cards.js','cards.css','sw.js'].map(f=>['cards/'+f,require('node:child_process').execFileSync('git',['show','bc7721520d6e7fdc10707c45fd2652a3e542888b:webapp/cards/'+f],{cwd:root})]));
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
 const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png'};res.setHeader('Content-Type',mime[path.extname(f)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(b);
 }catch{res.writeHead(404);res.end();}
});
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++n;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
async function until(expression){for(let i=0;i<100;i++){if(await evaluate(expression))return;await sleep(100);}throw Error('Tempo esgotado: '+expression+'\n'+await evaluate('document.body.innerText'));}
async function start(){chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port='+DEBUG,'--user-data-dir='+path.join(out,'profile'),'about:blank'],{windowsHide:true,stdio:'ignore'});let tabs;for(let i=0;i<60;i++){try{tabs=await(await fetch('http://127.0.0.1:'+DEBUG+'/json')).json();if(tabs.some(t=>t.type==='page'))break;}catch{}await sleep(200);}ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));ws.addEventListener('message',e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}});await send('Page.enable');await send('Network.enable');await send('Network.setBlockedURLs',{urls:['https://identitytoolkit.googleapis.com/*','https://securetoken.googleapis.com/*','https://firestore.googleapis.com/*','https://www.gstatic.com/*','https://ricardo-d6119*/*']});}
async function stop(){try{await send('Browser.close');}catch{}ws.close();await sleep(600);}
const click=async id=>{await until(`!document.getElementById(${JSON.stringify(id)}).disabled`);return evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);};
const value=(id,v)=>evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(v)};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
const secao=async(dest,s)=>{await until(`!document.querySelector('#${dest} [data-secao="${s}"]').disabled`);await evaluate(`document.querySelector('#${dest} [data-secao="${s}"]').click()`);};
const secoes=dest=>evaluate(`[...document.querySelectorAll('#${dest} [data-secao]')].map(e=>e.dataset.secao)`);
const cardRef=db=>sdk.doc(db,'textos','texto-01','cards',UID);
async function main(){
 await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
 env=await initializeTestEnvironment({projectId:'demo-dl-textos',firestore:{host:'127.0.0.1',port:8188,rules:fs.readFileSync(path.join(root,'firestore.rules'),'utf8')}});
 await env.clearFirestore();
 const c=JSON.parse(fs.readFileSync(path.join(root,'webapp/cards/texto-01.json'),'utf8'));
 const original=[...new Set(Object.values(c.secoes).flat().map(i=>i.origem).filter(Boolean))].join('\n');
 await env.withSecurityRulesDisabled(async ctx=>{const db=ctx.firestore();await sdk.setDoc(sdk.doc(db,'textos','texto-01'),{titulo:c.titulo,conteudo:original,estado:'recebido',criadoEm:sdk.Timestamp.now()});await sdk.setDoc(cardRef(db),{uid:UID,textoId:'texto-01',versao:1,conteudo:JSON.stringify(c),criadoEm:sdk.Timestamp.now(),atualizadoEm:sdk.Timestamp.now()});});
 async function salvo(){let result;await env.withSecurityRulesDisabled(async ctx=>{result=(await sdk.getDoc(cardRef(ctx.firestore()))).data();});return result;}
 async function disponivel(){await until(`document.getElementById('local').textContent.includes('disponíveis')`);}
 async function consultar(dest){
   assert.deepEqual(await secoes(dest),['duvidas','blocos']);
   assert.equal(await evaluate(`document.querySelectorAll('#${dest} .secao-caixa').length`),1);
   assert.equal(await evaluate(`document.querySelectorAll('#${dest} .linha').length`),3);
   assert(await evaluate(`[...document.querySelectorAll('#${dest} details')].every(e=>!e.open)`));
   await evaluate(`document.querySelector('#${dest} .contexto').open=true`);
   assert((await evaluate(`document.querySelector('#${dest} .contexto p').textContent`)).includes('Er sitzt'));
   await secao(dest,'blocos');assert.equal(await evaluate(`document.querySelectorAll('#${dest} .linha').length`),5);
   const modo=dest==='card'?'modo':'modo-preview', portugues=dest==='card'?'portugues':'portugues-preview';
   await click(modo);assert.deepEqual(await secoes(dest),['duvidas','blocos','sentencas','substantivos','verbos','adjetivos','adverbios']);
   assert.equal(await evaluate(`document.querySelector('#${dest} [aria-pressed="true"]').dataset.secao`),'blocos');
   await secao(dest,'sentencas');assert.equal(await evaluate(`document.querySelectorAll('#${dest} .linha').length`),3);assert.equal(await evaluate(`document.querySelectorAll('#${dest} details').length`),0);
   for(const [s,total] of [['substantivos',11],['verbos',13],['adjetivos',4],['adverbios',5]]){await secao(dest,s);assert.equal(await evaluate(`document.querySelectorAll('#${dest} .linha').length`),total);}
   await click(modo);assert.deepEqual(await secoes(dest),['duvidas','blocos']);assert.equal(await evaluate(`document.querySelector('#${dest} [aria-pressed="true"]').dataset.secao`),'duvidas');
   await click(portugues);assert(await evaluate(`[...document.querySelectorAll('#${dest} .pt')].every(e=>getComputedStyle(e).display==='none')`));
   assert(!await evaluate(`document.getElementById('${dest}').innerText.includes('Weile = algum tempo')`));
   await click(portugues);assert((await evaluate(`document.getElementById('${dest}').innerText`)).includes('Weile = algum tempo'));
 }
 try{
   // Uma cópia pessoal e o shell reais da versão anterior, no perfil temporário.
   await start();await send('Page.navigate',{url:`http://127.0.0.1:${PORT}/cards/`});await until(`!!window.DL_TEST && !document.getElementById('auth').disabled`);await click('auth');await until(`document.querySelectorAll('#lista button').length===1`);await evaluate(`document.querySelector('#lista button').click()`);await until(`document.querySelectorAll('#card .item').length===8`);await click('disponibilizar');await until(`document.getElementById('status').textContent.includes('Armazenamento concluído')`);const copia=await evaluate(`import('./offline.js').then(m=>m.listarLocal('${UID}')).then(x=>JSON.stringify(x))`);await stop();
   // Abertura online da nova versão atualiza só o shell, sem redisponibilizar conteúdo.
   legacy=false;await start();await send('Page.navigate',{url:`http://127.0.0.1:${PORT}/cards/`});await until(`!!document.getElementById('carregar-pacote') && document.querySelectorAll('#lista button').length===1`);
   await until(`navigator.serviceWorker.getRegistration('/cards/').then(r=>new Promise(ok=>{if(!r?.active)return ok(false);const c=new MessageChannel();c.port1.onmessage=e=>ok(e.data?.pronto && e.data.versao==='consulta-2');r.active.postMessage('verificar-shell',[c.port2]);}))`);
   assert.equal(await evaluate(`import('./offline.js').then(m=>m.listarLocal('${UID}')).then(x=>JSON.stringify(x))`),copia);
   // Falha recuperável e carga direta, sem associar o original por título.
   pacoteFalha=true;await click('carregar-pacote');await until(`document.getElementById('status').textContent.includes('Não foi possível carregar o Texto 01')`);assert(await evaluate(`document.getElementById('salvar').hidden`));
   pacoteFalha=false;await click('carregar-pacote');await until(`document.getElementById('status').textContent.includes('Texto 01 carregado')`);assert.equal(await evaluate(`document.getElementById('texto').value`),'');assert.deepEqual(JSON.parse(await evaluate(`document.getElementById('conteudo').value`)),c);
   await click('validar');await until(`document.getElementById('status').textContent.includes('Escolha e confirme')`);assert(await evaluate(`document.getElementById('salvar').hidden`));
   await value('texto','texto-01');await evaluate(`document.getElementById('texto').dispatchEvent(new Event('change'))`);await until(`document.getElementById('conferir').textContent.includes('Am frühen Morgen')`);
   await click('validar');await until(`!document.getElementById('salvar').hidden`);await consultar('preview');
   assert.equal((await salvo()).conteudo,JSON.stringify(c),'Conferir não salva');
   const positions=await evaluate(`(()=>{const p=document.getElementById('preview');return ['validar','salvar','cancelar'].every(id=>document.getElementById(id).compareDocumentPosition(p)&Node.DOCUMENT_POSITION_FOLLOWING);})()`);assert(positions);
   // Editar e voltar ao conteúdo anterior não reativa uma prévia invalidada.
   await value('conteudo','{');assert(await evaluate(`document.getElementById('salvar').hidden && !document.getElementById('preview').textContent`));await click('validar');await until(`document.getElementById('status').textContent.includes('JSON inválido')`);
   const revisao=structuredClone(c);revisao.secoes.adverbios=[];revisao.secoes.sentencas[0].pt+=' Nota explicativa de tradução.';
   await value('conteudo',JSON.stringify(revisao));await click('validar');await until(`!document.getElementById('salvar').hidden`);await click('modo-preview');assert(!(await secoes('preview')).includes('adverbios'));
   await secao('preview','sentencas');await click('portugues-preview');assert(!await evaluate(`document.getElementById('preview').innerText.includes('Nota explicativa')`));
   await value('texto','');await evaluate(`document.getElementById('texto').dispatchEvent(new Event('change'))`);assert(await evaluate(`document.getElementById('salvar').hidden && !document.getElementById('preview').textContent`));
   await value('texto','texto-01');await click('validar');await until(`!document.getElementById('salvar').hidden`);await click('cancelar');assert(await evaluate(`document.getElementById('editor').hidden`));assert.equal((await salvo()).conteudo,JSON.stringify(c),'Cancelar não salva');
   // Colagem do chat, mesma renderização e salvamento explícito no emulador.
   await click('importar');await value('texto','texto-01');await value('conteudo',JSON.stringify(c));await click('validar');await until(`!document.getElementById('salvar').hidden`);const criado=(await salvo()).criadoEm.toMillis();await click('salvar');await until(`document.getElementById('status').textContent.includes('Card salvo')`);assert.equal((await salvo()).criadoEm.toMillis(),criado);await consultar('card');
   // Layout da consulta e da prévia: fontes preservadas e sem cortes.
   await click('importar');await value('texto','texto-01');await value('conteudo',JSON.stringify(c));await click('validar');await until(`!document.getElementById('salvar').hidden`);
   for(const [w,h] of [[390,844],[768,1024]]){
     await send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:true});
     for(const dest of ['preview','card']){
       await secao(dest,'blocos');await evaluate(`document.getElementById('${dest}').scrollIntoView()`);
       const report=await evaluate(`(()=>{const box=document.getElementById('${dest}');const r=[...box.querySelectorAll('.de,.pt:not(.seta)')].filter(e=>e.getClientRects().length);return {overflow:document.documentElement.scrollWidth>innerWidth,fonts:r.every(e=>getComputedStyle(e).fontSize==='22px'),inside:r.every(e=>{const b=e.getBoundingClientRect();return b.left>=0&&b.right<=innerWidth;}),stack:getComputedStyle(box.querySelector('.par')).gridTemplateColumns.split(' ').length};})()`);
       assert(!report.overflow,JSON.stringify(report));assert(report.fonts&&report.inside,JSON.stringify(report));assert.equal(report.stack,w===390?1:3);
       const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,`${dest}-${w}.png`),Buffer.from(shot.data,'base64'));
     }
   }
   await click('cancelar');await click('disponibilizar');await until(`document.getElementById('status').textContent.includes('Armazenamento concluído')`);await stop();
   // Novo processo sem rede: a consulta atualizada e seus controles estão no shell.
   await start();await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});await send('Page.navigate',{url:`http://127.0.0.1:${PORT}/cards/`});await until(`document.querySelectorAll('#lista button').length===1`);await evaluate(`document.querySelector('#lista button').click()`);await until(`document.querySelectorAll('#card .linha').length===3`);await disponivel();await consultar('card');assert.equal(await evaluate(`document.getElementById('original').textContent`),original);
   console.log('PASS consulta/importação: atualização do shell anterior sem alterar cópia pessoal; carga direta/falha/nova tentativa; escolha manual; colagem/validação/invalidação/cancelamento/salvamento explícito no emulador; seções/modos/contexto/PT na prévia e consulta; 390/768 px com fontes 22 px sem cortes; consulta após reiniciar Chrome offline. Evidências: '+out);
 }finally{if(ws)await stop();await env.cleanup();server.close();}
}
main().catch(e=>{console.error(e);server.close();if(chrome)chrome.kill();process.exitCode=1;});
