import { describe, expect, it } from "vitest";
import { audience, channelOf } from "../../shared/game/audience";
import {
  CHAT_EVICT_BATCH,
  CHAT_KEEP,
  CHAT_KEY_PREFIX,
  CHAT_REPLAY_BALLOTS,
  CHAT_REPLAY_PER_CHANNEL,
  appendLine,
  appendWhisperPair,
  chatKey,
  emptyChatLog,
  replayFor,
  restoreChatLog,
  seatMask,
  toWire,
} from "../../shared/game/chatLog";
import type { ChatLog, ChatRecord } from "../../shared/game/chatLog";
import { attachConnection, createRoomState, joinRoom } from "../../shared/game/room";
import type { Player, RoomState } from "../../shared/game/room";
import type { RoleId } from "../../shared/game/roles";
import type { ChatChannel, ChatLineWire, PhaseId } from "../../shared/protocol";

// 비교는 JSON 한 줄 문자열이나 스칼라로 한다 — 여러 줄 diff 는 TAP 보고서(RED 증거)를 깨뜨린다.
const json = (v: unknown): string => JSON.stringify(v);

/** n 명이 모두 연결된 대기실(seat 0~n-1). */
function lobbyOf(n: number): RoomState {
  const created = createRoomState({
    code: "0420",
    hostId: "player-id-0000-aaaa",
    hostToken: "token-secret-0000-aaaa-0123456789",
    hostNickname: "이름0",
    now: 0,
  });
  if (!created.ok) throw new Error("createRoomState failed");
  let state = attachConnection(created.state, "player-id-0000-aaaa", "conn-0");
  for (let i = 1; i < n; i += 1) {
    const id = `player-id-000${i}-aaaa`;
    const joined = joinRoom(state, { playerId: id, token: `token-secret-000${i}-aaaa-0123456789`, nickname: `이름${i}` });
    if (!joined.ok) throw new Error(`joinRoom failed: ${joined.error}`);
    state = attachConnection(joined.state, id, `conn-${i}`);
  }
  return state;
}

/** 8명 판: 마피아 seat 1·4, 경찰 3, 의사 6, 시민 0·2·5·7. 탈락자는 dead 로 정한다. */
const ROLES: Record<number, RoleId> = { 0: "citizen", 1: "mafia", 2: "citizen", 3: "police", 4: "mafia", 5: "citizen", 6: "doctor", 7: "citizen" };

function eightAt(phase: PhaseId, day: number, dead: readonly number[]): RoomState {
  const base = lobbyOf(8);
  return {
    ...base,
    phase,
    day,
    players: base.players.map((p): Player => ({ ...p, role: ROLES[p.seat], alive: dead.includes(p.seat) ? false : undefined })),
  };
}

const NO_SEATS: ReadonlySet<string> = new Set();

function line(ch: ChatChannel, seat: number, text: string, r: number, at = 1000, n = 1): { ch: ChatChannel; seat: number; text: string; at: number; n: number; r: number } {
  return { ch, seat, text, at, n, r };
}

describe("상수", () => {
  it("값 (결정 0058)", () => {
    expect(CHAT_REPLAY_PER_CHANNEL).toBe(30);
    expect(CHAT_KEEP.all).toBe(100);
    expect(CHAT_KEEP.mafia).toBe(300);
    expect(CHAT_KEEP.ghost).toBe(300);
    expect(CHAT_EVICT_BATCH).toBe(20);
    expect(CHAT_KEY_PREFIX).toBe("chat:");
  });
});

describe("chatKey", () => {
  it("6자리 0패딩, 넘으면 그대로", () => {
    expect(chatKey(1)).toBe("chat:000001");
    expect(chatKey(999999)).toBe("chat:999999");
    expect(chatKey(1234567)).toBe("chat:1234567");
  });

  it("문자열 정렬이 쓰기 순서와 같다 (6자리 안에서)", () => {
    const keys = [3, 12, 100, 20, 1].map(chatKey);
    expect([...keys].sort().join(",")).toBe([1, 3, 12, 20, 100].map(chatKey).join(","));
  });
});

