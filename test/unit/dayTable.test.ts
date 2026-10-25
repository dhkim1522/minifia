import { describe, expect, it } from "vitest";
import {
  DAY_SCENE_H,
  DEPTH_K0,
  TAG_GAP_Y,
  TAG_H,
  DAY_SCENE_W,
  NAME_TAG_MAX_W,
  NARROW_SCENE_BELOW,
  SEAT_CY_MIN,
  TABLE_FIT_MIN_H,
  dayTableGeometry,
  daySeatLayout,
  px,
} from "../../src/game/dayTable";

// 낮 화면 고정 테이블 배치(결정 0017-1). 공식은 승인 시안 9차(design/screens/day-v3/SPEC.md).
const seatsOf = (n: number): { seat: number }[] => Array.from({ length: n }, (_, i) => ({ seat: i }));
const r1 = (v: number): number => Math.round(v * 10) / 10;

describe("상수", () => {
  it("시안 기준 값을 그대로 둔다", () => {
    expect(DAY_SCENE_W).toBe(366);
    expect(DAY_SCENE_H).toBe(407);
    expect(NARROW_SCENE_BELOW).toBe(366);
    expect(SEAT_CY_MIN).toBe(177);
    expect(TABLE_FIT_MIN_H).toBe(299);
    expect(NAME_TAG_MAX_W).toBe(100);
    expect(TAG_GAP_Y).toBe(0);
    expect(TAG_H).toBe(22);
    expect(DEPTH_K0).toBe(0.8);
  });
});

describe("dayTableGeometry: 인원과 상관없이 하나로 고정", () => {
  it("폭 366·높이 407 은 cx 183·rx 132·테이블 면 left 43·width 280", () => {
    const g = dayTableGeometry(366, 407);
    expect(g.cx).toBe(183);
    expect(g.rx).toBe(132);
    expect(g.felt.left).toBe(43);
    expect(g.felt.width).toBe(280);
  });

  it("폭 352·높이 383 은 cx 176·rx 124·left 44·width 264", () => {
    const g = dayTableGeometry(352, 383);
    expect(g.cx).toBe(176);
    expect(g.rx).toBe(124);
    expect(g.felt.left).toBe(44);
    expect(g.felt.width).toBe(264);
  });

  it("폭 406 은 rx 132·left 63", () => {
    const g = dayTableGeometry(406, 407);
    expect(g.rx).toBe(132);
    expect(g.felt.left).toBe(63);
  });

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

  it("폭 352·366·406 의 rx·felt 폭은 예전과 같다", () => {
    expect([352, 366, 406].map((w) => dayTableGeometry(w).rx).join(",")).toBe("124,132,132");
    expect([352, 366, 406].map((w) => dayTableGeometry(w).felt.width).join(",")).toBe("264,280,280");
  });
});

