import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { rulesetOf } from "../../shared/game/ruleset";
import type { ChatLineWire, ClientMessage, PhaseId, PublicPlayer, RoomView } from "../../shared/protocol";
import type { WorldStageProps } from "../../src/components/WorldStage";
import type { RoomConnection } from "../../src/net/useRoomConnection";
const GAME_RULES = rulesetOf("extended");

// 09.1.1-09 UI-SPEC B: 오른쪽 아래 둘째 떠 있는 버튼 → 귓속말 모드 → 이름표 → 한 줄 시트 → {t:"whisper", to, text}, 그리고 채팅 줄 세 가지.
// RoomScreen → GameMap 을 진짜로 그리고 연결과 WorldStage 만 가짜로 바꾼다(badgeUi.test 와 같은 틀).
const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));

const stage = vi.hoisted(() => ({ props: null as null | WorldStageProps }));
vi.mock("../../src/components/WorldStage", async () => {
  const { createElement } = await import("react");
  return {
    WorldStage: (props: WorldStageProps) => {
      stage.props = props;
      return createElement("div", { "data-world-stage-fake": "" });
    },
  };
});

const { RoomScreen } = await import("../../src/screens/RoomScreen");

const NAMES = ["민수", "영희", "서준", "지아", "도윤", "하은", "유진", "태오"];
const NOW = 1_700_000_000_000;

interface Opt {
  phase?: PhaseId;
  count?: number;
  mySeat?: number;
  dead?: number[];
  used?: boolean;
  day?: number;
}

function makeView(o: Opt = {}): RoomView {
  const count = o.count ?? 6;
  const mySeat = o.mySeat ?? 0;
  const players: PublicPlayer[] = Array.from({ length: count }, (_, seat) => ({
    seat,
    nickname: NAMES[seat] ?? `p${seat}`,
    connected: true,
    isHost: seat === 0,
    ...(o.dead?.includes(seat) ? { alive: false } : {}),
  }));
  const meDead = o.dead?.includes(mySeat) === true;
  const view = {
    code: "0042",
    phase: o.phase ?? "discussion",
    phaseEndsAt: NOW + 90_000,
    phaseDurationMs: 90_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players,
    me: { seat: mySeat, isHost: mySeat === 0, chat: meDead ? "ghost" : "all", ...(o.used ? { whisperUsed: true as const } : {}) },
    day: { n: o.day ?? 1, roles: [] },
  } as RoomView;
  if (meDead) view.spectate = { seats: players.map((p) => ({ seat: p.seat, job: p.seat === 1 ? "mafia" : "citizen" })) };
  return view;
}

function conn(view: RoomView, over: Partial<RoomConnection> = {}): RoomConnection {
  return {
    status: "open",
    banner: "hidden",
    view,
    offset: 0,
    epoch: 1,
    removedReason: null,
    canSend: true,
    send: vi.fn(() => true),
    onEvent: vi.fn(() => () => {}),
    reconnect: vi.fn(),
    retry: vi.fn(),
    ...over,
  };
}

/** 연결 mock 의 onEvent 가 받은 구독자들에게 프레임을 흘린다 */
const emit = (frame: unknown, epoch = 1): void => {
  const onEvent = (connectionMock.current as RoomConnection).onEvent as unknown as ReturnType<typeof vi.fn>;
  act(() => {
    for (const [fn] of onEvent.mock.calls) (fn as (e: unknown, m: unknown) => void)(frame, { epoch });
  });
};
const emitError = (code: "WRONG_PHASE" | "BAD_MESSAGE" | "RATE_LIMITED"): void => emit({ t: "error", code });
const wireLine = (k: "whisper" | "whispered", from: number, to: number, seq: number, text: string, at = NOW): { t: "chat" } & ChatLineWire => ({ t: "chat", ch: "all", seat: from, seq, text, at, k, to });

const mount = (view: RoomView, over: Partial<RoomConnection> = {}) => {
  connectionMock.current = conn(view, over);
  const ui = () => <RoomScreen code="0042" token={"t".repeat(43)} onExit={() => {}} />;
  const r = render(ui());
  return {
    ...r,
    show: (v: RoomView, o: Partial<RoomConnection> = {}) => {
      const prev = connectionMock.current as RoomConnection;
      connectionMock.current = conn(v, { send: prev.send, onEvent: prev.onEvent, epoch: prev.epoch, ...o });
      r.rerender(ui());
    },
  };
};

