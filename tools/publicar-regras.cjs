// Executado pelo workflow antes do Hosting. Não lê nem grava documentos.
const fs = require('node:fs'), path = require('node:path');
const { createRequire } = require('node:module'), { execFileSync } = require('node:child_process');
const projeto = 'ricardo-d6119';
const pasta = path.join(process.env.RUNNER_TEMP, 'dl-firebase');
const deps = createRequire(path.join(pasta, 'package.json'));
const credencial = path.join(process.env.RUNNER_TEMP, 'dl-regras-sa.json');
const config = path.join(process.env.RUNNER_TEMP, 'dl-regras-config.json');
const regras = path.resolve('firestore.rules');
const normalizar = s => s.replace(/\r\n/g, '\n').trim();
(async () => {
  const conta = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  if (conta.project_id !== projeto) throw Error('Projeto inesperado na credencial de publicação.');
  fs.writeFileSync(credencial, JSON.stringify(conta), { mode: 0o600 });
  fs.writeFileSync(config, JSON.stringify({ firestore: { rules: regras } }));
  const env = { ...process.env, GOOGLE_APPLICATION_CREDENTIALS: credencial };
  delete env.FIREBASE_SERVICE_ACCOUNT;
  execFileSync(process.execPath, [path.join(pasta, 'node_modules/firebase-tools/lib/bin/firebase.js'),
    'deploy', '--only', 'firestore:rules', '--project', projeto, '--config', config, '--non-interactive'],
    { env, stdio: 'inherit' });
  const { GoogleAuth } = deps('google-auth-library');
  const auth = new GoogleAuth({ keyFilename: credencial, scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  const base = 'https://firebaserules.googleapis.com/v1/';
  const release = await client.request({ url: base + 'projects/' + projeto + '/releases/cloud.firestore' });
  const publicada = await client.request({ url: base + release.data.rulesetName });
  const arquivo = publicada.data.source.files.find(f => f.name.endsWith('firestore.rules'));
  if (!arquivo || normalizar(arquivo.content) !== normalizar(fs.readFileSync(regras, 'utf8'))) {
    throw Error('As regras ativas não correspondem ao commit. Hosting bloqueado.');
  }
  console.log('Regras ativas conferidas: ' + release.data.rulesetName + '. Hosting liberado.');
})().catch(e => { console.error('Publicação/verificação de regras falhou: ' + e.message); process.exitCode = 1; })
  .finally(() => { for (const arquivo of [credencial, config]) if (fs.existsSync(arquivo)) fs.unlinkSync(arquivo); });
