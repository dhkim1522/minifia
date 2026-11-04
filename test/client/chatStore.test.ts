import { describe, expect, it, vi } from "vitest";
import { CARD_HOLD_BALLOTS_MS, ChatStore } from "../../src/net/chatStore";
import type { ChatLineFrame, ChatLogFrame } from "../../shared/protocol";

const chat = (ch: ChatLineFrame["ch"], seat: number, seq: number, text: string, at: number): ChatLineFrame => ({
  t: "chat",
  ch,
  seat,
  seq,
  text,
  at,
});

function ready(): ChatStore {
  const store = new ChatStore();
  store.setContext({ pk: "0:lobby", channel: "all", epoch: 1 });
  return store;
}

describe("ChatStore: chat 프레임 한 줄 (CHAT-01 트레이서)", () => {
  it("chat 프레임을 적용하면 구독자가 한 번 알림을 받고 줄이 표시 흐름에 나온다", () => {
    const store = ready();
    const cb = vi.fn();
    store.subscribe(cb);
    store.apply(chat("all", 2, 1, "안녕", 1000), 1, 1000);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(store.lines()).toHaveLength(1);
    const [line] = store.visibleLines("all");
    expect(line).toMatchObject({ kind: "player", seat: 2, text: "안녕", key: "all:1:1000", ch: "all", scope: "all" });
  });

  it("같은 프레임을 다시 받으면 한 줄 그대로이고 구독자도 다시 부르지 않는다", () => {
    const store = ready();
    const cb = vi.fn();
    store.apply(chat("all", 2, 1, "안녕", 1000), 1, 1000);
    store.subscribe(cb);
    store.apply(chat("all", 2, 1, "안녕", 1000), 1, 1001);
    expect(store.lines()).toHaveLength(1);
    expect(cb).not.toHaveBeenCalled();
  });

  it("낡은 epoch 의 프레임은 버린다", () => {
    const store = ready();
    const cb = vi.fn();
    store.subscribe(cb);
    store.apply(chat("all", 2, 1, "낡음", 1000), 0, 1000);
    expect(store.lines()).toHaveLength(0);
    expect(cb).not.toHaveBeenCalled();
  });

  it("revision 은 줄이 바뀔 때만 늘어난다", () => {
    const store = ready();
    const r0 = store.revision();
    store.apply(chat("all", 2, 1, "안녕", 1000), 1, 1000);
    const r1 = store.revision();
    expect(r1).toBeGreaterThan(r0);
    store.apply(chat("all", 2, 1, "안녕", 1000), 1, 1000);
    expect(store.revision()).toBe(r1);
  });

  it("사람 줄은 서버 프레임이 와야만 생긴다(낙관적 표시 없음)", () => {
    const store = ready();
    expect(store.lines()).toHaveLength(0);
    expect(store.visibleLines("all")).toHaveLength(0);
  });
});

const logFrame = (lines: ChatLogFrame["lines"]): ChatLogFrame => ({ t: "chatLog", lines });
const wire = (ch: ChatLineFrame["ch"], seat: number, seq: number, at: number, text = `m${seq}`) => ({ ch, seat, seq, text, at });

describe("ChatStore: chatLog 복원 합치기 (D2)", () => {
  it("실시간 줄과 합집합으로 합치고 at 순으로 두며 lastWasReplay 를 참으로 둔다", () => {
    const store = ready();
    store.apply(chat("all", 1, 2, "두번째", 2000), 1, 2000);
    store.apply(logFrame([wire("all", 1, 1, 1000, "첫번째"), wire("all", 1, 2, 2000, "두번째")]), 1, 2500);
    expect(store.lines().map((l) => l.key)).toEqual(["all:1:1000", "all:2:2000"]);
    expect(store.lastWasReplay()).toBe(true);
  });

  it("다음 실시간 chat 을 받으면 lastWasReplay 가 거짓으로 돌아온다", () => {
    const store = ready();
    store.apply(logFrame([wire("all", 1, 1, 1000)]), 1, 1500);
    expect(store.lastWasReplay()).toBe(true);
    store.apply(chat("all", 2, 2, "새 줄", 3000), 1, 3000);
    expect(store.lastWasReplay()).toBe(false);
  });

  it("이미 있는 줄만 다시 받는 실시간 중복은 lastWasReplay 를 바꾸지 않는다", () => {
    const store = ready();
    store.apply(logFrame([wire("all", 1, 1, 1000)]), 1, 1500);
    store.apply(chat("all", 1, 1, "m1", 1000), 1, 1600);
    expect(store.lastWasReplay()).toBe(true);
  });

  it("대기실로 되돌린 뒤 seq 가 1 부터 다시 시작해도 at 이 달라 섞이지 않는다", () => {
    const store = ready();
    store.apply(chat("all", 1, 1, "옛 판", 1000), 1, 1000);
    store.apply(chat("all", 1, 1, "새 판", 9000), 1, 9000);
    expect(store.lines().map((l) => l.text)).toEqual(["옛 판", "새 판"]);
  });
});

