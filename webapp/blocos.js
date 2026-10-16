// Blocos pessoais: projecao em memoria, sem copia para outra colecao.
export const normalizar=s=>String(s??'').normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('de');
const chave=i=>JSON.stringify([normalizar(i.de??i.termo),normalizar(i.pt??i.sentido)]);
let modeloPendente;
export function carregarModelo(){
  if(!modeloPendente)modeloPendente=fetch(new URL('./cards/texto-01.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Modelo indisponivel');return r.json();}).catch(e=>{modeloPendente=null;throw e;});
  return modeloPendente;
}
export function completarExemplos(card,modelo){
  if(!card || card.numero!==modelo.numero || normalizar(card.titulo)!==normalizar(modelo.titulo))return card;
  const base=modelo.secoes.blocos;
  return {...card,secoes:{...card.secoes,blocos:card.secoes.blocos.map(i=>{
    if(i.outroExemplo)return i;
    const m=base.find(m=>chave(m)===chave(i) && normalizar(m.origem)===normalizar(i.origem));
    return m?.outroExemplo?{...i,outroExemplo:{...m.outroExemplo}}:i;
  })}};
}
export async function prepararCard(card){
  if(!card || card.numero!==1)return card;
  try{return completarExemplos(card,await carregarModelo());}catch{return card;}
}
export async function blocosDosRegistros(registros){
  const itens=[];
  for(const r of registros){
    const c=await prepararCard(r.card);
    if(!c)continue;
    for(const i of c.secoes.blocos)itens.push({termo:i.de,sentido:i.pt,tipo:'Express\u00e3o/Bloco',grupo:'bloco',extra:'',origem:'Card '+String(c.numero).padStart(2,'0')+' \u2014 '+c.titulo,titulo:r.titulo||c.titulo,textoId:r.textoId,contexto:i.origem,outroExemplo:i.outroExemplo});
  }
  return itens;
}
export function agruparBlocos(itens){
  const grupos=new Map(),saida=[];
  for(const item of itens){
    if(item.grupo!=='bloco'){saida.push(item);continue;}
    const k=chave(item);let grupo=grupos.get(k);
    if(!grupo){grupo={...item,ocorrencias:[],outrosExemplos:[]};grupos.set(k,grupo);saida.push(grupo);}
    const ocorrencia={origem:item.origem||'',titulo:item.titulo||'',textoId:item.textoId||'',contexto:item.contexto||'',extra:item.extra||''};
    if(!grupo.ocorrencias.some(o=>JSON.stringify(o)===JSON.stringify(ocorrencia)))grupo.ocorrencias.push(ocorrencia);
    const ex=item.outroExemplo;
    if(ex && !grupo.outrosExemplos.some(e=>chave(e)===chave(ex)))grupo.outrosExemplos.push({...ex});
  }
  return saida.sort((a,b)=>a.termo.localeCompare(b.termo,'de'));
}
