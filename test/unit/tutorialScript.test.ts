// 17-03: 첫 사건 대본 — 장면 표·가짜 view·로컬 어댑터 (TUT-03, TUT-05, 결정 0078-1·7, 0080-9·16·17).
// 대본은 순수 데이터다. 실제 판정 함수(errandView·traceMark·recordView)가 읽는 필드를 갖췄는지 그 함수로 확인한다.
import { describe, expect, it } from "vitest";
import { actablePlaceOf, errandProgress, placeCentersOf, startCardOn } from "../../src/game/errandView";
import { traceWindowOf } from "../../src/game/recordView";
import { sameOutfitSeats } from "../../src/game/traceMark";
import { lineWalkable } from "../../shared/game/map";
import { GATHER_CENTER } from "../../src/world/camera";
import { mapOf } from "../../shared/game/maps";
import { ERRAND_ACT_R } from "../../shared/game/phases";
import { segmentEndsAt } from "../../shared/game/world";
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
    expect(TUTORIAL_SCENES.map((s) => s.id)).toEqual(["opening", "morning", "errand", "witness", "evidence", "vote", "roles", "end"]);
    expect(TUTORIAL_SCENES.map((s) => s.render)).toEqual(["stage", "map", "map", "map", "map", "map", "stage", "home"]);
  });

  it("진행 점은 장면 1~7 에만 있고 점 수는 7이다 (T-23)", async () => {
    const { TUTORIAL_SCENES, TUTORIAL_DOT_COUNT } = await loadScript();
    expect(TUTORIAL_DOT_COUNT).toBe(7);
    expect(TUTORIAL_SCENES.map((s) => s.dot)).toEqual([true, true, true, true, true, true, true, false]);
    expect(TUTORIAL_SCENES.filter((s) => s.dot)).toHaveLength(TUTORIAL_DOT_COUNT);
  });

  it("넘어가는 방식: 1 auto 4600 · 2 next 2600 · 3 act 700 · 4 next 3400 · 5 next 0 · 6 pick 1100 · 7 next 0 · 8 end", async () => {
    const { TUTORIAL_SCENES } = await loadScript();
    expect(TUTORIAL_SCENES.map((s) => s.advance)).toEqual([
      { kind: "auto", afterMs: 4600 },
      { kind: "next", showAtMs: 2600 },
      { kind: "act", afterMs: 700 },
      { kind: "next", showAtMs: 3400 },
      { kind: "next", showAtMs: 0 },
      { kind: "pick", revealAfterMs: 1100 },
      { kind: "next", showAtMs: 0 },
      { kind: "end" },
    ]);
  });

  it("장면 3 의 소리·말·포커스는 시안 시각 그대로다: whoosh 0, 심부름 문구 500, 포커스 errand 0~", async () => {
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
    expect(TUTORIAL_CAST.map).toBe("plaza");
    expect(TUTORIAL_CAST.errand).toEqual({ places: ["mail", "fountain", "lamp"], target: "mail" });
    expect(TUTORIAL_CAST.witness).toEqual({ seat: 1, place: "lamp" });
    expect(TUTORIAL_CAST.trace).toBe("redCloth");
  });
});

