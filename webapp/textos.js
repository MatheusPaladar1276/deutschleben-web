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
    const memorias = new Map(), novos = new Map();
    let uid = null, ativo = null, selecionado = null, geracao = 0, listaGeracao = 0;
    let sessao = 0, salvandoNovo = false, novoId = null, focoAnterior = null, tentar = null;
    function usuario() { return window.DL_AUTH?.usuario?.uid || null; }
    function chave(texto) { return JSON.stringify([texto.uid, texto.id]); }
    function memoria(texto = ativo) {
        const k = chave(texto);
        if (!memorias.has(k)) memorias.set(k, { compreensao: "", resumo: "", carregado: false,
            alterado: false, lendo: false, salvando: false, mensagem: "", erroLeitura: false });
        return memorias.get(k);
    }
    function atual(texto) { return ativo && usuario() === texto.uid && chave(ativo) === chave(texto); }
    function mensagem(texto, acao = null) {
        status.textContent = texto;
        tentar = acao;
        repetir.hidden = !acao;
    }
    repetir.addEventListener("click", () => { if (tentar) tentar(); });
    function opcoes(textos = []) {
        seletor.replaceChildren(new Option("Escolher texto", ""), new Option("Adicionar texto", "adicionar"));
        for (const texto of textos) seletor.add(new Option(texto.titulo || "Sem título", texto.id));
        if (ativo && !Array.from(seletor.options).some(o => o.value === ativo.id)) {
            seletor.add(new Option(ativo.titulo, ativo.id));
        }
        seletor.value = ativo?.id || "";
    }
    async function listar() {
        if (uid !== UID || usuario() !== uid) return;
        const conta = uid, rodada = ++listaGeracao, epoca = sessao;
        seletor.disabled = true;
        mensagem("Carregando textos…");
        try {
            const textos = await window.DL_DADOS.listarTextos();
            if (rodada !== listaGeracao || epoca !== sessao || usuario() !== conta) return;
            opcoes(textos);
            mensagem(textos.length ? "" : "Nenhum texto salvo. Você pode adicionar o primeiro.");
        } catch (_) {
            if (rodada !== listaGeracao || epoca !== sessao || usuario() !== conta) return;
            mensagem("Não foi possível carregar os textos. Confira a conexão e o acesso da conta.", listar);
        } finally {
            if (rodada === listaGeracao && epoca === sessao) seletor.disabled = false;
        }
    }
    function limparSelecao() {
        selecionado = null;
        $("selecao-texto").textContent = "";
        $("selecao-aviso").textContent = "Selecione uma palavra ou trecho do original.";
        $("consultar-leo").disabled = $("copiar-duvida").disabled = true;
        $("copia-manual").hidden = true;
        $("copia-conteudo").value = copiaStatus.textContent = "";
    }
    function limparEstudo() {
        ativo = null;
        titulo.textContent = original.textContent = compreensao.value = resumo.value = resumoStatus.textContent = "";
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
            m.resumo = salvo; m.carregado = true;
            m.mensagem = salvo ? "Resumo salvo retomado." : "Cole o resumo do chat. Ele só será salvo ao clicar em Salvar resumo.";
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
        if (uid !== UID || usuario() !== uid) return false;
        const conta = uid, rodada = ++geracao, epoca = sessao;
        mensagem("Abrindo texto…");
        try {
            const texto = await window.DL_DADOS.carregarTexto(id);
            if (rodada !== geracao || epoca !== sessao || usuario() !== conta) return false;
            ativo = Object.freeze({ ...texto, uid: conta });
            titulo.textContent = ativo.titulo;
            original.textContent = ativo.conteudo;
            compreensao.value = memoria().compreensao;
            limparSelecao();
            window.speechSynthesis?.cancel();
            inicio.hidden = true; estudo.hidden = false;
            $("resumo-secao").open = false;
            if (!Array.from(seletor.options).some(o => o.value === id)) seletor.add(new Option(ativo.titulo, id));
            seletor.value = id;
            fecharAdicionar();
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
        try {
            await window.DL_DADOS.salvarResumo(texto.id, texto.uid, m.resumo);
            m.alterado = false;
            m.mensagem = "Resumo salvo com sucesso.";
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
        $("consultar-leo").disabled = $("copiar-duvida").disabled = false;
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
        try {
            if (!navigator.clipboard?.writeText) throw new Error("Cópia indisponível");
            await navigator.clipboard.writeText(texto);
            if (epoca !== sessao || !ativo || chave(ativo) !== atualId) return;
            $("copia-manual").hidden = true; copiaStatus.textContent = "Copiado. Cole no chat para estudar.";
        } catch (_) {
            if (epoca !== sessao || !ativo || chave(ativo) !== atualId) return;
            copiaStatus.textContent = "A cópia automática não foi possível. Copie manualmente abaixo.";
            $("copia-conteudo").value = texto; $("copia-manual").hidden = false;
            $("copia-conteudo").focus(); $("copia-conteudo").select();
        }
    }
    $("copiar-duvida").addEventListener("click", () => {
        if (!ativo || !selecionado || usuario() !== ativo.uid) return;
        copiar("Título: " + ativo.titulo + "\n\nTrecho: " + selecionado.trecho +
            "\n\nFrase de contexto: " + selecionado.contexto +
            "\n\nSDA, ajude-me a compreender este trecho no contexto, sem substituir minha reflexão.");
    });
    $("copiar-estudo").addEventListener("click", () => {
        if (!ativo || usuario() !== ativo.uid) return;
        copiar("Título: " + ativo.titulo + "\n\nOriginal:\n" + ativo.conteudo +
            "\n\nMinha compreensão:\n" + memoria().compreensao +
            "\n\nAjude-me a estudar este texto de forma contextual, partindo da minha compreensão." +
            "\nReferência didática: S + V + (OI) + (OD) + [Te → Ka → Mo → Lo] + (Neg)." +
            "\nUse a fórmula como ferramenta de consulta, não como regra rígida nem análise automática.");
    });
    function autenticar() {
        const conta = usuario();
        if (conta !== uid) {
            guardarFormulario(); uid = conta; sessao++; geracao++; listaGeracao++;
            limparEstudo(); opcoes(); novoId = null; reabrirNovo.hidden = true;
            novoStatus.textContent = "";
            const rascunho = novos.get(uid);
            novoTitulo.value = rascunho?.titulo || ""; novoConteudo.value = rascunho?.conteudo || "";
            novoConteudo.setCustomValidity("");
            if (uid === UID) listar();
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
