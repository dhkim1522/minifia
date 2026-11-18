// 낮·밤 조명 표의 허용 범위 시험 (18-02, D-03, UI-SPEC 조명 계약 1~3). 두 맵(광장·재즈 바)의 표를 같은 잣대로 잰다.
// 렌더로 재는 허용 범위 4(휘도 순서)·5(가독)는 18-07 의 몫이다.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Color } from "three";
import { describe, expect, it } from "vitest";
import type { PhaseId, RoomView } from "../../shared/protocol";
import { nightDarkOf } from "../../src/game/nightDark";
import { lightingFor, lightingOf, visibleSeats } from "../../src/world/presence";
import { ALBEDO_NONE, LIGHT_TUNE, type PhaseTune } from "../../src/world/maps/bar";
import { PLAZA_LIGHT_TUNE } from "../../src/world/maps/plaza";
import { TOKEN_COLORS } from "../../src/world/palette";
import type { LightingPhase } from "../../src/world/renderer";

type Tune = Readonly<Record<LightingPhase, PhaseTune>>;
const MAPS: ReadonlyArray<{ name: string; tune: Tune; ratio: number }> = [
  { name: "광장", tune: PLAZA_LIGHT_TUNE, ratio: 8 },
  { name: "재즈 바", tune: LIGHT_TUNE, ratio: 6 },
];

