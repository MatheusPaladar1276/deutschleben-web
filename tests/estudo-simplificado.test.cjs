// Interface de produção com dados isolados; não conecta ao Firebase.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {createRequire}=require('node:module'),{webcrypto,createHash}=require('node:crypto');
const {JSDOM}=createRequire(path.join(process.env.DL_TEST_DEPS||path.join(os.tmpdir(),'dl-textos-tests'),'package.json'))('jsdom');
const root=path.resolve(__dirname,'..'),web=path.join(root,'webapp');
const read=f=>fs.readFileSync(path.join(web,f),'utf8'),tick=()=>new Promise(r=>setTimeout(r,20));
const uid='WuXcMYo6m3OuQttlk7z22gRjlvn1',frase='Am frühen Morgen gehe ich zum See';
async function main(){
  const manifesto=JSON.parse(read('data/referencia/manifesto.json'));
  for(const r of manifesto.recursos)assert.equal(createHash('sha256').update(fs.readFileSync(path.join(web,r.url.split('?')[0]))).digest('hex'),r.sha256,r.url);
  const dom=new JSDOM(read('index.html'),{url:'https://example.test/',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,$=id=>w.document.getElementById(id),texto={id:'isolado',titulo:'Texto de teste',conteudo:frase+'. Über dem Wasser liegt leichter Nebel.'};
  const salvos=new Map([['anterior','Registro anterior intacto.']]);let abriu,gravarFalha=false;
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
  Object.defineProperty(w.crypto,'subtle',{value:webcrypto.subtle});
  w.fetch=async url=>new Response(fs.readFileSync(path.join(web,new URL(url,w.location).pathname.slice(1))),{status:200});
  w.DL_AUTH={pronta:true,usuario:{uid}};
  w.DL_DADOS={listarTextos:async()=>[texto],carregarTexto:async()=>texto,
    carregarResumo:async id=>salvos.get(id)||'',listarResumos:async()=>[...salvos].map(([id,conteudo])=>({...texto,id,conteudo})),
    salvarResumo:async(id,conta,conteudo)=>{assert.equal(conta,uid);if(gravarFalha)throw Error('Falha simulada');salvos.set(id,conteudo);}};
  w.open=(...args)=>{abriu=args;};
  try{
    w.eval(read('textos.js'));await tick();
    $('seletor-texto').value=texto.id;$('seletor-texto').dispatchEvent(new w.Event('change'));await tick();
    for(const id of ['minha-pergunta','consultar-construcoes','texto-compreensao','limpar-compreensao','consultar-sda'])assert($(id).disabled,id);
    assert($('texto-compreensao').closest('.compreensao').hidden);
    assert($('consultar-sda').closest('.consulta-sda').hidden);
    function selecionar(trecho){
      const n=$('original-texto').firstChild,i=n.textContent.indexOf(trecho),r=w.document.createRange();
      r.setStart(n,i);r.setEnd(n,i+trecho.length);w.getSelection().removeAllRanges();w.getSelection().addRange(r);
      w.document.dispatchEvent(new w.Event('selectionchange'));
    }
    selecionar('Nebel');assert.equal($('selecao-texto').textContent,'Selecionado: Nebel');
    assert($('consultar-construcoes').disabled);$('consultar-leo').click();
    assert.deepEqual(abriu,['https://dict.leo.org/alem%C3%A3o-portugu%C3%AAs/Nebel','_blank','noopener,noreferrer']);
    $('limpar-consulta').click();assert.equal($('selecao-texto').textContent,'');assert($('consultar-leo').disabled);
    assert.equal(w.document.activeElement,$('limpar-consulta'));assert.equal(w.DL_TEXTO_SELECAO.obter(),null);
    const data=read('referencia-dados.js').replace(/\bexport /g,'').replace(/import\.meta\.url/g,JSON.stringify('https://example.test/referencia-dados.js'));
    const ui=read('referencia.js').replace(/^import .*;\r?$/m,'').replace(/^export .*;\r?$/m,'').replace(/import\.meta\.url/g,JSON.stringify('https://example.test/referencia.js'));
    w.eval(data+'\n'+ui);selecionar(frase);await w.abrirReferencia();
    assert.equal($('rg-busca').value,'');
    const trocar=n=>{$('rg-modulo').value=n;$('rg-modulo').dispatchEvent(new w.Event('change'));};
    trocar('04');assert.equal($('rg-contexto').textContent,'Trecho: '+frase);assert.equal($('rg-contexto').children.length,1);
    const quadro=$('rg-quadro-preposicoes');assert.equal($('rg-lista').firstChild,quadro);assert(!quadro.open);
    quadro.querySelector('summary').click();assert(quadro.open);assert.equal(quadro.querySelectorAll('th').length,3);
    assert.equal(quadro.querySelectorAll('tbody strong').length,25);assert.equal(quadro.querySelectorAll('li').length,2);
    quadro.querySelector('summary').click();assert(!quadro.open);
    $('rg-busca').value='zu';$('rg-busca').dispatchEvent(new w.Event('input'));assert.equal($('rg-contexto').textContent,'Trecho: '+frase);
    for(const n of ['01','02','03','05','06','07','08','09','10']){trocar(n);assert(!$('rg-quadro-preposicoes'));assert.equal($('rg-busca').value,'');assert.equal($('rg-contexto').textContent,'Trecho: '+frase);}
    trocar('04');assert(!$('rg-quadro-preposicoes').open);w.fecharReferencia();
    $('resumo-conteudo').value='Resumo persistido';$('resumo-conteudo').dispatchEvent(new w.Event('input'));$('salvar-resumo').click();await tick();
    assert.equal(salvos.get(texto.id),'Resumo persistido');assert.equal(salvos.get('anterior'),'Registro anterior intacto.');
    await w.DL_TEXTOS.carregarMemoria();assert.equal($('memoria-lista').children.length,2);
    gravarFalha=true;$('resumo-conteudo').value='Rascunho mantido';$('resumo-conteudo').dispatchEvent(new w.Event('input'));$('salvar-resumo').click();await tick();
    assert($('resumo-status').textContent.startsWith('Não foi possível'));assert.equal($('resumo-conteudo').value,'Rascunho mantido');assert.equal(salvos.get(texto.id),'Resumo persistido');
    w.DL_AUTH.usuario=null;w.dispatchEvent(new w.Event('dl-auth-alterado'));assert($('estudo-texto').hidden);assert.equal(salvos.get('anterior'),'Registro anterior intacto.');
    assert.equal(w.localStorage.length,0);assert.equal(w.sessionStorage.length,0);
    console.log('PASS: interface simplificada, LEO, trecho independente, quadro exclusivo/recolhível, hashes, resumo/memória, erro de gravação e isolamento; sem persistência de demonstração.');
  }finally{w.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