describe("seatMask", () => {
  it("좌석 0·3·7 의 id 집합 → 0b10001001", () => {
    const players = lobbyOf(8).players;
    const ids = new Set(players.filter((p) => [0, 3, 7].includes(p.seat)).map((p) => p.id));
    expect(seatMask(players, ids)).toBe(0b10001001);
  });

  it("빈 집합은 0, 방 전원은 255", () => {
    const players = lobbyOf(8).players;
    expect(seatMask(players, NO_SEATS)).toBe(0);
    expect(seatMask(players, new Set(players.map((p) => p.id)))).toBe(255);
  });

  it("방에 없는 id 는 무시한다", () => {
    const players = lobbyOf(4).players;
    expect(seatMask(players, new Set(["stranger", players[1]!.id]))).toBe(0b10);
  });
});

describe("appendLine", () => {
  it("seq 는 채널마다 1부터 따로 세고, g 는 전체 쓰기 순서 1,2,3…", () => {
    let log = emptyChatLog();
    const order: ChatChannel[] = ["all", "mafia", "all", "ghost", "mafia", "all", "ghost", "ghost"];
    const seen: string[] = [];
    for (const ch of order) {
      const r = appendLine(log, line(ch, 0, "글", 255));
      log = r.log;
      seen.push(`${r.record.g}:${r.record.ch}${r.record.seq}`);
    }
    expect(seen.join(" ")).toBe("1:all1 2:mafia1 3:all2 4:ghost1 5:mafia2 6:all3 7:ghost2 8:ghost3");
  });

  it("공개 줄의 seq 에는 비공개 채널 줄 때문에 생기는 틈이 없다 (부채널)", () => {
    let log = emptyChatLog();
    for (let i = 0; i < 12; i += 1) {
      log = appendLine(log, line(i % 3 === 0 ? "all" : i % 3 === 1 ? "mafia" : "ghost", 0, `줄${i}`, 255)).log;
    }
    const allSeqs = log.records.filter((x) => x.ch === "all").map((x) => x.seq);
    expect(allSeqs.join(",")).toBe("1,2,3,4");
  });

  it("입력 로그를 바꾸지 않고 새 객체를 돌려준다", () => {
    const log = emptyChatLog();
    const before = json(log);
    const r = appendLine(log, line("all", 2, "안녕", 0b100));
    expect(json(log)).toBe(before);
    expect(r.log === log).toBe(false);
    expect(r.log.records.length).toBe(1);
    expect(r.log.nextG).toBe(2);
    expect(r.log.nextSeq.all).toBe(2);
    expect(r.log.nextSeq.mafia).toBe(1);
  });

  it("레코드에 seat·text·at·일차·마스크를 그대로 담는다", () => {
    const r = appendLine(emptyChatLog(), line("mafia", 4, "오늘밤", 0b10010, 5555, 2));
    expect(json(r.record)).toBe(json({ g: 1, ch: "mafia", seq: 1, seat: 4, text: "오늘밤", at: 5555, n: 2, r: 0b10010 }));
  });

  it("all 101번째 줄: 가장 오래된 all 20줄의 g 가 evicted, all 은 81줄, 다른 채널은 그대로", () => {
    let log = emptyChatLog();
    const allGs: number[] = [];
    for (let i = 0; i < 100; i += 1) {
      // all 사이사이에 다른 채널 줄을 섞어 g 가 연속이 아니게 한다.
      if (i % 10 === 0) log = appendLine(log, line("mafia", 1, `밤${i}`, 255)).log;
      const r = appendLine(log, line("all", 0, `줄${i}`, 255));
      expect(r.evicted.length).toBe(0);
      log = r.log;
      allGs.push(r.record.g);
    }
    const mafiaBefore = log.records.filter((x) => x.ch === "mafia").length;
    const r = appendLine(log, line("all", 0, "백한번째", 255));
    expect(r.evicted.join(",")).toBe(allGs.slice(0, 20).join(","));
    expect(r.log.records.filter((x) => x.ch === "all").length).toBe(81);
    expect(r.log.records.filter((x) => x.ch === "mafia").length).toBe(mafiaBefore);
    // 지운 g 는 로그에 없고, 새 줄은 남는다.
    expect(r.log.records.some((x) => r.evicted.includes(x.g))).toBe(false);
    expect(r.log.records.some((x) => x.text === "백한번째")).toBe(true);
    // 번호는 이어진다 (지워도 되돌아가지 않는다).
    expect(r.record.seq).toBe(101);
    expect(r.log.nextSeq.all).toBe(102);
  });

  it("mafia·ghost 상한은 300", () => {
    for (const ch of ["mafia", "ghost"] as const) {
      let log = emptyChatLog();
      for (let i = 0; i < 300; i += 1) {
        const r = appendLine(log, line(ch, 1, `줄${i}`, 255));
        expect(r.evicted.length).toBe(0);
        log = r.log;
      }
      const r = appendLine(log, line(ch, 1, "삼백한번째", 255));
      expect(r.evicted.length).toBe(20);
      expect(r.log.records.length).toBe(281);
    }
  });

  it("채널은 서로의 상한을 쓰지 않는다 (mafia 줄이 많아도 all 은 지워지지 않는다)", () => {
    let log = emptyChatLog();
    for (let i = 0; i < 100; i += 1) log = appendLine(log, line("all", 0, `공개${i}`, 255)).log;
    for (let i = 0; i < 250; i += 1) log = appendLine(log, line("mafia", 1, `밤${i}`, 255)).log;
    expect(log.records.filter((x) => x.ch === "all").length).toBe(100);
    expect(log.records.filter((x) => x.ch === "mafia").length).toBe(250);
  });
});

