# Memorizar — integração DL Web + Firebase (guia de publicação e validação)

## Recuperacao de sessao offline - preparacao local memorizar-07

Base: `c0f2e3d` (memorizar-06). Relato fisico: depois de salvar 3 dias e
reabrir online sem login, a reabertura offline pelo mesmo icone deixou
Memorizar inativo e Escolher texto pediu login. Isso nao comprova perda
de sessao, ciclo ou dados locais.

No SDK incluido, `getAuth()` configura o resolver de popup/redirect.
Em UA mobile/Safari/iOS, `_initializeWithPersistence` aguarda a inicializacao
desse resolver (GAPI/iframe externo) antes de restaurar o usuario persistido.
Com esse transporte pendente, reproduzimos os dois sintomas na 06, com
Auth/ciclo/Card intactos. Com falha de rede imediata a 06 recupera a sessao:
o transporte pendente e uma condicao reproduzida, nao uma comprovacao do
estado interno do celular. `connectAuthEmulator` dos testes antigos nao
exercitava esse caminho externo; viewport pequeno tambem nao altera o UA.

Principal e Cards agora compartilham `cards/sessao.js`, que usa
`initializeAuth` com as mesmas persistencias e ordem do SDK: IndexedDB,
localStorage, sessionStorage. O resolver e fornecido explicitamente somente
em `signInWithPopup`, ao pedir login. Nenhum UID ou token e copiado pelo app,
nenhum banco e renomeado, nenhum timeout inventa um usuario. O proprio SDK
continua restaurando e validando a sessao; uma consulta REST pendente ainda
significa restauracao pendente, nao conta desconectada.

O cabecalho e Escolher texto distinguem restauracao de ausencia de sessao.
No complemento da revisao, a escolha offline passa a listar e abrir os
originais ja guardados nos Cards e no espelho do ciclo da conta restaurada.
As leituras sao somente `readonly`, com UID conferido antes/depois dos
acessos; a copia do ciclo passa pelo validador existente, sem substituicao.
Textos conhecidos sem original local ficam marcados como indisponiveis;
IDs ausentes geram aviso explicito, sem apagar o texto atualmente aberto.
Nenhum catalogo remoto e inventado na reabertura offline. A versao interna
dos Cards tambem passa a memorizar-07, alinhada ao shell dos dois SW.

Grafo alterado e Textos recebem `?v=memorizar-07`; os dois SW incluem a nova
dependencia. Cache raiz: `deutschleben-v38-memorizar-07`; shell Cards:
`rg-previa-01-10-v10-memorizar-07`. A verificacao do pacote usa essas mesmas
URLs. Regras, IAM, transacoes, validacao do ciclo e isolamento entre contas
nao foram alterados.

Teste focado, sem login real, Auth emulator ou backend de producao:

```powershell
node tests\sessao-offline-memorizar.cjs --publicado
node tests\sessao-offline-memorizar.cjs --publicado --rede-pendente
node tests\sessao-offline-memorizar.cjs --atualizar-06 --rede-pendente
node tests\sessao-offline-memorizar.cjs --rede-pendente --expirado
node tests\sessao-offline-memorizar.cjs --ios --local-storage --expirado --rede-pendente
node tests\atualizacao-memorizar.cjs --sw-publicado
```

O novo teste usa SDK e persistencia reais com provider Google, REST
interceptado por CDP e respostas sinteticas. Nao substitui `DL_AUTH` nem
modifica o SDK, e nao faz login Google real. Fecha todo o processo Chrome
e reabre o mesmo perfil com rede desligada antes de navegar. Confere a
restauracao pendente, ausencia de GAPI no bootstrap corrigido, hash do
usuario persistido, ciclo de 3 dias, itens, Card e sentinela local, inclusive
na entrada Cards. `--expirado` envelhece somente o token da fixture.
`--atualizar-06` parte dos blobs publicados e atualiza os dois SW sem
limpar dados. Somente perfis temporarios sinteticos do teste sao removidos.
`--ios` e UA iOS em Chromium, nao Safari/WebKit nem um aparelho fisico.

Resultado final: cinco cenarios novos executados sequencialmente, 48
verificacoes PASS (9 de controle/reproducao da 06 e 39 da correcao);
20 PASS na regressao de atualizacao de SW e 86 PASS de modelo/interface.
Sintaxe dos 11 arquivos JS e `git diff --check` aprovados. O harness
precarrega blobs Git em lote para nao bloquear CDP e aguarda o DOM, nao
o evento load que o proprio transporte GAPI pendente pode atrasar.
Reabertura offline preservou os hashes da sessao e os registros locais.
Uma rodada da regressao antiga excedeu a espera de ativacao do shell Cards;
a repeticao final passou os 20 checks. Foi acrescentado diagnostico da
ultima versao/aviso em caso de nova falha, sem aumentar o timeout. Essa
intermitencia nao e evidencia de estabilidade no aparelho fisico.
Nao foi testado popup Google real nem Safari/WebKit ou celular fisico.

