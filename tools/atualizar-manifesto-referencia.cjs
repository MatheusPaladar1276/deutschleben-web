const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const web=path.resolve(__dirname,'..','webapp'),arquivo=path.join(web,'data','referencia','manifesto.json');
const versao=fs.readFileSync(path.join(web,'referencia-dados.js'),'utf8').match(/export const VERSAO = '([^']+)';/)?.[1];
if(!versao)throw Error('Versão da referência não encontrada.');
const manifesto=JSON.parse(fs.readFileSync(arquivo,'utf8'));
const urls=new Map([
  ['referencia.js','referencia.js?v=rg-01-10-v11'],
  ['referencia-dados.js','referencia-dados.js?v=rg-01-10-v11'],
  ['referencia.css','referencia.css?v=rg-01-10-v11'],
  ['textos.js','textos.js?v=dl-web-11'],
  ['firebase-dados.js','firebase-dados.js?v=memorizar-07'],
  ['cards/offline.js','cards/offline.js?v=memorizar-07']
]);
manifesto.versao=versao;
for(const recurso of manifesto.recursos){
  const nome=recurso.url.split('?')[0],origem=path.resolve(web,nome);
  if(!origem.startsWith(web+path.sep))throw Error('Recurso fora do pacote: '+nome);
  recurso.url=urls.get(nome)||recurso.url;
  recurso.sha256=createHash('sha256').update(fs.readFileSync(origem)).digest('hex');
}
fs.writeFileSync(arquivo,JSON.stringify(manifesto,null,2)+'\n');
console.log('Manifesto atualizado: '+versao+' · '+manifesto.recursos.length+' recursos.');
