// 24-04: "의심" 포스트잇 3D 에셋 — 종이 키트(공유 지오메트리·주입식 텍스처 굽기·좌석별 재질 캐시)와 가리지 않음 대조 (결정 0089-11, 24 D-11·D-28).
// WebGL·canvas 없이 node 에서 three 객체와 가짜 2D 기록기로 시험한다(픽셀 시험 아님).
import { Mesh, type MeshStandardMaterial, Object3D, type Texture, Vector3 } from "three";
import { describe, expect, it, vi } from "vitest";
import { CHAR_SCALE } from "../../src/world/character";
import { PX_PER_UNIT } from "../../src/world/camera";
import { NOTE_COLORS, SEAT_COLORS } from "../../src/world/palette";
import { coatRadius, createNoteKit, NOTE_CENTER, NOTE_LIFT, NOTE_QUAD, NOTE_ROLL_DEG, NOTE_SIZE, NOTE_STACK_STEP, type Note2D, type NoteBakeEnv, noteBoxes, noteTint } from "../../src/world/postit";

// ---------- 가짜 2D 기록기 ----------

interface Rec {
  calls: string[];
  fontAtText: string[];
  texts: string[];
  props: { shadowBlur: number[] };
}
function fakeCtx(): { ctx: Note2D; rec: Rec } {
  const rec: Rec = { calls: [], fontAtText: [], texts: [], props: { shadowBlur: [] } };
  const log = (name: string) => () => {
    rec.calls.push(name);
  };
  const ctx = {
    fillStyle: "" as unknown,
    strokeStyle: "" as unknown,
    lineWidth: 1,
    lineCap: "butt",
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
    shadowColor: "",
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    globalAlpha: 1,
    set shadowBlur(v: number) {
      rec.props.shadowBlur.push(v);
    },
    save: log("save"),
    restore: log("restore"),
    translate: log("translate"),
    rotate: log("rotate"),
    clearRect: log("clearRect"),
    beginPath: log("beginPath"),
    moveTo: log("moveTo"),
    lineTo: log("lineTo"),
    quadraticCurveTo: log("quadraticCurveTo"),
    closePath: log("closePath"),
    fill: log("fill"),
    stroke: log("stroke"),
    createLinearGradient: () => ({ addColorStop: log("addColorStop") }),
    fillText(text: string) {
      rec.calls.push("fillText");
      rec.texts.push(text);
      rec.fontAtText.push(this.font);
    },
  };
  return { ctx: ctx as unknown as Note2D, rec };
}
function env(opts: { canvas?: boolean; font?: boolean | "reject" } = {}): { env: NoteBakeEnv; rec: Rec; fontCalls: () => number } {
  const { ctx, rec } = fakeCtx();
  let fontCalls = 0;
  return {
    rec,
    fontCalls: () => fontCalls,
    env: {
      makeCanvas: (w, h) => (opts.canvas === false ? null : { canvas: { width: w, height: h }, ctx }),
      loadFont: () => {
        fontCalls++;
        return opts.font === "reject" ? Promise.reject(new Error("font")) : Promise.resolve(opts.font !== false);
      },
    },
  };
}

// ---------- 좌석 색 ----------

const hex2 = (n: number): string => Math.round(n).toString(16).padStart(2, "0");
function expectedTint(seat: number): string {
  const p = (h: string, i: number): number => Number.parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16);
  const c = (i: number): string => hex2(p(SEAT_COLORS[seat], i) * 0.45 + p(NOTE_COLORS.paper, i) * 0.55);
  return `#${c(0)}${c(1)}${c(2)}`;
}

describe("종이 틴트 (P24-10)", () => {
  it("좌석 색 45% + 종이 바탕(gray-50) 55% 섞임", () => {
    for (let s = 0; s < 8; s++) expect(noteTint(s)).toBe(expectedTint(s));
  });
  it("좌석 번호는 0~7 로 감싼다(범위 밖 값도 터지지 않는다)", () => {
    expect(noteTint(8)).toBe(noteTint(0));
    expect(noteTint(-1)).toBe(noteTint(7));
  });
});