type Send = ReturnType<typeof vi.fn<(m: ClientMessage) => boolean>>;
const sent = (send: Send): ClientMessage[] => send.mock.calls.map(([x]) => x);
const sendOf = (): Send => (connectionMock.current as RoomConnection).send as unknown as Send;
const floatBtn = (c: ParentNode): HTMLButtonElement | null => c.querySelector<HTMLButtonElement>('[data-float="whisper"]');
const claimBtn = (c: ParentNode): HTMLButtonElement | null => c.querySelector<HTMLButtonElement>('[data-float="claim"]');
const sheet = (c: ParentNode): HTMLElement | null => c.querySelector<HTMLElement>(".mv-line-sheet");
const input = (c: ParentNode): HTMLInputElement => c.querySelector<HTMLInputElement>("[data-line-input]")!;
const sendBtn = (c: ParentNode): HTMLButtonElement => c.querySelector<HTMLButtonElement>("[data-line-send]")!;
const log = (c: ParentNode): HTMLElement => c.querySelector<HTMLElement>("[data-chat-log]")!;
const hint = (c: ParentNode): HTMLElement | null => c.querySelector<HTMLElement>(".mv-phase__hint");
const toast = (c: ParentNode): string => c.querySelector<HTMLElement>(".mv-toast--top")?.textContent ?? "";

/** 버튼 → 모드 → 이름표(seat) 까지 간다 */
const openSheet = (c: ParentNode, seat: number): void => {
  fireEvent.click(floatBtn(c)!);
  act(() => stage.props!.pick!.onPick(seat));
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.unstubAllGlobals();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  stage.props = null;
});

