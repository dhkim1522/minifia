// 24-07: 혼자 하기 튜토리얼 대본(순수 모듈) 시험 — 결정 0089-15, 24 D-15~D-17·D-23·D-31, UI-SPEC P24-25·27·29·30.
// 대본은 서버·소켓 없이 로컬 상수와 순수 함수로 열 장면의 가짜 RoomView 를 만든다. 시각은 모두 인자다.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isWalkable, cellOfFx, UNIT } from "../../shared/game/map";
import { mapOf } from "../../shared/game/maps";
import { NOTE_REACH_ON_PCT, withinNoteReach } from "../../shared/game/postit";
import { hostLineOf } from "../../src/game/hostLine";
import type { ClientMessage, RoomView } from "../../shared/protocol";
import type { Segment } from "../../shared/game/world";
import {
  TUTORIAL_CAST,
  TUTORIAL_PILLS,
  TUTORIAL_PLAYTEST_SCENES,
  TUTORIAL_SCENES,
  autoAct,
  makeTutorialSend,
  reactTo,
  tutorialSnap,
  tutorialView,
} from "../../src/game/tutorialScript";
import type { TutorialSceneId } from "../../src/game/tutorialScript";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const T0 = 1_700_000_000_000;

const scene = (id: TutorialSceneId) => TUTORIAL_SCENES.find((s) => s.id === id)!;

describe("장면 표 — 열 장면(D-16, UI-SPEC E 표)", () => {
  it("id 열이 정확히 roles·keyword·answers·discussion·verdict·pick·will·night·postit·end", () => {
    expect(TUTORIAL_SCENES.map((s) => s.id)).toEqual(["roles", "keyword", "answers", "discussion", "verdict", "pick", "will", "night", "postit", "end"]);
  });

  it("종류: 보기(roles·answers·will·end) · 하기(keyword·discussion·verdict·pick·night·postit)", () => {
    expect(TUTORIAL_SCENES.map((s) => s.kind)).toEqual(["watch", "do", "watch", "do", "do", "do", "watch", "do", "do", "watch"]);
  });

  it("하기 장면의 대상 id 와 12초 대행(P24-27) — postit 만 대상이 둘(suspect-btn → tag-4)", () => {
    expect(scene("keyword").targets).toEqual(["send"]);
    expect(scene("discussion").targets).toEqual(["endDiscussion"]);
    expect(scene("verdict").targets).toEqual(["yes"]);
    expect(scene("pick").targets).toEqual(["tag-4"]);
    expect(scene("night").targets).toEqual(["face-0"]);
    expect(scene("postit").targets).toEqual(["suspect-btn", "tag-4"]);
    for (const s of TUTORIAL_SCENES) {
      if (s.kind === "do") expect(s.autoActMs, s.id).toBe(12000);
      else {
        expect(s.autoActMs, s.id).toBeUndefined();
        expect(s.targets, s.id).toBeUndefined();
      }
    }
  });

  it("장면 길이는 링이 켜진 뒤 12초 대행까지를 덮는다(실제 시계가 장면보다 먼저 끝나지 않는다)", () => {
    for (const s of TUTORIAL_SCENES) {
      expect(s.ms, s.id).toBeGreaterThan(0);
      if (s.kind === "do") expect(s.ms, s.id).toBeGreaterThanOrEqual((s.ringAtMs ?? 0) + 12000);
    }
  });

  it("비트 시각은 같은 장면 안에서 오름차순이고 첫 비트가 장면 맨 앞이다", () => {
    for (const s of TUTORIAL_SCENES) {
      const timed = s.beats.filter((b) => b.at !== null).map((b) => b.at as number);
      expect([...timed].sort((a, b) => a - b), s.id).toEqual(timed);
      expect(s.beats[0]!.at, s.id).toBe(0);
    }
  });
});