// ---------- 지오메트리 ----------

describe("종이 지오메트리 (P24-11·P24-12)", () => {
  const { env: e } = env();
  const kit = createNoteKit(e);
  const pos = kit.geometry.getAttribute("position");
  /** 지오메트리는 종이 중심 점을 원점으로 한 국소 좌표다. 놓을 때(층 0, roll 0)의 몸 좌표로 돌려 본다 */
  function bodyPoints(): { x: number; y: number; z: number }[] {
    const o = new Object3D();
    const yaw = -Math.asin(NOTE_CENTER.x / (coatRadius(NOTE_CENTER.y) + 0.012));
    const r = coatRadius(NOTE_CENTER.y) + 0.012;
    o.position.set(r * Math.sin(yaw), NOTE_CENTER.y, r * Math.cos(yaw));
    o.rotation.y = yaw;
    o.updateMatrixWorld(true);
    const out: { x: number; y: number; z: number }[] = [];
    for (let i = 0; i < pos.count; i++) {
      const v = { x: pos.getX(i), y: pos.getY(i), z: pos.getZ(i) };
      const w = o.localToWorld(new Vector3(v.x, v.y, v.z));
      out.push({ x: w.x, y: w.y, z: w.z });
    }
    return out;
  }

  it("지오메트리는 하나이고 7×7 정점 격자다(안쪽 종이 모서리가 격자선 위에 있다)", () => {
    expect(pos.count).toBe(49);
    const uv = kit.geometry.getAttribute("uv");
    expect(uv.count).toBe(49);
    // 안쪽 종이 100/128 의 가장자리 uv 가 격자선에 있다
    const us = new Set<string>();
    for (let i = 0; i < uv.count; i++) us.add(uv.getX(i).toFixed(4));
    expect(us.has((14 / 128).toFixed(4))).toBe(true);
    expect(us.has((114 / 128).toFixed(4))).toBe(true);
  });

  it("코트 반지름 함수는 원통 식(0.39 − 0.1·(y−0.36)/0.6)을 y 0.36~0.96 에서 따른다", () => {
    for (const y of [0.36, 0.4, 0.56, 0.72, 0.96]) expect(coatRadius(y)).toBeCloseTo(0.39 - (0.1 * (y - 0.36)) / 0.6, 9);
    expect(coatRadius(0.4)).toBeCloseTo(0.383, 3);
    expect(coatRadius(0.72)).toBeCloseTo(0.33, 3);
  });

  it("모든 정점이 몸통 반지름 r(y)+0.012 위에 있고 우하단 안쪽 모서리 한 점만 0.025 떠 있다", () => {
    const pts = bodyPoints();
    const lifted: number[] = [];
    pts.forEach((p, i) => {
      const gap = Math.hypot(p.x, p.z) - (coatRadius(p.y) + 0.012);
      if (Math.abs(gap) < 1e-6) return;
      expect(gap).toBeCloseTo(NOTE_LIFT, 3);
      lifted.push(i);
    });
    expect(lifted).toHaveLength(1);
    // 그 점은 안쪽 종이의 우하단(국소 +x, −y)이다
    const i = lifted[0];
    expect(pos.getX(i)).toBeCloseTo(NOTE_SIZE / 2, 6);
    expect(pos.getY(i)).toBeCloseTo(-NOTE_SIZE / 2, 6);
  });

  it("종이의 중심은 몸 좌표 (x −0.15, y 0.54 근처)에 놓인다", () => {
    expect(NOTE_CENTER.x).toBeCloseTo(-0.15, 9);
    const mid = bodyPoints().find((p, i) => Math.abs(pos.getX(i)) < 1e-9 && Math.abs(pos.getY(i)) < 1e-9);
    expect(mid?.x).toBeCloseTo(NOTE_CENTER.x, 6);
    expect(mid?.y).toBeCloseTo(NOTE_CENTER.y, 6);
  });

  it("종이는 양면이 아니라 앞면만 그린다(재질 side 기본)", () => {
    expect(kit.materialFor(0).side).toBe(0);
  });
});

