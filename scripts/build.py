#!/usr/bin/env python3
"""Regenerate CATALOG.json, index.html and templates/page.html from components/.

The header comment of every component file is the single source of truth:

    <!--
      component: kpi-ratio
      category: kpi
      title_ru: ...
      use_for: ...
      data_slots: a, b, c
      source: 21st.dev #123 «Name», автор someone
      license: ...
    -->

Usage:
    python3 scripts/build.py            # rewrite all generated files
    python3 scripts/build.py --catalog  # only CATALOG.json
"""
from __future__ import annotations

import argparse
import base64
import html
import json
import logging
import re
from dataclasses import dataclass, asdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOG = logging.getLogger("build")

CATEGORIES: dict[str, tuple[str, str]] = {
    "kpi": ("KPI и метрики", "Крупные цифры, соотношения, кольца и сводные полосы."),
    "data": ("Графики и данные", "Столбики, линии, кольца, воронки, тепловые карты."),
    "table": ("Таблицы", "Сравнения, рейтинги, спецификации; на телефоне строки становятся карточками."),
    "diagram": ("Схемы и процессы", "Шаги, таймлайны, хабы, дорожные карты."),
    "slide": ("Слайды и блоки", "Заголовки разделов, цитаты, сравнения, призывы, FAQ."),
    "landing": ("Секции лендинга", "Hero, бенто, карточки, баннеры, списки."),
}

HEADER_KEYS = ("component", "category", "title_ru", "use_for", "data_slots", "source", "license")


@dataclass
class Entry:
    """One catalog record (matches CATALOG.json)."""

    id: str
    category: str
    file: str
    title_ru: str
    use_for: str
    data_slots: list[str]
    source: str
    license: str


def parse_header(path: Path) -> dict[str, str]:
    """Parse the leading comment of a component file into a dict.

    Args:
        path: component file.

    Returns:
        Mapping of header keys to values.

    Raises:
        ValueError: if the header or a required key is missing.
    """
    text = path.read_text(encoding="utf-8")
    m = re.match(r"\s*<!--(.*?)-->", text, re.S)
    if not m:
        raise ValueError(f"{path}: no header comment")
    out: dict[str, str] = {}
    for line in m.group(1).splitlines():
        km = re.match(r"\s*([a-z_ ]+?):\s*(.*)$", line)
        if km:
            out[km.group(1).strip()] = html.unescape(km.group(2).strip())
    for key in HEADER_KEYS:
        if not out.get(key):
            raise ValueError(f"{path}: header key '{key}' is missing or empty")
    return out


def load_entries() -> list[Entry]:
    """Read all component files and return catalog entries in category order."""
    entries: list[Entry] = []
    for cat in CATEGORIES:
        for path in sorted((ROOT / "components" / cat).glob("*.html")):
            h = parse_header(path)
            slots = [s.strip() for s in h["data_slots"].split(",") if s.strip()]
            entries.append(Entry(
                id=h["component"], category=h["category"], file=path.relative_to(ROOT).as_posix(),
                title_ru=h["title_ru"], use_for=h["use_for"], data_slots=slots,
                source=h["source"], license=h["license"],
            ))
    return entries


def write_catalog(entries: list[Entry]) -> None:
    """Write CATALOG.json."""
    data = {
        "name": "html-components",
        "categories": {k: {"title_ru": v[0], "about": v[1]} for k, v in CATEGORIES.items()},
        "count": len(entries),
        "components": [asdict(e) for e in entries],
    }
    (ROOT / "CATALOG.json").write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    LOG.info("CATALOG.json: %d components", len(entries))


def inline_fonts_css() -> str:
    """Return fonts.css with every woff2 inlined as a base64 data URI."""
    css = (ROOT / "fonts" / "fonts.css").read_text(encoding="utf-8")

    def repl(m: re.Match[str]) -> str:
        data = base64.b64encode((ROOT / "fonts" / m.group(1)).read_bytes()).decode("ascii")
        return f"url(data:font/woff2;base64,{data})"

    return re.sub(r"url\(([^)]+\.woff2)\)", repl, css)