describe("출연(P24-29, 0080-16)", () => {
  it("6명: 0 민준·1 도윤·2 서연·3 지호·4 하린·5 나, 내 좌석 5 닉네임 '나' 의상 coat", () => {
    expect(TUTORIAL_CAST.seats.map((c) => [c.seat, c.name, c.look])).toEqual([
      [0, "민준", "detective"],
      [1, "도윤", "noir"],
      [2, "서연", "elder"],
      [3, "지호", "reporter"],
      [4, "하린", "hood"],
      [5, "나", "coat"],
    ]);
    expect(TUTORIAL_CAST.me).toBe(5);
  });

  it("의상 이름에 역할 낱말(police·doctor·mafia)이 없다", () => {
    for (const c of TUTORIAL_CAST.seats) expect(["police", "doctor", "mafia"]).not.toContain(c.look);
  });

  it("모든 가짜 view 의 players 가 6명이고 닉네임·의상이 출연표와 같다", () => {
    for (const s of TUTORIAL_SCENES) {
      for (const b of s.beats) {
        const v = tutorialView(s.id, b.id, T0);
        expect(v.players.map((p) => [p.seat, p.nickname, p.look]), `${s.id}/${b.id}`).toEqual(TUTORIAL_CAST.seats.map((c) => [c.seat, c.name, c.look]));
        expect(v.me.seat).toBe(5);
        expect(v.me.isHost).toBe(false);
        expect(v.code).toBe("");
      }
    }
  });

  it("마피아는 하린(비밀) — 가짜 view 어디에도 하린의 역할·처형자 직업 키가 없다", () => {
    for (const s of TUTORIAL_SCENES) {
      for (const b of s.beats) {
        const json = JSON.stringify(tutorialView(s.id, b.id, T0));
        expect(json).not.toContain('"job"');
        expect(json).not.toContain('"spectate"');
        expect(json).not.toContain('"allies"');
      }
    }
  });
});

describe("알약 문구(P24-25)", () => {
  const pills = Object.values(TUTORIAL_PILLS);

  it("모두 공백 포함 17자 이하·해요체(요로 끝남)·마침표 없음", () => {
    expect(pills.length).toBeGreaterThanOrEqual(16);
    for (const p of pills) {
      expect([...p].length, p).toBeLessThanOrEqual(17);
      expect(p, p).toMatch(/요$/);
      expect(p, p).not.toMatch(/\.$/);
    }
  });

  it("각 장면의 목표를 한 줄로 안내한다", () => {
    expect(pills).toEqual([
      "나는 시민이에요",
      "마피아를 찾아내요",
      "경찰·의사도 있어요",
      "시민 팀은 제시어를 알아요",
      "마피아는 제시어를 몰라요",
      "제시어 대신 단서를 써요",
      "단서를 읽고 비교해요",
      "궁금한 점을 물어봐요",
      "절반 넘게 누르면 끝나요",
      "찬성이 더 많으면 지목해요",
      "의심 가는 사람을 가리켜요",
      "처형되는 사람은 유언을 남겨요",
      "마피아는 몰래 한 명을 노려요",
      "의심 가는 사람 곁에서 눌러요",
      "붙일 사람을 눌러요",
      "하루 한 장, 아침에 떨어져요",
      "역할을 읽고 준비를 눌러요",
      "단서를 눌러 살펴봐요",
      "가까이서 의심딱지를 눌러요",
      "모두 요청하면 투표해요",
      "45초 뒤엔 절반만 넘으면 돼요",
      "투표 요청을 눌러요",
      "한 명을 뽑거나 건너뛰어요",
      "시민은 아침을 준비해요",
    ]);
  });

  it("각 장면 가짜 view 의 사회자 띠 줄을 되풀이하지 않는다", () => {
    for (const s of TUTORIAL_SCENES) {
      for (const b of s.beats) {
        if (b.pill === null) continue;
        const view = tutorialView(s.id, b.id, T0);
        expect(TUTORIAL_PILLS[b.pill], `${s.id}/${b.id}`).not.toBe(hostLineOf(view));
      }
    }
  });

  it("장면 10(end)에는 알약이 없다", () => {
    for (const b of scene("end").beats) expect(b.pill).toBeNull();
  });
});