// ---------- 재질 ----------

describe("재질 캐시 (P24-13·P24-18)", () => {
  it("좌석마다 같은 재질 객체이고 8개를 넘지 않는다", () => {
    const kit = createNoteKit(env().env);
    const set = new Set<MeshStandardMaterial>();
    for (let round = 0; round < 3; round++) for (let s = 0; s < 8; s++) set.add(kit.materialFor(s));
    for (let s = 0; s < 8; s++) expect(kit.materialFor(s)).toBe(kit.materialFor(s + 8));
    expect(set.size).toBe(8);
    expect(kit.materialCount()).toBe(8);
  });

  it("조명을 받는 종류이고 transparent · depthWrite false · polygonOffset, 색은 좌석 틴트다", () => {
    const kit = createNoteKit(env().env);
    for (let s = 0; s < 8; s++) {
      const m = kit.materialFor(s);
      expect(m.isMeshStandardMaterial).toBe(true);
      expect((m as unknown as { isMeshBasicMaterial?: boolean }).isMeshBasicMaterial).toBeUndefined();
      expect(m.transparent).toBe(true);
      expect(m.depthWrite).toBe(false);
      expect(m.polygonOffset).toBe(true);
      expect(m.map).toBe(kit.texture);
      expect(`#${m.color.getHexString(/* sRGB */)}`).toBe(expectedTint(s));
    }
  });
});

// ---------- 굽기 ----------

