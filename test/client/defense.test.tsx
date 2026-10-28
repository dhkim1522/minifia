/// <reference types="node" />
import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { ChatLine, RoomView } from "../../shared/protocol";
import type { RoomConnection, RoomEvent } from "../../src/net/useRoomConnection";
import { DefensePanel } from "../../src/components/DefensePanel";
import {
  VERDICT_BLUR_PX,
  VERDICT_DIM_PERCENT,
  VERDICT_TEXT,
  defenseDisconnected,
  defenseStatus,
} from "../../src/game/verdict";

// RoomScreen 한 경로(Task 3)용: 연결 훅만 가짜로 바꾼다. DefensePanel 단위 시험은 이 훅을 쓰지 않는다.
const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));
const { RoomScreen } = await import("../../src/screens/RoomScreen");

// 최후 변론(defense) 04-21. Task 2: 남의 변론 하단 DefensePanel 단위 시험. Task 3: RoomScreen 한 경로(아래 이어서).
// 서버와는 view 픽스처와 이벤트 발행기로만 만난다.

const NOW = 1_700_000_000_000;

function makeView(over: Partial<RoomView> = {}): RoomView {
  return {
    code: "0042",
    phase: "defense",
    phaseEndsAt: NOW + 10_000,
    phaseDurationMs: 15_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players: [
      { seat: 0, nickname: "지우", connected: true, isHost: true },
      { seat: 1, nickname: "하윤", connected: true, isHost: false },
      { seat: 2, nickname: "민지", connected: true, isHost: false },
      { seat: 3, nickname: "도현", connected: true, isHost: false },
    ],
    me: { seat: 0, isHost: true },
    day: { n: 1, roles: ["mafia", "police", "citizen"], claimLog: [], candidate: 2 },
    ...over,
  };
}

