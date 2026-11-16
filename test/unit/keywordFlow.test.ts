// 23-01 트레이서: 첫날 roleReveal → keyword(13초) → dayAnnounce, 키워드 선택(beginGame), view 모양(D-01·D-05·D-06·D-29).
// 키워드는 서버 전용 값이다 — 장르 라벨은 모두에게, 단어는 산 시민 편 본인에게만(마피아 view 에는 키가 없다).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { genreLabelOf, GENRES, keywordEntryOf, KEYWORD_SWITCH } from "../../shared/game/keywords";
import { KEYWORD_MS, KEYWORD_READ_MS, KEYWORD_WRITE_MS, nextPhaseOf, PHASE_DEFS, ROLE_REVEAL_MS } from "../../shared/game/phases";
import { beginGame, startGame } from "../../shared/game/room";
import type { RoomState } from "../../shared/game/room";
import { tick } from "../../shared/game/tick";
import { buildView } from "../../shared/game/view";
import { openKeyword } from "../helpers/keyword";
import { seededRandInt } from "../helpers/seededRandom";
import { lobbyOf, startedAt } from "../helpers/voteState";

let restore: () => void = () => {};
beforeEach(() => {
  restore = openKeyword();
});
afterEach(() => restore());

describe("키워드 상수와 단계 표 (D-01)", () => {
  it("KEYWORD_MS = 읽기 3000 + 쓰기 10000 = 13000, keyword 는 본인 역할을 싣는 단계다", () => {
    expect(KEYWORD_READ_MS).toBe(3000);
    expect(KEYWORD_WRITE_MS).toBe(10_000);
    expect(KEYWORD_MS).toBe(KEYWORD_READ_MS + KEYWORD_WRITE_MS);
    expect(KEYWORD_MS).toBe(13_000);
    expect(PHASE_DEFS.keyword.revealsOwnRole).toBe(true);
    expect(PHASE_DEFS.keyword.durationMs).toBe(13_000);
    expect(nextPhaseOf("roleReveal")).toBe("keyword");
    expect(nextPhaseOf("keyword")).toBe("dayAnnounce");
  });
});

describe("키워드 모듈 (영화 장르)", () => {
  it("장르 라벨은 영화, 단어는 30개 이상, 첫 항목은 해리포터(표본 별칭 포함)", () => {
    expect(GENRES[0]!.label).toBe("영화");
    expect(GENRES[0]!.words.length).toBeGreaterThanOrEqual(30);
    expect(GENRES[0]!.words[0]!.word).toBe("해리포터");
    expect(GENRES[0]!.words[0]!.aliases).toContain("Harry Potter");
    expect(genreLabelOf(GENRES[0]!.id)).toBe("영화");
    expect(keywordEntryOf(GENRES[0]!.id, "해리포터")?.word).toBe("해리포터");
    expect(keywordEntryOf(GENRES[0]!.id, "없는말")).toBeUndefined();
  });
});

describe("beginGame 의 키워드 선택 (D-05·D-29)", () => {
  it("시작하면 서버 전용 keyword { genre, word } 가 있고 단어 목록에서 조회된다", () => {
    const started = startGame(lobbyOf(6), "player-id-0000-aaaa", 1000, seededRandInt(1));
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    const kw = started.state.keyword;
    expect(kw).toBeDefined();
    expect(keywordEntryOf(kw!.genre, kw!.word)).toBeDefined();
  });

  it("스위치를 끄면 keyword 키가 없고, 들어온 상태에 있던 keyword 도 지운다", () => {
    KEYWORD_SWITCH.on = false;
    const lobby: RoomState = { ...lobbyOf(6), keyword: { genre: GENRES[0]!.id, word: "해리포터" } };
    const next = beginGame(lobby, 1000, seededRandInt(1));
    expect("keyword" in next).toBe(false);
  });

  it("키워드는 맨 끝에서 난수를 두 번만 더 쓴다(역할·맵 순서는 그대로)", () => {
    const count = (): number => {
      const gen = seededRandInt(7);
      let n = 0;
      beginGame(lobbyOf(6), 1000, (k) => {
        n += 1;
        return gen(k);
      });
      return n;
    };
    const on = count();
    KEYWORD_SWITCH.on = false;
    expect(on - count()).toBe(2);
  });
});

describe("roleReveal → keyword → dayAnnounce (D-01·D-29)", () => {
  it("keyword 가 있으면 역할 확인 마감 뒤 keyword, 마감은 13초 뒤, state.day 는 아직 없다", () => {
    const reveal = startedAt(6, 3, "roleReveal");
    expect(reveal.keyword).toBeDefined();
    const at = reveal.phaseEndsAt!;
    const kw = tick(reveal, at, seededRandInt(4));
    expect(kw.phase).toBe("keyword");
    expect(kw.phaseEndsAt).toBe(at + KEYWORD_MS);
    expect(kw.day).toBeUndefined();
    expect(ROLE_REVEAL_MS).toBeGreaterThan(0);
  });

  it("keyword 마감 뒤 dayAnnounce 가 되고 일차 1", () => {
    const kw = startedAt(6, 3, "keyword");
    const next = tick(kw, kw.phaseEndsAt!, seededRandInt(4));
    expect(next.phase).toBe("dayAnnounce");
    expect(next.day).toBe(1);
  });

  it("keyword 가 없는 상태(옛 방·스위치 끔)는 역할 확인 다음이 곧장 dayAnnounce", () => {
    const reveal = startedAt(6, 3, "roleReveal");
    const { keyword: _drop, ...bare } = reveal;
    const next = tick(bare as RoomState, bare.phaseEndsAt!, seededRandInt(4));
    expect(next.phase).toBe("dayAnnounce");
    expect(next.day).toBe(1);
  });
});

describe("keyword 단계 view (D-06 누설 없음)", () => {
  const kwState = (): RoomState => startedAt(6, 3, "keyword");

  it("모든 viewer 의 day.keyword 는 { genre: 장르 라벨 } 로 같다", () => {
    const state = kwState();
    const label = genreLabelOf(state.keyword!.genre);
    for (const p of state.players) {
      const view = buildView(state, p.id, state.phaseEndsAt! - 1000);
      expect(view.phase).toBe("keyword");
      expect(view.day?.keyword).toEqual({ genre: label });
    }
  });

  it("시민·경찰·의사 본인은 me.keyword 로 단어를 받고, 마피아는 키 자체가 없다", () => {
    const state = kwState();
    const word = state.keyword!.word;
    let mafia = 0;
    let citizenSide = 0;
    for (const p of state.players) {
      const view = buildView(state, p.id, state.phaseEndsAt! - 1000);
      if (p.role === "mafia") {
        mafia += 1;
        expect("keyword" in view.me).toBe(false);
        expect(JSON.stringify(view)).not.toContain(word);
      } else {
        citizenSide += 1;
        expect(view.me.keyword).toBe(word);
      }
    }
    expect(mafia).toBeGreaterThan(0);
    expect(citizenSide).toBeGreaterThan(0);
  });

  it("역할 확인·낮 시작 단계의 view 에는 me.keyword 가 없다", () => {
    for (const phase of ["roleReveal", "dayAnnounce"] as const) {
      const state = startedAt(6, 3, phase);
      for (const p of state.players) {
        expect("keyword" in buildView(state, p.id, 20_000).me).toBe(false);
      }
    }
  });
});
