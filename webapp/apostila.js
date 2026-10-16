import { partesDestacadas } from './destaques-blocos.js?v=blocos-16';
import { agruparBlocos, blocosDosRegistros } from './blocos.js';
const overlay=document.getElementById('estrada-overlay'),inputBusca=document.getElementById('estrada-busca'),filtros=document.getElementById('estrada-filtros'),lista=document.getElementById('estrada-lista'),contador=document.getElementById('estrada-contador');
const status=document.createElement('p');status.id='apostila-status';status.setAttribute('role','status');contador.after(status);
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let estaticos=[],privados=[],dados=[],basePendente=null,grupoAtivo='todos',geracao=0;
const usuario=()=>window.DL_AUTH?.usuario?.uid||null;
    const FONTES = [
        { arq: "./data/substantivos.json", map: it => ({ termo: ((it.artigo ? it.artigo + " " : "") + it.palavra).trim(), sentido: it.significado, tipo: "Substantivo", grupo: "sub", origem: it.origem, extra: it.plural ? ("Plural: " + it.plural) : "" }) },
        { arq: "./data/verbos.json", map: it => ({ termo: it.verbo, sentido: it.significado, tipo: "Verbo", grupo: "verb", origem: it.origem, extra: [it.praeteritum ? ("Prät.: " + it.praeteritum) : "", it.partizip_ii ? ("Part. II: " + it.partizip_ii) : ""].filter(Boolean).join(" · ") }) },
        { arq: "./data/adjetivos_adverbios.json", map: it => ({ termo: it.palavra, sentido: it.significado, tipo: (it.categoria === "ADV" ? "Advérbio" : "Adjetivo"), grupo: "adjadv", origem: it.origem, extra: "" }) },
        { arq: "./data/blocos.json", map: it => ({ termo: it.bloco, sentido: it.sentido, tipo: "Expressão/Bloco", grupo: "bloco", origem: it.origem, contexto: it.contexto, outroExemplo: it.outroExemplo, extra: it.tipo ? String(it.tipo).replace(/_/g, " ").toLowerCase() : "" }) },
    ];


async function carregarBase(){
  if(!basePendente)basePendente=Promise.all(FONTES.map(async f=>{
    try{const r=await fetch(f.arq);if(!r.ok)throw Error();return (await r.json()).map(f.map);}catch{return [];}
  })).then(fontes=>{estaticos=fontes.flat();});
  return basePendente;
}
function recompor(){dados=agruparBlocos([...estaticos,...privados]);render();}
function fraseBloco(bloco,frase){return partesDestacadas(bloco,frase).map(p=>p.destaque?'<strong>'+esc(p.texto)+'</strong>':esc(p.texto)).join('');}
function outroExemplo(exemplos,bloco){
  return exemplos?.length?'<details class="apostila-exemplo"><summary>Outro exemplo</summary>'+exemplos.map(e=>'<div class="exemplo-caixa"><p lang="de">'+fraseBloco(bloco,e.de)+'</p><p>'+esc(e.pt)+'</p></div>').join('')+'</details>':'';
}
function render(){
  const termo=inputBusca.value.trim().toLocaleLowerCase('de');
  const filtrados=dados.filter(i=>(grupoAtivo==='todos'||i.grupo===grupoAtivo)&&(!termo||(i.termo+' '+i.sentido).toLocaleLowerCase('de').includes(termo)));
  contador.textContent=filtrados.length+' de '+dados.length+' itens';
  lista.innerHTML=filtrados.length?filtrados.map(i=>{
    let html='<div class="estrada-item"><div><span class="estrada-termo">'+esc(i.termo)+'</span><span class="estrada-tipo">'+esc(i.tipo)+'</span></div><div class="estrada-sentido">'+esc(i.sentido)+'</div>';
    if(i.grupo==='bloco'){
      html+=i.ocorrencias.map(o=>'<div class="estrada-meta">'+[o.extra,o.origem,o.titulo&&!o.origem.endsWith(o.titulo)?o.titulo:''].filter(Boolean).map(esc).join(' — ')+(o.contexto?'<details class="apostila-contexto"><summary>Ver contexto</summary><p lang="de">'+fraseBloco(i.termo,o.contexto)+'</p></details>':'')+'</div>').join('');
      html+=outroExemplo(i.outrosExemplos,i.termo);
    }else if(i.extra||i.origem)html+='<div class="estrada-meta">'+[i.extra,i.origem].filter(Boolean).map(esc).join(' — ')+'</div>';
    return html+'</div>';
  }).join(''):'<p class="estrada-vazio">Nenhum resultado.</p>';
}
async function atualizar(){
  const g=++geracao,u=usuario();privados=[];status.textContent='';recompor();
  await carregarBase();if(g!==geracao)return;recompor();
  if(!u || !window.DL_DADOS?.listarBlocosCards)return;
  status.textContent='Consultando seus blocos…';
  try{
    const resultado=await window.DL_DADOS.listarBlocosCards(u);
    const itens=await blocosDosRegistros(resultado.registros);
    if(g!==geracao||u!==usuario())return;
    privados=itens;recompor();
    status.textContent=resultado.offline?'Sem internet: exibindo os blocos dos Cards disponíveis neste aparelho.':resultado.parcial?'Alguns Cards não puderam ser consultados; exibindo os blocos disponíveis.':'';
  }catch{if(g===geracao&&u===usuario()){privados=[];recompor();status.textContent='Não foi possível consultar seus blocos.';}}
}
filtros.addEventListener('click',e=>{const b=e.target.closest('.estrada-filtro');if(!b)return;filtros.querySelectorAll('.estrada-filtro').forEach(x=>x.classList.remove('ativo'));b.classList.add('ativo');grupoAtivo=b.dataset.grupo;render();});
inputBusca.addEventListener('input',render);
window.abrirEstrada=()=>{overlay.classList.add('aberta');document.body.style.overflow='hidden';atualizar();setTimeout(()=>inputBusca.focus(),50);};
window.fecharEstrada=()=>{overlay.classList.remove('aberta');document.body.style.overflow='';};
overlay.addEventListener('click',e=>{if(e.target===overlay)window.fecharEstrada();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&overlay.classList.contains('aberta'))window.fecharEstrada();});
function invalidar(){++geracao;privados=[];status.textContent='';recompor();if(overlay.classList.contains('aberta'))atualizar();}
window.addEventListener('dl-auth-alterado',invalidar);
window.addEventListener('online',invalidar);window.addEventListener('offline',invalidar);
const canal=typeof BroadcastChannel==='function'?new BroadcastChannel('dl-cards-contas'):null;
if(canal)canal.onmessage=e=>{if(['sair','excluir-texto','cards-alterados'].includes(e.data?.tipo))invalidar();};
