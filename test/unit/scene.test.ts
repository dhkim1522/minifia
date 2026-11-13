// 아침 현장 판정 순수 모듈 (21-06 Task 1, D-12~D-16·D-22, 위협 T-21-14·T-21-15) — neighborsOf·buildScene·actInspect·markSmudge·clearScene.
// 실패 출력은 한 줄이어야 해서(TAP) 값은 JSON 문자열로 견준다.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { markSmudge } from "../../shared/game/mafiaTouch";
import { TOWN_CLUE_SPOTS } from "../../shared/game/mapTown";
import { CLUE_PHASES, actInspect, buildScene, clearScene, neighborsOf } from "../../shared/game/scene";
import type { RoomState } from "../../shared/game/room";
import type { OutfitId, RoleId } from "../../shared/protocol";
import { startedAt } from "../helpers/voteState";

const json = (v: unknown): string => JSON.stringify(v);

/** 마을 판 아침 6명(좌석 0~5): 0 마피아(coat) · 1 시민 · 2 시민(피해자 집) · 3 시민 · 4 마피아(mafia 의상) · 5 시민(hood). 현장은 좌석 2 의 집. */
const ROLES: RoleId[] = ["mafia", "citizen", "citizen", "citizen", "mafia", "citizen"];
const LOOKS: Record<number, OutfitId> = { 0: "coat", 4: "mafia", 5: "hood", 2: "noir" };
const baseState = (): RoomState => {
  const s = startedAt(6, 7, "night");
  return { ...s, map: "town", players: s.players.map((p) => ({ ...p, role: ROLES[p.seat]!, ...(LOOKS[p.seat] === undefined ? {} : { look: LOOKS[p.seat]! }) })) };
};
/** 밤에 좌석 2 의 집을 고른 사람들(집 주인 포함). */
const withPicks = (s: RoomState, seats: number[]): RoomState => ({ ...s, players: s.players.map((p) => (seats.includes(p.seat) ? { ...p, nightPick: 2 } : p)) });
/** 난수 대신 정한 값을 차례로 돌려주고 호출 수를 센다. */
const seq = (...values: number[]): { fn: (n: number) => number; calls: () => number[] } => {
  const asked: number[] = [];
  return {
    fn: (n) => {
      asked.push(n);
      return values[asked.length - 1] ?? 0;
    },
    calls: () => asked,
  };
};
const sceneOf = (): NonNullable<RoomState["scene"]> => ({ house: 2, steps: 3, cloth: "blackCloth", window: "button", eyes: [1], smudged: [] });
/** 아침 상태 + 현장. */
const morning = (scene = sceneOf()): RoomState => ({ ...baseState(), phase: "morning", morning: { eliminated: 2 }, scene });
const idOf = (s: RoomState, seat: number): string => s.players.find((p) => p.seat === seat)!.id;
const spotFx = (house: number, spot: 1 | 2 | 3): { x: number; z: number } => TOWN_CLUE_SPOTS[house]![spot - 1]!;
const cluesOf = (s: RoomState, seat: number): string => json(s.players.find((p) => p.seat === seat)!.clues ?? null);

describe("neighborsOf — 집은 시계 방향 고리의 옆집이다 (D-14)", () => {
  it("0 → 7,1 · 7 → 6,0 · 2 → 1,3", () => {
    expect(`${neighborsOf(0).join(",")} ${neighborsOf(7).join(",")} ${neighborsOf(2).join(",")}`).toBe("7,1 6,0 1,3");
  });
  it("CLUE_PHASES 는 그날 낮 동안(아침~처형)이다", () => {
    expect(json([...CLUE_PHASES])).toBe('["morning","discussion","nomination","defense","verdict","execution"]');
  });
});

