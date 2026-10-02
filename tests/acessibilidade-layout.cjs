// Layout local e isolado: sem scripts da aplicação, Firebase ou rede de produção.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const final = process.argv.includes('--pacote-final');
const sdaFinal = process.argv.includes('--sda-final');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'dl-legibilidade-'));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',
  ['--headless=new', '--disable-gpu', '--disable-extensions', '--no-first-run', '--remote-debugging-port=9339',
   '--user-data-dir='+path.join(out, 'profile'), 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, n=0; const pending = new Map();
const send = (method, params={}) => new Promise((resolve,reject) => {
  const id=++n; pending.set(id,{resolve,reject}); ws.send(JSON.stringify({id,method,params}));
});
const evaluate = async expression => {
  const r=await send('Runtime.evaluate',{expression,returnByValue:true});
  if(r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
};
(async () => {
  let tabs;
  for(let i=0;i<40;i++) { try { tabs=await (await fetch('http://127.0.0.1:9339/json')).json(); if(tabs.some(t=>t.type==='page'))break; } catch {} await sleep(250); }
  ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise(r=>ws.addEventListener('open',r,{once:true}));
  ws.addEventListener('message',e=>{ const m=JSON.parse(e.data); if(pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);} });
  await send('Page.enable');
  let html=fs.readFileSync(path.join(root,'webapp/index.html'),'utf8')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,'');
  html=html.replace('</head>','<style>'+['acessibilidade.css','pacote-final.css'].map(f=>fs.readFileSync(path.join(root,'webapp',f),'utf8')).join('\n')+'</style></head>');
  const frame=(await send('Page.getFrameTree')).frameTree.frame.id;
  await send('Page.setDocumentContent',{frameId:frame,html});
  await evaluate(`(()=>{
    const $=id=>document.getElementById(id);
    $('auth-estado').textContent='Conectado'; $('auth-estado').classList.add('conectado');
    $('auth-acao').disabled=false; $('auth-acao').textContent='Sair';
    $('titulo-texto').textContent='Vorstellung';
    $('original-texto').textContent='Mein Name ist Anna. Ich komme aus Österreich. Ich lerne Deutsch und möchte die Welt besser verstehen.';
    $('resumo-conteudo').value='Resumo final do estudo: Anna apresenta sua origem e seu interesse pelo alemão.';
    $('minha-pergunta').value='Qual é o sentido deste trecho?';
    $('texto-compreensao').value='Minha compreensão temporária do texto.';
    $('copia-status').textContent='';
    $('resumo-status').textContent='✓ Resumo salvo com sucesso';
    $('resumo-status').classList.add('resumo-sucesso');
    $('selecao-aviso').textContent='Trecho selecionado:';
    $('selecao-texto').textContent='Ich lerne Deutsch und möchte die Welt besser verstehen.';
    $('estrada-contador').textContent='3 palavras e expressões';
    $('estrada-lista').innerHTML='<div class="estrada-item"><div class="estrada-termo">verstehen <span class="estrada-tipo">Verbo</span></div><div class="estrada-sentido">compreender</div><div class="estrada-meta">Encontrado no estudo de Vorstellung.</div></div>';
    $('rg-contador').textContent='1 referência';
    $('rg-lista').innerHTML='<div class="rg-item"><div class="rg-titulo">Ordem da frase <span class="rg-cat">Sintaxe</span></div><div class="rg-resumo">Referência didática para estudar a frase.</div><div class="rg-formula">S + V + (OI) + (OD) + [Te → Ka → Mo → Lo] + (Neg).</div><div class="rg-sub">Exemplo</div><ul class="rg-detalhes"><li>Ich lerne heute Deutsch.</li></ul><div class="rg-chips"><span class="rg-chip">Ordem dos elementos</span></div></div>';
    $('historico-resumo').textContent='Exportação estática da memória'; $('prog-contador').textContent='1 registro';
    $('prog-lista').innerHTML='<div class="prog-secao-titulo">Palavras reencontradas</div><div class="prog-item"><div class="prog-termo">verstehen <span class="prog-tag">Reencontrado</span></div><div class="prog-meta">Estudo de Vorstellung</div><div class="prog-contexto">Ich möchte verstehen.</div><div class="prog-situacao">Em estudo</div></div>';
    $('memoria-lista').innerHTML='<article class="memoria-item"><h3>Vorstellung — minha apresentação</h3><p class="memoria-conteudo">Anna apresenta sua origem. Ela deseja compreender melhor o alemão.&#10;Este é o resumo explicitamente salvo.</p><button type="button">Retomar estudo</button></article>';
    $('escolha-lista').innerHTML=['Vorstellung — minha apresentação e primeiros estudos','Um segundo texto em alemão'].map(t=>'<div class="escolha-linha"><span class="escolha-nome">'+t+'</span><div class="escolha-acoes"><button type="button">Abrir</button><button type="button" class="escolha-excluir">Excluir</button></div></div>').join('');
    $('excluir-texto-titulo').textContent='Vorstellung — minha apresentação e primeiros estudos';
  })()`);
  const results=[];
  for(const width of (final||sdaFinal?[1440,390]:[1440,390,320])) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
    for(const screen of (sdaFinal?['estudo']:final?['estudo','escolha-textos','excluir-confirmacao','consulta-confirmacao','prog-overlay','estrada-overlay']:['abertura','estudo','estrada-overlay','rg-overlay','prog-overlay','adicionar-texto-overlay'])) {
      await evaluate(`(()=>{
        document.querySelectorAll('.aberta').forEach(e=>e.classList.remove('aberta'));
        document.querySelectorAll('dialog[open]').forEach(e=>e.close());
        document.getElementById('abertura-textos').hidden=${screen!=='abertura'};
        document.getElementById('estudo-texto').hidden=${screen!=='estudo'};
        document.getElementById('resumo-secao').open=true;
        ${screen.endsWith('overlay')?`document.getElementById('${screen}').classList.add('aberta');`:''}
        ${['escolha-textos','excluir-confirmacao','consulta-confirmacao'].includes(screen)?`document.getElementById('${screen}').showModal();`:''}
      })()`);
      await sleep(60);
      const report=await evaluate(`(()=>{
        const errors=[]; const overlay=document.querySelector('dialog[open]')||document.querySelector('.aberta');
        const scope=overlay||document.body;
        const rgb=c=>(c.match(/[\\d.]+/g)||[]).map(Number);
        const lum=c=>rgb(c).slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
        for(const e of scope.querySelectorAll('*')) {
          if(!e.getClientRects().length||e.closest('[hidden]')) continue;
          const s=getComputedStyle(e), r=e.getBoundingClientRect();
          if(s.visibility==='hidden'||s.opacity==='0')continue;
          const text=[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
          const control=e.matches('button,.nav,.caminhadas-face,summary');
          const input=e.matches('input,textarea,select');
          const heading=e.matches('h1,h2,h3,h4,h5,h6,.prog-secao-titulo,.rg-titulo');
          const label=e.id||e.className||e.tagName;
          if(text||control||input){
            const min=input?24:heading?28:control?22:20;
            if(parseFloat(s.fontSize)<min)errors.push(label+': fonte '+s.fontSize);
            if(!e.closest('#original-texto')&&parseInt(s.fontWeight)<(control?600:500))errors.push(label+': peso '+s.fontWeight);
            if(control&&r.height<48)errors.push(label+': altura '+r.height);
            if(r.left<-.5||r.right>innerWidth+.5)errors.push(label+': fora da largura');
            if(!e.closest('.topo')){
              let parent=e,bg=s.backgroundColor;
              while(rgb(bg)[3]===0&&parent.parentElement){parent=parent.parentElement;bg=getComputedStyle(parent).backgroundColor;}
              const a=lum(s.color),b=lum(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
              if(ratio<4.5)errors.push(label+': contraste '+ratio.toFixed(2));
            }
          }
        }
        if(document.documentElement.scrollWidth>innerWidth)errors.push('rolagem horizontal');
        return {errors,zoom:visualViewport.scale,originalFont:getComputedStyle(document.getElementById('original-texto')).fontFamily};
      })()`);
      results.push({width,screen,...report});
      const metrics=await send('Page.getLayoutMetrics');
      const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,
        clip:{x:0,y:0,width,height:Math.ceil(metrics.cssContentSize.height),scale:1}});
      fs.writeFileSync(path.join(out,width+'-'+screen+'.png'),Buffer.from(shot.data,'base64'));
    }
  }
  fs.writeFileSync(path.join(out,'resultados.json'),JSON.stringify(results,null,2));
  console.log(JSON.stringify({out,results},null,2));
  if(results.some(r=>r.errors.length||r.zoom!==1))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(ws){await send('Browser.close').catch(()=>{});ws.close();}chrome.kill();});
