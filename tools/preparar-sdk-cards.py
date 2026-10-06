"""Copia o SDK oficial fixado, mantendo licenças e usando imports locais."""
import urllib.request
from pathlib import Path

out = Path(__file__).resolve().parents[1] / 'webapp/cards/vendor'
out.mkdir(parents=True, exist_ok=True)
base = 'https://www.gstatic.com/firebasejs/10.12.0/'
for name in ['firebase-app.js', 'firebase-auth.js', 'firebase-firestore.js']:
    data = urllib.request.urlopen(base + name, timeout=30).read().decode('utf8')
    data = data.replace('\r\n', '\n').replace(base + 'firebase-app.js', './firebase-app.js')
    (out / name).write_text(data, encoding='utf8', newline='\n')
