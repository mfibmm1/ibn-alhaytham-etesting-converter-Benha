# Ibn Al-Haytham ↔ E-Testing Center Converter

**محوّل ابن الهيثم ↔ مركز الاختبارات الإلكترونية**

A single web page that converts student files between the **Ibn Al-Haytham** student information system and the university **E-Testing Center**, in both directions. It runs entirely in the browser: no server, no account, no internet needed, and no file ever leaves the user's computer.

Designed by **Dr. Mohamed Fawzy**, Faculty of Computers and Artificial Intelligence, Benha University.

---

## What it does

### 1. Ibn Al-Haytham → E-Testing (roster → ImportCandidate)

Input: the *students registered in course* report (تقرير الطلاب المسجلين بالمقرر) exported from Ibn Al-Haytham.

Output: an `ImportCandidate.xlsx` file in the E-Testing Center's format, with the original template's headers and styling:

| ImportCandidate column | Filled with |
|---|---|
| Candidate Code | National ID |
| First Name | First name only (compound names such as «عبد الرحمن» are kept whole) |
| Last Name | The rest of the full name |
| User Name | National ID |
| Password | National ID |

The page also:
- skips the repeated page headers inside the report;
- removes a `Cancelled` prefix from national IDs and lists those students for review;
- lists students with passport numbers or IDs that are not 14 digits.

The other mandatory columns (Gender, CandidateType, Registration/Exam Center Code, PaperID) are left empty and must be filled before importing.

### 2. E-Testing → Ibn Al-Haytham (results → grade sheet)

Inputs:
1. **Exam results** from the E-Testing Center (the *Candidate Statistics* file). Required.
2. **Grade sheet** (كشف رصد درجات) exported from Ibn Al-Haytham for the same course. Required.
3. **Students registered in course** report from Ibn Al-Haytham. Optional, but it makes matching exact, because it links each student code to a national ID.

Output: the **same grade sheet**, unchanged except for the grades written in the column the user picks (default: «أعمال فصل»). Students who are not in the exam results, or who were absent, keep an empty cell.

How students are matched, in this order:

| Step | Method | Needs review? |
|---|---|---|
| 1 | Student code → national ID (from the optional roster), or an 8-digit student code found in the results' Candidate Code | No |
| 2 | Exact name, after normalizing Arabic spelling (أ/إ/ا, ى/ي, ة/ه, «عبد ال…» spacing) | No |
| 3 | Truncated name (E-Testing often cuts long names) | Yes, listed |
| 4 | Close spelling (e.g. «موسي» vs «مرسي»), only with a clear winner | Yes, listed |

Each results row is used at most once. The page reports: matches that need review, absent students, students missing from the results, duplicate candidates (and conflicting grades), and results rows that aren't on this grade sheet. It warns if the exam's total marks are higher than the chosen column's maximum. Grades are copied as they are; they are **not rescaled**.

Tested on a real course (794 students): with the roster, all 783 students that could be verified by national ID got the correct grade, with zero wrong matches.

---

## Using it

- **Online:** open the GitHub Pages link of this repository (see [docs/GITHUB_UPLOAD.md](docs/GITHUB_UPLOAD.md)).
- **Offline:** download `index.html` and double-click it. It works in Chrome, Edge or Firefox on a computer, without internet.

Steps for users (Arabic):

1. افتح الصفحة واختار اتجاه التحويل من فوق.
2. ارفع الملفات المطلوبة (اسحبها جوه الخانة أو دوس عليها).
3. راجع الملاحظات اللي بتظهر، ودوس على زرار التنزيل.

---

## Project structure

```
.
├── index.html                  # the built, self-contained page (this is what users open)
├── build.py                    # builds index.html from src/ + vendor/ + assets/
├── package.json                # npm scripts and test dependencies
├── src/
│   ├── page.html               # page markup and styles (with placeholders)
│   ├── app.js                  # UI wiring for both directions
│   ├── roster.js               # roster parsing + ImportCandidate writer
│   └── grades.js               # results parsing, matching, grade sheet writer
├── assets/
│   ├── ImportCandidate_template.xlsx  # empty E-Testing template (no student data)
│   └── benha_logo.png
├── vendor/                     # SheetJS + JSZip, inlined at build time
├── tests/
│   ├── make_samples.py         # generates FAKE sample files
│   ├── samples/                # the fake sample files
│   ├── unit.test.js            # logic tests (Node)
│   └── e2e.py                  # browser test (Playwright)
└── docs/
    ├── COMMANDS.md             # every command used to build and test
    └── GITHUB_UPLOAD.md        # step-by-step upload + GitHub Pages
```

## Building and testing

```bash
npm install                 # test dependencies (xlsx, jszip)
python3 build.py            # writes index.html
node tests/unit.test.js     # 13 logic tests
pip install playwright openpyxl && playwright install chromium
python3 tests/e2e.py        # opens index.html in a headless browser and runs both directions
```

All commands, including the ones used during development, are in [docs/COMMANDS.md](docs/COMMANDS.md).

## How the files are written

- **ImportCandidate:** the empty template in `assets/` is unzipped in the browser, student rows are written into `sheet1.xml` from row 9, and the file is zipped again. Header rows, colors and column widths stay as in the original.
- **Grade sheet:** the uploaded grade sheet is unzipped and only the grade cells of matched rows are replaced, in the same text format Ibn Al-Haytham uses. Every other byte of the sheet stays the same, so the file remains valid for upload back to Ibn Al-Haytham.

## Privacy

Real student files contain names, national IDs and grades. **Never commit them to this repository.** The `.gitignore` blocks all `.xlsx`, `.xls` and `.csv` files except the empty template and the fake samples.

## Limitations

- The grade sheet must be `.xlsx` (not the old `.xls`).
- Students with no match are left empty and listed; enter their grades manually.
- Grades are not rescaled. If the exam is out of 20 and the column is out of 40, the page warns only when the exam total is higher than the column maximum.

## Credits

Designed by Dr. Mohamed Fawzy, Faculty of Computers and Artificial Intelligence, Benha University.
Built with [SheetJS Community Edition](https://sheetjs.com) (Apache-2.0) and [JSZip](https://stuk.github.io/jszip/) (MIT).