Validacao exclusiva do complemento (sem repetir as suites acima):

```powershell
node tests\sessao-offline-memorizar.cjs --textos-locais
```

11 PASS: verificador real dos Cards aceita shell 07, escolha e seletor
offline, originais dos Cards e do ciclo, indicacao de ausencia, recusa de
UID diferente e de ID de outro UID, abertura do ciclo existente de 3 dias
e comparacao integral de Auth/ciclo/registros antes e depois. Usa somente
perfil sintetico com registros preparados, sem iniciar/salvar outro ciclo
pelo app e sem apagar registros. Nenhum armazenamento real e acessado.

A revisao local nao autoriza push/deploy. A confirmacao fisica continua
pendente: mesma conta, ciclo oficial de 3 dias, mesmo icone; fechar o app,
desligar Wi-Fi e dados moveis antes de reabrir, conferir itens/prazo e
reconectar sem novo login, sem limpar armazenamento.

## Atualizacao de instalacao antiga - correcao local memorizar-06

`d886d76` exporta `isolarMemorizar` e `operarMemorizar`, mas conserva a URL
`cards/offline.js?v=blocos-15` precacheada pela versao oficial anterior.
Na atualizacao, HTML novo mais SW antigo pode carregar o modulo antigo sem
esses exports. Perfis novos nao reproduzem essa mistura.

O grafo alterado recebe `?v=memorizar-06` desde os HTMLs ate bootstrap,
entrada/nuvem e imports compartilhados dos Cards. Os dois SW precacheiam
as URLs reais; o shell Cards preserva a query como identidade do recurso,
sem devolver um modulo de outra versao. O cache raiz passa a
`deutschleben-v37-memorizar-06`; shell Cards a
`rg-previa-01-10-v10-memorizar-06`. IndexedDB e persistencia Auth nao mudam.

Teste focado, sem emulador Firestore, login real ou contato com producao:

```powershell
node tests\atualizacao-memorizar.cjs
node tests\atualizacao-memorizar.cjs --sw-publicado
```

O teste serve os blobs antigos e publicados por Git e a correcao atual em
localhost, com SDK Auth real e REST sintetico. Mantem o mesmo perfil Chrome,
dois SW reais, cache HTTP antigo, Card/ciclo de 7 dias, Auth e localStorage.
Reproduz primeiro o erro em 2580f4f -> d886d76; verifica a correcao ainda sob
o SW antigo, ativacao e reinicio completo do navegador ja sem rede, antes
da primeira navegacao; nao aquece o perfil online antes da reabertura offline.
`--reproduzir` termina apos comprovar a falha original.
`--sw-publicado` instala tambem o SW real da offline-05 antes de aplicar a
correcao, cobrindo tanto v34 antigo quanto v36 ja instalado. Confere acervo
publico retido e recusa de uma query de modulo nao instalada, sem trocar
a identidade da versao pelo arquivo canonico do shell Cards.
Nenhuma publicacao ou alteracao do pacote offline-05 faz parte desta correcao.

Resultado desta preparacao: 18 verificacoes com SW v34 e 20 com SW v36,
total 38 PASS, mais sintaxe JS e `git diff --check`. Sessao sintetica,
registros locais, ciclo de 7 dias e acervo preservados; reabertura a frio
ja offline na principal e nos Cards. Sem repeticao das suites de regras,
modelo ou transacoes, que nao mudaram. Teste fisico da correcao ainda nao
realizado; a evidencia automatizada nao substitui a confirmacao no celular.

## Aprovacao fisica do conflito - offline-05

Relato do usuario em 31/10/2026, 18h01 (Brasilia): depois de salvar 7 dias
no celular, a tentativa de confirmar 2 no computador foi recusada, carregou
7 dias e exibiu o aviso correto. Fechar e reabrir manteve 7 dias e removeu
o aviso anterior. Evidencia fisica relatada, nao observada diretamente.
Conflito e reabertura aprovados; isso nao aprova os demais testes pendentes.
A regressao automatizada inclui agora conferencia explicita do espelho e
da remocao do aviso apos fechar/reabrir. O ZIP antigo continua obsoleto.
O pacote final corrigido combina a base `6c35f3a` com as quatro correcoes de
runtime: interface, CSS do aviso, adaptador de nuvem e SW. Configuracoes,
UID, regras e demais dados oficiais da base permanecem intactos; nada da
configuracao ou dos dados sinteticos da homologacao entra no ZIP.
O manifesto do pacote identifica a arvore Git dos arquivos, os hashes,
a validacao do ZIP extraido e as pendencias fisicas/operacionais.
Uma arvore Git nao e um novo commit nem autorizacao para push/publicacao.
Nenhuma publicacao em producao faz parte desta consolidacao.

