// 귓속말 규칙 단위 시험(09.1.1-02, 결정 0066-2). 결과는 한 줄 문자열로 비교한다(TAP 증거 규칙).
import { describe, expect, it } from "vitest";
import { WHISPER_MAX_GRAPHEMES, WHISPER_PER_DAY, WHISPER_PHASES, sendWhisper, whisperUsedToday } from "../../shared/game/whisper";
import { rulesetOf } from "../../shared/game/ruleset";
import { ROOM_TTL_MS } from "../../shared/game/room";
import type { Player, RoomState } from "../../shared/game/room";
import { buildView } from "../../shared/game/view";
import type { PhaseId } from "../../shared/protocol";
const GAME_RULES = rulesetOf("extended");

function player(i: number, extra: Partial<Player> = {}): Player {
  return {
    id: `p${i}`,
    token: `token-p${i}-0123456789`,
    seat: i,
    nickname: `이름${i}`,
    nicknameKey: `이름${i}`,
    joinSeq: i,
    connected: true,
    connId: `c${i}`,
    role: i === 0 ? "mafia" : "citizen",
    ...extra,
  };
}

function room(phase: PhaseId, n = 6, edit: (p: Player) => Player = (p) => p, day = 2): RoomState {
  return {
    code: "0420",
    createdAt: 0,
    expiresAt: ROOM_TTL_MS,
    phase,
    phaseEndsAt: 100_000,
    day,
    hostId: "p0",
    nextJoinSeq: n,
    players: Array.from({ length: n }, (_, i) => edit(player(i))),
  } as RoomState;
}

/** 결과 한 줄: ok|whispers 수 또는 오류 코드. */
const out = (r: ReturnType<typeof sendWhisper>): string => (r.ok ? `ok|${r.state.whispers?.length ?? 0}` : r.error);

describe("sendWhisper — 상수", () => {
  it("한 줄 30자소 · 낮마다 1번 · 토론 단계만", () => {
    expect(`${WHISPER_MAX_GRAPHEMES}|${WHISPER_PER_DAY}|${[...WHISPER_PHASES].join(",")}`).toBe("30|1|discussion");
  });
});

describe("sendWhisper — 성공과 하루 1번 (O-4)", () => {
  it("첫 번째는 성공하고 정리된 본문이 whispers 에 {n, from, to, text, at} 로 쌓인다", () => {
    const r = sendWhisper(room("discussion"), "p1", 2, "  비밀   이에요  ", 777);
    expect(out(r)).toBe("ok|1");
    if (r.ok) expect(JSON.stringify(r.state.whispers)).toBe(JSON.stringify([{ n: 2, from: 1, to: 2, text: "비밀 이에요", at: 777 }]));
  });
  it("같은 낮 두 번째는 BAD_MESSAGE 이고 입력 상태는 바뀌지 않는다", () => {
    const first = sendWhisper(room("discussion"), "p1", 2, "하나", 1);
    if (!first.ok) throw new Error("first failed");
    const before = JSON.stringify(first.state);
    expect(out(sendWhisper(first.state, "p1", 3, "둘", 2))).toBe("BAD_MESSAGE");
    expect(JSON.stringify(first.state)).toBe(before);
  });
  it("다른 사람은 같은 낮에도 보낼 수 있고, 같은 사람도 다음 일차에는 다시 보낼 수 있다", () => {
    const first = sendWhisper(room("discussion"), "p1", 2, "하나", 1);
    if (!first.ok) throw new Error("first failed");
    expect(out(sendWhisper(first.state, "p3", 2, "다른 사람", 2))).toBe("ok|2");
    expect(out(sendWhisper({ ...first.state, day: 3 }, "p1", 2, "다음 낮", 3))).toBe("ok|2");
  });
  it("whisperUsedToday 는 그 일차에 그 좌석이 보낸 수만 센다", () => {
    const first = sendWhisper(room("discussion"), "p1", 2, "하나", 1);
    if (!first.ok) throw new Error("first failed");
    expect(`${whisperUsedToday(first.state, 1)}|${whisperUsedToday(first.state, 2)}|${whisperUsedToday({ ...first.state, day: 3 }, 1)}`).toBe("1|0|0");
  });
});