describe("ChatStore: 100줄 상한 (T-07-10)", () => {
  it("사람 줄과 시스템 줄을 합쳐 105줄을 넣으면 100줄만 남고 가장 오래된 5줄이 빠진다", () => {
    const store = ready();
    for (let i = 1; i <= 100; i++) store.apply(chat("all", 1, i, `m${i}`, i * 10), 1, i * 10);
    for (let i = 1; i <= 5; i++) store.addSystem(`시스템 ${i}`, { scope: "all", at: 2000 + i });
    expect(store.lines()).toHaveLength(100);
    expect(store.lines()[0].text).toBe("m6");
    expect(store.lines().at(-1)?.text).toBe("시스템 5");
  });

  it("복원 합치기로 넘쳐도 오래된 줄부터 버린다", () => {
    const store = ready();
    store.apply(logFrame(Array.from({ length: 105 }, (_, i) => wire("all", 1, i + 1, (i + 1) * 10))), 1, 5000);
    expect(store.lines()).toHaveLength(100);
    expect(store.lines()[0].seq).toBe(6);
  });
});

describe("ChatStore: 채널별 표시 흐름", () => {
  function mixed(): ChatStore {
    const store = ready();
    store.apply(chat("all", 1, 1, "낮 줄", 1000), 1, 1000);
    store.apply(chat("mafia", 2, 1, "밤 줄", 2000), 1, 2000);
    store.apply(chat("ghost", 3, 1, "유령 줄", 3000), 1, 3000);
    store.addSystem("공개 시스템", { scope: "all", at: 1500 });
    store.addSystem("마피아 시스템", { scope: "mafia", at: 2500 });
    store.addSystem("유령 시스템", { scope: "ghost", at: 3500 });
    return store;
  }

  it("all 은 all 줄과 공개 시스템 줄만 보인다", () => {
    expect(mixed().visibleLines("all").map((l) => l.text)).toEqual(["낮 줄", "공개 시스템"]);
  });

  it("채널이 없으면(null) all 과 같다", () => {
    const store = mixed();
    expect(store.visibleLines(null)).toEqual(store.visibleLines("all"));
  });

  it("mafia 는 mafia 줄과 마피아 시스템 줄만 보인다(낮 줄은 숨겨진다)", () => {
    expect(mixed().visibleLines("mafia").map((l) => l.text)).toEqual(["밤 줄", "마피아 시스템"]);
  });

  it("ghost 는 받은 줄 전부를 시간 순 한 흐름으로 본다", () => {
    expect(mixed().visibleLines("ghost").map((l) => l.text)).toEqual([
      "낮 줄",
      "공개 시스템",
      "밤 줄",
      "마피아 시스템",
      "유령 줄",
      "유령 시스템",
    ]);
  });

  it("시민 편 저장소는 받은 줄만 들고 있어 다른 채널 줄을 만들어 내지 않는다 (T-07-11)", () => {
    const store = ready();
    store.apply(chat("all", 1, 1, "공개", 1000), 1, 1000);
    store.apply({ t: "typing", seat: 2, on: true }, 1, 1100);
    store.apply({ t: "chatReject", why: "rate" }, 1, 1200);
    for (const ch of ["all", "mafia", "ghost", null] as const) {
      expect(store.visibleLines(ch).filter((l) => l.ch === "mafia" || l.ch === "ghost")).toHaveLength(0);
    }
    expect(store.lines()).toHaveLength(1);
  });
});

