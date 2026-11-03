import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { ChatChannel, ChatLineWire, ChatRejectWhy, ClientMessage, PublicPlayer, RoomView } from "../../shared/protocol";
import { CHAT_TEXT } from "../../src/game/chatText";
import { NOTICE_MS, SEND_DIM_MS } from "../../src/game/chatUi";
import { ChatStore } from "../../src/net/chatStore";
import { useChat } from "../../src/net/useChat";

// 07-13: ChatStore·연결·view 를 ChatPanel 속성으로 잇는 훅. 저장소는 진짜를 쓰고 연결은 send·canSend 만 가진 가짜다.
// 단언은 TAP 보고서가 한 줄로 남도록 스칼라(join·boolean·문자열)로 비교한다.

const player = (seat: number, nickname: string, extra: Partial<PublicPlayer> = {}): PublicPlayer => ({ seat, nickname, connected: true, isHost: seat === 0, ...extra });
const makeView = (extra: Partial<RoomView> = {}, meExtra: Partial<RoomView["me"]> = {}): RoomView => ({
  code: "0042",
  phase: "lobby",
  phaseEndsAt: null,
  phaseDurationMs: null,
  serverNow: 0,
  minPlayers: 4,
  maxPlayers: 8,
  players: [player(0, "민수"), player(1, "하윤")],
  me: { seat: 1, isHost: false, ...meExtra },
  ...extra,
});
const line = (seq: number, seat: number, text: string, extra: Partial<ChatLineWire> = {}): ChatLineWire => ({ ch: "all", seat, seq, text, at: 1000 + seq, ...extra });

let store = new ChatStore();
let sent: ClientMessage[] = [];
const conn = (canSend = true) => ({
  canSend,
  send: (msg: ClientMessage) => {
    sent.push(msg);
    return true;
  },
});