describe("toWire", () => {
  it("키는 정확히 at·ch·seat·seq·text — 마스크·g·일차는 나가지 않는다", () => {
    const r = appendLine(emptyChatLog(), line("all", 3, "안녕", 255, 777, 4)).record;
    const w = toWire(r);
    expect(Object.keys(w).sort().join(",")).toBe("at,ch,seat,seq,text");
    expect(json(w)).toBe(json({ ch: "all", seat: 3, seq: 1, text: "안녕", at: 777 }));
  });

  it("레코드에 덧붙은 키가 있어도 복사하지 않는다 (펼쳐 복사 금지)", () => {
    const polluted = { g: 1, ch: "all", seq: 1, seat: 0, text: "x", at: 1, n: 1, r: 255, id: "player-id", role: "mafia" } as ChatRecord;
    expect(Object.keys(toWire(polluted)).sort().join(",")).toBe("at,ch,seat,seq,text");
  });
});

describe("replayFor", () => {
  it("그 좌석 비트가 켜진 줄만, g 오름차순", () => {
    let log = emptyChatLog();
    log = appendLine(log, line("all", 0, "하나", 0b111)).log;
    log = appendLine(log, line("all", 1, "둘", 0b010)).log;
    log = appendLine(log, line("mafia", 1, "셋", 0b110)).log;
    log = appendLine(log, line("all", 2, "넷", 0b101)).log;
    expect(replayFor(log, 0).map((l) => l.text).join(",")).toBe("하나,넷");
    expect(replayFor(log, 1).map((l) => l.text).join(",")).toBe("하나,둘,셋");
    expect(replayFor(log, 2).map((l) => l.text).join(",")).toBe("하나,셋,넷");
    expect(replayFor(log, 3).length).toBe(0);
  });

  it("반환 줄의 키는 정확히 at·ch·seat·seq·text", () => {
    const log = appendLine(emptyChatLog(), line("all", 0, "x", 1)).log;
    const out = replayFor(log, 0);
    expect(out.length).toBe(1);
    expect(Object.keys(out[0]!).sort().join(",")).toBe("at,ch,seat,seq,text");
  });

  it("채널별 최근 30줄: 31번째가 들어오면 가장 오래된 줄이 빠진다", () => {
    let log = emptyChatLog();
    for (let i = 1; i <= 31; i += 1) log = appendLine(log, line("all", 0, `줄${i}`, 1)).log;
    for (let i = 1; i <= 3; i += 1) log = appendLine(log, line("mafia", 0, `밤${i}`, 1)).log;
    const out = replayFor(log, 0);
    expect(out.filter((l) => l.ch === "all").length).toBe(30);
    expect(out.filter((l) => l.ch === "all")[0]!.text).toBe("줄2");
    expect(out.filter((l) => l.ch === "mafia").length).toBe(3);
  });

  it("한 채널이 30줄을 채워도 다른 채널 줄을 밀어내지 않는다 (채널별 30, 최대 90)", () => {
    let log = emptyChatLog();
    for (let i = 0; i < 50; i += 1) log = appendLine(log, line("all", 0, `공개${i}`, 1)).log;
    for (let i = 0; i < 5; i += 1) log = appendLine(log, line("mafia", 0, `밤${i}`, 1)).log;
    expect(replayFor(log, 0).length).toBe(35);
  });

  it("마스크로만 복원한다: 저장된 마스크 밖 좌석은 지금의 역할·생존과 무관하게 받지 못한다", () => {
    const log = appendLine(emptyChatLog(), line("mafia", 1, "비밀", 0b10010)).log;
    expect(replayFor(log, 1).length).toBe(1);
    expect(replayFor(log, 4).length).toBe(1);
    for (const seat of [0, 2, 3, 5, 6, 7]) expect(replayFor(log, seat).length).toBe(0);
  });

  it("perChannel 인자로 상한을 바꿀 수 있다", () => {
    let log = emptyChatLog();
    for (let i = 0; i < 10; i += 1) log = appendLine(log, line("all", 0, `줄${i}`, 1)).log;
    expect(replayFor(log, 0, 4).map((l) => l.text).join(",")).toBe("줄6,줄7,줄8,줄9");
  });

  it("범위 밖 좌석은 빈 배열", () => {
    const log = appendLine(emptyChatLog(), line("all", 0, "x", 255)).log;
    expect(replayFor(log, -1).length).toBe(0);
    expect(replayFor(log, 8).length).toBe(0);
    expect(replayFor(log, 1.5).length).toBe(0);
  });
});

