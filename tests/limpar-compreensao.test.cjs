// Ajuste único: adaptador local, sem Firebase ou documentos de produção.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const {JSDOM}=createRequire(path.join(process.env.DL_TEST_DEPS||path.join(os.tmpdir(),'dl-textos-tests'),'package.json'))('jsdom');
const root=path.resolve(__dirname,'..'),tick=()=>new Promise(r=>setTimeout(r,10));
(async()=>{
 const dom=new JSDOM(fs.readFileSync(path.join(root,'webapp/index.html'),'utf8'),{url:'https://example.test/',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,$=id=>w.document.getElementById(id),uid='WuXcMYo6m3OuQttlk7z22gRjlvn1';
 const textos=[{id:'a',titulo:'Anna',conteudo:'Anna lernt Deutsch.'},{id:'b',titulo:'Outro',conteudo:'Anderer Text.'}];let copied='';
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.DL_AUTH={pronta:true,usuario:{uid}};w.DL_DADOS={listarTextos:async()=>textos,carregarTexto:async id=>textos.find(t=>t.id===id),carregarResumo:async()=>''};
 Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async value=>{copied=value;}}});
 const input=(id,value)=>{$(id).value=value;$(id).dispatchEvent(new w.Event('input'));};
 const abrir=async id=>{$('seletor-texto').value=id;$('seletor-texto').dispatchEvent(new w.Event('change'));await tick();};
 try{
  w.eval(fs.readFileSync(path.join(root,'webapp/textos.js'),'utf8'));await tick();await abrir('a');
  $('limpar-compreensao').click();assert(!$('compreensao-confirmacao').open);
  input('texto-compreensao','Compreensão A');input('minha-pergunta','Pergunta A');input('resumo-conteudo','Resumo A');
  const range=w.document.createRange(),node=$('original-texto').firstChild;range.setStart(node,0);range.setEnd(node,4);w.getSelection().addRange(range);w.document.dispatchEvent(new w.Event('selectionchange'));
  const preservar=()=>{assert.equal($('minha-pergunta').value,'Pergunta A');assert.equal($('resumo-conteudo').value,'Resumo A');assert.equal($('original-texto').textContent,textos[0].conteudo);assert.equal($('selecao-texto').textContent,'Anna');assert(!$('consultar-leo').disabled);};
  $('limpar-compreensao').click();assert($('compreensao-confirmacao').open);$('compreensao-cancelar').click();assert.equal($('texto-compreensao').value,'Compreensão A');preservar();
  $('limpar-compreensao').click();const escape=new w.Event('cancel',{cancelable:true});$('compreensao-confirmacao').dispatchEvent(escape);assert(escape.defaultPrevented);assert(!$('compreensao-confirmacao').open);assert.equal($('texto-compreensao').value,'Compreensão A');preservar();
  $('limpar-compreensao').click();$('compreensao-limpar').click();assert(!$('compreensao-confirmacao').open);assert.equal($('texto-compreensao').value,'');assert.equal(w.document.activeElement,$('texto-compreensao'));preservar();
  $('consultar-sda').click();await tick();assert(!copied.includes('Minha compreensão:'));for(const value of ['Minha pergunta:\nPergunta A','Trecho: Anna','Frase de contexto: Anna lernt Deutsch.','Original:\n'+textos[0].conteudo])assert(copied.includes(value));$('consulta-entendi').click();
  await abrir('b');input('texto-compreensao','Compreensão B');await abrir('a');assert.equal($('texto-compreensao').value,'');assert.equal($('minha-pergunta').value,'Pergunta A');assert.equal($('resumo-conteudo').value,'Resumo A');$('consultar-sda').click();await tick();assert(!copied.includes('Minha compreensão:'));$('consulta-entendi').click();await abrir('b');assert.equal($('texto-compreensao').value,'Compreensão B');
  console.log('PASS: vazio, Cancelar/Escape, limpeza confirmada e foco; pergunta, seleção/contexto, original e resumo preservados; rascunho apagado não reaparece na reabertura ou SDA. Sem produção.');
 }finally{w.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
