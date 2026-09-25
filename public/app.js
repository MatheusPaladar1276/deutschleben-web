"use strict";

const ABAS = {
  substantivos: { arquivo: "./data/substantivos.json", render: cardSubstantivo },
  verbos: { arquivo: "./data/verbos.json", render: cardVerbo },
  adjetivos_adverbios: { arquivo: "./data/adjetivos_adverbios.json", render: cardAdjAdv },
  blocos: { arquivo: "./data/blocos.json", render: cardBloco },
};

const cache = {};
let abaAtual = "substantivos";

const el = {
  conteudo: document.getElementById("conteudo"),
  busca: document.getElementById("busca"),
  contador: document.getElementById("contador"),
  resumo: document.getElementById("resumo"),
  gerado: document.getElementById("gerado"),
  abas: document.getElementById("abas"),
};

function escapar(t) {
  return String(t ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function realcar(texto, termo) {
  const t = escapar(texto);
  if (!termo) return t;
  const re = new RegExp(`(${termo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  return t.replace(re, "<mark>$1</mark>");
}

function classeArtigo(artigo) {
  const a = (artigo || "").trim().toLowerCase();
  if (a === "der" || a === "die" || a === "das") return a;
  return "neutro";
}

function cardSubstantivo(item, termo) {
  const artigo = item.artigo ? `<span class="artigo ${classeArtigo(item.artigo)}">${escapar(item.artigo)}</span>` : "";
  return `<article class="card">
    <p class="palavra">${artigo}<span>${realcar(item.palavra, termo)}</span></p>
    <p class="significado">${realcar(item.significado, termo)}</p>
    ${item.plural ? `<p class="meta">Plural: <strong>${escapar(item.plural)}</strong></p>` : ""}
  </article>`;
}

function cardVerbo(item, termo) {
  const partes = [];
  if (item.regencia) partes.push(`Regência: ${escapar(item.regencia)}`);
  if (item.praeteritum) partes.push(`Prät.: ${escapar(item.praeteritum)}`);
  if (item.partizip_ii) partes.push(`Part. II: ${escapar(item.partizip_ii)}`);
  if (item.perfekt) partes.push(`Perfekt: ${escapar(item.perfekt)}`);
  return `<article class="card">
    <p class="palavra"><span>${realcar(item.verbo, termo)}</span></p>
    <p class="significado">${realcar(item.significado, termo)}</p>
    ${partes.length ? `<p class="meta">${partes.join(" · ")}</p>` : ""}
  </article>`;
}

function cardAdjAdv(item, termo) {
  return `<article class="card">
    <p class="palavra"><span>${realcar(item.palavra, termo)}</span>
      ${item.categoria ? `<span class="artigo neutro">${escapar(item.categoria)}</span>` : ""}</p>
    <p class="significado">${realcar(item.significado, termo)}</p>
  </article>`;
}

function cardBloco(item, termo) {
  return `<article class="card">
    <p class="palavra"><span>${realcar(item.bloco, termo)}</span>
      ${item.tipo ? `<span class="artigo neutro">${escapar(item.tipo)}</span>` : ""}</p>
    <p class="significado">${realcar(item.sentido, termo)}</p>
  </article>`;
}

function textoBusca(item) {
  return Object.values(item).filter((v) => typeof v === "string").join(" ").toLowerCase();
}

async function carregarAba(nome) {
  if (!cache[nome]) {
    el.conteudo.innerHTML = `<p class="carregando">Carregando…</p>`;
    try {
      const resp = await fetch(ABAS[nome].arquivo);
      if (!resp.ok) throw new Error(resp.status);
      cache[nome] = await resp.json();
    } catch (e) {
      el.conteudo.innerHTML = `<p class="vazio">Não foi possível carregar os dados (${escapar(e.message)}).</p>`;
      return;
    }
  }
  renderizar();
}

function renderizar() {
  const dados = cache[abaAtual] || [];
  const termo = el.busca.value.trim().toLowerCase();
  const filtrados = termo ? dados.filter((it) => textoBusca(it).includes(termo)) : dados;
  const render = ABAS[abaAtual].render;

  el.contador.textContent = `${filtrados.length} de ${dados.length}`;
  el.conteudo.innerHTML = filtrados.length
    ? filtrados.map((it) => render(it, el.busca.value.trim())).join("")
    : `<p class="vazio">Nenhum resultado para “${escapar(el.busca.value)}”.</p>`;
}

el.abas.addEventListener("click", (ev) => {
  const btn = ev.target.closest(".aba");
  if (!btn) return;
  document.querySelectorAll(".aba").forEach((b) => b.classList.remove("ativa"));
  btn.classList.add("ativa");
  abaAtual = btn.dataset.alvo;
  carregarAba(abaAtual);
});

el.busca.addEventListener("input", renderizar);

async function iniciar() {
  try {
    const resp = await fetch("./data/manifesto.json");
    if (resp.ok) {
      const m = await resp.json();
      const total = Object.values(m.contagens).reduce((a, b) => a + b, 0);
      el.resumo.textContent = `${total} itens · ${m.contagens.substantivos} substantivos, ${m.contagens.verbos} verbos, ${m.contagens.adjetivos_adverbios} adj./adv., ${m.contagens.blocos} blocos`;
      el.gerado.textContent = `Dados gerados em ${new Date(m.gerado_em).toLocaleString("pt-BR")}`;
    }
  } catch { /* manifesto opcional */ }
  carregarAba(abaAtual);
}

iniciar();
