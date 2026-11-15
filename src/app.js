// app.js: UI wiring for both conversion directions.
const TEMPLATE_B64 = "__TPL_B64__";
const $ = id => document.getElementById(id);
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const nf = n => n.toLocaleString("ar-EG");

let downloadsP = null;
try { if (window.claude && window.claude.use) downloadsP = window.claude.use("downloads"); } catch (e) {}

// ---------- shared helpers ----------
function b64ToBytes(b64) { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }

async function readWorkbook(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheets = wb.SheetNames.map(name => {
    const ws = wb.Sheets[name];
    const ref = ws["!ref"];
    const start = ref ? XLSX.utils.decode_range(ref).s.r + 1 : 1;
    return { name, start, rows: XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true }) };
  });
  return { buf, sheets, sheetNames: wb.SheetNames };
}

async function sheetPathFor(zip, sheetName) {
  const wbXml = await zip.file("xl/workbook.xml").async("string");
  const rels = await zip.file("xl/_rels/workbook.xml.rels").async("string");
  const sheetTags = [...wbXml.matchAll(/<sheet\b[^>]*>/g)].map(m => m[0]);
  const attr = (tag, a) => { const m = tag.match(new RegExp("\\b" + a + "=\"([^\"]*)\"")); return m ? m[1] : null; };
  const tag = sheetTags.find(t => attr(t, "name") === sheetName) || sheetTags[0];
  const rid = attr(tag, "r:id");
  const rel = [...rels.matchAll(/<Relationship\b[^>]*>/g)].map(m => m[0]).find(t => attr(t, "Id") === rid);
  let target = attr(rel, "Target");
  target = target.startsWith("/") ? target.slice(1) : "xl/" + target.replace(/^\.\//, "");
  return target;
}

async function saveBlob(blob, name, statusEl) {
  try {
    const dl = downloadsP ? await downloadsP : null;
    if (dl) {
      await dl.save({ filename: name, data: blob });
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = name;
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }
    statusEl.textContent = "اتنزّل الملف " + name + "، هتلاقيه في فولدر التنزيلات.";
  } catch (e) {
    const code = e && e.code;
    statusEl.textContent =
      code === "declined" ? "التحميل اتلغى. دوس على زرار التنزيل تاني لما تكون جاهز." :
      code === "rate_limited" ? "في طلب تحميل مفتوح بالفعل. استنى ثواني وجرّب تاني." :
      "التحميل ما اشتغلش. جرّب تفتح الصفحة في Chrome أو Edge.";
  }
}
function xlsxName(v, fallback) { let n = (v || "").trim() || fallback; if (!/\.xlsx$/i.test(n)) n += ".xlsx"; return n; }
function baseName(n) { return n.replace(/\.[^.]+$/, ""); }

function wireDrop(dropId, inputId, onFile) {
  const drop = $(dropId), input = $(inputId);
  input.addEventListener("change", () => { if (input.files[0]) onFile(input.files[0]); input.value = ""; });
  ["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", e => { const f = e.dataTransfer.files[0]; if (f) onFile(f); });
}
function showError(id, msg) { const e = $(id); e.textContent = msg; e.classList.toggle("show", !!msg); }

function noteBox(kind, title, items, opts = {}) {
  // items: array of {text, id?}; long lists collapse
  const collapse = opts.collapse || items.length > 12;
  const box = document.createElement(collapse ? "details" : "div");
  box.className = "note-box" + (kind ? " " + kind : "");
  const h = document.createElement(collapse ? "summary" : "h3");
  h.textContent = title + (items.length ? " (" + nf(items.length) + ")" : "");
  box.append(h);
  if (opts.text) { const p = document.createElement("p"); p.textContent = opts.text; box.append(p); }
  if (items.length) {
    const ul = document.createElement("ul");
    for (const it of items) {
      const li = document.createElement("li");
      li.append(it.text);
      if (it.id) { li.append(" "); const b = document.createElement("bdi"); b.className = "id"; b.textContent = "(" + it.id + ")"; li.append(b); }
      ul.append(li);
    }
    box.append(ul);
  }
  return box;
}

function setSrc(el, title, tail) {
  el.textContent = "";
  if (title) { const b = document.createElement("bdi"); b.textContent = title; el.append(b, "، "); }
  el.append(tail);
}

// ---------- routing ----------
function route() {
  const v = location.hash === "#grades" ? "grades" : "roster";
  for (const name of ["roster", "grades"]) {
    $("view-" + name).classList.toggle("on", name === v);
    const tab = $("tab-" + name);
    if (name === v) tab.setAttribute("aria-current", "page"); else tab.removeAttribute("aria-current");
  }
}
window.addEventListener("hashchange", route);
route();

// =====================================================================
// Direction 1: Ibn Al-Haytham roster -> ImportCandidate
// =====================================================================
const R_LABELS = {
  passport: "رقم جواز سفر بدل الرقم القومي (اتحط زي ما هو)",
  short: "الرقم أقل من 14 رقم (اتحط زي ما هو)",
  cancelled: "الرقم كان مكتوب قبله كلمة Cancelled، اتشالت الكلمة واتحط الرقم بس. اتأكد إن تسجيل الطالب ما اتلغاش",
  missing: "مفيش رقم قومي للطالب ده",
  compound: "اسم أول مركب، اتحط كله في First Name"
};
let rCurrent = null;

wireDrop("r-drop", "r-file", async file => {
  showError("r-error", ""); $("r-result").classList.remove("show"); $("r-status").textContent = "";
  $("r-fname").textContent = file.name; $("r-drop").classList.remove("done");
  try {
    const wb = await readWorkbook(file);
    let res = null;
    for (const s of wb.sheets) { const r = parseRoster(s.rows); if (r.students.length) { res = r; break; } }
    if (!res) {
      showError("r-error", "ما لقيتش طلاب في الملف ده. الصفحة بتدوّر على صف عناوين فيه «اسم الطالب» و«الرقم القومى»، وتحته صفوف مترقمة. اتأكد إن ده كشف الطلاب المسجلين بالمقرر.");
      return;
    }
    const zip = await JSZip.loadAsync(b64ToBytes(TEMPLATE_B64));
    const path = "xl/worksheets/sheet1.xml";
    zip.file(path, buildSheetXml(await zip.file(path).async("string"), res.students));
    rCurrent = await zip.generateAsync({ type: "blob", compression: "DEFLATE", mimeType: XLSX_MIME });
    $("r-drop").classList.add("done");
    renderRoster(res, file.name);
  } catch (err) {
    console.error(err);
    showError("r-error", "الملف ده ما اتقراش. اتأكد إنه ملف Excel سليم (xlsx أو xls) وجرّب تاني.");
  }
});

function renderRoster(res, srcName) {
  $("r-count").textContent = nf(res.students.length);
  setSrc($("r-src"), res.title, "من ملف " + srcName);
  $("r-out").value = "ImportCandidate_" + baseName(srcName) + ".xlsx";
  const box = $("r-warnings"); box.textContent = "";
  for (const kind of ["cancelled", "missing", "short", "passport", "compound"]) {
    const items = res.warnings.filter(w => w.kind === kind)
      .map(w => ({ text: "م " + w.serial + ": " + w.name, id: kind !== "compound" ? w.id : "" }));
    if (items.length) box.append(noteBox(kind === "compound" ? "info" : "", R_LABELS[kind], items));
  }
  const tb = $("r-preview"); tb.textContent = "";
  for (const s of res.students.slice(0, 8)) {
    const tr = document.createElement("tr");
    [[s.id, 1], [s.first, 0], [s.last, 0], [s.id, 1], [s.id, 1]].forEach(([v, num]) => {
      const td = document.createElement("td"); if (num) td.className = "num"; td.textContent = v; tr.append(td);
    });
    tb.append(tr);
  }
  const rest = res.students.length - 8;
  $("r-more").textContent = rest > 0 ? "و" + nf(rest) + " طالب كمان في الملف." : "";
  $("r-result").classList.add("show");
}
$("r-dl").addEventListener("click", async () => {
  if (!rCurrent) return;
  $("r-dl").disabled = true;
  await saveBlob(rCurrent, xlsxName($("r-out").value, "ImportCandidate.xlsx"), $("r-status"));
  $("r-dl").disabled = false;
});

// =====================================================================
// Direction 2: E-Testing results -> Ibn Al-Haytham grade sheet
// =====================================================================
const G = { etest: null, sheet: null, rosterMap: null, plan: null };
const METHOD = { id: "بالرقم القومي", name: "بالاسم", prefix: "اسم مختصر، راجعها", fuzzy: "اسم قريب، راجعها" };

function gSetLoaded(dropId, nameId, name) { $(nameId).textContent = name; $(dropId).classList.toggle("done", !!name); }

wireDrop("g-drop-etest", "g-etest", async file => {
  showError("g-error", "");
  try {
    const wb = await readWorkbook(file);
    let parsed = null;
    for (const s of wb.sheets) { const p = parseEtest(s.rows); if (p.found && p.candidates.length) { parsed = p; break; } }
    if (!parsed) { G.etest = null; gSetLoaded("g-drop-etest", "g-etest-name", ""); showError("g-error", "ملف النتيجة ده مش فيه أعمدة User Name وMarks Obtained. اتأكد إنه ملف Candidate Statistics من مركز الاختبارات."); gCompute(); return; }
    G.etest = { ...parsed, fileName: file.name };
    gSetLoaded("g-drop-etest", "g-etest-name", file.name);
  } catch (e) { console.error(e); showError("g-error", "ملف النتيجة ما اتقراش. اتأكد إنه ملف Excel سليم."); }
  gCompute();
});

wireDrop("g-drop-sheet", "g-sheet", async file => {
  showError("g-error", "");
  try {
    const wb = await readWorkbook(file);
    let parsed = null, sheetName = null;
    for (const s of wb.sheets) {
      const p = parseGradeSheet(s.rows, s.start);
      if (p.cols && p.students.length) { parsed = p; sheetName = s.name; break; }
    }
    if (!parsed || !parsed.cols.grade.length) {
      G.sheet = null; gSetLoaded("g-drop-sheet", "g-sheet-name", "");
      showError("g-error", "ده مش شبه كشف رصد الدرجات. الصفحة بتدوّر على صف عناوين فيه «الكود» و«الاسم» وبعدهم أعمدة الدرجات.");
      gCompute(); return;
    }
    G.sheet = { ...parsed, buf: wb.buf, sheetName, fileName: file.name };
    gSetLoaded("g-drop-sheet", "g-sheet-name", file.name);
    const sel = $("g-col"); const prev = sel.value; sel.textContent = "";
    parsed.cols.grade.forEach(g => {
      const o = document.createElement("option"); o.value = g.index;
      o.textContent = g.label + (g.max != null ? " (من " + g.max + ")" : ""); sel.append(o);
    });
    const def = parsed.cols.grade.find(g => /اعمال|أعمال/.test(g.label)) || parsed.cols.grade[0];
    sel.value = [...sel.options].some(o => o.value === prev) ? prev : String(def.index);
  } catch (e) { console.error(e); showError("g-error", "كشف الدرجات ما اتقراش. اتأكد إنه ملف Excel سليم."); }
  gCompute();
});

wireDrop("g-drop-roster", "g-roster", async file => {
  showError("g-error", "");
  try {
    const wb = await readWorkbook(file);
    let res = null;
    for (const s of wb.sheets) { const r = parseRoster(s.rows); if (r.students.length) { res = r; break; } }
    const pairs = res ? res.students.filter(s => s.code && s.id).map(s => [s.code, s.id]) : [];
    if (!pairs.length) { G.rosterMap = null; gSetLoaded("g-drop-roster", "g-roster-name", ""); showError("g-error", "كشف الطلاب ده مفيهوش عمود «كود الطالب» و«الرقم القومى»، فمش هينفع يتستخدم في المطابقة."); gCompute(); return; }
    G.rosterMap = new Map(pairs);
    gSetLoaded("g-drop-roster", "g-roster-name", file.name);
  } catch (e) { console.error(e); showError("g-error", "كشف الطلاب ما اتقراش."); }
  gCompute();
});

$("g-col").addEventListener("change", gCompute);
$("g-overwrite").addEventListener("change", gCompute);

function gCompute() {
  const ready = G.etest && G.sheet;
  $("g-options").classList.toggle("show", !!G.sheet);
  $("g-result").classList.toggle("show", !!ready);
  $("g-status").textContent = "";
  if (!ready) { G.plan = null; return; }

  const colIdx = Number($("g-col").value);
  const col = G.sheet.cols.grade.find(g => g.index === colIdx);
  const overwrite = $("g-overwrite").checked;
  const dd = dedupeEtest(G.etest.candidates);
  const m = matchGrades(G.sheet.students, dd.list, G.rosterMap);

  const writes = new Map();
  const st = { filled: 0, absent: [], missing: [], review: [], kept: [], replaced: 0, byMethod: {} };
  for (const r of m.result) {
    const s = r.student;
    if (!r.match) { st.missing.push(s); continue; }
    st.byMethod[r.method] = (st.byMethod[r.method] || 0) + 1;
    if (r.method === "prefix" || r.method === "fuzzy") st.review.push(r);
    if (r.match.mark == null) { st.absent.push(r); continue; }
    const existing = s.existing[colIdx];
    if (existing && !overwrite) { st.kept.push({ r, existing }); continue; }
    if (existing && existing !== r.match.mark) st.replaced++;
    if (!writes.has(s.rowNum)) writes.set(s.rowNum, new Map());
    writes.get(s.rowNum).set(colIdx, r.match.mark);
    st.filled++;
  }
  G.plan = { writes, col };

  $("g-filled").textContent = nf(st.filled);
  $("g-total").textContent = nf(G.sheet.students.length);
  setSrc($("g-src"), G.etest.title, "في عمود «" + col.label + "»");
  $("g-colhead").textContent = col.label;
  $("g-out").value = baseName(G.sheet.fileName) + "_مرصود.xlsx";

  const box = $("g-notes"); box.textContent = "";
  const totals = [...new Set(G.etest.candidates.map(c => c.total).filter(Boolean))];
  const examMax = Math.max(...totals.map(Number).filter(n => !isNaN(n)), 0);
  if (col.max != null && examMax > col.max)
    box.append(noteBox("err", "الامتحان من " + examMax + " والعمود ده من " + col.max, [], { text: "اتأكد إنك اخترت العمود الصح قبل ما تنزّل الكشف." }));
  else if (examMax)
    box.append(noteBox("info", "الدرجات اتحطت زي ما هي (الامتحان من " + examMax + ")", [], { text: "الأداة مش بتغيّر مقياس الدرجات، بتنقلها بس." }));

  const conflicts = dd.issues.filter(i => i.kind === "dup-conflict");
  if (conflicts.length) box.append(noteBox("err", "طالب متكرر في النتيجة بدرجتين مختلفتين (اتساب فاضي)", conflicts.map(c => ({ text: c.name + ": " + c.marks.join(" و "), id: c.user }))));
  if (st.review.length) box.append(noteBox("", "مطابقة بالاسم التقريبي، راجعها", st.review.map(r => ({
    text: r.student.name + "  ←  " + r.match.name + (r.match.mark != null ? "  [" + r.match.mark + "]" : ""), id: r.student.code }))));
  if (st.absent.length) box.append(noteBox("", "غايبين في الامتحان، مالهمش درجة (اتسابوا فاضيين)", st.absent.map(r => ({ text: r.student.name, id: r.student.code }))));
  if (st.missing.length) box.append(noteBox("", "مش موجودين في نتيجة الامتحان (اتسابوا فاضيين)", st.missing.map(s => ({ text: s.name, id: s.code }))));
  if (st.kept.length) box.append(noteBox("info", "كان مكتوب لهم درجة بالفعل واتسابت زي ما هي", st.kept.map(k => ({ text: k.r.student.name + ": " + k.existing, id: k.r.student.code })), { text: "علّم على «استبدل الدرجات المكتوبة بالفعل» لو عايز تحط درجات الامتحان مكانها." }));
  if (st.replaced) box.append(noteBox("info", "اتستبدلت " + nf(st.replaced) + " درجة كانت مكتوبة قبل كده", []));
  if (m.unusedEtest.length) box.append(noteBox("info", "في نتيجة الامتحان ومش في الكشف ده", m.unusedEtest.map(e => ({ text: e.name + (e.mark != null ? "  [" + e.mark + "]" : ""), id: e.user })), { collapse: true }));
  const okDup = dd.issues.filter(i => i.kind === "dup-ok");
  if (okDup.length) box.append(noteBox("info", "طلاب متكررين في النتيجة بنفس الدرجة (اتحسبوا مرة واحدة)", okDup.map(c => ({ text: c.name + ": " + c.mark, id: c.user }))));
  const how = Object.entries(st.byMethod).map(([k, v]) => METHOD[k] + " " + nf(v)).join("، ");
  if (how) box.append(noteBox("info", "طريقة المطابقة", [], { text: how + (G.rosterMap ? "" : ". ارفع كشف الطلاب المسجلين (الخانة 3) عشان المطابقة تبقى بالرقم القومي وتبقى أدق.") }));

  const tb = $("g-preview"); tb.textContent = "";
  for (const r of m.result.slice(0, 10)) {
    const tr = document.createElement("tr");
    const w = writes.get(r.student.rowNum);
    const val = w && w.has(colIdx) ? w.get(colIdx) : (r.student.existing[colIdx] || "");
    const how = !r.match ? "مش في النتيجة" : r.match.mark == null ? "غائب" : METHOD[r.method];
    [[r.student.code, 1], [r.student.name, 0], [val, 1], [how, 0]].forEach(([v, num]) => {
      const td = document.createElement("td"); if (num) td.className = "num"; td.textContent = v; tr.append(td);
    });
    tb.append(tr);
  }
}

$("g-dl").addEventListener("click", async () => {
  if (!G.plan) return;
  const btn = $("g-dl"); btn.disabled = true; $("g-status").textContent = "";
  try {
    const zip = await JSZip.loadAsync(G.sheet.buf);
    const path = await sheetPathFor(zip, G.sheet.sheetName);
    const xml = await zip.file(path).async("string");
    zip.file(path, applyGradesXml(xml, G.plan.writes));
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", mimeType: XLSX_MIME });
    await saveBlob(blob, xlsxName($("g-out").value, "grades.xlsx"), $("g-status"));
  } catch (e) {
    console.error(e);
    $("g-status").textContent = "حصلت مشكلة وإحنا بنجهّز الكشف. جرّب ترفع كشف رصد الدرجات تاني.";
  } finally { btn.disabled = false; }
});
