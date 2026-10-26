// 장면 그림 6장의 헤더 글씨 대비를 오프라인으로 증명한다 (결정 0030, 사용자 지시 V-06).
// E2E 규칙 H1(scripts/e2e/lib.mjs headerContrastChecks)과 같은 기준: 글씨 구역 안 배경 픽셀 휘도의 95번째 백분위수(p95)에 대해
// gray-50 글자의 WCAG 대비 ≥ 4.5. 막이 있는 장면(지금은 없음)은 HEADER_SCRIM_STOPS 로 합성하고, lobby 의 타이머 구역은
// 역할 확인 화면의 --scrim(60%) 막 아래에서 잰다. 실내 배경은 막 없이도 전 장면이 4.5 이상임을 고정한다.
//
// 구역 좌표(CSS px, 위쪽 기준 cover): 제목 x16~120·y16~45, 타이머 숫자 x(W−69)~(W−16)·y78~100, 대기실 코드 가운데(36px 글씨, y35.6~78.8).
// 그림은 width = W 로 키운다(폰 세로 비율 ≥ 1.78 이라 cover 가 폭 기준이다). 높이는 round(W·2340/1080).
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { HEADER_SCRIM_STOPS, SCENES } from "../../src/game/scenes";
import type { SceneId } from "../../src/game/scenes";
// @ts-expect-error -- 선언 없는 스크립트 모듈
import * as e2eLib from "../../scripts/e2e/lib.mjs";

const { HEADER_CONTRAST_MIN, HEADER_BG_PERCENTILE, relLuminance, percentile } = e2eLib as {
  HEADER_CONTRAST_MIN: number;
  HEADER_BG_PERCENTILE: number;
  relLuminance: (rgb: readonly number[]) => number;
  percentile: (values: number[], p: number) => number;
};

