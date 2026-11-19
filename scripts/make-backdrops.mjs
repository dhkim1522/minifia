// B안 무대 배경을 실제 맵에서 캡처한 뒤 1080×2340 WebP로 변환한다.
// 로컬 개발 서버를 실행하고 npm run backdrops -- http://127.0.0.1:5173
import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const WIDTH = 1080;
const HEIGHT = 2340;
const RENDER_WIDTH = 648;
const RENDER_HEIGHT = 1404;

export const SOURCES = [
  { out: "bg_game_lobby.webp", mapId: "bar", phase: "talk", maxKB: 40 },
  { out: "bg_game_night.webp", mapId: "bar", phase: "night", maxKB: 40 },
  { out: "bg_game_morning.webp", mapId: "plaza", phase: "morning", maxKB: 40 },
  { out: "bg_game_day.webp", mapId: "plaza", phase: "talk", maxKB: 40 },
  { out: "bg_game_dusk.webp", mapId: "plaza", phase: "vote", maxKB: 40 },
  { out: "bg_game_verdict_dusk.webp", mapId: "bar", phase: "trial", maxKB: 40 },
  { out: "bg_entry_lobby.webp", mapId: "bar", phase: "night", maxKB: 52 },
];

function shading(entry) {
  const bottom = entry ? 0.92 : 0.7;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
    <defs><linearGradient id="shade" x2="0" y2="1">
      <stop stop-color="#080c18" stop-opacity=".94"/>
      <stop offset=".22" stop-color="#080c18" stop-opacity=".67"/>
      <stop offset=".43" stop-color="#080c18" stop-opacity=".04"/>
      <stop offset=".62" stop-color="#080c18" stop-opacity=".1"/>
      <stop offset="1" stop-color="#080c18" stop-opacity="${bottom}"/>
    </linearGradient></defs><path d="M0 0H${WIDTH}V${HEIGHT}H0Z" fill="url(#shade)"/>
  </svg>`);
}

export async function renderBackdrops(scene, onlyMap) {
  let total = 0;
  for (const { out, mapId, phase, maxKB } of SOURCES) {
    if (onlyMap && mapId !== onlyMap) continue;
    const entry = out.startsWith("bg_entry");
    const input = await scene({
      mapId,
      phase,
      width: RENDER_WIDTH,
      height: RENDER_HEIGHT,
      x: mapId === "bar" ? 0 : -0.25,
      z: mapId === "bar" ? 0 : -1.4,
      zoom: 1.15,
      offset: entry ? -45 : -15,
    });
    const graded = await sharp(input).resize(WIDTH, HEIGHT).composite([{ input: shading(entry) }]).removeAlpha().png().toBuffer();
    let bytes;
    for (const quality of [86, 79, 72, 65]) {
      bytes = await sharp(graded).webp({ quality, effort: 6 }).toBuffer();
      if (bytes.length <= maxKB * 1024) break;
    }
    if (bytes.length > maxKB * 1024) throw new Error(`${out}: ${bytes.length}B가 ${maxKB}KB를 넘었다.`);
    total += bytes.length;
    await writeFile(root(`public/backgrounds/${out}`), bytes);
    console.log(`${out}: ${(bytes.length / 1024).toFixed(1)}KB / ${maxKB}KB`);
  }
  if (total > 260 * 1024) throw new Error(`배경 합계 ${total}B가 260KB를 넘었다.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const child = spawnSync(process.execPath, [root("scripts/render-noir-assets.mjs"), process.argv[2] ?? "http://127.0.0.1:5173", "--backdrops-only"], {
    stdio: "inherit",
  });
  if (child.error) throw child.error;
  process.exitCode = child.status ?? 1;
}
