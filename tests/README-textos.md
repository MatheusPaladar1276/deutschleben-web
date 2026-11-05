# Verificação da fase Textos

## Interface simplificada — Web 11

`node tests/estudo-simplificado.test.cjs` verifica a interface aprovada,
LEO, trecho separado da busca, quadro exclusivo do módulo 04 e integração
de resumo/Memória, inclusive falha e isolamento, sem backend de produção.
`node tests/estudo-browser.cjs` confere a interface no Chrome a 1280, 390
e 320 px, incluindo abertura/recolhimento e rolagem horizontal do quadro.
Os testes anteriores de pergunta/compreensão/SDA ativam explicitamente a
interface completa para garantir que o código preservado ainda funciona.

A interface completa pode ser reativada alterando
`data-estudo-simplificado="true"` para `"false"` no corpo da página.
Os controles ocultos não participam da navegação por teclado. A autenticação
e as transações Firebase de **Salvar resumo** permanecem inalteradas; nenhum
adaptador local de demonstração integra a publicação.

Após alterar recursos públicos, execute
`node tools/atualizar-manifesto-referencia.cjs`. A versão Web 11 atualiza o
shell raiz e as URLs de JS/CSS para evitar servir a interface antiga do cache,
sem remover IndexedDB, localStorage, sessões ou resumos pessoais.
Os recursos textuais de `webapp` usam LF por `.gitattributes`, para os hashes
serem os mesmos no checkout Windows e na publicação pelo GitHub Actions.

Os testes usam apenas `demo-dl-textos` em `127.0.0.1:8188`, nunca produção.

Dependências isoladas: Node 22, Java 21, emulador oficial Firestore 1.22.0,
`firebase@10.12.0`, `@firebase/rules-unit-testing@3.0.2` e `jsdom@26.1.0`.
Instale os pacotes em uma pasta temporária e defina `DL_TEST_DEPS` com o caminho
que contém `package.json` e `node_modules` (padrão: TEMP/dl-textos-tests).

Inicie o emulador:

```text
java -jar <firestore.jar> --host 127.0.0.1 --port 8188 --project_id demo-dl-textos --single_project_mode --single_project_mode_error --rules <caminho-absoluto>/firestore.rules
```

Na raiz do projeto:

```text
node tests/textos.test.cjs
```

A suíte valida regras negativas e positivas e executa a interface no jsdom com
os métodos reais do SDK conectados ao emulador. O layout visual fica para
homologação no navegador. Se existir TEMP/dl-retomada-fixture.json, reutiliza a
leitura administrativa de Vorstellung; não consulta produção durante os testes.

O acervo anterior está em `acervo/seguranca-web/index-7fab1f9.html`; os arquivos
`webapp/data/caminhadas.json`, demais apoios e registros locais não são removidos.

## Humanização: verificação focada

`node tests/textos-humanizacao.test.cjs` reutiliza o jsdom já disponível e testa
somente seleção/foco, pergunta por conta e texto, consulta SDA com/sem seleção,
cópia manual, codificação do LEO, abertura simples e resumo recolhível.
O adaptador de dados é local: não conecta ao Firebase nem grava documentos.
A suíte completa anterior foi adaptada aos novos controles, mas não precisa ser
reexecutada neste pacote. A aparência final requer homologação no navegador.

Diagnóstico offline: `carregarTexto`, `listarTextos` e `carregarResumo` exigem o
servidor (`getDocFromServer`/`getDocsFromServer`); salvar resumo usa transação.
O texto e o resumo já exibidos podem continuar legíveis na página aberta. Pergunta
e compreensão ficam somente em memória e se perdem ao recarregar/fechar a página.
O service worker guarda páginas e recursos do próprio domínio após acesso, mas
não intercepta os módulos Firebase hospedados no Google nem suas chamadas.
Assim, pode recuperar uma página visitada do cache, mas não garante reinicialização
completa offline, listagem ou retomada de textos/resumos. Nenhum suporte offline
novo foi implementado.

## Pacote final sobre 1c5535e

`node tests/textos-final.test.cjs` usa o mesmo emulador e dependências acima.
Valida somente as novas permissões de exclusão (incluindo atomicidade e UID),
memória de resumos do Firebase, busca, retomada, revisão explícita, falha e
cancelamento, limpeza de rascunhos/ID lembrado e confirmação de cópia/foco/Escape.
Não lê nem altera documentos de produção. Não executa a suíte completa anterior.

`node tests/acessibilidade-layout.cjs --pacote-final` reaproveita a renderização
local com Chrome headless em Windows, a 100% de zoom, nas larguras 1440 e 390 px.
Confere apenas telas alteradas e salva imagens/resultado em uma pasta temporária.

A memória faz uma listagem de textos e uma leitura do resumo do UID por texto,
sem coleção ou índice novo. Exige servidor; falha em qualquer leitura oferece
nova tentativa, em vez de afirmar ausência de resumos. A exclusão é uma transação
do original e do resumo conhecido do UID; as regras negam remover apenas um deles
quando há resumo. O workflow publica e confere as regras ativas antes do Hosting,
pela API oficial de regras e preservando o firebase.json do projeto.