describe("대본 성질: 복원 == 라이브로 받은 줄의 채널별 최근 30줄 (결정 0058, T-07-04)", () => {
  /** 한 줄을 audience 규칙대로 보내고, 각 좌석이 라이브로 받은 줄을 기록한다. */
  function script(): { log: ChatLog; live: Map<number, ChatLineWire[]> } {
    let log = emptyChatLog();
    const live = new Map<number, ChatLineWire[]>();
    for (let seat = 0; seat < 8; seat += 1) live.set(seat, []);
    const say = (state: RoomState, senderSeat: number, text: string): void => {
      const sender = state.players.find((p) => p.seat === senderSeat)!;
      const ch = channelOf(state, sender.id);
      if (ch === null) throw new Error(`seat ${senderSeat} cannot speak in ${state.phase}`);
      const ids = audience(state, { k: "chat", ch });
      const r = appendLine(log, { ch, seat: senderSeat, text, at: 1000 + log.nextG, n: state.day ?? 0, r: seatMask(state.players, ids) });
      log = r.log;
      for (const p of state.players) if (ids.has(p.id)) live.get(p.seat)!.push(toWire(r.record));
    };
    const lobby = lobbyOf(8);
    for (let i = 0; i < 40; i += 1) say(lobby, i % 8, `로비${i}`);
    const night1 = eightAt("night", 1, []);
    for (let i = 0; i < 10; i += 1) say(night1, i % 2 === 0 ? 1 : 4, `밤1-${i}`);
    const day2 = eightAt("discussion", 2, [5]);
    for (let i = 0; i < 5; i += 1) say(day2, 5, `유령${i}`);
    for (let i = 0; i < 3; i += 1) say(day2, 0, `낮${i}`);
    const night2 = eightAt("night", 2, [5]);
    for (let i = 0; i < 5; i += 1) say(night2, i % 2 === 0 ? 4 : 1, `밤2-${i}`);
    say(night2, 5, "유령밤");
    return { log, live };
  }

  const lastPerChannel = (lines: readonly ChatLineWire[], per: number): string => {
    const out: ChatLineWire[] = [];
    for (const ch of ["all", "mafia", "ghost"] as const) out.push(...lines.filter((l) => l.ch === ch).slice(-per));
    return out.map((l) => `${l.ch}${l.seq}`).sort().join(",");
  };

  it("모든 좌석에서 replayFor == 라이브 줄의 채널별 최근 30줄", () => {
    const { log, live } = script();
    for (let seat = 0; seat < 8; seat += 1) {
      const replay = replayFor(log, seat);
      expect(lastPerChannel(replay, 30)).toBe(lastPerChannel(live.get(seat)!, 30));
      expect(replay.length).toBe(
        ["all", "mafia", "ghost"].reduce((sum, ch) => sum + Math.min(30, live.get(seat)!.filter((l) => l.ch === ch).length), 0),
      );
    }
  });

  it("복원은 라이브보다 넓지 않다: 복원한 줄은 모두 라이브로 받은 줄이다", () => {
    const { log, live } = script();
    for (let seat = 0; seat < 8; seat += 1) {
      const liveKeys = new Set(live.get(seat)!.map((l) => `${l.ch}${l.seq}`));
      for (const l of replayFor(log, seat)) expect(liveKeys.has(`${l.ch}${l.seq}`)).toBe(true);
    }
  });

  it("복원은 보낸 순서(g)다", () => {
    const { log } = script();
    const out = replayFor(log, 1);
    const texts = out.map((l) => l.text);
    const gOf = (t: string): number => log.records.find((x) => x.text === t)!.g;
    const gs = texts.map(gOf);
    expect([...gs].sort((a, b) => a - b).join(",")).toBe(gs.join(","));
  });

  it("seat 5(첫 밤엔 산 시민)는 첫 밤 마피아 줄 0, 탈락한 뒤 둘째 밤 마피아 줄 5를 받는다", () => {
    const { log } = script();
    const mafiaForFive = replayFor(log, 5).filter((l) => l.ch === "mafia");
    expect(mafiaForFive.length).toBe(5);
    expect(mafiaForFive.map((l) => l.text).join(",")).toBe("밤2-0,밤2-1,밤2-2,밤2-3,밤2-4");
  });

  it("산 시민은 mafia·ghost 줄을 한 줄도 받지 않는다", () => {
    const { log } = script();
    for (const seat of [0, 2, 3, 6, 7]) {
      const out = replayFor(log, seat);
      expect(out.filter((l) => l.ch !== "all").length).toBe(0);
    }
  });

  it("마피아(seat 1·4)는 mafia 줄 15개 전부(첫 밤 10 + 둘째 밤 5), 유령 줄은 받지 않는다", () => {
    const { log } = script();
    for (const seat of [1, 4]) {
      const out = replayFor(log, seat);
      expect(out.filter((l) => l.ch === "mafia").length).toBe(15);
      expect(out.filter((l) => l.ch === "ghost").length).toBe(0);
    }
  });

  it("공개 줄은 채널별 30줄이라 로비 40줄 + 낮 3줄 중 최근 30줄이다", () => {
    const { log } = script();
    const all = replayFor(log, 0).filter((l) => l.ch === "all");
    expect(all.length).toBe(30);
    expect(all[all.length - 1]!.text).toBe("낮2");
    expect(all[0]!.seq).toBe(14);
  });

  it("seat 5(탈락자)는 유령 줄 6개를 받는다 (낮 5 + 둘째 밤 1)", () => {
    const { log } = script();
    expect(replayFor(log, 5).filter((l) => l.ch === "ghost").length).toBe(6);
  });
});

