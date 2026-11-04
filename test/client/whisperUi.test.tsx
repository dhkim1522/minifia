import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { ChatLineWire, ClientMessage, PhaseId, PublicPlayer, RoomView } from "../../shared/protocol";
import type { WorldStageProps } from "../../src/components/WorldStage";
import type { RoomConnection } from "../../src/net/useRoomConnection";

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

describe("귓속말 버튼 → 모드 → 이름표 → 한 줄 시트 → whisper 전송 (UI-SPEC B-1·B-2, 트레이서)", () => {
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
