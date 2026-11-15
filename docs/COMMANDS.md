# Commands used to build this project

Every command used to generate, build and test the converter, in the order they were run. Commands that touched **real** student files are marked *(real data, local only)*: those files are never part of the repository.

All commands run from the repository root unless noted.

---

## 1. Inspect the source files *(real data, local only)*

Look at the structure of each Excel file (sheet names, merged cells, first rows):

```bash
python3 -c "
import openpyxl
for f in ['ImportCandidate.xlsx', 'مهارات_العرض_والاتصال.xlsx']:
    wb = openpyxl.load_workbook(f)
    for ws in wb:
        print('==', f, ws.title, ws.dimensions, ws.merged_cells.ranges)
        for r in ws.iter_rows(min_row=1, max_row=8, values_only=True): print(r)
        print('rows', ws.max_row)
"
```

Look at the raw XML of the Ibn Al-Haytham grade sheet (to write grades back in the same format):

```bash
mkdir g && cd g && unzip -q "../كشف_رصد_درجات.xlsx" && cd ..
python3 -c "
s = open('g/xl/worksheets/sheet1.xml').read()
i = s.find('<row r=\"4\"'); print(s[i:i+1500])
"
```

Finding: grade cells are text cells (`t=\"str\"`) holding a single space, and the header row lists each grade column with its maximum on a second line (`أعمال فصل\n40`).

## 2. Install the libraries

```bash
npm install                       # installs xlsx@0.18.5 and jszip@3.10.1 (see package.json)
cp node_modules/xlsx/dist/xlsx.full.min.js vendor/
cp node_modules/jszip/dist/jszip.min.js vendor/
pip install openpyxl pillow playwright --break-system-packages   # drop the flag outside a managed Python
playwright install chromium
```

## 3. Prepare the assets

Empty ImportCandidate template, from the file exported by the E-Testing Center:

```bash
python3 tools/make_template.py /path/to/ImportCandidate.xlsx
```

Logo, cut from the "Designed by" screenshot:

```bash
python3 tools/crop_logo.py /path/to/screenshot.png
```

## 4. Build the page

```bash
python3 build.py                  # -> index.html (about 1 MB, fully offline)
```

`build.py` inlines `vendor/*.js`, `src/roster.js`, `src/grades.js`, `src/app.js`, the template (base64) and the logo (base64) into `src/page.html`.

## 5. Test with fake data

```bash
python3 tests/make_samples.py     # writes tests/samples/*.xlsx (invented names and IDs)
node tests/unit.test.js           # 13 tests: parsing, matching, writing
python3 tests/e2e.py              # headless Chromium: uploads samples, downloads results, checks cells
```

Or with npm:

```bash
npm run samples && npm test && npm run e2e
```

## 6. Test with real files *(real data, local only)*

Matching accuracy was checked with a local Node script (not in the repo, because it reads real files). It runs `matchGrades()` twice, without and with the roster, and compares every match with the national ID from the roster:

```bash
node check_real_matching.js       # local only
```

Result on a real course of 794 students: 0 wrong matches; with the roster, 783 of 783 verifiable students received the correct grade, 776 grades written in total.

End-to-end check that every cell except the grade column is unchanged:

```bash
python3 -c "
import openpyxl
o = openpyxl.load_workbook('original_grade_sheet.xlsx').active
n = openpyxl.load_workbook('downloaded_grade_sheet.xlsx').active
diff = [c.coordinate for r in o.iter_rows() for c in r if c.value != n[c.coordinate].value]
print(len(diff), 'changed cells; outside column E:', [d for d in diff if not d.startswith('E')])
"
```

Open the output in LibreOffice to confirm it is a valid workbook:

```bash
soffice --headless --convert-to csv downloaded_grade_sheet.xlsx
```

## 7. Upload to GitHub

See [GITHUB_UPLOAD.md](GITHUB_UPLOAD.md).
