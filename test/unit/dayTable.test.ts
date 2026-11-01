import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BUBBLE_H,
  BUBBLE_TAIL,
  BUBBLE_TOP,
  BUBBLE_W,
  DAY_SCENE_H,
  DEPTH_K0,
  FELT_SIDE,
  FIG_H,
  FIG_W,
  HALO_BLUR_PX,
  HALO_CORE_BLUR_PX,
  HALO_MAX_SIMULTANEOUS,
  RX_TAG_HALF,
  SCENE_PAD_DEFAULT,
  SCENE_PAD_NARROW,
  SEAT_RX_MAX,
  SEAT_RX_MIN,
  TAG_BOX_H,
  TAG_GAP_Y,
  TAG_H,
  DAY_SCENE_W,
  NAME_TAG_MAX_W,
  SEAT_CY_MIN,
  TABLE_FIT_MIN_H,
  TABLE_FULL_H,
  TABLE_FIT_MIN_SCALE,
  TABLE_FIT_SPAN,
  dayTableGeometry,
  daySeatLayout,
  feltWidthOf,
  px,
  seatRx,
  tableFitScale,
  testButtonCompact,
} from "../../src/game/dayTable";
import { candidateCenter } from "../../src/game/verdict";

// 고정 테이블 배치(결정 0017-1, 0028). 기하는 승인 시안 P2(design/screens/table-v1/SPEC.md)로 고정한다.
const seatsOf = (n: number): { seat: number }[] => Array.from({ length: n }, (_, i) => ({ seat: i }));
const r1 = (v: number): number => Math.round(v * 10) / 10;

describe("상수", () => {
  it("시안 기준 값을 그대로 둔다", () => {
    expect(DAY_SCENE_W).toBe(366);
    expect(DAY_SCENE_H).toBe(407);
    expect(SEAT_RX_MIN).toBe(124);
    expect(SEAT_RX_MAX).toBe(150);
    expect(RX_TAG_HALF).toBe(49);
    expect(FELT_SIDE).toBe(38);
    expect(SCENE_PAD_DEFAULT).toBe(12);
    expect(SCENE_PAD_NARROW).toBe(4);
    expect(SEAT_CY_MIN).toBe(177);
    expect(TABLE_FULL_H).toBe(336); // 승인 기하(cy 210)가 쓰이는 최소 장면 높이
    expect(TABLE_FIT_MIN_H).toBe(303); // 07-20: 이름표 상자 26 기준(SEAT_CY_MIN 177 + ry 100 + 26). 이전 299 는 이름표 22 기준이라 299~336 에서 4px 넘쳤다
    expect(NAME_TAG_MAX_W).toBe(100);
    expect(TAG_GAP_Y).toBe(0);
    expect(TAG_H).toBe(22);
    expect(DEPTH_K0).toBe(0.8);
  });
});

// 실제 폰 장면 네 가지(장면 폭 = 폰 폭 − 2·여백): 360(여백 4)·375(여백 4)·390(여백 12)·430(여백 12)
const SCENES = [
  { phone: 360, w: 352, h: 363.8, pad: 4, rx: 131, felt: 186, left: 83 },
  { phone: 375, w: 367, h: 390.8, pad: 4, rx: 138, felt: 200, left: 83.5 },
  { phone: 390, w: 366, h: 387.8, pad: 12, rx: 146, felt: 216, left: 75 },
  { phone: 430, w: 406, h: 655.8, pad: 12, rx: 150, felt: 224, left: 91 },
] as const;

describe("dayTableGeometry: 인원과 상관없이 하나로 고정 (P2 승인값)", () => {
  it.each(SCENES)("폰 $phone: 장면 $w×$h(여백 $pad) → rx $rx·면 폭 $felt·면 left $left", (sc) => {
    const g = dayTableGeometry(sc.w, sc.h, sc.pad);
    expect(g.cx).toBe(sc.w / 2);
    expect(g.rx).toBe(sc.rx);
    expect(g.felt.width).toBe(sc.felt);
    expect(g.felt.left).toBe(sc.left);
    expect(seatRx(sc.w, sc.pad)).toBe(sc.rx);
    expect(feltWidthOf(sc.rx)).toBe(sc.felt);
  });

  it("390폭(장면 366, 여백 12)은 승인값 그대로: 면 216×108·위 150, cy 210·rx 146·ry 100", () => {
    const g = dayTableGeometry(366, 407, 12);
    expect(g.felt).toEqual({ left: 75, top: 150, width: 216, height: 108 });
    expect([g.cy, g.rx, g.ry]).toEqual([210, 146, 100]);
  });

  it("여백을 안 주면 12 로 본다", () => {
    expect(dayTableGeometry(366, 407).rx).toBe(146);
    expect(seatRx(366)).toBe(146);
  });

  it("클램프: 장면 폭 300(여백 4)은 rx 124, 700(여백 12)은 rx 150", () => {
    expect(seatRx(300, 4)).toBe(124);
    expect(seatRx(700, 12)).toBe(150);
    expect(dayTableGeometry(300, 380, 4).felt.width).toBe(2 * (124 - 38));
    expect(dayTableGeometry(700, 380, 12).felt.width).toBe(2 * (150 - 38));
  });
});