describe("restoreChatLog", () => {
  const rec = (g: number, ch: ChatChannel, seq: number, text = `줄${g}`): ChatRecord => ({ g, ch, seq, seat: 0, text, at: 100 + g, n: 1, r: 255 });

  it("순서가 섞여 있어도 g 순으로 정렬하고 nextG·nextSeq 를 되살린다", () => {
    const stored = [rec(5, "mafia", 2), rec(2, "all", 2), rec(1, "all", 1), rec(4, "ghost", 1), rec(3, "mafia", 1)];
    const log = restoreChatLog(stored);
    expect(log.records.map((x) => x.g).join(",")).toBe("1,2,3,4,5");
    expect(log.nextG).toBe(6);
    expect(json(log.nextSeq)).toBe(json({ all: 3, mafia: 3, ghost: 2 }));
  });

  it("손상 레코드는 버린다", () => {
    const good = rec(1, "all", 1);
    const bad: unknown[] = [
      null,
      "chat",
      42,
      { ...rec(2, "all", 2), ch: "bogus" },
      { ...rec(3, "all", 3), text: 7 },
      { ...rec(4, "all", 4), seq: 1.5 },
      { ...rec(5, "all", 5), g: 0 },
      { ...rec(6, "all", 6), seat: -1 },
      { ...rec(7, "all", 7), seat: 8 },
      { ...rec(8, "all", 8), r: 256 },
      { ...rec(9, "all", 9), at: Number.NaN },
      { ...rec(10, "all", 10), n: "1" },
    ];
    const log = restoreChatLog([...bad, good]);
    expect(log.records.length).toBe(1);
    expect(log.records[0]!.g).toBe(1);
    expect(log.nextG).toBe(2);
  });

  it("복원한 레코드에 덧붙은 키는 버린다", () => {
    const log = restoreChatLog([{ ...rec(1, "all", 1), extra: "x" }]);
    expect(Object.keys(log.records[0]!).sort().join(",")).toBe("at,ch,g,n,r,seat,seq,text");
  });

  it("아무것도 없으면 빈 로그 (nextG 1, 채널마다 nextSeq 1)", () => {
    const log = restoreChatLog([]);
    expect(log.records.length).toBe(0);
    expect(log.nextG).toBe(1);
    expect(json(log.nextSeq)).toBe(json({ all: 1, mafia: 1, ghost: 1 }));
    expect(json(emptyChatLog())).toBe(json(log));
  });

  it("이터러블(Map 값)도 받는다", () => {
    const map = new Map<string, unknown>([
      [chatKey(2), rec(2, "all", 2)],
      [chatKey(1), rec(1, "all", 1)],
    ]);
    const log = restoreChatLog(map.values());
    expect(log.records.map((x) => x.g).join(",")).toBe("1,2");
  });

  it("저장 → 복원 → 이어 쓰기: 번호가 이어지고 복원 전후 replayFor 가 같다", () => {
    let log = emptyChatLog();
    for (let i = 0; i < 5; i += 1) log = appendLine(log, line("all", 0, `a${i}`, 1)).log;
    for (let i = 0; i < 3; i += 1) log = appendLine(log, line("mafia", 1, `m${i}`, 2)).log;
    const restored = restoreChatLog(log.records);
    expect(json(replayFor(restored, 0))).toBe(json(replayFor(log, 0)));
    const next = appendLine(restored, line("mafia", 1, "다음", 2)).record;
    expect(next.g).toBe(9);
    expect(next.seq).toBe(4);
  });

  it("같은 g 가 둘이면 먼저 온 쪽만 남긴다", () => {
    const log = restoreChatLog([rec(1, "all", 1, "먼저"), rec(1, "all", 2, "나중")]);
    expect(log.records.length).toBe(1);
    expect(log.records[0]!.text).toBe("먼저");
  });
});

