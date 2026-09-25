"""Gera os ícones do PWA a partir da arte da Kombi (primeira versão),
recortando um quadrado central (cover) para não distorcer."""
from pathlib import Path
from PIL import Image

RAIZ = Path(r"G:\Meu Drive\Deutschleben")
ORIGEM = RAIZ / "CONGELAMENTO_2026-09-20_KOMBI" / "deutschleben-kombi.png"
DESTINO = RAIZ / "webapp" / "icons"
DESTINO.mkdir(parents=True, exist_ok=True)

im = Image.open(ORIGEM).convert("RGBA")
w, h = im.size
print("original:", (w, h))

lado = min(w, h)
esquerda = (w - lado) // 2
topo = (h - lado) // 2
quadrado = im.crop((esquerda, topo, esquerda + lado, topo + lado))
print("recorte quadrado:", quadrado.size)

# Salva uma prévia grande para conferência.
quadrado.resize((512, 512), Image.LANCZOS).save(DESTINO / "kombi-512-preview.png")

for tamanho, nome in [(192, "icon-192.png"), (512, "icon-512.png"), (180, "icon-180.png")]:
    quadrado.resize((tamanho, tamanho), Image.LANCZOS).save(DESTINO / nome)
    print("gerado:", nome)

# Favicon (aba do navegador) a partir do mesmo recorte.
favicon = quadrado.resize((48, 48), Image.LANCZOS)
favicon.save(DESTINO / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
print("gerado: favicon.ico")