## Conflito entre aparelhos - offline-05 publicada somente na homologacao

Relato fisico de 31/10/2026, 16h48 (Brasilia), na `offline-04`: Alterar prazo
ficou aberto no computador; o celular confirmou 4 dias; o computador tentou
confirmar 2 sem recarregar. O usuario viu 4 dias mantidos, sem aviso.
Nao consultamos o banco remoto nem observamos diretamente esse teste.

No emulador, a transacao recusou a base antiga e preservou integralmente o
documento de 4 dias, mas o computador continuou com espelho de 3 dias.
Outra lacuna: atualizarControles/render apagava o aviso online. Nao afirmamos
que essa renderizacao foi a causa exata do aviso ausente no aparelho real.

O adaptador identifica a recusa com `code: memorizar/conflito`, inclusive
`aborted`/`failed-precondition`. A interface faz somente uma nova leitura,
sem repetir a gravacao. Quando a origem e servidor, atualiza ciclo/espelho,
descarta o rascunho e mostra junto ao prazo, com foco e rolagem:
“O ciclo mudou em outro aparelho. Sua alteração não foi salva. A versão mais recente foi carregada.”
O aviso permanece apos renderizacao/atualizacao dos controles; uma nova
edicao explicita usa a base recente e limpa a mensagem anterior.

Falha de leitura, copia local de fallback e ausencia remota nao sao
apresentadas como recarga bem-sucedida. A interface explica a falha ou a
remocao e nao escreve sobre o servidor. Resultados atrasados de outra sessao
continuam descartados. Comparacao exata do conteudo anterior e uma unica
tentativa de transacao preservadas; nenhuma fila ou confirmacao automatica.

129 verificacoes passaram em cada configuracao, com SDK/regras reais no
emulador: fluxo 4x2 com formulario aberto, documento remoto completo intacto,
espelho atualizado, aviso visivel no computador e em 375x667, persistencia
apos render, nova base, leitura invalida, remocao, offline e isolamento.
Previa local sem nuvem: 86 verificacoes passaram.
Pacote isolado regenerado: 61 arquivos, selo `offline-05`,
SW `deutschleben-v36-memorizar-05-hml-04`; fonte principal:
`deutschleben-v36-memorizar-05`. Publicada somente no Hosting isolado com
`--only hosting`, `--project dl-memorizar-homologacao` e
`firebase.homologacao.json` explicitos. Os 61 arquivos HTTPS conferem por
SHA-256. Interface e adaptador novos confirmados ativos no navegador.
O selo novo apareceu enquanto os modulos antigos ainda estavam carregados;
aguardar a ativacao do SW e recarregar novamente, sem limpar dados locais.

Uma tentativa anterior falhou na checagem de texto acentuado passada pelo
pipe PowerShell; o finally encerrou a CLI antes de publicar. A checagem foi
corrigida e as fases separadas: testes/preflight completo antes do login,
conferencia do pacote congelado antes de entrar na fase autenticada, e
finally reservado a deploy/HTTPS/logout. Preflight e publicacao executados
por arquivo Node, sem depender da codificacao do pipe.
Testes reexecutados: 129 verificacoes em cada configuracao e 86 na previa.
Logout final conferido em novo processo: zero contas. Nenhuma alteracao de
banco remoto, regras, producao ou faturamento; sessoes de navegador preservadas.
ZIP oficial antigo continua bloqueado; reteste fisico da correcao pendente.

## Aviso no celular - offline-04 publicada somente na homologacao

Reteste fisico relatado pelo usuario na `offline-03`: tentativa de mudar de
6 para 1 dia offline, confirmacao, reabertura offline com 6 dias e reconexao
com os mesmos 6 dias. Nenhum aviso foi visto. Preservacao aprovada nesse
teste; visibilidade do aviso reprovada. Nao observamos o aparelho diretamente.

A reproducao automatizada agora usa viewport de celular real (375x667), antes
ausente do perfil chamado celular. Reabrir offline desabilitava a confirmacao
sem explicar o bloqueio junto aos controles; botao desabilitado nao emite
clique. Isso reproduz uma lacuna da interface, nao prova o caminho exato do
aparelho do usuario.

O aviso destacado fica fora do formulario que se oculta, junto ao prazo:
“Para alterar o prazo, conecte-se à internet. Seu prazo foi mantido.”
Ele aparece enquanto offline, inclusive ao reabrir; tocar em Alterar prazo
leva o aviso ao centro da tela e lhe da foco. Ao reconectar, o aviso offline
e removido, mantendo a orientacao de reabrir para conferir a conta. Falhas de
salvamento com navegador ainda dizendo online tambem mostram seu erro junto
ao prazo, sem transformar um resultado remoto incerto em promessa de reversao.