// 09-14: 카드 표시 k(결정 0061-11) — 서버가 사망 전환에서 만든 유언·쪽지 카드. 사람 줄에는 키가 없다.
describe("카드 표시 k (결정 0061-11)", () => {
  it("appendLine 에 k 를 주면 record.k 가 그 값이고, 주지 않으면 키 자체가 없다", () => {
    const withK = appendLine(emptyChatLog(), { ...line("all", 2, "억울해요", 255), k: "will" }).record;
    expect(withK.k).toBe("will");
    const plain = appendLine(emptyChatLog(), line("all", 2, "안녕", 255)).record;
    expect(Object.keys(plain).includes("k")).toBe(false);
  });

  it("toWire 는 k 가 있을 때만 k 를 복사한다", () => {
    const card = appendLine(emptyChatLog(), { ...line("all", 2, "쪽지", 255), k: "note" }).record;
    expect(json(toWire(card))).toBe(json({ ch: "all", seat: 2, seq: 1, text: "쪽지", at: 1000, k: "note" }));
    const plain = appendLine(emptyChatLog(), line("all", 2, "안녕", 255)).record;
    expect(Object.keys(toWire(plain)).sort().join(",")).toBe("at,ch,seat,seq,text");
  });

  it("replayFor 가 k 를 그대로 싣는다", () => {
    const log = appendLine(emptyChatLog(), { ...line("all", 2, "유언", 255), k: "will" }).log;
    expect(replayFor(log, 0)[0]!.k).toBe("will");
  });

  it("restoreChatLog 는 k 가 will·note 가 아닌 줄을 버리고 note 줄은 살린다", () => {
    const base: ChatRecord = { g: 1, ch: "all", seq: 1, seat: 0, text: "글", at: 1, n: 1, r: 255 };
    const log = restoreChatLog([{ ...base, g: 1, k: "x" }, { ...base, g: 2, seq: 2, k: "note" }, { ...base, g: 3, seq: 3, k: "will" }, { ...base, g: 4, seq: 4 }]);
    expect(log.records.map((x) => `${x.g}:${x.k ?? "-"}`).join(",")).toBe("2:note,3:will,4:-");
  });
});

