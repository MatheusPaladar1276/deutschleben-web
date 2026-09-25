"""Exporta o vocabulário do deutschleben.db para JSON consumido pelo site estático."""
import sqlite3
import json
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
BANCO = RAIZ / "dados" / "deutschleben.db"
SAIDA = RAIZ / "public" / "data"
SAIDA.mkdir(parents=True, exist_ok=True)


def conectar():
    con = sqlite3.connect(BANCO)
    con.row_factory = sqlite3.Row
    return con


def exportar(nome, consulta, con):
    linhas = [dict(r) for r in con.execute(consulta).fetchall()]
    caminho = SAIDA / f"{nome}.json"
    caminho.write_text(
        json.dumps(linhas, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"{nome}: {len(linhas)} registros -> {caminho.name}")
    return len(linhas)


def main():
    con = conectar()
    resumo = {}
    resumo["substantivos"] = exportar(
        "substantivos",
        """SELECT palavra, artigo, plural, significado, origem
             FROM palavras
            WHERE TRIM(COALESCE(palavra,'')) <> ''
            ORDER BY palavra COLLATE NOCASE""",
        con,
    )
    resumo["verbos"] = exportar(
        "verbos",
        """SELECT verbo, significado, regencia, partizip_ii, perfekt, praeteritum, origem
             FROM verbos
            WHERE TRIM(COALESCE(verbo,'')) <> ''
            ORDER BY verbo COLLATE NOCASE""",
        con,
    )
    resumo["adjetivos_adverbios"] = exportar(
        "adjetivos_adverbios",
        """SELECT palavra, significado, categoria, origem
             FROM adjetivos_adverbios
            WHERE TRIM(COALESCE(palavra,'')) <> ''
            ORDER BY palavra COLLATE NOCASE""",
        con,
    )
    resumo["blocos"] = exportar(
        "blocos",
        """SELECT bloco, sentido, tipo, origem
             FROM blocos
            WHERE TRIM(COALESCE(bloco,'')) <> ''
            ORDER BY bloco COLLATE NOCASE""",
        con,
    )
    con.close()

    manifesto = {
        "gerado_em": __import__("datetime").datetime.now().isoformat(timespec="seconds"),
        "contagens": resumo,
    }
    (SAIDA / "manifesto.json").write_text(
        json.dumps(manifesto, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print("manifesto.json gravado:", manifesto)


if __name__ == "__main__":
    main()
