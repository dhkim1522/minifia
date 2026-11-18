// 두 맵의 시간대 연속성과 비공개 밤 장면을 검사한다.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Color } from "three";
import { describe, expect, it } from "vitest";
import type { PhaseId, RoomView } from "../../shared/protocol";
import { nightDarkOf } from "../../src/game/nightDark";
import { lightingFor, lightingOf, visibleSeats } from "../../src/world/presence";
import { buildBarScene, LIGHT_TUNE, type PhaseTune } from "../../src/world/maps/bar";
import { buildPlazaScene, PLAZA_LIGHT_TUNE } from "../../src/world/maps/plaza";
import { LADDER, LIGHT_BLEND_SEC, type LightingPhase } from "../../src/world/renderer";

type Tune = Readonly<Record<LightingPhase, PhaseTune>>;
const MAPS = [
  { name: "광장", build: buildPlazaScene, tune: PLAZA_LIGHT_TUNE },
  { name: "재즈 바", build: buildBarScene, tune: LIGHT_TUNE },
] satisfies ReadonlyArray<{ name: string; build: typeof buildBarScene; tune: Tune }>;

const lum = (hex: string): number => {
  const c = new Color(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
};

it("광장은 재즈 바보다 밝은 석재와 중립적인 방향광을 쓴다", () => {
  const jazzLight = new Color(LIGHT_TUNE.talk.moonColor);
  const plazaLight = new Color(PLAZA_LIGHT_TUNE.talk.moonColor);
  expect(jazzLight.b - jazzLight.r).toBeGreaterThan(plazaLight.b - plazaLight.r);
  expect(lum(PLAZA_LIGHT_TUNE.talk.albedo.tint)).toBeGreaterThan(lum(LIGHT_TUNE.talk.albedo.tint));
});

describe.each(MAPS)("$name의 조명 연속성", ({ build, tune }) => {
  it("같은 낮의 토론·투표·유언에서는 주변광과 재질이 같다", () => {
    for (const phase of ["vote", "trial"] as const) {
      expect(tune[phase].sky).toEqual(tune.talk.sky);
      expect(tune[phase].albedo).toEqual(tune.talk.albedo);
      expect(tune[phase].hemi).toBe(tune.talk.hemi);
      expect(tune[phase].moon).toBe(tune.talk.moon);
      expect(tune[phase].moonColor).toBe(tune.talk.moonColor);
      expect(tune[phase].exposure).toBe(tune.talk.exposure);
      expect(tune[phase].stage).toBeGreaterThan(tune.talk.stage);
    }
  });

  it("밤은 은은한 푸른빛과 등불을 남기고, 아침은 중간 정도로 밝아진다", () => {
    expect(tune.talk.hemi).toBeGreaterThan(tune.morning.hemi);
    expect(tune.morning.hemi).toBeGreaterThan(tune.night.hemi);
    expect(tune.night.hemi).toBeGreaterThan(tune.talk.hemi * 0.65);
    expect(tune.night.pendant).toBeGreaterThan(0);
    expect(tune.night.emissive.room).toBeGreaterThan(0.4);
    expect(tune.nightCitizen.hemi).toBe(tune.night.hemi);
    expect(tune.nightCitizen.pendant).toBe(tune.night.pendant);
    const night = new Color(tune.night.moonColor);
    const morning = new Color(tune.morning.moonColor);
    expect(night.b - night.r).toBeGreaterThan(morning.b - morning.r);
    const balance = lum(tune.talk.sky[2]) / lum(tune.night.sky[2]);
    expect(balance).toBeGreaterThan(1.15);
    expect(balance).toBeLessThan(2);
  });

  it("2.8초 전환 중 조명 값과 하늘색이 스냅하지 않고 정확한 목표에 도달한다", () => {
    const map = build(LADDER[0]!);
    const day = new Color(tune.talk.sky[2]);
    const night = new Color(tune.night.sky[2]);
    const background = map.root.background as Color;
    const direction = map.lights.moon.position.clone();
    const ver = () => (map.meshes.shell!.geometry.getAttribute("color") as { version: number }).version;
    const initial = ver();
    const midpoint = tune.talk.hemi + (tune.night.hemi - tune.talk.hemi) / 2;
    map.setLighting("night", LIGHT_BLEND_SEC);
    expect(background.equals(day)).toBe(true);
    map.update(LIGHT_BLEND_SEC / 2, LIGHT_BLEND_SEC / 2);
    expect(map.lights.hemi.intensity).toBeCloseTo(midpoint);
    expect(background.equals(day.clone().lerp(night, 0.5))).toBe(true);
    map.update(LIGHT_BLEND_SEC / 2, LIGHT_BLEND_SEC);
    expect(map.lights.hemi.intensity).toBe(tune.night.hemi);
    expect(background.equals(night)).toBe(true);
    expect(map.lights.moon.position.equals(direction)).toBe(true);
    expect(ver()).toBe(initial);
    map.dispose();
  });

  it("예산 내리기·연속 전환은 현재 색에서 이어지고 즉시 적용은 남은 전환을 끝낸다", () => {
    const map = build(LADDER[0]!);
    map.setLighting("night", LIGHT_BLEND_SEC);
    map.update(0.9, 0.9);
    const start = map.lights.hemi.intensity;
    map.applyBudget(LADDER[5]!);
    expect(map.lights.hemi.intensity).toBe(start);
    expect(map.lights.pendantA.intensity).toBe(0);
    expect(map.root.fog).toBeNull();
    map.setLighting("morning", LIGHT_BLEND_SEC);
    expect(map.lights.hemi.intensity).toBe(start);
    map.update(1.4, 2.3);
    expect(map.lights.hemi.intensity).toBeCloseTo((start + tune.morning.hemi) / 2);
    map.setLighting("talk");
    map.update(3, 5.3);
    map.applyBudget(LADDER[0]!);
    expect(map.lights.hemi.intensity).toBe(tune.talk.hemi);
    expect(map.lights.pendantA.intensity).toBe(tune.talk.pendant);
    expect(map.root.fog).not.toBeNull();
    map.dispose();
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
