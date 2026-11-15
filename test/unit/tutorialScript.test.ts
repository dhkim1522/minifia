// 17-03·21-12: 첫 사건 대본 — 장면 표·가짜 view·로컬 어댑터 (TUT-03, TUT-05, TUT-06, 결정 0078-1·7, 0080-9·16·17, 21페이즈 D-20·D-28).
// 대본은 순수 데이터다. 실제 판정 함수(errandView·sceneView·boardView·traceMark)가 읽는 필드를 갖췄는지 그 함수로 확인한다.
// 새 흐름(등불 → 현장 → 보드)의 가짜 view 는 원인 흐름 판이라 이 시험은 openCause() 아래에서 돈다(단위 시험 setup 이 잠가 둔다).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { actablePlaceOf, errandProgress, placeCentersOf, startCardOn } from "../../src/game/errandView";
import { boardOf } from "../../src/game/boardView";
import { actableSpotOf, clueCardsOf, spotsOf } from "../../src/game/sceneView";
import { sameOutfitSeats } from "../../src/game/traceMark";
import { lineWalkable } from "../../shared/game/map";
import { mapOf } from "../../shared/game/maps";
import { TOWN_CLUE_SPOTS, TOWN_LAMPS } from "../../shared/game/mapTown";
import { ERRAND_ACT_R } from "../../shared/game/phases";
import { modeOf, rulesetOf } from "../../shared/game/ruleset";
import type { ClientMessage } from "../../shared/protocol";
import { openCause } from "../helpers/playable";

type ScriptModule = typeof import("../../src/game/tutorialScript");

/** 모듈이 있어야 한다는 단언을 import 오류가 아닌 실패 메시지로 남기려고 동적으로 가져온다 */
async function loadScript(): Promise<ScriptModule> {
  const mod = (await import("../../src/game/tutorialScript").catch(() => null)) as ScriptModule | null;
  expect(mod, "src/game/tutorialScript.ts 모듈이 있어야 한다").not.toBeNull();
  return mod!;
}

const NOW = 1_700_000_000_000;

let restoreCause: () => void = () => {};
beforeAll(() => {
  restoreCause = openCause();
});
afterAll(() => restoreCause());

