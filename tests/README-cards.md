# Cards v1

## Organização e fluxo — fluxo-4

Entrada com lista de textos e Adicionar card; Atualizar lista fica em Mais
opções. Escolher um texto abre seu estudo. Sem card, aparece Adicionar card para
este texto, sem controles de estudo vazios. Os cards já salvos abrem normalmente,
sem nova importação.

Estudo: título, botões de seção e uma caixa. Minhas dúvidas mostra `duvidas`;
todas as seções exibem seus itens completos. Essencial/Completa saiu da interface,
mas as marcações `essencial` permanecem intactas no JSON. Contextos começam
recolhidos; traduções começam visíveis e podem ser ocultadas junto com suas notas.
Reler texto e Usar sem internet são apoios. Mais opções começa recolhido e reúne
revisão, remoção da cópia local e exclusão do card remoto, com descrições e
confirmações distintas. Ajuda contém instalação e detalhes da cópia; o estudo
mostra só uma indicação curta de disponibilidade.

Adicionar/revisar usa `dialog` modal nativo, com foco inicial, confinamento de Tab,
Escape e retorno ao botão de origem ao cancelar. Revisão carrega o registro atual
e mantém o original pelo ID, com o seletor bloqueado. O fluxo continua original,
conteúdo, conferência da prévia e salvamento explícito. Pacote Texto 01 e modelo
ficam somente na janela. Alterações invalidam a prévia. Cancelar/Escape confirma
descarte de alterações; uma falha mantém conteúdo, seleção e janela abertos.
Ao salvar com confirmação do servidor, fecha a janela, abre o card e foca
“✓ Card salvo”. “✓ Disponível sem internet” aparece junto ao apoio apenas depois
da verificação do shell e conclusão do armazenamento local.

Sem mudanças no adaptador de dados, formato JSON v1, regras, registros remotos,
banco de conteúdo local ou service worker raiz. O shell dos Cards recebe
`fluxo-4`; abrir com internet atualiza os recursos mantendo cópias pessoais.
Cores, fontes e aparência dos botões foram preservadas. O CSS novo limita a
janela ao viewport e usa as mesmas fontes, bordas e cores existentes.

Verificação desta entrega: `node tests/cards-fluxo.cjs`, somente os fluxos
alterados, com Chrome isolado, Auth REST local simulado em `127.0.0.1:8769` e
Firestore `demo-dl-textos` em `127.0.0.1:8188`. A fixture começa com um card já
salvo e uma cópia do shell anterior, que migra sem nova importação nem alteração
do conteúdo local. Confere abertura, seções completas, tradução/contexto,
adicionar/revisar, Tab/Escape/foco, recusa/aceitação de descarte, carga/colagem,
validação, falha real de permissão do emulador e manutenção do conteúdo digitado,
sucesso só depois de liberação/conclusão da transação, revisão no mesmo UID/ID
com criação preservada, falha/sucesso de disponibilidade, remoção local sem apagar
o remoto e exclusão remota preservando o original. Reinicia o processo do Chrome
com rede bloqueada e consulta o card revisado e o original offline.

Layout de estudo e janela conferido em 1440, 390 e 768 px, fontes de 22 px,
sem overflow horizontal, janela dentro do viewport e botões com a cor pastel
existente. Capturas ficam na pasta temporária indicada na saída. Verificação
concluída com sucesso em 06/10/2026. Nenhum documento de produção foi lido,
gravado ou excluído; suítes anteriores não foram executadas.

Limites: Chrome Windows foi efetivamente testado. Celular/tablet foram simulados
por viewport; aparelhos físicos, Safari/iOS, Firefox e Edge não foram testados.
O aparelho precisa abrir os Cards com internet uma vez para receber a atualização.
Conferir/salvar exige internet; uma falha não apaga o conteúdo enquanto a janela
permanece aberta. Rascunhos não são persistidos ao recarregar/sair da conta.

As seções abaixo documentam entregas anteriores; para a interface atual, use a
verificação focada `cards-fluxo.cjs`.

## Correção focada — conferencia-3