beforeEach(() => {
  store = new ChatStore();
  sent = [];
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** 훅을 그리고 한 줄 보내는 도우미를 돌려준다. view·connection 은 다시 그릴 때 바꿔 끼울 수 있다 */
function mount(view: RoomView = makeView(), canSend = true) {
  const props = { view, canSend };
  const hook = renderHook((p: typeof props) => useChat({ store, connection: conn(p.canSend), view: p.view }), { initialProps: props });
  /** ChatPanel 이 보내는 순서와 같다: onSend(text) → onChange("") */
  const submit = (text: string) =>
    act(() => {
      hook.result.current.onSend?.(text);
      hook.result.current.onChange("");
    });
  const type = (text: string) => act(() => hook.result.current.onChange(text));
  const receive = (frame: Parameters<ChatStore["apply"]>[0], epoch = 1) => act(() => store.apply(frame, epoch, Date.now()));
  return { ...hook, submit, type, receive };
}

describe("useChat: 보내기 (CHAT-01, T-07-33)", () => {
  it("onSend 는 본문과 단계 키만 보낸다 — 채널 필드가 없다", () => {
    const { result } = mount();
    act(() => result.current.onSend?.("안녕"));
    expect(sent.map((m) => JSON.stringify(m)).join("|")).toBe(JSON.stringify({ t: "chat", text: "안녕", pk: "0:lobby" }));
  });

  it("단계 키는 일차:단계다 (낮 토론 2일차 = 2:discussion)", () => {
    const view = makeView({ phase: "discussion", day: { n: 2 } as RoomView["day"] });
    const { result } = mount(view);
    act(() => result.current.onSend?.("의심돼요"));
    expect((sent[0] as { pk: string }).pk).toBe("2:discussion");
  });

  it("서버 방송이 오기 전에는 내 줄을 그리지 않는다(낙관적 표시 없음), 방송이 오면 '나' 로 나온다", () => {
    const { result, submit, receive } = mount();
    submit("안녕");
    expect(result.current.messages.length).toBe(0);
    receive({ t: "chat", ...line(1, 1, "안녕") });
    expect(result.current.messages.map((m) => `${m.kind}:${m.me}:${m.name}:${m.text}`).join("|")).toBe("player:true:하윤:안녕");
  });

  it("다른 사람의 줄은 닉네임·자리·채널과 함께 나온다", () => {
    const { result, receive } = mount();
    receive({ t: "chat", ...line(1, 0, "반가워요") });
    const m = result.current.messages[0];
    expect(`${m?.me}:${m?.name}:${m?.seat}:${m?.ch}`).toBe("false:민수:0:all");
  });

  it("채널은 서버가 정한 view.me.chat 을 그대로 쓴다, 없으면 all", () => {
    const a = mount(makeView());
    expect(a.result.current.channel).toBe("all");
    const b = mount(makeView({ phase: "night" }, { chat: "mafia" as ChatChannel }));
    expect(b.result.current.channel).toBe("mafia");
  });
});

describe("useChat: 시스템 줄 종류 전달 (DAY-04·06)", () => {
  it("저장소의 vote·hot·system 줄이 ChatPanel 줄 kind 로 그대로 나온다", () => {
    const { result } = mount();
    act(() => {
      store.addSystem("민준 → 도윤", { scope: "all", kind: "vote", at: 1000 });
      store.addSystem("도윤 님이 앞서요", { scope: "all", kind: "hot", at: 1001 });
      store.addSystem("지목 시작", { scope: "all", at: 1002 });
    });
    expect(result.current.messages.map((m) => m.kind).join(",")).toBe("vote,hot,system");
    expect(result.current.messages.map((m) => m.text).join("|")).toBe("민준 → 도윤|도윤 님이 앞서요|지목 시작");
  });
});

describe("useChat: 보내기 흐림 (UI-SPEC 입력 상태표)", () => {
  it("보낸 직후 sendDim 이 켜지고 SEND_DIM_MS 뒤 꺼진다, 그동안 입력은 계속 받는다", () => {
    vi.useFakeTimers();
    const { result, submit, type } = mount();
    expect(result.current.sendDim).toBeFalsy();
    submit("안녕");
    expect(result.current.sendDim).toBe(true);
    type("다음 말");
    expect(result.current.value).toBe("다음 말");
    act(() => {
      vi.advanceTimersByTime(SEND_DIM_MS - 1);
    });
    expect(result.current.sendDim).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.sendDim).toBe(false);
  });
});

describe("useChat: 막힘 알림과 되돌리기 (CHAT-05)", () => {
  it("chatReject rate → 알림 '조금 천천히 보내요', NOTICE_MS 뒤 사라진다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    const { result, receive } = mount();
    expect(result.current.notice ?? null).toBe(null);
    receive({ t: "chatReject", why: "rate" });
    expect(result.current.notice).toBe("조금 천천히 보내요");
    act(() => {
      vi.advanceTimersByTime(NOTICE_MS - 1);
    });
    expect(result.current.notice).toBe("조금 천천히 보내요");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.notice ?? null).toBe(null);
  });

  it("이유 다섯 가지가 CHAT_TEXT.reject 문구로 나온다", () => {
    vi.useFakeTimers();
    const { result, receive } = mount();
    const whys: ChatRejectWhy[] = ["rate", "repeat", "length", "phase", "other"];
    const got: string[] = [];
    for (const why of whys) {
      receive({ t: "chatReject", why });
      got.push(String(result.current.notice));
    }
    expect(got.join("|")).toBe(whys.map((w) => CHAT_TEXT.reject[w]).join("|"));
  });

  it("문구의 느낌표·마침표 규칙: other 문구만 가운데 마침표가 있다", () => {
    const withDot = Object.entries(CHAT_TEXT.reject).filter(([, t]) => t.includes("."));
    expect(withDot.map(([k]) => k).join("|")).toBe("other");
    expect(Object.values(CHAT_TEXT.reject).some((t) => t.includes("!"))).toBe(false);
  });

  it("거절되면 입력칸이 비어 있을 때 마지막 보낸 글이 되돌아온다", () => {
    vi.useFakeTimers();
    const { result, submit, receive } = mount();
    submit("같은 말");
    expect(result.current.value).toBe("");
    receive({ t: "chatReject", why: "repeat" });
    expect(result.current.value).toBe("같은 말");
  });

  it("거절될 때 무언가 쓰는 중이면 쓰던 글을 그대로 둔다", () => {
    vi.useFakeTimers();
    const { result, submit, type, receive } = mount();
    submit("보낸 말");
    type("쓰는 중");
    receive({ t: "chatReject", why: "rate" });
    expect(result.current.value).toBe("쓰는 중");
  });

  it("거절이 확정되면 보내기 흐림이 바로 풀린다", () => {
    vi.useFakeTimers();
    const { result, submit, receive } = mount();
    submit("안녕");
    expect(result.current.sendDim).toBe(true);
    receive({ t: "chatReject", why: "rate" });
    expect(result.current.sendDim).toBe(false);
  });

  it("새 알림이 이전 알림을 바꾸고 만료도 새 시각부터 센다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    const { result, receive } = mount();
    receive({ t: "chatReject", why: "rate" });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    receive({ t: "chatReject", why: "length" });
    expect(result.current.notice).toBe("100자까지 보낼 수 있어요");
    act(() => {
      vi.advanceTimersByTime(NOTICE_MS - 1);
    });
    expect(result.current.notice).toBe("100자까지 보낼 수 있어요");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.notice ?? null).toBe(null);
  });

  it("마운트 전에 이미 있던 거절(낡은 알림)은 글을 되돌리지 않는다", () => {
    vi.useFakeTimers();
    store.apply({ t: "chatReject", why: "rate" }, 1, Date.now() - 10_000);
    const { result } = mount();
    expect(result.current.value).toBe("");
  });
});