describe("tutorialView(3) — 심부름 장면의 가짜 view", () => {
  it("errand 단계·마감 없음·광장·내 심부름 목록이 실제 판정 함수가 읽는 모양이다", async () => {
    const { tutorialView } = await loadScript();
    const v = tutorialView(3, { now: NOW });
    expect(v.phase).toBe("errand");
    expect(v.phaseEndsAt).toBeNull();
    expect(v.map).toBe("plaza");
    expect(v.code).toBe("");
    expect(v.round).toBe(1);
    expect(v.serverNow).toBe(NOW);
    expect(v.me.seat).toBe(5);
    expect(v.me.isHost).toBe(false);
    expect(v.me.errand).toEqual({ places: ["mail", "fountain", "lamp"], done: [] });
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

  it("시작 위치에서 우체통까지 거리가 처리 반경보다 작아 [처리] 가 바로 켜진다 (T-14)", async () => {
    const { tutorialView, tutorialSnap } = await loadScript();
    const v = tutorialView(3, { now: NOW });
    const centers = placeCentersOf(v);
    expect(centers.map((c) => c.id).sort()).toEqual(["fountain", "lamp", "mail"]);
    const snap = tutorialSnap(3, NOW);
    const me = snap.ents[0]!;
    const pos = { x: me.p[0]! / 100, z: me.p[1]! / 100 };
    const mail = centers.find((c) => c.id === "mail")!;
    expect(Math.hypot(mail.x - pos.x, mail.z - pos.z)).toBeLessThan(ERRAND_ACT_R);
    expect(actablePlaceOf(pos, centers, [])).toBe("mail");
  });

  it("매번 새 객체다 (호출 사이에 값이 새지 않는다)", async () => {
    const { tutorialView } = await loadScript();
    const a = tutorialView(3, { now: NOW });
    const b = tutorialView(3, { now: NOW });
    expect(a).not.toBe(b);
    a.me.errand!.done.push("mail");
    expect(b.me.errand!.done).toEqual([]);
  });
});

describe("tutorialView(4) · tutorialSnap(3) ", () => {
  it("장면 4 는 우체통을 처리한 뒤(done [mail])다", async () => {
    const { tutorialView } = await loadScript();
    const v = tutorialView(4, { now: NOW });
    expect(v.phase).toBe("errand");
    expect(v.me.errand).toEqual({ places: ["mail", "fountain", "lamp"], done: ["mail"] });
    expect(errandProgress(v)).toMatchObject({ n: 1, total: 3 });
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

describe("makeTutorialSend — 로컬 어댑터는 errand·point 만 알아듣는다 (TUT-05)", () => {
  async function harness(): Promise<{ send: (m: ClientMessage) => boolean; errands: number; points: number[] }> {
    const { makeTutorialSend } = await loadScript();
    const log = { errands: 0, points: [] as number[] };
    const send = makeTutorialSend({
      onErrand: () => void (log.errands += 1),
      onPoint: (seat) => void log.points.push(seat),
    });
    return {
      send,
      get errands() {
        return log.errands;
      },
      get points() {
        return log.points;
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

  it("move·chat·typing·emote 는 아무 일 없이 true 이다", async () => {
    const h = await harness();
    const others: ClientMessage[] = [
      { t: "move", x: 10, z: 20 },
      { t: "typing", on: true, pk: "p" },
      { t: "emote", id: "clap", pk: "p" },
    ];
    for (const m of others) expect(h.send(m)).toBe(true);
    expect(h.errands).toBe(0);
    expect(h.points).toEqual([]);
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

  it("2 아침: whoosh+victim 0, sting+mafia 2600, 포커스 band 0~2600", async () => {
    const { TUTORIAL_SCENES } = await loadScript();
    const s = TUTORIAL_SCENES[1]!;
    expect(s.beats).toEqual([
      { at: 0, sfx: "tut.whoosh", say: "tutorial.morning.victim" },
      { at: 2600, sfx: "tut.sting", say: "tutorial.morning.mafia" },
    ]);
    expect(s.focus).toEqual([{ target: "band", from: 0, to: 2600 }]);
  });

  it("4 목격: step 0·320·640·960·1280, eye 1900, 문구 2250, 포커스 suspect 1900~3400", async () => {
    const { TUTORIAL_SCENES } = await loadScript();
    const s = TUTORIAL_SCENES[3]!;
    expect(s.beats).toEqual([
      { at: 0, sfx: "tut.step" },
      { at: 320, sfx: "tut.step" },
      { at: 640, sfx: "tut.step" },
      { at: 960, sfx: "tut.step" },
      { at: 1280, sfx: "tut.step" },
      { at: 1900, sfx: "tut.eye" },
      { at: 2250, say: "tutorial.witness" },
    ]);
    expect(s.focus).toEqual([{ target: "suspect", from: 1900, to: 3400 }]);
  });

  it("5 증거: link 400·900, 문구 1300, 포커스 없음", async () => {
    const { TUTORIAL_SCENES } = await loadScript();
    const s = TUTORIAL_SCENES[4]!;
    expect(s.beats).toEqual([
      { at: 400, sfx: "tut.link" },
      { at: 900, sfx: "tut.link" },
      { at: 1300, say: "tutorial.link" },
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

describe("사회자 문구 8개 — UI-SPEC 문구 표와 한 글자도 다르지 않다 (T-7)", () => {
  it.each([
    ["tutorial.morning.victim", "서연 님이 당했습니다"],
    ["tutorial.morning.mafia", "이 중에 마피아가 있습니다"],
    ["tutorial.errand", "우체통에서 처리하세요"],
    ["tutorial.witness", "가는 길에 본 사람은 기록돼요"],
    ["tutorial.link", "본 것과 흔적을 이어 보세요"],
    ["tutorial.vote", "의심되는 사람을 누르세요"],
    ["tutorial.vote.wrong", "흔적을 떠올려 보세요"],
    ["tutorial.roles", "밤에는 저마다 할 일이 있어요"],
  ] as const)("%s", async (key, text) => {
    const { TUTORIAL_LINES } = await loadScript();
    expect(TUTORIAL_LINES[key]).toBe(text);
  });

  it("키는 정확히 8개다", async () => {
    const { TUTORIAL_LINES } = await loadScript();
    expect(Object.keys(TUTORIAL_LINES)).toHaveLength(8);
  });

  it("TUTORIAL_PICK: 정답 stamp, 오답 buzz+오답 문구, 공개 fanfare", async () => {
    const { TUTORIAL_PICK } = await loadScript();
    expect(TUTORIAL_PICK).toEqual({
      right: { sfx: "tut.stamp" },
      wrong: { sfx: "tut.buzz", say: "tutorial.vote.wrong" },
      reveal: { sfx: "tut.fanfare" },
    });
  });
});

describe("tutorialView(2·5·6) — 실제 판정 함수가 읽는 필드 (T-9·T-14, 0080-16)", () => {
  it("장면 2: 아침·마감 없음·서연 탈락, 흔적이 없어 증거 카드가 뜨지 않는다", async () => {
    const { tutorialView } = await loadScript();
    const v = tutorialView(2, { now: NOW });
    expect(v.phase).toBe("morning");
    expect(v.phaseEndsAt).toBeNull();
    expect(v.day?.morning).toEqual({ eliminated: 2 });
    expect(v.day?.evidence).toBeUndefined();
    expect(traceWindowOf(v, NOW)).toBeNull();
  });

  it("장면 5: 마감 now+4000, 흔적·마지막 목격이 morning·evidence 양쪽에 있고 같은 옷은 도윤 하나, 흔적 구간이 즉시 켜진다", async () => {
    const { tutorialView } = await loadScript();
    const v = tutorialView(5, { now: NOW });
    expect(v.phase).toBe("morning");
    expect(v.phaseEndsAt).toBe(NOW + 4000);
    const seen = { seat: 1, place: "lamp" };
    expect(v.day?.morning).toEqual({ eliminated: 2, trace: "redCloth", seen });
    expect(v.day?.evidence).toEqual({ trace: "redCloth", seen });
    expect(sameOutfitSeats(v.players, "redCloth")).toEqual([1]);
    expect(traceWindowOf(v, NOW)?.on).toBe(true);
  });

  it("장면 6: 지목 단계·지목 줄 비어 있음·증거 유지·차례 없음, picked 면 나(5) → 도윤(1) 한 줄", async () => {
    const { tutorialView } = await loadScript();
    const v = tutorialView(6, { now: NOW });
    expect(v.phase).toBe("nomination");
    expect(v.day?.points).toEqual([]);
    expect(v.day?.turn).toBeUndefined();
    expect(v.day?.evidence).toEqual({ trace: "redCloth", seen: { seat: 1, place: "lamp" } });
    const picked = tutorialView(6, { now: NOW, picked: true });
    expect(picked.day?.points).toEqual([{ seat: 5, target: 1 }]);
    expect(picked.day?.evidence).toEqual(v.day?.evidence);
  });

  it("지도 장면(2~6) 모두 광장·여섯 명·서연 탈락이고 닉네임은 출연 상수뿐이다", async () => {
    const { tutorialView } = await loadScript();
    for (const n of [2, 3, 4, 5, 6] as const) {
      const v = tutorialView(n, { now: NOW });
      expect(v.map).toBe("plaza");
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

describe("역할이 새지 않는다 (TUT-05, T-17-08)", () => {
  it("가짜 view 어디에도 .me.role·.me.allies·.players[].role 키가 없다 (지도 2~6 + 무대 1·7)", async () => {
    const { tutorialView, tutorialStageView } = await loadScript();
    const views = [
      ...([2, 3, 4, 5, 6] as const).map((n) => tutorialView(n, { now: NOW, picked: true })),
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
  it("무대 view 는 night 단계·광장·여섯 명이고 7 에서는 서연이 탈락이다", async () => {
    const { tutorialStageView } = await loadScript();
    const v1 = tutorialStageView(1, NOW);
    expect(v1.phase).toBe("night");
    expect(v1.map).toBe("plaza");
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

describe("tutorialSnap·tutorialSuspectWalk — 서버와 같은 구간 단위", () => {
  it("1 = 여섯, 2·5·6·7 = 산 사람 다섯(서연 없음), 3·4 = 나 하나", async () => {
    const { tutorialSnap } = await loadScript();
    expect(tutorialSnap(1, NOW).ents.map((e) => e.s)).toEqual([0, 1, 2, 3, 4, 5]);
    for (const n of [2, 5, 6, 7] as const) expect(tutorialSnap(n, NOW).ents.map((e) => e.s), `장면 ${n}`).toEqual([0, 1, 3, 4, 5]);
    for (const n of [3, 4] as const) expect(tutorialSnap(n, NOW).ents.map((e) => e.s), `장면 ${n}`).toEqual([5]);
  });

  it("모든 snap 자리는 광장 맵에서 걸을 수 있는 곳이다", async () => {
    const { tutorialSnap } = await loadScript();
    const map = mapOf("plaza");
    for (const n of [1, 2, 3, 4, 5, 6, 7] as const) {
      for (const e of tutorialSnap(n, NOW).ents) {
        const p = { x: e.p[0]!, z: e.p[1]! };
        expect(lineWalkable(map, p, p), `장면 ${n} 좌석 ${e.s}`).toBe(true);
      }
    }
  });

  it("도윤 걷기: move 한 프레임(s 1), 1.6~2.0초 걸리고 선분이 걸을 수 있다", async () => {
    const { tutorialSuspectWalk } = await loadScript();
    const f = tutorialSuspectWalk(NOW);
    expect(f.t).toBe("world");
    expect(f.k).toBe("move");
    if (f.k !== "move") throw new Error("move 프레임이어야 한다");
    expect(f.s).toBe(1);
    expect(f.t0).toBe(NOW);
    const ms = segmentEndsAt({ p: f.p, t0: f.t0, v: f.v }) - f.t0;
    expect(ms).toBeGreaterThanOrEqual(1600);
    expect(ms).toBeLessThanOrEqual(2000);
    const map = mapOf("plaza");
    expect(lineWalkable(map, { x: f.p[0]!, z: f.p[1]! }, { x: f.p[2]!, z: f.p[3]! })).toBe(true);
  });

  it("도윤 걷기 끝점은 내 시작 자리 근처(3 안)이지만 겹치지 않는다", async () => {
    const { tutorialSuspectWalk, TUTORIAL_START } = await loadScript();
    const f = tutorialSuspectWalk(NOW);
    if (f.k !== "move") throw new Error("move 프레임이어야 한다");
    const end = { x: f.p[2]! / 100, z: f.p[3]! / 100 };
    const d = Math.hypot(end.x - TUTORIAL_START.x, end.z - TUTORIAL_START.z);
    expect(d).toBeLessThan(3);
    expect(d).toBeGreaterThan(1);
  });
});

describe("튜토리얼 카메라 (P18-8, D-07)", () => {
  it("TUTORIAL_FIXED_CAMERA 는 광장 가운데(GATHER_CENTER) 고정·줌 1 이다", async () => {
    const { TUTORIAL_FIXED_CAMERA } = await loadScript();
    expect(TUTORIAL_FIXED_CAMERA).toEqual({ mode: "fixed", target: { x: GATHER_CENTER.x, z: GATHER_CENTER.z }, zoom: 1 });
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
