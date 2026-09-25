"""Gera a versão web (HTML/CSS/JS) na pasta webapp/, reaproveitando o HTML real
que a interface Python produz. Captura todas as Caminhadas e monta os dados."""
import sys
import re
import json
from pathlib import Path

RAIZ = Path(r"G:\Meu Drive\Deutschleben")
sys.path.insert(0, str(RAIZ / "app"))

import interface_DL83_RESTAURADO as core  # noqa: E402

WEB = RAIZ / "webapp"
(WEB / "data").mkdir(parents=True, exist_ok=True)

TOTAL_CAMINHADAS = 20


def extrair(html):
    m_titulo = re.search(r"<h1>\s*(.*?)\s*</h1>", html, re.S)
    titulo = m_titulo.group(1).strip() if m_titulo else ""
    m_texto = re.search(
        r'(<div class="texto"[^>]*id="texto-caminhada"[^>]*>.*?</div>)',
        html,
        re.S,
    )
    texto = m_texto.group(1) if m_texto else ""
    return titulo, texto


def main():
    caminhadas = []
    base_html = None
    for numero in range(1, TOTAL_CAMINHADAS + 1):
        html = core.pagina(caminhada_numero=numero)
        if numero == 1:
            base_html = html
        titulo, texto = extrair(html)
        caminhadas.append(
            {"numero": numero, "titulo": titulo, "texto_html": texto}
        )
        print(f"Caminhada {numero:>2}: {titulo!r} (texto {len(texto)} bytes)")

    (WEB / "data" / "caminhadas.json").write_text(
        json.dumps(caminhadas, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (WEB / "_base.html").write_text(base_html, encoding="utf-8")
    print(f"\nOK: {len(caminhadas)} caminhadas | _base.html {len(base_html)} bytes")


if __name__ == "__main__":
    main()