describe("dayTableGeometry: 세로 규칙은 그대로", () => {
  it.each([
    ["366×407", dayTableGeometry(366, 407)],
    ["352×383", dayTableGeometry(352, 383)],
    ["366×높이 생략", dayTableGeometry(366)],
  ])("시안 높이 %s 는 cy 210·ry 100·면 top 150·height 108 — SPEC 과 같다", (_name, g) => {
    expect(g.cy).toBe(210);
    expect(g.ry).toBe(100);
    expect(g.felt.top).toBe(150);
    expect(g.felt.height).toBe(108);
  });

  it("높이 336 이상은 cy 210, 335 는 209 (맨 앞 이름표 상자 아래 끝 = cy + 126, 07-20 이름표 상자 26 기준)", () => {
    expect(dayTableGeometry(366, 336).cy).toBe(210);
    expect(dayTableGeometry(366, 335).cy).toBe(209);
    expect(dayTableGeometry(366, 332.8).cy).toBeCloseTo(206.8, 9); // 360×640 채팅 패널 하단(332.8): 이름표 상자 아래 끝이 장면 아래와 맞는다
  });

  it("높이 320 은 cy 194·면 top 134", () => {
    const g = dayTableGeometry(366, 320);
    expect(g.cy).toBe(194);
    expect(g.felt.top).toBe(134);
  });

  it("높이 303 은 cy 177", () => {
    expect(dayTableGeometry(366, 303).cy).toBe(177);
  });

  it("높이 299 미만은 같은 배율로 압축한다(P5-3): 298 은 177 이 아니라 cy ≈ 173.7·fit < 1 (이름표 상자 26 기준)", () => {
    const g = dayTableGeometry(366, 298);
    expect(g.fit).toBeLessThan(1);
    expect(g.cy).toBeLessThan(177);
    expect(g.cy).toBeGreaterThan(173);
    expect(g.cy + g.ry + TAG_BOX_H).toBeCloseTo(298, 9);
  });

  it("높이 460 은 cy 210 (최대에서 멈춘다)", () => {
    expect(dayTableGeometry(366, 460).cy).toBe(210);
  });
});

describe("daySeatLayout: 시계 방향 좌석 원", () => {
  it.each([352, 366])("나(slot 0)는 맨 아래 가운데: x = W/2, y = 310, scale 1, z 22 (폭 %i)", (w) => {
    const me = daySeatLayout(seatsOf(5), 0, w).find((p) => p.slot === 0);
    expect(me?.seat).toBe(0);
    expect(r1(me?.x ?? -1)).toBe(w / 2);
    expect(r1(me?.y ?? -1)).toBe(310);
    expect(me?.scale).toBe(1);
    expect(me?.z).toBe(22);
  });

  it("4명·폭 366: 아래 → 왼쪽 → 위 → 오른쪽(시계 방향)", () => {
    const line = daySeatLayout(seatsOf(4), 0, 366)
      .map((p) => `${r1(p.x)},${r1(p.y)}`)
      .join(" ");
    expect(line).toBe("183,310 37,210 183,110 329,210");
  });

  it("맨 위 자리는 scale 0.8·z 12 이다(짝수 인원)", () => {
    for (const n of [4, 6, 8]) {
      const top = daySeatLayout(seatsOf(n), 0, 366).find((p) => p.slot === n / 2);
      expect(top?.scale).toBeCloseTo(0.8, 9);
      expect(top?.z).toBe(12);
    }
  });

  it("캐릭터·이름표가 같은 (x, y) 에서 나온다 (이모티콘 좌표는 없다) (4~8명 전 자리)", () => {
    const bad: string[] = [];
    for (let n = 4; n <= 8; n++) {
      for (const p of daySeatLayout(seatsOf(n), 0, 366)) {
        const ok =
          p.figLeft === p.x - 36 &&
          p.figTop === p.y - 96 &&
          p.tagLeft === p.x &&
          p.tagTop === p.y &&
          p.z - p.tagZ === 11 &&
          !("emojiLeft" in p) &&
          !("emojiTop" in p);
        if (!ok) bad.push(`n${n}:seat${p.seat}`);
      }
    }
    expect(bad.join(",")).toBe("");
  });

  it("층 순서: 캐릭터 z 12~22·이름표 tagZ 1~11 정수, 모든 이름표가 모든 캐릭터 아래 (4~8명)", () => {
    const bad: string[] = [];
    for (let n = 4; n <= 8; n++) {
      for (const w of [352, 366, 406]) {
        const places = daySeatLayout(seatsOf(n), 0, w);
        for (const p of places) {
          if (!Number.isInteger(p.z) || p.z < 12 || p.z > 22) bad.push(`z:n${n}:seat${p.seat}=${p.z}`);
          if (!Number.isInteger(p.tagZ) || p.tagZ < 1 || p.tagZ > 11) bad.push(`tagZ:n${n}:seat${p.seat}=${p.tagZ}`);
        }
        if (Math.max(...places.map((p) => p.tagZ)) >= Math.min(...places.map((p) => p.z))) bad.push(`order:n${n}w${w}`);
      }
    }
    expect(bad.join(",")).toBe("");
  });

  it("가까운(깊이가 큰) 자리의 이름표가 먼 자리의 이름표 위(tagZ 이상)다", () => {
    const bad: string[] = [];
    for (let n = 4; n <= 8; n++) {
      const places = daySeatLayout(seatsOf(n), 0, 366);
      for (const a of places) {
        for (const b of places) {
          if (a.depth > b.depth && a.tagZ < b.tagZ) bad.push(`n${n}:${a.seat}>${b.seat}`);
        }
      }
    }
    expect(bad.join(",")).toBe("");
  });

  it("자리 번호에 빈칸이 있어도 어느 폰에서나 시계 방향 자리 번호 순서가 같은 회전이다", () => {
    const list = [0, 2, 3, 5, 7];
    const seats = list.map((seat) => ({ seat }));
    for (const my of list) {
      const order = daySeatLayout(seats, my, 366)
        .slice()
        .sort((a, b) => a.slot - b.slot)
        .map((p) => p.seat);
      const start = list.indexOf(my);
      const expected = [...list.slice(start), ...list.slice(0, start)];
      expect(order.join(",")).toBe(expected.join(","));
    }
  });

  it("mySeat 이 목록에 없으면 첫 자리를 slot 0 으로 본다", () => {
    const seats = [{ seat: 2 }, { seat: 4 }, { seat: 6 }, { seat: 7 }];
    const layout = daySeatLayout(seats, 5, 366);
    expect(layout.find((p) => p.slot === 0)?.seat).toBe(2);
  });

  it("4~8명이면 자리 n개를 돌려준다", () => {
    const counts = [4, 5, 6, 7, 8].map((n) => daySeatLayout(seatsOf(n), 0, 366).length);
    expect(counts.join(",")).toBe("4,5,6,7,8");
  });

  it("결과는 자리 번호 오름차순으로 나온다", () => {
    const layout = daySeatLayout([{ seat: 6 }, { seat: 1 }, { seat: 3 }], 3, 366);
    expect(layout.map((p) => p.seat).join(",")).toBe("1,3,6");
  });
});