describe("useChat: 연결 끊김과 복원 (UI-SPEC 입력 상태표, D2)", () => {
  it("canSend 가 거짓이면 sendDisabled, onSend 는 보내지 않고, 이미 받은 줄과 입력은 그대로다", () => {
    const { result, receive, type, rerender } = mount();
    receive({ t: "chat", ...line(1, 0, "받은 줄") });
    type("쓰던 글");
    rerender({ view: makeView(), canSend: false });
    expect(result.current.sendDisabled).toBe(true);
    act(() => result.current.onSend?.("쓰던 글"));
    expect(sent.filter((m) => m.t === "chat").length).toBe(0);
    expect(result.current.messages.map((m) => m.text).join("|")).toBe("받은 줄");
    expect(result.current.value).toBe("쓰던 글");
  });

  it("연결되면 sendDisabled 가 풀린다", () => {
    const { result, rerender } = mount(makeView(), false);
    expect(result.current.sendDisabled).toBe(true);
    rerender({ view: makeView(), canSend: true });
    expect(result.current.sendDisabled).toBe(false);
  });

  it("chatLog 를 적용한 직후 quiet 이고, 다음 chat 뒤에는 아니다", () => {
    const { result, receive } = mount();
    expect(result.current.quiet).toBeFalsy();
    receive({ t: "chatLog", lines: [line(1, 0, "예전 줄"), line(2, 1, "또 예전 줄")] });
    expect(result.current.quiet).toBe(true);
    expect(result.current.messages.length).toBe(2);
    receive({ t: "chat", ...line(3, 0, "새 줄") });
    expect(result.current.quiet).toBe(false);
  });

  it("탈락·떠난 사람의 줄은 마지막으로 본 닉네임을 쓴다", () => {
    const { result, receive, rerender } = mount();
    receive({ t: "chat", ...line(1, 0, "안녕") });
    rerender({ view: makeView({ players: [player(1, "하윤")] }), canSend: true });
    expect(result.current.messages[0]?.name).toBe("민수");
  });
});

