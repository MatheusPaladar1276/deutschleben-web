// Executado pelo workflow antes do Hosting. Não lê nem grava documentos.
const fs = require('node:fs'), path = require('node:path');
const { createRequire } = require('node:module');
const projeto = 'ricardo-d6119';
const pasta = path.join(process.env.RUNNER_TEMP, 'dl-firebase');
const deps = createRequire(path.join(pasta, 'package.json'));
const credencial = path.join(process.env.RUNNER_TEMP, 'dl-regras-sa.json');
const regras = path.resolve('firestore.rules');
const normalizar = s => s.replace(/\r\n/g, '\n').trim();
(async () => {
  const conta = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  if (conta.project_id !== projeto) throw Error('Projeto inesperado na credencial de publicação.');
  fs.writeFileSync(credencial, JSON.stringify(conta), { mode: 0o600 });
  const { GoogleAuth } = deps('google-auth-library');
  const auth = new GoogleAuth({ keyFilename: credencial, scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  const base = 'https://firebaserules.googleapis.com/v1/';
  const nomeRelease = 'projects/' + projeto + '/releases/cloud.firestore';
  // Confere o acesso à release existente antes de criar a nova versão.
  await client.request({ url: base + nomeRelease });
  const criada = await client.request({ url: base + 'projects/' + projeto + '/rulesets', method: 'POST',
    data: { source: { files: [{ name: 'firestore.rules', content: fs.readFileSync(regras, 'utf8') }] } } });
  // A API valida a sintaxe/semântica ao criar o ruleset e só então permite ativá-lo.
  await client.request({ url: base + nomeRelease, method: 'PATCH',
    data: { release: { name: nomeRelease, rulesetName: criada.data.name } } });
  const release = await client.request({ url: base + nomeRelease });
  const publicada = await client.request({ url: base + release.data.rulesetName });
  const arquivo = publicada.data.source.files.find(f => f.name.endsWith('firestore.rules'));
  if (!arquivo || normalizar(arquivo.content) !== normalizar(fs.readFileSync(regras, 'utf8'))) {
    throw Error('As regras ativas não correspondem ao commit. Hosting bloqueado.');
  }
  console.log('Regras ativas conferidas: ' + release.data.rulesetName + '. Hosting liberado.');
})().catch(e => { console.error('Publicação/verificação de regras falhou: ' + e.message); process.exitCode = 1; })
  .finally(() => { if (fs.existsSync(credencial)) fs.unlinkSync(credencial); });