describe("장면 표 8행 — 순서·그리는 방식·점·넘어가는 방식", () => {
  it("n 은 1~8 오름차순이고 id·render 가 계약 그대로다 (장면 수 8 그대로, D-28)", async () => {
    const { TUTORIAL_SCENES } = await loadScript();
    expect(TUTORIAL_SCENES.map((s) => s.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(TUTORIAL_SCENES.map((s) => s.id)).toEqual(["opening", "morning", "errand", "witness", "evidence", "vote", "roles", "end"]);
    expect(TUTORIAL_SCENES.map((s) => s.render)).toEqual(["stage", "map", "map", "map", "map", "map", "stage", "home"]);
  });

  it("진행 점은 장면 1~7 에만 있고 점 수는 7이다 (T-23)", async () => {
    const { TUTORIAL_SCENES, TUTORIAL_DOT_COUNT } = await loadScript();
    expect(TUTORIAL_DOT_COUNT).toBe(7);
    expect(TUTORIAL_SCENES.map((s) => s.dot)).toEqual([true, true, true, true, true, true, true, false]);
    expect(TUTORIAL_SCENES.filter((s) => s.dot)).toHaveLength(TUTORIAL_DOT_COUNT);
  });

  it("넘어가는 방식: 1 auto 4600 · 2 next 2600 · 3 act 700 · 4 inspect([살펴보기] 뒤 [다음]) · 5 next 0 · 6 pick 1100 · 7 next 0 · 8 end", async () => {
    const { TUTORIAL_SCENES } = await loadScript();
    expect(TUTORIAL_SCENES.map((s) => s.advance)).toEqual([
      { kind: "auto", afterMs: 4600 },
      { kind: "next", showAtMs: 2600 },
      { kind: "act", afterMs: 700 },
      { kind: "inspect" },
      { kind: "next", showAtMs: 0 },
      { kind: "pick", revealAfterMs: 1100 },
      { kind: "next", showAtMs: 0 },
      { kind: "end" },
    ]);
  });

  it("장면 3 의 소리·말·포커스: whoosh 0, 등불 문구 500, 포커스 errand 0~", async () => {
    const { TUTORIAL_SCENES } = await loadScript();
    const s3 = TUTORIAL_SCENES[2]!;
    expect(s3.beats).toEqual([
      { at: 0, sfx: "tut.whoosh" },
      { at: 500, say: "tutorial.errand" },
    ]);
    expect(s3.focus).toEqual([{ target: "errand", from: 0 }]);
  });

  it("상수: WRONG_HINT_AFTER 2 · OPENING_LAMPS 2 · TUTORIAL_END_CARD_ON_SKIP false", async () => {
    const m = await loadScript();
    expect(m.WRONG_HINT_AFTER).toBe(2);
    expect(m.OPENING_LAMPS).toBe(2);
    expect(m.TUTORIAL_END_CARD_ON_SKIP).toBe(false);
  });
});

describe("출연 상수 (T-9, D-28)", () => {
  it("여섯 좌석: 0 민준 detective · 1 도윤 noir · 2 서연 elder · 3 지호 reporter · 4 하린 hood · 5 나 coat", async () => {
    const { TUTORIAL_CAST } = await loadScript();
    expect(TUTORIAL_CAST.seats.map((s) => [s.seat, s.name, s.look])).toEqual([
      [0, "민준", "detective"],
      [1, "도윤", "noir"],
      [2, "서연", "elder"],
      [3, "지호", "reporter"],
      [4, "하린", "hood"],
      [5, "나", "coat"],
    ]);
    expect(TUTORIAL_CAST.me).toBe(5);
    expect(TUTORIAL_CAST.victim).toBe(2);
    expect(TUTORIAL_CAST.suspect).toBe(1);
  });

  it("출연 맵은 마을(town)이고 등불 셋은 마을 가로등 표의 id 다 (장면 3 의 목표가 첫째)", async () => {
    const { TUTORIAL_CAST } = await loadScript();
    expect(TUTORIAL_CAST.map).toBe("town");
    expect(TUTORIAL_CAST.errand.places).toHaveLength(3);
    for (const id of TUTORIAL_CAST.errand.places) expect(TOWN_LAMPS.map((l) => l.id)).toContain(id);
    expect(TUTORIAL_CAST.errand.target).toBe(TUTORIAL_CAST.errand.places[0]);
  });

  it("현장은 서연(좌석 2) 집이고 옷 조각 지점에서 붉은 천 조각을 받는다 (피해자 집 = 현장)", async () => {
    const { TUTORIAL_CAST } = await loadScript();
    expect(TUTORIAL_CAST.clue).toEqual({ house: 2, spot: "cloth", piece: "redCloth" });
    expect(TUTORIAL_CAST.clue.house).toBe(TUTORIAL_CAST.victim);
  });
});

describe("tutorialView(3) — 등불 켜기 장면의 가짜 view", () => {
  it("errand 단계·마감 없음·마을·원인 흐름 판·내 등불 목록이 실제 판정 함수가 읽는 모양이다", async () => {
    const { tutorialView, TUTORIAL_CAST } = await loadScript();
    const v = tutorialView(3, { now: NOW });
    expect(v.phase).toBe("errand");
    expect(v.phaseEndsAt).toBeNull();
    expect(v.map).toBe("town");
    expect(v.mode).toBe("extended");
    expect(rulesetOf(modeOf(v)).cause).toBe(true);
    expect(v.code).toBe("");
    expect(v.round).toBe(1);
    expect(v.serverNow).toBe(NOW);
    expect(v.me.seat).toBe(5);
    expect(v.me.isHost).toBe(false);
    expect(v.me.errand).toEqual({ places: [...TUTORIAL_CAST.errand.places], done: [] });
    expect(errandProgress(v)).toMatchObject({ n: 0, total: 3, complete: false });
    // phaseEndsAt 이 없으면 2초 시작 카드가 뜨지 않는다 (Pitfall 3a)
    expect(startCardOn(v, NOW)).toBe(false);
  });

  it("플레이어 여섯 명, 서연만 alive false, 닉네임 집합·look 이 출연표와 같다", async () => {
    const { tutorialView, TUTORIAL_CAST } = await loadScript();
    const v = tutorialView(3, { now: NOW });
    expect(v.players).toHaveLength(6);
    expect(new Set(v.players.map((p) => p.nickname))).toEqual(new Set(["민준", "도윤", "서연", "지호", "하린", "나"]));
    expect(v.players.filter((p) => p.alive === false).map((p) => p.seat)).toEqual([2]);
    for (const cast of TUTORIAL_CAST.seats) {
      const p = v.players.find((x) => x.seat === cast.seat)!;
      expect(p.nickname).toBe(cast.name);
      expect(p.look).toBe(cast.look);
      expect(p.connected).toBe(true);
    }
  });

  it("가로등 중심은 마을 맵의 가로등 표에서 온다(원인 흐름이라 장소 표가 아니다)", async () => {
    const { tutorialView, TUTORIAL_CAST } = await loadScript();
    const centers = placeCentersOf(tutorialView(3, { now: NOW }));
    expect(centers.map((c) => c.id).sort()).toEqual([...TUTORIAL_CAST.errand.places].sort());
    for (const c of centers) {
      const lamp = TOWN_LAMPS.find((l) => l.id === c.id)!;
      expect([c.x, c.z]).toEqual([lamp.x, lamp.z]);
    }
  });

  it("시작 자리는 걸을 수 있는 칸이고 목표 가로등이 처리 반경 안에 있어 [켜기] 가 바로 켜진다, 다른 가로등은 반경 밖이다 (T-14)", async () => {
    const { tutorialView, tutorialSnap, TUTORIAL_CAST } = await loadScript();
    const v = tutorialView(3, { now: NOW });
    const centers = placeCentersOf(v);
    const snap = tutorialSnap(3, NOW);
    const me = snap.ents[0]!;
    expect(lineWalkable(mapOf("town"), { x: me.p[0]!, z: me.p[1]! }, { x: me.p[0]!, z: me.p[1]! })).toBe(true);
    const pos = { x: me.p[0]! / 100, z: me.p[1]! / 100 };
    const target = centers.find((c) => c.id === TUTORIAL_CAST.errand.target)!;
    expect(Math.hypot(target.x - pos.x, target.z - pos.z)).toBeLessThan(ERRAND_ACT_R);
    expect(actablePlaceOf(pos, centers, [])).toBe(TUTORIAL_CAST.errand.target);
    for (const c of centers) {
      if (c.id === target.id) continue;
      expect(Math.hypot(c.x - pos.x, c.z - pos.z), c.id).toBeGreaterThan(ERRAND_ACT_R);
    }
  });

  it("lit 이면 목표 등불이 켜진 뒤(done [목표], 진행 1/3)다", async () => {
    const { tutorialView, TUTORIAL_CAST } = await loadScript();
    const v = tutorialView(3, { now: NOW, lit: true });
    expect(v.phase).toBe("errand");
    expect(v.me.errand).toEqual({ places: [...TUTORIAL_CAST.errand.places], done: [TUTORIAL_CAST.errand.target] });
    expect(errandProgress(v)).toMatchObject({ n: 1, total: 3 });
  });

  it("매번 새 객체다 (호출 사이에 값이 새지 않는다)", async () => {
    const { tutorialView } = await loadScript();
    const a = tutorialView(3, { now: NOW });
    const b = tutorialView(3, { now: NOW });
    expect(a).not.toBe(b);
    a.me.errand!.done.push("lamp2");
    expect(b.me.errand!.done).toEqual([]);
  });
});

describe("tutorialView(4) — 현장 조사 장면: 서연 집 앞 지점 셋 (D-28)", () => {
  it("morning 단계·현장 집 = 서연 좌석(2)·아직 살피지 않음(me.scene 없음)", async () => {
    const { tutorialView } = await loadScript();
    const v = tutorialView(4, { now: NOW });
    expect(v.phase).toBe("morning");
    expect(v.map).toBe("town");
    expect(v.mode).toBe("extended");
    expect(v.day?.scene).toEqual({ house: 2 });
    expect(v.me.scene).toBeUndefined();
    expect(v.me.errand).toBeUndefined();
    expect(clueCardsOf(v)).toEqual([]);
  });

  it("지점 셋은 서연 집 앞 TOWN_CLUE_SPOTS[2] 이고 모두 새 지점이다", async () => {
    const { tutorialView } = await loadScript();
    const spots = spotsOf(tutorialView(4, { now: NOW }));
    expect(spots.map((s) => s.id)).toEqual(["footprint", "cloth", "window"]);
    expect(spots.map((s) => [s.x * 100, s.z * 100])).toEqual(TOWN_CLUE_SPOTS[2]!.map((p) => [p.x, p.z]));
    expect(spots.every((s) => s.state === "new")).toBe(true);
  });

  it("시작 자리는 걸을 수 있는 칸이고 처리 반경 안에서 옷 조각 지점이 가장 가깝다([살펴보기] 가 옷 조각에 선다)", async () => {
    const { tutorialView, tutorialSnap } = await loadScript();
    const spots = spotsOf(tutorialView(4, { now: NOW }));
    const me = tutorialSnap(4, NOW).ents[0]!;
    expect(lineWalkable(mapOf("town"), { x: me.p[0]!, z: me.p[1]! }, { x: me.p[0]!, z: me.p[1]! })).toBe(true);
    const pos = { x: me.p[0]! / 100, z: me.p[1]! / 100 };
    expect(actableSpotOf(pos, spots)).toBe("cloth");
    const cloth = spots.find((s) => s.id === "cloth")!;
    expect(Math.hypot(cloth.x - pos.x, cloth.z - pos.z)).toBeLessThan(ERRAND_ACT_R);
  });

  it("inspected 면 옷 조각 clue(붉은 천 조각) 한 줄이 me.scene 에 있고 단서 카드 한 장·옷 조각 지점이 done 이다", async () => {
    const { tutorialView } = await loadScript();
    const v = tutorialView(4, { now: NOW, inspected: true });
    expect(v.me.scene).toEqual([{ spot: "cloth", r: "clue", piece: "redCloth" }]);
    expect(clueCardsOf(v)).toEqual([{ spot: "cloth", kind: "clue", piece: "redCloth" }]);
    expect(spotsOf(v).find((s) => s.id === "cloth")?.state).toBe("done");
  });
});

describe("tutorialView(5) — 의심 보드 장면: boardOf 가 읽는 가짜 view (D-20)", () => {
  it("토론 단계이고 boardOf 가 칩 하나(붉은 천 조각)·산 사람 다섯 얼굴·등불 8점을 돌려준다", async () => {
    const { tutorialView } = await loadScript();
    const v = tutorialView(5, { now: NOW });
    expect(v.phase).toBe("discussion");
    expect(v.mode).toBe("extended");
    const board = boardOf(v);
    expect(board.chips).toEqual([{ spot: "cloth", kind: "clue", piece: "redCloth" }]);
    expect(board.faces.map((f) => f.seat)).toEqual([0, 1, 3, 4, 5]);
    expect(board.lamps).toHaveLength(8);
    expect(board.witness).toBeNull();
  });

  it("같은 옷 표시는 도윤(좌석 1) 하나뿐이고 옷 조각 표시(cloth)다", async () => {
    const { tutorialView } = await loadScript();
    const v = tutorialView(5, { now: NOW });
    expect(sameOutfitSeats(v.players, "redCloth")).toEqual([1]);
    const marked = boardOf(v).faces.filter((f) => f.marks.length > 0);
    expect(marked.map((f) => f.seat)).toEqual([1]);
    expect(marked[0]!.marks).toEqual([{ kind: "cloth", piece: "redCloth" }]);
  });

  it("공개 증거 카드(day.evidence·morning.trace)가 없다 — 원인 흐름은 단서를 내가 직접 받는다", async () => {
    const { tutorialView } = await loadScript();
    const v = tutorialView(5, { now: NOW });
    expect(v.day?.evidence).toBeUndefined();
    expect(v.day?.morning).toBeUndefined();
  });
});

describe("makeTutorialSend — 로컬 어댑터는 errand·inspect·point 만 알아듣는다 (TUT-05)", () => {
  async function harness(): Promise<{ send: (m: ClientMessage) => boolean; errands: number; inspects: number; points: number[] }> {
    const { makeTutorialSend } = await loadScript();
    const log = { errands: 0, inspects: 0, points: [] as number[] };
    const send = makeTutorialSend({
      onErrand: () => void (log.errands += 1),
      onInspect: () => void (log.inspects += 1),
      onPoint: (seat) => void log.points.push(seat),
    });
    return {
      send,
      get errands() {
        return log.errands;
      },
      get inspects() {
        return log.inspects;
      },
      get points() {
        return log.points;
      },
    };
  }

  it("errand → onErrand 한 번, true (길게 누르기 hold 도 같다)", async () => {
    const h = await harness();
    expect(h.send({ t: "errand" })).toBe(true);
    expect(h.send({ t: "errand", hold: true })).toBe(true);
    expect(h.errands).toBe(2);
    expect(h.inspects).toBe(0);
    expect(h.points).toEqual([]);
  });

  it("inspect → onInspect 한 번, true", async () => {
    const h = await harness();
    expect(h.send({ t: "inspect" })).toBe(true);
    expect(h.inspects).toBe(1);
    expect(h.errands).toBe(0);
  });

  it("point(target 1) → onPoint(1) 한 번, true", async () => {
    const h = await harness();
    expect(h.send({ t: "point", target: 1 })).toBe(true);
    expect(h.points).toEqual([1]);
    expect(h.errands).toBe(0);
    expect(h.inspects).toBe(0);
  });

  it("move·chat·typing·emote 는 아무 일 없이 true 이다", async () => {
    const h = await harness();
    const others: ClientMessage[] = [
      { t: "move", x: 10, z: 20 },
      { t: "typing", on: true, pk: "p" },
      { t: "emote", id: "clap", pk: "p" },
    ];
    for (const m of others) expect(h.send(m)).toBe(true);
    expect(h.errands).toBe(0);
    expect(h.inspects).toBe(0);
    expect(h.points).toEqual([]);
  });
});

// ---- 장면 1·2·4~8 ----

/** 소리 큐 13개(tut.* 12 + ui.tap) — 소리 모듈의 SFX_IDS 와의 대조는 17-04 시험 */
const CUES = ["tut.lampOff", "tut.scream", "tut.whoosh", "tut.sting", "tut.step", "tut.eye", "tut.link", "tut.buzz", "tut.stamp", "tut.fanfare", "tut.flip", "tut.warm", "ui.tap"];

describe("장면 시각·소리·말·포커스", () => {
  it("1 오프닝: lampOff 800·1300, scream 2600, 포커스 없음 (큐 그대로, D-28)", async () => {
    const { TUTORIAL_SCENES } = await loadScript();
    const s = TUTORIAL_SCENES[0]!;
    expect(s.beats).toEqual([
      { at: 800, sfx: "tut.lampOff" },
      { at: 1300, sfx: "tut.lampOff" },
      { at: 2600, sfx: "tut.scream" },
    ]);
    expect(s.focus).toEqual([]);
  });

  it("2 아침: whoosh+victim 0, sting+mafia 2600, 포커스 band 0~2600", async () => {
    const { TUTORIAL_SCENES } = await loadScript();
    const s = TUTORIAL_SCENES[1]!;
    expect(s.beats).toEqual([
      { at: 0, sfx: "tut.whoosh", say: "tutorial.morning.victim" },
      { at: 2600, sfx: "tut.sting", say: "tutorial.morning.mafia" },
    ]);
    expect(s.focus).toEqual([{ target: "band", from: 0, to: 2600 }]);
  });

  it("4 현장 조사: whoosh 0, 문구 500, 포커스 clue 0~ — 도윤 걷는 소리·눈 큐가 없다(목격 연출 뺌)", async () => {
    const { TUTORIAL_SCENES } = await loadScript();
    const s = TUTORIAL_SCENES[3]!;
    expect(s.beats).toEqual([
      { at: 0, sfx: "tut.whoosh" },
      { at: 500, say: "tutorial.witness" },
    ]);
    expect(s.focus).toEqual([{ target: "clue", from: 0 }]);
    expect(s.beats.some((b) => b.sfx === "tut.step" || b.sfx === "tut.eye")).toBe(false);
  });

  it("5 의심 보드: 선 하나라 link 400 한 번, 문구 900, 포커스 없음", async () => {
    const { TUTORIAL_SCENES } = await loadScript();
    const s = TUTORIAL_SCENES[4]!;
    expect(s.beats).toEqual([
      { at: 400, sfx: "tut.link" },
      { at: 900, say: "tutorial.link" },
    ]);
    expect(s.focus).toEqual([]);
  });

  it("6 투표: whoosh+vote 0, 포커스 pickTags 0~", async () => {
    const { TUTORIAL_SCENES } = await loadScript();
    const s = TUTORIAL_SCENES[5]!;
    expect(s.beats).toEqual([{ at: 0, sfx: "tut.whoosh", say: "tutorial.vote" }]);
    expect(s.focus).toEqual([{ target: "pickTags", from: 0 }]);
  });

  it("7 직업 카드: flip 100·450·800·1150, 문구 1500", async () => {
    const { TUTORIAL_SCENES } = await loadScript();
    const s = TUTORIAL_SCENES[6]!;
    expect(s.beats).toEqual([
      { at: 100, sfx: "tut.flip" },
      { at: 450, sfx: "tut.flip" },
      { at: 800, sfx: "tut.flip" },
      { at: 1150, sfx: "tut.flip" },
      { at: 1500, say: "tutorial.roles" },
    ]);
    expect(s.focus).toEqual([]);
  });

  it("8 마무리: warm 0, 말 없음", async () => {
    const { TUTORIAL_SCENES } = await loadScript();
    const s = TUTORIAL_SCENES[7]!;
    expect(s.beats).toEqual([{ at: 0, sfx: "tut.warm" }]);
    expect(s.focus).toEqual([]);
  });

  it("모든 beats 는 시각 오름차순이고 소리 큐는 13개 집합 안, 문구 키는 문구 표 안이다", async () => {
    const { TUTORIAL_SCENES, TUTORIAL_LINES } = await loadScript();
    for (const scene of TUTORIAL_SCENES) {
      const ats = scene.beats.map((b) => b.at);
      expect(ats, `장면 ${scene.n}`).toEqual([...ats].sort((a, b) => a - b));
      for (const b of scene.beats) {
        if (b.sfx !== undefined) expect(CUES).toContain(b.sfx);
        if (b.say !== undefined) expect(Object.keys(TUTORIAL_LINES)).toContain(b.say);
      }
    }
  });

  it("포커스 창은 from < to(있을 때) 이고 장면 안 시각이다", async () => {
    const { TUTORIAL_SCENES } = await loadScript();
    for (const scene of TUTORIAL_SCENES) {
      for (const w of scene.focus) {
        expect(w.from).toBeGreaterThanOrEqual(0);
        if (w.to !== undefined) expect(w.to).toBeGreaterThan(w.from);
      }
    }
  });
});

describe("사회자 문구 9개 — UI-SPEC 튜토리얼 표와 한 글자도 다르지 않다 (T-7, D-20·D-28)", () => {
  it.each([
    ["tutorial.morning.victim", "서연 님이 당했습니다"],
    ["tutorial.morning.mafia", "이 중에 마피아가 있습니다"],
    ["tutorial.errand", "등불을 켜 보세요"],
    ["tutorial.witness", "빛나는 곳을 살펴보세요"],
    ["tutorial.link", "단서와 같은 옷을 이어 보세요"],
    ["tutorial.vote", "의심되는 사람을 누르세요"],
    ["tutorial.vote.wrong", "단서를 떠올려 보세요"],
    ["tutorial.hidden", "정체는 판이 끝나야 알아요"],
    ["tutorial.roles", "밤에는 저마다 할 일이 있어요"],
  ] as const)("%s", async (key, text) => {
    const { TUTORIAL_LINES } = await loadScript();
    expect(TUTORIAL_LINES[key]).toBe(text);
  });

  it("키는 정확히 9개다", async () => {
    const { TUTORIAL_LINES } = await loadScript();
    expect(Object.keys(TUTORIAL_LINES)).toHaveLength(9);
  });

  it("TUTORIAL_PICK: 정답 stamp 하나, 오답 buzz+오답 문구, 정체 공개는 소리 없이 tutorial.hidden 줄 (fanfare 없음)", async () => {
    const { TUTORIAL_PICK, TUTORIAL_SCENES } = await loadScript();
    expect(TUTORIAL_PICK).toEqual({
      right: { sfx: "tut.stamp" },
      wrong: { sfx: "tut.buzz", say: "tutorial.vote.wrong" },
      reveal: { line: "tutorial.hidden" },
    });
    expect(JSON.stringify(TUTORIAL_PICK)).not.toContain("tut.fanfare");
    for (const s of TUTORIAL_SCENES) expect(s.beats.some((b) => b.sfx === "tut.fanfare"), `장면 ${s.n}`).toBe(false);
  });
});

describe("tutorialView(2·6) — 아침·투표 장면", () => {
  it("장면 2: 아침·마감 없음·서연 탈락, 현장(day.scene)이 없어 지점이 뜨지 않는다", async () => {
    const { tutorialView } = await loadScript();
    const v = tutorialView(2, { now: NOW });
    expect(v.phase).toBe("morning");
    expect(v.phaseEndsAt).toBeNull();
    expect(v.day?.morning).toEqual({ eliminated: 2 });
    expect(v.day?.scene).toBeUndefined();
    expect(spotsOf(v)).toEqual([]);
  });

  it("장면 6: 지목 단계·지목 줄 비어 있음·공개 증거 없음·차례 없음, picked 면 나(5) → 도윤(1) 한 줄", async () => {
    const { tutorialView } = await loadScript();
    const v = tutorialView(6, { now: NOW });
    expect(v.phase).toBe("nomination");
    expect(v.day?.points).toEqual([]);
    expect(v.day?.turn).toBeUndefined();
    expect(v.day?.evidence).toBeUndefined();
    const picked = tutorialView(6, { now: NOW, picked: true });
    expect(picked.day?.points).toEqual([{ seat: 5, target: 1 }]);
  });

  it("지도 장면(2~6) 모두 마을·원인 흐름 판·여섯 명·서연 탈락이고 닉네임은 출연 상수뿐이다", async () => {
    const { tutorialView } = await loadScript();
    for (const n of [2, 3, 4, 5, 6] as const) {
      const v = tutorialView(n, { now: NOW });
      expect(v.map, `장면 ${n}`).toBe("town");
      expect(v.mode, `장면 ${n}`).toBe("extended");
      expect(v.players.map((p) => p.nickname).sort()).toEqual(["나", "도윤", "민준", "서연", "지호", "하린"].sort());
      expect(v.players.find((p) => p.seat === 2)?.alive).toBe(false);
    }
  });
});

/** 객체의 모든 키 경로(배열은 [] 로 접는다) */
function keyPaths(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) return value.flatMap((x) => keyPaths(x, `${prefix}[]`));
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => [`${prefix}.${k}`, ...keyPaths(v, `${prefix}.${k}`)]);
  }
  return [];
}

