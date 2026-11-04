import { describe, expect, it } from "vitest";
import type { PhaseId, PublicPlayer, RoomView } from "../../shared/protocol";
import { WHISPER_TEXT, whisperLine, whisperTargets, whisperUsed, whisperVisible } from "../../src/game/whisperView";

// 09.1.1-09: 귓속말 화면의 순수 모델(UI-SPEC B). 서버 view 와 채팅 줄만 읽고 시각·난수가 없다.
const NAMES = ["민수", "영희", "서준", "지아", "도윤", "하은"];

interface Opt {
  phase?: PhaseId;
  count?: number;
  mySeat?: number;
  dead?: number[];
  used?: boolean;
}

function makeView(o: Opt = {}): RoomView {
  const count = o.count ?? 6;
  const players: PublicPlayer[] = Array.from({ length: count }, (_, seat) => ({
    seat,
    nickname: NAMES[seat] ?? `p${seat}`,
    connected: true,
    isHost: seat === 0,
    ...(o.dead?.includes(seat) ? { alive: false } : {}),
  }));
  return {
    code: "0042",
    phase: o.phase ?? "discussion",
    phaseEndsAt: 1_700_000_090_000,
    phaseDurationMs: 90_000,
    serverNow: 1_700_000_000_000,
    minPlayers: 4,
    maxPlayers: 8,
    players,
    me: { seat: o.mySeat ?? 0, isHost: true, ...(o.used ? { whisperUsed: true as const } : {}) },
    day: { n: 1, roles: [] },
  } as RoomView;
}

const nameOf = (seat: number): string => NAMES[seat] ?? "";

describe("whisperVisible (UI-SPEC B-1, O-3)", () => {
  it("낮 토론에서 내가 산 사람이고 나 말고 산 사람이 있으면 참", () => {
    expect(whisperVisible(makeView())).toBe(true);
  });

  it("토론이 아닌 단계는 거짓: 낮 시작·지목·변론·찬반·마지막 3인·밤", () => {
    for (const phase of ["dayAnnounce", "nomination", "showdown", "defense", "verdict", "night", "execution"] as PhaseId[]) {
      expect(whisperVisible(makeView({ phase })), phase).toBe(false);
    }
  });

  it("유령(내가 죽음)은 거짓 — 버튼을 만들지 않는다(O-21)", () => {
    expect(whisperVisible(makeView({ dead: [0] }))).toBe(false);
  });

  it("나 말고 산 사람이 없으면 거짓", () => {
    expect(whisperVisible(makeView({ count: 3, dead: [1, 2] }))).toBe(false);
  });
});

describe("whisperUsed / whisperTargets", () => {
  it("whisperUsed 는 view.me.whisperUsed === true 일 때만 참", () => {
    expect(whisperUsed(makeView())).toBe(false);
    expect(whisperUsed(makeView({ used: true }))).toBe(true);
  });

  it("대상은 나를 뺀 산 사람의 좌석 집합", () => {
    expect([...whisperTargets(makeView({ mySeat: 1, dead: [3] }))].sort()).toEqual([0, 2, 4, 5]);
  });
});

describe("whisperLine: 줄 모델 (UI-SPEC B-3)", () => {
  it("공개 사실 줄: {A} → {B} 귓속말, system + whisper 아이콘, data 표식 public", () => {
    const m = whisperLine({ kind: "system", icon: "whisper", seat: 1, to: 2, text: "" }, 0, nameOf);
    expect(m).toEqual({ kind: "system", whisper: "public", icon: "whisper", text: "영희 → 서준 귓속말" });
  });

  it("받은 줄: 내가 받는 사람이면 side in, 제목 '{A} → 나' + 본문", () => {
    const m = whisperLine({ kind: "whisper", seat: 1, to: 0, text: "비밀이에요" }, 0, nameOf);
    expect(m).toEqual({ kind: "whisper", whisper: "in", icon: "whisper", title: "영희 → 나", text: "비밀이에요" });
  });

  it("보낸 줄: 내가 보낸 사람이면 side out, 제목 '나 → {B}' + 본문", () => {
    const m = whisperLine({ kind: "whisper", seat: 0, to: 3, text: "믿어요" }, 0, nameOf);
    expect(m).toEqual({ kind: "whisper", whisper: "out", icon: "whisper", title: "나 → 지아", text: "믿어요" });
  });

  it("당사자(보낸·받은 사람)에게는 사실 줄이 와도 그리지 않는다 — 비공개 줄 하나만 본다", () => {
    expect(whisperLine({ kind: "system", icon: "whisper", seat: 0, to: 2, text: "" }, 0, nameOf)).toBeNull();
    expect(whisperLine({ kind: "system", icon: "whisper", seat: 1, to: 0, text: "" }, 0, nameOf)).toBeNull();
  });

  it("당사자가 아닌 사람에게 본문 줄이 잘못 와도 그리지 않는다", () => {
    expect(whisperLine({ kind: "whisper", seat: 1, to: 2, text: "남의 비밀" }, 0, nameOf)).toBeNull();
  });

  it("귓속말 줄이 아니면 null (to 없는 시스템 줄·사람 줄)", () => {
    expect(whisperLine({ kind: "system", text: "민수 님 입장" }, 0, nameOf)).toBeNull();
    expect(whisperLine({ kind: "player", seat: 1, text: "안녕" }, 0, nameOf)).toBeNull();
  });
});

describe("문구 단일 출처 (UI-SPEC Copywriting Contract 원문)", () => {
  it("헤더 안내·placeholder·알림·거절", () => {
    expect(WHISPER_TEXT.modeHint).toBe("귓속말할 사람을 눌러요");
    expect(WHISPER_TEXT.placeholder("민수")).toBe("민수 님에게만 보여요");
    expect(WHISPER_TEXT.received("영희")).toBe("영희 님의 귓속말");
    expect(WHISPER_TEXT.rejectPhase).toBe("지금은 보낼 수 없어요");
    expect(WHISPER_TEXT.rejectOther).toBe("보내지 못했어요. 다시 해 보세요");
    expect(WHISPER_TEXT.tagLabel("민수")).toBe("민수 님에게 귓속말");
    expect(WHISPER_TEXT.groupLabel).toBe("귓속말");
  });

  it("버튼 이름: 가능 '귓속말 보내기, 오늘 1번 남음' / 불가 '오늘 귓속말을 이미 보냈어요'", () => {
    expect(WHISPER_TEXT.floatReady).toBe("귓속말 보내기, 오늘 1번 남음");
    expect(WHISPER_TEXT.floatUsed).toBe("오늘 귓속말을 이미 보냈어요");
  });
});