describe("sendWhisper — 거절 코드 통일 (오라클 금지)", () => {
  it.each<PhaseId>(["lobby", "dayAnnounce", "nomination", "defense", "verdict", "execution", "night", "morning", "ended"])("단계 %s 는 WRONG_PHASE", (phase) => {
    expect(out(sendWhisper(room(phase), "p1", 2, "안녕", 1))).toBe("WRONG_PHASE");
  });
  it("유령 보낸 사람 · 자기 자신 · 죽은 대상 · 방에 없는 좌석 · 음수·소수 좌석은 모두 BAD_MESSAGE", () => {
    const dead = room("discussion", 6, (p) => (p.seat === 4 ? { ...p, alive: false } : p));
    expect(out(sendWhisper(dead, "p4", 2, "안녕", 1))).toBe("BAD_MESSAGE"); // 유령 보낸 사람
    expect(out(sendWhisper(dead, "p1", 1, "안녕", 1))).toBe("BAD_MESSAGE"); // 자기 자신
    expect(out(sendWhisper(dead, "p1", 4, "안녕", 1))).toBe("BAD_MESSAGE"); // 죽은 대상
    expect(out(sendWhisper(dead, "p1", 7, "안녕", 1))).toBe("BAD_MESSAGE"); // 방에 없는 좌석
    expect(out(sendWhisper(dead, "p1", -1, "안녕", 1))).toBe("BAD_MESSAGE");
    expect(out(sendWhisper(dead, "p1", 1.5, "안녕", 1))).toBe("BAD_MESSAGE");
    expect(out(sendWhisper(dead, "nobody", 2, "안녕", 1))).toBe("BAD_MESSAGE"); // 방에 없는 행위자
  });
  it("빈 글(공백뿐)·보이는 글자 없음·31자소는 BAD_MESSAGE", () => {
    expect(out(sendWhisper(room("discussion"), "p1", 2, "   ", 1))).toBe("BAD_MESSAGE");
    expect(out(sendWhisper(room("discussion"), "p1", 2, "\u200b\u200c", 1))).toBe("BAD_MESSAGE");
    expect(out(sendWhisper(room("discussion"), "p1", 2, "가".repeat(31), 1))).toBe("BAD_MESSAGE");
  });
  it("거절된 호출은 입력 상태를 바꾸지 않는다", () => {
    const s = room("discussion");
    const before = JSON.stringify(s);
    sendWhisper(s, "p1", 1, "자기 자신", 1);
    expect(JSON.stringify(s)).toBe(before);
  });
  it("단계 어긋남은 대상·본문이 틀려도 WRONG_PHASE 가 먼저다", () => {
    expect(out(sendWhisper(room("night"), "p1", 1, "   ", 1))).toBe("WRONG_PHASE");
  });
});

describe("sendWhisper — 30자소 경계와 연결 끊김 (O-5)", () => {
  it("한글 30자는 통과, 31자는 거절", () => {
    expect(out(sendWhisper(room("discussion"), "p1", 2, "가".repeat(30), 1))).toBe("ok|1");
  });
  it("이모지 가족(코드 단위가 길어도 자소 하나) 30개는 통과, 31개는 거절", () => {
    const fam = "👨‍👩‍👧";
    expect(out(sendWhisper(room("discussion"), "p1", 2, fam.repeat(30), 1))).toBe("ok|1");
    expect(out(sendWhisper(room("discussion"), "p1", 2, fam.repeat(31), 1))).toBe("BAD_MESSAGE");
  });
  it("한글 조합(NFD 풀어쓴 입력)도 정리 뒤 자소로 센다", () => {
    const nfd = "가".normalize("NFD").repeat(30);
    expect(out(sendWhisper(room("discussion"), "p1", 2, nfd, 1))).toBe("ok|1");
  });
  it("연결이 끊긴 대상에게도 보낼 수 있다", () => {
    const s = room("discussion", 6, (p) => (p.seat === 2 ? { ...p, connected: false, connId: null } : p));
    expect(out(sendWhisper(s, "p1", 2, "돌아오면 읽어요", 1))).toBe("ok|1");
  });
});

describe("view — me.whisperUsed 와 whispers 비노출", () => {
  const sent = (phase: PhaseId = "discussion", day = 2): RoomState => {
    const r = sendWhisper(room("discussion", 6, (p) => p, day), "p1", 2, "비밀-CANARY", 1);
    if (!r.ok) throw new Error("send failed");
    return { ...r.state, phase };
  };
  it("보낸 사람 본인의 discussion view 에만 me.whisperUsed:true", () => {
    const s = sent();
    // 기본판(결정 0072)에서는 귓속말이 꺼져 있어 서버 상태에 기록이 있어도 키가 없다(판 규칙의 whisper 를 켜면 true).
    expect(buildView(s, "p1", 5).me.whisperUsed).toBe(GAME_RULES.whisper ? true : undefined);
    for (const id of ["p0", "p2", "p3"]) expect("whisperUsed" in buildView(s, id, 5).me).toBe(false);
  });
  it("보내기 전·다른 단계·다음 일차에는 키가 없다", () => {
    expect("whisperUsed" in buildView(room("discussion"), "p1", 5).me).toBe(false);
    expect("whisperUsed" in buildView(sent("nomination"), "p1", 5).me).toBe(false);
    expect("whisperUsed" in buildView({ ...sent(), day: 3 }, "p1", 5).me).toBe(false);
  });
  it("whispers 키와 본문은 어떤 사람의 view 에도 실리지 않는다", () => {
    const s = sent();
    for (const id of ["p0", "p1", "p2", "p3"]) {
      const raw = JSON.stringify(buildView(s, id, 5));
      expect(raw.includes("CANARY")).toBe(false);
      expect(raw.includes("whispers")).toBe(false);
    }
  });
  it("탈락한 보낸 사람의 view 에는 whisperUsed 가 없다", () => {
    const s = sent();
    const dead = { ...s, players: s.players.map((p) => (p.seat === 1 ? { ...p, alive: false } : p)) };
    expect("whisperUsed" in buildView(dead, "p1", 5).me).toBe(false);
  });
});
