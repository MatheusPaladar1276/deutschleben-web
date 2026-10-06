import './formato.js';
import * as dados from './dados.js';
import { listarLocal, guardarLocal, removerLocal } from './offline.js';
const $=id=>document.getElementById(id), F=window.DL_CARD_FORMATO;
let conta=null, geracao=0, lista=[], atual=null, candidato=null, completo=false, pt=true, ocupado=false;
const visoes={card:{secao:null},preview:{secao:null}};
let previaCompleta=false, previaPt=true, edicao=0;
const aviso=s=>{$('status').textContent=s;};
const vivo=(u,g)=>u===conta && g===geracao && dados.uid()===u;
function limpar(){geracao++;edicao++;conta=null;atual=null;candidato=null;lista=[];$('area').hidden=true;$('lista').replaceChildren();$('texto').replaceChildren();$('conteudo').value='';for(const id of ['card','preview','original','conferir','titulo','local'])$(id).replaceChildren();$('editor').hidden=true;$('estudo').hidden=true;$('salvar').hidden=true;$('preview-controles').hidden=true;visoes.card.secao=null;visoes.preview.secao=null;aviso('');}
function render(dest,c,todos=false,port=true){dest.replaceChildren();dest.classList.toggle('sem-pt',!port);
  const estado=visoes[dest.id], disponiveis=F.secoes.filter(s=>c.secoes[s].some(i=>todos||i.essencial));
  if(!disponiveis.includes(estado.secao))estado.secao=disponiveis[0];
  const nav=document.createElement('nav');nav.className='secoes';nav.setAttribute('aria-label','Seções do card');
  const rotulos=['Dúvidas','Blocos','Sentenças','Substantivos','Verbos','Adjetivos','Advérbios'];
  for(const s of disponiveis){const b=document.createElement('button');b.type='button';b.textContent=rotulos[F.secoes.indexOf(s)];b.dataset.secao=s;b.setAttribute('aria-pressed',String(s===estado.secao));b.onclick=()=>{estado.secao=s;render(dest,c,todos,port);dest.querySelector('.secoes [aria-pressed="true"]').focus({preventScroll:true});};nav.append(b);}
  dest.append(nav);if(!estado.secao)return;
  const caixa=document.createElement('div');caixa.className='secao-caixa';const h=document.createElement('h3');h.textContent=F.nomes[F.secoes.indexOf(estado.secao)];caixa.append(h);
  if(estado.secao==='blocos'){const p=document.createElement('p');p.className='nota';p.textContent='Reconheça o bloco inteiro pelo sentido, sem remontar palavra por palavra. Nem todo bloco é uma expressão fixa.';caixa.append(p);}
  for(const i of c.secoes[estado.secao].filter(i=>todos||i.essencial)){
    const linha=document.createElement('div');linha.className='linha';const par=document.createElement('div');par.className='par';
    for(const [cl,txt] of [['de',i.de],['pt seta','→'],['pt',i.pt]]){const span=document.createElement('span');span.className=cl;span.textContent=txt;if(cl==='de')span.lang='de';par.append(span);}linha.append(par);
    if(i.origem && i.origem.trim()!==i.de.trim()){const contexto=document.createElement('details');contexto.className='contexto';const sum=document.createElement('summary');sum.textContent='Ver contexto';const p=document.createElement('p');p.lang='de';p.textContent=i.origem;contexto.append(sum,p);linha.append(contexto);}
    caixa.append(linha);
  }
  dest.append(caixa);
}
async function tarefa(fn){if(ocupado)return;ocupado=true;for(const b of $('area').querySelectorAll('button'))b.disabled=true;const u=conta,g=geracao;try{await fn(u,g);}catch(e){if(vivo(u,g)||!u)aviso(e.message || 'Não foi possível concluir.');}finally{ocupado=false;for(const b of $('area').querySelectorAll('button'))b.disabled=false;}}
async function atualizar(u,g){let locais=await listarLocal(u);let textos;
  if(navigator.onLine){try{textos=await dados.textos(u); const ids=new Set(textos.map(t=>t.id));for(const l of locais)if(!ids.has(l.textoId))await removerLocal(u,l.textoId);locais=locais.filter(l=>ids.has(l.textoId));}catch(e){if(!locais.length)throw e;aviso('Servidor indisponível. Exibindo somente cópias locais.');}}
  if(!textos)textos=locais.map(l=>({id:l.textoId,titulo:l.titulo})); if(!vivo(u,g))return;
  lista=textos;$('lista').replaceChildren();if($('texto').value)invalidar();$('texto').replaceChildren(new Option('Escolha e confirme o original',''));
  textos.forEach((t,i)=>{const b=document.createElement('button');b.textContent=String(i+1).padStart(2,'0')+' — '+t.titulo+(locais.some(l=>l.textoId===t.id)?' · disponível neste aparelho':'');b.onclick=()=>tarefa((u,g)=>abrir(t.id,u,g));$('lista').append(b);$('texto').append(new Option(String(i+1).padStart(2,'0')+' — '+t.titulo,t.id));});
  if(!textos.length)$('lista').textContent='Nenhum texto disponível. Conecte-se para escolher um original.';
}
async function registro(id,u){if(navigator.onLine)return dados.carregar(id,u);const l=(await listarLocal(u)).find(x=>x.textoId===id);if(!l)throw Error('Disponibilize este texto com internet primeiro.');return l;}
async function localStatus(u,g){const salvo=(await listarLocal(u)).find(x=>x.textoId===atual?.textoId);if(vivo(u,g))$('local').textContent=salvo?'Card e original disponíveis neste aparelho. Cópia de '+new Date(salvo.salvoEm).toLocaleString('pt-BR')+'.':'Sem cópia local. Use “Disponibilizar neste aparelho”.';}
async function abrir(id,u,g){const r=await registro(id,u);if(!vivo(u,g))return;atual=r;$('estudo').hidden=false;$('titulo').textContent=(r.card?String(r.card.numero).padStart(2,'0')+' — ':'')+r.titulo;$('original').textContent=r.original;completo=false;pt=true;visoes.card.secao=null;estudar();await localStatus(u,g);}
function estudar(){$('modo').textContent='Modo: '+(completo?'Completa':'Essencial');$('modo').setAttribute('aria-pressed',String(completo));$('portugues').textContent=pt?'Ocultar português':'Mostrar português';$('portugues').setAttribute('aria-pressed',String(pt));if(atual?.card)render($('card'),atual.card,completo,pt);else $('card').textContent='Ainda não há card. Importe o conteúdo preparado no chat.';}
function invalidar(){edicao++;candidato=null;$('salvar').hidden=true;$('preview-controles').hidden=true;$('preview').replaceChildren();}
function mostrarPrevia(){$('modo-preview').textContent='Modo: '+(previaCompleta?'Completa':'Essencial');$('modo-preview').setAttribute('aria-pressed',String(previaCompleta));$('portugues-preview').textContent=previaPt?'Ocultar português':'Mostrar português';$('portugues-preview').setAttribute('aria-pressed',String(previaPt));if(candidato)render($('preview'),candidato.c,previaCompleta,previaPt);}
$('auth').onclick=async()=>{$('auth').disabled=true;try{if(dados.uid()){limpar();await dados.sair();}else await dados.entrar();}catch(e){aviso(e.message || 'Não foi possível alterar a conta.');}finally{$('auth').disabled=false;}};
$('atualizar').onclick=()=>tarefa(atualizar);
$('importar').onclick=()=>{$('editor').hidden=false;invalidar();$('texto').focus();};
$('carregar-pacote').onclick=()=>tarefa(async(u,g)=>{invalidar();const revisao=edicao;$('editor').hidden=false;aviso('Carregando Texto 01…');let c;
  try{const r=await fetch('./texto-01.json',{cache:'no-cache'});if(!r.ok)throw Error('Pacote indisponível.');c=F.validar(await r.text());}catch{throw Error('Não foi possível carregar o Texto 01. Tente novamente em “Carregar Texto 01”.');}
  if(!vivo(u,g)||revisao!==edicao)return;$('conteudo').value=JSON.stringify(c,null,2);aviso('Texto 01 carregado. Escolha e confira manualmente o original; depois clique em “Conferir card”.');$('texto').focus();
});
$('cancelar').onclick=()=>{$('editor').hidden=true;invalidar();$('conteudo').value='';$('conferir').textContent='';};
$('conteudo').oninput=invalidar;
$('texto').onchange=()=>{invalidar();$('conferir').textContent='';if($('texto').value)tarefa(async(u,g)=>{const id=$('texto').value,r=await registro(id,u);if(vivo(u,g)&&id===$('texto').value)$('conferir').textContent=r.original;});};
$('validar').onclick=()=>tarefa(async(u,g)=>{invalidar();const revisao=edicao,id=$('texto').value;if(!id)throw Error('Escolha e confirme um original existente.');const entrada=$('conteudo').value,c=F.validar(entrada),r=await dados.carregar(id,u);F.vincular(c,r.original);if(!vivo(u,g)||revisao!==edicao||entrada!==$('conteudo').value||id!==$('texto').value)return;candidato={id,c,entrada};$('conferir').textContent=r.original;previaCompleta=false;previaPt=true;visoes.preview.secao=null;$('preview-controles').hidden=false;mostrarPrevia();$('salvar').hidden=false;aviso('Conteúdo válido. Confira o original e a prévia antes de salvar.');});
$('modo-preview').onclick=()=>{previaCompleta=!previaCompleta;mostrarPrevia();};$('portugues-preview').onclick=()=>{previaPt=!previaPt;mostrarPrevia();};
$('salvar').onclick=()=>tarefa(async(u,g)=>{const c=candidato;if(!c||c.id!==$('texto').value||c.entrada!==$('conteudo').value)throw Error('Valide novamente.');await dados.salvar(c.id,u,c.c);await removerLocal(u,c.id);if(!vivo(u,g))return;invalidar();$('editor').hidden=true;$('conteudo').value='';await abrir(c.id,u,g);aviso('Card salvo. Para atualizar a cópia offline, disponibilize novamente.');});
$('modo').onclick=()=>{completo=!completo;estudar();};$('portugues').onclick=()=>{pt=!pt;estudar();};
let shellPendente=null;
function shell(){if(!shellPendente)shellPendente=instalarShell().finally(()=>{shellPendente=null;});return shellPendente;}
async function instalarShell(){if(!('serviceWorker' in navigator))throw Error('Este navegador não permite armazenamento offline.');const reg=await navigator.serviceWorker.register('./sw.js',{scope:'/cards/',updateViaCache:'none'});
  await reg.update();
  const w=reg.installing||reg.waiting;
  if(w && w.state!=='activated')await new Promise((ok,no)=>{const timer=setTimeout(()=>no(Error('A instalação offline não terminou. Tente novamente.')),20000);const verificar=()=>{if(w.state==='activated'){clearTimeout(timer);ok();}if(w.state==='redundant'){clearTimeout(timer);no(Error('Falha na instalação dos recursos.'));}};w.addEventListener('statechange',verificar);verificar();});
  const active=(await navigator.serviceWorker.getRegistration('/cards/')).active;
  if(!active)throw Error('Instalação offline indisponível.');
  const resultado=await new Promise((ok,no)=>{const canal=new MessageChannel(),timer=setTimeout(()=>no(Error('Não foi possível verificar os recursos offline.')),10000);canal.port1.onmessage=e=>{clearTimeout(timer);ok(e.data);};active.postMessage('verificar-shell',[canal.port2]);});if(!resultado?.pronto||resultado.versao!=='consulta-2')throw Error('Recursos offline ainda não foram atualizados. Reabra com internet e tente novamente.');
}
async function atualizarRecursos(){if(!navigator.onLine)return;try{await shell();$('recursos-status').textContent='';}catch(e){$('recursos-status').textContent='Não foi possível atualizar os recursos offline dos Cards. Reabra com internet para tentar novamente. '+e.message;}}
atualizarRecursos();window.addEventListener('online',atualizarRecursos);
$('disponibilizar').onclick=()=>tarefa(async(u,g)=>{if(!atual?.card)throw Error('Importe um card primeiro.');if(!navigator.onLine)throw Error('Conecte-se para disponibilizar.');const id=atual.textoId;aviso('Armazenando recursos, card e original…');await shell();const r=await dados.carregar(id,u);if(!r.card)throw Error('Card não encontrado.');if(!vivo(u,g))return;await guardarLocal({...r,salvoEm:Date.now()});if(!vivo(u,g)){await removerLocal(u,id);return;}await localStatus(u,g);await atualizar(u,g);aviso('Armazenamento concluído. Card e original disponíveis neste aparelho.');});
$('remover').onclick=()=>tarefa(async(u,g)=>{if(!atual)return;await removerLocal(u,atual.textoId);if(!vivo(u,g))return;await localStatus(u,g);await atualizar(u,g);aviso('Cópia local removida. Dados remotos preservados.');});
$('excluir').onclick=()=>tarefa(async(u,g)=>{if(!atual?.card)return;if(!confirm('Excluir este card remoto? O original será preservado.'))return;const id=atual.textoId;await dados.excluir(id,u);await removerLocal(u,id);if(!vivo(u,g))return;await abrir(id,u,g);aviso('Card excluído. Original preservado.');});
dados.observar((u,pronto,erro)=>{limpar();conta=u;$('auth').disabled=!pronto;$('auth').textContent=u?'Sair':'Entrar com Google';$('conta').textContent=u?'Conta conectada':pronto?'Não conectado':'Verificando conta…';if(erro)aviso(erro);if(u){$('area').hidden=false;const g=geracao;atualizar(u,g).catch(e=>{if(vivo(u,g))aviso(e.message);});} });
window.addEventListener('pageshow',()=>{if(conta!==dados.uid())limpar();});
const canal=typeof BroadcastChannel==='function'?new BroadcastChannel('dl-cards-contas'):null;
if(canal)canal.onmessage=e=>{if(e.data?.tipo==='sair')limpar();if(e.data?.tipo==='excluir-texto'){const u=conta,g=geracao;if(atual?.textoId===e.data.id){atual=null;$('estudo').hidden=true;$('card').replaceChildren();$('original').textContent='';}if(u)tarefa(()=>atualizar(u,g));}};