function emitter() {
  const listeners = new Set<(e: RoomEvent) => void>();
  return {
    onEvent: (l: (e: RoomEvent) => void) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    emit: (e: RoomEvent) =>
      act(() => {
        for (const l of [...listeners]) l(e);
      }),
  };
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

const defLine = (seq: number, seat: number, template: ChatLine["template"] = "defNotMe"): ChatLine => ({ seq, seat, template, at: 0 });

interface PanelOpts {
  lines?: ChatLine[];
  over?: Partial<RoomConnection>;
  view?: RoomView;
  candidateConnected?: boolean;
  readOnly?: boolean;
}
function panel(o: PanelOpts = {}) {
  const view = o.view ?? makeView();
  const c = conn(view, o.over);
  const showToast = vi.fn();
  const utils = render(
    <DefensePanel
      view={view}
      connection={c}
      showToast={showToast}
      lines={o.lines ?? []}
      candidateNickname="민지"
      candidateConnected={o.candidateConnected ?? true}
      readOnly={o.readOnly ?? false}
    />,
  );
  return { ...utils, conn: c, showToast };
}

const items = () => [...screen.getByRole("log", { name: "최근 채팅" }).querySelectorAll<HTMLElement>(".mf-msglog__item")];
const emojiBtn = () => screen.getByRole("button", { name: "이모티콘" }) as HTMLButtonElement;
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("DefensePanel: 남의 변론 하단 (UI-SPEC 8.4·7.2, D-13·D-35)", () => {
  it("채팅 로그 아래에 .st-row(.stat + 이모티콘 버튼 하나)가 있고 TurnPanel 의 클래스를 그대로 쓴다", () => {
    const { container } = panel();
    const root = container.querySelector(".mf-turnpanel")!;
    expect(root.firstElementChild?.classList.contains("mf-msglog")).toBe(true);
    expect(root.lastElementChild?.classList.contains("st-row")).toBe(true);
    expect(root.querySelectorAll(".st-row button").length).toBe(1);
  });

  it("상태 줄: 굵은 `{이름}님이 변론하는 중` + 오른쪽 `{N}초`(헤더 타이머와 같은 카운트다운)", () => {
    const { container } = panel();
    expect(container.querySelector(".stat b")?.textContent).toBe(defenseStatus("민지"));
    expect(container.querySelector(".stat b")?.textContent).toBe("민지님이 변론하는 중");
    expect(container.querySelector(".stat span")?.textContent).toBe("10초");
    advance(3_000);
    expect(container.querySelector(".stat span")?.textContent).toBe("7초");
  });

  it("후보의 변론 줄만 보인다: 점·이름은 후보 자리 색, 문장은 messageText", () => {
    panel({ lines: [defLine(1, 2, "defNotMe"), defLine(2, 2, "defPlead")] });
    expect(items().map((el) => el.querySelector(".mf-msglog__name")?.textContent).join("|")).toBe("민지|민지");
    expect(items().map((el) => el.querySelector(".mf-msglog__text")?.textContent).join("|")).toBe("저 아니에요|한 번만 믿어 주세요");
    expect(items()[0]!.querySelector<HTMLElement>(".mf-msglog__dot")!.getAttribute("style") ?? "").toContain("var(--seat-3)");
  });

  it("^ 내역 버튼이 있다(채팅 내역 크게 보기)", () => {
    panel({ lines: [defLine(1, 2)] });
    expect(screen.getByRole("button", { name: "채팅 내역 크게 보기" })).toBeTruthy();
  });

  it("후보가 연결이 끊겨 있으면 상태 줄이 끊김 문구 + 초이고 이모티콘 버튼은 그대로 쓸 수 있다", () => {
    const { container } = panel({ candidateConnected: false });
    expect(container.querySelector(".stat b")?.textContent).toBe(defenseDisconnected("민지"));
    expect(container.querySelector(".stat b")?.textContent).toBe("민지님은 연결이 끊겨 있어요");
    expect(container.querySelector(".stat span")?.textContent).toBe("10초");
    expect(emojiBtn().disabled).toBe(false);
  });

  it("마감이 없으면 초를 그리지 않는다", () => {
    const { container } = panel({ view: makeView({ phaseEndsAt: null, phaseDurationMs: null }) });
    expect(container.querySelector(".stat span")).toBeNull();
  });

  it("닉네임은 글자로만 그린다 (T-04-40)", () => {
    const view = makeView();
    const evil = { ...view, players: view.players.map((p) => (p.seat === 2 ? { ...p, nickname: "<b>x</b>" } : p)) };
    const c = conn(evil);
    const { container } = render(
      <DefensePanel view={evil} connection={c} showToast={vi.fn()} lines={[]} candidateNickname="<b>x</b>" candidateConnected readOnly={false} />,
    );
    expect(container.querySelector(".stat b")?.textContent).toBe("<b>x</b>님이 변론하는 중");
    expect(container.querySelector(".stat b b")).toBeNull();
  });
});

describe("DefensePanel: 이모티콘 (합산 쿨다운 훅 공용, COMM-03)", () => {
  it("버튼 → 트레이가 열리고 이모티콘을 고르면 { t:'emoji', icon } 를 보내며 버튼이 잠긴다", () => {
    const { conn: c } = panel();
    fireEvent.click(emojiBtn());
    const dialog = document.querySelector<HTMLDialogElement>('dialog[aria-label="이모티콘"]')!;
    expect(dialog).toBeTruthy();
    const cell = dialog.querySelector<HTMLButtonElement>(".mf-emojitray__cell")!;
    fireEvent.click(cell);
    expect(c.send).toHaveBeenCalledTimes(1);
    const sent = (c.send as ReturnType<typeof vi.fn>).mock.calls[0][0] as { t: string; icon: string };
    expect(sent.t).toBe("emoji");
    expect(typeof sent.icon).toBe("string");
    expect(emojiBtn().disabled).toBe(true);
    advance(2_000);
    expect(emojiBtn().disabled).toBe(false);
  });

  it("연결이 끊겨 보낼 수 없으면 이모티콘 버튼이 꺼진다", () => {
    panel({ over: { canSend: false } });
    expect(emojiBtn().disabled).toBe(true);
  });

  it("서버가 BAD_MESSAGE 로 거부하면 토스트로 알린다", () => {
    const bus = emitter();
    const { showToast } = panel({ over: { onEvent: bus.onEvent } });
    bus.emit({ t: "error", code: "BAD_MESSAGE" });
    expect(showToast).toHaveBeenCalledTimes(1);
    expect(String(showToast.mock.calls[0][0])).toContain("보내지 못했어요");
  });

  it("트레이 열림 상태는 이 부품이 쥔다 — 언마운트하면 닫힌다", () => {
    const { unmount } = panel();
    fireEvent.click(emojiBtn());
    expect(document.querySelector('dialog[aria-label="이모티콘"]')).toBeTruthy();
    unmount();
    expect(document.querySelector('dialog[aria-label="이모티콘"]')).toBeNull();
  });
});

describe("DefensePanel: 관전 (탈락 viewer, D-35)", () => {
  it("채팅(읽기) + 알약 `관전 중 · 볼 수만 있어요`, 상태 줄·이모티콘 버튼 없음", () => {
    const { container } = panel({ readOnly: true, lines: [defLine(1, 2)] });
    expect(container.querySelector(".mf-turnpanel .mf-msglog")).not.toBeNull();
    expect(container.querySelector(".mf-ro")?.textContent).toBe(VERDICT_TEXT.spectatorPill);
    expect(container.querySelector(".st-row")).toBeNull();
    expect(screen.queryByRole("button", { name: "이모티콘" })).toBeNull();
    expect(items().length).toBe(1);
  });
});

describe("DefensePanel: 직업 비공개 (T-04-57, D-09)", () => {
  it("입력에 역할 필드가 없고(후보 닉네임·접속 여부·줄뿐) 부품은 직업 문구 표를 읽지 않는다", () => {
    const src = readFileSync("src/components/DefensePanel.tsx", "utf8");
    const props = /export interface DefensePanelProps\s*\{([^}]*)\}/.exec(src)?.[1] ?? "";
    expect(props).toContain("candidateNickname");
    expect(/\brole/i.test(props.replace(/\/\*\*[^]*?\*\//g, ""))).toBe(false);
    expect(src).not.toMatch(/roleText|ROLE_TEXT|ROLE_IDS/);
  });

  it("후보의 직업을 모르는 view(me.role 만 있음)에서 상태 줄에 직업 단어가 없다", () => {
    const { container } = panel({ view: makeView({ me: { seat: 0, isHost: true, role: "mafia" } }) });
    expect(container.querySelector(".stat")?.textContent).not.toMatch(/마피아|경찰|의사|시민/);
  });
});

// ---- Task 3: RoomScreen 한 경로 (defense 연결) ----
const FILL: Partial<RoomView> = {};

function roomView(o: { me?: number; candidate?: number | null; dead?: number[]; disconnected?: number[]; mafia?: number[]; players?: number; spectate?: number[] } = {}): RoomView {
  const base = makeView();
  const names = ["지우", "하윤", "민지", "도현", "서연", "다온"];
  const count = o.players ?? 4;
  const me = o.me ?? 0;
  const dead = o.dead ?? [];
  const view: RoomView = {
    ...base,
    ...FILL,
    players: Array.from({ length: count }, (_, seat) => ({
      seat,
      nickname: names[seat] ?? `사람${seat}`,
      connected: !(o.disconnected ?? []).includes(seat),
      isHost: seat === 0,
      ...(dead.includes(seat) ? { alive: false } : {}),
    })),
    me: { seat: me, isHost: me === 0, role: o.mafia ? "mafia" : "citizen" },
    day: {
      n: 1,
      roles: ["mafia", "police", "citizen"],
      claimLog: [],
      ...(o.candidate === null ? {} : { candidate: o.candidate ?? 2 }),
    },
  };
  if (o.mafia && dead.includes(me)) {
    view.spectate = { seats: o.mafia.map((seat) => ({ seat, job: "mafia" as const })) };
  } else if (o.mafia) {
    view.me.allies = o.mafia.filter((s) => s !== me);
  }
  return view;
}

function renderRoom(view: RoomView, over: Partial<RoomConnection> = {}) {
  connectionMock.current = conn(view, over);
  const r = render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
  const rerenderRoom = (v: RoomView, o: Partial<RoomConnection> = over) => {
    connectionMock.current = conn(v, o);
    r.rerender(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
  };
  return { ...r, rerenderRoom, send: (connectionMock.current as RoomConnection).send as ReturnType<typeof vi.fn> };
}

const panelOf = (c: HTMLElement) => c.querySelector<HTMLElement>(".mf-dayscene__panel")!;
const seatOf = (c: HTMLElement, n: number) => c.querySelector<HTMLElement>(`.mf-dt__seat[data-seat="${n}"]`)!;
const haloSeats = (c: HTMLElement, kind: "white" | "crimson") =>
  Array.from(c.querySelectorAll<HTMLElement>(`img.mf-figure--halo-${kind}`))
    .map((img) => img.closest<HTMLElement>(".mf-dt__seat")!.dataset.seat)
    .join(",");
const announce = (c: HTMLElement) => c.querySelector<HTMLElement>(".mf-room > p.mf-sr-only[aria-live]")?.textContent;

describe("defense 화면 한 경로 (VOTE-03, D-15·D-16·D-29, COMM-03)", () => {
  it("남의 변론: 헤더 `낮 · 최후 변론`/`1일차 · 민지님의 변론`, 후보 center·흰 후광 하나, 어둡게 층 하나, 원뿔 하나, 하단 DefensePanel, 안내 `민지님의 최후 변론`", () => {
    const { container } = renderRoom(roomView());
    expect(screen.queryByText("연결 중…")).toBeNull();
    expect(screen.queryByRole("heading", { name: "낮 · 최후 변론" })).not.toBeNull();
    expect(screen.queryByText("1일차 · 민지님의 변론")).not.toBeNull();
    expect(container.querySelector(".mf-dayscene")?.classList.contains("mf-dayscene--verdict")).toBe(true);
    expect(haloSeats(container, "white")).toBe("2");
    expect(container.querySelectorAll('img[class*="mf-figure--halo"]').length).toBe(1);
    expect(seatOf(container, 2).style.zIndex).toBe("31");
    expect(container.querySelectorAll(".mf-dt__dim--verdict").length).toBe(1);
    expect(container.querySelectorAll(".mf-dt__cone").length).toBe(1);
    expect(panelOf(container).querySelector(".stat b")?.textContent).toBe("민지님이 변론하는 중");
    expect(panelOf(container).querySelector(".stat span")?.textContent).toBe("10초");
    expect(announce(container)).toBe("민지님의 최후 변론");
  });

  it("어둡게 45%·흐림 3px 는 VERDICT_DIM_PERCENT·VERDICT_BLUR_PX 에서만 온다(화면 파일에 숫자를 쓰지 않는다)", () => {
    const { container } = renderRoom(roomView());
    const dim = container.querySelector<HTMLElement>(".mf-dt__dim--verdict")!;
    expect(dim.style.getPropertyValue("--mf-verdict-dim")).toBe(`${VERDICT_DIM_PERCENT}%`);
    expect(dim.style.getPropertyValue("--mf-verdict-blur")).toBe(`${VERDICT_BLUR_PX}px`);
    const src = readFileSync("src/screens/verdictScene.tsx", "utf8");
    expect(src).toContain("VERDICT_DIM_PERCENT");
    expect(src).toContain("VERDICT_BLUR_PX");
    expect(/dimPercent:\s*\d|blurPx:\s*\d/.test(src)).toBe(false);
  });

  it("후보 본인: 안내 `1일차 · 내 변론`, 하단은 제목 `변론할 말을 고르세요` + 안내 `한 번에 하나씩 보낼 수 있어요`(칩은 04-22), 안내문 `내 최후 변론. 변론할 말을 고르세요`", () => {
    const { container } = renderRoom(roomView({ me: 2 }));
    expect(screen.queryByText("1일차 · 내 변론")).not.toBeNull();
    expect(panelOf(container).querySelector("h2")?.textContent).toBe(VERDICT_TEXT.defenseChooseTitle);
    expect(panelOf(container).querySelector("p")?.textContent).toBe(VERDICT_TEXT.defenseChooseHint);
    expect(panelOf(container).querySelector(".st-row")).toBeNull();
    expect(haloSeats(container, "white")).toBe("2");
    expect(announce(container)).toBe("내 최후 변론. 변론할 말을 고르세요");
  });

  it("탈락 viewer: 하단은 채팅(읽기) + 관전 알약, 좌석은 버튼이 아니다(기록 카드 열림 없음)", () => {
    const { container } = renderRoom(roomView({ me: 1, dead: [1] }));
    expect(panelOf(container).querySelector(".mf-ro")?.textContent).toBe(VERDICT_TEXT.spectatorPill);
    expect(panelOf(container).querySelector(".st-row")).toBeNull();
    expect(container.querySelectorAll("button.mf-dt__seat").length).toBe(0);
    fireEvent.click(seatOf(container, 3));
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("살아 있는 viewer 의 좌석도 버튼이 아니다 — 누를 수 없다", () => {
    const { container } = renderRoom(roomView());
    expect(container.querySelectorAll("button.mf-dt__seat").length).toBe(0);
    expect(container.querySelectorAll(".mf-dt__seat[role='group']").length).toBe(4);
  });

  it("후보 연결 끊김: 그림은 끊김 흐림 + 흰 후광, 하단 상태 줄은 끊김 문구, 이모티콘 버튼은 쓸 수 있다", () => {
    const { container } = renderRoom(roomView({ disconnected: [2] }));
    const img = seatOf(container, 2).querySelector("img")!;
    expect(img.classList.contains("mf-figure--disconnected")).toBe(true);
    expect(img.classList.contains("mf-figure--halo-white")).toBe(true);
    expect(panelOf(container).querySelector(".stat b")?.textContent).toBe("민지님은 연결이 끊겨 있어요");
    expect((screen.getByRole("button", { name: "이모티콘" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("마피아 동료의 진홍 후광은 유지되고(후보 흰 + 동료 진홍), 합이 3 을 넘으면 진홍부터 꺼지며 마름모는 남는다", () => {
    // 살아 있는 마피아: 후보 흰 1 + 동료 진홍 1 = 2
    const a = renderRoom(roomView({ me: 0, mafia: [0, 1] }));
    expect(haloSeats(a.container, "white")).toBe("2");
    expect(haloSeats(a.container, "crimson")).toBe("1");
    cleanup();
    // 관전자가 마피아 셋을 보면 흰 1 + 진홍 3 = 4 → 진홍 하나가 꺼진다(번호가 큰 쪽부터), 마름모 셋은 남는다
    const b = renderRoom(roomView({ me: 0, dead: [0], players: 6, mafia: [1, 3, 4] }));
    expect(haloSeats(b.container, "white")).toBe("2");
    expect(b.container.querySelectorAll('img[class*="mf-figure--halo"]').length).toBe(3);
    expect(haloSeats(b.container, "crimson")).toBe("1,3");
    expect(b.container.querySelectorAll(".mf-dt__mark").length).toBe(3);
  });

  it("candidateVoteReveal → defense 에서 테이블(.mf-dt)과 장면 래퍼는 같은 DOM 노드다. 후보 좌석 좌표만 가운데로 바뀐다", () => {
    const r = renderRoom({ ...roomView(), phase: "candidateVoteReveal" });
    const scene = r.container.querySelector(".mf-phase-enter");
    const table = r.container.querySelector(".mf-dt");
    const before = seatOf(r.container, 2).style.left;
    expect(r.container.querySelector(".mf-dayscene")?.classList.contains("mf-dayscene--verdict")).toBe(false);
    expect(r.container.querySelectorAll(".mf-dt__dim--verdict, .mf-dt__cone").length).toBe(0);
    r.rerenderRoom(roomView());
    expect(r.container.querySelector(".mf-phase-enter") === scene).toBe(true);
    expect(r.container.querySelector(".mf-dt") === table).toBe(true);
    expect(seatOf(r.container, 2).style.left).not.toBe(before);
    expect(r.container.querySelector(".mf-dt")?.classList.contains("mf-dt--verdict")).toBe(true);
  });

  it("서버 이상(candidate 없음): center·층 없이 NightPanel 로 안전하게 그린다", () => {
    const { container } = renderRoom(roomView({ candidate: null }));
    expect(container.querySelectorAll(".mf-dt__dim--verdict, .mf-dt__cone").length).toBe(0);
    expect(container.querySelector(".mf-dayscene")?.classList.contains("mf-dayscene--verdict")).toBe(false);
    expect(panelOf(container).querySelector("h2")).not.toBeNull();
    expect(container.querySelectorAll(".mf-dt__seat").length).toBe(4);
  });

  it("후보 변론 chat 이벤트가 오면 후보 머리 위 `…` 말풍선과 하단 채팅 줄이 생긴다. 남의 이모티콘은 층 위(z 60+)로 뜬다", () => {
    const bus = emitter();
    const { container } = renderRoom(roomView(), { onEvent: bus.onEvent });
    expect(container.querySelectorAll(".mf-dt__bubble").length).toBe(0);
    bus.emit({ t: "chat", seq: 1, seat: 2, template: "defNotMe", at: NOW } as RoomEvent);
    expect(seatOf(container, 2).querySelectorAll(".mf-dt__bubble--spoke").length).toBe(1);
    expect(panelOf(container).querySelector(".mf-msglog__text")?.textContent).toBe("저 아니에요");
    bus.emit({ t: "emoji", seat: 1, icon: "smile", at: NOW } as RoomEvent);
    const em = container.querySelector<HTMLElement>('.mf-dt__emoji[data-seat="1"]')!;
    expect(Number(em.style.zIndex)).toBeGreaterThanOrEqual(60);
  });

  it("공개(candidateVoteReveal)·처형(execution) 단계에서 온 chat·emoji 는 말풍선·이모티콘이 되지 않는다", () => {
    const bus = emitter();
    const { container } = renderRoom({ ...roomView(), phase: "candidateVoteReveal" }, { onEvent: bus.onEvent });
    bus.emit({ t: "chat", seq: 1, seat: 2, template: "defNotMe", at: NOW } as RoomEvent);
    bus.emit({ t: "emoji", seat: 1, icon: "smile", at: NOW } as RoomEvent);
    expect(container.querySelectorAll(".mf-dt__bubble, .mf-dt__emoji").length).toBe(0);
  });

  it("이모티콘 보내기: 하단 버튼 → 트레이 → { t:'emoji' } 가 전송된다", () => {
    const r = renderRoom(roomView());
    fireEvent.click(screen.getByRole("button", { name: "이모티콘" }));
    fireEvent.click(document.querySelector<HTMLButtonElement>(".mf-emojitray__cell")!);
    expect(r.send).toHaveBeenCalledTimes(1);
    expect((r.send.mock.calls[0][0] as { t: string }).t).toBe("emoji");
  });

  it("후보 위치 공식은 candidateCenter 한 곳이다 — DayTable 은 좌표 숫자를 따로 갖지 않는다", () => {
    const src = readFileSync("src/components/DayTable.tsx", "utf8");
    expect(src).toContain("candidateCenter");
    expect(/\+\s*80\b|-\s*34\b/.test(src)).toBe(false);
  });
});
