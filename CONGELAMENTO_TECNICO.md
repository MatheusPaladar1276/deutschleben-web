# DL homologado — congelamento técnico

Homologado por Ricardo em 02/10/2026, para início da fase de estudo.

- Commit da versão final da aplicação publicada e homologada: `2ba26c9e2b58c4e7651b27dfbcd8682be2be4cd4` (`2ba26c9`).
- Tag anotada final para início dos estudos: `dl-estudo-2026-10-02`, apontando exatamente para esse commit da aplicação, não para o commit documental.
- Mensagem da tag final: “Versão final homologada por Ricardo — configuração encerrada, início dos estudos”.
- Tag anterior preservada: `dl-estavel-2026-10-02`, mantendo o destino `f5046c17a73f19f619dea885ffc6e337710c45b0` (`f5046c1`).

## Fluxos consolidados

Textos; compreensão temporária; Ajuda rápida; LEO; Consulta SDA com o original completo e os campos atuais; limpezas independentes; resumo explicitamente salvo; Memória de estudo e retomada; Apostila e Referência Gramatical.

Acessibilidade e visual homologados, incluindo o botão “Limpar compreensão” compacto à esquerda e o aviso de rascunho com `font-weight: 700` e cor `#253a35`. Em telas muito estreitas, o botão pode quebrar o texto sem cortes, preservando a fonte acessível.

Últimos ajustes na janela “Escolher texto”: numeração apenas visual na ordem da lista completa, preservada durante a busca, e caixas dos textos com fundo lilás pastel. Títulos, IDs e dados salvos permanecem intactos, assim como as fontes acessíveis, os botões Abrir/Excluir e os demais fluxos.

## Limites conhecidos

- Rascunhos temporários são perdidos ao fechar ou recarregar a página.
- Internet é necessária para Memória de estudo, retomada e exclusão.
- A consulta SDA usa cópia manual, sem integração por API.

## Diretriz

Configuração encerrada e início dos estudos. Alterações de interface e funcionalidades encerradas nesta etapa; ideias futuras ficam anotadas. Somente falhas que impeçam o estudo justificam manutenção imediata.

Este registro não altera a aplicação, as regras ou o workflow e não requer republicação nem repetição de testes.

## Deutschleben Cards — congelamento de 06/10/2026

Versão homologada por Ricardo, pronta para estudo. O backup é a versão preservada no repositório remoto.

- Commit exato da aplicação aprovada e publicada: `2e3af10b1b292b82b3048479371ae306168af4b5` (`2e3af10`), incluindo o reforço das bolinhas do fundo externo.
- Publicação confirmada: workflow “Deploy Firebase Hosting”, execução [37539664199](https://github.com/MatheusPaladar1276/deutschleben-web/actions/runs/37539664199), concluído com sucesso.
- Tag anotada: `cards-estavel-2026-10-06`, apontando para esse commit da aplicação, e não para o commit documental.
- Mensagem da tag: “Deutschleben Cards — versão homologada por Ricardo, pronta para estudo”.
- Este registro é somente documental, com `[skip ci]`: não altera aplicação, regras ou workflow, não inicia deploy e não repete testes. Tags anteriores e trabalho local alheio são preservados.

### Estado aprovado de /cards/

Entrada com lista de textos e “Adicionar card”; abertura da área de estudo por texto. Textos sem card oferecem adicionar para aquele original. Uma seção por vez, em caixa única: Minhas dúvidas, Blocos, Sentenças, Substantivos, Verbos, Adjetivos e Advérbios, com todo o conteúdo preservado. Tradução inicialmente visível e ocultável, inclusive nas notas explicativas; contexto recolhido por “Ver contexto”; releitura do original.

Adicionar e revisar em janela própria: escolher e conferir manualmente o original, colar conteúdo, conferir prévia e salvar explicitamente após validação JSON v1. “Carregar Texto 01” e modelo ficam nessa janela, sem associação automática pelo título. Edição ou troca de original invalida a prévia; revisão atualiza o mesmo registro vinculado por UID/texto. Falhas preservam o conteúdo digitado; descarte exige confirmação; foco, Escape e retorno ao botão de origem são mantidos.

Offline por conta, aparelho e navegador, com card e original armazenados localmente após confirmação de “Usar sem internet”. Confirmações junto às ações; indicação curta de disponibilidade; “Mais opções” recolhido com revisão, remoção local e exclusão remota claramente distintas. Remover a cópia local preserva o card remoto; excluir o card preserva o texto original. Cards já salvos não exigem nova importação. Recursos offline próprios de /cards/, sem alteração do service worker principal do DL.

Visual pastel: lista e estudo azul acinzentado, conteúdo lilás e editor creme, caixas opacas, contornos, faixa lateral discreta e sombra leve. Botões pastel variados, letras escuras, fontes acessíveis e foco visível; seleção de seção diferenciada. Ajuda removida. Marca HTML/CSS existente do DL reutilizada com filete, cores e lema, como link de retorno ao DL. Autenticação à direita com Sair, indicador verde vivo e “Conectado” em negrito; indicação baseada na autenticação, independente da disponibilidade de internet. Título Cards e frase abaixo, com reorganização em telas estreitas.

Fundo externo verde sálvia acinzentado `#CBD8CF`, com padrão CSS regular de bolinhas pretas: raio de 1,2 px, opacidade de 35% e espaçamento de 14 px. Cobre a página durante a rolagem, sem aparecer atrás dos textos internos das caixas.

### Limitações conhecidas dos Cards

- Conferir, salvar/revisar e excluir remotamente exigem internet; acesso offline depende de preparação prévia concluída naquele aparelho e navegador.
- Cópias locais são isoladas por conta; sair remove as cópias. Limpar dados do navegador também as remove. Instalação como aplicativo e retenção do armazenamento dependem do navegador.
- Alterações feitas em outro aparelho não são detectadas enquanto estiver sem rede.
- O original deve ser escolhido e conferido manualmente. O carregamento do Texto 01 não identifica automaticamente o original pelo título; próximos cards continuam usando copiar e colar.
- Conteúdo digitado é preservado durante falhas na janela, mas não há garantia de recuperação após fechar ou recarregar a página.
- As imagens MAPC e a segunda imagem da marca não estavam disponíveis nos anexos da sessão; o acabamento seguiu a descrição fornecida e a marca existente no projeto.
- Conferências visuais realizadas no Chrome com dados locais e CSS completo, em desktop/celular/tablet conforme os ajustes; o último reforço do fundo foi conferido a 100% de zoom em desktop e celular. Não houve acesso a documentos de produção nas conferências, nem repetição de suítes lógicas nos ajustes visuais. Não equivale a homologação em todos os navegadores ou aparelhos físicos.

Configuração dos Cards encerrada nesta etapa para início do estudo. A referência de restauração é a tag acima no repositório remoto.
