// 21-07 등불·집 창 파생(D-04·D-07·D-24·D-25, 결정 0088 A2): 3D 장면과 DOM(21-09 문패 창 점)이 같은 값 하나에서 그린다.
// lampLitOf = 가로등 8개 켜짐(저녁에는 내 진행만, 밤부터는 서버의 공개 day.lamps), houseLitOf = 집 창 8개(밤 이후 day.lamps). 역할은 읽지 않는다.
// 실패 출력은 한 줄이어야 해서(TAP) 목록은 쉼표로 이은 문자열로 비교한다.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TOWN_LAMPS } from "../../shared/game/mapTown";
import type { MapId, PhaseId, PlaceId, RoomView } from "../../shared/protocol";
import { houseLitOf, lampLitOf } from "../../src/game/lampView";
import { lockCause, openCause } from "../helpers/playable";

const LAMP_IDS = TOWN_LAMPS.map((l) => l.id as PlaceId);
const str = (v: readonly boolean[] | null): string => (v === null ? "null" : v.map((b) => (b ? "1" : "0")).join(""));

function viewOf(phase: PhaseId, o: { map?: MapId; mode?: "basic" | "extended"; done?: PlaceId[]; lamps?: boolean[]; role?: "mafia" | "citizen" } = {}): RoomView {
  const me: Record<string, unknown> = { seat: 0, isHost: false, ...(o.role === undefined ? {} : { role: o.role }) };
  if (o.done !== undefined) me.errand = { places: LAMP_IDS.slice(0, 3), done: o.done };
  const day: Record<string, unknown> = { n: 1, roles: [], ...(o.lamps === undefined ? {} : { lamps: o.lamps }) };
  return { code: "0042", phase, phaseEndsAt: null, phaseDurationMs: null, serverNow: 0, minPlayers: 4, maxPlayers: 8, players: [], me, day, map: o.map ?? "town", ...(o.mode === undefined ? {} : { mode: o.mode }) } as unknown as RoomView;
}

const LAMPS_NIGHT = [true, false, true, true, false, false, true, false];

describe("lampLitOf · houseLitOf (원인 흐름 마을)", () => {
  let restore: () => void = () => {};
  beforeAll(() => {
    restore = openCause();
  });
  afterAll(() => restore());

  it("errand 단계: lampLitOf 는 내 진행(me.errand.done)을 TOWN_LAMPS 순서로 8개, houseLitOf 는 null", () => {
    const v = viewOf("errand", { done: ["lamp2", "lamp5"] as PlaceId[] });
    expect(str(lampLitOf(v))).toBe("00100100");
    expect(houseLitOf(v)).toBeNull();
  });

  it("errand 단계에서 me.errand 가 없으면(유령·목록 0) 모두 꺼짐", () => {
    expect(str(lampLitOf(viewOf("errand")))).toBe("00000000");
  });

  it("night·morning·discussion: 둘 다 서버의 공개 day.lamps 그대로(사본), 역할과 무관", () => {
    for (const phase of ["night", "morning", "discussion", "nomination"] as const) {
      for (const role of ["mafia", "citizen"] as const) {
        const v = viewOf(phase, { lamps: LAMPS_NIGHT, role });
        expect(str(lampLitOf(v)), `${phase}/${role}`).toBe("10110010");
        expect(str(houseLitOf(v)), `${phase}/${role}`).toBe("10110010");
      }
    }
    const v = viewOf("night", { lamps: LAMPS_NIGHT });
    expect(lampLitOf(v)).not.toBe(v.day!.lamps);
  });

  it("night 인데 day.lamps 가 없으면 lampLitOf 는 모두 꺼짐, houseLitOf 는 null(지금 주인 규칙)", () => {
    const v = viewOf("night");
    expect(str(lampLitOf(v))).toBe("00000000");
    expect(houseLitOf(v)).toBeNull();
  });

  it("대기실·역할 확인 같은 저녁 앞 단계의 houseLitOf 는 null", () => {
    for (const phase of ["lobby", "roleReveal", "dayAnnounce"] as const) expect(houseLitOf(viewOf(phase, { lamps: LAMPS_NIGHT })), phase).toBeNull();
  });

  it("기본판·마을이 아닌 맵(재즈 바·광장)·맵 없음은 둘 다 null", () => {
    expect(lampLitOf(viewOf("night", { mode: "basic", lamps: LAMPS_NIGHT }))).toBeNull();
    expect(houseLitOf(viewOf("night", { mode: "basic", lamps: LAMPS_NIGHT }))).toBeNull();
    for (const map of ["bar", "plaza"] as const) {
      expect(lampLitOf(viewOf("night", { map, lamps: LAMPS_NIGHT })), map).toBeNull();
      expect(houseLitOf(viewOf("night", { map, lamps: LAMPS_NIGHT })), map).toBeNull();
    }
    const noMap = viewOf("night", { lamps: LAMPS_NIGHT }) as { map?: MapId };
    delete noMap.map;
    expect(lampLitOf(noMap as unknown as RoomView)).toBeNull();
  });

  it("함수 소스(주석 아닌 줄)에 역할 필드 읽기가 없다", () => {
    const src = readFileSync(resolve(process.cwd(), "src/game/lampView.ts"), "utf8");
    const code = src.split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
    expect(code.match(/\.role\b/g)?.length ?? 0).toBe(0);
    expect(code.match(/\bmafia\b/g)?.length ?? 0).toBe(0);
  });
});

describe("lampLitOf · houseLitOf — 원인 흐름이 잠긴 판", () => {
  // 꺼진 옛 확장판 경로 — 코드는 끄기만 한다(REQUIREMENTS Out of Scope '기능 코드 삭제'). 21-13: 기본 세계가 원인 흐름이므로 이 구역이 직접 잠근다(갈래 B).
  let restoreLock: () => void = () => {};
  beforeAll(() => {
    restoreLock = lockCause();
  });
  afterAll(() => restoreLock());

  it("확장판이어도 원인 흐름이 꺼져 있으면 둘 다 null", () => {
    expect(lampLitOf(viewOf("night", { lamps: LAMPS_NIGHT }))).toBeNull();
    expect(houseLitOf(viewOf("night", { lamps: LAMPS_NIGHT }))).toBeNull();
  });
});
