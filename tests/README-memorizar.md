# Memorizar — integração DL Web + Firebase (guia de publicação e validação)

Branch: `integrar-memorizar-firebase`. **Nada foi publicado.** Este guia descreve
o que mudou, como publicar com segurança e o que ainda precisa ser validado por
Ricardo antes de afirmar que a sincronização funciona.

## 1. O que a integração faz

O Memorizar deixa de ser apenas a prévia local de demonstração e passa a funcionar
no site de produção, na conta do usuário:

- **Cards reais + acervos reais.** Em produção, o conjunto é montado a partir do
  Card do texto aberto (lido de `textos/{textoId}/cards/{uid}`) e dos acervos
  (`substantivos`, `verbos`, `adjetivos_adverbios`). Texto **sem Card** não inventa
  identificação: mostra a mensagem honesta “Sem Card vinculado…”. A revisão da
  demonstração **não** é usada em produção.
- **Interface aprovada preservada.** Três categorias (substantivos, verbos,
  advérbios), prazo de 1 a 10 dias, contagem regressiva por dias de calendário e
  “Alterar prazo” mantendo os mesmos itens. Os itens ficam até uma escolha
  explícita (Continuar / Iniciar novo / Alterar prazo).
- **Persistência na conta (sincronização PC ↔ celular).** O ciclo ativo é gravado
  em `memorizar/{uid}` no Firestore, como **texto JSON** (mesmo padrão dos Cards),
  um ciclo por conta. Abrir o Memorizar em outro aparelho com o mesmo login carrega
  o ciclo da conta.
- **Releitura offline.** Uma cópia local por conta (IndexedDB `dl-memorizar-nuvem-v1`)
  permite reabrir e reler o ciclo sem internet. Iniciar/alterar prazo exige conexão
  e só substitui o ciclo após confirmação. Sair da conta remove a cópia local.
- **Moment** já consta no acervo (`webapp/data/substantivos.json`), uma única vez.
- **Sem dados de demonstração no site.** A prévia (`window.DL_MEMORIZAR_DEMO`) só é
  ativada em `localhost` pelo servidor de demonstração; em produção `entrada.js`
  segue outro caminho.

### Arquivos
- `webapp/memorizar/entrada.js` — alterna demo (localhost) × produção (Firebase).
- `webapp/memorizar/interface.js` — mesma UI; valores de produção injetados por um
  contexto opcional (`window.DL_MEMORIZAR_CTX`). O caminho demo ficou idêntico.
- `webapp/memorizar/nuvem.js` — **novo**: Firestore (`memorizar/{uid}`) + cópia
  local para offline; reaproveita o app Firebase já iniciado por `firebase-dados.js`.
- `firestore.rules` — **nova coleção** `memorizar/{uid}` (conta única, esquema
  validado, `criadoEm` imutável, `list` negado, isolamento por conta).
- `webapp/sw.js` — cache dos módulos do Memorizar; versão `deutschleben-v35-memorizar-01`.
- `tests/memorizar-regras.cjs` — **novo**: testes das regras no emulador.

## 2. Pré-requisito crítico antes do deploy (ordem importa)

O workflow `.github/workflows/firebase-hosting-deploy.yml` roda
`tools/publicar-regras.cjs` **antes** do Hosting. Esse script é **somente leitura**:
ele **bloqueia o deploy** se as regras ativas no Firestore não forem idênticas ao
`firestore.rules` do commit. Ele **não** publica regras.

Como este commit altera `firestore.rules`, é obrigatório **publicar as regras
primeiro**. Se o push na `main` acontecer antes, o deploy (e qualquer outro) falha
no passo “Conferir regras”.

### Publicar as regras (quem tiver acesso ao projeto `ricardo-d6119`)
Opção A — Firebase CLI:
```
firebase deploy --only firestore:rules --project ricardo-d6119
```
(`firebase.json` já aponta `firestore.rules`.)

Opção B — Firebase Console → Firestore Database → Regras → colar o conteúdo de
`firestore.rules` → Publicar.

Depois confirme que a release ativa corresponde ao arquivo (o mesmo que o
`publicar-regras.cjs` compara).

## 3. Publicar o site (fluxo já adotado)

1. Publicar as regras do Firestore (passo 2) e confirmar a release ativa.
2. Fazer merge/push desta branch na `main`.
3. O workflow confere as regras (deve passar, pois já foram publicadas) e publica
   `webapp/` no canal `live` do Hosting.
4. Conferir a versão pública (abaixo).

## 4. Testes já executados localmente (nesta branch)

Com Node 22, Chrome e o emulador Firestore oficial 1.22.0:

- `tests/memorizar.cjs` — **86 verificações** (modelo + navegador): vínculos por
  Card, cobertura honesta, snapshot imutável, prazo 1–10 dias, contagem, conclusão,
  continuar, alterar prazo mantendo itens, troca explícita de texto, conflito e
  falha local. O caminho demo ficou **idêntico** após o refactor.
- `tests/memorizar-regras.cjs` — **37 casos** no emulador: criação/leitura/atualização/
  exclusão pela conta única; esquema recusado; `criadoEm` imutável; `list` negado;
  isolamento contra conta anônima/não autorizada.
- `tests/textos.test.cjs` — **60 casos de regras + UI**: confirma que as regras
  existentes e a integração do app continuam intactas após a nova coleção.
- `tests/cards.test.cjs`, `textos-final`, `textos-humanizacao`, `consulta-sda-*`,
  `selecao-titulo`, `limpar-compreensao`, `blocos-destaques` — todos passam.

> Observação: alguns testes de navegador que carregam a página inteira
> (`apostila-blocos.cjs` etc.) falham **no ambiente de provisionamento** por um
> erro do emulador no lado Node (“Firestore has already been started”), que ocorre
> **também no código original** (verificado com as mudanças revertidas). Não é
> causado por esta integração.

## 5. Validação manual obrigatória (antes de confiar na sincronização)

Nada aqui substitui o teste real com a conta de Ricardo em dois aparelhos. Após
publicar as regras e o site:

1. **Texto com Card:** abrir o texto, abrir Memorizar, conferir as 3 categorias e
   iniciar um ciclo (ex.: 3 dias). Ver a contagem regressiva.
2. **Texto sem Card:** abrir Memorizar e confirmar a mensagem honesta, sem
   identificação inventada; “Iniciar ciclo” deve recusar (nenhum item seguro).
3. **Sincronização PC → celular:** iniciar o ciclo no computador; no celular, com o
   **mesmo login**, abrir Memorizar e confirmar que o mesmo ciclo e os mesmos itens
   aparecem, com a contagem coerente.
4. **Alterar prazo:** mudar para 7 e depois 10 dias; os itens devem permanecer.
5. **Restauração:** recarregar a página e reabrir Memorizar; o ciclo volta.
6. **Troca de categorias:** abrir cada uma das três categorias.
7. **Offline:** com o ciclo salvo, ficar offline, recarregar e reabrir Memorizar; a
   releitura deve funcionar (iniciar/alterar exige conexão).
8. **Conta:** sair da conta deve remover a cópia local; entrar de novo recarrega da
   conta.

Preserve os dados pessoais, os Cards e as demais funcionalidades em todos os passos.

## 6. Limitações conhecidas

- A sincronização PC ↔ celular e a recuperação offline **não** foram validadas com a
  conta real/dois aparelhos neste ambiente (sem credenciais da conta de produção).
  Só foram validados o modelo, a interface (demo) e as **regras** (emulador).
- A publicação das regras é uma ação privilegiada separada do push; precisa ser
  feita por quem tem acesso ao projeto `ricardo-d6119`.
