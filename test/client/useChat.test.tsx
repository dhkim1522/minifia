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
    expect(sent.length).toBe(0);
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
