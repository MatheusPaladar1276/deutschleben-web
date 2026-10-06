# Cards v1

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
