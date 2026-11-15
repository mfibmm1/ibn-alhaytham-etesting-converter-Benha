#!/usr/bin/env python3
"""Generate FAKE sample files (no real student data) that mimic the real layouts:
  samples/roster_sample.xlsx      Ibn Al-Haytham "students registered in course" report
  samples/etest_sample.xlsx       E-Testing "Candidate Statistics" results
  samples/grade_sheet_sample.xlsx Ibn Al-Haytham grade sheet (كشف رصد درجات)
Usage: python3 tests/make_samples.py
"""
from pathlib import Path
import datetime
import openpyxl

OUT = Path(__file__).parent / "samples"
OUT.mkdir(exist_ok=True)
NB = "\u00a0\u00a0"

# (code, full name, national id, mark or None) -- all invented
STUDENTS = [
    ("25900001", "احمد محمد علي حسن", "30801011400011", "15"),
    ("25900002", "إبراهيم سامي فتحي عرفه", "30801021400022", "12"),
    ("25900003", "عبد الرحمن خالد محمود السيد", "30801031400033", "18"),
    ("25900004", "مريم عادل مصطفى كامل عبد الحميد", "30801041400044", "9"),   # truncated in E-Testing
    ("25900005", "يوسف طارق فهمي", "30801051400055", None),                 # absent
    ("25900006", "سارة وليد حسن", "P12345678", "17"),                       # passport
    ("25900007", "كريم ياسر ابراهيم", "Cancelled30801071400077", "11"),     # cancelled prefix
    ("25900008", "منى حسام الدين احمد", "30801081400088", "14"),
    ("25900009", "طالب مش في الامتحان", "30801091400099", None),
]
ETEST_EXTRA = [("30801101400100", "طالب من مجموعة تانية", "16")]


def roster():
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = "تقرير"
    ws.append([None, "كشوف الميد ترم - مقرر تجريبي - XX101"])
    ws.append([None, "المقبول تسجيلهم"])
    ws.append(["نظام ابن الهيثم لادارة شئون الطلاب"])
    ws.append(["م", "كود الطالب", "اسم الطالب", "الرقم القومى", "ملاحظات", "توقيع الحضور", "توقيع الانصراف"])
    for i, (code, name, nid, _) in enumerate(STUDENTS, 1):
        v = float(nid) if nid.isdigit() else nid
        ws.append([NB + str(i), NB + code, NB + name, v, NB, NB, NB])
        if i == 5:  # a repeated page header in the middle, like the real report
            ws.append(["م", "كود الطالب", "اسم الطالب", "الرقم القومى", "ملاحظات", "توقيع الحضور", "توقيع الانصراف"])
    wb.save(OUT / "roster_sample.xlsx")


def etest():
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = "Candidate Statistics"
    ws.append(["Candidate Statistics"]); ws.append([])
    ws.append(["Exam Event : (Sample Course) -(01-01-2027) -(Faculty) L1-Mid"])
    ws.append(["Candidate Code", "Candidate Name", "User Name", "Paper", "Paper Start Date", "Marks Obtained", "Total Marks"])
    d = datetime.datetime(2027, 1, 1)
    for code, name, nid, mark in STUDENTS:
        if code == "25900009":
            continue
        nid = nid.replace("Cancelled", "")
        shown = name if code != "25900004" else "مريم عادل مصطفى كامل عبد"   # E-Testing cuts long names
        ws.append([nid, shown + "  ", nid, "(Sample Course)", d, mark, "20"])
    ws.append(["30801011400011\t", "احمد محمد علي", "30801011400011\t", "(Sample Course)", d, None, "20"])  # duplicate, no mark
    for nid, name, mark in ETEST_EXTRA:
        ws.append([nid, name, nid, "(Sample Course)", d, mark, "20"])
    wb.save(OUT / "etest_sample.xlsx")


def grade_sheet():
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = "sheet"
    ws.append(["\n", "كشف رصد درجات\nمقرر تجريبي ( XX101 )\n", "\n"])
    ws.append(["نظام ابن الهيثم لادارة شئون الطلاب"])
    ws.append(["م", "الكود", "الاسم", "شفوي\n10", "أعمال فصل\n40", "نهاية الفصل\n50", "المجموع\n100", "ملاحظات"])
    for i, (code, name, _, _) in enumerate(STUDENTS, 1):
        ws.append([str(i), code, " " + name, " ", " ", " ", " ", " "])
    wb.save(OUT / "grade_sheet_sample.xlsx")


if __name__ == "__main__":
    roster(); etest(); grade_sheet()
    print("samples written to", OUT)