// ---- 07-18: 입력 중 보내기·받기 규칙 (CHAT-04, T-07-46·47) ----

const typings = () => sent.filter((m): m is Extract<ClientMessage, { t: "typing" }> => m.t === "typing");
/** 보낸 입력 중 신호를 "on|off" 열로 — TAP 보고서가 한 줄로 남게 스칼라로 비교한다 */
const typingTrail = () => typings().map((m) => (m.on ? "on" : "off")).join(",");
const tick = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe("useChat: 입력 중 보내기 (CHAT-04, UI-SPEC 머리 위 입력 중)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("빈 칸의 첫 글자에 켜짐 1번, 이어지는 글자는 2초가 차기 전까지 더 보내지 않고, 2초가 차면 갱신 1번", () => {
    const { type } = mount();
    type("가");
    expect(typingTrail()).toBe("on");
    expect(typings()[0]?.pk).toBe("0:lobby");
    tick(1000);
    type("가나");
    expect(typingTrail()).toBe("on");
    tick(1000);
    type("가나다");
    expect(typingTrail()).toBe("on,on");
  });

  it("마지막 입력 변화 뒤 4초에 꺼짐 1번(값은 남음), 3999ms 에는 아직 켜져 있고, 다시 입력하면 켜진다", () => {
    const { result, type } = mount();
    type("가");
    tick(3999);
    expect(typingTrail()).toBe("on");
    expect(result.current.typingSeats.has(1)).toBe(true);
    tick(1);
    expect(typingTrail()).toBe("on,off");
    expect(result.current.value).toBe("가");
    expect(result.current.typingSeats.has(1)).toBe(false);
    type("가나");
    expect(typingTrail()).toBe("on,off,on");
    expect(result.current.typingSeats.has(1)).toBe(true);
  });

  it("입력이 계속되면 무입력 4초 타이머가 마지막 변화부터 다시 센다", () => {
    const { type } = mount();
    type("가");
    tick(3000);
    type("가나");
    tick(3000);
    expect(typingTrail()).toBe("on,on");
    tick(1000);
    expect(typingTrail()).toBe("on,on,off");
  });

  it("빈 칸에서 조합이 시작되면(글자 없이 onComposingChange(true)) 켜짐이고, 글자 없이 조합이 끝나면 꺼짐이다", () => {
    const { result } = mount();
    act(() => result.current.onComposingChange?.(true));
    expect(typingTrail()).toBe("on");
    expect(result.current.typingSeats.has(1)).toBe(true);
    act(() => result.current.onComposingChange?.(false));
    expect(typingTrail()).toBe("on,off");
  });

  it("칸을 비우면 꺼짐, 보내면(onSend 뒤 칸이 비워짐) 꺼짐, 포커스를 잃으면 꺼짐이다", () => {
    const { result, type, submit } = mount();
    type("가");
    type("");
    expect(typingTrail()).toBe("on,off");
    type("나");
    submit("나");
    expect(typingTrail()).toBe("on,off,on,off");
    type("다");
    act(() => result.current.onInputBlur?.());
    expect(typingTrail()).toBe("on,off,on,off,on,off");
    expect(result.current.typingSeats.has(1)).toBe(false);
  });

  it("단계 키가 바뀌면 꺼짐, 서버가 정한 채널이 바뀌어도 꺼짐이다", () => {
    const { type, rerender } = mount();
    type("가");
    rerender({ view: makeView({ phase: "discussion", day: { n: 1 } as RoomView["day"] }), canSend: true });
    expect(typingTrail()).toBe("on,off");
    type("가나");
    expect(typingTrail()).toBe("on,off,on");
    rerender({ view: makeView({ phase: "discussion", day: { n: 1 } as RoomView["day"] }, { chat: "ghost" }), canSend: true });
    expect(typingTrail()).toBe("on,off,on,off");
  });

  it("꺼져 있을 때의 비움·블러·단계 변경은 아무것도 보내지 않는다", () => {
    const { result, type, rerender } = mount();
    type("");
    act(() => result.current.onInputBlur?.());
    act(() => result.current.onComposingChange?.(false));
    rerender({ view: makeView({ phase: "discussion", day: { n: 1 } as RoomView["day"] }), canSend: true });
    expect(sent.length).toBe(0);
  });

  it("연결이 끊긴 동안(canSend 거짓)은 입력 중을 보내지 않고, 내 알약도 켜지 않는다", () => {
    const { result, type } = mount(makeView(), false);
    type("가");
    expect(typings().length).toBe(0);
    expect(result.current.typingSeats.has(1)).toBe(false);
  });

  it("켜 둔 채 연결이 끊기면 내 알약은 꺼지고, 연결이 돌아온 뒤 다음 입력에 다시 켜진다", () => {
    const { result, type, rerender } = mount();
    type("가");
    rerender({ view: makeView(), canSend: false });
    expect(result.current.typingSeats.has(1)).toBe(false);
    expect(typingTrail()).toBe("on");
    rerender({ view: makeView(), canSend: true });
    type("가나");
    expect(typingTrail()).toBe("on,on");
    expect(result.current.typingSeats.has(1)).toBe(true);
  });

  it("내 좌석은 켜짐 직후 서버 왕복 없이 typingSeats 에 들어 있다", () => {
    const { result, type } = mount();
    expect(result.current.typingSeats.size).toBe(0);
    type("가");
    expect([...result.current.typingSeats].join(",")).toBe("1");
  });

  it("화면이 사라지면(단계 전환으로 화면이 바뀜) 켜져 있던 입력 중을 끈다", () => {
    const { type, unmount } = mount();
    type("가");
    unmount();
    expect(typingTrail()).toBe("on,off");
  });
});