// 09.1.1-02: 귓속말 두 줄(결정 0066-2) — 본문(당사자 마스크)과 사실(나머지 마스크)이 같은 all 채널 seq 를 쓴다.
describe("appendWhisperPair (결정 0066-2)", () => {
  const PARTY = (1 << 1) | (1 << 2); // 좌석 1·2
  const OTHERS = 255 & ~PARTY;
  const pair = (log: ChatLog, text = "비밀"): ReturnType<typeof appendWhisperPair> => appendWhisperPair(log, { seat: 1, to: 2, text, at: 9, n: 2, partyMask: PARTY, othersMask: OTHERS });

  it("두 레코드가 같은 seq 를 쓰고 all 채널 번호는 한 번만 소비된다", () => {
    const first = appendLine(emptyChatLog(), line("all", 0, "앞 줄", 255)).log;
    const r = pair(first);
    expect(`${r.body.seq}|${r.fact.seq}|${r.log.nextSeq.all}|${r.log.nextSeq.mafia}|${r.log.nextSeq.ghost}`).toBe("2|2|3|1|1");
  });
  it("g 는 둘이 따로 받는다(저장 키 두 개)", () => {
    const r = pair(emptyChatLog());
    expect(`${r.body.g}|${r.fact.g}|${r.log.nextG}`).toBe("1|2|3");
  });
  it("본문 레코드는 k whisper·당사자 마스크·본문, 사실 레코드는 k whispered·나머지 마스크·빈 본문, 둘 다 to 가 있다", () => {
    const r = pair(emptyChatLog());
    expect(json([r.body.k, r.body.r, r.body.text, r.body.to, r.fact.k, r.fact.r, r.fact.text, r.fact.to])).toBe(json(["whisper", PARTY, "비밀", 2, "whispered", OTHERS, "", 2]));
  });
  it("toWire 는 k·to 를 싣고 마스크·g·일차는 싣지 않는다", () => {
    const r = pair(emptyChatLog());
    expect(json(toWire(r.body))).toBe(json({ ch: "all", seat: 1, seq: 1, text: "비밀", at: 9, k: "whisper", to: 2 }));
    expect(json(toWire(r.fact))).toBe(json({ ch: "all", seat: 1, seq: 1, text: "", at: 9, k: "whispered", to: 2 }));
  });
  it("replayFor: 당사자는 본문 줄만, 나머지는 사실 줄만 받는다(seq 하나에 줄 하나)", () => {
    const log = pair(emptyChatLog()).log;
    const kinds = (seat: number): string => replayFor(log, seat).map((l) => `${l.seq}:${l.k}`).join(",");
    expect([kinds(1), kinds(2), kinds(0), kinds(5)].join("|")).toBe("1:whisper|1:whisper|1:whispered|1:whispered");
  });
  it("입력 로그는 바꾸지 않는다", () => {
    const log = appendLine(emptyChatLog(), line("all", 0, "앞 줄", 255)).log;
    const before = json(log);
    pair(log);
    expect(json(log)).toBe(before);
  });
  it("all 채널 상한(100)을 넘기면 오래된 줄이 지워지고 새 두 줄은 남는다", () => {
    let log = emptyChatLog();
    for (let i = 0; i < CHAT_KEEP.all - 1; i += 1) log = appendLine(log, line("all", 0, `줄${i}`, 255)).log;
    const r = pair(log); // 99 + 2 = 101 > 100
    expect(r.evicted.length).toBe(CHAT_EVICT_BATCH);
    expect(r.evicted.includes(r.body.g) || r.evicted.includes(r.fact.g)).toBe(false);
    expect(r.log.records.some((x) => x.g === r.body.g) && r.log.records.some((x) => x.g === r.fact.g)).toBe(true);
    expect(r.evicted[0]).toBe(1);
  });
  it("restoreChatLog 왕복: 두 종류 모두 살아 돌아오고 to 가 없거나 범위 밖이면 버린다", () => {
    const r = pair(emptyChatLog());
    const bad = { ...r.body, g: 3, seq: 2, to: undefined };
    const out = { ...r.body, g: 4, seq: 3, to: 8 };
    const restored = restoreChatLog([r.fact, r.body, bad, out]);
    expect(restored.records.map((x) => `${x.g}:${x.k}:${x.to}`).join(",")).toBe("1:whisper:2,2:whispered:2");
  });
  it("will·note 줄에 붙은 to 는 버린다", () => {
    const base: ChatRecord = { g: 1, ch: "all", seq: 1, seat: 0, text: "글", at: 1, n: 1, r: 255 };
    const restored = restoreChatLog([{ ...base, k: "will", to: 3 }]);
    expect(json(restored.records[0])).toBe(json({ ...base, k: "will" }));
  });
});

