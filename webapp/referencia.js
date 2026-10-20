import {VERSAO, carregarReferencia, buscarConsultas, candidatos, textoBusca, priorizarConsultas, pesquisarReferencia, prepararOffline, verificarOffline} from './referencia-dados.js?v=rg-01-10-v10';

const rootURL=new URL('./',import.meta.url);
const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('referencia.css?v=rg-01-10-v10',rootURL).href;document.head.append(css);
const dialog=document.createElement('dialog');dialog.id='rg-overlay';dialog.className='rg-dialog';dialog.setAttribute('aria-labelledby','rg-titulo');
dialog.innerHTML=`<div class="rg-topo"><div class="rg-linha-topo"><h2 id="rg-titulo">Referência Gramatical</h2><button type="button" id="rg-voltar">Voltar ao texto</button></div>
  <nav id="rg-assuntos" aria-label="Assuntos da referência"><button type="button" data-assunto="inicio">Temas atuais</button><button type="button" data-assunto="todos">Todos os assuntos</button><label class="rg-escolha" for="rg-modulo">Assunto<select id="rg-modulo"><option value="">Escolha de 01 a 10</option></select></label></nav>
  <label for="rg-busca">Buscar nas explicações e exemplos</label><input type="search" id="rg-busca" placeholder="Ex.: zum See, zu klein, weiterzuarbeiten" autocomplete="off">
  <div class="rg-indicacoes"><p id="rg-contador" role="status" aria-live="polite"></p><button type="button" id="rg-abrir-ajuda" disabled>Ajuda geral</button></div></div>
  <div id="rg-corpo" tabindex="0" role="region" aria-label="Consultas gramaticais"><button type="button" id="rg-anterior" hidden>← Voltar à consulta anterior</button><div id="rg-contexto"></div><div id="rg-lista"></div>
  <details id="rg-ajuda"><summary>Ajuda geral</summary><div id="rg-ajuda-conteudo"></div></details>
  <details id="rg-sobre"><summary>Sobre esta referência</summary><div id="rg-sobre-conteudo"></div><p>O pacote contém os recursos públicos desta etapa. Textos e Cards pessoais seguem suas próprias condições de acesso.</p><button type="button" id="rg-offline">Preparar referência sem internet</button><p id="rg-offline-status" role="status" aria-live="polite"></p></details></div>`;
