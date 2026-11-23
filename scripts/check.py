#!/usr/bin/env python3
"""Repository checks for html-components (called by scripts/check.sh).

Checks:
  1. every components/<cat>/<name>.html is listed in CATALOG.json and vice versa (ids unique, id == <cat>-<name>);
  2. no relative link (href, src, url()) points to a missing file; index.html has no relative links at all;
  3. no PLACEHOLDER text and no «<<» in published files;
  4. no emoji anywhere in text files;
  5. each component contains its own class prefix hc-<id>; no external URLs except example.com and the SVG namespace.
"""
from __future__ import annotations

import json
import logging
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOG = logging.getLogger("check")

EMOJI = re.compile("[\U0001F000-\U0001FAFF☀-➿️‍⭐⬆↔-↪]")
LINK = re.compile(r"""(?:href|src)\s*=\s*["']([^"']+)["']|url\(\s*["']?([^)"']+)["']?\s*\)""", re.I)
URL = re.compile(r"https?://[^\s\"'<>)]+")
ALLOWED_URL = re.compile(r"^https?://(www\.w3\.org/|example\.com)")
TEXT_SUFFIX = {".html", ".css", ".md", ".json", ".py", ".sh"}


def text_files() -> list[Path]:
    """All text files of the repo outside .git."""
    return [p for p in ROOT.rglob("*") if p.is_file() and ".git" not in p.parts and p.suffix in TEXT_SUFFIX
            or p.name == "LICENSE"]


def check_catalog(errors: list[str]) -> int:
    """Compare CATALOG.json with the files on disk. Returns the component count."""
    data = json.loads((ROOT / "CATALOG.json").read_text(encoding="utf-8"))
    comps = data["components"]
    listed = {c["file"] for c in comps}
    on_disk = {p.relative_to(ROOT).as_posix() for p in (ROOT / "components").glob("*/*.html")}
    for f in sorted(on_disk - listed):
        errors.append(f"component file not in CATALOG.json: {f}")
    for f in sorted(listed - on_disk):
        errors.append(f"CATALOG.json entry without file: {f}")
    ids = [c["id"] for c in comps]
    if len(ids) != len(set(ids)):
        errors.append("duplicate ids in CATALOG.json")
    for c in comps:
        p = Path(c["file"])
        if c["id"] != f"{p.parent.name}-{p.stem}":
            errors.append(f"id/file mismatch: {c['id']} vs {c['file']}")
        if not c["data_slots"] or not c["use_for"]:
            errors.append(f"empty data_slots/use_for: {c['id']}")
        body = (ROOT / c["file"]).read_text(encoding="utf-8") if (ROOT / c["file"]).exists() else ""
        if f"hc-{c['id']}" not in body:
            errors.append(f"class prefix hc-{c['id']} not found in {c['file']}")
    if data.get("count") != len(comps):
        errors.append("CATALOG.json count mismatch")
    return len(comps)


def check_links(errors: list[str]) -> None:
    """Relative links must resolve; index.html must be self-contained."""
    for p in ROOT.rglob("*"):
        if not p.is_file() or ".git" in p.parts or p.suffix not in {".html", ".css"}:
            continue
        text = p.read_text(encoding="utf-8")
        for m in LINK.finditer(text):
            ref = (m.group(1) or m.group(2)).strip()
            if re.match(r"^(https?:|data:|mailto:|tel:|#|//)", ref):
                continue
            rel = p.relative_to(ROOT).as_posix()
            if p.name == "index.html" and p.parent == ROOT:
                errors.append(f"{rel}: relative link in self-contained index: {ref[:60]}")
                continue
            target = (p.parent / ref.split("#")[0].split("?")[0]).resolve()
            if not target.exists():
                errors.append(f"{rel}: link to missing file: {ref[:60]}")


def check_content(errors: list[str]) -> None:
    """PLACEHOLDER, emoji, external URLs."""
    published = [p for p in ROOT.rglob("*") if p.is_file() and ".git" not in p.parts
                 and (p.parts[len(ROOT.parts)] in {"components", "templates"}
                      or p.name in {"index.html", "CATALOG.json", "tokens.css", "README.md"})]
    for p in published:
        t = p.read_text(encoding="utf-8")
        rel = p.relative_to(ROOT).as_posix()
        if re.search(r"placeholder", t, re.I) or "<<" in t or "&lt;&lt;" in t:
            errors.append(f"{rel}: PLACEHOLDER or <<...>> text")
        if p.parts[len(ROOT.parts)] in {"components", "templates"} or p.name == "index.html":
            for u in URL.findall(t):
                if not ALLOWED_URL.match(u):
                    errors.append(f"{rel}: external URL {u[:60]}")
    for p in text_files():
        if p.name == "check.py":
            continue  # holds the emoji pattern itself
        m = EMOJI.search(p.read_text(encoding="utf-8"))
        if m:
            errors.append(f"{p.relative_to(ROOT).as_posix()}: emoji U+{ord(m.group(0)):04X}")


def main() -> int:
    """Run all checks; print OK on success."""
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    errors: list[str] = []
    n = check_catalog(errors)
    check_links(errors)
    check_content(errors)
    if errors:
        for e in errors:
            LOG.error("FAIL: %s", e)
        return 1
    print(f"components: {n}")
    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
