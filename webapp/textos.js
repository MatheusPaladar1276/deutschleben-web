// Fluxo ativo de Textos. Compreensões e conversa não são persistidas.
(function () {
    "use strict";
    const UID = "WuXcMYo6m3OuQttlk7z22gRjlvn1";
    const $ = id => document.getElementById(id);
    const seletor = $("seletor-texto"), status = $("textos-status"), repetir = $("textos-repetir");
    const inicio = $("abertura-textos"), estudo = $("estudo-texto");
    const titulo = $("titulo-texto"), original = $("original-texto"), compreensao = $("texto-compreensao");
    const resumo = $("resumo-conteudo"), resumoStatus = $("resumo-status"), salvarResumo = $("salvar-resumo");
    const relerResumo = $("reler-resumo"), copiaStatus = $("copia-status");
    const modal = $("adicionar-texto-overlay"), form = $("form-adicionar-texto");
    const novoTitulo = $("adicionar-titulo"), novoConteudo = $("adicionar-conteudo");
    const novoStatus = $("adicionar-status"), salvarNovo = $("adicionar-salvar");
    const voltarNovo = $("adicionar-voltar"), reabrirNovo = $("adicionar-reabrir");
    const pergunta = $("minha-pergunta");
    const memorias = new Map(), novos = new Map();
    const escolha = $("escolha-textos"), escolhaStatus = $("escolha-status");
    const confirmacao = $("consulta-confirmacao"), excluirDialogo = $("excluir-confirmacao");
    const origens = new WeakMap();
    let textosListados = [], listaErro = false, listaLendo = false, exclusao = null;
    let resumosSalvos = [], memoriaGeracao = 0, memoriaPronta = false;
    let uid = null, ativo = null, selecionado = null, geracao = 0, listaGeracao = 0;
    let sessao = 0, salvandoNovo = false, novoId = null, focoAnterior = null, tentar = null;
    function usuario() { return window.DL_AUTH?.usuario?.uid || null; }
    function chave(texto) { return JSON.stringify([texto.uid, texto.id]); }
    function memoria(texto = ativo) {
        const k = chave(texto);
        if (!memorias.has(k)) memorias.set(k, { compreensao: "", pergunta: "", resumo: "", salvo: "", carregado: false,
            alterado: false, lendo: false, salvando: false, mensagem: "", erroLeitura: false });
        return memorias.get(k);
    }
    function atual(texto) { return ativo && usuario() === texto.uid && chave(ativo) === chave(texto); }
    function abrirDialogo(dialogo, origem, foco) {
        origens.set(dialogo, origem || document.activeElement);
        if (!dialogo.open) dialogo.showModal();
        foco?.focus();
    }
    function fecharDialogo(dialogo, devolver = true) {
        if (dialogo.open) dialogo.close();
        if (devolver) {
            const origem = origens.get(dialogo);
            if (origem?.isConnected && !origem.disabled) origem.focus();
            else if (escolha.open) $("escolha-busca").focus();
        }
    }
    for (const dialogo of [escolha, confirmacao, excluirDialogo]) {
        dialogo.addEventListener("cancel", ev => {
            ev.preventDefault();
            if (dialogo === excluirDialogo && exclusao?.emCurso) return;
            fecharDialogo(dialogo);
            if (dialogo === excluirDialogo) exclusao = null;
        });
    }
    $("consulta-entendi").addEventListener("click", () => fecharDialogo(confirmacao));
    $("escolha-voltar").addEventListener("click", () => fecharDialogo(escolha));
    $("escolher-textos").addEventListener("click", () => {
        geracao++; // Uma abertura antiga não deve fechar a escolha recém-aberta.
        abrirDialogo(escolha, $("escolher-textos"), $("escolha-busca"));
        renderEscolha();
        if (uid === UID && !listaLendo) listar();
    });
    $("escolha-busca").addEventListener("input", renderEscolha);
    $("escolha-repetir").addEventListener("click", listar);
    $("escolha-adicionar").addEventListener("click", () => {
        fecharDialogo(escolha, false); abrirAdicionar();
    });
    function renderEscolha() {
        const lista = $("escolha-lista"); lista.replaceChildren();
        $("escolha-adicionar").disabled = uid !== UID || !!exclusao?.emCurso;
        $("escolha-repetir").hidden = !listaErro;
        if (uid !== UID) { escolhaStatus.textContent = "Entre com a conta Google autorizada para escolher textos."; return; }
        if (listaLendo) { escolhaStatus.textContent = "Carregando textos…"; return; }
        if (listaErro) { escolhaStatus.textContent = "Não foi possível atualizar a lista. Tente novamente."; }
        const termo = $("escolha-busca").value.trim().toLocaleLowerCase("pt");
        const visiveis = textosListados.filter(t => (t.titulo || "Sem título").toLocaleLowerCase("pt").includes(termo));
        if (!listaErro) escolhaStatus.textContent = textosListados.length
            ? (visiveis.length ? "" : "Nenhum texto corresponde à busca.") : "Nenhum texto salvo. Você pode adicionar o primeiro.";
        for (const texto of visiveis) {
            const linha = document.createElement("div"); linha.className = "escolha-linha"; linha.dataset.textoId = texto.id;
            const nome = document.createElement("span"); nome.className = "escolha-nome"; nome.textContent = texto.titulo || "Sem título";
            const acoes = document.createElement("div"); acoes.className = "escolha-acoes";
            for (const [rotulo, classe, acao] of [["Abrir", "escolha-abrir", async ev => {
                const botao = ev.currentTarget, conta = uid, epoca = sessao, rodada = geracao + 1;
                botao.disabled = true; escolhaStatus.textContent = "Abrindo texto…";
                const aberto = await abrirTexto(texto.id);
                if (epoca !== sessao || usuario() !== conta || rodada !== geracao) return;
                if (!aberto && escolha.open) {
                    escolhaStatus.textContent = "Não foi possível abrir o texto. Tente novamente.";
                    botao.disabled = false;
                } else if (aberto) {
                    titulo.setAttribute("tabindex", "-1"); titulo.focus();
                }
            }],
                ["Excluir", "escolha-excluir", ev => confirmarExclusao(texto, ev.currentTarget)]]) {
                const b = document.createElement("button"); b.type = "button"; b.className = classe; b.textContent = rotulo;
                b.setAttribute("aria-label", rotulo + ": " + nome.textContent);
                b.disabled = !!exclusao?.emCurso; b.addEventListener("click", acao); acoes.append(b);
            }
            linha.append(nome, acoes); lista.append(linha);
        }
    }
    function renderMemoria() {
        const lista = $("memoria-lista"); lista.replaceChildren();
        if (uid !== UID) return;
        const termo = $("prog-busca").value.trim().toLocaleLowerCase("pt");
        const visiveis = resumosSalvos.filter(t => (t.titulo + " " + t.conteudo).toLocaleLowerCase("pt").includes(termo));
        if (memoriaPronta) $("memoria-status").textContent = resumosSalvos.length
            ? (visiveis.length ? "" : "Nenhum resumo corresponde à busca.") : "Nenhum resumo final salvo nesta conta.";
        for (const texto of visiveis) {
            const item = document.createElement("article"); item.className = "memoria-item"; item.dataset.textoId = texto.id;
            const h = document.createElement("h3"); h.textContent = texto.titulo;
            const conteudo = document.createElement("p"); conteudo.className = "memoria-conteudo"; conteudo.textContent = texto.conteudo;
            const retomar = document.createElement("button"); retomar.type = "button"; retomar.textContent = "Retomar estudo";
            retomar.setAttribute("aria-label", "Retomar estudo: " + texto.titulo);
            retomar.disabled = !!exclusao?.emCurso;
            retomar.addEventListener("click", async () => {
                const conta = uid, epoca = sessao;
                retomar.disabled = true;
                const aberto = await abrirTexto(texto.id);
                if (epoca !== sessao || usuario() !== conta) return;
                if (aberto) {
                    const m = memoria(); m.salvo = texto.conteudo;
                    if (!m.alterado) m.resumo = texto.conteudo;
                    mostrarResumo(ativo); $("resumo-secao").open = true;
                    window.fecharProgresso(); $("titulo-texto").setAttribute("tabindex", "-1"); $("titulo-texto").focus();
                } else {
                    $("memoria-status").textContent = "Não foi possível retomar o texto. Tente novamente.";
                    retomar.disabled = false;
                }
            });
            item.append(h, conteudo, retomar); lista.append(item);
        }
    }
    async function carregarMemoria() {
        const rodada = ++memoriaGeracao, conta = uid, epoca = sessao;
        $("memoria-repetir").hidden = true; memoriaPronta = false;
        resumosSalvos = []; renderMemoria();
        if (conta !== UID || usuario() !== conta) {
            $("memoria-status").textContent = "Entre com a conta Google autorizada para ler seus resumos."; return;
        }
        $("memoria-status").textContent = "Carregando resumos salvos…";
        try {
            const dados = await window.DL_DADOS.listarResumos(conta);
            if (rodada !== memoriaGeracao || epoca !== sessao || usuario() !== conta) return;
            resumosSalvos = dados; memoriaPronta = true; renderMemoria();
        } catch (_) {
            if (rodada !== memoriaGeracao || epoca !== sessao || usuario() !== conta) return;
            $("memoria-status").textContent = "Não foi possível carregar os resumos salvos. Tente novamente.";
            $("memoria-repetir").hidden = false;
        }
    }
    $("prog-busca").addEventListener("input", renderMemoria);
    $("memoria-repetir").addEventListener("click", carregarMemoria);
    window.DL_TEXTOS = { carregarMemoria };
    function confirmarExclusao(texto, origem) {
        if (uid !== UID || usuario() !== uid || exclusao?.emCurso) return;
        exclusao = { id: texto.id, titulo: texto.titulo, uid, sessao, emCurso: false };
        $("excluir-texto-titulo").textContent = texto.titulo || "Sem título";
        $("excluir-status").textContent = "";
        $("excluir-confirmar").disabled = $("excluir-cancelar").disabled = false;
        abrirDialogo(excluirDialogo, origem, $("excluir-cancelar"));
    }
    $("excluir-cancelar").addEventListener("click", () => {
        if (exclusao?.emCurso) return;
        fecharDialogo(excluirDialogo); exclusao = null;
    });
    $("excluir-confirmar").addEventListener("click", async () => {
        const pedido = exclusao;
        if (!pedido || pedido.emCurso || pedido.uid !== UID || usuario() !== pedido.uid) return;
        pedido.emCurso = true; geracao++;
        $("excluir-confirmar").disabled = $("excluir-cancelar").disabled = true;
        $("excluir-status").textContent = "Excluindo texto e resumo…";
        renderEscolha(); renderMemoria();
        try {
            await window.DL_DADOS.excluirTexto(pedido.id, pedido.uid);
            if (pedido.sessao !== sessao || usuario() !== pedido.uid) return;
            listaGeracao++; memoriaGeracao++; listaLendo = false;
            memorias.delete(JSON.stringify([pedido.uid, pedido.id]));
            textosListados = textosListados.filter(t => t.id !== pedido.id);
            resumosSalvos = resumosSalvos.filter(t => t.id !== pedido.id);
            if (novoId === pedido.id) { novoId = null; reabrirNovo.hidden = true; }
            if (ativo?.id === pedido.id && ativo.uid === pedido.uid) limparEstudo();
            pedido.emCurso = false; exclusao = null;
            opcoes(textosListados); renderMemoria();
            fecharDialogo(excluirDialogo);
            escolhaStatus.textContent = "Texto e resumo excluídos.";
            mensagem("");
            $("escolha-busca").focus();
            // Invalida uma leitura anterior da memória e consulta o estado confirmado.
            carregarMemoria();
        } catch (_) {
            if (pedido.sessao !== sessao || usuario() !== pedido.uid) return;
            pedido.emCurso = false;
            $("excluir-status").textContent = "Não foi possível confirmar a exclusão. Texto e rascunhos foram mantidos na tela. Atualize a lista antes de tentar novamente.";
            $("excluir-confirmar").disabled = $("excluir-cancelar").disabled = false;
            renderEscolha(); renderMemoria();
        }
    });
    function mensagem(texto, acao = null) {
        status.textContent = texto;
        tentar = acao;
        repetir.hidden = !acao;
    }
    repetir.addEventListener("click", () => { if (tentar) tentar(); });
    function opcoes(textos = []) {
        textosListados = textos;
        seletor.replaceChildren(new Option("Escolher texto", ""), new Option("Adicionar texto", "adicionar"));
        for (const texto of textos) seletor.add(new Option(texto.titulo || "Sem título", texto.id));
        if (ativo && !Array.from(seletor.options).some(o => o.value === ativo.id)) {
            seletor.add(new Option(ativo.titulo, ativo.id));
        }
        seletor.value = ativo?.id || "";
        renderEscolha();
    }
    async function listar() {
        if (uid !== UID || usuario() !== uid) return;
        const conta = uid, rodada = ++listaGeracao, epoca = sessao;
        listaLendo = true; listaErro = false; renderEscolha();
        seletor.disabled = true;
        mensagem("Carregando textos…");
        try {
            const textos = await window.DL_DADOS.listarTextos();
            if (rodada !== listaGeracao || epoca !== sessao || usuario() !== conta) return;
            opcoes(textos);
            mensagem(textos.length ? "" : "Nenhum texto salvo. Você pode adicionar o primeiro.");
        } catch (_) {
            if (rodada !== listaGeracao || epoca !== sessao || usuario() !== conta) return;
            listaErro = true;
            mensagem("Não foi possível carregar os textos. Confira a conexão e o acesso da conta.", listar);
        } finally {
            if (rodada === listaGeracao && epoca === sessao) {
                seletor.disabled = false; listaLendo = false; renderEscolha();
            }
        }
    }
    function limparSelecao() {
        selecionado = null;
        $("selecao-texto").textContent = "";
        $("selecao-aviso").textContent = "Selecione uma palavra ou trecho do original.";
        $("consultar-leo").disabled = true;
        window.getSelection()?.removeAllRanges();
        $("copia-manual").hidden = true;
        $("copia-conteudo").value = copiaStatus.textContent = "";
    }
    function limparEstudo() {
        ativo = null;
        titulo.textContent = original.textContent = compreensao.value = pergunta.value = resumo.value = resumoStatus.textContent = "";
        estudo.hidden = true;
        inicio.hidden = false;
        limparSelecao();
        window.speechSynthesis?.cancel();
    }
    function mostrarResumo(texto) {
        if (!atual(texto)) return;
        const m = memoria(texto);
        resumo.value = m.resumo;
        resumo.readOnly = !m.carregado || m.lendo || m.salvando;
        salvarResumo.disabled = !m.carregado || m.lendo || m.salvando;
        relerResumo.hidden = !m.erroLeitura;
        relerResumo.disabled = m.lendo;
        resumoStatus.textContent = m.mensagem;
        $("ultimo-resumo-salvo").hidden = !m.alterado || !m.salvo.trim();
        $("resumo-salvo-leitura").textContent = m.salvo;
    }
    async function carregarResumo(texto) {
        const m = memoria(texto), epoca = sessao;
        if ((m.lendo && m.sessaoLeitura === epoca) || m.salvando) return;
        if (m.alterado) { mostrarResumo(texto); return; }
        const pedido = {};
        m.pedidoLeitura = pedido; m.sessaoLeitura = epoca;
        m.lendo = true; m.mensagem = "Lendo resumo…"; m.erroLeitura = false;
        mostrarResumo(texto);
        try {
            const salvo = await window.DL_DADOS.carregarResumo(texto.id, texto.uid);
            if (epoca !== sessao || usuario() !== texto.uid) return;
            m.resumo = m.salvo = salvo; m.carregado = true;
            m.mensagem = "";
        } catch (_) {
            if (epoca !== sessao || usuario() !== texto.uid) return;
            m.carregado = false; m.erroLeitura = true;
            m.mensagem = "Não foi possível ler o resumo. Tente novamente antes de salvar.";
        } finally {
            if (m.pedidoLeitura === pedido) {
                m.lendo = false;
                if (epoca === sessao) mostrarResumo(texto);
            }
        }
    }
    async function abrirTexto(id) {
        if (uid !== UID || usuario() !== uid || exclusao?.emCurso) return false;
        const conta = uid, rodada = ++geracao, epoca = sessao;
        mensagem("Abrindo texto…");
        try {
            const texto = await window.DL_DADOS.carregarTexto(id);
            if (rodada !== geracao || epoca !== sessao || usuario() !== conta) return false;
            ativo = Object.freeze({ ...texto, uid: conta });
            titulo.textContent = ativo.titulo;
            original.textContent = ativo.conteudo;
            compreensao.value = memoria().compreensao;
            pergunta.value = memoria().pergunta;
            limparSelecao();
            window.speechSynthesis?.cancel();
            inicio.hidden = true; estudo.hidden = false;
            $("resumo-secao").open = false;
            if (!Array.from(seletor.options).some(o => o.value === id)) seletor.add(new Option(ativo.titulo, id));
            seletor.value = id;
            fecharAdicionar();
            fecharDialogo(escolha, false);
            fecharDialogo(confirmacao, false);
            mensagem("");
            mostrarResumo(ativo);
            carregarResumo(ativo);
            return true;
        } catch (_) {
            if (rodada !== geracao || epoca !== sessao || usuario() !== conta) return false;
            seletor.value = ativo?.id || "";
            mensagem("Não foi possível abrir o texto. Tente novamente.", () => abrirTexto(id));
            return false;
        }
    }
    seletor.addEventListener("change", () => {
        const id = seletor.value;
        if (id === "adicionar") { abrirAdicionar(); seletor.value = ativo?.id || ""; }
        else if (id) abrirTexto(id);
        else { geracao++; limparEstudo(); mensagem(""); }
    });
    compreensao.addEventListener("input", () => {
        if (ativo && usuario() === ativo.uid) memoria().compreensao = compreensao.value;
    });
    pergunta.addEventListener("input", () => {
        if (ativo && usuario() === ativo.uid) memoria().pergunta = pergunta.value;
        copiaStatus.textContent = ""; $("copia-manual").hidden = true;
    });
    resumo.addEventListener("input", () => {
        if (!ativo || usuario() !== ativo.uid) return;
        const m = memoria();
        m.resumo = resumo.value; m.alterado = true;
        m.mensagem = "Alterações ainda não salvas.";
        resumoStatus.textContent = m.mensagem;
    });
    relerResumo.addEventListener("click", () => { if (ativo) carregarResumo(ativo); });
    salvarResumo.addEventListener("click", async () => {
        if (!ativo || usuario() !== ativo.uid) return;
        const texto = ativo, m = memoria(texto), epoca = sessao;
        if (!m.carregado || m.lendo || m.salvando) return;
        if (!m.resumo.trim() || m.resumo.length > 30000) {
            m.mensagem = "Informe um resumo de até 30.000 caracteres.";
            mostrarResumo(texto); return;
        }
        m.salvando = true; m.mensagem = "Salvando resumo…"; mostrarResumo(texto);
        const conteudo = m.resumo;
        try {
            await window.DL_DADOS.salvarResumo(texto.id, texto.uid, conteudo);
            m.alterado = false;
            m.salvo = conteudo;
            m.mensagem = "Resumo salvo com sucesso.";
            if (epoca === sessao && usuario() === texto.uid) carregarMemoria();
        } catch (_) {
            m.mensagem = "Não foi possível salvar o resumo. O conteúdo foi mantido; tente novamente.";
        } finally {
            m.salvando = false;
            if (epoca === sessao) mostrarResumo(texto);
        }
    });
    function guardarFormulario() { novos.set(uid, { titulo: novoTitulo.value, conteudo: novoConteudo.value }); }
    function abrirAdicionar() {
        geracao++; // Uma leitura antiga não deve fechar um formulário recém-aberto.
        focoAnterior = document.activeElement;
        modal.classList.add("aberta"); document.body.style.overflow = "hidden";
        if (uid !== UID) novoStatus.textContent = "Entre com a conta Google autorizada para adicionar textos.";
        novoTitulo.focus();
    }
    function fecharAdicionar() {
        if (salvandoNovo) return;
        modal.classList.remove("aberta"); document.body.style.overflow = "";
        focoAnterior?.focus();
    }
    $("adicionar-inicial").addEventListener("click", abrirAdicionar);
    voltarNovo.addEventListener("click", fecharAdicionar);
    modal.addEventListener("click", ev => { if (ev.target === modal) fecharAdicionar(); });
    document.addEventListener("keydown", ev => {
        if (!modal.classList.contains("aberta")) return;
        if (ev.key === "Escape") { ev.preventDefault(); fecharAdicionar(); }
        if (ev.key === "Tab") {
            const f = Array.from(modal.querySelectorAll("button, input, textarea"))
                .filter(el => !el.disabled && !el.hidden);
            const primeiro = f[0], ultimo = f[f.length - 1];
            if (ev.shiftKey && document.activeElement === primeiro) { ev.preventDefault(); ultimo.focus(); }
            else if (!ev.shiftKey && document.activeElement === ultimo) { ev.preventDefault(); primeiro.focus(); }
        }
    });
    novoTitulo.addEventListener("input", guardarFormulario);
    novoConteudo.addEventListener("input", () => { novoConteudo.setCustomValidity(""); guardarFormulario(); });
    form.addEventListener("submit", async ev => {
        ev.preventDefault();
        if (salvandoNovo) return;
        if (uid !== UID || usuario() !== uid) { novoStatus.textContent = "Use a conta Google autorizada."; return; }
        novoConteudo.setCustomValidity(novoConteudo.value.trim() ? "" : "Informe o texto em alemão.");
        if (!form.reportValidity()) return;
        const conta = uid, epoca = sessao;
        salvandoNovo = true;
        salvarNovo.disabled = voltarNovo.disabled = true;
        novoTitulo.readOnly = novoConteudo.readOnly = true;
        reabrirNovo.hidden = true;
        novoStatus.textContent = "Salvando texto…";
        let id;
        try { id = await window.DL_DADOS.salvarTexto(novoConteudo.value, novoTitulo.value); }
        catch (_) { if (epoca === sessao) novoStatus.textContent = "Não foi possível salvar. Seu texto foi mantido; tente novamente."; }
        finally {
            salvandoNovo = false;
            salvarNovo.disabled = voltarNovo.disabled = false;
            novoTitulo.readOnly = novoConteudo.readOnly = false;
        }
        if (!id) return;
        novos.delete(conta);
        if (epoca !== sessao || usuario() !== conta) return;
        novoId = id; form.reset(); novoStatus.textContent = "Texto salvo com sucesso.";
        const aberto = await abrirTexto(id);
        if (epoca !== sessao) return;
        if (!aberto) {
            novoStatus.textContent = "O texto foi salvo, mas a abertura falhou. Tente abrir, sem reenviar. ID: " + id;
            reabrirNovo.hidden = false;
        }
        // Atualiza as opções sem repetir a gravação.
        listar();
    });
    reabrirNovo.addEventListener("click", () => { if (novoId) abrirTexto(novoId); });
    $("ouvir-texto").addEventListener("click", () => {
        if (!ativo || !("speechSynthesis" in window)) return;
        window.speechSynthesis.cancel();
        const fala = new SpeechSynthesisUtterance(ativo.conteudo);
        fala.lang = "de-DE";
        const voz = window.speechSynthesis.getVoices().find(v => v.lang.toLowerCase().startsWith("de"));
        if (voz) fala.voice = voz;
        window.speechSynthesis.speak(fala);
    });
    function capturarSelecao() {
        if (!ativo || usuario() !== ativo.uid) return;
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount || sel.isCollapsed) return;
        const r = sel.getRangeAt(0);
        if (!original.contains(r.startContainer) || !original.contains(r.endContainer)) return;
        const trecho = sel.toString().trim();
        if (!trecho) return;
        const antes = r.cloneRange(); antes.selectNodeContents(original); antes.setEnd(r.startContainer, r.startOffset);
        const inicio = antes.toString().length, fim = inicio + r.toString().length;
        const texto = ativo.conteudo;
        const prefixo = texto.slice(0, inicio);
        const esquerda = Math.max(prefixo.lastIndexOf("."), prefixo.lastIndexOf("!"), prefixo.lastIndexOf("?"), prefixo.lastIndexOf("\n")) + 1;
        const proximo = texto.slice(fim).search(/[.!?\n]/);
        const direita = proximo < 0 ? texto.length : fim + proximo + 1;
        selecionado = { trecho, contexto: texto.slice(esquerda, direita).trim() };
        $("selecao-texto").textContent = trecho;
        $("selecao-aviso").textContent = "Trecho selecionado:";
        $("consultar-leo").disabled = false;
        copiaStatus.textContent = ""; $("copia-manual").hidden = true;
    }
    document.addEventListener("selectionchange", capturarSelecao);
    original.addEventListener("mouseup", capturarSelecao);
    original.addEventListener("keyup", capturarSelecao);
    $("consultar-leo").addEventListener("click", () => {
        if (selecionado && ativo && usuario() === ativo.uid) {
            window.open("https://dict.leo.org/alem%C3%A3o-portugu%C3%AAs/" + encodeURIComponent(selecionado.trecho), "_blank", "noopener,noreferrer");
        }
    });
    async function copiar(texto) {
        const atualId = ativo && chave(ativo), epoca = sessao;
        fecharDialogo(confirmacao, false);
        try {
            if (!navigator.clipboard?.writeText) throw new Error("Cópia indisponível");
            await navigator.clipboard.writeText(texto);
            if (epoca !== sessao || !ativo || chave(ativo) !== atualId) return;
            confirmarCopia($("consultar-sda"));
        } catch (_) {
            if (epoca !== sessao || !ativo || chave(ativo) !== atualId) return;
            copiaStatus.textContent = "A cópia automática não foi possível. Copie manualmente abaixo.";
            $("copia-conteudo").value = texto; $("copia-manual").hidden = false;
            $("copia-conteudo").focus(); $("copia-conteudo").select();
        }
    }
    function confirmarCopia(origem) {
        $("copia-manual").hidden = true; copiaStatus.textContent = "";
        abrirDialogo(confirmacao, origem, $("consulta-entendi"));
    }
    $("copia-manual-copiar").addEventListener("click", () => {
        if (!ativo || usuario() !== ativo.uid || $("copia-manual").hidden) return;
        $("copia-conteudo").focus(); $("copia-conteudo").select();
        let efetiva = false;
        try { efetiva = document.execCommand("copy") === true; } catch (_) { /* Mantém a alternativa manual. */ }
        if (efetiva) confirmarCopia($("consultar-sda"));
        else copiaStatus.textContent = "Não foi possível confirmar a cópia. Selecione e copie manualmente o conteúdo abaixo.";
    });
    $("consultar-sda").addEventListener("click", () => {
        if (!ativo || usuario() !== ativo.uid) return;
        // A consulta usa o que está visível agora, sem depender do último evento input.
        const perguntaAtual = pergunta.value, compreensaoAtual = compreensao.value;
        const partes = ["Título: " + ativo.titulo];
        if (selecionado) partes.push("Trecho: " + selecionado.trecho,
            "Frase de contexto: " + selecionado.contexto);
        else partes.push("Original:\n" + ativo.conteudo);
        if (perguntaAtual.trim()) partes.push("Minha pergunta:\n" + perguntaAtual);
        if (compreensaoAtual.trim()) partes.push("Minha compreensão:\n" + compreensaoAtual);
        partes.push("SDA, ajude-me a estudar de forma contextual, considerando minha pergunta e minha compreensão quando presentes, sem substituir minha reflexão.",
            "Referência didática: S + V + (OI) + (OD) + [Te → Ka → Mo → Lo] + (Neg).",
            "Use a fórmula como ferramenta de consulta, não como regra rígida nem análise automática.");
        copiar(partes.join("\n\n"));
    });
    function autenticar() {
        const conta = usuario();
        if (conta !== uid) {
            guardarFormulario(); uid = conta; sessao++; geracao++; listaGeracao++;
            memoriaGeracao++; resumosSalvos = []; memoriaPronta = false;
            listaLendo = listaErro = false; exclusao = null;
            for (const dialogo of [confirmacao, excluirDialogo, escolha]) fecharDialogo(dialogo, false);
            $("excluir-texto-titulo").textContent = $("excluir-status").textContent = "";
            $("escolha-busca").value = $("prog-busca").value = "";
            $("memoria-status").textContent = ""; $("memoria-repetir").hidden = true; renderMemoria();
            limparEstudo(); opcoes(); novoId = null; reabrirNovo.hidden = true;
            novoStatus.textContent = "";
            const rascunho = novos.get(uid);
            novoTitulo.value = rascunho?.titulo || ""; novoConteudo.value = rascunho?.conteudo || "";
            novoConteudo.setCustomValidity("");
            if (uid === UID) listar();
            if ($("prog-overlay").classList.contains("aberta")) carregarMemoria();
        }
        if (!window.DL_AUTH?.pronta) { seletor.disabled = true; mensagem("Preparando acesso…"); }
        else if (uid !== UID) {
            seletor.disabled = true;
            mensagem(uid ? "Esta conta não tem acesso aos textos." : "Entre com Google para escolher ou adicionar textos.");
        }
    }
    window.addEventListener("dl-auth-alterado", autenticar);
    autenticar();
})();
