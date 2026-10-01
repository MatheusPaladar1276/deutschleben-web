// Somente emulador local. Reaproveita SDK/jsdom da fase Textos; sem produção.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const assert = require('node:assert/strict'), { createRequire } = require('node:module');
const deps = createRequire(path.join(process.env.DL_TEST_DEPS || path.join(os.tmpdir(), 'dl-textos-tests'), 'package.json'));
const { initializeTestEnvironment, assertSucceeds, assertFails } = deps('@firebase/rules-unit-testing');
const sdk = deps('firebase/firestore'), { JSDOM } = deps('jsdom');
const ROOT = path.resolve(__dirname, '..'), UID = 'WuXcMYo6m3OuQttlk7z22gRjlvn1';
sdk.setLogLevel('silent');
const tick = () => new Promise(r => setTimeout(r, 25));
const wait = async (predicate, label) => {
  const end = Date.now()+15000;
  while (!predicate()) { if (Date.now()>end) throw Error('Timeout: '+label); await tick(); }
};
const text = titulo => ({ titulo, conteudo: 'Mein Name ist Anna. Ich lerne Deutsch.', estado:'recebido', criadoEm:sdk.Timestamp.fromMillis(1) });
const summary = (id, conteudo='Resumo salvo') => ({ uid:UID, textoId:id, conteudo, criadoEm:sdk.Timestamp.fromMillis(1), atualizadoEm:sdk.Timestamp.fromMillis(1) });
async function seed(env,id,conteudo) {
  await env.withSecurityRulesDisabled(async context => {
    const db=context.firestore(); await sdk.setDoc(sdk.doc(db,'textos',id),text(id));
    if(conteudo) await sdk.setDoc(sdk.doc(db,'textos',id,'resumos',UID),summary(id,conteudo));
  });
}
async function stored(env,id) {
  let result;
  await env.withSecurityRulesDisabled(async context => {
    const db=context.firestore();
    result={original:(await sdk.getDocFromServer(sdk.doc(db,'textos',id))).exists(),
      resumo:(await sdk.getDocFromServer(sdk.doc(db,'textos',id,'resumos',UID))).exists()};
  }); return result;
}
async function rules(env) {
  const db=env.authenticatedContext(UID).firestore();
  await seed(env,'pair','Salvo'); await seed(env,'alone'); await seed(env,'blocked','Salvo');
  const original=sdk.doc(db,'textos','pair'), resumo=sdk.doc(db,'textos','pair','resumos',UID);
  await assertFails(sdk.deleteDoc(original)); await assertFails(sdk.deleteDoc(resumo));
  assert.deepEqual(await stored(env,'pair'),{original:true,resumo:true});
  await assertFails(sdk.updateDoc(original,{conteudo:'Original alterado'}));
  const pair=sdk.writeBatch(db); pair.delete(resumo); pair.delete(original); await assertSucceeds(pair.commit());
  assert.deepEqual(await stored(env,'pair'),{original:false,resumo:false});
  await assertSucceeds(sdk.deleteDoc(sdk.doc(db,'textos','alone')));
  assert.deepEqual(await stored(env,'alone'),{original:false,resumo:false});
  // Um item negado faz toda a operação falhar; não há remoção parcial.
  const bad=sdk.writeBatch(db); bad.delete(sdk.doc(db,'textos','blocked'));
  bad.delete(sdk.doc(db,'textos','blocked','resumos','other')); await assertFails(bad.commit());
  assert.deepEqual(await stored(env,'blocked'),{original:true,resumo:true});
  for(const ctx of [env.unauthenticatedContext(),env.authenticatedContext('other')]) {
    const d=ctx.firestore(), batch=sdk.writeBatch(d);
    batch.delete(sdk.doc(d,'textos','blocked','resumos',UID)); batch.delete(sdk.doc(d,'textos','blocked'));
    await assertFails(batch.commit()); await assertFails(sdk.deleteDoc(sdk.doc(d,'textos','blocked')));
    await assertFails(sdk.deleteDoc(sdk.doc(d,'textos','blocked','resumos',UID)));
    await assertFails(sdk.getDocFromServer(sdk.doc(d,'textos','blocked')));
  }
  assert.deepEqual(await stored(env,'blocked'),{original:true,resumo:true});
  await assertFails(sdk.getDocsFromServer(sdk.collection(db,'textos','blocked','resumos')));
  console.log('PASS regras focadas: exclusão atômica com/sem resumo, bloqueio de exclusão parcial, original imutável, anônimo/outro UID negados.');
}
async function ui(env) {
  await env.clearFirestore();
  await seed(env,'alpha','Resumo explícito sobre Anna.'); await seed(env,'beta','Resumo para excluir.'); await seed(env,'empty');
  const dom=new JSDOM(fs.readFileSync(path.join(ROOT,'webapp/index.html'),'utf8'),
    {url:'https://example.test/',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,$=id=>w.document.getElementById(id);
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
  let db=env.authenticatedContext(UID).firestore(); const auth={currentUser:{uid:UID}}, callbacks=[];
  const switchAccount=uid=>{auth.currentUser=uid?{uid}:null;db=(uid?env.authenticatedContext(uid):env.unauthenticatedContext()).firestore();callbacks.forEach(f=>f(auth.currentUser));};
  const bindings={...sdk,initializeApp:()=>({}),getFirestore:()=>db,getAuth:()=>auth,
    GoogleAuthProvider:class{},signInWithPopup:async()=>{},signOut:async()=>switchAccount(null),
    onAuthStateChanged:(_a,f)=>{callbacks.push(f);f(auth.currentUser);}};
  const source=fs.readFileSync(path.join(ROOT,'webapp/firebase-dados.js'),'utf8').replace(/^import .*;\r?$/gm,'');
  new Function('window','Event',...Object.keys(bindings),source)(w,w.Event,...Object.values(bindings));
  w.fetch=async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(ROOT,'webapp',url),'utf8'))});
  for(const s of w.document.scripts)if(!s.src&&s.textContent.trim())w.eval(s.textContent);
  w.eval(fs.readFileSync(path.join(ROOT,'webapp/textos.js'),'utf8'));
  const input=(id,value)=>{$(id).value=value;$(id).dispatchEvent(new w.Event('input'));};
  const choose=async id=>{$('seletor-texto').value=id;$('seletor-texto').dispatchEvent(new w.Event('change'));
    await wait(()=>$('titulo-texto').textContent===id&&!$('salvar-resumo').disabled,'abrir '+id);};
  const row=id=>$('escolha-lista').querySelector('[data-texto-id="'+id+'"]');
  const item=id=>$('memoria-lista').querySelector('[data-texto-id="'+id+'"]');
  const openChoice=async()=>{$('escolher-textos').click();await wait(()=>row('empty'),'lista de escolha');};
  const cancel=dialog=>dialog.dispatchEvent(new w.Event('cancel',{cancelable:true}));
  try {
    await wait(()=>[...$('seletor-texto').options].some(o=>o.value==='alpha'),'lista inicial');
    assert.equal($('nav-estrada').textContent.trim(),'Apostila');
    assert.equal($('nav-progresso').textContent.trim(),'Memória de estudo');
    assert(!$('historico-anterior').open); assert($('historico-anterior').contains($('prog-filtros')));
    w.localStorage.setItem('compreensao_1',JSON.stringify({texto:'Histórico local preservado'}));
    w.abrirProgresso(); await wait(()=>item('alpha')&&item('beta'),'memória Firebase');
    assert(!item('empty')); input('prog-busca','Anna');assert(item('alpha')&&!item('beta'));
    input('prog-busca','beta');assert(item('beta')&&!item('alpha'));input('prog-busca','');
    $('historico-anterior').open=true;await wait(()=>$('prog-exportacao').textContent.includes('—'),'histórico estático');
    assert($('prog-compreensoes-locais').textContent.includes('Histórico local preservado'));
    $('historico-anterior').open=false;
    const originalRead=w.DL_DADOS.carregarTexto;
    w.DL_DADOS.carregarTexto=async()=>{throw Error('Read failure');};
    item('alpha').querySelector('button').click();await wait(()=>$('memoria-status').textContent.includes('Não foi possível retomar'),'falha retomada');
    assert($('estudo-texto').hidden);w.DL_DADOS.carregarTexto=originalRead;
    item('alpha').querySelector('button').click();await wait(()=>$('titulo-texto').textContent==='alpha'&&$('resumo-secao').open,'retomar');
    await wait(()=>$('resumo-conteudo').value.includes('explícito'),'resumo disponível');
    input('minha-pergunta','Minha pergunta temporária');input('texto-compreensao','Minha compreensão temporária');
    const range=w.document.createRange(),node=$('original-texto').firstChild;
    const pos=node.textContent.indexOf('Anna');range.setStart(node,pos);range.setEnd(node,pos+4);
    w.getSelection().removeAllRanges();w.getSelection().addRange(range);w.document.dispatchEvent(new w.Event('selectionchange'));
    let copied='';Object.defineProperty(w.navigator,'clipboard',{configurable:true,value:{writeText:async t=>{copied=t;}}});
    $('consultar-sda').focus();$('consultar-sda').click();await wait(()=>$('consulta-confirmacao').open,'confirmação cópia');
    assert(copied.includes('Minha pergunta temporária'));assert(copied.includes('Trecho:'));
    assert.equal($('copia-status').textContent,'');assert.equal(w.document.activeElement,$('consulta-entendi'));
    await tick();assert($('consulta-confirmacao').open);cancel($('consulta-confirmacao'));
    assert.equal(w.document.activeElement,$('consultar-sda'));assert.equal($('minha-pergunta').value,'Minha pergunta temporária');
    $('consultar-sda').click();await wait(()=>$('consulta-confirmacao').open,'repetir confirmação');$('consulta-entendi').click();
    assert.equal(w.document.activeElement,$('consultar-sda'));
    Object.defineProperty(w.navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('Denied');}}});
    $('consultar-sda').click();await wait(()=>!$('copia-manual').hidden,'alternativa manual');assert(!$('consulta-confirmacao').open);
    w.document.execCommand=()=>false;$('copia-manual-copiar').click();assert(!$('consulta-confirmacao').open);
    w.document.execCommand=()=>true;$('copia-manual-copiar').click();assert($('consulta-confirmacao').open);$('consulta-entendi').click();
    input('resumo-conteudo','Revisão explícita salva.');$('salvar-resumo').click();
    await wait(()=>item('alpha')?.textContent.includes('Revisão explícita salva.'),'memória atualizada sem reload');
    const remote=(await sdk.getDocFromServer(sdk.doc(db,'textos','alpha','resumos',UID))).data();
    assert.equal(remote.conteudo,'Revisão explícita salva.');assert(!('pergunta' in remote)&&!('compreensao' in remote));
    input('resumo-conteudo','Revisão ainda temporária');w.abrirProgresso();await wait(()=>item('alpha'),'memória reaberta');
    assert(!item('alpha').textContent.includes('Revisão ainda temporária'));
    item('alpha').querySelector('button').click();await wait(()=>$('resumo-secao').open&&!$('prog-overlay').classList.contains('aberta'),'retomar rascunho');
    assert.equal($('resumo-conteudo').value,'Revisão ainda temporária');assert(!$('ultimo-resumo-salvo').hidden);
    assert.equal($('resumo-salvo-leitura').textContent,'Revisão explícita salva.');
    await openChoice();input('escolha-busca','beta');assert(row('beta')&&!row('alpha'));
    w.DL_DADOS.carregarTexto=async()=>{throw Error('Choice read failure');};
    row('beta').querySelector('.escolha-abrir').click();
    await wait(()=>$('escolha-status').textContent.includes('Não foi possível abrir'),'falha visível na escolha');
    assert($('escolha-textos').open);assert.equal($('titulo-texto').textContent,'alpha');
    assert.equal($('resumo-conteudo').value,'Revisão ainda temporária');w.DL_DADOS.carregarTexto=originalRead;
    const realDelete=w.DL_DADOS.excluirTexto;let deletes=0;
    w.DL_DADOS.excluirTexto=async(...args)=>{deletes++;return realDelete(...args);};
    row('beta').querySelector('.escolha-excluir').click();assert.equal(w.document.activeElement,$('excluir-cancelar'));
    assert.equal($('excluir-texto-titulo').textContent,'beta');$('excluir-cancelar').click();assert.equal(deletes,0);
    row('beta').querySelector('.escolha-excluir').click();cancel($('excluir-confirmacao'));assert.equal(deletes,0);
    w.DL_DADOS.excluirTexto=async()=>{throw Error('Emulated failure');};
    row('beta').querySelector('.escolha-excluir').click();$('excluir-confirmar').click();
    await wait(()=>$('excluir-status').textContent.includes('Não foi possível'),'falha exclusão');
    assert.deepEqual(await stored(env,'beta'),{original:true,resumo:true});assert($('excluir-confirmacao').open);
    assert.equal($('minha-pergunta').value,'Minha pergunta temporária');$('excluir-cancelar').click();
    w.DL_DADOS.excluirTexto=realDelete;row('beta').querySelector('.escolha-excluir').click();$('excluir-confirmar').click();$('excluir-confirmar').click();
    await wait(()=>!$('excluir-confirmacao').open&&!row('beta'),'exclusão confirmada por ID');
    assert.deepEqual(await stored(env,'beta'),{original:false,resumo:false});assert.equal($('titulo-texto').textContent,'alpha');
    assert.equal($('resumo-conteudo').value,'Revisão ainda temporária');
    input('escolha-busca','');row('empty').querySelector('.escolha-excluir').click();$('excluir-confirmar').click();
    await wait(()=>!$('excluir-confirmacao').open&&!row('empty'),'excluir sem resumo');
    assert.deepEqual(await stored(env,'empty'),{original:false,resumo:false});
    row('alpha').querySelector('.escolha-excluir').click();$('excluir-confirmar').click();
    await wait(()=>!$('excluir-confirmacao').open&&!row('alpha'),'excluir texto aberto');
    assert($('estudo-texto').hidden&&$('escolha-textos').open);assert.equal($('selecao-texto').textContent,'');
    await wait(()=>$('memoria-status').textContent.includes('Nenhum resumo final'),'ausência de resumos');
    assert.equal(JSON.parse(w.localStorage.getItem('compreensao_1')).texto,'Histórico local preservado');
    // Recriar só no emulador comprova que os rascunhos do ID excluído foram removidos.
    await seed(env,'alpha','Outro resumo');$('escolha-voltar').click();$('escolher-textos').click();await wait(()=>row('alpha'),'lista após recriar');
    await choose('alpha');assert.equal($('minha-pergunta').value,'');assert.equal($('texto-compreensao').value,'');
    assert.equal($('resumo-conteudo').value,'Outro resumo');
    // ID lembrado após criar e falhar ao abrir: exclusão limpa a ação de reabertura.
    let rememberedId;const originalCreate=w.DL_DADOS.salvarTexto;
    w.DL_DADOS.salvarTexto=async(...args)=>{rememberedId=await originalCreate(...args);return rememberedId;};
    w.DL_DADOS.carregarTexto=async()=>{throw Error('Read failure after save');};
    $('adicionar-inicial').click();input('adicionar-titulo','Texto recém-salvo');input('adicionar-conteudo','Neuer Text.');
    $('form-adicionar-texto').dispatchEvent(new w.Event('submit',{cancelable:true}));
    await wait(()=>!$('adicionar-reabrir').hidden,'ID lembrado');w.DL_DADOS.carregarTexto=originalRead;
    $('adicionar-voltar').click();$('escolher-textos').click();await wait(()=>row(rememberedId),'texto lembrado na lista');
    row(rememberedId).querySelector('.escolha-excluir').click();$('excluir-confirmar').click();
    await wait(()=>!$('excluir-confirmacao').open&&!row(rememberedId),'excluir ID lembrado');
    assert($('adicionar-reabrir').hidden);assert.deepEqual(await stored(env,rememberedId),{original:false,resumo:false});
    $('escolha-voltar').click();w.DL_DADOS.salvarTexto=originalCreate;
    const realList=w.DL_DADOS.listarResumos;w.DL_DADOS.listarResumos=async()=>{throw Error('Offline');};
    w.abrirProgresso();await wait(()=>!$('memoria-repetir').hidden,'falha memória');
    assert($('memoria-status').textContent.includes('Não foi possível'));assert(!$('memoria-status').textContent.includes('Nenhum resumo'));
    w.DL_DADOS.listarResumos=realList;$('memoria-repetir').click();await wait(()=>item('alpha'),'nova tentativa');
    let release;w.DL_DADOS.listarResumos=()=>new Promise(r=>{release=r;});w.DL_TEXTOS.carregarMemoria();
    switchAccount('other');release([{id:'alpha',titulo:'Vazamento',conteudo:'Não deve aparecer'}]);await tick();
    assert.equal($('memoria-lista').textContent,'');assert($('memoria-status').textContent.includes('autorizada'));
    assert($('estudo-texto').hidden&&!$('escolha-textos').open);assert.equal($('minha-pergunta').value,'');
    await assert.rejects(w.DL_DADOS.excluirTexto('alpha',UID));assert.deepEqual(await stored(env,'alpha'),{original:true,resumo:true});
    w.DL_DADOS.listarResumos=realList;switchAccount(UID);await wait(()=>item('alpha'),'troca de conta');w.fecharProgresso();await choose('alpha');
    let releaseCopy;Object.defineProperty(w.navigator,'clipboard',{configurable:true,value:{writeText:()=>new Promise(r=>{releaseCopy=r;})}});
    $('consultar-sda').click();switchAccount(null);releaseCopy();await tick();assert(!$('consulta-confirmacao').open);
    assert.equal($('memoria-lista').textContent,'');assert.equal($('resumo-conteudo').value,'');
    console.log('PASS UI + SDK real no emulador: memória/busca/retomada/revisão, histórico preservado, cópia/foco/Escape/manual, cancelamento/falha/exclusão por ID, rascunhos e respostas antigas isolados por UID.');
  } finally { w.close(); }
}
(async()=>{
  const env=await initializeTestEnvironment({projectId:'demo-dl-textos',firestore:{host:'127.0.0.1',port:8188,rules:fs.readFileSync(path.join(ROOT,'firestore.rules'),'utf8')}});
  try { await env.clearFirestore();if(!process.argv.includes('--ui-only'))await rules(env);await ui(env);console.log('ALL PASS. Nenhum documento de produção acessado.'); }
  finally { await env.cleanup(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
