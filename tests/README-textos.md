# Verificação da fase Textos

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