Reprodução de `7def0ae` com `node tests/cards-conferir.cjs --antes`, usando
perfil Chrome temporário, clique real do mouse e somente o emulador. Carregar
Texto 01, selecionar o original compatível e conferir executava o evento e a
validação corretamente, criando três linhas de prévia. Na tela de 390 × 844 px,
o início da prévia ficava em 1042 px, fora da tela. A mensagem de sucesso também
ficava acima da tela. Com original incompatível, o erro da validação era lançado
corretamente, mas só aparecia no status global, mais de 700 px acima da área
visível. Portanto, a causa comprovada foi a posição/falta de foco do retorno.
O cenário incompatível é uma simulação local, não uma afirmação sobre o original
selecionado por Ricardo na produção. Não foi atribuída a cache.

Correção: retorno local junto a Conferir card, com aviso durante a conferência,
erro ou confirmação de prévia; foco e rolagem trazem o conjunto para a tela.
Falta de original indica o campo “Texto existente”, associado à mensagem por
`aria-describedby` e marcado com `aria-invalid`. A validação e o salvamento
explícito continuam intactos. Não há mudança de CSS, regras ou dados. Apenas
script e shell dos Cards recebem versão `conferencia-3` para distribuir a
correção; o service worker do DL permanece preservado.

Teste corrigido: `node tests/cards-conferir.cjs`. Confirma evento, validação,
prévia visível, erro de vínculo visível, original ausente, JSON inválido,
invalidação/recuperação, foco e fonte de 22 px em celular/tablet simulados.
Também confere que nenhum card foi salvo no emulador. Não acessa documentos
de produção. As capturas antes/depois ficam na pasta temporária indicada na
saída. Só essa verificação focada foi executada nesta correção.

## Consulta e importação — consulta-2

Consulta e prévia usam a mesma apresentação: botões de seção e uma única caixa
com linhas alemão → português (português abaixo no celular). Essencial oferece
somente seções com itens essenciais; Completa oferece todas as seções não vazias.
Uma seção indisponível após trocar o modo cede à primeira disponível. Contextos
começam recolhidos em “Ver contexto”; frases idênticas ao alemão do item não são
repetidas. Traduções e suas notas ficam no campo `pt` e são ocultadas juntas.

“Carregar Texto 01” busca o pacote existente e preenche o formulário. Nunca
escolhe o original pelo título. “Cole o conteúdo do card” continua aceitando
JSON v1 do chat. Conferir card, Salvar card e Cancelar ficam no começo da prévia.
Editar o conteúdo ou trocar o original invalida a prévia. Não há gravação durante
carregamento/conferência; salvar exige novo clique explícito depois de validar.
Falha no carregamento tem mensagem e permite repetir o mesmo botão.

O SW exclusivo dos Cards identifica o shell `consulta-2`, inclui o pacote e
atualiza os recursos públicos atomicamente no banco de shell existente. A página
confere a versão após instalar/ativar o worker e faz a atualização ao abrir com
internet ou recuperar a conexão. Scripts/CSS têm URLs com versão para evitar
cache antigo. Cópias pessoais, banco de conteúdo, regras, adaptador de dados,
exclusão e service worker raiz não foram alterados. Um aparelho que permaneça
offline desde a versão anterior precisa abrir os Cards com internet para receber
esta atualização; depois pode consultar novamente offline.

Verificação desta mudança: `node tests/cards-consulta.cjs`. Reutiliza a
infraestrutura local descrita abaixo, com Auth REST simulado em
`127.0.0.1:8767`, Firestore `demo-dl-textos` em `127.0.0.1:8188` e Chrome isolado.
Executa apenas consulta/importação alteradas: migração do shell anterior sem
alterar a cópia pessoal, carga direta/falha/nova tentativa, escolha manual,
colagem, JSON inválido/válido, invalidação, cancelamento, gravação explícita,
seções/modos, português e notas ocultos, contextos e consulta offline após
reiniciar o processo do navegador. Celular/tablet em 390/768 px, prévia e card,
fontes de 22 px, sem overflow ou cortes horizontais; capturas na pasta temporária
indicada na saída. Verificação concluída com sucesso em 06/10/2026.

Somente Chrome Windows foi testado. Celular/tablet foram simulados por viewport;
Safari/iOS, Firefox, Edge e aparelhos físicos continuam sem verificação.
Nenhum documento de produção foi criado, lido ou excluído durante os testes.

As verificações v1 abaixo são o histórico da primeira entrega; não foram
reexecutadas nesta mudança. Para a interface atual, use a suíte focada acima.