describe("useChat: 입력 중 받기 (CHAT-04, T-07-46)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("서버가 보낸 좌석만 typingSeats 에 들어가고, 신호 뒤 4.5초에 저절로 빠진다", () => {
    const { result, receive } = mount();
    receive({ t: "typing", seat: 0, on: true });
    expect([...result.current.typingSeats].join(",")).toBe("0");
    tick(4499);
    expect([...result.current.typingSeats].join(",")).toBe("0");
    tick(1);
    expect(result.current.typingSeats.size).toBe(0);
  });

  it("그 사람의 채팅 줄이 도착하면 함께 꺼진다", () => {
    const { result, receive } = mount();
    receive({ t: "typing", seat: 0, on: true });
    receive({ t: "chat", ...line(1, 0, "안녕") });
    expect(result.current.typingSeats.size).toBe(0);
  });

  it("꺼짐 신호가 오면 바로 빠진다", () => {
    const { result, receive } = mount();
    receive({ t: "typing", seat: 0, on: true });
    receive({ t: "typing", seat: 0, on: false });
    expect(result.current.typingSeats.size).toBe(0);
  });

  it("연결이 끊긴 사람(view.players 의 connected 거짓)의 좌석은 typingSeats 에 없다", () => {
    const view = makeView({ players: [player(0, "민수", { connected: false }), player(1, "하윤")] });
    const { result, receive } = mount(view);
    receive({ t: "typing", seat: 0, on: true });
    expect(result.current.typingSeats.size).toBe(0);
  });

  it("8명이 동시에 입력해도 좌석마다 하나씩 들어 있다 (화면에서 만들어 내는 다른 좌석은 없다)", () => {
    const players = Array.from({ length: 8 }, (_, i) => player(i, `사람${i}`));
    const { result, receive } = mount(makeView({ players, me: { seat: 7, isHost: false } }));
    for (let i = 0; i < 7; i++) receive({ t: "typing", seat: i, on: true });
    expect([...result.current.typingSeats].sort().join(",")).toBe("0,1,2,3,4,5,6");
  });
});

