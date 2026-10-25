import { describe, expect, it } from "vitest";
import {
  DAY_SCENE_H,
  DEPTH_K0,
  FELT_SIDE,
  RX_TAG_HALF,
  SCENE_PAD_DEFAULT,
  SCENE_PAD_NARROW,
  SEAT_RX_MAX,
  SEAT_RX_MIN,
  TAG_GAP_Y,
  TAG_H,
  DAY_SCENE_W,
  NAME_TAG_MAX_W,
  SEAT_CY_MIN,
  TABLE_FIT_MIN_H,
  dayTableGeometry,
  daySeatLayout,
  feltWidthOf,
  px,
  seatRx,
} from "../../src/game/dayTable";

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
    expect(TABLE_FIT_MIN_H).toBe(299);
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

  it("높이 332 이상은 cy 210, 331 은 209 (맨 앞 이름표 아래 끝 = cy + 122)", () => {
    expect(dayTableGeometry(366, 332).cy).toBe(210);
    expect(dayTableGeometry(366, 331).cy).toBe(209);
  });

  it("높이 320 은 cy 198·면 top 138", () => {
    const g = dayTableGeometry(366, 320);
    expect(g.cy).toBe(198);
    expect(g.felt.top).toBe(138);
  });

  it("높이 299 는 cy 177", () => {
    expect(dayTableGeometry(366, 299).cy).toBe(177);
  });

  it("높이 298 도 cy 177 (최소에서 멈춘다)", () => {
    expect(dayTableGeometry(366, 298).cy).toBe(177);
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

  it("캐릭터·이름표·이모티콘이 같은 (x, y) 에서 나온다 (4~8명 전 자리)", () => {
    const bad: string[] = [];
    for (let n = 4; n <= 8; n++) {
      for (const p of daySeatLayout(seatsOf(n), 0, 366)) {
        const ok =
          p.figLeft === p.x - 36 &&
          p.figTop === p.y - 96 &&
          p.tagLeft === p.x &&
          p.tagTop === p.y &&
          p.z - p.tagZ === 11 &&
          p.emojiLeft === p.x - 16 &&
          p.emojiTop === Math.max(0, p.y - 96 * p.scale - 36);
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

  it("높이 TABLE_FIT_MIN_H(299) 이상이면 모든 이름표 아래 끝(tagTop + 22)이 장면 높이 이하다", () => {
    const out: string[] = [];
    for (const w of [352, 366]) {
      for (const h of heights.filter((v) => v >= TABLE_FIT_MIN_H)) {
        for (let n = 4; n <= 8; n++) {
          for (const p of daySeatLayout(seatsOf(n), 0, w, h, w === 352 ? 4 : 12)) {
            if (p.tagTop + TAG_H > h + 1e-9) out.push(`w${w}h${h}n${n}:seat${p.seat}`);
          }
        }
      }
    }
    expect(out.join(",")).toBe("");
  });

  it("높이 299 미만이면 cy 는 SEAT_CY_MIN(177)에서 멈추고 맨 앞 이름표만 장면 높이를 넘을 수 있다 (받아들인 한계)", () => {
    const out: string[] = [];
    for (const w of [352, 366]) {
      for (const h of [290, 294, 298]) {
        expect(dayTableGeometry(w, h).cy).toBe(SEAT_CY_MIN);
        for (let n = 4; n <= 8; n++) {
          const over = daySeatLayout(seatsOf(n), 0, w, h, w === 352 ? 4 : 12)
            .filter((p) => p.tagTop + TAG_H > h)
            .map((p) => p.slot);
          if (over.length > 0 && over.join(",") !== "0") out.push(`w${w}h${h}n${n}:[${over.join(",")}]`);
        }
      }
    }
    expect(out.join(",")).toBe("");
  });
});

describe("px", () => {
  it("소수 첫째 자리까지 반올림해 px 를 붙인다", () => {
    expect(px(110)).toBe("110px");
    expect(px(110.46)).toBe("110.5px");
    expect(px(0)).toBe("0px");
  });
});
