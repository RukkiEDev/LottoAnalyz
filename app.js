"use strict";

// ---- ตั้งค่า ----
const WINDOW_SIZE = 100;   // จำนวนงวดย้อนหลัง
const MAX_PICKS = 12;      // แสดงสูงสุด
const DECAY = 30;          // ยิ่งน้อย ยิ่งให้น้ำหนักงวดล่าสุดมาก
const DATA_URLS = [
  "data/draws.json",
  // สำรอง: ใช้เมื่อยังไม่มีไฟล์ data/draws.json ใน repo
  "https://raw.githubusercontent.com/ssupawat/thai-lottery-2digit-stats/main/draws.json"
];

const $ = (id) => document.getElementById(id);
const fmtDate = (iso) =>
  new Date(iso + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });

function todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function loadDraws() {
  let lastErr;
  for (const url of DATA_URLS) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = await res.json();
      const rows = Array.isArray(json) ? json : json.draws;
      const draws = rows
        .map(([date, last2]) => ({ date, num: String(last2).padStart(2, "0") }))
        .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date) && /^\d{2}$/.test(d.num));
      if (draws.length) return draws;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("ไม่พบข้อมูล");
}

function analyze(draws) {
  // เอาเฉพาะงวดที่ออกแล้ว ณ วันที่กด เรียงใหม่ -> เก่า แล้วตัด 100 งวด
  const today = todayISO();
  const win = draws.filter((d) => d.date <= today)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, WINDOW_SIZE);

  const stat = {};
  for (let n = 0; n < 100; n++) {
    stat[String(n).padStart(2, "0")] = { num: String(n).padStart(2, "0"), freq: 0, w: 0, last: null, ago: null };
  }
  win.forEach((d, i) => {
    const s = stat[d.num];
    s.freq += 1;
    s.w += Math.exp(-i / DECAY);
    if (s.last === null) { s.last = d.date; s.ago = i; }
  });

  const all = Object.values(stat);
  const maxF = Math.max(...all.map((s) => s.freq)) || 1;
  const maxW = Math.max(...all.map((s) => s.w)) || 1;
  all.forEach((s) => { s.score = 0.5 * (s.freq / maxF) + 0.5 * (s.w / maxW); });

  const mean = all.reduce((a, s) => a + s.score, 0) / all.length;
  const sd = Math.sqrt(all.reduce((a, s) => a + (s.score - mean) ** 2, 0) / all.length);
  const threshold = mean + 0.5 * sd;

  // ตัดสินเมื่อคะแนนเท่ากัน: ออกล่าสุดกว่าก่อน แล้วเลขน้อยก่อน
  all.sort((a, b) =>
    b.score - a.score ||
    (a.ago ?? 1e9) - (b.ago ?? 1e9) ||
    a.num.localeCompare(b.num));

  let picks = all.filter((s) => s.score > threshold).slice(0, MAX_PICKS);
  if (picks.length === 0) picks = all.slice(0, 1);
  return { win, picks };
}

function render({ win, picks }) {
  $("summary").textContent =
    `วิเคราะห์ ${win.length} งวด (${fmtDate(win[win.length - 1].date)} – ${fmtDate(win[0].date)}) ` +
    `พบเลขเด่น ${picks.length} หมายเลข`;
  const ol = $("picks");
  ol.replaceChildren();
  picks.forEach((s) => {
    const li = document.createElement("li");
    li.className = "pick";
    const num = document.createElement("div");
    num.className = "num";
    num.textContent = s.num;
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = s.freq
      ? `ออก ${s.freq} ครั้ง · ล่าสุด ${s.ago === 0 ? "งวดล่าสุด" : s.ago + " งวดก่อน"}`
      : "ไม่เคยออกในช่วงนี้";
    li.append(num, meta);
    ol.append(li);
  });
  $("result").hidden = false;
}

$("run").addEventListener("click", async () => {
  const btn = $("run"), status = $("status");
  btn.disabled = true;
  status.className = "";
  status.textContent = "กำลังโหลดข้อมูล…";
  $("result").hidden = true;
  try {
    const draws = await loadDraws();
    const out = analyze(draws);
    if (out.win.length === 0) throw new Error("ไม่มีข้อมูลงวดที่ออกแล้ว");
    render(out);
    status.textContent = out.win.length < WINDOW_SIZE
      ? `มีข้อมูลเพียง ${out.win.length} งวด (น้อยกว่า ${WINDOW_SIZE})`
      : "";
  } catch (e) {
    status.className = "error";
    status.textContent = "โหลดข้อมูลไม่สำเร็จ: " + e.message;
  } finally {
    btn.disabled = false;
  }
});
