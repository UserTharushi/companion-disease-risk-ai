"""Pre-process the interim report for .docx conversion.

Markdown carries two things pandoc cannot translate into Word on its own:

  <div align="page-break"></div>   dropped silently, leaving the cover page and
                                   chapters running together on one page
  <div align="center"> ... </div>  dropped, losing cover-page centring

This script rewrites those into raw OpenXML that pandoc passes straight through,
producing INTERIM_REPORT.build.md. Run it before pandoc; see README_BUILD.md.

Usage (from the repository root):

    docker run --rm -v "${PWD}:/repo" python:3.11-slim \
        python /repo/scripts/build_interim_docx.py

    docker run --rm -v "${PWD}/docs:/data" -w /data pandoc/core:latest \
        INTERIM_REPORT.build.md -o INTERIM_REPORT.docx --toc --toc-depth=3
"""
import pathlib
import re

DOCS = pathlib.Path("/repo/docs")
SOURCE = DOCS / "INTERIM_REPORT.md"
TARGET = DOCS / "INTERIM_REPORT.build.md"

PAGE_BREAK = '\n```{=openxml}\n<w:p><w:r><w:br w:type="page"/></w:r></w:p>\n```\n'


def centred(text: str) -> str:
    """Wrap each non-empty line in a centred OpenXML paragraph."""
    out = ["\n"]
    for line in text.strip().splitlines():
        line = line.strip()
        if not line:
            continue
        # Strip markdown heading markers and emphasis; Word centring is applied
        # via paragraph properties instead.
        plain = re.sub(r"^#+\s*", "", line)
        bold = plain.startswith("**") and plain.endswith("**")
        italic = plain.startswith("*") and plain.endswith("*") and not bold
        plain = plain.strip("*").replace("<br>", "").strip()
        if not plain:
            continue
        plain = (plain.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))
        rpr = ""
        if bold:
            rpr = "<w:rPr><w:b/></w:rPr>"
        elif italic:
            rpr = "<w:rPr><w:i/></w:rPr>"
        out.append(
            "```{=openxml}\n"
            '<w:p><w:pPr><w:jc w:val="center"/></w:pPr>'
            f"<w:r>{rpr}<w:t xml:space=\"preserve\">{plain}</w:t></w:r></w:p>\n"
            "```\n"
        )
    return "".join(out)


md = SOURCE.read_text(encoding="utf-8")

# Centred blocks first, so the page-break substitution does not run inside them.
md = re.sub(
    r'<div align="center">(.*?)</div>',
    lambda m: centred(m.group(1)),
    md,
    flags=re.S,
)

md = md.replace('<div align="page-break"></div>', PAGE_BREAK)

# Any remaining stray divs would surface as literal text in Word.
leftover = re.findall(r"</?div[^>]*>", md)
if leftover:
    print(f"warning: {len(leftover)} unhandled div tag(s) removed: {set(leftover)}")
    md = re.sub(r"</?div[^>]*>", "", md)

TARGET.write_text(md, encoding="utf-8")
print(f"wrote {TARGET.name}")
print(f"  page breaks inserted : {md.count('w:br w:type=')}")
print(f"  centred paragraphs   : {md.count('w:jc w:val=')}")