document.body.append(dialog);
const $=id=>document.getElementById(id), busca=$('rg-busca'),lista=$('rg-lista'),corpo=$('rg-corpo');
let dados=null,assunto='inicio',ids=null,retorno=null,abertura=0,ocupado=false,offlineRodada=0,vista='lista',tabelaAtual=null,termoContextual='';
const historico=[];
let ultimaBusca={termo:'',assunto:'inicio'},antesDeAbrir=null;
const el=(tag,texto,classe)=>{const n=document.createElement(tag);if(texto!==undefined)n.textContent=texto;if(classe)n.className=classe;return n;};
function snapshot(origem){
  const sel=getSelection(),ranges=[];if(sel)for(let i=0;i<sel.rangeCount;i++)ranges.push(sel.getRangeAt(i).cloneRange());
  return {origem:origem||document.activeElement,x:scrollX,y:scrollY,ranges,overflow:document.body.style.overflow,
    rolagens:[...document.querySelectorAll('body *')].filter(n=>n!==dialog&&!dialog.contains(n)&&(n.scrollTop||n.scrollLeft)).map(n=>({n,x:n.scrollLeft,y:n.scrollTop}))};
}
function restaurar(r){
  if(!r)return;
  document.body.style.overflow=r.overflow;
  if(r.origem?.isConnected)r.origem.focus({preventScroll:true});
  const sel=getSelection();sel.removeAllRanges();
  for(const range of r.ranges)if(range.startContainer.isConnected&&range.endContainer.isConnected)sel.addRange(range);
  for(const s of r.rolagens)if(s.n.isConnected){s.n.scrollTop=s.y;s.n.scrollLeft=s.x;}
  window.scrollTo({left:r.x,top:r.y,behavior:'instant'});
}
function fechar(restaurarPosicao=true){
  const anterior=historico[0];ultimaBusca={termo:anterior?anterior.busca:busca.value,assunto:anterior?anterior.assunto:assunto};
  if(!['inicio','todos',...(dados?.modulos||[]).map(m=>m.numero)].includes(ultimaBusca.assunto))ultimaBusca.assunto='todos';
  abertura++;historico.length=0;const r=retorno;retorno=null;if(dialog.open)dialog.close();$('rg-contexto').replaceChildren();
  if(restaurarPosicao){restaurar(r);requestAnimationFrame(()=>{if(!dialog.open)restaurar(r);});}
  else if(r)document.body.style.overflow=r.overflow;
}
function par(dest,texto,lang){if(!texto)return;const p=el('p',texto);if(lang)p.lang=lang;dest.append(p);}
function atualizarNavegacao(){
  for(const b of dialog.querySelectorAll('[data-assunto]'))b.setAttribute('aria-pressed',String(b.dataset.assunto===assunto));
  $('rg-modulo').value=dados?.modulos.some(m=>m.numero===assunto)?assunto:'';
  $('rg-anterior').hidden=!historico.length;
}
function guardarConsulta(origem){
  historico.push({assunto,ids:ids?.slice()||null,vista,tabelaAtual,termoContextual,busca:busca.value,
    inicio:busca.selectionStart,fim:busca.selectionEnd,buscaX:busca.scrollLeft,
    resultados:[...lista.childNodes],contexto:[...$('rg-contexto').childNodes],contador:$('rg-contador').textContent,
    sobre:$('rg-sobre').open,top:corpo.scrollTop,left:corpo.scrollLeft,origem});
}
function voltarConsulta(){
  const anterior=historico.pop();if(!anterior)return;
  ({assunto,ids,vista,tabelaAtual,termoContextual}=anterior);busca.value=anterior.busca;
  // Recoloca os mesmos resultados e seus estados; não refaz nem apaga a busca.
  lista.replaceChildren(...anterior.resultados);$('rg-contexto').replaceChildren(...anterior.contexto);
  $('rg-contador').textContent=anterior.contador;$('rg-sobre').open=anterior.sobre;atualizarNavegacao();
  const restaurarVista=()=>{busca.setSelectionRange(anterior.inicio,anterior.fim);busca.scrollLeft=anterior.buscaX;
    if(anterior.origem?.isConnected)anterior.origem.focus({preventScroll:true});corpo.scrollTop=anterior.top;corpo.scrollLeft=anterior.left;};
  restaurarVista();requestAnimationFrame(()=>{if(dialog.open)restaurarVista();});
}
function abrirRelacionada(c,origem,tabela=null){
  guardarConsulta(origem);assunto=c.modulo||'inicio';ids=[c.id];vista=tabela===null?'consulta':'tabela';tabelaAtual=tabela;busca.value='';
  render();corpo.scrollTop=0;$('rg-anterior').focus({preventScroll:true});
}
function botaoConsulta(id){
  const c=dados.consultas.find(c=>c.id===id&&c.tipo_consulta!=='ajuda');if(!c)return null;
  const b=el('button',c.titulo);b.type='button';b.dataset.consulta=id;b.onclick=()=>abrirRelacionada(c,b);return b;
}
function relacionadas(c){
  const nav=el('div',undefined,'rg-relacionadas');
  for(const id of c.relacionados||[]){const b=botaoConsulta(id);if(b)nav.append(b);}
  for(const [i,t] of (c.tabelas||[]).entries()){
    const b=el('button',t.titulo);b.type='button';b.dataset.tabela=c.id;b.onclick=()=>abrirRelacionada(c,b,i);nav.append(b);
  }
  if(nav.childNodes.length)nav.prepend(el('p','Consultas relacionadas (opcional)'));
  return nav;
}
function cartao(c){
  const artigo=el('article',undefined,'rg-consulta');artigo.dataset.consultaId=c.id;
  const h=el('h3',c.titulo);h.tabIndex=-1;artigo.append(h);
  const texto=el('div',undefined,'rg-texto');
  for(const item of c.apresentacao||(c.explicacao||[]).map(texto=>({tipo:'explicacao',texto}))){
    const p=el('p',undefined,'rg-'+item.tipo);
    if(item.tipo==='alemao'){p.lang='de';p.append(el('strong',item.texto));}
    else if(item.tipo==='traducao'){p.lang='pt-BR';p.textContent=item.texto;}
    else{
      // Somente citações alemãs explícitas nos dados recebem destaque.
      let restante=item.texto;
      while(restante){
        const candidatos=(item.citacoes_de||[]).map(de=>({de,pos:restante.indexOf(de)})).filter(x=>x.pos>=0).sort((a,b)=>a.pos-b.pos||b.de.length-a.de.length);
        const proximo=candidatos[0];if(!proximo){p.append(document.createTextNode(restante));break;}
        p.append(document.createTextNode(restante.slice(0,proximo.pos)));const forte=el('strong',proximo.de);forte.lang='de';p.append(forte);restante=restante.slice(proximo.pos+proximo.de.length);
      }
    }
    texto.append(p);
  }
  artigo.append(texto);
  artigo.append(relacionadas(c));return artigo;
}
function cartaoTabela(c){
  const t=c.tabelas[tabelaAtual],artigo=el('article',undefined,'rg-consulta');artigo.dataset.consultaId=c.id;
  const h=el('h3',t.titulo);h.tabIndex=-1;artigo.append(h);
  const caixa=el('div',undefined,'rg-tabela');caixa.tabIndex=0;caixa.setAttribute('role','region');caixa.setAttribute('aria-label',t.titulo);
  const table=el('table');table.append(el('caption',t.titulo));const thead=el('thead'),cab=el('tr');for(const col of t.colunas){const th=el('th',col);th.scope='col';cab.append(th);}thead.append(cab);table.append(thead);
  const body=el('tbody');for(const row of t.linhas){const tr=el('tr');for(const [i,cell] of row.entries()){const td=el('td');if((t.colunas_alemao||[]).includes(i)){td.lang='de';td.append(el('strong',cell));}else td.textContent=cell;tr.append(td);}body.append(tr);}table.append(body);caixa.append(table);artigo.append(caixa);if(t.nota)par(artigo,t.nota);return artigo;
}
function render(){
  if(!dados)return;lista.replaceChildren();
  atualizarNavegacao();
  const termo=busca.value.trim();
  if(vista!=='lista'){
    const c=dados.consultas.find(c=>c.id===ids?.[0]);if(c)lista.append(vista==='tabela'?cartaoTabela(c):cartao(c));
    $('rg-contador').textContent=vista==='tabela'?'Comparação relacionada':'Consulta relacionada';return;
  }
  if(termo){
    const pesquisa=pesquisarReferencia(dados,termo,dados.modulos.some(m=>m.numero===assunto)?assunto:'todos');
    if(pesquisa.modo==='expressao')par(lista,'Correspondência para o trecho completo. Compare com o contexto; nenhum sentido foi confirmado.');
    if(pesquisa.modo==='palavras')par(lista,'Nenhuma correspondência para o trecho completo. Candidatos por palavras inteiras: '+pesquisa.palavras.join(', ')+'. Compare com o contexto; nenhum sentido foi confirmado.');
    for(const c of pesquisa.resultados)lista.append(cartao(c));
    if(pesquisa.secundarios.length){
      const outros=el('details');outros.className='rg-secundarios';
      outros.append(el('summary','Outros candidatos ('+pesquisa.secundarios.length+')'));
      par(outros,'Ocorrências parciais ou incidentais. Compare com o contexto; nenhum sentido foi confirmado.');
      for(const c of pesquisa.secundarios)outros.append(cartao(c));
      lista.append(outros);
    }
    $('rg-contador').textContent=pesquisa.resultados.length+(pesquisa.resultados.length===1?' consulta principal':' consultas principais')+(dados.modulos.some(m=>m.numero===assunto)?' · módulo '+assunto:'');
    if(!pesquisa.resultados.length&&!pesquisa.secundarios.length)par(lista,'Nenhuma consulta encontrada para “'+busca.value+'”. O trecho foi mantido no campo de busca.');
    return;
  }
  // Digitando busca a partir da entrada, pesquisa a referência inteira.
  const base=(assunto==='inicio'||assunto==='todos')?dados.base.filter(c=>!termo||textoBusca({...c,palavras_chave:[...(c.gatilhos||[]),...(c.itens||[]),...(c.detalhes||[]),...(c.dativo||[]),...(c.acusativo||[]),...(c.dativo_ou_acusativo||[])]}).includes(textoBusca({titulo:termo}))):[];
  const porModulo=dados.modulos.some(m=>m.numero===assunto);
  const consultas=assunto==='inicio'&&!termo?[]:buscarConsultas(dados,termo,porModulo?assunto:'todos').filter(c=>!ids||ids.includes(c.id));
  if(assunto==='relacionadas')lista.append(el('p','Candidatos de consulta: compare com o contexto.','rg-candidatos'));
  const resultados=priorizarConsultas([...base,...consultas],termo||termoContextual);
  for(const c of resultados)lista.append(cartao(c));
  const total=resultados.length;
  $('rg-contador').textContent=total+(total===1?' consulta':' consultas')+(porModulo?' · módulo '+assunto:assunto==='relacionadas'?(total===1?' relacionada':' relacionadas'):'');
  if(!total)par(lista,'Nenhuma consulta encontrada para esta busca. Os recursos da referência foram carregados.');
}
function sobre(){
  const ajuda=$('rg-ajuda-conteudo');ajuda.replaceChildren();
  for(const c of dados.consultas.filter(c=>c.tipo_consulta==='ajuda')){ajuda.append(el('h3',c.titulo));for(const texto of c.explicacao)par(ajuda,texto);}
  $('rg-abrir-ajuda').disabled=false;
  const d=$('rg-sobre-conteudo');d.replaceChildren();
  par(d,'Prévia local · '+VERSAO);for(const key of ['revisao','bibliografia','escopo','inventarios'])par(d,dados.sobre[key]);
  d.append(el('h3','Fontes'));
  for(const f of dados.sobre.fontes){
    const p=el('p',(f.modulo?'Módulo '+f.modulo+' — ':'')+f.titulo+(f.secao?' · §'+f.secao:''));
    if(f.url){const a=el('a','Consultar fonte');a.href=f.url;a.target='_blank';a.rel='noopener noreferrer';p.append(' ',a);}d.append(p);
  }
}
async function offlineStatus(){
  if(ocupado)return;const rodada=++offlineRodada;
  try{const pronto=await verificarOffline();if(rodada===offlineRodada&&!ocupado)$('rg-offline-status').textContent=pronto?'✓ Referência disponível sem internet · '+VERSAO:'Pacote offline ainda não confirmado neste aparelho.';}
  catch(e){if(rodada===offlineRodada&&!ocupado)$('rg-offline-status').textContent=e.message;}
}
async function abrir(opcoes={}){
  if(!dialog.open){retorno=opcoes.retorno||snapshot(opcoes.origem);dialog.showModal();document.body.style.overflow='hidden';}
  const rodada=++abertura;historico.length=0;vista='lista';tabelaAtual=null;termoContextual=opcoes.trecho||'';assunto=opcoes.assunto||(opcoes.preservarBusca?ultimaBusca.assunto:'inicio');ids=opcoes.ids||null;busca.value=opcoes.buscaInicial??(opcoes.preservarBusca?ultimaBusca.termo:'');$('rg-contexto').replaceChildren();$('rg-sobre').open=false;$('rg-ajuda').open=false;corpo.scrollTop=0;atualizarNavegacao();
  if(opcoes.trecho&&(!busca.value||busca.value.trim()===opcoes.trecho.trim())){par($('rg-contexto'),'Trecho: '+opcoes.trecho,'de');if(opcoes.contexto){const d=el('details');d.append(el('summary','Ver contexto'));par(d,opcoes.contexto,'de');$('rg-contexto').append(d);}}
  $('rg-contador').textContent='Carregando referência…';lista.replaceChildren();
  try{
    dados=await carregarReferencia();if(rodada!==abertura||!dialog.open)return;
    // O mesmo leitor aceita novos módulos adaptados declarados no manifesto.
    const seletor=$('rg-modulo');
    for(const m of dados.modulos)if(![...seletor.options].some(o=>o.value===m.numero)){const o=el('option',m.numero+' — '+m.titulo);o.value=m.numero;seletor.append(o);}
    if(opcoes.candidatos){ids=candidatos(dados,opcoes.trecho,opcoes.usoId).map(c=>c.id);assunto='relacionadas';}
    render();sobre();offlineStatus();
  }catch(e){if(rodada!==abertura||!dialog.open)return;$('rg-contador').textContent='Recurso indisponível';par(lista,e.message);const b=el('button','Tentar carregar novamente');b.type='button';b.onclick=()=>abrir(opcoes);lista.append(b);}
  busca.focus({preventScroll:true});
}
function criarAcesso(opcoes){
  const b=el('button',opcoes.rotulo||'Consultas gramaticais relacionadas');b.type='button';b.className='rg-acesso';
  b.addEventListener('mousedown',e=>{if(e.button===0)e.preventDefault();});
  b.onclick=()=>abrir({...opcoes,candidatos:true,origem:b});return b;
}
window.DL_REFERENCIA={abrir,criarAcesso,fechar};
const entrada=document.getElementById('nav-referencia');
entrada?.addEventListener('pointerdown',()=>{antesDeAbrir={selecao:window.DL_TEXTO_SELECAO?.obter(),retorno:snapshot(entrada),momento:performance.now()};});
entrada?.addEventListener('pointercancel',()=>{antesDeAbrir=null;});
entrada?.addEventListener('mousedown',e=>{if(e.button===0&&window.DL_TEXTO_SELECAO?.obter())e.preventDefault();});
window.abrirReferencia=()=>{
  const preparada=antesDeAbrir&&performance.now()-antesDeAbrir.momento<1500?antesDeAbrir:null;antesDeAbrir=null;
  const atual=window.DL_TEXTO_SELECAO?.obter(),selecao=atual&&(preparada?.selecao?.trecho===atual.trecho?preparada.selecao:atual);
  const r=preparada?.retorno||snapshot(entrada);
  if(selecao){r.ranges=[selecao.intervalo.cloneRange()];return abrir({trecho:selecao.trecho,contexto:selecao.contexto,buscaInicial:selecao.trecho,assunto:'todos',retorno:r,origem:entrada});}
  return abrir({preservarBusca:true,retorno:r,origem:entrada});
};window.fecharReferencia=()=>fechar();
window.dispatchEvent(new Event('dl-referencia-pronta'));
$('rg-voltar').onclick=()=>fechar();dialog.addEventListener('cancel',e=>{e.preventDefault();fechar();});
$('rg-anterior').onclick=voltarConsulta;
$('rg-abrir-ajuda').onclick=()=>{const ajuda=$('rg-ajuda');ajuda.open=true;ajuda.scrollIntoView({block:'start',behavior:'instant'});ajuda.querySelector('summary').focus({preventScroll:true});};
dialog.addEventListener('keydown',e=>{
  if(e.key!=='Tab')return;
  const controles=[...dialog.querySelectorAll('button,input,a[href],summary,[tabindex]')].filter(n=>{
    if(n.disabled||n.tabIndex<0||!n.getClientRects().length||getComputedStyle(n).visibility==='hidden')return false;
    for(let p=n.parentElement;p&&p!==dialog;p=p.parentElement)if(p.tagName==='DETAILS'&&!p.open&&p.querySelector(':scope > summary')!==n)return false;
    return true;
  });
  const primeiro=controles[0],ultimo=controles.at(-1);
  if(!primeiro){e.preventDefault();return;}
  if(e.shiftKey&&(document.activeElement===primeiro||!dialog.contains(document.activeElement))){e.preventDefault();ultimo.focus();}
  else if(!e.shiftKey&&(document.activeElement===ultimo||!dialog.contains(document.activeElement))){e.preventDefault();primeiro.focus();}
});
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)fechar();}});
function selecionarAssunto(valor){assunto=valor;ids=null;vista='lista';termoContextual='';busca.value='';$('rg-contexto').replaceChildren();render();corpo.scrollTop=0;}
$('rg-assuntos').onclick=e=>{const b=e.target.closest('button[data-assunto]');if(b)selecionarAssunto(b.dataset.assunto);};
$('rg-modulo').onchange=()=>{if($('rg-modulo').value)selecionarAssunto($('rg-modulo').value);};
busca.oninput=()=>{vista='lista';tabelaAtual=null;ids=null;termoContextual='';$('rg-contexto').replaceChildren();if(assunto==='inicio'||assunto==='relacionadas')assunto='todos';render();corpo.scrollTop=0;};
$('rg-offline').onclick=async()=>{
  if(ocupado)return;ocupado=true;offlineRodada++;$('rg-offline').disabled=true;$('rg-offline-status').textContent='Verificando e preparando os recursos desta versão…';
  try{const v=await prepararOffline((i,total)=>{$('rg-offline-status').textContent='Preparando recursos: '+i+' de '+total+'…';});$('rg-offline-status').textContent='✓ Referência disponível sem internet · '+v;}
  catch(e){$('rg-offline-status').textContent='Disponibilidade não confirmada. '+e.message;}
  finally{ocupado=false;$('rg-offline').disabled=false;}
};
window.addEventListener('dl-auth-alterado',()=>{if(dialog.open)fechar(false);ultimaBusca={termo:'',assunto:'inicio'};antesDeAbrir=null;busca.value='';});
window.addEventListener('offline',()=>{if(dialog.open)offlineStatus();});
window.addEventListener('online',()=>{if(dialog.open)offlineStatus();});
navigator.serviceWorker?.addEventListener('controllerchange',()=>{if(dialog.open)offlineStatus();});
export {criarAcesso,abrir};