describe("가짜 view(D-17, P24-19 판정)", () => {
  it("keyword b: 마피아 view — me.role mafia 이고 me 에 keyword 키가 없다", () => {
    const v = tutorialView("keyword", "b", T0);
    expect(v.me.role).toBe("mafia");
    expect("keyword" in v.me).toBe(false);
    expect(v.day?.keyword?.genre).toBe("동물");
  });

  it("keyword a·c: 시민이고 me.keyword 고양이, day.keyword.genre 동물", () => {
    for (const beat of ["a", "c"] as const) {
      const v = tutorialView("keyword", beat, T0);
      expect(v.phase).toBe("keyword");
      expect(v.me.role).toBe("citizen");
      expect(v.me.keyword).toBe("고양이");
      expect(v.day?.keyword?.genre).toBe("동물");
    }
  });

  it("keyword c: 입력 초안 '발소리가 안 들려요'(확정 아님) → 누른 뒤 확정", () => {
    expect(tutorialView("keyword", "c", T0).me.answer).toEqual({ text: "발소리가 안 들려요", final: false });
    expect(tutorialView("keyword", "c", T0, 1).me.answer).toEqual({ text: "발소리가 안 들려요", final: true });
  });

  it("answers: 마피아를 포함해 여섯 명 모두 답하고, 같은 답으로 토론한다", () => {
    const answers = tutorialView("answers", "a", T0).day?.keyword?.answers;
    expect(answers).toHaveLength(6);
    const last = answers![5]!;
    expect(last.seat).toBe(4);
    expect(last.text).toBe("사람을 잘 따라와요");
    expect(answers!.every((row) => row.text !== null)).toBe(true);
    expect(tutorialView("discussion", "a", T0).day?.keyword?.answers).toEqual(answers);
    expect(answers![2]).toMatchObject({ seat: 5, text: "발소리가 안 들려요" });
    expect(answers!.map((a) => a.order)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("roles: roleReveal·시민 카드·구성 직업 4개, 시계가 자동 뒤집힘을 0.4초에 맞춘다", () => {
    const v = tutorialView("roles", "start", T0);
    expect(v.phase).toBe("roleReveal");
    expect(v.me.role).toBe("citizen");
    expect(v.day?.roles).toEqual(["mafia", "police", "doctor", "citizen"]);
    // 역할 확인 시작 t0 = 마감 − 길이 → 자동 뒤집힘(시작 5초) = 장면 시작 + 0.4초
    const t0 = v.phaseEndsAt! - v.phaseDurationMs!;
    expect(t0 + 5000 - T0).toBe(400);
  });

  it("discussion·verdict·pick: 새 필드(endCount·verdictCount·turn/points)를 채운다", () => {
    const d = tutorialView("discussion", "b", T0, 2);
    expect(d.phase).toBe("discussion");
    expect(d.day?.endCount).toBe(2);
    expect(tutorialView("discussion", "b", T0, 0).day?.endCount).toBe(0);
    expect(tutorialView("discussion", "b", T0, 1).me.endDiscussion).toBe(true);

    const v0 = tutorialView("verdict", "a", T0);
    expect(v0.phase).toBe("verdict");
    expect(v0.day?.verdictCount).toEqual({ yes: 0, no: 0 });
    expect(v0.day?.candidate).toBeUndefined();
    const v1 = tutorialView("verdict", "a", T0, 1);
    expect(v1.me.verdictVote).toBe(true);
    expect(v1.day?.verdictCount).toEqual({ yes: 1, no: 0 });

    const p = tutorialView("pick", "c", T0);
    expect(p.phase).toBe("nomination");
    expect(p.day?.turn?.order[p.day.turn.i]).toBe(5);
    expect(p.day?.points).toEqual([
      { seat: 0, target: 1 },
      { seat: 2, target: 1 },
    ]);
  });

  it("will: 처형 단계·유언 카드 문구, 도윤이 유령으로 바뀌고 직업은 어디에도 없다", () => {
    const a = tutorialView("will", "a", T0);
    expect(a.phase).toBe("execution");
    expect(a.day?.execution).toEqual({ seat: 1, will: "믿어줘, 난 정말 아니야" });
    expect(a.players.find((p) => p.seat === 1)?.alive).toBeUndefined();
    expect(tutorialView("will", "b", T0).players.find((p) => p.seat === 1)?.alive).toBe(false);
  });

  it("night: 밤 단계 → 누른 뒤 me.pick 0 → 아침 막간에 서연이 유령", () => {
    const a = tutorialView("night", "a", T0);
    expect(a.phase).toBe("night");
    expect(a.me.pick).toBeUndefined();
    expect(tutorialView("night", "b", T0).me.pick).toBe(0);
    const c = tutorialView("night", "c", T0);
    expect(c.phase).toBe("morning");
    expect(c.day?.morning).toEqual({ eliminated: 2 });
    expect(c.players.find((p) => p.seat === 2)?.alive).toBe(false);
  });

  it("가짜 view 의 phaseEndsAt 은 장면 시작 시각 + 장면 길이(실제 시계, null 아님)", () => {
    for (const s of TUTORIAL_SCENES) {
      const v = tutorialView(s.id, s.beats[0]!.id, T0);
      expect(v.phaseEndsAt, s.id).not.toBeNull();
      expect(v.phaseDurationMs, s.id).not.toBeNull();
      if (s.id === "roles") continue; // 위 시험이 따로 본다
      expect(v.phaseEndsAt, s.id).toBe(T0 + s.ms);
      expect(v.phaseDurationMs, s.id).toBe(s.ms);
    }
  });

  it("같은 입력은 같은 view 를 돌려주고 매번 새 객체다(순수)", () => {
    const a = tutorialView("pick", "b", T0, 2);
    const b = tutorialView("pick", "b", T0, 2);
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    const frozen = JSON.stringify(a);
    a.players[0]!.nickname = "변조";
    expect(JSON.stringify(tutorialView("pick", "b", T0, 2))).toBe(frozen);
  });
});

describe("12초 대행 = 눌렀을 때와 같은 결과(P24-27)", () => {
  it("pick: 대행은 하린(4)을 가리킨 것과 같고 눌러서 낸 결과와 같다 — 하린 1표 → 이어서 도윤 4표", () => {
    const auto = autoAct("pick")!;
    expect(auto.target).toBe("tag-4");
    expect(auto.msg).toEqual({ t: "point", target: 4 });
    expect(reactTo("pick", "c", { t: "point", target: 4 })).toEqual(auto);
    // 하린 이름표가 아니면 반응하지 않는다
    expect(reactTo("pick", "c", { t: "point", target: 1 })).toBeNull();

    const tally = (steps: number) => {
      const pts = tutorialView("pick", "c", T0, steps).day!.points!;
      const count = (t: number) => pts.filter((p) => p.target === t).length;
      return { harin: count(4), doyoon: count(1) };
    };
    expect(tally(1).harin).toBe(1);
    expect(tally(auto.steps)).toEqual({ harin: 1, doyoon: 4 });
  });

  it("verdict: 찬성 4 · 반대 2 로 끝난다", () => {
    const auto = autoAct("verdict")!;
    expect(auto.msg).toEqual({ t: "verdict", agree: true });
    expect(tutorialView("verdict", "a", T0, auto.steps).day?.verdictCount).toEqual({ yes: 4, no: 2 });
    expect(reactTo("verdict", "a", { t: "verdict", agree: true })).toEqual(auto);
    expect(reactTo("verdict", "a", { t: "verdict", agree: false })).toBeNull();
  });

  it("discussion: 과반(6명 중 4)이 눌러 끝난다", () => {
    const auto = autoAct("discussion")!;
    expect(auto.msg).toEqual({ t: "endDiscussion", on: true });
    expect(tutorialView("discussion", "b", T0, auto.steps).day?.endCount).toBe(4);
  });

  it("keyword·night: 보내기·얼굴 누름과 같은 메시지", () => {
    expect(autoAct("keyword")!.msg).toEqual({ t: "answer", text: "발소리가 안 들려요", final: true });
    expect(autoAct("night")).toMatchObject({ target: "face-0", msg: { t: "pick", target: 0 }, next: "b" });
    expect(reactTo("night", "a", { t: "pick", target: 0 })).toEqual(autoAct("night"));
  });

  it("보기 장면에는 대행이 없다", () => {
    for (const id of ["roles", "answers", "will", "end"] as const) expect(autoAct(id)).toBeNull();
  });

  it("postit: 시작 비트는 [의심] 누름(메시지 없음) → a, a 비트는 하린 이름표(suspect 4) → b", () => {
    expect(autoAct("postit", "start")).toMatchObject({ target: "suspect-btn", msg: null, next: "a" });
    const stick = autoAct("postit", "a")!;
    expect(stick).toMatchObject({ target: "tag-4", msg: { t: "suspect", target: 4 }, next: "b" });
    expect(reactTo("postit", "a", { t: "suspect", target: 4 })).toEqual(stick);
    expect(reactTo("postit", "a", { t: "suspect", target: 0 })).toBeNull();
    expect(autoAct("postit", "b")).toBeNull();
  });
});

describe("postit 장면 — 둘째 날 포스트잇(D-22·D-23)", () => {
  const segs = (at: number): Record<number, Segment> => {
    const snap = tutorialSnap("postit", at);
    return Object.fromEntries(snap.ents.map((e) => [e.s, { p: e.p, t0: e.t0, v: e.v } satisfies Segment]));
  };

  it("시작 스냅: 내 자리(5)와 하린(4)·민준(0)·지호(3)는 가깝고(켜는 문턱 92%) 도윤(1)·서연(2)은 멀다", () => {
    const s = segs(T0);
    for (const near of [4, 0, 3]) expect(withinNoteReach(s[5], s[near], T0, NOTE_REACH_ON_PCT), `5↔${near}`).toBe(true);
    for (const far of [1, 2]) expect(withinNoteReach(s[5], s[far], T0, NOTE_REACH_ON_PCT), `5↔${far}`).toBe(false);
  });

  it("스냅의 모든 자리가 플라자 지도에서 걸을 수 있는 칸이다(모든 장면)", () => {
    const map = mapOf("plaza");
    for (const s of TUTORIAL_SCENES) {
      for (const e of tutorialSnap(s.id, T0).ents) {
        const { c, r } = cellOfFx(e.p[0]!, e.p[1]!, map);
        expect(isWalkable(map, c, r), `${s.id} seat ${e.s}`).toBe(true);
      }
    }
    expect(UNIT).toBe(100);
  });

  it("스냅은 좌석 6개를 오름차순으로 싣고 t0 가 주어진 시각이다", () => {
    const snap = tutorialSnap("discussion", T0);
    expect(snap.ents.map((e) => e.s)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(snap.at).toBe(T0);
    for (const e of snap.ents) expect(e.t0).toBe(T0);
  });

  it("[의심]이 보이는 둘째 날 토론이다 — day.n 2, 도윤·서연은 유령, 시작 때는 종이가 없다", () => {
    const v = tutorialView("postit", "start", T0);
    expect(v.phase).toBe("discussion");
    expect(v.day?.n).toBe(2);
    expect(v.day && "suspects" in v.day).toBe(false);
    expect(v.me.suspectTo).toBeUndefined();
    expect(v.players.filter((p) => p.alive === false).map((p) => p.seat)).toEqual([1, 2]);
    expect(tutorialView("postit", "a", T0).day?.suspects).toBeUndefined();
  });

  it("붙인 뒤(b): day.suspects [{to:4, from:5}]·me.suspectTo 4·day.n 2, 다음 비트(c)는 day.n 3·suspects 키 없음", () => {
    const b = tutorialView("postit", "b", T0);
    expect(b.day?.n).toBe(2);
    expect(b.day?.suspects).toEqual([{ to: 4, from: 5 }]);
    expect(b.me.suspectTo).toBe(4);
    const c = tutorialView("postit", "c", T0);
    expect(c.day?.n).toBe(3);
    expect(c.day && "suspects" in c.day).toBe(false);
    expect(c.me.suspectTo).toBeUndefined();
  });
});

describe("로컬 send 어댑터(makeTutorialSend)", () => {
  it("어떤 메시지든 true 를 돌려주고 해당 콜백만 부른다", () => {
    const calls: string[] = [];
    const send = makeTutorialSend({
      onAnswer: (text, final) => calls.push(`answer:${text}:${final}`),
      onEndDiscussion: (on) => calls.push(`end:${on}`),
      onVerdict: (agree) => calls.push(`verdict:${agree}`),
      onPoint: (t) => calls.push(`point:${t}`),
      onPick: (t) => calls.push(`pick:${t}`),
      onSuspect: (t) => calls.push(`suspect:${t}`),
    });
    const msgs: ClientMessage[] = [
      { t: "answer", text: "가", final: false },
      { t: "endDiscussion", on: true },
      { t: "verdict", agree: false },
      { t: "point", target: 4 },
      { t: "pick", target: 0 },
      { t: "suspect", target: 4 },
      { t: "move", x: 1, z: 2 },
      { t: "ping", c: 1 },
    ];
    for (const m of msgs) expect(send(m)).toBe(true);
    expect(calls).toEqual(["answer:가:false", "end:true", "verdict:false", "point:4", "pick:0", "suspect:4"]);
  });

  it("콜백이 없어도 true 이고 던지지 않는다", () => {
    const send = makeTutorialSend({});
    expect(send({ t: "suspect", target: 1 })).toBe(true);
    expect(send({ t: "leave" })).toBe(true);
  });
});

describe("첫날 실험방 연습", () => {
  const playtest = { playtest: true };

  it("첫날 안에 단서를 보고 의심딱지를 붙인 뒤 투표 한 번과 제시어 공개를 거친다", () => {
    expect(TUTORIAL_PLAYTEST_SCENES.map((scene) => scene.id)).toEqual([
      "roles", "keyword", "answers", "postit", "discussion", "verdict", "answerReveal", "night", "end",
    ]);
    const postit = tutorialView("postit", "b", T0, 0, playtest);
    expect(postit).toMatchObject({ map: "bar", playtest: true, day: { n: 1, suspects: [{ from: 5, to: 4 }] } });
    const discussion = tutorialView("discussion", "c", T0, 6, playtest);
    expect(discussion.day).toMatchObject({ endCount: 6, voteOpensAt: T0 + 45_000, voteReadyTotal: 6, voteReadyRequired: 4 });
    expect(tutorialView("answerReveal", "a", T0, 0, playtest).day?.keyword?.answer).toBe(TUTORIAL_CAST.word);
  });

  it("다른 사람에게 투표하거나 건너뛰면 첫 투표 집계에 내 선택을 반영한다", () => {
    expect(reactTo("verdict", "a", { t: "firstBallot", target: TUTORIAL_CAST.me }, true)).toBeNull();
    for (const [firstBallot, votes, holds] of [[4, 1, 5], [null, 0, 6]] as const) {
      const action = reactTo("verdict", "a", { t: "firstBallot", target: firstBallot }, true);
      expect(action?.next).toBe("b");
      const options = { ...playtest, firstBallot };
      expect(tutorialView("verdict", "b", T0, 1, options).me.firstBallot).toBe(firstBallot);
      const result = tutorialView("verdict", "c", T0, 1, options);
      expect(result.day?.firstBallot?.result).toEqual({ target: null, votes, holds, reason: "held" });
      expect(result.me.firstBallot).toBeUndefined();
    }
  });

  it("시민의 밤에는 얼굴 대신 준비를 받고 아침에 밤의 피해자만 탈락한다", () => {
    expect(reactTo("night", "a", { t: "pick", target: 0 }, true)).toBeNull();
    expect(reactTo("night", "a", { t: "nightDone" }, true)?.next).toBe("b");
    const waiting = tutorialView("night", "b", T0, 1, playtest);
    expect(waiting.me.nightDone).toBe(true);
    expect(waiting.me.pick).toBeUndefined();
    const morning = tutorialView("night", "c", T0, 1, playtest);
    expect(morning.players.filter((player) => player.alive === false).map(({ seat }) => seat)).toEqual([TUTORIAL_CAST.nightVictim]);
  });
});

describe("파일 규칙", () => {
  const src = readFileSync(`${ROOT}src/game/tutorialScript.ts`, "utf8");
  const code = src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");

  it("시각·난수를 직접 읽지 않는다(Date.now·Math.random 호출 없음)", () => {
    expect(code).not.toMatch(/Date\.now|Math\.random|new Date/);
  });

  it("가짜 view 는 satisfies RoomView 로 만들고 서버·소켓·세션 모듈을 가져오지 않는다", () => {
    expect(code).toMatch(/satisfies RoomView/);
    expect(code).not.toMatch(/from\s+"[^"]*(worker|useRoomConnection|net\/api|net\/session)/);
  });

  it("RoomView 모양을 따른다(타입 점검용 참조)", () => {
    const v: RoomView = tutorialView("roles", "a", T0);
    expect(v.maxPlayers).toBeGreaterThanOrEqual(v.players.length);
  });
});