describe("텍스처 굽기 (P24-13)", () => {
  it("글꼴이 오면 Nanum Pen Script 로 '의심' 을 한 번 굽고 접힌 삼각·밑줄·그림자 호출이 있다", async () => {
    const { env: e, rec } = env({ font: true });
    const kit = createNoteKit(e);
    await kit.ready;
    expect(kit.baked).toBe(true);
    expect(rec.texts).toEqual(["의심"]);
    expect(rec.fontAtText[0]).toContain("Nanum Pen Script");
    expect(rec.fontAtText[0]).toContain("44px");
    expect(rec.calls).toContain("stroke"); // 밑줄
    expect(rec.calls.filter((c) => c === "fill").length).toBeGreaterThanOrEqual(3); // 그림자 종이·종이·접힌 면
    expect(rec.props.shadowBlur).toContain(6);
    expect(rec.calls).toContain("addColorStop"); // 위→아래 밝기차
    expect(kit.texture.colorSpace).toBe("srgb");
    expect(kit.texture.generateMipmaps).toBe(true);
    expect((kit.texture.image as { width: number }).width).toBe(128);
  });

  it("텍스처 한 장을 모든 재질이 공유한다", () => {
    const kit = createNoteKit(env().env);
    const maps = new Set<Texture | null>();
    for (let s = 0; s < 8; s++) maps.add(kit.materialFor(s).map);
    expect(maps.size).toBe(1);
  });

  it("makeCanvas 가 null 이면 1×1 종이색 텍스처로 대신하고 baked 는 거짓이다", async () => {
    const { env: e, fontCalls } = env({ canvas: false });
    const kit = createNoteKit(e);
    await kit.ready;
    expect(kit.baked).toBe(false);
    const img = kit.texture.image as { width: number; height: number; data?: Uint8Array };
    expect(img.width).toBe(1);
    expect(img.height).toBe(1);
    expect(Array.from(img.data ?? []).slice(0, 3)).toEqual([0xf1, 0xf2, 0xf5]); // gray-50
    expect(fontCalls()).toBe(0);
    expect(() => kit.rebake()).not.toThrow();
  });

  it("loadFont 가 거짓이면 기본 글꼴 700 으로 굽고, 나중에 rebake() 하면 같은 텍스처 객체를 한 번 더 굽는다", async () => {
    const { env: e, rec } = env({ font: false });
    const kit = createNoteKit(e);
    const tex = kit.texture;
    await kit.ready;
    expect(kit.baked).toBe(true);
    expect(rec.texts).toEqual(["의심"]);
    expect(rec.fontAtText[0]).not.toContain("Nanum Pen Script");
    expect(rec.fontAtText[0]).toContain("700");
    const v = tex.version;
    kit.rebake();
    expect(kit.texture).toBe(tex);
    expect(tex.version).toBeGreaterThan(v);
    expect(rec.texts).toEqual(["의심", "의심"]);
    expect(rec.fontAtText[1]).toContain("Nanum Pen Script");
    // 한 번만 다시 굽는다
    kit.rebake();
    expect(rec.texts).toHaveLength(2);
  });

  it("loadFont 가 실패(reject)해도 기본 글꼴로 굽는다", async () => {
    const { env: e, rec } = env({ font: "reject" });
    const kit = createNoteKit(e);
    await kit.ready;
    expect(rec.texts).toEqual(["의심"]);
    expect(rec.fontAtText[0]).not.toContain("Nanum Pen Script");
  });

  it("글꼴이 늦게 오면(fontLate) 한 번 다시 굽는다", async () => {
    const { env: e, rec } = env({ font: false });
    let resolveLate: (ok: boolean) => void = () => {};
    e.fontLate = () => new Promise<boolean>((r) => (resolveLate = r));
    const kit = createNoteKit(e);
    await kit.ready;
    resolveLate(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(rec.texts).toEqual(["의심", "의심"]);
    expect(rec.fontAtText[1]).toContain("Nanum Pen Script");
  });
});

// ---------- 가리지 않음 (P24-8 판정) ----------

type P = [number, number];
/** 볼록 다각형 둘이 겹치나(분리축 정리). 변이 닿기만 하는 것은 겹침이 아니다 */
function overlaps(a: P[], b: P[]): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i];
      const [x2, y2] = poly[(i + 1) % poly.length];
      const nx = y2 - y1;
      const ny = x1 - x2;
      const proj = (q: P[]): [number, number] => {
        const v = q.map(([x, y]) => x * nx + y * ny);
        return [Math.min(...v), Math.max(...v)];
      };
      const [a0, a1] = proj(a);
      const [b0, b1] = proj(b);
      const eps = 1e-9 * Math.hypot(nx, ny);
      if (a1 <= b0 + eps || b1 <= a0 + eps) return false;
    }
  }
  return true;
}
function rect(x0: number, x1: number, y0: number, y1: number): P[] {
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
}
function rotRect(cx: number, cy: number, w: number, h: number, rot: number): P[] {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return (
    [
      [-w / 2, -h / 2],
      [w / 2, -h / 2],
      [w / 2, h / 2],
      [-w / 2, h / 2],
    ] as P[]
  ).map(([x, y]): P => [cx + x * c - y * s, cy + x * s + y * c]);
}

/**
 * 보이는 장식 상자 표(몸 좌표 xy 투영). 출처는 src/world/character.ts 몸통 부분(RESEARCH P4 의 좌표 대조와 같다):
 *  - 넥타이  `tie.position.set(0, 0.8, 0.305)` 높이 0.24, 폭 0.06 — 코트 표면 안쪽이라 y 0.72 아래는 안 보인다 → y ≥ 0.72 부분만
 *  - 옷깃    `lap.position.set(s * 0.085, 0.88, 0.29)` 상자 0.1×0.32, `rotation.z = s * 0.42`
 *  - 별      `star.position.set(0.17, 0.8, 0.29)` 반지름 0.05
 *  - 십자    `cross.position.set(0.17, 0.8, 0.3)` 0.1 × 0.1
 *  - 기자    `press.position.set(0.16, 0.78, 0.3)` 0.1 × 0.07
 *  - 단추    `[0.68, 0.55]` 의 `position.set(0.07, y, 0.33)` 반지름 0.025
 *  - 머리·모자 neck y 1.0 위 전부, 어깨 `shoulder.position.y = 0.94` 납작 구(아래 끝 0.775)
 */