// 기본판(결정 0072)에서 꺼짐 — 판 규칙의 whisper 를 켜면 다시 돈다(귓속말 버튼·시트가 있어야 성립한다). 꺼진 상태는 badgeUi.test.tsx 의 기본판 describe 가 본다.
describe.skipIf(!GAME_RULES.whisper)("귓속말 버튼 → 모드 → 이름표 → 한 줄 시트 → whisper 전송 (UI-SPEC B-1·B-2, 트레이서)", () => {
  it("토론에서 산 사람 화면에 [data-float=whisper] 가 하나, 배지 버튼 아래, 이름 '귓속말 보내기, 오늘 1번 남음', 점이 있다", () => {
    const { container } = mount(makeView());
    expect(container.querySelectorAll('[data-float="whisper"]')).toHaveLength(1);
    const btn = floatBtn(container)!;
    expect(btn.getAttribute("aria-label")).toBe("귓속말 보내기, 오늘 1번 남음");
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    expect(btn.getAttribute("aria-disabled")).toBeNull();
    expect(btn.querySelector(".mv-float__dot")).not.toBeNull();
    const all = [...container.querySelectorAll("[data-float]")];
    expect(all.map((b) => b.getAttribute("data-float"))).toEqual(["claim", "whisper"]);
    expect(claimBtn(container)).not.toBeNull();
  });

  it("버튼을 누르면 모드가 켜진다: aria-pressed, 헤더 안내 '귓속말할 사람을 눌러요', pick = 나를 뺀 산 사람·귓속말 묶음", () => {
    const { container } = mount(makeView({ dead: [3] }));
    expect(container.textContent).not.toContain("귓속말할 사람을 눌러요");
    fireEvent.click(floatBtn(container)!);
    expect(floatBtn(container)!.getAttribute("aria-pressed")).toBe("true");
    expect(hint(container)?.textContent).toBe("귓속말할 사람을 눌러요");
    const pick = stage.props!.pick!;
    expect(pick).toBeDefined();
    expect([...pick.seats].sort()).toEqual([1, 2, 4, 5]);
    expect(pick.group).toBe("귓속말");
    expect(pick.label("민수")).toBe("민수 님에게 귓속말");
    expect(sheet(container)).toBeNull();
  });

  it("모드의 헤더 안내는 안내 타이머(2.5초)로 접히지 않는다", () => {
    const { container } = mount(makeView());
    fireEvent.click(floatBtn(container)!);
    act(() => void vi.advanceTimersByTime(10_000));
    expect(hint(container)?.textContent).toBe("귓속말할 사람을 눌러요");
    expect(hint(container)?.classList.contains("is-folded")).toBe(false);
  });

  it("이름표 대상 좌석에는 깜빡임(blink)이 실린다", () => {
    const { container } = mount(makeView());
    expect(stage.props!.tagProps?.(1)?.blink).toBeUndefined();
    fireEvent.click(floatBtn(container)!);
    expect(stage.props!.tagProps?.(1)?.blink).toBe(true);
    expect(stage.props!.tagProps?.(0)?.blink).toBeUndefined();
  });

  it("같은 버튼을 다시 누르면 모드가 꺼지고, Esc 로도 꺼진다", () => {
    const { container } = mount(makeView());
    fireEvent.click(floatBtn(container)!);
    fireEvent.click(floatBtn(container)!);
    expect(floatBtn(container)!.getAttribute("aria-pressed")).toBe("false");
    expect(stage.props!.pick).toBeUndefined();
    fireEvent.click(floatBtn(container)!);
    expect(stage.props!.pick).toBeDefined();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(stage.props!.pick).toBeUndefined();
    expect(floatBtn(container)!.getAttribute("aria-pressed")).toBe("false");
  });

  it("이름표를 누르면 모드가 꺼지고 한 줄 시트가 열린다: 윗줄 상대 이름, placeholder '{이름} 님에게만 보여요'", () => {
    const { container } = mount(makeView());
    openSheet(container, 2);
    expect(stage.props!.pick).toBeUndefined();
    expect(hint(container)?.textContent).not.toBe("귓속말할 사람을 눌러요");
    const s = sheet(container)!;
    expect(s).not.toBeNull();
    expect(s.querySelector("[data-line-peer]")?.textContent).toContain("서준");
    expect(input(container).getAttribute("placeholder")).toBe("서준 님에게만 보여요");
    expect(container.querySelector(".mv-line__count")?.textContent).toBe("0/30");
    expect(container.querySelectorAll(".mf-will-layer")).toHaveLength(1);
  });

  it("글 '비밀이에요' 를 쓰고 보내기를 누르면 send 가 정확히 {t:'whisper', to, text} 로 한 번 불린다", () => {
    const { container } = mount(makeView());
    openSheet(container, 2);
    fireEvent.change(input(container), { target: { value: "비밀이에요" } });
    expect(container.querySelector(".mv-line__count")?.textContent).toBe("5/30");
    fireEvent.click(sendBtn(container));
    expect(sent(sendOf())).toEqual([{ t: "whisper", to: 2, text: "비밀이에요" }]);
  });

  it("빈 글(공백뿐)은 보내기가 aria-disabled 이고 send 가 불리지 않는다", () => {
    const { container } = mount(makeView());
    openSheet(container, 2);
    expect(sendBtn(container).getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(sendBtn(container));
    fireEvent.change(input(container), { target: { value: "   " } });
    expect(sendBtn(container).getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(sendBtn(container));
    expect(sent(sendOf())).toEqual([]);
  });

  it("글자가 있으면 보내기가 켜지고, 30자소를 넘는 입력은 앞에서 30자소로 자른다", () => {
    const { container } = mount(makeView());
    openSheet(container, 1);
    fireEvent.change(input(container), { target: { value: "가".repeat(40) } });
    expect(input(container).value).toBe("가".repeat(30));
    expect(container.querySelector(".mv-line__count")?.textContent).toBe("30/30");
    expect(sendBtn(container).getAttribute("aria-disabled")).toBe("false");
  });

  it("쓰는 동안 서버로 가는 신호가 없다(typing 포함) — 보내기 전 send 호출 0", () => {
    const { container } = mount(makeView());
    openSheet(container, 1);
    fireEvent.focus(input(container));
    fireEvent.change(input(container), { target: { value: "비" } });
    fireEvent.change(input(container), { target: { value: "비밀" } });
    act(() => void vi.advanceTimersByTime(5000));
    expect(sent(sendOf())).toEqual([]);
  });

  it("닫기 버튼으로 시트를 닫으면 아무것도 보내지 않는다", () => {
    const { container } = mount(makeView());
    openSheet(container, 1);
    fireEvent.change(input(container), { target: { value: "쓰다 말았어요" } });
    fireEvent.click(container.querySelector<HTMLButtonElement>("[data-line-close]")!);
    expect(sheet(container)).toBeNull();
    expect(sent(sendOf())).toEqual([]);
  });
});

describe("채팅 줄 세 가지 (UI-SPEC B-3, 트레이서)", () => {
  it("받은 비공개 줄 '{A} → 나' + 본문, 보낸 비공개 줄 '나 → {B}' + 본문, 공개 사실 줄 '{A} → {B} 귓속말'", () => {
    const { container } = mount(makeView());
    emit(wireLine("whisper", 1, 0, 1, "받은 비밀", NOW + 1));
    emit(wireLine("whisper", 0, 2, 2, "보낸 비밀", NOW + 2));
    emit(wireLine("whispered", 3, 4, 3, "", NOW + 3));
    const text = log(container).textContent ?? "";
    expect(text).toContain("영희 → 나");
    expect(text).toContain("받은 비밀");
    expect(text).toContain("나 → 서준");
    expect(text).toContain("보낸 비밀");
    expect(text).toContain("지아 → 도윤 귓속말");
  });

  it("사실 줄에는 본문이 없고 whisper 아이콘이 있다", () => {
    const { container } = mount(makeView());
    emit(wireLine("whispered", 3, 4, 3, "", NOW + 3));
    const rows = [...log(container).querySelectorAll<HTMLElement>(".mv-chat__sys")];
    const row = rows.find((r) => (r.textContent ?? "").includes("귓속말"))!;
    expect(row).toBeDefined();
    expect(row.querySelector("svg")).not.toBeNull();
    expect(row.textContent).toBe("지아 → 도윤 귓속말");
  });

  it("같은 채널·seq 의 줄은 한 번만 보인다", () => {
    const { container } = mount(makeView());
    emit(wireLine("whisper", 1, 0, 1, "한 번만", NOW + 1));
    emit(wireLine("whisper", 1, 0, 1, "한 번만", NOW + 1));
    expect(((log(container).textContent ?? "").match(/한 번만/g) ?? []).length).toBe(1);
  });

  it("카드(유언)는 이전처럼 카드로 그려진다 — 귓속말 분기가 삼키지 않는다", () => {
    const { container } = mount(makeView());
    emit({ t: "chat", ch: "all", seat: 3, seq: 9, text: "유언이에요", at: NOW, k: "will" });
    act(() => void vi.advanceTimersByTime(4000));
    expect(container.querySelector('[data-card="will"]')).not.toBeNull();
  });
});

// ---- Task 2: 사용함·거절·받음·모드 해제·시트 위치 ----
// 기본판(결정 0072)에서 꺼짐 — 판 규칙의 whisper 를 켜면 다시 돈다(귓속말 버튼·시트가 있어야 성립한다). 꺼진 상태는 badgeUi.test.tsx 의 기본판 describe 가 본다.
describe.skipIf(!GAME_RULES.whisper)("사용함 표시 (UI-SPEC B-1, O-4)", () => {
  it("서버가 whisperUsed 를 켜면 버튼은 aria-disabled·점 없음·이름 '오늘 귓속말을 이미 보냈어요'이고 눌러도 모드가 켜지지 않는다", () => {
    const { container } = mount(makeView({ used: true }));
    const btn = floatBtn(container)!;
    expect(btn.getAttribute("aria-disabled")).toBe("true");
    expect(btn.getAttribute("aria-label")).toBe("오늘 귓속말을 이미 보냈어요");
    expect(btn.querySelector(".mv-float__dot")).toBeNull();
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    expect(stage.props!.pick).toBeUndefined();
    expect(container.textContent).not.toContain("귓속말할 사람을 눌러요");
  });

  it("다음 일차 토론에서 키가 사라지면 다시 켜진다", () => {
    const { container, show } = mount(makeView({ used: true, day: 1 }));
    expect(floatBtn(container)!.getAttribute("aria-disabled")).toBe("true");
    show(makeView({ day: 2 }));
    expect(floatBtn(container)!.getAttribute("aria-disabled")).toBeNull();
    expect(floatBtn(container)!.querySelector(".mv-float__dot")).not.toBeNull();
    fireEvent.click(floatBtn(container)!);
    expect(stage.props!.pick).toBeDefined();
  });

  it("연결이 끊긴 동안(canSend false)은 aria-disabled 이고 눌러도 아무 일 없다", () => {
    const { container } = mount(makeView(), { canSend: false });
    const btn = floatBtn(container)!;
    expect(btn.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(btn);
    expect(stage.props!.pick).toBeUndefined();
  });

  it("보낸 뒤 서버가 사용함으로 확인하면 시트가 닫히고 입력이 비워지며 버튼이 불가 상태가 된다", () => {
    const { container, show } = mount(makeView());
    openSheet(container, 2);
    fireEvent.change(input(container), { target: { value: "비밀이에요" } });
    fireEvent.click(sendBtn(container));
    expect(sheet(container)).not.toBeNull(); // 확인 전에는 닫히지 않는다
    show(makeView({ used: true }));
    expect(sheet(container)).toBeNull();
    expect(floatBtn(container)!.getAttribute("aria-disabled")).toBe("true");
    expect(floatBtn(container)!.getAttribute("aria-label")).toBe("오늘 귓속말을 이미 보냈어요");
  });

  it("확인을 기다리는 동안 보내기를 연타해도 send 는 한 번이다", () => {
    const { container } = mount(makeView());
    openSheet(container, 2);
    fireEvent.change(input(container), { target: { value: "비밀이에요" } });
    fireEvent.click(sendBtn(container));
    fireEvent.click(sendBtn(container));
    fireEvent.keyDown(input(container), { key: "Enter" });
    expect(sent(sendOf())).toHaveLength(1);
  });

  it("입력칸에서 Enter 로도 보낼 수 있다", () => {
    const { container } = mount(makeView());
    openSheet(container, 4);
    fireEvent.change(input(container), { target: { value: "엔터로" } });
    fireEvent.keyDown(input(container), { key: "Enter" });
    expect(sent(sendOf())).toEqual([{ t: "whisper", to: 4, text: "엔터로" }]);
  });
});

// 기본판(결정 0072)에서 꺼짐 — 판 규칙의 whisper 를 켜면 다시 돈다(귓속말 버튼·시트가 있어야 성립한다). 꺼진 상태는 badgeUi.test.tsx 의 기본판 describe 가 본다.
describe.skipIf(!GAME_RULES.whisper)("거절 알림 (UI-SPEC B-2)", () => {
  const sendOne = (container: ParentNode) => {
    openSheet(container, 2);
    fireEvent.change(input(container), { target: { value: "비밀이에요" } });
    fireEvent.click(sendBtn(container));
  };

  it("보낸 뒤 오류 WRONG_PHASE 면 토스트 '지금은 보낼 수 없어요', 시트와 입력은 그대로", () => {
    const { container } = mount(makeView());
    sendOne(container);
    emitError("WRONG_PHASE");
    expect(toast(container)).toBe("지금은 보낼 수 없어요");
    expect(sheet(container)).not.toBeNull();
    expect(input(container).value).toBe("비밀이에요");
    expect(stage.props!.pick).toBeUndefined(); // 모드는 이미 꺼진 상태
  });

  it("그 밖 코드(BAD_MESSAGE·RATE_LIMITED)는 '보내지 못했어요. 다시 해 보세요'", () => {
    const { container } = mount(makeView());
    sendOne(container);
    emitError("BAD_MESSAGE");
    expect(toast(container)).toBe("보내지 못했어요. 다시 해 보세요");
    expect(sheet(container)).not.toBeNull();
  });

  it("거절 뒤에는 다시 보낼 수 있다(두 번째 send)", () => {
    const { container } = mount(makeView());
    sendOne(container);
    emitError("RATE_LIMITED");
    fireEvent.click(sendBtn(container));
    expect(sent(sendOf())).toHaveLength(2);
  });

  it("보낸 적 없는 오류는 귓속말 문구를 만들지 않는다", () => {
    const { container } = mount(makeView());
    emitError("BAD_MESSAGE");
    expect(toast(container)).not.toBe("보내지 못했어요. 다시 해 보세요");
  });

  it("3초가 지난 뒤의 오류는 귓속말 거절로 보지 않는다", () => {
    const { container } = mount(makeView());
    sendOne(container);
    act(() => void vi.advanceTimersByTime(3500));
    emitError("RATE_LIMITED");
    expect(toast(container)).not.toBe("보내지 못했어요. 다시 해 보세요");
  });
});

describe("받음 알림 (UI-SPEC B-3)", () => {
  it("라이브로 받은 귓속말이면 토스트 '{A} 님의 귓속말'(본문 없음)", () => {
    const { container } = mount(makeView());
    emit(wireLine("whisper", 1, 0, 1, "비밀 본문", NOW + 1));
    expect(toast(container)).toBe("영희 님의 귓속말");
    expect(toast(container)).not.toContain("비밀 본문");
  });

  it("받을 때마다 알림이 다시 뜬다(두 번째 줄도)", () => {
    const { container } = mount(makeView());
    emit(wireLine("whisper", 1, 0, 1, "하나", NOW + 1));
    act(() => void vi.advanceTimersByTime(3000));
    expect(toast(container)).toBe("");
    emit(wireLine("whisper", 2, 0, 2, "둘", NOW + 2));
    expect(toast(container)).toBe("서준 님의 귓속말");
  });

  it("재접속 복원(chatLog) 줄에는 토스트가 없고 줄은 보인다", () => {
    const { container } = mount(makeView());
    emit({ t: "chatLog", lines: [{ ch: "all", seat: 1, seq: 1, text: "복원 본문", at: NOW - 5000, k: "whisper", to: 0 }] });
    expect(toast(container)).toBe("");
    expect(log(container).textContent).toContain("복원 본문");
  });

  it("보낸 줄과 공개 사실 줄에는 토스트가 없다", () => {
    const { container } = mount(makeView());
    emit(wireLine("whisper", 0, 2, 1, "내가 보냄", NOW + 1));
    emit(wireLine("whispered", 3, 4, 2, "", NOW + 2));
    expect(toast(container)).toBe("");
  });
});

// 기본판(결정 0072)에서 꺼짐 — 판 규칙의 whisper 를 켜면 다시 돈다(귓속말 버튼·시트가 있어야 성립한다). 꺼진 상태는 badgeUi.test.tsx 의 기본판 describe 가 본다.
describe.skipIf(!GAME_RULES.whisper)("모드 해제 (UI-SPEC B-1 4)", () => {
  it("단계가 토론을 벗어나면 모드가 꺼지고 버튼도 사라진다", () => {
    const { container, show } = mount(makeView());
    fireEvent.click(floatBtn(container)!);
    expect(stage.props!.pick).toBeDefined();
    show(makeView({ phase: "nomination" }));
    expect(stage.props!.pick?.group).not.toBe("귓속말");
    expect(floatBtn(container)).toBeNull();
    expect(container.textContent).not.toContain("귓속말할 사람을 눌러요");
  });

  it("단계가 토론을 벗어나면 열린 시트도 닫힌다", () => {
    const { container, show } = mount(makeView());
    openSheet(container, 2);
    expect(sheet(container)).not.toBeNull();
    show(makeView({ phase: "nomination" }));
    expect(sheet(container)).toBeNull();
  });

  it("시트의 상대가 죽으면 시트가 닫힌다", () => {
    const { container, show } = mount(makeView());
    openSheet(container, 2);
    show(makeView({ dead: [2] }));
    expect(sheet(container)).toBeNull();
  });

  it("유령(내가 죽음)에게는 버튼이 없고 공개 사실 줄만 보인다(O-21)", () => {
    const { container } = mount(makeView({ dead: [0] }));
    expect(floatBtn(container)).toBeNull();
    emit(wireLine("whispered", 3, 4, 1, "", NOW + 1));
    expect(log(container).textContent).toContain("지아 → 도윤 귓속말");
  });

  it("한 번에 시트 하나만: 귓속말 시트가 열려 있을 때 배지 버튼을 누르면 귓속말 시트가 닫히고 배지 시트가 열린다", () => {
    const { container } = mount(makeView());
    openSheet(container, 2);
    expect(container.querySelectorAll(".mf-will-layer")).toHaveLength(1);
    fireEvent.click(claimBtn(container)!);
    expect(sheet(container)).toBeNull();
    expect(container.querySelector(".mv-claim-sheet")).not.toBeNull();
    expect(container.querySelectorAll(".mf-will-layer")).toHaveLength(1);
  });

  it("배지 시트가 열려 있을 때 귓속말 버튼을 누르면 배지 시트가 닫히고 모드가 켜진다", () => {
    const { container } = mount(makeView());
    fireEvent.click(claimBtn(container)!);
    expect(container.querySelector(".mv-claim-sheet")).not.toBeNull();
    fireEvent.click(floatBtn(container)!);
    expect(container.querySelector(".mv-claim-sheet")).toBeNull();
    expect(stage.props!.pick?.group).toBe("귓속말");
  });
});

// 기본판(결정 0072)에서 꺼짐 — 판 규칙의 whisper 를 켜면 다시 돈다(귓속말 버튼·시트가 있어야 성립한다). 꺼진 상태는 badgeUi.test.tsx 의 기본판 describe 가 본다.
describe.skipIf(!GAME_RULES.whisper)("시트 위치 (UI-SPEC B-2)", () => {
  it("한 줄 시트는 시트 층(.mf-will-layer, data-sheet-layer=line) 안에 있고 층은 하나다", () => {
    const { container } = mount(makeView());
    openSheet(container, 2);
    const layer = container.querySelector<HTMLElement>(".mf-will-layer")!;
    expect(layer.getAttribute("data-sheet-layer")).toBe("line");
    expect(layer.contains(sheet(container))).toBe(true);
  });

  it("입력칸에 초점이 가 있다(열리면 키보드가 함께 올라온다)", () => {
    const { container } = mount(makeView());
    openSheet(container, 2);
    expect(document.activeElement).toBe(input(container));
  });

  it("시트를 닫으면 초점이 떠 있는 귓속말 버튼으로 돌아온다", () => {
    const { container } = mount(makeView());
    openSheet(container, 2);
    fireEvent.click(container.querySelector<HTMLButtonElement>("[data-line-close]")!);
    expect(document.activeElement).toBe(floatBtn(container));
  });
});

// ---- Task 3: 본문 DOM 분리(L23)·접근성·줄 스타일 ----
const CANARY = "카나리아-본문-7f3a";
/** 같은 대본(당사자 본문 + 제3자 사실)을 viewer 마다 다르게 먹인다 */
const feedScript = (): void => {
  emit(wireLine("whisper", 0, 1, 1, CANARY, NOW + 1));
  emit(wireLine("whispered", 0, 1, 1, "", NOW + 1));
};

describe("본문 DOM 은 당사자 화면에만 있다 (L23, T-09.1.1-25)", () => {
  it("받는 사람 viewer: 받은 블록(data-whisper=in)에 본문, 공개 줄은 없다", () => {
    const { container } = mount(makeView({ mySeat: 1 }));
    feedScript();
    expect(log(container).querySelectorAll('[data-whisper="in"]')).toHaveLength(1);
    expect(log(container).querySelector('[data-whisper="in"]')?.textContent).toContain(CANARY);
    expect(log(container).querySelectorAll('[data-whisper="public"]')).toHaveLength(0);
    expect(log(container).querySelectorAll('[data-whisper="out"]')).toHaveLength(0);
  });

  it("보낸 사람 viewer: 보낸 블록(data-whisper=out)에 본문, 공개 줄은 없다", () => {
    const { container } = mount(makeView({ mySeat: 0 }));
    feedScript();
    expect(log(container).querySelectorAll('[data-whisper="out"]')).toHaveLength(1);
    expect(log(container).querySelector('[data-whisper="out"]')?.textContent).toContain(CANARY);
    expect(log(container).querySelectorAll('[data-whisper="public"]')).toHaveLength(0);
  });

  it("제3자 viewer: 본문이 DOM 어디에도 없고 공개 줄(data-whisper=public)만 있다(본문 프레임이 잘못 와도 그리지 않는다)", () => {
    const { container } = mount(makeView({ mySeat: 2 }));
    feedScript();
    expect(container.innerHTML).not.toContain(CANARY);
    expect(container.querySelectorAll('[data-whisper="in"], [data-whisper="out"]')).toHaveLength(0);
    const pub = log(container).querySelectorAll('[data-whisper="public"]');
    expect(pub).toHaveLength(1);
    expect(pub[0]?.textContent).toBe("민수 → 영희 귓속말");
  });

  it("유령 viewer: 본문이 DOM 에 없고 공개 줄만 있다", () => {
    const { container } = mount(makeView({ mySeat: 5, dead: [5] }));
    feedScript();
    expect(container.innerHTML).not.toContain(CANARY);
    expect(log(container).querySelectorAll('[data-whisper="public"]')).toHaveLength(1);
    expect(log(container).querySelectorAll('[data-whisper="in"], [data-whisper="out"]')).toHaveLength(0);
  });

  it("닉네임과 본문은 텍스트 노드다 — 태그가 든 본문도 요소가 되지 않는다(T-09.1.1-26)", () => {
    const { container } = mount(makeView({ mySeat: 1 }));
    emit(wireLine("whisper", 0, 1, 1, "<img src=x onerror=alert(1)><b>굵게</b>", NOW + 1));
    expect(log(container).querySelector("img")).toBeNull();
    expect(log(container).querySelector("b")).toBeNull();
    expect(log(container).textContent).toContain("<b>굵게</b>");
  });
});

// 기본판(결정 0072)에서 꺼짐 — 판 규칙의 whisper 를 켜면 다시 돈다(귓속말 버튼·시트가 있어야 성립한다). 꺼진 상태는 badgeUi.test.tsx 의 기본판 describe 가 본다.
describe.skipIf(!GAME_RULES.whisper)("접근성 (UI-SPEC 접근성 · 모션 · 입력)", () => {
  it("비공개 줄은 role=note 가 아니라 일반 항목이고 읽히는 글은 '{A} → 나, {본문}'", () => {
    const { container } = mount(makeView({ mySeat: 1 }));
    emit(wireLine("whisper", 0, 1, 1, "안녕하세요", NOW + 1));
    const block = log(container).querySelector<HTMLElement>('[data-whisper="in"]')!;
    expect(block.getAttribute("role")).toBeNull();
    expect(container.querySelector('[role="note"]')).toBeNull();
    expect(block.textContent).toBe("민수 → 나, 안녕하세요");
  });

  it("시트 입력에 aria-label, 보내기·닫기 버튼 이름은 '보내기'·'닫기'", () => {
    const { container } = mount(makeView());
    openSheet(container, 2);
    expect(input(container).getAttribute("aria-label")).toBe("귓속말 입력");
    expect(sendBtn(container).getAttribute("aria-label")).toBe("보내기");
    expect(container.querySelector("[data-line-close]")?.getAttribute("aria-label")).toBe("닫기");
  });

  it("시트의 Tab 순서: 입력 → 보내기, 닫기가 맨 앞(윗줄)", () => {
    const { container } = mount(makeView());
    openSheet(container, 2);
    const order = [...sheet(container)!.querySelectorAll("button, input")].map((el) => el.getAttribute("data-line-close") !== null ? "close" : el.getAttribute("data-line-input") !== null ? "input" : "send");
    expect(order).toEqual(["close", "input", "send"]);
  });

  it("버튼·시트 버튼은 mousedown 기본 동작을 막아 키보드를 유지한다", () => {
    const { container } = mount(makeView());
    const down = (el: Element): boolean => fireEvent.mouseDown(el);
    expect(down(floatBtn(container)!)).toBe(false);
    openSheet(container, 2);
    expect(down(sendBtn(container))).toBe(false);
    expect(down(container.querySelector("[data-line-close]")!)).toBe(false);
  });

  it("상대 칩 얼굴 그림이 실패하면 자리 구분색 원으로 바뀐다", () => {
    const { container } = mount(makeView());
    openSheet(container, 2);
    const img = sheet(container)!.querySelector("img.mv-line__face")!;
    expect(img.getAttribute("src")).toBe("/characters/faces/face-2.png");
    fireEvent.error(img);
    const dot = sheet(container)!.querySelector<HTMLElement>(".mv-line__face.is-fallback")!;
    expect(dot).not.toBeNull();
    expect(dot.getAttribute("style")).toContain("--seat-3");
  });
});

// 11-07: 귓속말 보내기 시트 위쪽의 공개 예고(A-4, D-23) — 시트가 열려 있는 동안 항상 같은 한 줄이다
// 기본판(결정 0072)에서 꺼짐 — 판 규칙의 whisper 를 켜면 다시 돈다(귓속말 버튼·시트가 있어야 성립한다). 꺼진 상태는 badgeUi.test.tsx 의 기본판 describe 가 본다.
describe.skipIf(!GAME_RULES.whisper)("공개 예고 한 줄 (11-07, A-4)", () => {
  const PRE = "끝나면 밤 대화와 귓속말이 공개돼요";
  const notice = (c: ParentNode) => c.querySelector<HTMLElement>("[data-line-sheet] [data-pre-notice]");

  it("시트가 열려 있는 동안 위쪽(상대 칩 앞)에 항상 있다", () => {
    const { container } = mount(makeView());
    expect(container.querySelector("[data-pre-notice]")).toBeNull();
    openSheet(container, 2);
    expect(notice(container)?.textContent).toBe(PRE);
    const s = sheet(container)!;
    expect(s.firstElementChild).toBe(notice(container));
    act(() => void vi.advanceTimersByTime(30_000));
    expect(notice(container)?.textContent).toBe(PRE);
    expect(notice(container)?.getAttribute("data-state")).toBeNull();
  });

  it("시트를 닫으면 사라진다", () => {
    const { container } = mount(makeView());
    openSheet(container, 2);
    fireEvent.click(container.querySelector("[data-line-close]")!);
    expect(notice(container)).toBeNull();
  });
});