describe("역할이 새지 않는다 (TUT-05, T-17-08, T-21-42)", () => {
  it("가짜 view 어디에도 .me.role·.me.allies·.players[].role 키가 없다 (지도 2~6 의 모든 상태 + 무대 1·7)", async () => {
    const { tutorialView, tutorialStageView } = await loadScript();
    const views = [
      ...([2, 3, 4, 5, 6] as const).map((n) => tutorialView(n, { now: NOW, picked: true, lit: true, inspected: true })),
      tutorialView(3, { now: NOW }),
      tutorialView(4, { now: NOW }),
      tutorialStageView(1, NOW),
      tutorialStageView(7, NOW),
    ];
    for (const v of views) {
      const paths = keyPaths(v);
      expect(paths).not.toContain(".me.role");
      expect(paths).not.toContain(".me.allies");
      expect(paths).not.toContain(".players[].role");
      expect(paths.some((p) => /\.role$|\.allies$/.test(p))).toBe(false);
    }
  });
});

describe("무대 장면(1·7) — tutorialStageView·tutorialStageLook", () => {
  it("무대 view 는 night 단계·마을·원인 흐름 판·여섯 명이고 7 에서는 서연이 탈락이다", async () => {
    const { tutorialStageView } = await loadScript();
    const v1 = tutorialStageView(1, NOW);
    expect(v1.phase).toBe("night");
    expect(v1.map).toBe("town");
    expect(v1.mode).toBe("extended");
    expect(v1.players).toHaveLength(6);
    expect(v1.players.find((p) => p.seat === 2)?.alive).not.toBe(false);
    const v7 = tutorialStageView(7, NOW);
    expect(v7.players.find((p) => p.seat === 2)?.alive).toBe(false);
  });

  it("장면 1 의 집 창: 처음엔 여덟 모두 켜져 있고 lampsOff 만큼 하나씩 꺼진다 (D-28 개관 시점)", async () => {
    const { tutorialStageView, OPENING_LAMPS, OPENING_DARK_HOUSES } = await loadScript();
    expect(OPENING_DARK_HOUSES).toHaveLength(OPENING_LAMPS);
    const lamps = (k: number) => tutorialStageView(1, NOW, { lampsOff: k }).day?.lamps;
    expect(lamps(0)).toEqual(Array.from({ length: 8 }, () => true));
    for (let k = 1; k <= OPENING_LAMPS; k += 1) {
      const l = lamps(k)!;
      expect(l.filter((on) => !on), `꺼진 창 ${k}`).toHaveLength(k);
      for (const house of OPENING_DARK_HOUSES.slice(0, k)) expect(l[house]).toBe(false);
    }
  });

  it("장면 1 의 카메라는 개관(overview), 낮 쪽엔 서연 좌석이 보이고 조명은 night 가 아니다", async () => {
    const { tutorialStageLook } = await loadScript();
    const look = tutorialStageLook(1, { night: false, victimGone: false });
    expect(look.seats[2]?.show).toBe(true);
    expect(look.seats[2]?.opacity ?? 1).toBeGreaterThan(0);
    expect(look.lighting).not.toBe("night");
    expect(look.camera).toEqual({ mode: "overview" });
  });

  it("night·victimGone 이면 조명 night, 서연 좌석은 없거나 불투명도 0", async () => {
    const { tutorialStageLook } = await loadScript();
    for (const n of [1, 7] as const) {
      const look = tutorialStageLook(n, { night: true, victimGone: true });
      expect(look.lighting).toBe("night");
      const seat = look.seats[2];
      expect(seat === undefined || seat.opacity === 0).toBe(true);
      // 나머지 다섯은 그대로 보인다
      for (const s of [0, 1, 3, 4, 5]) expect(look.seats[s]?.show).toBe(true);
    }
  });

  it("장면 7 의 카메라는 광장 가운데에 고정이다", async () => {
    const { tutorialStageLook } = await loadScript();
    const cam = tutorialStageLook(7, { night: true, victimGone: true }).camera;
    expect(cam).toMatchObject({ mode: "fixed", target: { x: 0, z: 0 } });
  });
});

