const crypto = require('node:crypto');
const fs = require('node:fs');
const PROJECT = 'ricardo-d6119';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

class CheckError extends Error {
  constructor(stage, status) {
    super(stage);
    this.stage = stage;
    this.status = status;
  }
}

async function verify({credential, transport = fetch, now = Date.now, emit = console.log}) {
  let account;
  try { account = JSON.parse(credential); }
  catch { throw new CheckError('configuracao'); }
  if (account.type !== 'service_account' || account.project_id !== PROJECT ||
      typeof account.client_email !== 'string' ||
      !/^[a-zA-Z0-9._-]+@ricardo-d6119\.iam\.gserviceaccount\.com$/.test(account.client_email) ||
      typeof account.private_key_id !== 'string' || !/^[a-f0-9]{40}$/.test(account.private_key_id) ||
      typeof account.private_key !== 'string') throw new CheckError('configuracao');
  emit('PASS projeto e formato da identidade configurada');
  const enc = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const issued = Math.floor(now() / 1000);
  const unsigned = enc({alg: 'RS256', typ: 'JWT', kid: account.private_key_id}) + '.' +
    enc({iss: account.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: TOKEN_URL, iat: issued, exp: issued + 300});
  let assertion;
  try {
    assertion = unsigned + '.' + crypto.sign('RSA-SHA256', Buffer.from(unsigned), account.private_key).toString('base64url');
  } catch { throw new CheckError('assinatura'); }
  async function json(url, options, stage) {
    let response;
    try { response = await transport(url, {...options, redirect: 'error', signal: AbortSignal.timeout(30000)}); }
    catch { throw new CheckError(stage); }
    if (!response.ok) throw new CheckError(stage, response.status);
    try { return await response.json(); }
    catch { throw new CheckError(stage); }
  }
  const token = await json(TOKEN_URL, {method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion}).toString()
  }, 'autenticacao');
  if (typeof token.access_token !== 'string' || !token.access_token || token.token_type !== 'Bearer') {
    throw new CheckError('autenticacao');
  }
  emit('PASS token novo emitido com a chave do segredo atual');
  emit('Conta de servico usada: ' + account.client_email);
  emit('ID da chave usada: ' + account.private_key_id);
  const accountPath = '/v1/projects/' + PROJECT + '/serviceAccounts/' + encodeURIComponent(account.client_email);
  const releasePath = '/v1/projects/' + PROJECT + '/releases/cloud.firestore';
  const hostingPath = '/v1beta1/projects/' + PROJECT + '/sites/' + PROJECT + '/channels/live';
  const allowed = new Set([
    'https://firebaserules.googleapis.com' + releasePath,
    'https://firebasehosting.googleapis.com' + hostingPath,
    'https://iam.googleapis.com' + accountPath,
    'https://iam.googleapis.com' + accountPath + '/keys/' + account.private_key_id
  ]);
  async function get(url, stage) {
    if (!allowed.has(url)) throw new CheckError('destino');
    return json(url, {method: 'GET', headers: {Authorization: 'Bearer ' + token.access_token}}, stage);
  }
  const release = await get('https://firebaserules.googleapis.com' + releasePath, 'release_regras');
  if (release.name !== releasePath.slice(4) ||
      !new RegExp('^projects/' + PROJECT + '/rulesets/[a-zA-Z0-9-]+$').test(release.rulesetName)) {
    throw new CheckError('release_regras');
  }
  const rulesUrl = 'https://firebaserules.googleapis.com/v1/' + release.rulesetName;
  allowed.add(rulesUrl);
  const rules = await get(rulesUrl, 'ruleset');
  if (!rules.source?.files?.some(file => file.name === 'firestore.rules' && typeof file.content === 'string')) {
    throw new CheckError('ruleset');
  }
  emit('PASS leitura de release e ruleset ativos');
  const hosting = await get('https://firebasehosting.googleapis.com' + hostingPath, 'hosting');
  if (hosting.name !== hostingPath.slice(9) ||
      !hosting.release?.version?.name?.startsWith('projects/' + PROJECT + '/sites/' + PROJECT + '/versions/')) {
    throw new CheckError('hosting');
  }
  emit('PASS leitura dos metadados Hosting live');
  const metadata = [];
  for (const [stage, url, validate] of [
    ['conta_iam', 'https://iam.googleapis.com' + accountPath,
      value => value.email === account.client_email && value.projectId === PROJECT && value.disabled !== true],
    ['chave_iam', 'https://iam.googleapis.com' + accountPath + '/keys/' + account.private_key_id,
      value => typeof value.name === 'string' &&
        value.name.endsWith('/keys/' + account.private_key_id) && value.disabled !== true &&
        Number.isFinite(Date.parse(value.validAfterTime)) && Number.isFinite(Date.parse(value.validBeforeTime)) &&
        Date.parse(value.validAfterTime) <= now() && now() < Date.parse(value.validBeforeTime)]
  ]) {
    try {
      const value = await get(url, stage);
      if (!validate(value)) throw new CheckError(stage);
      emit('PASS ' + stage + ' corresponde ao segredo e esta habilitada/valida');
      metadata.push({stage, status: 'PASS'});
    } catch (error) {
      if (!(error instanceof CheckError)) throw error;
      emit('NAO COMPROVADO ' + stage + (error.status ? ' HTTP ' + error.status : ''));
      metadata.push({stage, status: 'NAO_COMPROVADO'});
    }
  }
  return {project: PROJECT, credentialAuthenticated: true, rulesRead: true, hostingRead: true,
    identityAndKeyMetadataVerified: metadata.every(item => item.status === 'PASS'),
    metadata, writesPerformed: false};
}

async function main() {
  try {
    const report = await verify({credential: process.env.FIREBASE_SERVICE_ACCOUNT});
    console.log(report.identityAndKeyMetadataVerified
      ? 'PASS verificacao somente-leitura completa'
      : 'INCOMPLETO: autenticacao e leituras passaram; conferir metadados IAM sem ampliar permissoes automaticamente');
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      '## Credencial CI - somente leitura\n\n' +
      '- Projeto esperado, token novo, regras e Hosting: PASS\n' +
      '- Identidade/chave via IAM: ' + (report.identityAndKeyMetadataVerified ? 'PASS' : 'NAO COMPROVADO') + '\n' +
      '- Nenhum deploy, documento Firestore ou segredo registrado.\n');
    if (!report.identityAndKeyMetadataVerified) process.exitCode = 1;
  } catch (error) {
    console.error('FAIL verificacao: ' + (error instanceof CheckError
      ? error.stage + (error.status ? ' HTTP ' + error.status : '') : 'erro interno'));
    process.exitCode = 1;
  }
}
module.exports = {verify, CheckError};
if (require.main === module) main();
