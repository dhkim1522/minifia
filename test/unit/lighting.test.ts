// 낮·밤 조명 표의 허용 범위 시험 (18-02, D-03, UI-SPEC 조명 계약 1~3). 두 맵(광장·재즈 바)의 표를 같은 잣대로 잰다.
// 렌더로 재는 허용 범위 4(휘도 순서)·5(가독)는 18-07 의 몫이다.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Color } from "three";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PhaseId, RoomView } from "../../shared/protocol";
import { nightDarkOf } from "../../src/game/nightDark";
import { lightingFor, lightingOf, visibleSeats } from "../../src/world/presence";
import { rulesetOf } from "../../shared/game/ruleset";
import { openCause } from "../helpers/playable";
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

/** 4a5dabea 시점의 밤 쪽 네 행(moonColor 칸 없이). 값을 옮겨 적은 것이라 이 네 행이 바뀌면 시험이 깨진다 */
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
    night: { hemi: 0.45 * Math.PI, moon: 0.7 * Math.PI, exposure: 1.25, sky: ["#2c2c58", "#15122a", "#0a0b16"], fog: FOG, stage: 0, pendant: BAR_PENDANT * 0.15, emissive: { room: 0.15, vote: 0.1 }, glow: { room: 0.15, vote: 0 }, self: 0 },
    nightCitizen: { hemi: 0.05 * Math.PI, moon: 0.08 * Math.PI, exposure: 0.75, sky: ["#1a1a36", "#0c0a1a", "#05060c"], fog: FOG, stage: 0, pendant: 0, emissive: { room: 0, vote: 0 }, glow: { room: 0, vote: 0 }, self: 1.4 * 4 },
    nightGhost: { hemi: 0.45 * Math.PI, moon: 0.7 * Math.PI, exposure: 1.25, sky: ["#2c2c58", "#15122a", "#0a0b16"], fog: FOG, stage: 0, pendant: BAR_PENDANT * 0.15, emissive: { room: 0.15, vote: 0.1 * 0.4 }, glow: { room: 0.15, vote: 0 }, self: 0 },
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

  it("방향광 색온도(허용 범위 3 개정): talk·vote 는 R ≥ B 따뜻한 쪽, morning 은 서늘하되 옅다, 밤·유령은 B > R 달빛 남색", () => {
    for (const ph of ["talk", "vote"] as const) {
      const { r, b } = rb(tune[ph].moonColor ?? "#000000");
      expect(r, ph).toBeGreaterThanOrEqual(b);
      expect(tune[ph].moonColor, ph).toBeDefined();
    }
    const m = tune.morning.moonColor ?? "#000000";
    expect(rb(m).b, "morning B ≥ R").toBeGreaterThanOrEqual(rb(m).r);
    expect(saturation(m), "morning 채도 ≤ 0.12").toBeLessThanOrEqual(0.12);
    expect(saturation(m), "morning 은 달빛 토큰보다 옅다").toBeLessThan(saturation(TOKEN_COLORS.moon));
    for (const ph of ["night", "nightGhost"] as const) {
      const { r, b } = rb(tune[ph].moonColor ?? "#ffffff");
      expect(b, ph).toBeGreaterThan(r);
    }
  });

  it("방향광 색 성질: talk 는 R ≥ B 이고 채도 ≤ 0.12, vote 는 노을색 R > G > B", () => {
    const t = tune.talk.moonColor ?? "#000000";
    expect(rb(t).r).toBeGreaterThanOrEqual(rb(t).b);
    expect(saturation(t)).toBeLessThanOrEqual(0.12);
    const v = rb(tune.vote.moonColor ?? "#000000");
    expect(v.r).toBeGreaterThan(v.g);
    expect(v.g).toBeGreaterThan(v.b);
  });

  it("재질 보정 albedo(허용 범위 6): 낮 세 행 0 < mix ≤ 0.6·tint 채도 ≤ 0.25, talk tint R ≥ B·morning tint B ≥ R·vote tint R > B 이고 진홍 아님", () => {
    for (const ph of DAY_ROWS) {
      const { tint, mix } = tune[ph].albedo;
      expect(mix, `${ph} mix`).toBeGreaterThan(0);
      expect(mix, `${ph} mix`).toBeLessThanOrEqual(0.6);
      expect(saturation(tint), `${ph} tint 채도`).toBeLessThanOrEqual(0.25);
      expect(crimsonish(tint), `${ph} 진홍`).toBe(false);
    }
    expect(rb(tune.talk.albedo.tint).r).toBeGreaterThanOrEqual(rb(tune.talk.albedo.tint).b);
    expect(rb(tune.morning.albedo.tint).b).toBeGreaterThanOrEqual(rb(tune.morning.albedo.tint).r);
    expect(rb(tune.vote.albedo.tint).r).toBeGreaterThan(rb(tune.vote.albedo.tint).b);
  });

  it("순서 감각(표 값만): hemi 는 talk ≥ morning ≥ vote, 배경 sky[2] 휘도는 talk > morning > vote", () => {
    expect(tune.talk.hemi).toBeGreaterThanOrEqual(tune.morning.hemi);
    expect(tune.morning.hemi).toBeGreaterThanOrEqual(tune.vote.hemi);
    expect(lum(tune.talk.sky[2])).toBeGreaterThan(lum(tune.morning.sky[2]));
    expect(lum(tune.morning.sky[2])).toBeGreaterThan(lum(tune.vote.sky[2]));
  });

  it("trial·night·nightCitizen·nightGhost 네 행은 moonColor 만 달빛색이고 albedo 는 ALBEDO_NONE, 나머지는 4a5dabea 와 같다", () => {
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
function viewOf(phase: PhaseId, o: { role?: "mafia" | "police" | "doctor" | "citizen"; mode?: "basic" | "extended"; dead?: number[]; mySeat?: number } = {}): RoomView {
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
    ...(o.mode === undefined ? {} : { mode: o.mode }),
    ...(ghost ? { spectate: { seats: [] } } : {}),
  } as unknown as RoomView;
}
const ROLES = ["mafia", "police", "doctor", "citizen"] as const;

describe("원인 흐름 밤·저녁 조명 (21-07, D-04·D-10)", () => {
  let restore: () => void = () => {};
  beforeAll(() => {
    restore = openCause();
  });
  afterAll(() => restore());

  it("밤: 마피아·경찰·의사·시민 모두 lightingFor = night, visibleSeats 는 빈 표, nightDarkOf false", () => {
    for (const role of ROLES) {
      const v = viewOf("night", { role });
      expect(lightingFor(v), role).toBe("night");
      expect(Object.keys(visibleSeats(v)).length, role).toBe(0);
      expect(nightDarkOf(v), role).toBe(false);
    }
  });

  it("밤: 유령은 nightGhost 그대로이고 몸을 그리지 않으며 어둠 표식은 없다", () => {
    const v = viewOf("night", { role: "citizen", dead: [0] });
    expect(lightingFor(v)).toBe("nightGhost");
    expect(Object.keys(visibleSeats(v)).length).toBe(0);
    expect(nightDarkOf(v)).toBe(false);
  });

  it("저녁(errand): lightingOf(errand, 원인 규칙) = vote, 규칙이 없으면 talk 그대로. lightingFor 도 vote", () => {
    expect(lightingOf("errand", rulesetOf("extended"))).toBe("vote");
    expect(lightingOf("errand")).toBe("talk");
    expect(lightingOf("errand", rulesetOf("basic"))).toBe("talk");
    expect(lightingFor(viewOf("errand", { role: "citizen" }))).toBe("vote");
    expect(lightingFor(viewOf("errand", { role: "mafia" }))).toBe("vote");
  });

  it("아침·토론은 그대로(morning·talk)", () => {
    expect(lightingFor(viewOf("morning", { role: "mafia" }))).toBe("morning");
    expect(lightingFor(viewOf("discussion", { role: "citizen" }))).toBe("talk");
  });

  it("기본판 밤은 지금 그대로: 마피아 night, 시민 nightCitizen, 시민은 본인만 그리고 어둠 표식 true", () => {
    const mafia = viewOf("night", { role: "mafia", mode: "basic" });
    const citizen = viewOf("night", { role: "citizen", mode: "basic" });
    expect(lightingFor(mafia)).toBe("night");
    expect(lightingFor(citizen)).toBe("nightCitizen");
    expect(Object.keys(visibleSeats(citizen)).join(",")).toBe("0");
    expect(Object.keys(visibleSeats(mafia)).length).toBe(5);
    expect(nightDarkOf(citizen)).toBe(true);
    expect(nightDarkOf(mafia)).toBe(false);
    expect(lightingFor(viewOf("errand", { role: "citizen", mode: "basic" }))).toBe("talk");
  });

  it("소스 규약: lightingFor·visibleSeats·nightDarkOf 에서 원인 흐름 분기가 역할 읽기보다 먼저다", () => {
    const code = (f: string): string =>
      readFileSync(resolve(process.cwd(), f), "utf8")
        .split("\n")
        .filter((l) => !/^\s*\/\//.test(l))
        .join("\n");
    const presence = code("src/world/presence.ts");
    const fnBody = (src: string, name: string): string => {
      const at = src.indexOf("export function " + name);
      return src.slice(at, src.indexOf("\n}\n", at));
    };
    for (const name of ["lightingFor", "visibleSeats"]) {
      const body = fnBody(presence, name);
      expect(body.indexOf("cause"), name).toBeGreaterThan(-1);
      expect(body.indexOf("cause"), name).toBeLessThan(body.indexOf(".role") === -1 ? Infinity : body.indexOf(".role"));
    }
    const dark = fnBody(code("src/game/nightDark.ts"), "nightDarkOf");
    expect(dark.indexOf("cause")).toBeGreaterThan(-1);
    expect(dark.indexOf("cause")).toBeLessThan(dark.indexOf(".role"));
  });
});

describe("원인 흐름이 잠긴(기본 setup) 확장판은 옛 조명 그대로", () => {
  it("밤 시민 nightCitizen·마피아 night, errand 는 talk", () => {
    expect(lightingFor(viewOf("night", { role: "citizen" }))).toBe("nightCitizen");
    expect(lightingFor(viewOf("night", { role: "mafia" }))).toBe("night");
    expect(lightingFor(viewOf("errand", { role: "citizen" }))).toBe("talk");
    expect(nightDarkOf(viewOf("night", { role: "citizen" }))).toBe(true);
  });
});
