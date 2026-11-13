// 17-03: 첫 사건 대본 — 장면 표·가짜 view·로컬 어댑터 (TUT-03, TUT-05, 결정 0078-1·7, 0080-9·16·17).
// 대본은 순수 데이터다. 실제 판정 함수(errandView·traceMark·recordView)가 읽는 필드를 갖췄는지 그 함수로 확인한다.
import { describe, expect, it } from "vitest";
import { actablePlaceOf, errandProgress, placeCentersOf, startCardOn } from "../../src/game/errandView";
import { boardMarksOf, clueChipsOf, clueSpotStates, houseNightOf, housePlatesOf, lampsOffOf, sceneMorningOf } from "../../src/game/causalView";
import { sameOutfitSeats } from "../../src/game/traceMark";
import { lineWalkable } from "../../shared/game/map";
import { TOWN_CLUE_SPOTS, TOWN_LAMPS } from "../../shared/game/mapTown";
import { GATHER_CENTER } from "../../src/world/camera";
import { mapOf } from "../../shared/game/maps";
import { ERRAND_ACT_R } from "../../shared/game/phases";
import { modeOf, rulesetOf } from "../../shared/game/ruleset";
import type { ClientMessage } from "../../shared/protocol";

type ScriptModule = typeof import("../../src/game/tutorialScript");

/** 모듈이 있어야 한다는 단언을 import 오류가 아닌 실패 메시지로 남기려고 동적으로 가져온다 */
async function loadScript(): Promise<ScriptModule> {
  const mod = (await import("../../src/game/tutorialScript").catch(() => null)) as ScriptModule | null;
  expect(mod, "src/game/tutorialScript.ts 모듈이 있어야 한다").not.toBeNull();
  return mod!;
}

const NOW = 1_700_000_000_000;

