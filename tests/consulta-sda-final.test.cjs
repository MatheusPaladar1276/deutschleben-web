// Somente os ajustes finais, com adaptador local e gravação controlada; sem Firebase.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const assert=require('node:assert/strict'),{createRequire}=require('node:module');
const deps=createRequire(path.join(process.env.DL_TEST_DEPS||path.join(os.tmpdir(),'dl-textos-tests'),'package.json'));
const {JSDOM}=deps('jsdom'),root=path.resolve(__dirname,'..');
const tick=()=>new Promise(r=>setTimeout(r,10));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
(async()=>{
 const dom=new JSDOM(fs.readFileSync(path.join(root,'webapp/index.html'),'utf8'),{url:'https://example.test/',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,$=id=>w.document.getElementById(id),uid='WuXcMYo6m3OuQttlk7z22gRjlvn1';
 const texto={id:'local',titulo:'Vorstellung',conteudo:'Mein Name ist Anna.\nIch lerne Deutsch.\nOriginal completo.'};
 let copied='',pendingCopy=null,save=null,opened='';
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.DL_AUTH={pronta:true,usuario:{uid}};
 w.DL_DADOS={listarTextos:async()=>[texto],carregarTexto:async()=>texto,carregarResumo:async()=>'',salvarResumo:()=>{save=deferred();return save.promise;}};
 w.open=url=>{opened=url;};
 Object.defineProperty(w.navigator,'clipboard',{value:{writeText:value=>{copied=value;return pendingCopy?pendingCopy.promise:Promise.resolve();}}});
 const input=(id,value)=>{$(id).value=value;$(id).dispatchEvent(new w.Event('input'));};
 const select=word=>{const node=$('original-texto').firstChild,start=node.textContent.indexOf(word),range=w.document.createRange();range.setStart(node,start);range.setEnd(node,start+word.length);w.getSelection().removeAllRanges();w.getSelection().addRange(range);w.document.dispatchEvent(new w.Event('selectionchange'));};
 try {
  w.eval(fs.readFileSync(path.join(root,'webapp/textos.js'),'utf8'));await tick();
  $('seletor-texto').value=texto.id;$('seletor-texto').dispatchEvent(new w.Event('change'));await tick();
  input('minha-pergunta','Pergunta antiga');input('texto-compreensao','Compreensão preservada');input('resumo-conteudo','Resumo preservado');
  $('minha-pergunta').value='Pergunta atual\nsegunda linha';$('texto-compreensao').value='Compreensão atual\nsegunda linha';
  select('Anna');$('consultar-sda').focus();$('consultar-sda').click();await tick();
  for(const value of ['Título: Vorstellung','Original:\n'+texto.conteudo,'Trecho: Anna','Frase de contexto: Mein Name ist Anna.','Minha pergunta:\nPergunta atual\nsegunda linha','Minha compreensão:\nCompreensão atual\nsegunda linha','Referência didática:','sem substituir minha reflexão'])assert(copied.includes(value),value);
  assert($('consulta-confirmacao').open);$('consulta-entendi').click();
  input('texto-compreensao','Compreensão preservada');
  $('limpar-consulta').click();
  assert.equal($('minha-pergunta').value,'');assert.equal($('selecao-texto').textContent,'');assert.equal(w.getSelection().rangeCount,0);assert($('consultar-leo').disabled);
  assert.equal($('texto-compreensao').value,'Compreensão preservada');assert.equal($('resumo-conteudo').value,'Resumo preservado');assert.equal($('original-texto').textContent,texto.conteudo);
  $('consultar-leo').click();assert.equal(opened,'');$('consultar-sda').click();await tick();
  assert(copied.includes('Original:\n'+texto.conteudo));assert(copied.includes('Minha compreensão:\nCompreensão preservada'));assert(!/Minha pergunta:|Trecho:|Frase de contexto:/.test(copied));$('consulta-entendi').click();
  $('seletor-texto').dispatchEvent(new w.Event('change'));await tick();assert.equal($('minha-pergunta').value,'');assert.equal($('texto-compreensao').value,'Compreensão preservada');assert.equal($('resumo-conteudo').value,'Resumo preservado');
  select('Deutsch');$('consultar-leo').click();assert(opened.endsWith('/Deutsch'));$('consultar-sda').click();await tick();assert(copied.includes('Trecho: Deutsch'));$('consulta-entendi').click();
  for(const fail of [false,true]){pendingCopy=deferred();$('consultar-sda').click();$('limpar-consulta').click();fail?pendingCopy.reject(Error('falha local')):pendingCopy.resolve();await tick();assert(!$('consulta-confirmacao').open);assert($('copia-manual').hidden);assert.equal($('copia-status').textContent,'');}pendingCopy=null;
  $('salvar-resumo').click();assert(save);assert(!$('resumo-status').classList.contains('resumo-sucesso'));assert.equal($('resumo-status').textContent,'Salvando resumo…');
  save.resolve();await tick();assert.equal($('resumo-status').textContent,'✓ Resumo salvo com sucesso');assert($('resumo-status').classList.contains('resumo-sucesso'));
  input('resumo-conteudo','Revisão não salva');assert(!$('resumo-status').classList.contains('resumo-sucesso'));assert.equal($('resumo-status').textContent,'Alterações ainda não salvas.');
  $('salvar-resumo').click();save.reject(Error('falha local'));await tick();assert($('resumo-status').classList.contains('resumo-erro'));assert(!$('resumo-status').classList.contains('resumo-sucesso'));assert.equal($('resumo-conteudo').value,'Revisão não salva');
  assert($('selecao-texto').closest('.selecao-caixa'));assert.equal(w.document.querySelectorAll('#consultar-sda').length,1);assert($('consultar-sda').closest('.consulta-sda'));
  assert.equal(w.localStorage.length,0);assert.equal(w.sessionStorage.length,0);
  console.log('PASS: original completo e campos atuais; limpeza isolada, nova seleção e cópia pendente; resumo confirmado, edição e falha. Sem Firebase ou documentos de produção.');
 }finally{w.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