const IMPORTANT: Record<string, P[]> = {
  tie: rect(-0.03, 0.03, 0.72, 0.92),
  lapelL: rotRect(-0.085, 0.88, 0.1, 0.32, -0.42),
  lapelR: rotRect(0.085, 0.88, 0.1, 0.32, 0.42),
  star: rect(0.12, 0.22, 0.75, 0.85),
  cross: rect(0.12, 0.22, 0.75, 0.85),
  press: rect(0.11, 0.21, 0.745, 0.815),
  head: rect(-0.6, 0.6, 1.0, 2.2),
};
const BUTTONS: Record<string, P[]> = {
  button1: rect(0.045, 0.095, 0.655, 0.705),
  button2: rect(0.045, 0.095, 0.525, 0.575),
};
const SHOULDER_BOTTOM = 0.775;

describe("가리지 않음 (SC2, P24-8)", () => {
  const maxRoll = Math.max(...NOTE_ROLL_DEG.map(Math.abs));
  it("좌석별 기울기 최대는 9° 이다", () => {
    expect(maxRoll).toBe(9);
    expect(NOTE_ROLL_DEG).toEqual([-8, 6, -3, 9, -5, 4, -9, 7]);
  });

  it("맨 아래 장(층 0)은 모든 좌석에서 보이는 장식(넥타이·옷깃·배지·단추·머리)과 겹치지 않고 윗변이 어깨 아래다", () => {
    for (let seat = 0; seat < 8; seat++) {
      const box = noteBoxes(0, seat);
      expect(box.max[1], `seat ${seat} 윗변`).toBeLessThan(SHOULDER_BOTTOM);
      for (const [name, poly] of Object.entries({ ...IMPORTANT, ...BUTTONS })) {
        expect(overlaps(box.polygon, poly), `seat ${seat} × ${name}`).toBe(false);
      }
    }
  });

  it("쌓인 위 장(층 1·2)도 넥타이·옷깃·배지·머리를 가리지 않는다(단추는 가릴 수 있다)", () => {
    for (let seat = 0; seat < 8; seat++) {
      for (const layer of [1, 2]) {
        const box = noteBoxes(layer, seat);
        for (const [name, poly] of Object.entries(IMPORTANT)) {
          expect(overlaps(box.polygon, poly), `seat ${seat} layer ${layer} × ${name}`).toBe(false);
        }
      }
    }
  });

  it("층은 NOTE_STACK_STEP 만큼 몸통 표면을 따라 오른쪽 아래로 어긋난다", () => {
    for (let seat = 0; seat < 8; seat++) {
      const a = noteBoxes(0, seat);
      const b = noteBoxes(1, seat);
      expect(b.center[1] - a.center[1]).toBeCloseTo(NOTE_STACK_STEP.y, 6);
      expect(b.center[0]).toBeGreaterThan(a.center[0]);
      expect(b.angle - a.angle).toBeCloseTo(NOTE_STACK_STEP.x / b.radius, 3);
      expect(b.radius - a.radius).toBeCloseTo(NOTE_STACK_STEP.z + 0.00583, 3);
    }
  });

  it("화면 크기 환산(NOTE_SIZE × CHAR_SCALE × PX_PER_UNIT)은 가로 14px, 세로(× 0.81) 14px 이상이다", () => {
    const w = NOTE_SIZE * CHAR_SCALE * PX_PER_UNIT;
    expect(w).toBeGreaterThanOrEqual(14);
    expect(w * 0.81).toBeGreaterThanOrEqual(14);
  });

  it("그린 판은 안쪽 종이보다 크다(투명 여백이 그림자 자리)", () => {
    expect(NOTE_QUAD).toBeCloseTo((NOTE_SIZE * 128) / 100, 9);
  });
});

// vi 는 리그 시험(Task 2)에서 쓴다
void vi;
void Mesh;