## Histórico da primeira entrega

Página: `/cards/`. Firebase Authentication existente; autorização mantém somente
o UID já autorizado a ler os originais. Registro `textos/{textoId}/cards/{uid}`:
UID, ID, versão, JSON do card e datas de criação/atualização. O original não é
duplicado no registro remoto. Revisões preservam a criação e sobrescrevem o mesmo
documento, mediante ação explícita.

Formato copiável: `webapp/cards/modelo.json`. Primeiro conteúdo completo:
`webapp/cards/texto-01.json`. A seleção do original é manual; a prévia confere
cada frase de origem contra o conteúdo existente. Todos os campos são texto e
entram no DOM com `textContent`. O conteúdo é preparado no chat, sem API de IA.
As regras validam identidade, vínculo, campos, versão, tamanho e datas; o schema
interno do JSON é validado pela interface, pois as regras não interpretam JSON.

Exclusão de texto: o adaptador existente lê original, resumo e card antes de
excluir os três na mesma transação. As regras recusam excluir um original que
deixe resumo/card. O card pode ser excluído sozinho, preservando o original.
Após excluir ou revisar, a cópia local correspondente é removida.

Offline: `/cards/sw.js` tem escopo `/cards/`. O shell completo, inclusive os três
módulos oficiais Firebase 10.12.0, é armazenado atomicamente em IndexedDB
`dl-cards-shell-v1`. Isso evita a limpeza de caches efetuada pelo SW raiz, que
permanece intacto. Conteúdo explicitamente escolhido fica em
`dl-cards-local-v1`, chave `[uid,textoId]`. Só se anuncia disponibilidade depois
de conferir o shell instalado e concluir a transação local do card e original.
O SDK mantém a autenticação; não criamos armazenamento próprio de credenciais.
Ao sair, as cópias pessoais são apagadas. Ao trocar de conta, o DOM é limpo
imediatamente e o armazenamento é isolado antes de exibir a nova conta. Dados
remotos não usam persistência Firestore offline.

Limites: uma exclusão/revisão feita em outro aparelho não pode ser detectada
enquanto este estiver sem rede. Atualizar a lista online remove cópias de
originais excluídos. Atualizar uma cópia após revisão remota exige disponibilizar
novamente. Não é possível comprovar revogação de sessão no servidor sem rede.
Dispositivo/navegador continua devendo estar sob controle do usuário; a cópia
local não é criptografada. Quota, limpeza/remoção dos dados pelo navegador e
modo privado podem impedir ou revogar o offline; as falhas não anunciam sucesso.
Sessão expirada pode exigir reconexão para operações remotas.

Verificações locais (nenhum documento de produção):

- `node tests/cards.test.cjs`: 43 verificações de formato, revisão, UID,
  ausência do original e atomicidade, Firestore em `127.0.0.1:8188`, projeto
  `demo-dl-textos`. Dependências/emulador em `TEMP/dl-textos-tests`.
- `node tests/cards-browser.cjs`: Chrome headless com perfil temporário,
  serviço Auth REST simulado em `127.0.0.1:8766`, SDK real e Firestore emulador.
  Importação inválida/válida, HTML inerte, revisão, modos, português, exclusão
  do card, remoção local, troca de conta/saída. Fecha o processo inteiro,
  reabre com o mesmo perfil e bloqueia toda a rede antes de navegar; recupera
  sessão, lista, card e original. Também instala o SW raiz antes de fechar.
  Layout em 1440, 390 e 768 px, fontes de 22 px, controles de pelo menos 48 px,
  sem overflow horizontal; capturas em pasta temporária indicada na saída.
- `node tests/textos-final.test.cjs`: regressão focada dos fluxos existentes,
  incluindo agora exclusão de texto com card e resumo pela transação real.

Chrome Windows foi o navegador efetivamente testado, incluindo reinicialização
offline. Celular/tablet foram emulados por viewport; dispositivos físicos,
Safari/iOS, Firefox e Edge não foram testados. O manifesto oferece atalho em
`/cards/`; instalação e retenção do armazenamento dependem do navegador.

Publicação: workflow existente publica e compara as regras ativas antes de
autorizar Hosting. `firebase.json`, tags e congelamentos permanecem preservados.
O pacote Texto 01 não é importado na produção pelos testes nem pelo deploy.
