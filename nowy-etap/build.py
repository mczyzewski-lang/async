"""Buduje stronę główną repozytorium (../index.html) z prototypu nowy-etap/index.html.

Prototyp jest fragmentem HTML (bez <html>/<head>/<body>), bo w tej postaci jest publikowany.
Ten skrypt opakowuje go w pełny dokument. Uruchom po każdej zmianie prototypu:

    python3 nowy-etap/build.py
"""
import pathlib, re

here = pathlib.Path(__file__).resolve().parent
src = (here / "index.html").read_text(encoding="utf-8")
src = re.sub(r"<title>.*?</title>\s*", "", src, count=1, flags=re.S)

doc = f"""<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<title>Nowy Etap: rozwód bez walki w sądzie</title>
</head>
<body>
<!-- Plik generowany przez nowy-etap/build.py. Zmiany wprowadzaj w nowy-etap/index.html. -->
{src}
</body>
</html>
"""
(here.parent / "index.html").write_text(doc, encoding="utf-8")
print("zapisano", here.parent / "index.html", len(doc), "znaków")