// 09-11 (MORN-02): 카드 줄 → ChatPanelMessage card
describe("useChat: 카드 줄 매핑 (MORN-02)", () => {
  const cardView = () => makeView({ players: [player(0, "민수"), player(1, "하윤"), player(3, "서연")] });

  it("유언은 '{닉네임} 님의 유언'·quill, 쪽지는 '쪽지'·note·tone mafia 다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    const { result, receive } = mount(cardView());
    receive({ t: "chatLog", lines: [line(1, 3, "범인은 2번", { k: "will" }), line(2, 3, "다음은 너", { k: "note" })] });
    const [will, note] = result.current.messages;
    expect(`${will?.kind}|${will?.card}|${will?.title}|${will?.icon}|${will?.text}|${will?.tone}`).toBe("card|will|서연 님의 유언|quill|범인은 2번|undefined");
    expect(`${note?.kind}|${note?.card}|${note?.title}|${note?.icon}|${note?.text}|${note?.tone}`).toBe("card|note|쪽지|note|다음은 너|mafia");
  });

  it("라이브 카드는 2800ms 뒤에야 메시지에 나타난다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    const { result, receive } = mount(cardView());
    receive({ t: "chat", ...line(1, 3, "가", { k: "will" }) });
    expect(result.current.messages.length).toBe(0);
    act(() => {
      vi.advanceTimersByTime(2799);
    });
    expect(result.current.messages.length).toBe(0);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.messages.map((m) => m.card).join()).toBe("will");
  });

  it("다음 공개 시각은 줄 목록을 만든 시각 기준으로 구한다 — 렌더 뒤 효과 전에 시각이 지나도 카드가 빠지지 않는다 (09-22)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    const { receive } = mount(cardView());
    const listedAt: number[] = [];
    const revealAsked: number[] = [];
    const listed = store.visibleLines.bind(store);
    const reveal = store.nextCardReveal.bind(store);
    vi.spyOn(store, "visibleLines").mockImplementation((channel, now) => {
      if (now !== undefined) listedAt.push(now);
      const out = listed(channel, now);
      vi.setSystemTime(Date.now() + 5); // 렌더가 끝나고 효과가 돌기까지 시계가 흐른 것처럼
      return out;
    });
    vi.spyOn(store, "nextCardReveal").mockImplementation((now) => {
      revealAsked.push(now);
      return reveal(now);
    });
    receive({ t: "chat", ...line(1, 3, "가", { k: "will" }) });
    expect(revealAsked.length).toBeGreaterThan(0);
    expect(revealAsked[revealAsked.length - 1]).toBe(listedAt[listedAt.length - 1]);
  });

  it("카드 본문 \"<b>x</b>\" 는 문자열 그대로 넘긴다", () => {
    const { result, receive } = mount(cardView());
    receive({ t: "chatLog", lines: [line(1, 3, "<b>x</b>", { k: "will" })] });
    expect(result.current.messages[0]?.text).toBe("<b>x</b>");
  });

  it("로컬 경찰 카드는 제목·본문을 그대로 eye 카드 메시지로 넘긴다", () => {
    const { result } = mount(cardView());
    act(() => store.addLocalCard({ icon: "eye", title: "민준", text: "마피아 아님", at: 5000 }));
    const m = result.current.messages[0];
    expect(`${m?.kind}|${m?.card}|${m?.title}|${m?.icon}|${m?.text}|${m?.tone}`).toBe("card|eye|민준|eye|마피아 아님|undefined");
  });

  it("사람 줄은 본문이 '[유언]' 이어도 player 메시지다", () => {
    const { result, receive } = mount(cardView());
    receive({ t: "chat", ...line(1, 3, "[유언] 가") });
    expect(`${result.current.messages[0]?.kind}|${result.current.messages[0]?.card}`).toBe("player|undefined");
  });
});