/** 선형 작업 공간 상대 휘도(plazaScene.test.ts 의 lum 과 같은 식) */
const lum = (hex: string): number => {
  const c = new Color(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
};
/** (max−min)/max, 0~255 정수 채널 */
const saturation = (hex: string): number => {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const max = Math.max(...ch);
  return max === 0 ? 0 : (max - Math.min(...ch)) / max;
};
const rb = (hex: string): { r: number; g: number; b: number } => {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};
/** 진홍(붉은 쪽이 지배적인 색) 판정 — plazaScene.test.ts 의 crimsonish 와 같은 식 */
const crimsonish = (hex: string): boolean => {
  const c = new Color(hex);
  return c.r >= 0.35 && c.r > 1.8 * c.g && c.r > 1.5 * c.b;
};

/** 밤 쪽 네 행의 계약. B안은 재즈 바 night·nightGhost에 서늘한 보조광과 은은한 무대 조명을 적용했다. */
const BAR_PENDANT = 0.9 * 4;
const LAMP = 1.0 * 4;
const FOG = { near: 20, far: 44 };
const NIGHT_ROWS: Readonly<Record<string, Readonly<Record<string, Omit<PhaseTune, "moonColor" | "albedo">>>>> = {
  광장: {
    trial: { hemi: 0.3 * Math.PI, moon: 0.2 * Math.PI, exposure: 1.25, sky: ["#3a3464", "#1c1428", "#100d19"], fog: FOG, stage: 2.0 * 4, pendant: LAMP * 0.06, emissive: { room: 0.06, vote: 1 }, glow: { room: 0.06, vote: 1 }, self: 0 },
    night: { hemi: 0.45 * Math.PI, moon: 0.7 * Math.PI, exposure: 1.25, sky: ["#2c2c58", "#15122a", "#0a0b16"], fog: FOG, stage: 0, pendant: LAMP * 0.7, emissive: { room: 0.7, vote: 0 }, glow: { room: 0.7, vote: 0 }, self: 0 },
    nightCitizen: { hemi: 0.05 * Math.PI, moon: 0.08 * Math.PI, exposure: 0.75, sky: ["#1a1a36", "#0c0a1a", "#05060c"], fog: FOG, stage: 0, pendant: 0, emissive: { room: 0, vote: 0 }, glow: { room: 0, vote: 0 }, self: 1.4 * 4 },
    nightGhost: { hemi: 0.45 * Math.PI, moon: 0.7 * Math.PI, exposure: 1.25, sky: ["#2c2c58", "#15122a", "#0a0b16"], fog: FOG, stage: 0, pendant: LAMP * 0.7, emissive: { room: 0.7, vote: 0 }, glow: { room: 0.7, vote: 0 }, self: 0 },
  },
  "재즈 바": {
    trial: { hemi: 0.35 * Math.PI, moon: 0.2 * Math.PI, exposure: 1.25, sky: ["#3a3464", "#1c1428", "#100d19"], fog: FOG, stage: 2.0 * 4, pendant: BAR_PENDANT * 0.05, emissive: { room: 0.05, vote: 1 }, glow: { room: 0.05, vote: 1 }, self: 0 },
    night: { hemi: 0.45 * Math.PI, moon: 0.7 * Math.PI, exposure: 1.25, sky: ["#596589", "#252a43", "#0a0b16"], fog: FOG, stage: 2.8, pendant: BAR_PENDANT * 0.15, emissive: { room: 0.15, vote: 0.45 }, glow: { room: 0.15, vote: 0.28 }, self: 0 },
    nightCitizen: { hemi: 0.05 * Math.PI, moon: 0.08 * Math.PI, exposure: 0.75, sky: ["#1a1a36", "#0c0a1a", "#05060c"], fog: FOG, stage: 0, pendant: 0, emissive: { room: 0, vote: 0 }, glow: { room: 0, vote: 0 }, self: 1.4 * 4 },
    nightGhost: { hemi: 0.45 * Math.PI, moon: 0.7 * Math.PI, exposure: 1.25, sky: ["#596589", "#252a43", "#0a0b16"], fog: FOG, stage: 2.8, pendant: BAR_PENDANT * 0.15, emissive: { room: 0.15, vote: 0.45 * 0.4 }, glow: { room: 0.15, vote: 0.28 * 0.4 }, self: 0 },
  },
};

const DAY_ROWS: readonly LightingPhase[] = ["talk", "morning", "vote"];

describe.each(MAPS)("조명 표 허용 범위 — $name (D-03)", ({ name, tune, ratio }) => {
  it("낮 행의 하늘색 sky[0] 채도 (max−min)/max 가 0.20 이하다 (허용 범위 1)", () => {
    for (const ph of DAY_ROWS) expect(saturation(tune[ph].sky[0]), ph).toBeLessThanOrEqual(0.2);
  });

  it(`낮 행의 배경·안개 sky[2] 휘도가 밤 sky[2] 의 ${ratio}배 이상이다 (허용 범위 2)`, () => {
    for (const ph of DAY_ROWS.filter((p) => p !== "vote")) expect(lum(tune[ph].sky[2]) / lum(tune.night.sky[2]), ph).toBeGreaterThanOrEqual(ratio);
  });

  it("방향광 색온도: 아침은 서늘하고 옅으며 밤·유령은 달빛 남색이다", () => {
    const m = tune.morning.moonColor ?? "#000000";
    expect(rb(m).b, "morning B ≥ R").toBeGreaterThanOrEqual(rb(m).r);
    expect(saturation(m), "morning 채도 ≤ 0.12").toBeLessThanOrEqual(0.12);
    expect(saturation(m), "morning 은 달빛 토큰보다 옅다").toBeLessThan(saturation(TOKEN_COLORS.moon));
    for (const ph of ["night", "nightGhost"] as const) {
      const { r, b } = rb(tune[ph].moonColor ?? "#ffffff");
      expect(b, ph).toBeGreaterThan(r);
    }
  });

  it("방향광 색 성질: talk 는 맵별로 옅은 창빛·햇빛, vote 는 노을색", () => {
    const t = tune.talk.moonColor ?? "#000000";
    const { r, b } = rb(t);
    if (name === "재즈 바") expect(b).toBeGreaterThan(r);
    else expect(r).toBeGreaterThanOrEqual(b);
    expect(saturation(t)).toBeLessThanOrEqual(name === "재즈 바" ? 0.16 : 0.12);
    const v = rb(tune.vote.moonColor ?? "#000000");
    expect(v.r).toBeGreaterThan(v.g);
    expect(v.g).toBeGreaterThan(v.b);
  });

  it("재질 보정 albedo: 낮 세 행은 채도가 낮고, 맵별 낮색과 아침·저녁의 온도 차를 유지한다", () => {
    for (const ph of DAY_ROWS) {
      const { tint, mix } = tune[ph].albedo;
      expect(mix, `${ph} mix`).toBeGreaterThan(0);
      expect(mix, `${ph} mix`).toBeLessThanOrEqual(0.6);
      expect(saturation(tint), `${ph} tint 채도`).toBeLessThanOrEqual(0.25);
      expect(crimsonish(tint), `${ph} 진홍`).toBe(false);
    }
    const { r, b } = rb(tune.talk.albedo.tint);
    if (name === "재즈 바") expect(b).toBeGreaterThan(r);
    else expect(r).toBeGreaterThanOrEqual(b);
    expect(rb(tune.morning.albedo.tint).b).toBeGreaterThanOrEqual(rb(tune.morning.albedo.tint).r);
    expect(rb(tune.vote.albedo.tint).r).toBeGreaterThan(rb(tune.vote.albedo.tint).b);
  });

  it("순서 감각(표 값만): hemi 는 talk ≥ morning ≥ vote, 배경 sky[2] 휘도는 talk > morning > vote", () => {
    expect(tune.talk.hemi).toBeGreaterThanOrEqual(tune.morning.hemi);
    expect(tune.morning.hemi).toBeGreaterThanOrEqual(tune.vote.hemi);
    expect(lum(tune.talk.sky[2])).toBeGreaterThan(lum(tune.morning.sky[2]));
    expect(lum(tune.morning.sky[2])).toBeGreaterThan(lum(tune.vote.sky[2]));
  });

  it("trial과 밤 세 행은 달빛색과 원래 재질을 쓰고 각 맵의 밤 조명 수치를 지킨다", () => {
    for (const ph of ["trial", "night", "nightCitizen", "nightGhost"] as const) {
      const { moonColor, albedo, ...rest } = tune[ph];
      expect(moonColor, ph).toBe(TOKEN_COLORS.moon);
      expect(albedo, ph).toEqual(ALBEDO_NONE);
      expect(rest, ph).toEqual(NIGHT_ROWS[name]![ph]);
    }
  });
});

// ---------- 21-07 원인 흐름 조명 분기(D-04·D-10, 결정 0088·0074-4 의 연장) ----------
// 확장판(원인 흐름) 밤은 역할로 갈라지지 않는다: 모든 산 사람이 같은 night 조명·같은 장면 표(몸 없음)·같은 어둠 표식 값. 저녁(errand)은 해 질 녘(vote) 조명.
// 기본 마피아(mode basic)와 잠금 아래 옛 확장판은 지금 그대로다.
function viewOf(phase: PhaseId, o: { role?: "mafia" | "police" | "doctor" | "citizen"; dead?: number[]; mySeat?: number } = {}): RoomView {
  const dead = new Set(o.dead ?? []);
  const players = Array.from({ length: 5 }, (_, seat) => ({ seat, nickname: "p" + seat, connected: true, isHost: seat === 0, ...(dead.has(seat) ? { alive: false } : {}) }));
  const mySeat = o.mySeat ?? 0;
  const ghost = dead.has(mySeat);
  return {
    code: "0042",
    phase,
    phaseEndsAt: null,
    phaseDurationMs: null,
    serverNow: 0,
    minPlayers: 4,
    maxPlayers: 8,
    players,
    me: { seat: mySeat, isHost: false, ...(o.role === undefined ? {} : { role: o.role }) },
    day: { n: 1, roles: [] },
    ...(ghost ? { spectate: { seats: [] } } : {}),
  } as unknown as RoomView;
}
const ROLES = ["mafia", "police", "doctor", "citizen"] as const;

describe("아침·토론·기본판 밤 조명 (22-04: 원인 흐름 밤·저녁 조명을 지웠다)", () => {
  it("아침·토론은 그대로(morning·talk)", () => {
    expect(lightingFor(viewOf("morning", { role: "mafia" }))).toBe("morning");
    expect(lightingFor(viewOf("discussion", { role: "citizen" }))).toBe("talk");
  });

  it("밤은 마피아 night, 시민 nightCitizen, 시민은 본인만 그리고 어둠 표식 true, 유령은 nightGhost", () => {
    const mafia = viewOf("night", { role: "mafia" });
    const citizen = viewOf("night", { role: "citizen" });
    expect(lightingFor(mafia)).toBe("night");
    expect(lightingFor(citizen)).toBe("nightCitizen");
    expect(Object.keys(visibleSeats(citizen)).join(",")).toBe("0");
    expect(Object.keys(visibleSeats(mafia)).length).toBe(5);
    expect(nightDarkOf(citizen)).toBe(true);
    expect(nightDarkOf(mafia)).toBe(false);
    expect(lightingFor(viewOf("night", { role: "citizen", dead: [0] }))).toBe("nightGhost");
  });
});

describe("밤 조명", () => {
  it("밤 시민 nightCitizen·마피아 night", () => {
    expect(lightingFor(viewOf("night", { role: "citizen" }))).toBe("nightCitizen");
    expect(lightingFor(viewOf("night", { role: "mafia" }))).toBe("night");
    expect(nightDarkOf(viewOf("night", { role: "citizen" }))).toBe(true);
  });
});
