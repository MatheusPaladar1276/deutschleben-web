const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const deps=createRequire(path.join(os.tmpdir(),'dl-textos-tests/package.json'));
const {initializeTestEnvironment,assertSucceeds,assertFails}=deps('@firebase/rules-unit-testing');
const sdk=deps('firebase/firestore'), F=require('../webapp/cards/formato.js');
const UID='WuXcMYo6m3OuQttlk7z22gRjlvn1';let n=0;sdk.setLogLevel('silent');
const ok=async p=>{await assertSucceeds(p);n++;},no=async p=>{await assertFails(p);n++;};
async function main(){
 const c=JSON.parse(fs.readFileSync('webapp/cards/texto-01.json','utf8'));assert.equal(F.validar(c).secoes.blocos.length,5);
 assert.throws(()=>F.validar('{'));assert.throws(()=>F.validar({...c,versao:2}));assert.throws(()=>F.validar({...c,original:'não duplicar'}));
 for(const campo of ['de','pt','essencial']){const b=structuredClone(c);delete b.secoes.duvidas[0][campo];assert.throws(()=>F.validar(b));}
 const b=structuredClone(c);b.secoes.blocos[0].origem='Ausente';assert.throws(()=>F.vincular(b,'Hallo'));
 const html=structuredClone(c);html.secoes.duvidas[0].de='<img src=x onerror=alert(1)>';assert.equal(F.validar(html).secoes.duvidas[0].de,html.secoes.duvidas[0].de);
 assert(!JSON.stringify(c).includes('Wind'));n+=10;
 const env=await initializeTestEnvironment({projectId:'demo-dl-textos',firestore:{host:'127.0.0.1',port:8188,rules:fs.readFileSync('firestore.rules','utf8')}});
 try{await env.clearFirestore();const db=env.authenticatedContext(UID).firestore();const t=sdk.doc(db,'textos','card-source'),r=sdk.doc(db,'textos','card-source','cards',UID),s=sdk.doc(db,'textos','card-source','resumos',UID);
 const novo=(extra={})=>({uid:UID,textoId:'card-source',versao:1,conteudo:JSON.stringify(c),criadoEm:sdk.serverTimestamp(),atualizadoEm:sdk.serverTimestamp(),...extra});
 await no(sdk.setDoc(r,novo()));await ok(sdk.setDoc(t,{titulo:'Teste',conteudo:'Hallo',estado:'recebido',criadoEm:sdk.serverTimestamp()}));await ok(sdk.getDocFromServer(r));
 for(const extra of [{uid:'other'},{textoId:'other'},{versao:2},{conteudo:''},{conteudo:7},{conteudo:'x'.repeat(60001)},{original:'Hallo'},{criadoEm:sdk.Timestamp.fromMillis(0)},{atualizadoEm:sdk.Timestamp.fromMillis(0)}])await no(sdk.setDoc(r,novo(extra)));
 const missing=novo();delete missing.uid;await no(sdk.setDoc(r,missing));await no(sdk.setDoc(sdk.doc(db,'textos','card-source','cards','other'),novo()));
 await ok(sdk.setDoc(r,novo()));const criado=(await sdk.getDocFromServer(r)).data().criadoEm;
 await ok(sdk.updateDoc(r,{conteudo:JSON.stringify({...c,titulo:'Revisão'}),atualizadoEm:sdk.serverTimestamp()}));assert.equal((await sdk.getDocFromServer(r)).data().criadoEm.toMillis(),criado.toMillis());
 await no(sdk.updateDoc(r,{criadoEm:sdk.Timestamp.fromMillis(1),atualizadoEm:sdk.serverTimestamp()}));
 await no(sdk.getDocs(sdk.collection(db,'textos','card-source','cards')));await no(sdk.deleteDoc(t));
 for(const ctx of [env.unauthenticatedContext(),env.authenticatedContext('other')]){const x=sdk.doc(ctx.firestore(),'textos','card-source','cards',UID);await no(sdk.getDocFromServer(x));await no(sdk.setDoc(x,novo()));await no(sdk.deleteDoc(x));}
 await ok(sdk.deleteDoc(r));assert((await sdk.getDocFromServer(t)).exists());await ok(sdk.setDoc(r,novo()));
 await ok(sdk.setDoc(s,{uid:UID,textoId:'card-source',conteudo:'Resumo',criadoEm:sdk.serverTimestamp(),atualizadoEm:sdk.serverTimestamp()}));
 let batch=sdk.writeBatch(db);batch.delete(t);batch.delete(s);await no(batch.commit());
 batch=sdk.writeBatch(db);batch.delete(t);batch.delete(r);await no(batch.commit());
 batch=sdk.writeBatch(db);batch.delete(t);batch.delete(s);batch.delete(r);await ok(batch.commit());
 await env.withSecurityRulesDisabled(async ctx=>{const admin=ctx.firestore();for(const p of [['textos','card-source'],['textos','card-source','cards',UID],['textos','card-source','resumos',UID]])assert(!(await sdk.getDoc(sdk.doc(admin,...p))).exists());});
 batch=sdk.writeBatch(db);batch.set(t,{titulo:'Teste',conteudo:'Hallo',estado:'recebido',criadoEm:sdk.serverTimestamp()});batch.set(r,novo());await ok(batch.commit());
 batch=sdk.writeBatch(db);batch.delete(t);batch.update(r,{conteudo:'revision',atualizadoEm:sdk.serverTimestamp()});await no(batch.commit());
 console.log(`${n} verificações de formato, revisão, autorização e exclusão passaram; somente emulador.`);
 }finally{await env.cleanup();}
}main().catch(e=>{console.error(e);process.exitCode=1;});