type Rgb = [number, number, number];
const tokens = readFileSync(new URL("../../src/styles/tokens.css", import.meta.url), "utf8");
const hexToken = (name: string): Rgb => {
  const m = new RegExp(`--${name}:\\s*#([0-9a-fA-F]{6})`).exec(tokens);
  if (!m) throw new Error(`토큰 --${name} 를 tokens.css 에서 찾지 못함`);
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const TEXT: Rgb = hexToken("gray-50");
const NIGHT_900: Rgb = hexToken("night-900");
const revealScrim = (() => {
  const m = /--scrim:\s*rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/.exec(tokens);
  if (!m) throw new Error("토큰 --scrim 을 tokens.css 에서 찾지 못함");
  return { color: [Number(m[1]), Number(m[2]), Number(m[3])] as Rgb, alpha: Number(m[4]) };
})();

const WIDTHS = [360, 390, 430] as const;
const GAME_SCENES = ["lobby", "night", "morning", "day", "dusk", "verdictDusk"] as const satisfies readonly SceneId[];
const TOP_ROWS = 200;

interface Zone {
  name: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}
const titleZone = (): Zone => ({ name: "제목", x0: 16, x1: 120, y0: 16, y1: 45 });
const timerZone = (w: number): Zone => ({ name: "타이머", x0: w - 69, x1: w - 16, y0: 78, y1: 100 });
const codeZone = (w: number): Zone => ({ name: "대기실 코드", x0: w / 2 - 75, x1: w / 2 + 75, y0: 35.6, y1: 78.8 });

/** 위에서 y px 지점의 막 알파(HEADER_SCRIM_STOPS 구간 선형). 150px 넘으면 0. */
function scrimAlpha(y: number): number {
  const stops = HEADER_SCRIM_STOPS;
  if (y <= stops[0]![0]) return stops[0]![1];
  for (let i = 1; i < stops.length; i++) {
    const [y1, a1] = stops[i]!;
    const [y0, a0] = stops[i - 1]!;
    if (y <= y1) return a0 + ((a1 - a0) * (y - y0)) / (y1 - y0);
  }
  return 0;
}

type Overlay = "none" | "headerScrim" | "revealScrim";

const rawCache = new Map<string, Promise<{ data: Buffer; width: number; channels: number }>>();
function topRows(scene: SceneId, w: number) {
  const key = `${scene}@${w}`;
  let hit = rawCache.get(key);
  if (!hit) {
    const file = new URL(`../../public/backgrounds/bg_game_${SCENES[scene].file}.webp`, import.meta.url).pathname;
    const h = Math.round((w * 2340) / 1080);
    hit = sharp(file)
      .resize(w, h, { fit: "cover", position: "top" })
      .extract({ left: 0, top: 0, width: w, height: TOP_ROWS })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
      .then((r) => ({ data: r.data, width: r.info.width, channels: r.info.channels }));
    rawCache.set(key, hit);
  }
  return hit;
}

/** 구역 안 모든 픽셀(중심점이 구역 안)을 막과 합성해 p95 휘도를 구하고, gray-50 글자와의 대비를 돌려준다. */
async function contrastOf(scene: SceneId, w: number, zone: Zone, overlay: Overlay): Promise<number> {
  const { data, width, channels } = await topRows(scene, w);
  const lums: number[] = [];
  for (let y = Math.ceil(zone.y0 - 0.5); y + 0.5 <= zone.y1; y++) {
    for (let x = Math.ceil(zone.x0 - 0.5); x + 0.5 <= zone.x1; x++) {
      const i = (y * width + x) * channels;
      let px: Rgb = [data[i]!, data[i + 1]!, data[i + 2]!];
      let a = 0;
      let c: Rgb = NIGHT_900;
      if (overlay === "headerScrim") a = scrimAlpha(y + 0.5);
      else if (overlay === "revealScrim") {
        a = revealScrim.alpha;
        c = revealScrim.color;
      }
      if (a > 0) px = [px[0] * (1 - a) + c[0] * a, px[1] * (1 - a) + c[1] * a, px[2] * (1 - a) + c[2] * a];
      lums.push(relLuminance(px));
    }
  }
  expect(lums.length, `${scene}@${w} ${zone.name} 구역에 픽셀이 없음`).toBeGreaterThan(100);
  const bg = percentile(lums, HEADER_BG_PERCENTILE);
  return (relLuminance(TEXT) + 0.05) / (bg + 0.05);
}

describe("기준 상수", () => {
  it("대비 하한은 4.5, 배경은 p95 로 잰다 (E2E H1 과 같은 값)", () => {
    expect(HEADER_CONTRAST_MIN).toBe(4.5);
    expect(HEADER_BG_PERCENTILE).toBe(0.95);
  });
  it("막 알파 구간 선형 합성은 stops 를 그대로 따른다", () => {
    expect(scrimAlpha(0)).toBeCloseTo(HEADER_SCRIM_STOPS[0]![1]);
    expect(scrimAlpha(60)).toBeCloseTo(HEADER_SCRIM_STOPS[1]![1]);
    expect(scrimAlpha(110)).toBeCloseTo(HEADER_SCRIM_STOPS[2]![1]);
    expect(scrimAlpha(150)).toBe(0);
    expect(scrimAlpha(200)).toBe(0);
  });
});

describe("장면 그림 6장 × 폰 폭 360·390·430 × 헤더 글씨 구역 p95 대비 ≥ 4.5", () => {
  for (const scene of GAME_SCENES) {
    for (const w of WIDTHS) {
      it(`${scene} @${w}: 제목${SCENES[scene].scrim ? "·타이머(헤더 막 합성)" : scene === "lobby" ? "·대기실 코드·타이머(역할 확인 막 합성)" : "·타이머"}`, async () => {
        const overlay: Overlay = SCENES[scene].scrim ? "headerScrim" : "none";
        const title = await contrastOf(scene, w, titleZone(), overlay);
        expect(title, `${scene}@${w} 제목 ${title.toFixed(2)}`).toBeGreaterThanOrEqual(HEADER_CONTRAST_MIN);
        if (scene === "lobby") {
          // 대기실 가운데 코드(막 없음), 역할 확인의 제목·타이머(--scrim 60% 막)
          const code = await contrastOf(scene, w, codeZone(w), "none");
          expect(code, `lobby@${w} 대기실 코드 ${code.toFixed(2)}`).toBeGreaterThanOrEqual(HEADER_CONTRAST_MIN);
          const revealTitle = await contrastOf(scene, w, titleZone(), "revealScrim");
          expect(revealTitle, `lobby@${w} 역할 확인 제목 ${revealTitle.toFixed(2)}`).toBeGreaterThanOrEqual(HEADER_CONTRAST_MIN);
          const revealTimer = await contrastOf(scene, w, timerZone(w), "revealScrim");
          expect(revealTimer, `lobby@${w} 역할 확인 타이머 ${revealTimer.toFixed(2)}`).toBeGreaterThanOrEqual(HEADER_CONTRAST_MIN);
          return;
        }
        const timer = await contrastOf(scene, w, timerZone(w), overlay);
        expect(timer, `${scene}@${w} 타이머 ${timer.toFixed(2)}`).toBeGreaterThanOrEqual(HEADER_CONTRAST_MIN);
      }, 30_000);
    }
  }
});

describe("막이 필요하다는 사실을 고정한다", () => {
  it("실내 배경(v4)은 막 없이도 모든 장면·폭에서 제목과 타이머가 4.5 이상이다 (막을 쓰지 않는다)", async () => {
    for (const scene of GAME_SCENES) {
      for (const w of WIDTHS) {
        const title = await contrastOf(scene, w, titleZone(), "none");
        const timer = await contrastOf(scene, w, timerZone(w), "none");
        expect(title, `${scene}@${w} 제목 ${title.toFixed(2)}`).toBeGreaterThanOrEqual(HEADER_CONTRAST_MIN);
        expect(timer, `${scene}@${w} 타이머 ${timer.toFixed(2)}`).toBeGreaterThanOrEqual(HEADER_CONTRAST_MIN);
      }
    }
  }, 60_000);
});

describe("막이 필요한 장면은 SCENES.scrim 과 일치한다", () => {
  it("막이 없는 장면(night)은 세 폭 모두 막 없이 4.5 이상, 막이 있는 장면은 어느 폭에선가 막 없이 4.5 미만이다", async () => {
    for (const scene of GAME_SCENES) {
      if (scene === "lobby") continue;
      const bares: number[] = [];
      for (const w of WIDTHS) bares.push(await contrastOf(scene, w, timerZone(w), "none"));
      if (SCENES[scene].scrim) expect(Math.min(...bares), scene).toBeLessThan(HEADER_CONTRAST_MIN);
      else for (const b of bares) expect(b, scene).toBeGreaterThanOrEqual(HEADER_CONTRAST_MIN);
    }
  }, 30_000);
});
