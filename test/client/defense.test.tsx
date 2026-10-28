/// <reference types="node" />
import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { ChatLine, RoomView } from "../../shared/protocol";
import type { RoomConnection, RoomEvent } from "../../src/net/useRoomConnection";
import { DefensePanel } from "../../src/components/DefensePanel";
import { VERDICT_TEXT, defenseDisconnected, defenseStatus } from "../../src/game/verdict";

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