def component_body(entry: Entry) -> str:
    """Return the component file without its header comment (style + markup)."""
    text = (ROOT / entry.file).read_text(encoding="utf-8")
    return re.sub(r"^\s*<!--.*?-->\s*", "", text, count=1, flags=re.S)


INDEX_CSS = """
.g-top{max-width:1180px;margin:0 auto;padding:28px 20px 0}
.g-top h1{font-size:clamp(30px,6vw,56px);font-weight:800;letter-spacing:-.035em;line-height:1.04;margin:10px 0 12px}
.g-top p{max-width:720px;color:var(--soft);font-size:17px;line-height:1.5;margin:0 0 14px}
.g-nav{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0 6px}
.g-nav a{font:600 12px var(--mono);letter-spacing:.04em;text-transform:uppercase;color:var(--ink);text-decoration:none;border:1px solid var(--ink);border-radius:999px;padding:8px 14px;background:var(--paper)}
.g-nav a b{background:var(--lime);border-radius:999px;padding:2px 7px;margin-left:6px;font-weight:700}
.g-sec{max-width:1180px;margin:0 auto;padding:48px 20px 0}
.g-sec>h2{font-size:clamp(24px,4vw,36px);font-weight:800;letter-spacing:-.03em;margin:0 0 6px}
.g-sec>p{color:var(--soft);margin:0 0 22px}
.g-list{display:flex;flex-direction:column;gap:34px}
.g-item{min-width:0}
.g-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 14px;margin-bottom:12px}
.g-head .id{font:600 12px var(--mono);background:var(--ink);color:var(--lime);padding:5px 12px;border-radius:999px;overflow-wrap:anywhere}
.g-head .nm{font-size:20px;font-weight:700;letter-spacing:-.02em}
.g-use{color:var(--soft);font-size:15px;line-height:1.45;margin:0 0 6px;max-width:860px}
.g-meta{font:500 12px/1.5 var(--mono);color:var(--muted);margin:0 0 14px;overflow-wrap:anywhere}
.g-meta code{background:var(--sand);padding:2px 6px;border-radius:6px;color:var(--ink)}
.g-meta button{font:600 11px var(--mono);border:1px solid var(--ink);background:var(--paper);border-radius:999px;padding:3px 10px;margin-left:6px;cursor:pointer}
.g-demo{background:var(--bg);border:1px dashed var(--line);border-radius:22px;padding:clamp(10px,2.5vw,24px);min-width:0}
.g-foot{max-width:1180px;margin:0 auto;padding:56px 20px 64px;color:var(--muted);font:500 12px/1.6 var(--mono)}
"""


