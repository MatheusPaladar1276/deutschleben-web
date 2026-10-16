const assert=require('node:assert/strict');
(async()=>{
 const {partesDestacadas:p}=await import('../webapp/destaques-blocos.js');
 const cases=[
  ['am fr\u00fchen Morgen','Am fr\u00fchen Morgen gehe ich zum See.',['Am fr\u00fchen Morgen']],
  ['einen Moment stehen bleiben','Du bleibst einen Moment stehen.',['bleibst','einen Moment','stehen']],
  ['einen Moment stehen bleiben','Ich bin einen Moment stehen geblieben.',['bin','einen Moment','stehen geblieben']],
  ['zum Haus zur\u00fcckgehen','Heute geht sie langsam zum Haus zur\u00fcck.',['geht','zum Haus','zur\u00fcck']],
  ['zum Haus zur\u00fcckgehen','Wir sind zum Haus zur\u00fcckgegangen.',['sind','zum Haus','zur\u00fcckgegangen']],
  ['an den Tag denken','Gestern dachtest du an den Tag.',['dachtest','an den Tag']],
  ['an den Tag denken','Ich habe an den Tag gedacht.',['habe','an den Tag','gedacht']],
  ['am fr\u00fchen Morgen','Am fr\u00fchen Morgenrot.',[]],
  ['an den Tag denken','Ich bedenke an den Tag.',[]],
  ['an den Tag denken','Ich denke an andere Dinge; an den Tag.',[]],
  ['zum Haus zur\u00fcckgehen','Ich gehe spazieren. Zum Haus komme ich zur\u00fcck.',[]],
  ['unbekannter Block','Ich denke an den Tag.',[]],
  ['a.b','axb a.b axb',['a.b']],
  ['[abc','[abc',['[abc']],
  ['am fr\u00fchen Morgen','<img src=x onerror=alert(1)> Am fr\u00fchen Morgen.',['Am fr\u00fchen Morgen']]
 ];
 for(const [bloco,frase,bold] of cases){const a=p(bloco,frase);assert.equal(a.map(x=>x.texto).join(''),frase);assert.deepEqual(a.filter(x=>x.destaque).map(x=>x.texto),bold,frase);}
 console.log('PASS: 15 casos de correspondencia segura, flexoes, verbos separados, limites de palavra, literais de regex e preservacao integral do texto.');
})().catch(e=>{console.error(e);process.exitCode=1;});