// ---- 자동 배치 검사 ----
interface Box {
  l: number;
  r: number;
  t: number;
  b: number;
}
const tagBox = (p: { tagLeft: number; tagTop: number }, w: number = NAME_TAG_MAX_W): Box => ({
  l: p.tagLeft - w / 2,
  r: p.tagLeft + w / 2,
  t: p.tagTop,
  b: p.tagTop + TAG_H,
});
/** 겹침이 가로·세로 모두 eps 보다 크면 겹침(변이 맞닿거나 eps 이하로 겹친 것은 겹침이 아니다 — E2E OVERLAP_EPS 와 같은 뜻) */
const overlapsBy = (a: Box, b: Box, eps: number): boolean =>
  Math.min(a.r, b.r) - Math.max(a.l, b.l) > eps && Math.min(a.b, b.b) - Math.max(a.t, b.t) > eps;
/** 캐릭터 상자: 발 (x, y) 에서 아래 가운데 기준으로 scale 만큼 줄어든 72×96 */
const figBox = (p: { x: number; y: number; scale: number }): Box => ({
  l: p.x - 36 * p.scale,
  r: p.x + 36 * p.scale,
  t: p.y - 96 * p.scale,
  b: p.y,
});
/** 발 줄이 테이블 면 세로 범위에 드는 캐릭터의 가로 간격(타원 현 기준). 범위 밖이면 null. 간격은 현에서 캐릭터 상자까지 */
function feltGap(p: { x: number; y: number; scale: number }, g: ReturnType<typeof dayTableGeometry>): number | null {
  const mid = g.felt.top + g.felt.height / 2;
  const t = (p.y - mid) / (g.felt.height / 2);
  if (Math.abs(t) > 1) return null;
  const half = (g.felt.width / 2) * Math.sqrt(1 - t * t);
  const box = figBox(p);
  return p.x < g.cx ? g.cx - half - box.r : box.l - (g.cx + half);
}

/** 장면 폭 구간: 폰 폭 = 장면 폭 + 2·여백 이 CSS 의 389px 경계와 맞는 모든 정수 폭 (여백 4 쪽은 폰 348~389, 여백 12 쪽은 폰 390~430) */
const WIDTH_RUNS: readonly { pad: number; from: number; to: number }[] = [
  { pad: 4, from: 340, to: 381 },
  { pad: 12, from: 366, to: 406 },
];
const HEIGHTS = [299.8, 363.8, 387.8, 655.8];