109 verificacoes passaram em cada configuracao, incluindo toque emulado,
texto exato, retangulo inteiro dentro de 375x667 e ausencia de sobreposicao,
reabertura offline, espelho/servidor intactos e reconexao sem fila.
Previa local sem nuvem: 86 verificacoes passaram. Somente emulador `demo-*`.
SW preparado: `deutschleben-v36-memorizar-04`; pacote isolado:
`deutschleben-v36-memorizar-04-hml-03`, selo `offline-04`, 61 arquivos.
Apos login temporario autorizado pelo operador, publicado somente Hosting
isolado com projeto/configuracao explicitos. Os 61 arquivos HTTPS conferem
por SHA-256 com o pacote testado. Navegador confirmou cache ativo e aviso
montado no DOM. Na transicao, o selo novo apareceu antes do JavaScript novo;
aguardar a ativacao do SW e recarregar novamente, sem limpar dados locais.
O selo sozinho nao garante que os modulos antigos ja foram substituidos.
Logout executado em seguida e conferido em novo processo: zero contas.
Nada de regras, dados, faturamento ou publicacao oficial.
O ZIP antigo continua bloqueado; falta reteste fisico do aviso na nova versao.

## Correcao offline - 31/10/2026 (somente homologacao publicada)

A revisao `6c35f3a` e o ZIP final preparado anteriormente estao bloqueados para
publicacao. O usuario relatou alteracoes de contagem offline na homologacao.
A reproducao no emulador distinguiu dois problemas:

- Com `navigator.onLine === false`, apenas o rascunho numerico permanecia no
  formulario; o espelho IndexedDB e o servidor nao eram alterados.
- Com uma falha de transporte enquanto `navigator.onLine` continuava verdadeiro,
  as retentativas padrao de `runTransaction` podiam concluir depois do retorno da
  conexao. Foi reproduzida uma gravacao tardia de 2 para 4 dias no servidor.
  Nao se afirma que esse segundo caso ocorreu no celular do usuario.

Correcao no codigo: offline recusa abertura/confirmacao de edicao e restaura
o prazo do ciclo persistido; queda de rede descarta o rascunho, mostra aviso e
cancela a espera de leitura da tentativa. Uma geracao de conexao invalida a
tentativa mesmo apos reconectar. Transacoes usam uma unica tentativa do SDK;
conflitos continuam recusados, sem repeticao automatica. Uma nova tentativa
exige uma nova confirmacao do usuario.

O SW raiz passa a `deutschleben-v36-memorizar-03` e recarrega os recursos durante
a instalacao, evitando reaproveitar JavaScript antigo do cache HTTP.
A previa local sem nuvem preserva seu comportamento de armazenamento local.

Validacao: 103 verificacoes de SDK/interface aprovadas em cada configuracao
(codigo principal e pacote isolado), incluindo espelho completo, tentativas
repetidas, reinicio offline, reconexao com navegador dizendo online, queda
durante leitura pausada, conflitos e logout. A previa passou em 86 verificacoes.
Somente projetos `demo-*`; nenhum teste no banco oficial.

Uma requisicao ja recebida pelo servidor antes de uma queda pode ter resultado
incerto se a resposta se perder: reabrir para conferir o estado remoto. Nao
afirmar que um erro de transporte desfaz uma gravacao ja aceita.

Apos novo login do operador, foi publicado somente Hosting em
`dl-memorizar-homologacao`, sem regras nem dados novos. Os 61 arquivos HTTPS
foram comparados ao pacote corrigido. O navegador confirmou o cache
`deutschleben-v36-memorizar-03-hml-02`, uma unica tentativa e cancelamento ativo,
sem requisicoes observadas ao oficial. Logout executado novamente: zero contas.
Console no Edge e sessoes do DL preservados.

Para repetir no celular: com conexao, recarregar e aguardar a atualizacao do SW;
recarregar novamente e conferir o selo `offline-03`. Nao limpar dados locais.
Abrir o ciclo online, desligar Wi-Fi/dados, tentar alterar varias vezes, fechar
e reabrir offline; devem permanecer o prazo e os itens anteriores, com aviso.
Reconectar e conferir online sem confirmar uma nova alteracao: nada deve
ser enviado automaticamente. Refazer esse teste fisico antes da liberacao.
Nao publicar no oficial nem reutilizar o pacote antigo.

Branch: `integrar-memorizar-firebase`. **Nada foi publicado.** Este guia descreve
o que mudou, como publicar com segurança e o que ainda precisa ser homologado
por Ricardo em dois aparelhos físicos.

