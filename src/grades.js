// grades.js: E-Testing "Candidate Statistics" results -> Ibn Al-Haytham grade sheet (كشف رصد درجات).
// Depends on norm(), key(), xmlEsc() from roster.js.

// ---------- name normalization for matching ----------
function nameTokens(s) {
  let t = norm(s)
    .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
    .replace(/ئ/g, "ي").replace(/ؤ/g, "و").replace(/ـ/g, "")
    .replace(/[\u064B-\u0652]/g, ""); // tashkeel
  t = t.replace(/(^|\s)(عبد|ابو)\s+/g, "$1$2");   // "عبد الله" -> "عبدالله"
  t = t.replace(/\s+(الدين|الله)(?=\s|$)/g, "$1"); // "صلاح الدين" -> "صلاحالدين"
  return t.split(" ").filter(Boolean);
}
function nameKey(s) { return nameTokens(s).join(""); }

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = new Array(n + 1), cur = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}
function similarity(a, b) {
  const d = levenshtein(a, b);
  return 1 - d / Math.max(a.length, b.length, 1);
}
// One name is a (possibly truncated) prefix of the other: E-Testing often cuts long names.
function isPrefixName(ta, tb) {
  const [s, l] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  if (s.length < 3) return false;
  for (let i = 0; i < s.length - 1; i++) if (s[i] !== l[i]) return false;
  const lastS = s[s.length - 1], lastL = l[s.length - 1];
  if (lastS === lastL) return true;
  if (lastS.length >= 2 && lastL.startsWith(lastS)) return true;
  // same number of words: either side may be the truncated one
  return s.length === l.length && lastL.length >= 2 && lastS.startsWith(lastL);
}

// ---------- parsing ----------
function lowerKey(s) { return norm(s).toLowerCase().replace(/\s/g, ""); }

function parseEtest(rows) {
  let col = null, title = "";
  const out = [];
  for (const r of rows) {
    if (!r) continue;
    const first = norm(r[0]);
    if (!title && /exam event/i.test(first)) title = first.replace(/^exam event\s*:\s*/i, "");
    const keys = r.map(lowerKey);
    const iUser = keys.indexOf("username");
    const iMark = keys.indexOf("marksobtained");
    if (iUser >= 0 && iMark >= 0) {
      col = {
        code: keys.indexOf("candidatecode"), name: keys.indexOf("candidatename"),
        user: iUser, mark: iMark, total: keys.indexOf("totalmarks")
      };
      continue;
    }
    if (!col) continue;
    const user = norm(r[col.user]).replace(/\s/g, "");
    const name = col.name >= 0 ? norm(r[col.name]) : "";
    if (!user && !name) continue;
    const rawMark = r[col.mark];
    const mark = rawMark == null || norm(rawMark) === "" ? null : norm(rawMark);
    const total = col.total >= 0 ? norm(r[col.total]) : "";
    const code = col.code >= 0 ? norm(r[col.code]).replace(/\s/g, "") : "";
    out.push({ code, name, user, mark, total });
  }
  return { title, candidates: out, found: !!col };
}

// Merge rows that share the same national ID (User Name).
function dedupeEtest(cands) {
  const byUser = new Map(), list = [], issues = [];
  for (const c of cands) {
    const k = c.user || ("name:" + nameKey(c.name));
    if (!byUser.has(k)) { const e = { ...c, rows: [c] }; byUser.set(k, e); list.push(e); continue; }
    const e = byUser.get(k); e.rows.push(c);
    if (e.name.length < c.name.length) e.name = c.name;
  }
  for (const e of list) {
    if (e.rows.length < 2) continue;
    const marks = [...new Set(e.rows.map(r => r.mark).filter(m => m != null))];
    if (marks.length === 1) { e.mark = marks[0]; issues.push({ kind: "dup-ok", name: e.name, user: e.user, mark: e.mark }); }
    else if (marks.length === 0) { e.mark = null; }
    else { e.mark = null; e.conflict = marks; issues.push({ kind: "dup-conflict", name: e.name, user: e.user, marks }); }
  }
  return { list, issues };
}

function parseGradeSheet(rows, startRow) {
  // startRow: sheet row number (1-based) of rows[0]
  let header = -1, cols = null;
  const students = [];
  rows.forEach((r, i) => {
    if (!r) return;
    const keys = r.map(key);
    if (header < 0) {
      const iCode = keys.indexOf("الكود"), iName = keys.indexOf("الاسم");
      if (iCode >= 0 && iName >= 0) {
        header = i;
        const grade = [];
        r.forEach((h, j) => {
          if (j <= Math.max(iCode, iName)) return;
          const lines = String(h == null ? "" : h).split(/\n/).map(norm).filter(Boolean);
          if (!lines.length) return;
          const label = lines[0];
          if (key(label) === "ملاحظات") return;
          const max = lines.length > 1 && /^\d+(\.\d+)?$/.test(lines[1]) ? Number(lines[1]) : null;
          grade.push({ index: j, label, max });
        });
        cols = { code: iCode, name: iName, grade };
      }
      return;
    }
    const code = norm(r[cols.code]).replace(/\s/g, "");
    const name = norm(r[cols.name]);
    if (!code && !name) return;
    const existing = {};
    for (const g of cols.grade) existing[g.index] = norm(r[g.index]);
    students.push({ rowNum: startRow + i, code, name, existing });
  });
  return { cols, students };
}

