// 배경 그림 변환기: design/backgrounds/v5 원본(실내 V2, PNG) + v3 입구 그림 → public/backgrounds/*.webp (결정 0030~0033).
//
// - 리사이즈 없음: 원본 1080×2340 그대로.
// - 품질 86, effort 6(q75 는 어두운 면의 시계탑 윤곽이 뭉개진다). 같은 원본이면 같은 바이트가 나온다.
// - 장면 하나가 상한(maxKB)을 넘으면 비정상 종료한다. 합계 상한은 test/unit/scenes.test.ts 가 지킨다.
// - 원본은 읽기만 한다. 새 장면은 src/game/scenes.ts 의 SCENES 에 먼저 등록한다.
//
// 사용법: npm run backdrops   (원본이 바뀌면 다시 돌린다)
import { mkdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));

const QUALITY = 86;
const EFFORT = 6;
const OUT_DIR = "public/backgrounds";

/** 출력 이름 · 원본 경로(저장소 기준) · 품질 · 상한(KB, 1024바이트). 예산: game 40KB · entry 52KB, 합계 260KB. */
export const SOURCES = [
  { out: "bg_game_lobby.webp", src: "design/backgrounds/v5/bg_game_night.png", quality: QUALITY, maxKB: 40 },
  { out: "bg_game_night.webp", src: "design/backgrounds/v5/bg_game_night.png", quality: QUALITY, maxKB: 40 },
  { out: "bg_game_morning.webp", src: "design/backgrounds/v5/bg_game_morning.png", quality: QUALITY, maxKB: 40 },
  { out: "bg_game_day.webp", src: "design/backgrounds/v5/bg_game_day.png", quality: QUALITY, maxKB: 40 },
  { out: "bg_game_dusk.webp", src: "design/backgrounds/v5/bg_game_dusk.png", quality: QUALITY, maxKB: 40 },
  { out: "bg_game_verdict_dusk.webp", src: "design/backgrounds/v5/bg_game_verdict_dusk.png", quality: QUALITY, maxKB: 40 },
  { out: "bg_entry_lobby.webp", src: "design/backgrounds/v3/bg_entry_lobby.png", quality: QUALITY, maxKB: 52 },
];

async function convertAll() {
  const { default: sharp } = await import("sharp");
  mkdirSync(root(OUT_DIR), { recursive: true });
  const rows = [];
  let total = 0;
  let over = 0;
  for (const s of SOURCES) {
    const dest = root(`${OUT_DIR}/${s.out}`);
    await sharp(root(s.src)).webp({ quality: s.quality, effort: EFFORT }).toFile(dest);
    const kb = statSync(dest).size / 1024;
    total += kb;
    const ok = kb <= s.maxKB;
    if (!ok) over += 1;
    rows.push(`${s.out.padEnd(28)} ${kb.toFixed(1).padStart(6)}KB / ${String(s.maxKB).padStart(2)}KB ${ok ? "ok" : "초과"}`);
  }
  console.log(rows.join("\n"));
  console.log(`합계 ${total.toFixed(1)}KB`);
  if (over > 0) {
    console.error(`상한을 넘은 그림 ${over}개`);
    process.exit(1);
  }
}

// 직접 실행했을 때만 변환한다(테스트가 SOURCES 만 가져다 쓸 수 있게).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await convertAll();
}