describe("ChatStore: 입력 중 만료 (CHAT-04)", () => {
  const on = (seat: number) => ({ t: "typing" as const, seat, on: true });
  const off = (seat: number) => ({ t: "typing" as const, seat, on: false });

  it("받은 시각 + 4500ms 직전까지 켜지고 그 시각에 꺼진다", () => {
    const store = ready();
    store.apply(on(3), 1, 1000);
    expect([...store.typingSeats(1000)]).toEqual([3]);
    expect([...store.typingSeats(5499)]).toEqual([3]);
    expect([...store.typingSeats(5500)]).toEqual([]);
    expect(store.nextTypingExpiry()).toBe(5500);
  });

  it("켜짐을 다시 받으면 만료가 새 시각 + 4500 으로 늘어난다", () => {
    const store = ready();
    store.apply(on(3), 1, 1000);
    store.apply(on(3), 1, 3000);
    expect(store.nextTypingExpiry()).toBe(7500);
  });

  it("off 를 받으면 즉시 빠지고 구독자를 부른다", () => {
    const store = ready();
    store.apply(on(3), 1, 1000);
    const cb = vi.fn();
    store.subscribe(cb);
    store.apply(off(3), 1, 1200);
    expect([...store.typingSeats(1200)]).toEqual([]);
    expect(store.nextTypingExpiry()).toBeNull();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("모르는 좌석의 off 는 구독자를 부르지 않는다", () => {
    const store = ready();
    const cb = vi.fn();
    store.subscribe(cb);
    store.apply(off(5), 1, 1200);
    expect(cb).not.toHaveBeenCalled();
  });

  it("그 좌석의 채팅 줄이 도착하면 빠진다(다른 좌석은 그대로)", () => {
    const store = ready();
    store.apply(on(3), 1, 1000);
    store.apply(on(4), 1, 1000);
    store.apply(chat("all", 3, 1, "보냄", 1500), 1, 1500);
    expect([...store.typingSeats(1500)]).toEqual([4]);
  });

  it("복원 chatLog 의 줄은 입력 중을 끄지 않는다", () => {
    const store = ready();
    store.apply(on(3), 1, 1000);
    store.apply(logFrame([wire("all", 3, 1, 900)]), 1, 1100);
    expect([...store.typingSeats(1100)]).toEqual([3]);
  });

  it("setContext 에서 단계 키·채널·epoch 중 하나가 바뀌면 모두 빠진다", () => {
    for (const next of [
      { pk: "1:day", channel: "all" as const, epoch: 1 },
      { pk: "0:lobby", channel: "mafia" as const, epoch: 1 },
      { pk: "0:lobby", channel: "all" as const, epoch: 2 },
    ]) {
      const store = ready();
      store.apply(on(3), 1, 1000);
      store.setContext(next);
      expect([...store.typingSeats(1000)]).toEqual([]);
    }
  });

  it("setContext 가 같은 값이면 그대로 둔다", () => {
    const store = ready();
    store.apply(on(3), 1, 1000);
    store.setContext({ pk: "0:lobby", channel: "all", epoch: 1 });
    expect([...store.typingSeats(1000)]).toEqual([3]);
  });

  it("좌석 8개 상한을 넘으면 가장 먼저 만료될 좌석부터 밀려난다 (T-07-10)", () => {
    const store = ready();
    for (let s = 0; s < 8; s++) store.apply(on(s), 1, 1000 + s);
    store.apply(on(9), 1, 2000);
    const seats = [...store.typingSeats(2000)];
    expect(seats).toHaveLength(8);
    expect(seats).not.toContain(0);
    expect(seats).toContain(9);
  });

  it("clearTypingSeat 는 한 좌석만 지운다", () => {
    const store = ready();
    store.apply(on(3), 1, 1000);
    store.apply(on(4), 1, 1000);
    store.clearTypingSeat(3);
    expect([...store.typingSeats(1000)]).toEqual([4]);
  });
});

describe("ChatStore: 막힘 알림", () => {
  const reject = (why: "rate" | "repeat" | "length" | "phase" | "other") => ({ t: "chatReject" as const, why });

  it("2500ms 동안 하나만 있고 그 뒤 사라진다", () => {
    const store = ready();
    store.apply(reject("rate"), 1, 1000);
    expect(store.notice(1000)).toBe("rate");
    expect(store.notice(3499)).toBe("rate");
    expect(store.notice(3500)).toBeNull();
    expect(store.noticeExpiry()).toBe(3500);
  });

  it("새 알림이 이전 것을 바꾸고 만료도 새 시각 기준이다", () => {
    const store = ready();
    store.apply(reject("rate"), 1, 1000);
    store.apply(reject("repeat"), 1, 1500);
    expect(store.notice(1500)).toBe("repeat");
    expect(store.noticeExpiry()).toBe(4000);
  });

  it("lastReject().n 이 거절마다 1씩 는다", () => {
    const store = ready();
    expect(store.lastReject()).toBeNull();
    store.apply(reject("rate"), 1, 1000);
    const n1 = store.lastReject()?.n ?? 0;
    store.apply(reject("rate"), 1, 1100);
    expect(store.lastReject()).toMatchObject({ why: "rate", at: 1100, n: n1 + 1 });
  });

  it("알림은 기록 줄이 아니다", () => {
    const store = ready();
    store.apply(reject("rate"), 1, 1000);
    expect(store.lines()).toHaveLength(0);
  });
});

describe("ChatStore: 시스템 줄·reset (A1)", () => {
  it("시스템 줄은 epoch 가 바뀌어도 남는다", () => {
    const store = ready();
    store.addSystem("지호 님 입장", { scope: "all", at: 1000, icon: "check" });
    store.setContext({ pk: "0:lobby", channel: "all", epoch: 2 });
    const [line] = store.visibleLines("all");
    expect(line).toMatchObject({ kind: "system", text: "지호 님 입장", scope: "all", icon: "check" });
  });

  it("addSystem 은 구독자를 부르고 revision 을 올린다", () => {
    const store = ready();
    const cb = vi.fn();
    store.subscribe(cb);
    const r = store.revision();
    store.addSystem("지호 님 입장", { scope: "all", at: 1000 });
    expect(cb).toHaveBeenCalledTimes(1);
    expect(store.revision()).toBeGreaterThan(r);
  });

  it("addSystem 에 kind 를 주면 그 종류로 남고(vote·hot), 안 주면 system 이다 (DAY-04·06)", () => {
    const store = ready();
    store.addSystem("민준 → 도윤", { scope: "all", kind: "vote", at: 1000 });
    store.addSystem("도윤 님이 앞서요", { scope: "all", kind: "hot", at: 1001 });
    store.addSystem("지목 시작", { scope: "all", at: 1002 });
    expect(store.visibleLines("all").map((l) => l.kind).join(",")).toBe("vote,hot,system");
  });

  it("vote·hot 줄도 scope 를 따른다 (유령 흐름에는 보이고 마피아 흐름에는 없다)", () => {
    const store = ready();
    store.addSystem("민준 → 도윤", { scope: "all", kind: "vote", at: 1000 });
    expect(store.visibleLines("mafia").length).toBe(0);
    expect(store.visibleLines("ghost").map((l) => l.kind).join(",")).toBe("vote");
  });

  it("reset 은 줄·입력 중·알림을 모두 비우고 구독자를 부른다", () => {
    const store = ready();
    store.apply(chat("all", 1, 1, "안녕", 1000), 1, 1000);
    store.apply({ t: "typing", seat: 2, on: true }, 1, 1000);
    store.apply({ t: "chatReject", why: "rate" }, 1, 1000);
    store.addSystem("입장", { scope: "all", at: 1100 });
    const cb = vi.fn();
    store.subscribe(cb);
    store.reset();
    expect(store.lines()).toHaveLength(0);
    expect([...store.typingSeats(1000)]).toEqual([]);
    expect(store.notice(1000)).toBeNull();
    expect(store.lastReject()).toBeNull();
    expect(store.lastWasReplay()).toBe(false);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("reset 뒤에는 낮은 epoch 의 새 연결 프레임도 받는다", () => {
    const store = ready();
    store.reset();
    store.apply(chat("all", 1, 1, "다시", 1000), 0, 1000);
    expect(store.lines()).toHaveLength(1);
  });
});

describe("ChatStore: nextTypingExpiry(now) 는 지난 만료를 건너뛴다", () => {
  it("now 를 주면 이미 지난 만료는 빼고 다음 만료만 돌려준다", () => {
    const store = ready();
    store.apply({ t: "typing", seat: 1, on: true }, 1, 1000);
    store.apply({ t: "typing", seat: 2, on: true }, 1, 3000);
    expect(store.nextTypingExpiry(5500)).toBe(7500);
    expect(store.nextTypingExpiry(7500)).toBeNull();
  });
});

// 09-11 (MORN-02): 서버 카드 줄(k)은 받은 시각 + 보류 시간 뒤에 보이고, 재접속 chatLog 의 카드는 바로 보인다.
describe("ChatStore: 카드 줄 (MORN-02, 결정 0061-11)", () => {
  const card = (k: "will" | "note", seat: number, seq: number, text: string, at: number): ChatLineFrame => ({ ...chat("all", seat, seq, text, at), k });

  it("유언 카드는 받은 시각 + 2800ms 전까지 목록에 없고 그 뒤에 kind card·card will 로 보인다", () => {
    const store = ready();
    store.apply(card("will", 3, 9, "범인은 2번", 900), 1, 1000);
    expect(store.visibleLines("all", 3799).length).toBe(0);
    const [line] = store.visibleLines("all", 3800);
    expect(`${line?.kind}|${line?.card}|${line?.seat}|${line?.text}`).toBe("card|will|3|범인은 2번");
  });

  it("nextCardReveal 은 보류 중인 가장 이른 공개 시각을 알리고, 지난 시각·보류 없음은 null 이다", () => {
    const store = ready();
    expect(store.nextCardReveal(0)).toBeNull();
    store.apply(card("will", 3, 9, "가", 900), 1, 1000);
    expect(store.nextCardReveal(1000)).toBe(3800);
    expect(store.nextCardReveal(3800)).toBeNull();
  });

  it("처형 단계 키(execution)에서는 보류가 2400ms 다", () => {
    const store = new ChatStore();
    store.setContext({ pk: "1:execution", channel: "all", epoch: 1 });
    store.apply(card("will", 3, 9, "가", 900), 1, 1000);
    expect(store.nextCardReveal(1000)).toBe(3400);
    expect(store.visibleLines("all", 3399).length).toBe(0);
    expect(store.visibleLines("all", 3400).length).toBe(1);
  });

  it("재접속 chatLog 로 받은 카드 줄은 보류 없이 바로 보인다", () => {
    const store = ready();
    const log: ChatLogFrame = { t: "chatLog", lines: [{ ch: "all", seat: 3, seq: 9, text: "가", at: 900, k: "note" }] };
    store.apply(log, 1, 1000);
    expect(store.visibleLines("all", 1000).map((l) => `${l.kind}|${l.card}`).join()).toBe("card|note");
    expect(store.nextCardReveal(1000)).toBeNull();
  });

  it("카드 프레임은 그 좌석의 입력 중 표시를 지우지 않는다", () => {
    const store = ready();
    store.apply({ t: "typing", seat: 3, on: true }, 1, 1000);
    store.apply(card("will", 3, 9, "가", 900), 1, 1100);
    expect(store.typingSeats(1100).has(3)).toBe(true);
  });

  it("같은 좌석의 유언 → 쪽지는 서버 seq 순으로 같은 보류를 쓴다 (A2)", () => {
    const store = ready();
    store.apply(card("will", 3, 9, "유언", 900), 1, 1000);
    store.apply(card("note", 3, 10, "쪽지", 900), 1, 1000);
    expect(store.visibleLines("all", 3800).map((l) => l.card).join()).toBe("will,note");
  });

  it("now 를 주지 않으면 보류를 적용하지 않는다(기존 호출 호환)", () => {
    const store = ready();
    store.apply(card("will", 3, 9, "가", 900), 1, 1000);
    expect(store.visibleLines("all").length).toBe(1);
  });
});

// 09-11 Task 2 (UI-SPEC 245행): 경찰 조사 결과는 이 화면에만 있는 로컬 카드, 카드 판별은 서버 k 필드뿐이다 (T-09-24)
describe("ChatStore: 로컬 카드와 위장 방지", () => {
  it("addLocalCard 는 보류 없이 all 범위에 kind card·card eye 줄로 바로 보인다", () => {
    const store = ready();
    store.addLocalCard({ icon: "eye", title: "민준", text: "마피아 아님", at: 5000 });
    const [line] = store.visibleLines("all", 5000);
    expect(`${line?.kind}|${line?.card}|${line?.title}|${line?.text}|${line?.scope}`).toBe("card|eye|민준|마피아 아님|all");
    expect(store.nextCardReveal(5000)).toBeNull();
  });

  it("reset() 뒤 사라지고 새 epoch 의 chatLog 합치기에서 다시 생기지 않는다", () => {
    const store = ready();
    store.addLocalCard({ icon: "eye", title: "민준", text: "마피아 아님", at: 5000 });
    store.reset();
    expect(store.lines().length).toBe(0);
    store.setContext({ pk: "1:day", channel: "all", epoch: 2 });
    store.apply({ t: "chatLog", lines: [{ ch: "all", seat: 1, seq: 1, text: "안녕", at: 6000 }] }, 2, 6000);
    expect(store.lines().map((l) => l.kind).join()).toBe("player");
  });

  it("사람이 보낸 chat 프레임(k 없음)은 본문이 '[유언]' 으로 시작해도 kind player 다", () => {
    const store = ready();
    store.apply(chat("all", 2, 1, "[유언] 범인은 3번", 1000), 1, 1000);
    const [line] = store.visibleLines("all", 1000);
    expect(`${line?.kind}|${line?.card}|${line?.revealAt}`).toBe("player|undefined|undefined");
  });
});

// 09.1-10 (결정 0063-3, UI-SPEC C-1): 편지가 뜨는 아침은 카드 보류를 편지 접힘 시각까지 늦춘다
describe("ChatStore: holdCardsUntil·liveCard (09.1-10)", () => {
  const card = (k: "will" | "note", seat: number, seq: number, text: string, at: number): ChatLineFrame => ({ ...chat("all", seat, seq, text, at), k });
  const reveal = (store: ChatStore, now: number) => store.visibleLines("all", now).map((l) => l.card ?? l.kind).join();

  it("보류 중인 카드들의 revealAt 을 늦추고 순서(유언 → 쪽지)는 그대로다", () => {
    const store = ready();
    store.apply(card("will", 3, 9, "유언", 900), 1, 1000);
    store.apply(card("note", 3, 10, "쪽지", 900), 1, 1000);
    store.holdCardsUntil(6400, 1100);
    expect(reveal(store, 3800)).toBe("");
    expect(reveal(store, 6399)).toBe("");
    expect(reveal(store, 6400)).toBe("will,note");
    expect(store.nextCardReveal(1100)).toBe(6400);
  });

  it("바로 보이는 줄(이미 지난 revealAt)·사람 줄·시스템 줄·복원 줄은 건드리지 않는다", () => {
    const store = ready();
    store.apply(card("note", 3, 1, "옛 쪽지", 100), 1, 100);
    store.apply(chat("all", 1, 2, "안녕", 200), 1, 200);
    store.addSystem("안내", { scope: "all", at: 300 });
    store.apply({ t: "chatLog", lines: [{ ch: "all", seat: 2, seq: 7, text: "복원", at: 50, k: "will" }] }, 1, 400);
    store.holdCardsUntil(9000, 5000);
    expect(store.visibleLines("all", 5000).length).toBe(4);
  });

  it("그 뒤 at 이 지나기 전에 라이브로 오는 카드도 at 까지 보류되고, at 이 지나면 보통 규칙(받은 시각 + 2800)이다", () => {
    const store = ready();
    store.holdCardsUntil(6400, 1000);
    store.apply(card("note", 3, 11, "쪽지", 900), 1, 1500);
    expect(reveal(store, 6399)).toBe("");
    expect(reveal(store, 6400)).toBe("note");
    store.apply(card("will", 4, 12, "다음 판", 900), 1, 7000);
    expect(reveal(store, 9799)).toBe("note");
    expect(reveal(store, 9800)).toBe("note,will");
  });

  it("at 이 기존 revealAt 보다 이르면 늦추지 않는다(max)", () => {
    const store = ready();
    store.apply(card("will", 3, 9, "유언", 900), 1, 1000);
    store.holdCardsUntil(2000, 1100);
    expect(store.nextCardReveal(1100)).toBe(3800);
  });

  it("holdCardsUntil 은 구독자를 부르고 reset 이 보류 바닥값을 지운다", () => {
    const store = ready();
    store.apply(card("will", 3, 9, "유언", 900), 1, 1000);
    const cb = vi.fn();
    store.subscribe(cb);
    store.holdCardsUntil(6400, 1100);
    expect(cb).toHaveBeenCalled();
    store.reset();
    store.setContext({ pk: "1:morning", channel: "all", epoch: 2 });
    store.apply(card("will", 3, 1, "다음", 900), 2, 2000);
    expect(store.nextCardReveal(2000)).toBe(4800);
  });

  it("liveCard 는 라이브로 받은 그 좌석의 마지막 카드를 돌려주고, 복원 카드·다른 종류·다른 좌석은 돌려주지 않는다", () => {
    const store = ready();
    expect(store.liveCard("will", 3)).toBeUndefined();
    store.apply({ t: "chatLog", lines: [{ ch: "all", seat: 3, seq: 1, text: "복원", at: 50, k: "will" }] }, 1, 400);
    expect(store.liveCard("will", 3)).toBeUndefined();
    store.apply(card("note", 3, 2, "쪽지", 900), 1, 1000);
    expect(store.liveCard("will", 3)).toBeUndefined();
    store.apply(card("will", 3, 3, "첫 유언", 900), 1, 1000);
    store.apply(card("will", 3, 4, "마지막 유언", 901), 1, 1000);
    store.apply(card("will", 4, 5, "남의 유언", 902), 1, 1000);
    expect(store.liveCard("will", 3)?.text).toBe("마지막 유언");
    expect(store.liveCard("note", 3)?.text).toBe("쪽지");
  });
});

// 09.1.1-09: 귓속말 줄(결정 0066-2) — 카드가 아닌 새 줄 종류. whisper = 당사자 본문, whispered = 나머지에게 본문 없는 사실
const whisperFrame = (k: "whisper" | "whispered", from: number, to: number, seq: number, text: string, at: number): ChatLineFrame => ({ t: "chat", ch: "all", seat: from, seq, text, at, k, to });

describe("ChatStore: 귓속말 줄 (09.1.1-09, UI-SPEC B-3)", () => {
  it("k whisper 프레임은 카드가 아니라 귓속말 줄이다: 보류 없음(revealAt 없음)·seat·to·본문", () => {
    const store = ready();
    store.apply(whisperFrame("whisper", 1, 0, 5, "비밀이에요", 1000), 1, 1000);
    const [line] = store.lines();
    expect(line).toMatchObject({ kind: "whisper", seat: 1, to: 0, text: "비밀이에요", scope: "all" });
    expect(line?.card).toBeUndefined();
    expect(line?.revealAt).toBeUndefined();
    expect(store.visibleLines("all", 1000)).toHaveLength(1);
  });

  it("k whispered 프레임은 공개 사실 줄이다: kind system + whisper 아이콘 + seat·to, 본문 없음", () => {
    const store = ready();
    store.apply(whisperFrame("whispered", 1, 2, 5, "", 1000), 1, 1000);
    const [line] = store.lines();
    expect(line).toMatchObject({ kind: "system", icon: "whisper", seat: 1, to: 2, scope: "all" });
    expect(line?.card).toBeUndefined();
    expect(line?.revealAt).toBeUndefined();
  });

  it("같은 channel·seq·at 의 줄은 한 번만 들어간다(재접속 복원과 라이브가 겹쳐도)", () => {
    const store = ready();
    store.apply(whisperFrame("whisper", 1, 0, 5, "비밀", 1000), 1, 1000);
    store.apply({ t: "chatLog", lines: [{ ch: "all", seat: 1, seq: 5, text: "비밀", at: 1000, k: "whisper", to: 0 }] }, 1, 1100);
    store.apply(whisperFrame("whisper", 1, 0, 5, "비밀", 1000), 1, 1200);
    expect(store.lines()).toHaveLength(1);
  });

  it("복원(chatLog)으로 온 귓속말 줄도 같은 모양이다", () => {
    const store = ready();
    store.apply(
      {
        t: "chatLog",
        lines: [
          { ch: "all", seat: 1, seq: 1, text: "복원 본문", at: 100, k: "whisper", to: 0 },
          { ch: "all", seat: 2, seq: 2, text: "", at: 200, k: "whispered", to: 3 },
        ],
      },
      1,
      400,
    );
    expect(store.lines().map((l) => [l.kind, l.seat, l.to])).toEqual([
      ["whisper", 1, 0],
      ["system", 2, 3],
    ]);
  });

  it("liveWhisperIn(내 좌석): 라이브로 받은 본문 줄의 보낸 좌석과 번호 — 받을 때마다 번호가 늘어난다", () => {
    const store = ready();
    expect(store.liveWhisperIn(0)).toBeNull();
    store.apply(whisperFrame("whisper", 1, 0, 1, "하나", 1000), 1, 1000);
    const first = store.liveWhisperIn(0);
    expect(first).toMatchObject({ seat: 1 });
    store.apply(whisperFrame("whisper", 2, 0, 2, "둘", 1001), 1, 1001);
    const second = store.liveWhisperIn(0);
    expect(second).toMatchObject({ seat: 2 });
    expect(second!.nonce).toBeGreaterThan(first!.nonce);
  });

  it("복원 줄·보낸 줄·사실 줄·같은 줄 다시 받기는 liveWhisperIn 을 만들지 않는다", () => {
    const store = ready();
    store.apply({ t: "chatLog", lines: [{ ch: "all", seat: 1, seq: 1, text: "복원", at: 100, k: "whisper", to: 0 }] }, 1, 400);
    expect(store.liveWhisperIn(0)).toBeNull();
    store.apply(whisperFrame("whisper", 0, 3, 2, "내가 보냄", 1000), 1, 1000);
    expect(store.liveWhisperIn(0)).toBeNull();
    store.apply(whisperFrame("whispered", 2, 3, 3, "", 1001), 1, 1001);
    expect(store.liveWhisperIn(0)).toBeNull();
    store.apply(whisperFrame("whisper", 1, 0, 4, "받음", 1002), 1, 1002);
    const got = store.liveWhisperIn(0);
    store.apply(whisperFrame("whisper", 1, 0, 4, "받음", 1002), 1, 1003);
    expect(store.liveWhisperIn(0)).toEqual(got);
  });

  it("복원으로 먼저 들어온 줄이 뒤늦게 라이브로 또 와도(중복) 받음 신호는 없다", () => {
    const store = ready();
    store.apply({ t: "chatLog", lines: [{ ch: "all", seat: 1, seq: 7, text: "복원", at: 100, k: "whisper", to: 0 }] }, 1, 400);
    store.apply(whisperFrame("whisper", 1, 0, 7, "복원", 100), 1, 500);
    expect(store.liveWhisperIn(0)).toBeNull();
  });

  it("reset 이 받음 신호를 지운다", () => {
    const store = ready();
    store.apply(whisperFrame("whisper", 1, 0, 1, "하나", 1000), 1, 1000);
    store.reset();
    expect(store.liveWhisperIn(0)).toBeNull();
  });

  it("카드(will·note)는 이전처럼 보류 규칙을 받는다 — 귓속말 분기가 카드를 삼키지 않는다", () => {
    const store = ready();
    store.apply({ t: "chat", ch: "all", seat: 3, seq: 1, text: "유언", at: 900, k: "will" }, 1, 1000);
    expect(store.lines()[0]).toMatchObject({ kind: "card", card: "will", revealAt: 3800 });
  });
});

// 09.1.1-12 (UI-SPEC C-3): 찬반 기록 카드(k ballots)는 처형 진입 4.6초에 도착한다 — 라이브는 4600ms 보류, 복원은 즉시
describe("ChatStore: ballots 카드 (09.1.1-12, 결정 0066-3)", () => {
  const ballots = (seat: number, seq: number, text: string, at: number): ChatLineFrame => ({ ...chat("all", seat, seq, text, at), k: "ballots" });

  it("상수는 4600ms", () => {
    expect(CARD_HOLD_BALLOTS_MS).toBe(4600);
  });

  it("라이브 카드는 도착 시각 + 4600ms 전까지 목록에 없고 그 뒤에 kind card·card ballots 로 보인다 (본문 원문 그대로)", () => {
    const store = ready();
    store.apply(ballots(3, 9, "0,2|1", 900), 1, 1000);
    expect(store.visibleLines("all", 5599).length).toBe(0);
    expect(store.nextCardReveal(1000)).toBe(5600);
    const [line] = store.visibleLines("all", 5600);
    expect(`${line?.kind}|${line?.card}|${line?.seat}|${line?.text}`).toBe("card|ballots|3|0,2|1");
  });

  it("처형 단계 키여도 ballots 는 4600ms 다(유언·쪽지의 2400 이 아니다)", () => {
    const store = new ChatStore();
    store.setContext({ pk: "1:execution", channel: "all", epoch: 1 });
    store.apply(ballots(3, 9, "0|1", 900), 1, 1000);
    expect(store.nextCardReveal(1000)).toBe(5600);
  });

  it("재접속 chatLog 의 ballots 카드는 보류 없이 즉시 보인다", () => {
    const store = ready();
    store.apply({ t: "chatLog", lines: [{ ch: "all", seat: 3, seq: 9, text: "0,2|1", at: 900, k: "ballots" }] }, 1, 1000);
    expect(store.visibleLines("all", 1000).map((l) => `${l.kind}|${l.card}`).join()).toBe("card|ballots");
    expect(store.nextCardReveal(1000)).toBeNull();
  });

  it("같은 카드를 두 번 받아도 한 줄이다(키 중복 제거)", () => {
    const store = ready();
    store.apply(ballots(3, 9, "0|1", 900), 1, 1000);
    store.apply({ t: "chatLog", lines: [{ ch: "all", seat: 3, seq: 9, text: "0|1", at: 900, k: "ballots" }] }, 1, 1100);
    expect(store.lines().length).toBe(1);
  });

  it("카드는 그 좌석의 입력 중 표시를 지우지 않는다", () => {
    const store = ready();
    store.apply({ t: "typing", seat: 3, on: true }, 1, 1000);
    store.apply(ballots(3, 9, "0|1", 900), 1, 1100);
    expect(store.typingSeats(1100).has(3)).toBe(true);
  });
});