describe("tutorialSnap — 서버와 같은 구간 단위", () => {
  it("1 = 여섯, 2·5·6·7 = 산 사람 다섯(서연 없음), 3·4 = 나 하나", async () => {
    const { tutorialSnap } = await loadScript();
    expect(tutorialSnap(1, NOW).ents.map((e) => e.s)).toEqual([0, 1, 2, 3, 4, 5]);
    for (const n of [2, 5, 6, 7] as const) expect(tutorialSnap(n, NOW).ents.map((e) => e.s), `장면 ${n}`).toEqual([0, 1, 3, 4, 5]);
    for (const n of [3, 4] as const) expect(tutorialSnap(n, NOW).ents.map((e) => e.s), `장면 ${n}`).toEqual([5]);
  });

  it("모든 snap 자리는 마을 맵에서 걸을 수 있는 곳이다", async () => {
    const { tutorialSnap } = await loadScript();
    const map = mapOf("town");
    for (const n of [1, 2, 3, 4, 5, 6, 7] as const) {
      for (const e of tutorialSnap(n, NOW).ents) {
        const p = { x: e.p[0]!, z: e.p[1]! };
        expect(lineWalkable(map, p, p), `장면 ${n} 좌석 ${e.s}`).toBe(true);
      }
    }
  });

  it("도윤 자리는 다른 좌석과 1.2 이상 떨어져 있다 (18-08, D-07)", async () => {
    const { TUTORIAL_SPOTS } = await loadScript();
    const me = TUTORIAL_SPOTS[1]!;
    for (const [seat, p] of Object.entries(TUTORIAL_SPOTS)) {
      if (Number(seat) === 1) continue;
      expect(Math.hypot(p.x - me.x, p.z - me.z), `좌석 ${seat}`).toBeGreaterThanOrEqual(1.2);
    }
  });

  it("장면 4 의 내 자리는 서연 집 앞 지점 가까이(3 안)다 — 같은 상수에서 읽는다", async () => {
    const { TUTORIAL_CLUE_START, TUTORIAL_CAST } = await loadScript();
    const cloth = TOWN_CLUE_SPOTS[TUTORIAL_CAST.clue.house]![1]!;
    expect(Math.hypot(cloth.x / 100 - TUTORIAL_CLUE_START.x, cloth.z / 100 - TUTORIAL_CLUE_START.z)).toBeLessThan(ERRAND_ACT_R);
  });
});

describe("튜토리얼 카메라 (P18-8, D-07)", () => {
  it("TUTORIAL_FIXED_CAMERA 는 광장 가운데 고정·줌 1 이다", async () => {
    const { TUTORIAL_FIXED_CAMERA } = await loadScript();
    expect(TUTORIAL_FIXED_CAMERA).toEqual({ mode: "fixed", target: { x: 0, z: 0 }, zoom: 1 });
  });

  it.each([2, 5, 6])("장면 %i 은 고정 카메라", async (n) => {
    const { tutorialCameraOf, TUTORIAL_FIXED_CAMERA } = await loadScript();
    expect(tutorialCameraOf(n) === TUTORIAL_FIXED_CAMERA, "고정 카메라 상수를 돌려준다").toBe(true);
  });

  it.each([1, 3, 4, 7])("장면 %i 은 덮어쓰지 않는다(undefined)", async (n) => {
    const { tutorialCameraOf } = await loadScript();
    expect(tutorialCameraOf(n) === undefined).toBe(true);
  });
});
