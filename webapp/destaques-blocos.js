// Correspondencias literais e construcoes revisadas; sem radicalizacao ou busca aproximada.
const palavra='[\\p{L}\\p{M}\\p{N}_]';
const escapar=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const padrao=s=>s.trim().split(/\s+/u).map(escapar).join('\\s+');
const pessoa='(?:ich|du|er|sie|es|wir|ihr)';
const intervalo='(\\s+(?:'+pessoa+'\\s+)?)';
const devagar='(\\s+(?:'+pessoa+'\\s+)?(?:langsam\\s+)?)';
const sein='(bin|bist|ist|sind|seid)',haben='(habe|hast|hat|haben|habt)';
const regras={
  'einen moment stehen bleiben':[
    ['(bleibe|bleibst|bleibt|bleiben|blieb|bliebst|blieben|bliebt)'+intervalo+'(einen\\s+Moment)(\\s+)(stehen)',[1,3,5]],
    [sein+intervalo+'(einen\\s+Moment)(\\s+)(stehen\\s+geblieben)',[1,3,5]]
  ],
  'zum haus zur\u00fcckgehen':[
    ['(gehe|gehst|geht|gehen|ging|gingst|gingen|gingt)'+devagar+'(zum\\s+Haus)(\\s+)(zur\u00fcck)',[1,3,5]],
    [sein+devagar+'(zum\\s+Haus)(\\s+)(zur\u00fcckgegangen)',[1,3,5]]
  ],
  'an den tag denken':[
    ['(denke|denkst|denkt|denken|dachte|dachtest|dachten|dachtet)'+intervalo+'(an\\s+den\\s+Tag)',[1,3]],
    [haben+intervalo+'(an\\s+den\\s+Tag)(\\s+)(gedacht)',[1,3,5]]
  ]
};
const normalizar=s=>s.normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('de');
export function partesDestacadas(bloco,frase){
  const texto=String(frase??''),termo=String(bloco??'').trim(),faixas=[];
  if(!termo)return [{texto,destaque:false}];
  const regex=s=>new RegExp('(?<!'+palavra+')'+s+'(?!'+palavra+')','giu');
  for(const m of texto.matchAll(regex(padrao(termo))))faixas.push([m.index,m.index+m[0].length]);
  for(const [regra,grupos] of regras[normalizar(termo)]||[]){
    for(const m of texto.matchAll(regex(regra))){
      let pos=m.index;
      for(let i=1;i<m.length;i++){const fim=pos+m[i].length;if(grupos.includes(i))faixas.push([pos,fim]);pos=fim;}
    }
  }
  const unidas=[];
  for(const f of faixas.sort((a,b)=>a[0]-b[0]||a[1]-b[1])){
    const ant=unidas.at(-1);if(ant&&f[0]<=ant[1])ant[1]=Math.max(ant[1],f[1]);else unidas.push([...f]);
  }
  const partes=[];let pos=0;
  for(const [inicio,fim] of unidas){if(inicio>pos)partes.push({texto:texto.slice(pos,inicio),destaque:false});partes.push({texto:texto.slice(inicio,fim),destaque:true});pos=fim;}
  if(pos<texto.length)partes.push({texto:texto.slice(pos),destaque:false});
  return partes.length?partes:[{texto,destaque:false}];
}
export function preencherFraseBloco(dest,bloco,frase){
  dest.replaceChildren();
  for(const p of partesDestacadas(bloco,frase)){
    const n=p.destaque?document.createElement('strong'):document.createTextNode(p.texto);
    if(p.destaque)n.textContent=p.texto;dest.append(n);
  }
}
