import './formato.js';
import * as dados from './dados.js';
import { listarLocal, guardarLocal, removerLocal } from './offline.js';

const $=id=>document.getElementById(id), F=window.DL_CARD_FORMATO;
const VERSAO='cabecalho-6';
let conta=null, geracao=0, atual=null, candidato=null, pt=true, previaPt=true, ocupado=false;
let edicao=0, origemEditor=null, revisaoId=null, inicialEditor='', copiaDisponivel=false;
const visoes={card:{secao:null},preview:{secao:null}};
const vivo=(u,g)=>u===conta && g===geracao && dados.uid()===u;
const aviso=s=>{$('status').textContent=s;};
function retorno(id,s,focar=true){const e=$(id);e.textContent=s;e.hidden=!s;if(s&&focar){e.scrollIntoView({block:'nearest'});e.focus({preventScroll:true});}}
function avisoEditor(s){retorno('conferencia-status',s,false);$('validar').parentElement.scrollIntoView({block:'start'});$('conferencia-status').focus({preventScroll:true});}
const estadoEditor=()=>JSON.stringify({id:$('texto').value,conteudo:$('conteudo').value});
function controles(){
  for(const b of document.querySelectorAll('#area button,#editor button'))b.disabled=ocupado;
  $('conteudo').disabled=ocupado;
  $('texto').disabled=ocupado || !!revisaoId;
  $('remover').disabled=ocupado || !copiaDisponivel;
}
async function tarefa(fn,responder=s=>retorno('entrada-status',s)){
  if(ocupado)return;
  ocupado=true;controles();const u=conta,g=geracao;
  try{await fn(u,g);}catch(e){if(vivo(u,g)||!u)responder(e.message || 'Não foi possível concluir.');}
  finally{ocupado=false;controles();}
}
function invalidar(){
  edicao++;candidato=null;$('salvar').hidden=true;$('preview-controles').hidden=true;
  $('preview').replaceChildren();retorno('conferencia-status','',false);
}
function limparEditor(){
  invalidar();revisaoId=null;inicialEditor='';$('conteudo').value='';$('texto').value='';
  $('texto').removeAttribute('aria-invalid');$('conferir').textContent='';$('original-escolhido').open=false;
  previaPt=true;visoes.preview.secao=null;
}
function fecharEditor(retornar=true){
  const origem=origemEditor;origemEditor=null;if($('editor').open)$('editor').close();limparEditor();
  if(retornar && origem?.isConnected && origem.getClientRects().length)origem.focus();
}
function cancelarEditor(){
  if(ocupado){avisoEditor('Aguarde a operação terminar antes de fechar.');return;}
  if(estadoEditor()!==inicialEditor && !confirm('Descartar as alterações deste card? Nada será salvo na sua conta.'))return;
  fecharEditor();
}
function limpar(){
  geracao++;conta=null;atual=null;copiaDisponivel=false;fecharEditor(false);
  $('area').hidden=true;$('entrada').hidden=false;$('estudo').hidden=true;$('consulta').hidden=true;
  $('lista').replaceChildren();$('texto').replaceChildren();
  for(const id of ['card','original','titulo','local'])$(id).replaceChildren();
  for(const id of ['entrada-status','lista-status','salvo-status','offline-status','opcoes-status'])retorno(id,'',false);
  $('opcoes-estudo').open=false;$('opcoes-entrada').open=false;$('releitura').hidden=true;visoes.card.secao=null;aviso('');
}
function render(dest,c,port=true){
  dest.replaceChildren();dest.classList.toggle('sem-pt',!port);
  const estado=visoes[dest.id], disponiveis=F.secoes.filter(s=>c.secoes[s].length);
  if(!disponiveis.includes(estado.secao))estado.secao=disponiveis[0];
  const nav=document.createElement('nav');nav.className='secoes';nav.setAttribute('aria-label','Seções do card');
  const rotulos=['Minhas dúvidas','Blocos','Sentenças','Substantivos','Verbos','Adjetivos','Advérbios'];
  for(const s of disponiveis){
    const b=document.createElement('button');b.type='button';b.textContent=rotulos[F.secoes.indexOf(s)];
    b.dataset.secao=s;b.setAttribute('aria-pressed',String(s===estado.secao));b.disabled=ocupado;
    b.onclick=()=>{estado.secao=s;render(dest,c,port);dest.querySelector('.secoes [aria-pressed="true"]').focus({preventScroll:true});};nav.append(b);
  }
  dest.append(nav);if(!estado.secao)return;
  const caixa=document.createElement('div');caixa.className='secao-caixa';
  const h=document.createElement('h3');h.textContent=estado.secao==='duvidas'?'Minhas dúvidas':F.nomes[F.secoes.indexOf(estado.secao)];caixa.append(h);
  if(estado.secao==='blocos'){
    const p=document.createElement('p');p.className='nota';p.textContent='Reconheça o bloco inteiro pelo sentido, sem remontar palavra por palavra. Nem todo bloco é uma expressão fixa.';caixa.append(p);
  }
  for(const i of c.secoes[estado.secao]){
    const linha=document.createElement('div');linha.className='linha';const par=document.createElement('div');par.className='par';
    for(const [cl,txt] of [['de',i.de],['pt seta','→'],['pt',i.pt]]){
      const span=document.createElement('span');span.className=cl;span.textContent=txt;if(cl==='de')span.lang='de';par.append(span);
    }
    linha.append(par);
    if(i.origem && i.origem.trim()!==i.de.trim()){
      const contexto=document.createElement('details');contexto.className='contexto';const sum=document.createElement('summary');sum.textContent='Ver contexto';
      const p=document.createElement('p');p.lang='de';p.textContent=i.origem;contexto.append(sum,p);linha.append(contexto);
    }
    caixa.append(linha);
  }
  dest.append(caixa);
}
async function atualizar(u,g){
  let locais=await listarLocal(u),textos;
  if(navigator.onLine){
    try{
      textos=await dados.textos(u);const ids=new Set(textos.map(t=>t.id));
      for(const l of locais)if(!ids.has(l.textoId))await removerLocal(u,l.textoId);
      locais=locais.filter(l=>ids.has(l.textoId));
    }catch(e){if(!locais.length)throw e;retorno('entrada-status','Servidor indisponível. Exibindo somente cópias deste aparelho.',false);}
  }
  if(!textos)textos=locais.map(l=>({id:l.textoId,titulo:l.titulo}));if(!vivo(u,g))return;
  const escolhido=$('texto').value;$('lista').replaceChildren();$('texto').replaceChildren(new Option('Escolha e confirme o original',''));
  textos.forEach((t,i)=>{
    const b=document.createElement('button');b.dataset.textoId=t.id;
    b.textContent=String(i+1).padStart(2,'0')+' — '+t.titulo+(locais.some(l=>l.textoId===t.id)?' · sem internet':'');
    b.onclick=()=>tarefa((u,g)=>abrir(t.id,u,g));$('lista').append(b);
    $('texto').append(new Option(String(i+1).padStart(2,'0')+' — '+t.titulo,t.id));
  });
  if(textos.some(t=>t.id===escolhido))$('texto').value=escolhido;
  else if($('editor').open){invalidar();$('conferir').textContent='';}
  if(!textos.length)$('lista').textContent='Nenhum texto disponível. Conecte-se para escolher um original.';
}
async function registro(id,u){
  if(navigator.onLine)return dados.carregar(id,u);
  const l=(await listarLocal(u)).find(x=>x.textoId===id);if(!l)throw Error('Use sem internet com uma conexão ativa primeiro.');return l;
}
async function localStatus(u,g){
  const id=atual?.textoId,salvo=(await listarLocal(u)).find(x=>x.textoId===id);
  if(!vivo(u,g)||id!==atual?.textoId)return;
  copiaDisponivel=!!salvo;
  $('local').textContent=salvo?'Disponível sem internet':'Sem cópia neste aparelho';
  controles();
}
function estudar(){
  $('consulta').hidden=!atual?.card;$('sem-card').hidden=!!atual?.card;
  $('portugues').textContent=pt?'Ocultar tradução':'Mostrar tradução';$('portugues').setAttribute('aria-pressed',String(pt));
  if(atual?.card)render($('card'),atual.card,pt);else $('card').replaceChildren();
}
function exibirEstudo(r){
  atual=r;pt=true;visoes.card.secao=null;
  $('entrada').hidden=true;$('estudo').hidden=false;
  $('titulo').textContent=(r.card?String(r.card.numero).padStart(2,'0')+' — ':'')+r.titulo;$('original').textContent=r.original;
  $('opcoes-estudo').open=false;$('releitura').hidden=true;$('reler').setAttribute('aria-expanded','false');
  for(const id of ['salvo-status','offline-status','opcoes-status'])retorno(id,'',false);
  estudar();$('titulo').scrollIntoView({block:'start'});$('titulo').focus({preventScroll:true});
}
async function abrir(id,u,g){const r=await registro(id,u);if(!vivo(u,g))return;exibirEstudo(r);await localStatus(u,g);}
function abrirEditor(origem,r=null,revisao=false){
  limparEditor();origemEditor=origem;revisaoId=revisao?r.textoId:null;
  $('editor-titulo').textContent=revisao?'Revisar card':'Adicionar card';
  $('editor-instrucao').textContent=revisao?'Revise o conteúdo deste card, confira a prévia e salve. A revisão atualiza o mesmo registro.':'Escolha e confira o original, cole o conteúdo preparado no chat, confira a prévia e salve.';
  if(r){$('texto').value=r.textoId;$('conferir').textContent=r.original;}
  if(revisao)$('conteudo').value=JSON.stringify(r.card,null,2);
  inicialEditor=estadoEditor();controles();$('editor').showModal();$('editor').scrollTop=0;
  (r?$('conteudo'):$('texto')).focus();
}
function mostrarPrevia(){
  $('portugues-preview').textContent=previaPt?'Ocultar tradução':'Mostrar tradução';$('portugues-preview').setAttribute('aria-pressed',String(previaPt));
  if(candidato)render($('preview'),candidato.c,previaPt);
}
$('auth').onclick=async()=>{
  $('auth').disabled=true;try{if(dados.uid()){limpar();await dados.sair();}else await dados.entrar();}catch(e){aviso(e.message || 'Não foi possível alterar a conta.');}finally{$('auth').disabled=false;}
};
$('atualizar').onclick=()=>tarefa(async(u,g)=>{retorno('lista-status','Atualizando lista…',false);await atualizar(u,g);if(vivo(u,g))retorno('lista-status','✓ Lista atualizada');},s=>retorno('lista-status',s));
$('voltar').onclick=()=>{$('estudo').hidden=true;$('entrada').hidden=false;const b=[...$('lista').querySelectorAll('button')].find(b=>b.dataset.textoId===atual?.textoId);(b||$('importar')).focus();};
$('importar').onclick=e=>abrirEditor(e.currentTarget);
$('adicionar-para-texto').onclick=e=>abrirEditor(e.currentTarget,atual);
$('revisar').onclick=e=>{const origem=e.currentTarget;tarefa(async(u,g)=>{
  retorno('opcoes-status','Carregando card…',false);const r=await registro(atual.textoId,u);
  if(!vivo(u,g))return;if(!r.card)throw Error('Este texto não tem mais card. Abra-o novamente para adicionar.');
  retorno('opcoes-status','',false);abrirEditor(origem,r,true);
},s=>retorno('opcoes-status',s)).then(()=>{if($('editor').open)$('conteudo').focus();});};
$('cancelar').onclick=cancelarEditor;
$('editor').addEventListener('cancel',e=>{e.preventDefault();cancelarEditor();});
$('conteudo').oninput=invalidar;
$('texto').onchange=()=>{
  invalidar();$('texto').removeAttribute('aria-invalid');$('conferir').textContent='';
  if($('texto').value)tarefa(async(u,g)=>{const id=$('texto').value,r=await registro(id,u);if(vivo(u,g)&&id===$('texto').value)$('conferir').textContent=r.original;},avisoEditor);
};
$('carregar-pacote').onclick=()=>tarefa(async(u,g)=>{
  const revisao=edicao;avisoEditor('Carregando Texto 01…');let c;
  try{const r=await fetch('./texto-01.json',{cache:'no-cache'});if(!r.ok)throw Error();c=F.validar(await r.text());}catch{throw Error('Não foi possível carregar o Texto 01. Tente novamente em “Carregar Texto 01”.');}
  if(!vivo(u,g)||revisao!==edicao)return;const novo=JSON.stringify(c,null,2);
  if($('conteudo').value.trim() && $('conteudo').value!==novo && !confirm('Substituir o conteúdo digitado pelo Texto 01?')){avisoEditor('Conteúdo digitado preservado.');return;}
  invalidar();$('conteudo').value=novo;avisoEditor('Texto 01 carregado. Confira manualmente o original e clique em “Conferir card”.');
},avisoEditor);
$('validar').onclick=()=>tarefa(async(u,g)=>{
  invalidar();avisoEditor('Conferindo card…');$('texto').removeAttribute('aria-invalid');
  const revisao=edicao,id=$('texto').value;
  if(!id){$('texto').setAttribute('aria-invalid','true');throw Error('Escolha um original no campo “Texto existente”, acima, e confira novamente.');}
  if(revisaoId && id!==revisaoId)throw Error('A revisão deve manter o texto deste card.');
  const entrada=$('conteudo').value,c=F.validar(entrada);
  if(!navigator.onLine)throw Error('Conecte-se para conferir e salvar. O conteúdo digitado será preservado.');
  const r=await dados.carregar(id,u);F.vincular(c,r.original);
  if(!vivo(u,g)||revisao!==edicao||entrada!==$('conteudo').value||id!==$('texto').value)return;
  candidato={id,c,entrada,registro:r};$('conferir').textContent=r.original;previaPt=true;visoes.preview.secao=null;
  $('preview-controles').hidden=false;mostrarPrevia();$('salvar').hidden=false;avisoEditor('Prévia pronta logo abaixo. Confira o original e o card antes de salvar.');
},avisoEditor);
$('portugues-preview').onclick=()=>{previaPt=!previaPt;mostrarPrevia();};
$('salvar').onclick=()=>tarefa(async(u,g)=>{
  const c=candidato;if(!c||c.id!==$('texto').value||c.entrada!==$('conteudo').value)throw Error('Confira a prévia novamente antes de salvar.');
  if(!navigator.onLine)throw Error('Conecte-se para salvar. O conteúdo digitado será preservado.');
  avisoEditor('Salvando card…');await dados.salvar(c.id,u,c.c);
  let falhaLocal=false;try{await removerLocal(u,c.id);}catch{falhaLocal=true;}
  if(!vivo(u,g))return;
  fecharEditor(false);exibirEstudo({...c.registro,card:c.c});
  try{await localStatus(u,g);}catch{falhaLocal=true;copiaDisponivel=false;$('local').textContent='Cópia deste aparelho não confirmada';}
  retorno('salvo-status','✓ Card salvo');
  if(falhaLocal)retorno('offline-status','A cópia deste aparelho não foi atualizada. Use sem internet novamente.',false);
},avisoEditor);
$('portugues').onclick=()=>{pt=!pt;estudar();};
$('reler').onclick=()=>{const abrir=$('releitura').hidden;$('releitura').hidden=!abrir;$('reler').setAttribute('aria-expanded',String(abrir));if(abrir){$('original').scrollIntoView({block:'nearest'});$('original').focus({preventScroll:true});}};
let shellPendente=null;
function shell(){if(!shellPendente)shellPendente=instalarShell().finally(()=>{shellPendente=null;});return shellPendente;}
async function instalarShell(){
  if(!('serviceWorker' in navigator))throw Error('Este navegador não permite armazenamento offline.');
  const reg=await navigator.serviceWorker.register('./sw.js',{scope:'/cards/',updateViaCache:'none'});await reg.update();
  const w=reg.installing||reg.waiting;
  if(w && w.state!=='activated')await new Promise((ok,no)=>{
    const timer=setTimeout(()=>no(Error('A instalação offline não terminou. Tente novamente.')),20000);
    const verificar=()=>{if(w.state==='activated'){clearTimeout(timer);ok();}if(w.state==='redundant'){clearTimeout(timer);no(Error('Falha na instalação dos recursos.'));}};
    w.addEventListener('statechange',verificar);verificar();
  });
  const active=(await navigator.serviceWorker.getRegistration('/cards/')).active;if(!active)throw Error('Instalação offline indisponível.');
  const resultado=await new Promise((ok,no)=>{
    const canal=new MessageChannel(),timer=setTimeout(()=>no(Error('Não foi possível verificar os recursos offline.')),10000);
    canal.port1.onmessage=e=>{clearTimeout(timer);ok(e.data);};active.postMessage('verificar-shell',[canal.port2]);
  });
  if(!resultado?.pronto||resultado.versao!==VERSAO)throw Error('Recursos offline ainda não foram atualizados. Reabra com internet e tente novamente.');
}
async function atualizarRecursos(){if(!navigator.onLine)return;try{await shell();$('recursos-status').textContent='';}catch(e){$('recursos-status').textContent='Não foi possível atualizar os recursos offline dos Cards. Reabra com internet para tentar novamente. '+e.message;}}
atualizarRecursos();window.addEventListener('online',atualizarRecursos);
$('disponibilizar').onclick=()=>tarefa(async(u,g)=>{
  if(!atual?.card)throw Error('Adicione um card primeiro.');if(!navigator.onLine)throw Error('Conecte-se para usar sem internet neste aparelho.');
  const id=atual.textoId;retorno('offline-status','Armazenando card e texto…');await shell();
  const r=await dados.carregar(id,u);if(!r.card)throw Error('Card não encontrado.');if(!vivo(u,g))return;
  await guardarLocal({...r,salvoEm:Date.now()});if(!vivo(u,g)){await removerLocal(u,id);return;}
  await localStatus(u,g);await atualizar(u,g);if(vivo(u,g))retorno('offline-status','✓ Disponível sem internet');
},s=>retorno('offline-status',s));
$('remover').onclick=()=>tarefa(async(u,g)=>{
  if(!atual || !copiaDisponivel)return;
  if(!confirm('Remover a cópia deste aparelho? O card e o texto original continuarão salvos na sua conta.'))return;
  await removerLocal(u,atual.textoId);if(!vivo(u,g))return;await localStatus(u,g);await atualizar(u,g);
  if(vivo(u,g))retorno('opcoes-status','✓ Cópia deste aparelho removida. Card e original preservados na conta.');
},s=>retorno('opcoes-status',s));
$('excluir').onclick=()=>tarefa(async(u,g)=>{
  if(!atual?.card)return;
  if(!confirm('Excluir este card da sua conta e a cópia deste aparelho? Esta ação apaga o card remoto. O texto original será preservado.'))return;
  if(!navigator.onLine)throw Error('Conecte-se para excluir o card da sua conta.');
  const r=atual;await dados.excluir(r.textoId,u);await removerLocal(u,r.textoId);if(!vivo(u,g))return;
  exibirEstudo({...r,card:null});await localStatus(u,g);retorno('salvo-status','✓ Card excluído. Texto original preservado.');
},s=>retorno('opcoes-status',s));
dados.observar((u,pronto,erro)=>{
  limpar();conta=u;$('auth').disabled=!pronto;$('auth').textContent=u?'Sair':'Entrar com Google';
  $('conta').classList.toggle('conectado',!!u);$('conta').textContent=u?'Conectado':pronto?'Não conectado':'Verificando conta…';if(erro)aviso(erro);
  if(u){$('area').hidden=false;const g=geracao;atualizar(u,g).catch(e=>{if(vivo(u,g))retorno('entrada-status',e.message);});}
});
window.addEventListener('pageshow',()=>{if(conta!==dados.uid())limpar();});
const canal=typeof BroadcastChannel==='function'?new BroadcastChannel('dl-cards-contas'):null;
if(canal)canal.onmessage=e=>{
  if(e.data?.tipo==='sair')limpar();
  if(e.data?.tipo==='excluir-texto'){
    const u=conta,g=geracao;if(revisaoId===e.data.id || $('texto').value===e.data.id)fecharEditor(false);
    if(atual?.textoId===e.data.id){atual=null;$('estudo').hidden=true;$('entrada').hidden=false;$('card').replaceChildren();$('original').textContent='';}
    if(u)tarefa(()=>atualizar(u,g));
  }
};
