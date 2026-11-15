#!/usr/bin/env python3
"""Build index.html: one self-contained, offline-ready page.

Inlines the vendor libraries (SheetJS, JSZip), the conversion logic in src/,
the ImportCandidate template and the logo into src/page.html.
Usage:  python3 build.py
"""
import base64
from pathlib import Path

ROOT = Path(__file__).parent


def read(p):
    return (ROOT / p).read_text(encoding="utf-8")


def b64(p):
    return base64.b64encode((ROOT / p).read_bytes()).decode("ascii")


def script_safe(js):
    # a literal "</script" inside inlined JS would end the <script> element early
    return js.replace("</script", "<\\/script")


def strip_exports(js):
    return "\n".join(l for l in js.splitlines() if not l.startswith('if (typeof module !== "undefined")'))


def main():
    page = read("src/page.html")
    grades = read("src/grades.js")
    # grades.js ends with a multi-line module.exports block; cut it for the browser build
    grades = grades.split('if (typeof module !== "undefined")')[0]
    app = read("src/app.js").replace("__TPL_B64__", b64("assets/ImportCandidate_template.xlsx"))
    parts = {
        "/*__XLSX__*/": read("vendor/xlsx.full.min.js"),
        "/*__JSZIP__*/": read("vendor/jszip.min.js"),
        "/*__ROSTER_JS__*/": strip_exports(read("src/roster.js")),
        "/*__GRADES_JS__*/": grades,
        "/*__APP_JS__*/": app,
    }
    for marker, js in parts.items():
        assert marker in page, marker
        page = page.replace(marker, script_safe(js))
    page = page.replace("__LOGO_B64__", b64("assets/benha_logo.png"))
    out = ROOT / "index.html"
    out.write_text(page, encoding="utf-8")
    print(f"wrote {out.name} ({out.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
