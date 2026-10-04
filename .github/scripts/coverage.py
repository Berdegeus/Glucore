#!/usr/bin/env python3
"""Coverage helpers for CI, stdlib only.

  coverage.py flutter-filter <lcov.info> <out.info>   drop generated files, print the % to stdout
  coverage.py flutter-summary <lcov.info>             markdown table for $GITHUB_STEP_SUMMARY
  coverage.py backend-summary <coverage-summary.json> markdown table for $GITHUB_STEP_SUMMARY
  coverage.py site <flutter.info> <backend.json> <outdir>   landing page for GitHub Pages

Generated Dart is excluded from the Flutter number: the l10n output and *.g.dart
are produced by tools, so counting them would measure the generator, not our tests.
The exclusion list is printed on the landing page so nobody has to guess.
"""
import html
import json
import sys
from pathlib import Path

EXCLUDED = ("lib/l10n/generated/", ".g.dart", ".freezed.dart")


def parse_lcov(path):
    """Yield (source_file, lines_found, lines_hit, raw_record) for each file record."""
    record, found, hit, sf = [], 0, 0, None
    for line in Path(path).read_text().splitlines():
        record.append(line)
        if line.startswith("SF:"):
            sf = line[3:]
        elif line.startswith("DA:"):
            found += 1
            if not line.endswith(",0") and int(line.split(",")[1]) > 0:
                hit += 1
        elif line == "end_of_record":
            yield sf, found, hit, "\n".join(record) + "\n"
            record, found, hit, sf = [], 0, 0, None


def kept(files):
    return [f for f in files if not any(x in f[0] for x in EXCLUDED)]


def pct(hit, found):
    return round(100 * hit / found, 2) if found else 0.0


def flutter_totals(lcov):
    files = kept(list(parse_lcov(lcov)))
    found = sum(f[1] for f in files)
    hit = sum(f[2] for f in files)
    return len(files), found, hit, pct(hit, found)


def flutter_summary(lcov):
    n, found, hit, p = flutter_totals(lcov)
    return (
        "### Cobertura Flutter\n\n"
        "| Arquivos | Linhas cobertas | Linhas | Cobertura |\n|---|---|---|---|\n"
        f"| {n} | {hit} | {found} | **{p}%** |\n\n"
        "Exclui código gerado: " + ", ".join(f"`{x}`" for x in EXCLUDED) + "\n"
    )


def backend_summary(path):
    t = json.loads(Path(path).read_text())["total"]
    rows = "".join(
        f"| {label} | {t[k]['covered']} | {t[k]['total']} | **{t[k]['pct']}%** |\n"
        for label, k in (("Instruções", "statements"), ("Ramos", "branches"), ("Funções", "functions"), ("Linhas", "lines"))
    )
    return "### Cobertura backend\n\n| Métrica | Cobertas | Total | Cobertura |\n|---|---|---|---|\n" + rows


def card(title, value, detail, href):
    return (
        f'<a class="card" href="{html.escape(href)}"><h2>{html.escape(title)}</h2>'
        f'<div class="big">{value}%</div><p>{detail}</p><span>Ver relatório →</span></a>'
    )


def site(flutter_info, backend_json, outdir):
    out = Path(outdir)
    out.mkdir(parents=True, exist_ok=True)
    n, found, hit, fp = flutter_totals(flutter_info)
    b = json.loads(Path(backend_json).read_text())["total"]
    cards = card("Backend", b["statements"]["pct"],
                 f"{b['statements']['covered']}/{b['statements']['total']} instruções · ramos {b['branches']['pct']}% · gate de CI: 90%",
                 "backend/") + card("Flutter", fp, f"{hit}/{found} linhas em {n} arquivos", "flutter/")
    (out / "index.html").write_text(f"""<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Glucore — cobertura de testes</title>
<style>
:root{{--bg:#fff;--fg:#1b1f23;--mut:#586069;--card:#f6f8fa;--bd:#d0d7de;--ac:#0969da}}
@media(prefers-color-scheme:dark){{:root{{--bg:#0d1117;--fg:#e6edf3;--mut:#8b949e;--card:#161b22;--bd:#30363d;--ac:#58a6ff}}}}
body{{font:16px/1.5 system-ui,sans-serif;background:var(--bg);color:var(--fg);margin:0;padding:24px 16px}}
main{{max-width:760px;margin:0 auto}}
.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}}
.card{{display:block;background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:20px;color:inherit;text-decoration:none}}
.card:hover{{border-color:var(--ac)}} .card h2{{margin:0;font-size:1rem;color:var(--mut)}}
.big{{font-size:3rem;font-weight:700;margin:4px 0}} .card p{{margin:0 0 12px;color:var(--mut);font-size:.9rem}}
.card span{{color:var(--ac)}} small{{color:var(--mut)}}
</style></head><body><main>
<h1>Cobertura de testes</h1>
<p><small>Gerado pelo CI a cada push na <code>main</code>. O Kotlin não é medido.</small></p>
<div class="grid">{cards}</div>
<p><small>Flutter exclui código gerado: {", ".join(f"<code>{html.escape(x)}</code>" for x in EXCLUDED)}.</small></p>
</main></body></html>
""")


if __name__ == "__main__":
    cmd, args = sys.argv[1], sys.argv[2:]
    if cmd == "flutter-filter":
        files = kept(list(parse_lcov(args[0])))
        Path(args[1]).write_text("".join(f[3] for f in files))
        print(flutter_totals(args[0])[3])
    elif cmd == "flutter-summary":
        print(flutter_summary(args[0]))
    elif cmd == "backend-summary":
        print(backend_summary(args[0]))
    elif cmd == "site":
        site(*args)
    else:
        sys.exit(__doc__)