describe("장면 표 8행 — 순서·그리는 방식·점·넘어가는 방식", () => {
  it("n 은 1~8 오름차순이고 id·render 가 계약 그대로다", async () => {
    const { TUTORIAL_SCENES } = await loadScript();
    expect(TUTORIAL_SCENES.map((s) => s.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(TUTORIAL_SCENES.map((s) => s.id)).toEqual(["opening", "morning", "errand", "house", "scene", "vote", "roles", "end"]);
    expect(TUTORIAL_SCENES.map((s) => s.render)).toEqual(["stage", "map", "map", "map", "map", "map", "stage", "home"]);
  });

  it("진행 점은 장면 1~7 에만 있고 점 수는 7이다 (T-23)", async () => {
    const { TUTORIAL_SCENES, TUTORIAL_DOT_COUNT } = await loadScript();
    expect(TUTORIAL_DOT_COUNT).toBe(7);
    expect(TUTORIAL_SCENES.map((s) => s.dot)).toEqual([true, true, true, true, true, true, true, false]);
    expect(TUTORIAL_SCENES.filter((s) => s.dot)).toHaveLength(TUTORIAL_DOT_COUNT);
  });

  it("넘어가는 방식: 1 auto 4600 · 2 next 4000 · 3 act 1600 · 4 step 700 · 5 step 1200 · 6 pick 1100 · 7 next 0 · 8 end", async () => {
    const { TUTORIAL_SCENES } = await loadScript();
    expect(TUTORIAL_SCENES.map((s) => s.advance)).toEqual([
      { kind: "auto", afterMs: 4600 },
      { kind: "next", showAtMs: 4000 },
      { kind: "act", afterMs: 1600 },
      { kind: "step", afterMs: 700 },
      { kind: "step", afterMs: 1200 },
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

describe("출연 상수 (T-9)", () => {
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
    expect(TUTORIAL_CAST.map).toBe("town");
    expect(TUTORIAL_CAST.errand.places).toContain("lamp5");
    expect(TUTORIAL_CAST.errand.places).not.toContain("lamp2");
    expect(TUTORIAL_CAST.errand.places).toHaveLength(3);
    expect(TUTORIAL_CAST.errand.target).toBe("lamp5");
    expect("witness" in TUTORIAL_CAST).toBe(false);
    expect(TUTORIAL_CAST.trace).toBe("redCloth");
  });
});

describe("tutorialView(3) — 저녁 등불 장면의 가짜 view", () => {
  it("errand 단계·마감 없음·마을·확장판·내 등불 목록이 실제 판정 함수가 읽는 모양이다", async () => {
    const { tutorialView } = await loadScript();
    const v = tutorialView(3, { now: NOW });
    expect(v.phase).toBe("errand");
    expect(v.phaseEndsAt).toBeNull();
    expect(v.map).toBe("town");
    expect(v.mode).toBe("extended");
    expect(v.code).toBe("");
    expect(v.round).toBe(1);
    expect(v.serverNow).toBe(NOW);
    expect(v.me.seat).toBe(5);
    expect(v.me.isHost).toBe(false);
    expect(v.me.errand).toEqual({ places: ["lamp5", "lamp6", "lamp4"], done: [] });
    expect(errandProgress(v)).toMatchObject({ n: 0, total: 3, complete: false });
    expect(v.day?.lamps).toEqual([]);
    // phaseEndsAt 이 없으면 2초 시작 카드가 뜨지 않는다 (Pitfall 3a)
    expect(startCardOn(v, NOW)).toBe(false);
  });

  it("플레이어 여섯 명, 저녁에는 모두 살아 있고 닉네임 집합·look 이 출연표와 같다", async () => {
    const { tutorialView, TUTORIAL_CAST } = await loadScript();
    const v = tutorialView(3, { now: NOW });
    expect(v.players).toHaveLength(6);
    expect(new Set(v.players.map((p) => p.nickname))).toEqual(new Set(["민준", "도윤", "서연", "지호", "하린", "나"]));
    expect(v.players.filter((p) => p.alive === false).map((p) => p.seat)).toEqual([]);
    for (const cast of TUTORIAL_CAST.seats) {
      const p = v.players.find((x) => x.seat === cast.seat)!;
      expect(p.nickname).toBe(cast.name);
      expect(p.look).toBe(cast.look);
      expect(p.connected).toBe(true);
    }
  });

  it("시작 위치에서 내 집 가로등(lamp5)까지 거리가 처리 반경 안이라 [켜기] 가 바로 켜지고 나머지 둘은 밖이다 (T-14)", async () => {
    const { tutorialView, tutorialSnap } = await loadScript();
    const v = tutorialView(3, { now: NOW });
    const centers = placeCentersOf(v);
    expect(centers.map((c) => c.id).sort()).toEqual(["lamp4", "lamp5", "lamp6"]);
    const snap = tutorialSnap(3, NOW);
    const me = snap.ents[0]!;
    const pos = { x: me.p[0]! / 100, z: me.p[1]! / 100 };
    const lamp5 = centers.find((c) => c.id === "lamp5")!;
    expect(Math.hypot(lamp5.x - pos.x, lamp5.z - pos.z)).toBeLessThan(ERRAND_ACT_R);
    expect(actablePlaceOf(pos, centers, [])).toBe("lamp5");
    // 서연(2) 집 가로등은 목록에 없다
    expect(centers.some((c) => c.id === "lamp2")).toBe(false);
  });

  it("시작 자리는 가로등 5 장소 중심에서 처리 반경 안의 걷는 칸이다", async () => {
    const { TUTORIAL_START } = await loadScript();
    const lamp5 = TOWN_LAMPS[5]!;
    expect(Math.hypot(lamp5.x - TUTORIAL_START.x, lamp5.z - TUTORIAL_START.z)).toBeLessThanOrEqual(ERRAND_ACT_R);
    expect(lineWalkable(mapOf("town"), TUTORIAL_START, TUTORIAL_START)).toBe(true);
  });

  it("[켜기] 뒤(lit)에는 done [lamp5] 이고 켜진 가로등 5 가 공개 값에 든다", async () => {
    const { tutorialView } = await loadScript();
    const v = tutorialView(3, { now: NOW, lit: true });
    expect(v.me.errand).toEqual({ places: ["lamp5", "lamp6", "lamp4"], done: ["lamp5"] });
    expect(errandProgress(v)).toMatchObject({ n: 1, total: 3 });
    expect(v.day?.lamps).toEqual([5]);
  });

  it("매번 새 객체다 (호출 사이에 값이 새지 않는다)", async () => {
    const { tutorialView } = await loadScript();
    const a = tutorialView(3, { now: NOW });
    const b = tutorialView(3, { now: NOW });
    expect(a).not.toBe(b);
    a.me.errand!.done.push("lamp5");
    expect(b.me.errand!.done).toEqual([]);
  });
});

describe("tutorialView(4) · tutorialSnap(3) — 밤 집 찾기", () => {
  it("장면 4 는 마을의 밤이고 집 판이 서는 확장판 화면이다(houseNightOf)", async () => {
    const { tutorialView } = await loadScript();
    const v = tutorialView(4, { now: NOW });
    expect(v.phase).toBe("night");
    expect(v.map).toBe("town");
    expect(houseNightOf(v)).toBe(true);
    expect(rulesetOf(modeOf(v)).errand).toBe(true);
    expect(v.me.pick).toBeUndefined();
  });

  it("집 판은 여섯 채다(밤에는 모두 살아 있다) — 나는 5 이고 서연 집만 창이 꺼져 있다", async () => {
    const { tutorialView } = await loadScript();
    const v = tutorialView(4, { now: NOW });
    expect(housePlatesOf(v).map((p) => p.seat)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(housePlatesOf(v).find((p) => p.me)?.seat).toBe(5);
    expect(v.day?.lamps).toEqual([0, 1, 3, 4, 5]);
  });

  it("집을 고르면(house) 내 선택(me.pick)이 view 에 든다", async () => {
    const { tutorialView } = await loadScript();
    expect(tutorialView(4, { now: NOW, house: 3 }).me.pick).toBe(3);
  });

  it("장면 3 의 snap 은 나(5) 하나이고 서버와 같은 구간 모양(snap·t0·v)이다", async () => {
    const { tutorialSnap } = await loadScript();
    const f = tutorialSnap(3, NOW);
    expect(f.t).toBe("world");
    expect(f.k).toBe("snap");
    expect(f.ents.map((e) => e.s)).toEqual([5]);
    expect(f.ents[0]!.p).toHaveLength(2);
  });
});

describe("makeTutorialSend — 로컬 어댑터는 errand·pick·inspect·point 만 알아듣는다 (TUT-05, T-21-35)", () => {
  async function harness(): Promise<{ send: (m: ClientMessage) => boolean; errands: number; points: number[]; picks: number[]; inspects: number }> {
    const { makeTutorialSend } = await loadScript();
    const log = { errands: 0, points: [] as number[], picks: [] as number[], inspects: 0 };
    const send = makeTutorialSend({
      onErrand: () => void (log.errands += 1),
      onPoint: (seat) => void log.points.push(seat),
      onPick: (seat) => void log.picks.push(seat),
      onInspect: () => void (log.inspects += 1),
    });
    return {
      send,
      get errands() {
        return log.errands;
      },
      get points() {
        return log.points;
      },
      get picks() {
        return log.picks;
      },
      get inspects() {
        return log.inspects;
      },
    };
  }

  it("errand → onErrand 한 번, true", async () => {
    const h = await harness();
    expect(h.send({ t: "errand" })).toBe(true);
    expect(h.errands).toBe(1);
    expect(h.points).toEqual([]);
  });

  it("point(target 1) → onPoint(1) 한 번, true", async () => {
    const h = await harness();
    expect(h.send({ t: "point", target: 1 })).toBe(true);
    expect(h.points).toEqual([1]);
    expect(h.errands).toBe(0);
  });

  it("pick(target 3) → onPick(3) 한 번, inspect → onInspect 한 번, 둘 다 true", async () => {
    const h = await harness();
    expect(h.send({ t: "pick", target: 3 })).toBe(true);
    expect(h.picks).toEqual([3]);
    expect(h.send({ t: "inspect" })).toBe(true);
    expect(h.inspects).toBe(1);
    expect(h.errands).toBe(0);
    expect(h.points).toEqual([]);
  });

  it("move·chat·typing·emote·skipPhase 는 아무 일 없이 true 이다", async () => {
    const h = await harness();
    const others: ClientMessage[] = [
      { t: "move", x: 10, z: 20 },
      { t: "typing", on: true, pk: "p" },
      { t: "emote", id: "clap", pk: "p" },
      { t: "skipPhase", on: true },
    ];
    for (const m of others) expect(h.send(m)).toBe(true);
    expect(h.errands).toBe(0);
    expect(h.points).toEqual([]);
    expect(h.picks).toEqual([]);
    expect(h.inspects).toBe(0);
  });
});

// ---- 17-03 Task 2: 장면 1·2·4~8 ----

/** 소리 큐 13개(tut.* 12 + ui.tap) — 소리 모듈의 SFX_IDS 와의 대조는 17-04 시험 */
const CUES = ["tut.lampOff", "tut.scream", "tut.whoosh", "tut.sting", "tut.step", "tut.eye", "tut.link", "tut.buzz", "tut.stamp", "tut.fanfare", "tut.flip", "tut.warm", "ui.tap"];

describe("장면 시각·소리·말·포커스 (시안 Main.dc.html enter 그대로)", () => {
  it("1 오프닝: lampOff 800·1300, scream 2600, 포커스 없음", async () => {
    const { TUTORIAL_SCENES } = await loadScript();
    const s = TUTORIAL_SCENES[0]!;
    expect(s.beats).toEqual([
      { at: 800, sfx: "tut.lampOff" },
      { at: 1300, sfx: "tut.lampOff" },
      { at: 2600, sfx: "tut.scream" },
    ]);
    expect(s.focus).toEqual([]);
  });

  it("2 아침: whoosh+victim 0, sting+mafia 2600, 끝에 secret 4000, 포커스 band 0~2600", async () => {
    const { TUTORIAL_SCENES } = await loadScript();
    const s = TUTORIAL_SCENES[1]!;
    expect(s.beats).toEqual([
      { at: 0, sfx: "tut.whoosh", say: "tutorial.morning.victim" },
      { at: 2600, sfx: "tut.sting", say: "tutorial.morning.mafia" },
      { at: 4000, say: "tutorial.secret" },
    ]);
    expect(s.focus).toEqual([{ target: "band", from: 0, to: 2600 }]);
  });

  it("4 집 찾기: whoosh 0, 문구 house 500, 판 빛남 eye 900, 포커스 house 0~", async () => {
    const { TUTORIAL_SCENES } = await loadScript();
    const s = TUTORIAL_SCENES[3]!;
    expect(s.beats).toEqual([
      { at: 0, sfx: "tut.whoosh" },
      { at: 500, say: "tutorial.house" },
      { at: 900, sfx: "tut.eye" },
    ]);
    expect(s.focus).toEqual([{ target: "house", from: 0 }]);
  });

  it("5 현장·보드: whoosh 0, 포커스 inspect·suspect 0~(어느 쪽이 켜지는지는 화면 상태)", async () => {
    const { TUTORIAL_SCENES, TUTORIAL_BOARD_AFTER_MS } = await loadScript();
    const s = TUTORIAL_SCENES[4]!;
    expect(s.beats).toEqual([{ at: 0, sfx: "tut.whoosh" }]);
    expect(s.focus).toEqual([
      { target: "inspect", from: 0 },
      { target: "suspect", from: 0 },
    ]);
    expect(TUTORIAL_BOARD_AFTER_MS).toBe(900);
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

describe("사회자 문구 9개 — UI-SPEC 문구 표와 한 글자도 다르지 않다 (T-7)", () => {
  it.each([
    ["tutorial.morning.victim", "서연 님이 당했습니다"],
    ["tutorial.morning.mafia", "이 중에 마피아가 있습니다"],
    ["tutorial.errand", "등불을 켜 보세요"],
    ["tutorial.house", "집 하나를 눌러 보세요"],
    ["tutorial.link", "단서와 같은 옷을 찾아 보세요"],
    ["tutorial.secret", "정체는 판이 끝나야 알아요"],
    ["tutorial.vote", "의심되는 사람을 누르세요"],
    ["tutorial.vote.wrong", "흔적을 떠올려 보세요"],
    ["tutorial.roles", "밤에는 저마다 할 일이 있어요"],
  ] as const)("%s", async (key, text) => {
    const { TUTORIAL_LINES } = await loadScript();
    expect(TUTORIAL_LINES[key]).toBe(text);
  });

  it("키는 정확히 9개이고 tutorial.witness 는 없다", async () => {
    const { TUTORIAL_LINES } = await loadScript();
    expect(Object.keys(TUTORIAL_LINES)).toHaveLength(9);
    expect("tutorial.witness" in TUTORIAL_LINES).toBe(false);
  });

  it("새 문장 넷(errand·house·link·secret)은 19자 이하이고 마침표가 없다", async () => {
    const { TUTORIAL_LINES } = await loadScript();
    for (const key of ["tutorial.errand", "tutorial.house", "tutorial.link", "tutorial.secret"] as const) {
      expect([...TUTORIAL_LINES[key]].length, key).toBeLessThanOrEqual(19);
      expect(TUTORIAL_LINES[key], key).not.toMatch(/[.。]/);
    }
    expect([...TUTORIAL_LINES["tutorial.secret"]]).toHaveLength(14);
  });

  it("tutorial.secret 은 장면 표 안에서는 장면 2 에 한 번뿐이고(장면 6 은 화면이 처형 결과 뒤에 말한다 — TUTORIAL_PICK.reveal.say)", async () => {
    const { TUTORIAL_SCENES, TUTORIAL_PICK } = await loadScript();
    const where = TUTORIAL_SCENES.filter((s) => s.beats.some((b) => b.say === "tutorial.secret")).map((s) => s.n);
    expect(where).toEqual([2]);
    expect(TUTORIAL_PICK.reveal.say).toBe("tutorial.secret");
  });

  it("TUTORIAL_PICK: 정답 stamp, 오답 buzz+오답 문구, 처형 결과 fanfare+secret", async () => {
    const { TUTORIAL_PICK } = await loadScript();
    expect(TUTORIAL_PICK).toEqual({
      right: { sfx: "tut.stamp" },
      wrong: { sfx: "tut.buzz", say: "tutorial.vote.wrong" },
      reveal: { sfx: "tut.fanfare", say: "tutorial.secret" },
    });
  });
});

describe("tutorialView(2·5·6) — 실제 판정 함수가 읽는 필드 (T-9·T-14, 0080-16)", () => {
  it("장면 2: 아침·마감 없음·서연 탈락, 현장이 없어 지점이 서지 않고 꺼진 서연 등불이 공개 값에 없다", async () => {
    const { tutorialView } = await loadScript();
    const v = tutorialView(2, { now: NOW });
    expect(v.phase).toBe("morning");
    expect(v.phaseEndsAt).toBeNull();
    expect(v.mode).toBe("extended");
    expect(v.day?.morning).toEqual({ eliminated: 2 });
    expect(v.day?.evidence).toBeUndefined();
    expect(sceneMorningOf(v)).toBe(false);
    expect(v.day?.lamps).toEqual([0, 1, 3, 4, 5]);
  });

  it("장면 5(살피기 전): 아침 현장 — 서연 집(2) 현장, 단서 0, 지점 셋이 모두 안 살핀 상태, 서연 등불만 꺼져 있다", async () => {
    const { tutorialView } = await loadScript();
    const v = tutorialView(5, { now: NOW });
    expect(v.phase).toBe("morning");
    expect(v.phaseEndsAt).toBeNull();
    expect(sceneMorningOf(v)).toBe(true);
    expect(v.day?.scene).toEqual({ house: 2 });
    expect(v.day?.evidence).toBeUndefined();
    expect(v.me.clues ?? []).toEqual([]);
    expect(clueSpotStates(v.me.clues)).toEqual({ 1: "fresh", 2: "fresh", 3: "fresh" });
    expect(lampsOffOf(v.day?.lamps ?? [], v.players.map((p) => p.seat))).toEqual([2]);
  });

  it("장면 5(살핀 뒤 clue): 지점 ② 에서 붉은 천 조각을 받는다 — 카드 칩 하나, 지점 ② 만 done", async () => {
    const { tutorialView } = await loadScript();
    const v = tutorialView(5, { now: NOW, clue: true });
    expect(v.phase).toBe("morning");
    expect(v.me.clues).toEqual([{ spot: 2, kind: "cloth", piece: "redCloth" }]);
    expect(clueSpotStates(v.me.clues)).toEqual({ 1: "fresh", 2: "done", 3: "fresh" });
    expect(clueChipsOf(v.me.clues, undefined).map((c) => [c.kind, c.text])).toEqual([["cloth", "붉은 천 조각"]]);
  });

  it("장면 5(보드 board): 토론 단계로 바뀌고 같은 옷 표시는 도윤(1) 하나에만 켜진다, 목격 기록은 없다", async () => {
    const { tutorialView } = await loadScript();
    const v = tutorialView(5, { now: NOW, board: true });
    expect(v.phase).toBe("discussion");
    expect(v.me.clues).toEqual([{ spot: 2, kind: "cloth", piece: "redCloth" }]);
    expect(v.me.record).toBeUndefined();
    expect(sameOutfitSeats(v.players, "redCloth")).toEqual([1]);
    expect(boardMarksOf(v.players, v.me.clues)).toEqual({ 1: ["cloth"] });
  });

  it("장면 6: 지목 단계·지목 줄 비어 있음·차례 없음, 받은 옷 조각이 유지되고, picked 면 나(5) → 도윤(1) 한 줄", async () => {
    const { tutorialView } = await loadScript();
    const v = tutorialView(6, { now: NOW });
    expect(v.phase).toBe("nomination");
    expect(v.day?.points).toEqual([]);
    expect(v.day?.turn).toBeUndefined();
    expect(v.day?.evidence).toBeUndefined();
    expect(v.me.clues).toEqual([{ spot: 2, kind: "cloth", piece: "redCloth" }]);
    const picked = tutorialView(6, { now: NOW, picked: true });
    expect(picked.day?.points).toEqual([{ seat: 5, target: 1 }]);
    expect(picked.me.clues).toEqual(v.me.clues);
  });

  it("지도 장면(2~6) 모두 마을·확장판·여섯 명이고 닉네임은 출연 상수뿐이다 — 서연은 2·5·6 에서 탈락, 3·4 에서는 산다", async () => {
    const { tutorialView } = await loadScript();
    for (const n of [2, 3, 4, 5, 6] as const) {
      const v = tutorialView(n, { now: NOW });
      expect(v.map, `장면 ${n}`).toBe("town");
      expect(v.mode, `장면 ${n}`).toBe("extended");
      expect(v.players.map((p) => p.nickname).sort()).toEqual(["나", "도윤", "민준", "서연", "지호", "하린"].sort());
      expect(v.players.find((p) => p.seat === 2)?.alive === false, `장면 ${n}`).toBe(n === 2 || n >= 5);
    }
  });

  it("현장 지점 ② 의 자리는 서연 집 앞 TOWN_CLUE_SPOTS[2][1] 이다(내가 서 있는 곳)", async () => {
    const { tutorialSnap, TUTORIAL_CAST } = await loadScript();
    expect(TUTORIAL_CAST.victim).toBe(2);
    const me = tutorialSnap(5, NOW).ents.find((e) => e.s === 5)!;
    expect({ x: me.p[0], z: me.p[1] }).toEqual(TOWN_CLUE_SPOTS[2]![1]);
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

describe("역할이 새지 않는다 (TUT-05, T-17-08)", () => {
  it("가짜 view 어디에도 .me.role·.me.allies·.players[].role 키가 없다 (지도 2~6 + 변형 + 무대 1·7)", async () => {
    const { tutorialView, tutorialStageView } = await loadScript();
    const views = [
      ...([2, 3, 4, 5, 6] as const).map((n) => tutorialView(n, { now: NOW, picked: true })),
      tutorialView(3, { now: NOW, lit: true }),
      tutorialView(4, { now: NOW, house: 3 }),
      tutorialView(5, { now: NOW, clue: true }),
      tutorialView(5, { now: NOW, board: true }),
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
  it("무대 view 는 night 단계·마을·여섯 명이고 7 에서는 서연이 탈락이다", async () => {
    const { tutorialStageView } = await loadScript();
    const v1 = tutorialStageView(1, NOW);
    expect(v1.phase).toBe("night");
    expect(v1.map).toBe("town");
    expect(v1.players).toHaveLength(6);
    expect(v1.players.find((p) => p.seat === 2)?.alive).not.toBe(false);
    const v7 = tutorialStageView(7, NOW);
    expect(v7.players.find((p) => p.seat === 2)?.alive).toBe(false);
  });

  it("장면 1 낮 쪽: 서연 좌석이 보이고 조명은 night 가 아니다", async () => {
    const { tutorialStageLook } = await loadScript();
    const look = tutorialStageLook(1, { night: false, victimGone: false });
    expect(look.seats[2]?.show).toBe(true);
    expect(look.seats[2]?.opacity ?? 1).toBeGreaterThan(0);
    expect(look.lighting).not.toBe("night");
    expect(look.camera.mode).toBe("fixed");
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

  it("카메라는 광장 가운데에 고정이다", async () => {
    const { tutorialStageLook } = await loadScript();
    const cam = tutorialStageLook(7, { night: true, victimGone: true }).camera;
    expect(cam).toMatchObject({ mode: "fixed", target: { x: 0, z: 0 } });
  });
});

describe("tutorialSnap — 서버와 같은 구간 단위", () => {
  it("1 = 여섯, 2·6·7 = 산 사람 다섯(서연 없음), 3·4·5 = 나 하나", async () => {
    const { tutorialSnap } = await loadScript();
    expect(tutorialSnap(1, NOW).ents.map((e) => e.s)).toEqual([0, 1, 2, 3, 4, 5]);
    for (const n of [2, 6, 7] as const) expect(tutorialSnap(n, NOW).ents.map((e) => e.s), `장면 ${n}`).toEqual([0, 1, 3, 4, 5]);
    for (const n of [3, 4, 5] as const) expect(tutorialSnap(n, NOW).ents.map((e) => e.s), `장면 ${n}`).toEqual([5]);
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
});

describe("튜토리얼 카메라 (P18-8, D-07)", () => {
  it("TUTORIAL_FIXED_CAMERA 는 광장 가운데(GATHER_CENTER) 고정·줌 1 이다", async () => {
    const { TUTORIAL_FIXED_CAMERA } = await loadScript();
    expect(TUTORIAL_FIXED_CAMERA).toEqual({ mode: "fixed", target: { x: GATHER_CENTER.x, z: GATHER_CENTER.z }, zoom: 1 });
  });

  it.each([2, 6])("장면 %i 은 고정 카메라", async (n) => {
    const { tutorialCameraOf, TUTORIAL_FIXED_CAMERA } = await loadScript();
    expect(tutorialCameraOf(n) === TUTORIAL_FIXED_CAMERA, "고정 카메라 상수를 돌려준다").toBe(true);
  });

  it.each([1, 3, 4, 5, 7])("장면 %i 은 덮어쓰지 않는다(undefined — 3·4·5 는 실제 판의 카메라: 나를 따르거나 집 판 시점)", async (n) => {
    const { tutorialCameraOf } = await loadScript();
    expect(tutorialCameraOf(n) === undefined).toBe(true);
  });
});
