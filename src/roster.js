// roster.js: Ibn Al-Haytham roster -> E-Testing ImportCandidate.
// Parses the "students registered in course" report and builds ImportCandidate sheet rows.
function norm(s) {
  return String(s == null ? "" : s)
    .replace(/[\u00a0\u200f\u200e\u202a-\u202e]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function key(s) {
  return norm(s).replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/\s/g, "");
}
const COMPOUND_FIRST = ["عبد", "ابو", "أبو"];

function parseRoster(rows) {
  let cName = -1, cId = -1, cSerial = 0, cCode = -1;
  const out = [], warnings = [];
  let title = "";
  for (const r of rows) {
    if (!r) continue;
    const cells = r.map(norm);
    if (!title) { const t = cells.find(c => c.length > 10); if (t) title = t; }
    const keys = r.map(key);
    const iName = keys.indexOf("اسمالطالب");
    const iId = keys.findIndex(k => k === "الرقمالقومي" || k === "الرقمالقومى");
    if (iName >= 0 && iId >= 0) {
      cName = iName; cId = iId;
      const iS = keys.indexOf("م"); cSerial = iS >= 0 ? iS : 0;
      cCode = keys.indexOf("كودالطالب");
      continue;
    }
    if (cName < 0) continue;
    const serialRaw = r[cSerial];
    const serial = typeof serialRaw === "number" ? serialRaw : Number(norm(serialRaw));
    if (!Number.isInteger(serial) || serial <= 0 || norm(serialRaw) === "") continue;
    const full = norm(r[cName]);
    if (!full) continue;
    const words = full.split(" ");
    const k = words.length > 2 && COMPOUND_FIRST.includes(words[0]) ? 2 : 1;
    const first = words.slice(0, k).join(" ");
    const last = words.slice(k).join(" ");
    let idRaw = r[cId], id, idIsNum = false;
    if (typeof idRaw === "number") {
      id = String(Math.round(idRaw)); idIsNum = true;
    } else {
      id = norm(idRaw).replace(/\s/g, "");
      const m = id.match(/^cancelled(\d{14})$/i);
      if (m) {
        id = m[1]; idIsNum = true;
        warnings.push({ serial, name: full, kind: "cancelled", id });
      } else if (/^\d+$/.test(id)) {
        idIsNum = true;
      }
    }
    if (!id) warnings.push({ serial, name: full, kind: "missing", id: "" });
    else if (!/^\d{14}$/.test(id) && !warnings.some(w => w.serial === serial && w.kind === "cancelled"))
      warnings.push({ serial, name: full, kind: /^[a-z]/i.test(id) ? "passport" : "short", id });
    if (k === 2) warnings.push({ serial, name: full, kind: "compound", id: first });
    const code = cCode >= 0 ? norm(r[cCode]).replace(/\s/g, "") : "";
    out.push({ serial, code, name: full, first, last, id, idIsNum });
  }
  return { title, students: out, warnings };
}

function xmlEsc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function cellXml(ref, style, value, isNum) {
  if (value === "" || value == null) return "";
  if (isNum) return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(value)}</t></is></c>`;
}
function buildSheetXml(templateXml, students) {
  const start = templateXml.indexOf('<row r="9"');
  const end = templateXml.indexOf("</sheetData>");
  let rowsXml = "";
  students.forEach((s, i) => {
    const r = 9 + i;
    rowsXml += `<row r="${r}">` +
      cellXml("A" + r, 5, s.id, s.idIsNum) +
      cellXml("B" + r, 7, s.first, false) +
      cellXml("D" + r, 7, s.last, false) +
      cellXml("F" + r, 5, s.id, s.idIsNum) +
      cellXml("G" + r, 5, s.id, s.idIsNum) +
      `</row>`;
  });
  const lastRow = Math.max(9, 8 + students.length);
  return templateXml.slice(0, start)
    .replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="A1:S${lastRow}"/>`)
    + rowsXml + templateXml.slice(end);
}

if (typeof module !== "undefined") module.exports = { norm, key, parseRoster, buildSheetXml, xmlEsc };