describe("buildScene — 풀·steps·조각·눈 (D-12·D-14·D-16)", () => {
  it("좌석 0·4·5 와 집 주인 2 가 그 집을 골랐으면 steps 3, 첫 난수 1 → 좌석 4 의 mafia 의상 조각(blackCloth), 둘째 난수 → 좌석 0 의 coat 조각(button), eyes 는 이웃 중 켜진 산 사람 [1]", () => {
    const r = seq(1, 1);
    const scene = buildScene(withPicks(baseState(), [0, 4, 5, 2]), 2, r.fn, [1, 3], [0, 1, 4, 5]);
    expect(`${json(scene)} ${json(r.calls())}`).toBe('{"house":2,"steps":3,"cloth":"blackCloth","window":"button","eyes":[1],"smudged":[]} [3,2]');
  });

  it("풀이 한 명이면 window = cloth 이고 난수를 한 번만 부른다", () => {
    const r = seq(0);
    const scene = buildScene(withPicks(baseState(), [4]), 2, r.fn, [], [0, 1, 3, 4, 5]);
    expect(`${json(scene)} ${json(r.calls())}`).toBe('{"house":2,"steps":1,"cloth":"blackCloth","window":"blackCloth","eyes":[],"smudged":[]} [1]');
  });

  it("풀이 비면 현장을 만들지 않고 난수를 부르지 않는다(죽은 사람의 선택·피해자 본인만 고른 밤)", () => {
    const r = seq(0, 0);
    const s = withPicks(baseState(), [2]);
    const dead: RoomState = { ...withPicks(baseState(), [4]), players: withPicks(baseState(), [4]).players.map((p) => (p.seat === 4 ? { ...p, alive: false } : p)) };
    expect(`${buildScene(s, 2, r.fn, [], [])} ${buildScene(dead, 2, r.fn, [], [])} ${r.calls().length}`).toBe("undefined undefined 0");
  });

  it("입력 상태를 바꾸지 않는다", () => {
    const s = withPicks(baseState(), [0, 4, 5]);
    const before = json(s);
    buildScene(s, 2, seq(1, 1).fn, [1], [0, 1, 3, 4, 5]);
    expect(json(s) === before).toBe(true);
  });
});

describe("actInspect — 가장 가까운 안 살핀 지점 하나 (D-13·D-14·D-21)", () => {
  it("지점 ① 에서 footprint n 3, ② 에서 cloth, ③ 에서는 eyes 의 좌석(1)이면 window · 아니면 dark", () => {
    const s = morning();
    const a = actInspect(s, idOf(s, 1), spotFx(2, 1));
    const b = actInspect(s, idOf(s, 1), spotFx(2, 2));
    const c = actInspect(s, idOf(s, 1), spotFx(2, 3));
    const d = actInspect(s, idOf(s, 3), spotFx(2, 3));
    expect(json([a.ok && [a.spot, cluesOf(a.state, 1)], b.ok && [b.spot, cluesOf(b.state, 1)], c.ok && [c.spot, cluesOf(c.state, 1)], d.ok && [d.spot, cluesOf(d.state, 3)]])).toBe(
      json([
        [1, '[{"spot":1,"kind":"footprint","n":3}]'],
        [2, '[{"spot":2,"kind":"cloth","piece":"blackCloth"}]'],
        [3, '[{"spot":3,"kind":"window","piece":"button"}]'],
        [3, '[{"spot":3,"kind":"dark"}]'],
      ]),
    );
  });

  it("같은 지점을 두 번 살피면 둘째는 { ok: false }, 다른 지점은 차례대로 쌓인다", () => {
    const s = morning();
    const first = actInspect(s, idOf(s, 1), spotFx(2, 1));
    if (!first.ok) throw new Error("first");
    const again = actInspect(first.state, idOf(s, 1), spotFx(2, 1));
    const next = actInspect(first.state, idOf(s, 1), spotFx(2, 2));
    expect(`${json(again)} ${next.ok ? cluesOf(next.state, 1) : "x"}`).toBe('{"ok":false} [{"spot":1,"kind":"footprint","n":3},{"spot":2,"kind":"cloth","piece":"blackCloth"}]');
  });

  it("반경 밖·morning 아님·현장 없음·유령·방에 없는 사람은 모두 같은 모양 {\"ok\":false} 이고 입력을 바꾸지 않는다", () => {
    const s = morning();
    const before = json(s);
    const ghost: RoomState = { ...s, players: s.players.map((p) => (p.seat === 1 ? { ...p, alive: false } : p)) };
    const { scene: _scene, ...noScene } = s;
    const got = [
      actInspect(s, idOf(s, 1), { x: 0, z: 0 }),
      actInspect({ ...s, phase: "discussion" }, idOf(s, 1), spotFx(2, 1)),
      actInspect(noScene as RoomState, idOf(s, 1), spotFx(2, 1)),
      actInspect(ghost, idOf(s, 1), spotFx(2, 1)),
      actInspect(s, "no-such-id", spotFx(2, 1)),
      actInspect({ ...s, map: "bar" }, idOf(s, 1), spotFx(2, 1)),
    ].map(json);
    expect(`${json(got)} ${json(s) === before}`).toBe(`${json(Array(6).fill('{"ok":false}'))} true`);
  });

  it("지점 중심에서 ERRAND_ACT_R(1.2) 안이면 받고 1.2 를 넘으면 받지 않는다", () => {
    const s = morning();
    const c = spotFx(2, 1);
    const near = actInspect(s, idOf(s, 1), { x: c.x + 100, z: c.z });
    const far = actInspect(s, idOf(s, 1), { x: c.x + 130, z: c.z });
    expect(`${near.ok}/${far.ok}`).toBe("true/false");
  });
});