describe("자동 배치 검사: 가로 (이름표 상한 NAME_TAG_MAX_W 100)", () => {
  it("실제 폰 네 가지 × 4~8명: 99px 이름표 상자가 폰 가장자리 안이다 (허용 −0.5, E2E G2·D2 와 같은 기준)", () => {
    // 4·8명판의 양옆 자리 5글자(99px) 이름표는 장면 상자 밖(최대 −13)으로 나가지만 폰 가장자리 안이다. 이름표 여유 49 가 칼날 경계(−0.5).
    const out: string[] = [];
    for (const sc of SCENES) {
      for (let n = 4; n <= 8; n++) {
        for (const p of daySeatLayout(seatsOf(n), 0, sc.w, sc.h, sc.pad)) {
          const b = tagBox(p, 99);
          if (b.l + sc.pad < -0.5 - 1e-6 || b.r + sc.pad > sc.w + 2 * sc.pad + 0.5 + 1e-6) out.push(`${sc.phone}n${n}:seat${p.seat}`);
        }
      }
    }
    expect(out.join(",")).toBe("");
  });

  it("같은 검사를 두 구간의 모든 정수 폭 × 1~8명에서", () => {
    const out: string[] = [];
    for (const { pad, from, to } of WIDTH_RUNS) {
      for (let w = from; w <= to; w++) {
        for (let n = 1; n <= 8; n++) {
          for (const p of daySeatLayout(seatsOf(n), 0, w, 400, pad)) {
            const b = tagBox(p, 99);
            if (b.l + pad < -0.5 - 1e-6 || b.r + pad > w + 2 * pad + 0.5 + 1e-6) out.push(`p${pad}w${w}n${n}:seat${p.seat}`);
          }
        }
      }
    }
    expect(out.join(",")).toBe("");
  });

  it("모든 정수 폭 × 4~8명에서 100px 이름표 상자끼리 겹치지 않는다 (0.5px 허용, D9)", () => {
    const pairs: string[] = [];
    for (const { pad, from, to } of WIDTH_RUNS) {
      for (let w = from; w <= to; w++) {
        for (let n = 1; n <= 8; n++) {
          const places = daySeatLayout(seatsOf(n), 0, w, 400, pad);
          for (let i = 0; i < places.length; i++) {
            for (let j = i + 1; j < places.length; j++) {
              if (overlapsBy(tagBox(places[i]!), tagBox(places[j]!), 0.5)) pairs.push(`p${pad}w${w}n${n}:${i}-${j}`);
            }
          }
        }
      }
    }
    expect(pairs.join(",")).toBe("");
  });

  it("모든 캐릭터 상자(72×scale)가 장면 안이다: 네 폰 × 네 높이 × 1~8명", () => {
    const out: string[] = [];
    for (const sc of SCENES) {
      for (const h of HEIGHTS) {
        for (let n = 1; n <= 8; n++) {
          for (const p of daySeatLayout(seatsOf(n), 0, sc.w, h, sc.pad)) {
            const b = figBox(p);
            if (b.l < 0 || b.r > sc.w || b.t < -1e-9 || b.b > h) out.push(`${sc.phone}h${h}n${n}:seat${p.seat}`);
          }
        }
      }
    }
    expect(out.join(",")).toBe("");
  });

  it("양옆 캐릭터는 발 줄에서 테이블 면과 4px 이상 떨어진다 (계산 최소 6.2): 네 폰 × 네 높이 × 1~8명", () => {
    const out: string[] = [];
    let min = Infinity;
    for (const sc of SCENES) {
      for (const h of HEIGHTS) {
        const g = dayTableGeometry(sc.w, h, sc.pad);
        for (let n = 1; n <= 8; n++) {
          for (const p of daySeatLayout(seatsOf(n), 0, sc.w, h, sc.pad)) {
            const gap = feltGap(p, g);
            if (gap === null) continue;
            min = Math.min(min, gap);
            if (gap < 4) out.push(`${sc.phone}h${h}n${n}:seat${p.seat}=${r1(gap)}`);
          }
        }
      }
    }
    expect(out.join(",")).toBe("");
    // 계획 산술 표(4·8명판 6.2~6.3, 7명판 7.4 이상)와 같은 숫자
    expect(r1(min)).toBeGreaterThanOrEqual(6.2);
    expect(r1(min)).toBeLessThanOrEqual(6.3);
  });

  it("모든 정수 폭에서도 간격 ≥ 4", () => {
    const out: string[] = [];
    for (const { pad, from, to } of WIDTH_RUNS) {
      for (let w = from; w <= to; w++) {
        const g = dayTableGeometry(w, 400, pad);
        for (let n = 1; n <= 8; n++) {
          for (const p of daySeatLayout(seatsOf(n), 0, w, 400, pad)) {
            const gap = feltGap(p, g);
            if (gap !== null && gap < 4) out.push(`p${pad}w${w}n${n}:seat${p.seat}=${r1(gap)}`);
          }
        }
      }
    }
    expect(out.join(",")).toBe("");
  });

  it("산술 표: 장면 안 최소 여백 — 360 12.6 · 375 13.1 · 390 4.6 · 430 20.6", () => {
    const want: Record<number, number> = { 360: 12.6, 375: 13.1, 390: 4.6, 430: 20.6 };
    for (const sc of SCENES) {
      let min = Infinity;
      for (let n = 1; n <= 8; n++) {
        for (const p of daySeatLayout(seatsOf(n), 0, sc.w, sc.h, sc.pad)) {
          const b = figBox(p);
          min = Math.min(min, b.l, sc.w - b.r);
        }
      }
      expect(r1(min)).toBe(want[sc.phone]);
    }
  });

  it("산술 표: 99px 이름표의 폰 가장자리 여유 — 360 −0.5 · 375 0.0 · 390 −0.5 · 430 15.5 (4·8명판)", () => {
    const want: Record<number, number> = { 360: -0.5, 375: 0, 390: -0.5, 430: 15.5 };
    for (const sc of SCENES) {
      let min = Infinity;
      for (const n of [4, 8]) {
        for (const p of daySeatLayout(seatsOf(n), 0, sc.w, sc.h, sc.pad)) {
          const b = tagBox(p, 99);
          min = Math.min(min, b.l + sc.pad, sc.w + 2 * sc.pad - (b.r + sc.pad));
        }
      }
      expect(r1(min)).toBe(want[sc.phone]);
    }
  });

  it("맨 아래 이름표의 아래 끝(y + 0 + 22 = 332)은 360×640 장면 높이 363.8 안이다", () => {
    const me = daySeatLayout(seatsOf(8), 0, 352, 363.8, 4).find((p) => p.slot === 0)!;
    expect(r1(me.tagTop + TAG_H)).toBe(332);
    expect(me.tagTop + TAG_H <= 363.8).toBe(true);
  });

  it.each(SCENES)("보장 크기 폰 $phone: 1~8명 맨 앞 이름표 아래 끝이 장면 안, cy 210", (sc) => {
    expect(dayTableGeometry(sc.w, sc.h, sc.pad).cy).toBe(210);
    for (let n = 1; n <= 8; n++) {
      for (const p of daySeatLayout(seatsOf(n), 0, sc.w, sc.h, sc.pad)) {
        expect(p.tagTop + TAG_H).toBeLessThanOrEqual(sc.h);
      }
    }
  });
});