describe("daySeatLayout: 시계 방향 좌석 원", () => {
  it.each([352, 366])("나(slot 0)는 맨 아래 가운데: x = W/2, y = 310, scale 1, z 10 (폭 %i)", (w) => {
    const me = daySeatLayout(seatsOf(5), 0, w).find((p) => p.slot === 0);
    expect(me?.seat).toBe(0);
    expect(r1(me?.x ?? -1)).toBe(w / 2);
    expect(r1(me?.y ?? -1)).toBe(310);
    expect(me?.scale).toBe(1);
    expect(me?.z).toBe(10);
  });

  it("4명·폭 366: 아래 → 왼쪽 → 위 → 오른쪽(시계 방향)", () => {
    const line = daySeatLayout(seatsOf(4), 0, 366)
      .map((p) => `${r1(p.x)},${r1(p.y)}`)
      .join(" ");
    expect(line).toBe("183,310 51,210 183,110 315,210");
  });

  it("맨 위 자리는 scale 0.8·z 0 이다(짝수 인원)", () => {
    for (const n of [4, 6, 8]) {
      const top = daySeatLayout(seatsOf(n), 0, 366).find((p) => p.slot === n / 2);
      expect(top?.scale).toBeCloseTo(0.8, 9);
      expect(top?.z).toBe(0);
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

// ---- 자동 배치 검사(호출자 지시) ----
interface Box {
  l: number;
  r: number;
  t: number;
  b: number;
}
const tagBox = (p: { tagLeft: number; tagTop: number }): Box => ({
  l: p.tagLeft - NAME_TAG_MAX_W / 2,
  r: p.tagLeft + NAME_TAG_MAX_W / 2,
  t: p.tagTop,
  b: p.tagTop + TAG_H,
});
const overlap = (a: Box, b: Box): boolean => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;

describe("자동 배치 검사: 가로 (이름표 상한 NAME_TAG_MAX_W 100)", () => {
  it.each([352, 366])("4~8명, 폭 %i 에서 모든 이름표 상자가 장면 가로 안이다", (w) => {
    const out: string[] = [];
    for (let n = 4; n <= 8; n++) {
      for (const p of daySeatLayout(seatsOf(n), 0, w)) {
        const b = tagBox(p);
        if (b.l < 0 || b.r > w) out.push(`n${n}:seat${p.seat}[${r1(b.l)},${r1(b.r)}]`);
      }
    }
    expect(out.join(",")).toBe("");
  });

  it("같은 검사를 폭 352~406 의 모든 정수 폭에서", () => {
    const out: string[] = [];
    for (let w = 352; w <= 406; w++) {
      for (let n = 4; n <= 8; n++) {
        for (const p of daySeatLayout(seatsOf(n), 0, w)) {
          const b = tagBox(p);
          if (b.l < 0 || b.r > w) out.push(`w${w}n${n}:seat${p.seat}`);
        }
      }
    }
    expect(out.join(",")).toBe("");
  });

  it("4~8명 × 장면 폭 352~406 모든 정수 폭에서 이름표 상자끼리 겹치지 않는다 (0.5px 허용, D9)", () => {
    const pairs: string[] = [];
    for (let w = 352; w <= 406; w++) {
      for (let n = 4; n <= 8; n++) {
        const places = daySeatLayout(seatsOf(n), 0, w);
        for (let i = 0; i < places.length; i++) {
          for (let j = i + 1; j < places.length; j++) {
            const a = tagBox(places[i]!);
            const b = tagBox(places[j]!);
            const shrink = (x: Box): Box => ({ l: x.l + 0.5, r: x.r - 0.5, t: x.t + 0.5, b: x.b - 0.5 });
            if (overlap(shrink(a), shrink(b))) pairs.push(`w${w}n${n}:${i}-${j}`);
          }
        }
      }
    }
    expect(pairs.join(",")).toBe("");
  });

  it("맨 왼쪽 이름표 왼쪽 ≥ 1.0, 맨 오른쪽 이름표 오른쪽 ≤ 장면 폭 (D2)", () => {
    const out: string[] = [];
    for (let w = 352; w <= 406; w++) {
      for (let n = 4; n <= 8; n++) {
        const boxes = daySeatLayout(seatsOf(n), 0, w).map(tagBox);
        if (Math.min(...boxes.map((b) => b.l)) < 1.0) out.push(`L w${w}n${n}`);
        if (Math.max(...boxes.map((b) => b.r)) > w) out.push(`R w${w}n${n}`);
      }
    }
    expect(out.join(",")).toBe("");
  });

  it("맨 아래 이름표의 아래 끝(y + 0 + 22 = 332)은 360×640 장면 높이 363.8 안이다", () => {
    const me = daySeatLayout(seatsOf(8), 0, 352, 363.8).find((p) => p.slot === 0)!;
    expect(r1(me.tagTop + TAG_H)).toBe(332);
    expect(me.tagTop + TAG_H <= 363.8).toBe(true);
  });

  it.each([
    [352, 363.8],
    [366, 387.8],
    [406, 655.8],
  ])("보장 크기 %i×%f: 5·8명 맨 앞 이름표 아래 끝이 장면 안, cy 210", (w, h) => {
    expect(dayTableGeometry(w, h).cy).toBe(210);
    for (const n of [5, 8]) {
      for (const p of daySeatLayout(seatsOf(n), 0, w, h)) {
        expect(p.tagTop + TAG_H).toBeLessThanOrEqual(h);
      }
    }
  });
});

describe("자동 배치 검사: 세로 (장면 높이 299~460)", () => {
  const heights = Array.from({ length: 162 }, (_, i) => 299 + i);

  it("4~8명, 폭 352·366, 높이 299~460 의 모든 정수 높이에서 머리 위(y − 96·scale)가 0 이상이다", () => {
    const out: string[] = [];
    for (const w of [352, 366]) {
      for (const h of heights) {
        for (let n = 4; n <= 8; n++) {
          for (const p of daySeatLayout(seatsOf(n), 0, w, h)) {
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
          for (const p of daySeatLayout(seatsOf(n), 0, w, h)) {
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
      for (const h of [250, 280, 298]) {
        expect(dayTableGeometry(w, h).cy).toBe(SEAT_CY_MIN);
        for (let n = 4; n <= 8; n++) {
          const over = daySeatLayout(seatsOf(n), 0, w, h)
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