describe("markSmudge — 산 마피아만 지점을 흐린다 (D-15·D-21)", () => {
  it("산 마피아 → smudged 에 더한 새 상태, 시민·죽은 마피아·방에 없는 사람·이미 흐린 지점은 같은 객체", () => {
    const s = morning();
    const dead: RoomState = { ...s, players: s.players.map((p) => (p.seat === 0 ? { ...p, alive: false } : p)) };
    const once = markSmudge(s, idOf(s, 0), 2);
    const twice = markSmudge(once, idOf(s, 4), 2);
    expect(json([once.scene?.smudged, markSmudge(s, idOf(s, 1), 2) === s, markSmudge(dead, idOf(s, 0), 2) === dead, markSmudge(s, "no-such-id", 2) === s, twice === once, s.scene?.smudged])).toBe("[[2],true,true,true,true,[]]");
  });

  it("마피아가 ② 를 먼저 살피면(본인은 cloth) 다음 시민은 touched", () => {
    const s = morning();
    const m = actInspect(s, idOf(s, 0), spotFx(2, 2));
    if (!m.ok) throw new Error("mafia");
    const afterM = markSmudge(m.state, idOf(s, 0), m.spot);
    const c = actInspect(afterM, idOf(s, 1), spotFx(2, 2));
    expect(`${cluesOf(afterM, 0)} ${c.ok ? cluesOf(c.state, 1) : "x"}`).toBe('[{"spot":2,"kind":"cloth","piece":"blackCloth"}] [{"spot":2,"kind":"touched"}]');
  });

  it("시민이 먼저 살피고 마피아가 뒤에 살피면 먼저 살핀 시민은 cloth 그대로, 마피아도 cloth, 그 뒤 사람이 touched", () => {
    const s = morning();
    const c = actInspect(s, idOf(s, 1), spotFx(2, 2));
    if (!c.ok) throw new Error("citizen");
    const afterC = markSmudge(c.state, idOf(s, 1), c.spot);
    const m = actInspect(afterC, idOf(s, 0), spotFx(2, 2));
    if (!m.ok) throw new Error("mafia");
    const afterM = markSmudge(m.state, idOf(s, 0), m.spot);
    const third = actInspect(afterM, idOf(s, 3), spotFx(2, 2));
    expect(`${cluesOf(afterM, 1)} ${cluesOf(afterM, 0)} ${third.ok ? cluesOf(third.state, 3) : "x"}`).toBe(
      '[{"spot":2,"kind":"cloth","piece":"blackCloth"}] [{"spot":2,"kind":"cloth","piece":"blackCloth"}] [{"spot":2,"kind":"touched"}]',
    );
  });

  it("역할이 다른 두 사람의 살피기 결과는 같은 모양이다(키 구조 — T-21-15)", () => {
    const s = morning();
    const keys = (seat: number): string => {
      const r = actInspect(s, idOf(s, seat), spotFx(2, 2));
      return r.ok ? json(Object.keys(markSmudge(r.state, idOf(s, seat), r.spot).players.find((p) => p.seat === seat)!.clues![0]!)) : "x";
    };
    expect(`${keys(0)} ${keys(1)}`).toBe('["spot","kind","piece"] ["spot","kind","piece"]');
  });
});

describe("clearScene", () => {
  it("scene 과 모든 clues 키를 지우고, 지울 것이 없으면 같은 객체다", () => {
    const s = morning();
    const got = actInspect(s, idOf(s, 1), spotFx(2, 1));
    if (!got.ok) throw new Error("inspect");
    const cleared = clearScene(got.state);
    const plain = baseState();
    expect(json(["scene" in cleared, cleared.players.some((p) => "clues" in p), clearScene(plain) === plain])).toBe("[false,false,true]");
  });
});

describe("소스 규약 (D-22)", () => {
  const strip = (rel: string): string =>
    readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
  it("scene.ts·mafiaTouch.ts 는 현재 시각·Math.random·DOM 을 쓰지 않는다", () => {
    for (const rel of ["shared/game/scene.ts", "shared/game/mafiaTouch.ts"]) {
      const src = strip(rel);
      expect(`${rel} ${/Date\.now|new Date|performance\.now|Math\.random|\bdocument\b|crypto\./.test(src)}`).toBe(`${rel} false`);
    }
  });
  it("scene.ts 는 역할을 읽지 않는다", () => {
    expect(/\.role\b|"mafia"|"citizen"|"doctor"|"police"/.test(strip("shared/game/scene.ts"))).toBe(false);
  });
});
