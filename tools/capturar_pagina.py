"""Captura o HTML real gerado pela interface Python, sem subir o servidor.
Importa a função pagina() e renderiza o estado inicial (Caminhada 01)."""
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
APP = RAIZ / "app"
sys.path.insert(0, str(APP))

import interface_DL83_RESTAURADO as mod  # noqa: E402

html = mod.pagina(
    mensagem=None,
    erro=False,
    caminhada_numero=1,
)

saida = RAIZ / "_captura_home.html"
saida.write_text(html, encoding="utf-8")
print("bytes:", len(html.encode("utf-8")), "->", saida.name)