def write_index(entries: list[Entry]) -> None:
    """Write the one-file gallery index.html (fonts, tokens and all components inlined)."""
    tokens = (ROOT / "tokens.css").read_text(encoding="utf-8")
    nav = "".join(
        f'<a href="#cat-{k}">{html.escape(v[0])}<b>{sum(1 for e in entries if e.category == k)}</b></a>'
        for k, v in CATEGORIES.items()
    )
    sections = []
    for k, (title, about) in CATEGORIES.items():
        items = []
        for e in [x for x in entries if x.category == k]:
            items.append(
                f'<article class="g-item" id="{e.id}"><div class="g-head"><span class="id">{e.id}</span>'
                f'<span class="nm">{html.escape(e.title_ru)}</span></div>'
                f'<p class="g-use">{html.escape(e.use_for)}</p>'
                f'<p class="g-meta">Файл: <code>{e.file}</code><button type="button" data-copy="{e.file}">копировать путь</button><br>'
                f'Заменить: {html.escape(", ".join(e.data_slots))}<br>Источник: {html.escape(e.source)}</p>'
                f'<div class="g-demo">{component_body(e)}</div></article>'
            )
        sections.append(
            f'<section class="g-sec" id="cat-{k}"><h2>{html.escape(title)}</h2><p>{html.escape(about)}</p>'
            f'<div class="g-list">{"".join(items)}</div></section>'
        )
    page = f"""<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>html-components – библиотека готовых HTML-компонентов</title>
<style>{inline_fonts_css()}</style>
<style>{tokens}</style>
<style>{INDEX_CSS}</style>
</head><body>
<header class="g-top">
<span class="eyebrow mono" style="font:600 11px var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--muted)">html-components · {len(entries)} компонентов</span>
<h1>Выбери компонент – скопируй файл – замени данные</h1>
<p>Каждый компонент – самодостаточный фрагмент HTML со стилями под уникальным префиксом hc-. Копируйте файл из components/ целиком и меняйте только данные. Машинный каталог – CATALOG.json.</p>
<nav class="g-nav" aria-label="Категории">{nav}</nav>
</header>
{"".join(sections)}
<footer class="g-foot">Данные во всех компонентах – демонстрационные. Раскладки вдохновлены компонентами 21st.dev, список – в LICENSE. Файл собран скриптом scripts/build.py.</footer>
<script>
document.addEventListener('click',function(e){{var b=e.target.closest('[data-copy]');if(!b)return;
var t=b.getAttribute('data-copy');if(navigator.clipboard){{navigator.clipboard.writeText(t);}}b.textContent='скопировано';
setTimeout(function(){{b.textContent='копировать путь';}},1500);}});
</script>
</body></html>
"""
    (ROOT / "index.html").write_text(page, encoding="utf-8")
    LOG.info("index.html: %d KB", len(page) // 1024)


TEMPLATE_PICK = ("kpi-stat-trio", "data-bar-horizontal", "slide-quote")


def write_template(entries: list[Entry]) -> None:
    """Write templates/page.html: skeleton + three pasted components."""
    by_id = {e.id: e for e in entries}
    blocks = []
    for cid in TEMPLATE_PICK:
        e = by_id[cid]
        blocks.append(f"<!-- ===== component: {e.id} (file: {e.file}) ===== -->\n{component_body(e).strip()}\n")
    page = f"""<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Заголовок страницы</title>
<!-- 1. tokens and fonts: paths are relative to templates/; adjust when you move the file -->
<link rel="stylesheet" href="../fonts/fonts.css">
<link rel="stylesheet" href="../tokens.css">
<style>
  /* page layout only; component styles live inside each pasted block */
  .page{{max-width:1100px;margin:0 auto;padding:32px 20px 64px;display:flex;flex-direction:column;gap:32px}}
  .page h1{{font-size:clamp(28px,5vw,48px);font-weight:800;letter-spacing:-.03em;line-height:1.05;margin:0}}
</style>
</head>
<body>
<main class="page">
  <h1>Заголовок страницы</h1>

  <!-- 2. paste components here: one idea per block; replace the demo data -->
{chr(10).join(blocks)}
</main>
</body>
</html>
"""
    out = ROOT / "templates"
    out.mkdir(exist_ok=True)
    (out / "page.html").write_text(page, encoding="utf-8")
    LOG.info("templates/page.html written")


def replace_marked(path: Path, name: str, body: str) -> None:
    """Replace the text between <!-- NAME:START --> and <!-- NAME:END --> in a file."""
    text = path.read_text(encoding="utf-8")
    start, end = f"<!-- {name}:START -->", f"<!-- {name}:END -->"
    i, j = text.index(start) + len(start), text.index(end)
    path.write_text(text[:i] + "\n" + body.strip("\n") + "\n" + text[j:], encoding="utf-8")


def write_lists(entries: list[Entry]) -> None:
    """Fill the component list in README.md and the 21st.dev list in LICENSE."""
    parts = []
    for k, (title, _) in CATEGORIES.items():
        items = [e for e in entries if e.category == k]
        parts.append(f"### {title} ({len(items)})\n")
        parts += [f"- `{e.file}` – {e.title_ru}. {e.use_for}" for e in items]
        parts.append("")
    replace_marked(ROOT / "README.md", "LIST", "\n".join(parts))
    notice = "\n".join(f"   - {e.id}: {e.source}" for e in entries)
    replace_marked(ROOT / "LICENSE", "NOTICE", notice)
    LOG.info("README.md and LICENSE lists updated")


def main() -> int:
    """CLI entry point."""
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--catalog", action="store_true", help="only rewrite CATALOG.json")
    args = ap.parse_args()
    entries = load_entries()
    write_catalog(entries)
    if not args.catalog:
        write_index(entries)
        write_template(entries)
        write_lists(entries)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
