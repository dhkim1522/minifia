// 17-03: 첫 사건 대본 — 장면 표·가짜 view·로컬 어댑터 (TUT-03, TUT-05, 결정 0078-1·7, 0080-9·16·17).
// 대본은 순수 데이터다. 실제 판정 함수(errandView·traceMark·recordView)가 읽는 필드를 갖췄는지 그 함수로 확인한다.
import { describe, expect, it } from "vitest";
import { actablePlaceOf, errandProgress, placeCentersOf, startCardOn } from "../../src/game/errandView";
import { ERRAND_ACT_R } from "../../shared/game/phases";
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