// ---------- matching ----------
// rosterMap: Map(studentCode -> nationalId) from an Ibn Al-Haytham roster (optional).
function matchGrades(sheetStudents, etestList, rosterMap) {
  const used = new Set();
  const byUser = new Map(etestList.map(e => [e.user, e]));
  const byKey = new Map();
  for (const e of etestList) {
    const k = nameKey(e.name);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(e);
  }
  const tok = new Map(etestList.map(e => [e, nameTokens(e.name)]));
  const result = sheetStudents.map(s => ({ student: s, match: null, method: null }));

  // pass 1: student code -> national ID via roster; also E-Testing rows whose Candidate Code is the student code
  const byCode = new Map(etestList.filter(e => /^\d{8}$/.test(e.code)).map(e => [e.code, e]));
  for (const r of result) {
    let e = null;
    if (rosterMap && rosterMap.has(r.student.code)) e = byUser.get(rosterMap.get(r.student.code)) || null;
    if (!e && byCode.has(r.student.code)) e = byCode.get(r.student.code);
    if (e && !used.has(e)) { r.match = e; r.method = "id"; used.add(e); }
  }
  // pass 2: exact normalized name, unique
  for (const r of result) {
    if (r.match) continue;
    const hits = (byKey.get(nameKey(r.student.name)) || []).filter(e => !used.has(e));
    if (hits.length === 1) { r.match = hits[0]; r.method = "name"; used.add(hits[0]); }
  }
  // pass 3: truncated-name prefix, unique both ways
  const pending = () => result.filter(r => !r.match);
  const prefixCands = new Map();
  for (const r of pending()) {
    const t = nameTokens(r.student.name);
    prefixCands.set(r, etestList.filter(e => !used.has(e) && isPrefixName(t, tok.get(e))));
  }
  const claim = new Map();
  for (const [r, c] of prefixCands) if (c.length === 1) claim.set(c[0], (claim.get(c[0]) || 0) + 1);
  for (const [r, c] of prefixCands) {
    if (c.length === 1 && claim.get(c[0]) === 1 && !used.has(c[0])) { r.match = c[0]; r.method = "prefix"; used.add(c[0]); }
  }
  // pass 4: fuzzy (spelling differences or truncation), similar first name, clear winner
  for (const r of pending()) {
    const k = nameKey(r.student.name), t0 = nameTokens(r.student.name)[0];
    const scored = etestList.filter(e => !used.has(e) && similarity(t0, tok.get(e)[0] || "") >= 0.75)
      .map(e => ({ e, s: similarity(k, nameKey(e.name)) })).sort((a, b) => b.s - a.s);
    const margin = scored.length < 2 ? 1 : scored[0].s - scored[1].s;
    if (scored.length && ((scored[0].s >= 0.85 && margin >= 0.05) || (scored[0].s >= 0.75 && margin >= 0.2))) {
      r.match = scored[0].e; r.method = "fuzzy"; r.score = scored[0].s; used.add(scored[0].e);
    }
  }
  const unusedEtest = etestList.filter(e => !used.has(e));
  return { result, unusedEtest };
}

// ---------- writing ----------
function colLetter(i) { let s = ""; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
function colIndex(letters) { let n = 0; for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; }

// writes: Map(rowNum -> Map(colIndex -> value string)). Edits the sheet XML in place, keeping everything else.
function applyGradesXml(xml, writes) {
  return xml.replace(/<row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g, (whole, rn, inner) => {
    const w = writes.get(Number(rn));
    if (!w || !w.size) return whole;
    const openTag = whole.slice(0, whole.indexOf(">") + 1);
    const cells = [];
    const re = /<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g;
    let m;
    while ((m = re.exec(inner))) {
      const ref = (m[0].match(/\br="([A-Z]+)\d+"/) || [])[1];
      cells.push({ col: ref ? colIndex(ref) : -1, xml: m[0] });
    }
    for (const [ci, val] of w) {
      const ref = colLetter(ci) + rn;
      const existing = cells.find(c => c.col === ci);
      const sAttr = existing ? (existing.xml.match(/\ss="\d+"/) || [""])[0] : "";
      const cx = `<c r="${ref}"${sAttr} t="str"><v>${xmlEsc(val)}</v></c>`;
      if (existing) existing.xml = cx;
      else {
        const at = cells.findIndex(c => c.col > ci);
        const item = { col: ci, xml: cx };
        if (at < 0) cells.push(item); else cells.splice(at, 0, item);
      }
    }
    return openTag + cells.map(c => c.xml).join("") + "</row>";
  });
}

if (typeof module !== "undefined") module.exports = {
  nameTokens, nameKey, similarity, isPrefixName, parseEtest, dedupeEtest,
  parseGradeSheet, matchGrades, applyGradesXml, colLetter
};
