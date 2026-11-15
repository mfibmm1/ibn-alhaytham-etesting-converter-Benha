// Unit tests for the conversion logic. Run: node tests/unit.test.js
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const JSZip = require("jszip");
const R = require("../src/roster.js");
Object.assign(global, R);            // grades.js uses norm/key/xmlEsc from roster.js
const G = require("../src/grades.js");

const S = p => path.join(__dirname, "samples", p);
function sheetRows(file) {
  const wb = XLSX.read(fs.readFileSync(file));
  const ws = wb.Sheets[wb.SheetNames[0]];
  return { rows: XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true }),
           start: XLSX.utils.decode_range(ws["!ref"]).s.r + 1 };
}
let passed = 0;
const test = (name, fn) => Promise.resolve().then(fn).then(() => { passed++; console.log("  ok  " + name); })
  .catch(e => { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; });

(async () => {
  console.log("roster -> ImportCandidate");
  const roster = R.parseRoster(sheetRows(S("roster_sample.xlsx")).rows);
  await test("finds every student, skips repeated headers", () => assert.strictEqual(roster.students.length, 9));
  await test("splits first / last name", () => {
    assert.strictEqual(roster.students[0].first, "احمد");
    assert.strictEqual(roster.students[0].last, "محمد علي حسن");
  });
  await test("keeps compound first names whole", () => assert.strictEqual(roster.students[2].first, "عبد الرحمن"));
  await test("strips Cancelled prefix and flags it", () => {
    assert.strictEqual(roster.students[6].id, "30801071400077");
    assert(roster.warnings.some(w => w.kind === "cancelled"));
  });
  await test("flags passport numbers", () => assert(roster.warnings.some(w => w.kind === "passport" && w.id === "P12345678")));
  await test("captures student codes", () => assert.strictEqual(roster.students[0].code, "25900001"));
  await test("builds a valid ImportCandidate workbook", async () => {
    const zip = await JSZip.loadAsync(fs.readFileSync(path.join(__dirname, "..", "assets", "ImportCandidate_template.xlsx")));
    const p = "xl/worksheets/sheet1.xml";
    zip.file(p, R.buildSheetXml(await zip.file(p).async("string"), roster.students));
    const wb = XLSX.read(await zip.generateAsync({ type: "nodebuffer" }));
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null });
    const r9 = rows[8];
    assert.strictEqual(String(r9[0]), "30801011400011");
    assert.strictEqual(r9[1], "احمد");
    assert.strictEqual(r9[3], "محمد علي حسن");
    assert.strictEqual(String(r9[5]), "30801011400011");
    assert.strictEqual(String(r9[6]), "30801011400011");
  });

  console.log("E-Testing results -> grade sheet");
  const et = G.parseEtest(sheetRows(S("etest_sample.xlsx")).rows);
  const dd = G.dedupeEtest(et.candidates);
  const gs = sheetRows(S("grade_sheet_sample.xlsx"));
  const sheet = G.parseGradeSheet(gs.rows, gs.start);
  await test("reads exam title and candidates", () => { assert(/Sample Course/.test(et.title)); assert.strictEqual(et.candidates.length, 10); });
  await test("merges duplicate candidates, keeping the graded row", () => {
    assert.strictEqual(dd.list.length, 9);
    assert.strictEqual(dd.list.find(e => e.user === "30801011400011").mark, "15");
  });
  await test("detects grade columns with their max", () => {
    assert.deepStrictEqual(sheet.cols.grade.map(g => [g.label, g.max]),
      [["شفوي", 10], ["أعمال فصل", 40], ["نهاية الفصل", 50], ["المجموع", 100]]);
  });
  await test("matches by name (no roster) incl. truncated names", () => {
    const m = G.matchGrades(sheet.students, dd.list, null);
    const by = Object.fromEntries(m.result.map(r => [r.student.code, r]));
    assert.strictEqual(by["25900001"].match.mark, "15");
    assert.strictEqual(by["25900004"].method, "prefix");
    assert.strictEqual(by["25900004"].match.mark, "9");
    assert.strictEqual(by["25900009"].match, null);
    assert.strictEqual(by["25900005"].match.mark, null);
    assert.strictEqual(m.unusedEtest.length, 1);
  });
  await test("matches by national ID when a roster is given", () => {
    const map = new Map(roster.students.map(s => [s.code, s.id]));
    const m = G.matchGrades(sheet.students, dd.list, map);
    assert(m.result.filter(r => r.match).every(r => r.method === "id"));
  });
  await test("writes grades into the chosen column only", async () => {
    const m = G.matchGrades(sheet.students, dd.list, null);
    const writes = new Map();
    for (const r of m.result) if (r.match && r.match.mark != null) writes.set(r.student.rowNum, new Map([[4, r.match.mark]]));
    const zip = await JSZip.loadAsync(fs.readFileSync(S("grade_sheet_sample.xlsx")));
    const p = "xl/worksheets/sheet1.xml";
    zip.file(p, G.applyGradesXml(await zip.file(p).async("string"), writes));
    const wb = XLSX.read(await zip.generateAsync({ type: "nodebuffer" }));
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null });
    assert.strictEqual(rows[3][4], "15");          // E4
    assert.strictEqual(rows[3][3], " ");           // D4 untouched
    assert.strictEqual(rows[7][4], " ");           // absent student stays empty
    assert.strictEqual(rows[11][4], " ");          // student not in exam stays empty
    assert.strictEqual(rows[2][4], "أعمال فصل\n40"); // header untouched
  });

  console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
})();