Revisão de 27/10/2026: `a1106aa` tem como pai `2580f4f`, que continua sendo a
`main` oficial no remoto (conferido com `git ls-remote`). Nenhum push, merge ou
deploy foi executado. A revisão seguinte é local: corrige o adaptador de
produção e inclui a correção aprovada de `apostila-blocos.cjs`.
Não reescreve o commit inicial. O trecho anterior de Construções em
`README-cards.md` é retirado do histórico acumulado da branch e preservado como
alteração local não staged, fora do commit de revisão.

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
- **Releitura offline.** A cópia por conta (IndexedDB `dl-memorizar-nuvem-v1`)
  permite reencontrar o ciclo pelo botão Memorizar sem abrir um texto online.
  O painel fica fora da área de estudo quando não há texto ativo e conserva o
  original para releitura. A origem local e a possibilidade de desatualização
  são informadas. A recuperação foi testada após encerrar e reiniciar o Chrome
  com a rede já bloqueada; dispositivos físicos ainda exigem homologação.
- **Proteção de conta e erros.** Troca de conta/logout invalidam operações
  pendentes e removem conteúdo da interface. A limpeza compartilhada dos Cards
  também isola o espelho do Memorizar, inclusive ao sair pela página `/cards/`.
  Falhas de armazenamento são explícitas; uma falha de limpeza interrompe o
  logout, informa o erro e bloqueia a reutilização do Memorizar até repetir a saída.
- **Conflitos e reconexão.** A transação compara o conteúdo exato lido anteriormente
  com o documento atual. Se outro aparelho mudou o ciclo, a confirmação é recusada
  e solicita reabertura. Não há fila de edições offline nem substituição automática
  ao reconectar. A leitura sincroniza ao abrir, não em tempo real.
- **Moment** já consta no acervo (`webapp/data/substantivos.json`), uma única vez.
- **Sem dados de demonstração no site.** A prévia (`window.DL_MEMORIZAR_DEMO`) só é
  ativada em `localhost` pelo servidor de demonstração; em produção `entrada.js`
  segue outro caminho.

### Arquivos
- `webapp/memorizar/entrada.js` — alterna demo (localhost) × produção (Firebase).
- `webapp/memorizar/interface.js` — mesma UI; valores de produção injetados por um
  contexto opcional (`window.DL_MEMORIZAR_CTX`). Os testes da prévia passaram;
  os arquivos foram alterados, não são byte a byte idênticos.
- `webapp/memorizar/nuvem.js` — **novo**: Firestore (`memorizar/{uid}`) + cópia
  local para offline; reaproveita o app Firebase já iniciado por `firebase-dados.js`.
- `firestore.rules` — **nova coleção** `memorizar/{uid}` (conta única, esquema
  validado, `criadoEm` imutável, `list` negado, isolamento por conta).
- `webapp/cards/offline.js` — operações do espelho e limpeza compartilhada nas
  saídas/trocas de conta; não muda o conteúdo dos Cards.
- `webapp/firebase-dados.js` — invalida o Memorizar antes de concluir o logout.
- `webapp/sw.js` — cache dos módulos e dependências exatas; versão
  `deutschleben-v36-memorizar-02`.
- `webapp/cards/cards.js` e `webapp/cards/sw.js` — versão do shell
  `rg-previa-01-10-v10-memorizar-02`, para atualizar a limpeza compartilhada.
- `tests/memorizar-regras.cjs` — **novo**: testes das regras no emulador.
- `tests/memorizar-producao.cjs` — SDK e adaptador reais em dois perfis isolados,
  Firestore emulado e autenticação REST sintética; sem credenciais de produção.

### Os 18 arquivos do primeiro commit

| Grupo | Arquivos | Necessidade / publicação |
|---|---|---|
| Produção e proteção | `firebase.json`, `firestore.rules`, `webapp/index.html`, `webapp/textos.js`, `webapp/sw.js` | Integração/Hosting/regras; alterações anteriores preservadas. |
| Recurso | `webapp/memorizar/entrada.js`, `interface.js`, `memorizar.css`, `modelo.js`, `nuvem.js`, `persistencia.js` | UI/modelo/produção; `persistencia.js` atende a prévia, mas é dependência estática da interface. |
| Acervo | `webapp/data/substantivos.json` | Inclusão única de Moment. |
| Prévia e dados sintéticos | `local-preview/memorizar/servidor.cjs`, `demo.json` | Fora de `webapp`; não publicados pelo Hosting. |
| Testes | `tests/memorizar.cjs`, `tests/memorizar-regras.cjs` | Fora do Hosting; a prévia não prova sincronização de produção. |
| Documentação | `tests/README-cards.md`, `tests/README-memorizar.md` | Fora do Hosting; trecho alheio de Construções separado nesta revisão. |

Esta revisão acrescenta os ajustes de limpeza compartilhada, a suíte de produção
e a correção do teste da Apostila. Não inclui as alterações alheias de `public/`
ou `tools/exportar_para_web.py`. O Hosting continua limitado a `webapp`; nenhum
fixture de teste/demo é copiado para lá. O pacote real existente dos Cards não é
um registro de demonstração e permanece preservado.

## 2. Pré-requisito crítico antes do deploy (ordem importa)