describe("ballots 카드 (결정 0066-3, O-8)", () => {
  const card = (log: ChatLog, text = "1,2|3", seat = 4): ReturnType<typeof appendLine> => appendLine(log, { ...line("all", seat, text, 255), k: "ballots" });

  it("상수: 복원 때 더하는 ballots 카드는 최근 3장", () => {
    expect(CHAT_REPLAY_BALLOTS).toBe(3);
  });

  it("toWire 가 k ballots 를 복사하고 restoreChatLog 가 받는다(왕복)", () => {
    const r = card(emptyChatLog());
    expect(json(toWire(r.record))).toBe(json({ ch: "all", seat: 4, seq: 1, text: "1,2|3", at: 1000, k: "ballots" }));
    expect(json(restoreChatLog([r.record]).records)).toBe(json([r.record]));
  });

  it("일반 줄이 상한(100)을 훨씬 넘게 쌓여도 ballots 레코드는 지워지지 않고 상한 계산에도 들지 않는다", () => {
    let log = card(emptyChatLog()).log;
    let evicted: number[] = [];
    for (let i = 0; i < CHAT_KEEP.all * 2; i += 1) {
      const r = appendLine(log, line("all", 0, `줄${i}`, 255));
      log = r.log;
      evicted = [...evicted, ...r.evicted];
    }
    expect(log.records.some((x) => x.k === "ballots")).toBe(true);
    expect(evicted.includes(1)).toBe(false);
    // 일반 줄은 상한 안(ballots 를 빼고 센다): 100 이하이고 지우기 시작한 뒤라 100 - 배치 이상
    const plain = log.records.filter((x) => x.k !== "ballots").length;
    expect(plain <= CHAT_KEEP.all && plain > CHAT_KEEP.all - CHAT_EVICT_BATCH).toBe(true);
  });

  it("ballots 카드를 더하는 순간에는 일반 줄을 지우지 않는다(카드는 상한을 세지 않는다)", () => {
    let log = emptyChatLog();
    for (let i = 0; i < CHAT_KEEP.all; i += 1) log = appendLine(log, line("all", 0, `줄${i}`, 255)).log;
    const r = card(log);
    expect(r.evicted.length).toBe(0);
  });

  it("귓속말 쌍이 상한을 넘겨도 ballots 레코드는 지우지 않는다", () => {
    let log = card(emptyChatLog()).log;
    for (let i = 0; i < CHAT_KEEP.all - 1; i += 1) log = appendLine(log, line("all", 0, `줄${i}`, 255)).log;
    const r = appendWhisperPair(log, { seat: 1, to: 2, text: "비밀", at: 9, n: 2, partyMask: 6, othersMask: 249 });
    expect(r.evicted.includes(1)).toBe(false);
    expect(r.log.records.some((x) => x.k === "ballots")).toBe(true);
  });

  it("replayFor: 채널 30줄 한도 밖에 있는 ballots 카드도 마스크에 들면 최근 3장까지 더해 g 순서로 돌려준다", () => {
    let log = emptyChatLog();
    log = card(log, "0|1", 1).log; // 오래된 카드 1
    for (let i = 0; i < 5; i += 1) log = appendLine(log, line("all", 0, `a${i}`, 255)).log;
    log = card(log, "0|2", 2).log; // 카드 2
    log = card(log, "0|3", 3).log; // 카드 3
    log = card(log, "0|4", 4).log; // 카드 4
    for (let i = 0; i < 40; i += 1) log = appendLine(log, line("all", 0, `b${i}`, 255)).log;
    const got = replayFor(log, 0).filter((l) => l.ch === "all");
    const cards = got.filter((l) => l.k === "ballots");
    expect(cards.map((c) => c.text).join(",")).toBe("0|2,0|3,0|4"); // 최근 3장
    expect(got.length).toBe(30 + 3); // 일반 최근 30 + 카드 3 (이미 든 줄은 중복 없음)
    expect(got.map((l) => l.seq).join(",")).toBe([...got.map((l) => l.seq)].sort((a, b) => a - b).join(","));
    expect(new Set(got.map((l) => l.seq)).size).toBe(got.length);
  });

  it("replayFor: 최근 30줄 안에 든 카드는 중복으로 더해지지 않고, 마스크에 없는 좌석은 카드를 받지 않는다", () => {
    let log = emptyChatLog();
    log = appendLine(log, line("all", 0, "앞", 255)).log;
    log = card(log).log;
    expect(replayFor(log, 0).length).toBe(2);
    const masked = appendLine(emptyChatLog(), { ...line("all", 4, "1|2", 1 << 3), k: "ballots" }).log;
    expect(replayFor(masked, 0).length).toBe(0);
    expect(replayFor(masked, 3).length).toBe(1);
  });
});
