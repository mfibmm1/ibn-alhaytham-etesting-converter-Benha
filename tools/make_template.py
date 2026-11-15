#!/usr/bin/env python3
"""Make assets/ImportCandidate_template.xlsx from an ImportCandidate.xlsx exported by the
E-Testing Center: keeps rows 1-8 (instructions + headers + styles), removes example rows.
Usage: python3 tools/make_template.py path/to/ImportCandidate.xlsx
"""
import sys
from pathlib import Path
import openpyxl

src = sys.argv[1]
out = Path(__file__).resolve().parent.parent / "assets" / "ImportCandidate_template.xlsx"
wb = openpyxl.load_workbook(src)
ws = wb.active
for row in ws.iter_rows(min_row=9):
    for c in row:
        c.value = None
ws.delete_rows(10, ws.max_row)   # row 9 keeps its cell styles for reference
wb.save(out)
print("wrote", out)