O workflow `.github/workflows/firebase-hosting-deploy.yml` roda
`tools/publicar-regras.cjs` **antes** do Hosting. Esse script é **somente leitura**:
ele **bloqueia o deploy** se as regras ativas no Firestore não forem idênticas ao
`firestore.rules` do commit. Ele **não** publica regras.

Como este commit altera `firestore.rules`, as regras devem estar ativas antes
da etapa de conferência do workflow da nova versão. Um push apenas na branch de
revisão não dispara o deploy por `push`: esse gatilho é restrito à `main`.
Durante a transição, workflows de commits antigos podem falhar na comparação;
por isso a mudança deve ocorrer numa janela sem publicações concorrentes.

O bloco novo não altera nenhuma regra anterior (comparação textual confirmada).
Ele protege o acesso e o envelope do documento, mas NÃO valida o JSON interno de
`conteudo`: as regras só exigem string não vazia de até 200.000 bytes. A validação
do ciclo interno é feita no cliente. `allow delete` também é permitido à conta
autorizada; as regras não comprovam que houve um clique de confirmação na UI.

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

## 3. Sequência proposta, somente após aprovação

1. Conferir os testes locais da seção 4 e as limitações da seção 6. Esta revisão
   não autoriza push, merge, publicação de regras nem de Hosting.
2. Com autorização separada, validar em HTTPS num ambiente de homologação isolado,
   com dados sintéticos e sem copiar dados pessoais. Login feito pelo próprio
   Ricardo nos dois aparelhos; não solicitar senha, token nem chave de serviço.
3. Antes da transição oficial, confirmar que a `main` não avançou, verificar as
   permissões no Firebase Console e salvar os identificadores da release/regras
   e da versão do Hosting atualmente ativas para eventual retorno.
4. Publicar as regras aprovadas e conferir a release ativa. Se houver erro,
   interromper antes de publicar o site. Não executar deploy genérico do projeto.
5. Fazer merge/push na `main` somente depois da aprovação e acompanhar o workflow
   existente até `success`; um push na branch de revisão não substitui esse passo.
6. Conferir a versão no endereço oficial, também após atualizar o service worker,
   e realizar o teste controlado da conta real descrito na seção 5.

### Retorno em caso de falha

- Se só as regras mudaram e o Hosting falhou, o site anterior continua publicado.
  O bloco novo é aditivo; as permissões anteriores continuam. Interromper e decidir
  entre corrigir o deploy ou reativar a release anterior das regras.
- Se o site novo falhar, reverter primeiro o Hosting para a versão registrada no
  Console e confirmar a atualização dos clientes/service workers. Não apagar
  documentos de textos, Cards ou ciclos.
- Só depois de retirar os clientes novos de circulação avaliar restaurar as regras
  anteriores: isso bloqueia o ciclo novo, mas não apaga seus documentos. Clientes
  com PWA/cache antigo podem continuar tentando acessá-lo; verificar esse caso.
- Fazer eventual reversão de código com novo commit de revert, nunca reset forçado.
  A versão do repositório, o Hosting e as regras ativas devem voltar a corresponder
  antes de reexecutar o workflow de comparação.

## 4. Testes já executados localmente (nesta branch)

Revisão do adaptador: Node 22.14.0, Chrome Windows, SDK Firebase local e emulador
Firestore oficial 1.22.0 com Java 21. Dados sintéticos em projetos `demo-*`;
nenhum texto/Card/ciclo da produção foi lido, modificado ou excluído.
Resultado final da execução serial: **9 arquivos de teste aprovados, exit 0,
nenhuma falha e nenhum teste ignorado**. Sintaxe JavaScript e `git diff --check`
também conferidos.

- `tests/memorizar-producao.cjs` — **83 verificações**, usando a entrada, a
  interface, o adaptador, o SDK, as regras e o service worker reais. O servidor de
  teste só redireciona a configuração Firebase para o emulador e fornece o Auth
  REST sintético; não substitui a persistência nem injeta ciclos na interface.
  Cobre texto com/sem Card, três categorias, limites de prazo, cancelar/alterar,
  itens fixos, restauração, sincronização nos dois sentidos em perfis separados,
  concorrência real, reconexão e rejeição de base obsoleta. Encerra o processo do
  Chrome e o reinicia com rede bloqueada antes da navegação, sem texto ativo.
  Testa falhas reais de abertura/put do IndexedDB, transporte bloqueado com
  `navigator.onLine` verdadeiro, fallback local identificado, sucesso remoto com
  falha de espelho, desaparecimento remoto sem apagar a cópia anterior, troca de
  conta durante leitura/salvamento, logout com falha de limpeza e logout offline
  pela página separada dos Cards. Confere documentos completos de textos/Cards
  sintéticos inalterados, inclusive suas datas.
  Acesso HTTPS externo é bloqueado antes da navegação; eventual tentativa de
  verificação de conectividade do SDK (`cleardot.gif`) é bloqueada antes do envio.
