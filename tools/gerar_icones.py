"""Gera os ícones do PWA (192, 512, 180) a partir de assets/icone/DLeb.png."""
from pathlib import Path
from PIL import Image

RAIZ = Path(r"G:\Meu Drive\Deutschleben")
ORIGEM = RAIZ / "assets" / "icone" / "DLeb.png"
DESTINO = RAIZ / "webapp" / "icons"
DESTINO.mkdir(parents=True, exist_ok=True)

im = Image.open(ORIGEM).convert("RGBA")
print("original:", im.size)

for tamanho, nome in [(192, "icon-192.png"), (512, "icon-512.png"), (180, "icon-180.png")]:
    copia = im.resize((tamanho, tamanho), Image.LANCZOS)
    copia.save(DESTINO / nome)
    print("gerado:", nome, tamanho)