describe("원 위의 자리 배치", () => {
  it("1~8명: 내 자리는 맨 아래 가운데, 자리 사이 각도는 모두 2π/n", () => {
    for (let n = 1; n <= 8; n++) {
      const g = dayTableGeometry(366, 407, 12);
      const places = daySeatLayout(seatsOf(n), 0, 366, 407, 12).sort((a, b) => a.slot - b.slot);
      expect(r1(places[0]!.x)).toBe(g.cx);
      expect(r1(places[0]!.y)).toBe(g.cy + g.ry);
      const ang = places.map((p) => Math.atan2((p.y - g.cy) / g.ry, (p.x - g.cx) / g.rx));
      for (let i = 0; i < n; i++) {
        const next = ang[(i + 1) % n]!;
        let d = next - ang[i]!;
        d = ((d % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        if (n > 1) expect(d).toBeCloseTo((2 * Math.PI) / n, 9);
      }
    }
  });

  it("2명은 마주 본다(맨 아래와 맨 위), 3명은 한 직선이 아니다(삼각)", () => {
    const g = dayTableGeometry(366, 407, 12);
    const two = daySeatLayout(seatsOf(2), 0, 366, 407, 12).sort((a, b) => a.slot - b.slot);
    expect(r1(two[1]!.x)).toBe(g.cx);
    expect(r1(two[1]!.y)).toBe(g.cy - g.ry);
    const [a, b, c] = daySeatLayout(seatsOf(3), 0, 366, 407, 12);
    const cross = (b!.x - a!.x) * (c!.y - a!.y) - (b!.y - a!.y) * (c!.x - a!.x);
    expect(Math.abs(cross)).toBeGreaterThan(1000);
  });
});

describe("자동 배치 검사: 세로 (장면 높이 299~460)", () => {
  const heights = Array.from({ length: 162 }, (_, i) => 299 + i);

  it("4~8명, 폭 352·366, 높이 299~460 의 모든 정수 높이에서 머리 위(y − 96·scale)가 0 이상이다", () => {
    const out: string[] = [];
    for (const w of [352, 366]) {
      for (const h of heights) {
        for (let n = 4; n <= 8; n++) {
          for (const p of daySeatLayout(seatsOf(n), 0, w, h, w === 352 ? 4 : 12)) {
            if (p.y - 96 * p.scale < -1e-9) out.push(`w${w}h${h}n${n}:seat${p.seat}`);
          }
        }
      }
    }
    expect(out.join(",")).toBe("");
  });

  it("높이 TABLE_FIT_MIN_H(303) 이상이면 모든 이름표 상자 아래 끝(tagTop + 26)이 장면 높이 이하다 (07-20: 실제 DOM 상자 26 기준)", () => {
    const out: string[] = [];
    for (const w of [352, 366]) {
      for (const h of heights.filter((v) => v >= TABLE_FIT_MIN_H)) {
        for (let n = 4; n <= 8; n++) {
          for (const p of daySeatLayout(seatsOf(n), 0, w, h, w === 352 ? 4 : 12)) {
            if (p.tagTop + TAG_BOX_H > h + 1e-9) out.push(`w${w}h${h}n${n}:seat${p.seat}`);
          }
        }
      }
    }
    expect(out.join(",")).toBe("");
  });

});

// ---- 짧은 장면 압축 (P5-3, UI-SPEC 11.3a, 05-04) ----
// 장면 높이 TABLE_FIT_MIN_H(303) 이상의 기하는 참조 식 그대로여야 한다. 참조 구현을 시험 안에 둔다.
// below = 맨 앞 이름표 아래 끝까지의 거리: 07-20 에 122(이름표 22 기준)에서 126(실제 상자 26 기준)으로 고쳤다. 승인 기하(cy 210)가 쓰이는 336 이상은 두 값이 같다.
const refGeometry = (sceneW: number, sceneH: number, pad: number, below = 126) => {
  const rx = seatRx(sceneW, pad);
  const feltW = feltWidthOf(rx);
  const cy = Math.max(177, Math.min(210, sceneH - below));
  return { cx: sceneW / 2, cy, rx, ry: 100, felt: { left: (sceneW - feltW) / 2, top: cy - 60, width: feltW, height: 108 } };
};
const refLayout = (n: number, sceneW: number, sceneH: number, pad: number, below = 126) => {
  const { cx, cy, rx, ry } = refGeometry(sceneW, sceneH, pad, below);
  return Array.from({ length: n }, (_, slot) => {
    const theta = Math.PI / 2 + (slot / n) * Math.PI * 2;
    const depth = (Math.sin(theta) + 1) / 2;
    const scale = 0.8 + (1 - 0.8) * depth;
    const x = cx + rx * Math.cos(theta);
    const y = cy + ry * Math.sin(theta);
    return {
      seat: slot, slot, x, y, depth, scale,
      z: 12 + Math.round(depth * 10),
      figLeft: x - 36, figTop: y - 96,
      tagLeft: x, tagTop: y, tagZ: 1 + Math.round(depth * 10),
    };
  });
};
const FIT_RUNS = [
  { w: 352, pad: 4 },
  { w: 366, pad: 12 },
  { w: 367, pad: 4 },
  { w: 406, pad: 12 },
] as const;

describe("짧은 장면 압축 (P5-3): 상수와 배율", () => {
  it("이름표 상자 높이 26(실제 DOM: 알약 22 + 줄 상자 4), 하한 0.77, 분모 276.8(= 2·100 + 96·0.8)", () => {
    expect(TAG_BOX_H).toBe(26);
    expect(TABLE_FIT_MIN_SCALE).toBe(0.77);
    expect(TABLE_FIT_SPAN).toBeCloseTo(276.8, 9);
  });

  it("tableFitScale: 303 이상 1, 270 → 0.8815, 240 → 0.7731, 200 → 하한", () => {
    expect(tableFitScale(303)).toBe(1);
    expect(tableFitScale(655.8)).toBe(1);
    expect(tableFitScale(270)).toBeCloseTo((270 - 26) / 276.8, 9);
    expect(tableFitScale(270)).toBeCloseTo(0.8815, 3);
    expect(tableFitScale(240)).toBeCloseTo(0.7731, 3);
    expect(tableFitScale(240)).toBeGreaterThan(TABLE_FIT_MIN_SCALE);
    expect(tableFitScale(200)).toBe(TABLE_FIT_MIN_SCALE);
  });

  it("0·음수·NaN·Infinity 장면 높이에서도 유한한 값이다 (T-05-09)", () => {
    for (const h of [0, -50, Number.NaN, Number.POSITIVE_INFINITY]) {
      const f = tableFitScale(h);
      expect(Number.isFinite(f), `fit ${h}`).toBe(true);
      expect(f).toBeGreaterThanOrEqual(TABLE_FIT_MIN_SCALE);
      const g = dayTableGeometry(352, h, 4);
      for (const v of [g.cx, g.cy, g.rx, g.ry, g.fit, g.felt.left, g.felt.top, g.felt.width, g.felt.height]) expect(Number.isFinite(v), `geo ${h}`).toBe(true);
      for (const p of daySeatLayout(seatsOf(8), 0, 352, h, 4)) {
        for (const v of [p.x, p.y, p.scale, p.tagTop, p.figTop]) expect(Number.isFinite(v), `layout ${h}`).toBe(true);
        expect(p.scale).toBeGreaterThan(0);
      }
    }
  });
});

describe("짧은 장면 압축 (P5-3): 303 이상은 f = 1, 승인 기하(336 이상)는 한 값도 안 바뀐다", () => {
  it("높이 303~700 정수 × 폭 4종 × 4~8명: 기하·배치 모든 필드가 참조 식(이름표 상자 26 기준)과 같다", () => {
    const out: string[] = [];
    for (const { w, pad } of FIT_RUNS) {
      for (let h = 303; h <= 700; h++) {
        const g = dayTableGeometry(w, h, pad);
        const r = refGeometry(w, h, pad);
        if (g.fit !== 1) out.push(`fit w${w}h${h}`);
        if (JSON.stringify({ cx: g.cx, cy: g.cy, rx: g.rx, ry: g.ry, felt: g.felt }) !== JSON.stringify(r)) out.push(`geo w${w}h${h}`);
        for (let n = 4; n <= 8; n++) {
          const got = daySeatLayout(seatsOf(n), 0, w, h, pad);
          const want = refLayout(n, w, h, pad);
          for (let i = 0; i < n; i++) {
            if (JSON.stringify(got[i]) !== JSON.stringify(want.find((q) => q.slot === got[i]!.slot))) out.push(`lay w${w}h${h}n${n}:${i}`);
          }
        }
      }
    }
    expect(out.slice(0, 10).join(",")).toBe("");
  });
});

describe("짧은 장면 압축 (P5-3): 승인 기하는 336 이상에서 07-20 이전(이름표 22 기준 122)과 같다", () => {
  it("높이 336~700 정수 × 폭 4종 × 4~8명: 이전 식(below 122)과 모든 필드가 같다 — 336 미만만 바뀌었다", () => {
    const out: string[] = [];
    for (const { w, pad } of FIT_RUNS) {
      for (let h = 336; h <= 700; h++) {
        for (let n = 4; n <= 8; n++) {
          const got = daySeatLayout(seatsOf(n), 0, w, h, pad);
          const old = refLayout(n, w, h, pad, 122);
          for (let i = 0; i < n; i++) {
            if (JSON.stringify(got[i]) !== JSON.stringify(old.find((q) => q.slot === got[i]!.slot))) out.push(`lay w${w}h${h}n${n}:${i}`);
          }
        }
      }
    }
    expect(out.slice(0, 10).join(",")).toBe("");
  });
});

describe("짧은 장면 압축 (P5-3): 장면 높이 240~303 미만", () => {
  it("모든 정수 높이 × 폭 4종 × 4~8명: 맨 앞 이름표 상자(26) 아래끝 ≤ 장면 높이, 머리 위 ≥ 0, 이름표 겹침 없음, 면 top ≥ 0", () => {
    const out: string[] = [];
    for (const { w, pad } of FIT_RUNS) {
      for (let h = 240; h < 303; h++) {
        const g = dayTableGeometry(w, h, pad);
        if (g.felt.top < -1e-9) out.push(`felt w${w}h${h}`);
        for (let n = 4; n <= 8; n++) {
          const places = daySeatLayout(seatsOf(n), 0, w, h, pad);
          for (const p of places) {
            if (p.tagTop + TAG_BOX_H > h + 1e-9) out.push(`tag w${w}h${h}n${n}:${p.seat}`);
            if (p.y - FIG_H * p.scale < -1e-9) out.push(`head w${w}h${h}n${n}:${p.seat}`);
          }
          for (let i = 0; i < places.length; i++) {
            for (let j = i + 1; j < places.length; j++) {
              if (overlapsBy(tagBox(places[i]!), tagBox(places[j]!), 0.5)) out.push(`overlap w${w}h${h}n${n}:${i}-${j}`);
            }
          }
        }
      }
    }
    expect(out.slice(0, 10).join(",")).toBe("");
  });

  it("좌석 원 세로 반지름·캐릭터 배율·면 높이는 같은 배율 f 로 줄고, 가로 반지름·면 폭·이름표 높이는 그대로다", () => {
    const full = dayTableGeometry(352, 400, 4);
    const g = dayTableGeometry(352, 260, 4);
    const f = tableFitScale(260);
    expect(f).toBeLessThan(1);
    expect(g.fit).toBe(f);
    expect(g.ry).toBeCloseTo(100 * f, 9);
    expect(g.felt.height).toBeCloseTo(108 * f, 9);
    expect(g.felt.top).toBeCloseTo(g.cy - 60 * f, 9);
    expect(g.rx).toBe(full.rx);
    expect(g.felt.width).toBe(full.felt.width);
    expect(g.felt.left).toBe(full.felt.left);
    const places = daySeatLayout(seatsOf(6), 0, 352, 260, 4);
    const me = places.find((p) => p.slot === 0)!;
    expect(me.scale).toBeCloseTo(1 * f, 9);
    expect(me.tagTop - me.y).toBe(0);
    const rear = daySeatLayout(seatsOf(4), 0, 352, 260, 4).find((p) => p.slot === 2)!;
    expect(rear.scale).toBeCloseTo(0.8 * f, 9);
  });

  it("높이 303 경계: f = 1 식(cy 177)과 압축 식(상자 26 기준)이 이어진다 — 07-20 이전의 약 2.6px 불연속이 없다", () => {
    expect(dayTableGeometry(366, 303).cy).toBe(177);
    const gap = Math.abs(177 - dayTableGeometry(366, 302.99).cy);
    expect(gap).toBeLessThan(0.1);
  });
});

describe("짧은 장면 압축 (P5-3): 장면 높이 240 미만(지원 하한 아래)", () => {
  it("배율은 TABLE_FIT_MIN_SCALE 에서 멈추고 맨 뒤 머리 위가 장면 안에 남는다", () => {
    const out: string[] = [];
    for (const { w, pad } of FIT_RUNS) {
      for (const h of [239, 236, 204.8, 200, 160.8, 120, 60, 0]) {
        const g = dayTableGeometry(w, h, pad);
        if (h <= 238 && g.fit !== TABLE_FIT_MIN_SCALE) out.push(`fit w${w}h${h}`);
        for (let n = 4; n <= 8; n++) {
          for (const p of daySeatLayout(seatsOf(n), 0, w, h, pad)) {
            if (p.y - FIG_H * p.scale < -1e-9) out.push(`head w${w}h${h}n${n}:${p.seat}`);
          }
        }
      }
    }
    expect(out.join(",")).toBe("");
  });

  it("후보 가운데 자리의 이름표 아래끝(발 y + 8 + 26) ≤ 장면 아래 − 4 (E2E P5)", () => {
    for (const { w, pad } of FIT_RUNS) {
      for (const h of [236, 204.8, 160.8]) {
        const cc = candidateCenter(w, h, pad);
        expect(cc.footY + 8 + 26, `w${w}h${h}`).toBeLessThanOrEqual(h - 4 + 1e-9);
      }
    }
  });

  it("rx·면 폭·이름표 높이는 높이와 무관하다", () => {
    for (const { w, pad } of FIT_RUNS) {
      const base = dayTableGeometry(w, 400, pad);
      for (const h of [0, 160.8, 204.8, 240, 270]) {
        const g = dayTableGeometry(w, h, pad);
        expect(g.rx).toBe(base.rx);
        expect(g.felt.width).toBe(base.felt.width);
      }
    }
  });
});


describe("px", () => {
  it("소수 첫째 자리까지 반올림해 px 를 붙인다", () => {
    expect(px(110)).toBe("110px");
    expect(px(110.46)).toBe("110.5px");
    expect(px(0)).toBe("0px");
  });
});

// ---- quick 261025-unr 과제 1: 후광(드롭섀도)·'…' 말풍선 산술 (결정 0030) ----
const FOUR_SCENES = [
  { w: 352, h: 387.8, pad: 4 },
  { w: 367, h: 387.8, pad: 4 },
  { w: 366, h: 387.8, pad: 12 },
  { w: 406, h: 387.8, pad: 12 },
] as const;

describe("후광·말풍선 상수 (결정 0030)", () => {
  it("후광 번짐 안쪽 2px·바깥 9px, 한 화면 최대 3개, 말풍선 48×26·꼬리 5·위 26", () => {
    expect(HALO_CORE_BLUR_PX).toBe(2);
    expect(HALO_BLUR_PX).toBe(9);
    expect(HALO_MAX_SIMULTANEOUS).toBe(3);
    expect(BUBBLE_W).toBe(48);
    expect(BUBBLE_H).toBe(26);
    expect(BUBBLE_TAIL).toBe(5);
    expect(BUBBLE_TOP).toBe(26);
    // 말풍선 폭 = 좌우 11×2 + 점 6×3 + 간격 4×2
    expect(BUBBLE_W).toBe(11 * 2 + 6 * 3 + 4 * 2);
  });
});

describe("후광 번짐: 장면 안에 든다 (캐릭터 상자 + 9px × 배율)", () => {
  it.each(FOUR_SCENES)("폭 $w(여백 $pad): 1~8명 번짐 상자의 좌우가 폰 가장자리 안, 위가 장면 안(높이 387.8)", (sc) => {
    for (let n = 1; n <= 8; n++) {
      for (const p of daySeatLayout(seatsOf(n), 0, sc.w, sc.h, sc.pad)) {
        const half = (FIG_W * p.scale) / 2 + HALO_BLUR_PX * p.scale;
        expect(p.x - half, `${sc.w}/${n}명/자리 ${p.seat} 왼쪽`).toBeGreaterThanOrEqual(-sc.pad);
        expect(p.x + half, `${sc.w}/${n}명/자리 ${p.seat} 오른쪽`).toBeLessThanOrEqual(sc.w + sc.pad);
        const top = p.y - (FIG_H + HALO_BLUR_PX) * p.scale;
        expect(top, `${sc.w}/${n}명/자리 ${p.seat} 위`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it.each(FOUR_SCENES)("폭 $w: 가장 낮은 f = 1 장면 높이(303.8)에서도 번짐이 장면 위로 16px(헤더 아래 안쪽 여백)를 넘지 않는다", (sc) => {
    for (let n = 1; n <= 8; n++) {
      for (const p of daySeatLayout(seatsOf(n), 0, sc.w, 303.8, sc.pad)) {
        const top = p.y - (FIG_H + HALO_BLUR_PX) * p.scale;
        expect(top, `${sc.w}/${n}명/자리 ${p.seat}`).toBeGreaterThanOrEqual(-16);
      }
    }
  });
});

describe("후광 알파: 이름표 글자를 가리지 않는다", () => {
  // 가우시안 블러 후광: σ = 반지름/2, 윤곽에서 d 만큼 떨어진 곳의 알파 = 계수 × 0.5 × erfc(d / (σ√2))
  // (Abramowitz-Stegun 7.1.26 근사)
  const erfc = (x: number): number => {
    const t = 1 / (1 + 0.3275911 * Math.abs(x));
    const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return x >= 0 ? 1 - y : 1 + y;
  };
  const layerAlpha = (d: number, radius: number, coef: number): number => coef * 0.5 * erfc(d / ((radius / 2) * Math.SQRT2));
  /** 흰 후광(안쪽 2px 95% + 바깥 9px 75%)이 윤곽에서 d 만큼 떨어진 곳에 두는 합성 알파 */
  const haloAlpha = (d: number): number =>
    1 - (1 - layerAlpha(d, HALO_CORE_BLUR_PX, 0.95)) * (1 - layerAlpha(d, HALO_BLUR_PX, 0.75));
  const tokens = readFileSync("src/styles/tokens.css", "utf8");
  const hexOf = (name: string): [number, number, number] => {
    const m = new RegExp(`--${name}:\\s*#([0-9a-fA-F]{6})`).exec(tokens);
    if (!m) throw new Error(`토큰 --${name} 없음`);
    const v = parseInt(m[1]!, 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  };
  const lum = ([r, g, b]: [number, number, number]): number => {
    const f = (c: number): number => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const contrast = (a: [number, number, number], b: [number, number, number]): number => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
    return (hi + 0.05) / (lo + 0.05);
  };

  it("윤곽에서 4px 에 알파 ≤ 0.15, 9px 에 ≤ 0.02 (보이는 번짐은 9px 이하)", () => {
    expect(haloAlpha(4)).toBeLessThanOrEqual(0.15);
    expect(haloAlpha(9)).toBeLessThanOrEqual(0.02);
    expect(haloAlpha(2)).toBeGreaterThan(haloAlpha(4));
  });

  it("그 알파를 night-900 이름표 면에 흰(gray-50) 후광으로 겹쳐도 gray-50 글자의 대비가 9:1 이상이다", () => {
    const night = hexOf("night-900");
    const white = hexOf("gray-50");
    for (const d of [4, 9]) {
      const a = haloAlpha(d);
      const face = night.map((c, i) => c * (1 - a) + white[i]! * a) as [number, number, number];
      expect(contrast(white, face), `d=${d}px`).toBeGreaterThanOrEqual(9);
    }
  });
});

describe("말풍선 기하: 이웃 얼굴을 덮지 않고 장면 안에 든다 (위 −26px)", () => {
  // 말풍선은 자리 상자 안(상자 위 BUBBLE_TOP)에 있고 상자와 함께 배율 k 로 줄어든다. 몸통은 상자 위 [26, 0]·가운데 폭 48,
  // 꼬리(폭 10·높이 5)는 상자 위 면 아래로 5. 얼굴 = 이웃 상자의 위 45%.
  // 시안(f12.css)은 위 −30px 이지만 8명판 자리 1·7 의 말풍선이 이웃 얼굴을 4.1px 덮어 −26 으로 정했다.
  type Box = { x0: number; x1: number; y0: number; y1: number };
  const overlap = (a: Box, b: Box): number => {
    const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
    const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
    return w > 0 && h > 0 ? Math.min(w, h) : 0;
  };
  const bubbleBoxes = (p: { x: number; y: number; scale: number }, top: number): Box[] => {
    const k = p.scale;
    const faceTop = p.y - FIG_H * k;
    return [
      { x0: p.x - (BUBBLE_W / 2) * k, x1: p.x + (BUBBLE_W / 2) * k, y0: faceTop - top * k, y1: faceTop },
      { x0: p.x - BUBBLE_TAIL * k, x1: p.x + BUBBLE_TAIL * k, y0: faceTop, y1: faceTop + BUBBLE_TAIL * k },
    ];
  };
  const faceBox = (p: { x: number; y: number; scale: number }): Box => ({
    x0: p.x - (FIG_W / 2) * p.scale,
    x1: p.x + (FIG_W / 2) * p.scale,
    y0: p.y - FIG_H * p.scale,
    y1: p.y - FIG_H * p.scale + 0.45 * FIG_H * p.scale,
  });
  const fullBox = (p: { x: number; y: number; scale: number }): Box => ({
    x0: p.x - (FIG_W / 2) * p.scale,
    x1: p.x + (FIG_W / 2) * p.scale,
    y0: p.y - FIG_H * p.scale,
    y1: p.y,
  });
  const worstFace = (n: number, sc: { w: number; h: number; pad: number }, top: number): number => {
    const places = daySeatLayout(seatsOf(n), 0, sc.w, sc.h, sc.pad);
    let worst = 0;
    for (const a of places) for (const b of places) if (a !== b) for (const box of bubbleBoxes(a, top)) worst = Math.max(worst, overlap(box, faceBox(b)));
    return worst;
  };

  it("BUBBLE_TOP 26: 4~8명 × 네 장면 폭에서 말풍선(꼬리 포함)과 이웃 얼굴의 겹침이 0.5px 이하", () => {
    for (const sc of FOUR_SCENES) for (let n = 4; n <= 8; n++) expect(worstFace(n, sc, BUBBLE_TOP), `${sc.w}/${n}명`).toBeLessThanOrEqual(0.5);
  });

  it("시안의 −30 이면 8명판이 이웃 얼굴을 약 4.1px 덮는다(그래서 −26 이다)", () => {
    expect(worstFace(8, FOUR_SCENES[2], 30)).toBeGreaterThan(4);
    expect(worstFace(8, FOUR_SCENES[2], 30)).toBeLessThan(4.2);
  });

  it("자기보다 z 가 높은 이웃의 상자에 말풍선이 가려지지 않는다", () => {
    for (const sc of FOUR_SCENES) {
      for (let n = 4; n <= 8; n++) {
        const places = daySeatLayout(seatsOf(n), 0, sc.w, sc.h, sc.pad);
        for (const a of places) {
          for (const b of places) {
            if (a === b || b.z <= a.z) continue;
            for (const box of bubbleBoxes(a, BUBBLE_TOP)) expect(overlap(box, fullBox(b)), `${sc.w}/${n}명 ${a.seat}←${b.seat}`).toBeLessThanOrEqual(0.5);
          }
        }
      }
    }
  });

  it("말풍선 가로가 장면 안이고, 장면 높이 387.8 에서 맨 위가 0 이상이다", () => {
    for (const sc of FOUR_SCENES) {
      for (let n = 4; n <= 8; n++) {
        for (const p of daySeatLayout(seatsOf(n), 0, sc.w, sc.h, sc.pad)) {
          const [body] = bubbleBoxes(p, BUBBLE_TOP) as [Box];
          expect(body.x0, `${sc.w}/${n}명/자리 ${p.seat}`).toBeGreaterThanOrEqual(0);
          expect(body.x1, `${sc.w}/${n}명/자리 ${p.seat}`).toBeLessThanOrEqual(sc.w);
          expect(body.y0, `${sc.w}/${n}명/자리 ${p.seat}`).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});

describe("testButtonCompact: 테이블이 위로 올라가는 짧은 장면(높이 336 미만)에서만 [테스트] 버튼을 좁힌다 (05-06, 07-20 기준 336)", () => {
  it("TABLE_FULL_H(336) 미만의 양수 높이는 좁힌다 (압축 구간 303 미만과 올림 구간 303~336 모두)", () => {
    expect([283.8, 240, 302.9, 303, 332.8, 335.9, 1].map((h) => testButtonCompact(h))).toEqual([true, true, true, true, true, true, true]);
  });
  it("TABLE_FULL_H 이상은 좁히지 않는다 (긴 화면은 지금과 같다)", () => {
    expect([336, 336.1, 363.8, 387.8, 407, 655.8].map((h) => testButtonCompact(h))).toEqual([false, false, false, false, false, false]);
  });
  it("재지 못한 값(0·음수·NaN·Infinity)은 좁히지 않는다", () => {
    expect([0, -5, Number.NaN, Number.POSITIVE_INFINITY].map((h) => testButtonCompact(h))).toEqual([false, false, false, false]);
  });
});