- `tests/memorizar.cjs` — **86 verificações** (modelo + navegador): vínculos por
  Card, cobertura honesta, snapshot imutável, prazo 1–10 dias, contagem, conclusão,
  continuar, alterar prazo mantendo itens, troca explícita de texto, conflito e
  falha local. Regressão da prévia aprovada; não é prova de sincronização.
- `tests/memorizar-regras.cjs` — **37 casos** no emulador: criação/leitura/atualização/
  exclusão pela conta única; esquema recusado; `criadoEm` imutável; `list` negado;
  isolamento contra conta anônima/não autorizada.
- `tests/textos.test.cjs` — **60 casos de regras + UI**: confirma que as regras
  existentes e a integração do app continuam intactas após a nova coleção.
- `tests/cards.test.cjs` — **43 verificações** de formato, revisão, autorização
  e exclusão. A dependência ausente no caminho temporário antigo foi resolvida
  com `NODE_PATH` apontando para as dependências isoladas, sem editar o teste.
- `textos-humanizacao`, `selecao-titulo`, `limpar-compreensao` — três regressões
  de interface, seleção, campos, rascunhos e foco.

Revisão de `tests/apostila-blocos.cjs`: a falha foi reproduzida e resolvida.
O preparo dos dados chamava `ctx.firestore()` dentro do laço, novamente após a
primeira gravação, tentando reconfigurar uma instância já iniciada. A referência
ao banco foi movida para antes do laço, sem remover nenhuma asserção. O teste
também passou a aceitar `DL_TEST_DEPS`, como os demais testes do projeto.

Resultado: PASS, exit 0, com Chrome isolado, Auth local e Firestore 1.22.0.
Cobriu os cinco blocos, Cards/Apostila, agrupamento/contextos, falha parcial,
troca de conta, layout móvel e reabertura offline. Não acessou dados de produção.
Nenhuma asserção da Apostila foi removida. O resultado da Apostila NÃO comprova
o offline do Memorizar; essa evidência vem da suíte de produção acima.

Durante as repetições, a abertura do painel revelou uma corrida no status
offline da prévia: a verificação podia terminar antes do clique e seu texto era
apagado. Corrigido sem mudar o prazo/layout; o teste agora aguarda a verificação
antes de abrir, garantindo esse caso.

Também houve uma execução de `textos.test.cjs` que imprimiu `ALL PASS`, mas
terminou com erro tardio de `mostrarResumo` após `dom.window.close()`, devido a
leitura assíncrona ainda pendente. A bateria final encerrou com sucesso, mas essa
intermitência de encerramento permanece registrada para investigação separada.
O teste de Textos e seu fluxo de resumo não foram alterados nesta revisão;
não se classifica esse erro simplesmente como indisponibilidade do ambiente.

### Reproduzir no Windows

Use Node 22, Chrome e um emulador Firestore dedicado em `127.0.0.1:8188`,
com Java 21 e o arquivo atual de regras. Não use um emulador compartilhado com
dados importantes: as suítes apagam apenas seus projetos `demo-*`.
`DL_TEST_DEPS` deve apontar para uma pasta externa com `firebase@10.12.0`,
`@firebase/rules-unit-testing@3.0.2` e `jsdom@26.1.0`.
Se faltarem, restaure essas dependências fora do repositório, sem mudar os
manifests. `CHROME_PATH` pode selecionar outro executável do Chrome para a
suíte de produção; as suítes antigas usam o caminho padrão do Windows.

```powershell
java -jar C:\ferramentas\cloud-firestore-emulator-v1.22.0.jar --host 127.0.0.1 --port 8188 --project_id demo-dl-textos --rules firestore.rules
```

Em outro terminal, após confirmar que o emulador responde:

```powershell
$env:DL_TEST_DEPS = 'C:\ferramentas\dl-test-deps'
$env:NODE_PATH = "$env:DL_TEST_DEPS\node_modules"
node --test --test-concurrency=1 tests\memorizar-producao.cjs tests\memorizar.cjs tests\memorizar-regras.cjs tests\apostila-blocos.cjs tests\textos.test.cjs tests\cards.test.cjs tests\textos-humanizacao.test.cjs tests\selecao-titulo.test.cjs tests\limpar-compreensao.test.cjs
```

Executar serialmente: algumas suítes reutilizam o mesmo projeto sintético.

## 5. Validação manual obrigatória (antes de confiar na sincronização)

Nada aqui substitui o teste real em dois aparelhos. Primeiro homologar em ambiente
isolado; depois confirmar na conta oficial, mediante aprovação da publicação.
Ricardo faz o login Google normalmente em cada aparelho, com 2FA se solicitado.
Não compartilhar senha, cookies, tokens, arquivos de chave nem exportações do perfil.

Usar somente textos/Cards de teste identificados e preservar o ciclo pessoal
existente: nenhum conjunto deve ser substituído sem decisão explícita de Ricardo.
Se já houver ciclo pessoal, combinar antes a preservação e a restauração dele.

