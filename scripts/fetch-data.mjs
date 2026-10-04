// ดึงผลสลากจากชุดข้อมูลชุมชน แล้วรวมกับไฟล์เดิมใน data/draws.json
// รันด้วย Node 20+:  node scripts/fetch-data.mjs
import { readFile, writeFile, mkdir } from "node:fs/promises";

const SOURCE = "https://raw.githubusercontent.com/ssupawat/thai-lottery-2digit-stats/main/draws.json";
const OUT = "data/draws.json";

const valid = (r) => Array.isArray(r) && /^\d{4}-\d{2}-\d{2}$/.test(r[0]) && /^\d{2}$/.test(String(r[1]).padStart(2, "0"));

async function readExisting() {
  try {
    const j = JSON.parse(await readFile(OUT, "utf8"));
    return Array.isArray(j.draws) ? j.draws : [];
  } catch { return []; }
}

const res = await fetch(SOURCE);
if (!res.ok) throw new Error(`ดึงข้อมูลไม่สำเร็จ: HTTP ${res.status}`);
const remote = (await res.json()).draws;
if (!Array.isArray(remote) || remote.length < 100) throw new Error("ข้อมูลต้นทางผิดรูปแบบหรือน้อยผิดปกติ");

const map = new Map();
for (const r of [...(await readExisting()), ...remote]) {
  if (valid(r)) map.set(r[0], String(r[1]).padStart(2, "0"));
}
const draws = [...map].sort((a, b) => (a[0] < b[0] ? -1 : 1));

await mkdir("data", { recursive: true });
await writeFile(OUT, JSON.stringify({ updatedAt: new Date().toISOString(), source: SOURCE, draws }) + "\n");
console.log(`บันทึก ${draws.length} งวด ล่าสุด ${draws.at(-1)[0]}`);