1. **Texto com Card:** abrir o texto, abrir Memorizar, conferir as 3 categorias e
   iniciar um ciclo (ex.: 3 dias). Ver a contagem regressiva.
2. **Texto sem Card:** abrir Memorizar e confirmar a mensagem honesta, sem
   identificação inventada; “Iniciar ciclo” deve recusar (nenhum item seguro).
3. **Sincronização PC → celular:** iniciar o ciclo no computador; no celular, com o
   **mesmo login**, abrir Memorizar e confirmar que o mesmo ciclo e os mesmos itens
   aparecem, com a contagem coerente.
4. **Sincronização celular → PC e conflito:** mudar o prazo no celular, reabrir no
   PC e conferir a mesma mudança. Em duas telas abertas com o estado antigo,
   confirmar que a segunda tentativa recusa substituir silenciosamente o ciclo.
   A implementação consulta ao abrir, não oferece atualização em tempo real.
   Mudar para 7 e depois 10 dias; os itens devem permanecer.
5. **Restauração:** recarregar a página e reabrir Memorizar; o ciclo volta.
6. **Troca de categorias:** abrir cada uma das três categorias.
7. **Offline:** em cada aparelho, abrir online para guardar o pacote/ciclo,
   desligar Wi-Fi e rede móvel, fechar o navegador/PWA e reabrir sem conexão.
   Repetir com recarregamento completo, conferir texto, itens, categorias e prazo.
   Iniciar/alterar deve falhar explicitamente e manter o ciclo anterior. Reconectar
   e conferir que uma cópia antiga não sobrescreve uma mudança do outro aparelho.
   Registrar navegador/SO, prazo e contagens, sem conteúdo pessoal ou credenciais.
8. **Conta:** sair da conta deve remover a cópia local; repetir também pela página
   Cards. Entrar de novo recarrega da conta. Entrar em outra conta não pode mostrar
   o conteúdo anterior (as regras atuais não autorizam outra conta).

Preserve os dados pessoais, os Cards e as demais funcionalidades em todos os passos.

## 6. Limitações conhecidas

- Dois perfis independentes no Chrome Windows, com SDK e Firestore emulado,
  não equivalem a computador e celular físicos. HTTPS, Google/2FA reais,
  Safari/iOS, retenção do armazenamento no celular e instalação como PWA ainda
  precisam de homologação. Não foram usadas credenciais de produção.
- A repetição da suíte de Textos mostrou a intermitência de teardown descrita
  na seção 4; o sucesso da última execução não prova sua eliminação.
- O primeiro acesso precisa de conexão para autenticar e baixar o pacote. Limpar
  dados do navegador, trocar de perfil ou perder o armazenamento local impede
  recuperar a cópia offline. A conta remota não é apagada por isso.
- O relógio e o fuso são os do aparelho; a contagem pode diferir se os relógios
  estiverem incorretos. Não há relógio confiável de servidor para a contagem.
- Não há sincronização em tempo real nem edição offline. Após conflito ou falha
  de confirmação, reabrir para conferir o servidor e confirmar novamente.
- Após sucesso remoto com falha local, a conta contém o ciclo novo, mas o espelho
  pode conter a versão anterior. A mensagem orienta não depender do offline e
  reabrir com conexão para refazer a cópia.
- Se o servidor não encontrar o registro, a cópia anterior não é apagada
  automaticamente. Reabrir offline pode mostrar essa cópia, identificada como
  local e potencialmente desatualizada; confira a conta antes de iniciar outro.
- Não se promete transação atômica entre Firestore e IndexedDB. Uma solicitação
  já aceita pelo servidor pode ter sido salva mesmo se a resposta se perder:
  reabra para conferir. Não há reenvio automático depois de falha final.
- As regras protegem acesso e envelope, mas não interpretam o JSON do ciclo nem
  garantem a intenção de um clique. A comparação de conflitos e a preservação
  da UI são responsabilidades do adaptador, testadas no caminho de produção.
- A publicação das regras é uma ação privilegiada separada do push; precisa ser
  feita por quem tem acesso ao projeto `ricardo-d6119`.

Próximo passo: autorização separada para preparar um backend/projeto de
homologação e Hosting HTTPS isolados, sem afetar o oficial. Usar dois aparelhos
e dados sintéticos; Ricardo faz login diretamente em cada um. O projeto isolado
precisa de configuração/authorized domains próprios e das regras equivalentes,
sem ampliar o acesso oficial. Executar a seção 5, registrar resultados sem
credenciais e só então decidir sobre publicação. O UID de teste pode ser
diferente nesse projeto: autorizar somente a conta prevista na homologação,
sem alterar ou ampliar a autorização do projeto oficial.
Nada disso foi publicado nesta
etapa; não se afirma homologação física nem conclusão do deploy.
