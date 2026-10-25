/// <reference types="node" />
import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { ChatLine, PhaseId, RoomView } from "../../shared/protocol";
import type { RoomConnection, RoomEvent } from "../../src/net/useRoomConnection";
import { DayScene } from "../../src/screens/DayScene";

// 낮 토론 화면 통합 테스트(S-07): MessageLog·DiscussionControls·보낸 사람 반전·이모티콘을 DayScene 으로 만난다(결정 0017-2).
// 서버와는 view 픽스처와 이벤트 발행기로만 만난다.

const NOW = 10_000;

interface ViewOpts {
  phase?: PhaseId;
  n?: number;
  isHost?: boolean;
  endsIn?: number;
  durationMs?: number;
  serverNow?: number;
  /** 화면이 방장 여부를 players 에서 읽지 않는지 보려고 players 쪽 isHost 를 따로 줄 수 있다 */
  playerHostSeat?: number;
}

function makeView(o: ViewOpts = {}): RoomView {
  const serverNow = o.serverNow ?? NOW;
  const hostSeat = o.playerHostSeat ?? 0;
  return {
    code: "0042",
    phase: o.phase ?? "discussion",
    phaseEndsAt: serverNow + (o.endsIn ?? 90_000),
    phaseDurationMs: o.durationMs ?? 90_000,
    serverNow,
    minPlayers: 4,
    maxPlayers: 8,
    players: [
      { seat: 0, nickname: "지우", connected: true, isHost: hostSeat === 0 },
      { seat: 1, nickname: "하윤", connected: true, isHost: hostSeat === 1 },
      { seat: 2, nickname: "민지", connected: true, isHost: hostSeat === 2 },
      { seat: 3, nickname: "도현", connected: true, isHost: hostSeat === 3 },
    ],
    me: { seat: 0, isHost: o.isHost ?? false },
    day: {
      n: o.n ?? 1,
      roles: ["mafia", "police", "citizen"],
      claimLog: [],
    },
  };
}

const line = (seq: number, seat: number, target: number | undefined, at: number, template: ChatLine["template"] = "suspect"): RoomEvent => ({
  t: "chat",
  seq,
  seat,
  template,
  ...(target !== undefined ? { target } : {}),
  at,
});

/** 서버 chat·emoji·error 프레임을 흉내 내는 발행기 */
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

function scene(view: RoomView, over: Partial<RoomConnection> = {}) {
  const c = conn(view, over);
  const role = <button type="button">내 역할</button>;
  const utils = render(<DayScene view={view} connection={c} myRoleButton={role} />);
  const rerender = (v: RoomView) => utils.rerender(<DayScene view={v} connection={{ ...c, view: v }} myRoleButton={role} />);
  return { ...utils, rerender, conn: c };
}

const log = () => screen.getByRole("log", { name: "최근 채팅" });
const items = () => [...log().querySelectorAll<HTMLElement>(".mf-msglog__item")];
const quickBtn = () => screen.getByRole("button", { name: "빠른 메시지" }) as HTMLButtonElement;
const emojiBtn = () => screen.getByRole("button", { name: "이모티콘" }) as HTMLButtonElement;
const dialog = (name: string) => document.querySelector<HTMLDialogElement>(`dialog[aria-label="${name}"]`);

const tagOf = (container: HTMLElement, seat: number) => container.querySelector<HTMLElement>(`.mf-dt__tag[data-seat="${seat}"]`);
const emojiOf = (container: HTMLElement, seat: number) => container.querySelectorAll(`.mf-dt__emoji[data-seat="${seat}"]`);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("낮 토론 화면 — 로그·말하기 줄 (COMM-01, D-15·D-16·D-17)", () => {
  it("메시지가 없으면 로그에 '아직 메시지가 없어요'가 보이고, 말하기 줄과 위쪽 바가 있으며, 비방장은 방장 줄이 없다", () => {
    const r = scene(makeView());
    expect(within(log()).getByText("아직 메시지가 없어요")).toBeTruthy();
    expect(items().length).toBe(0);
    expect(log().getAttribute("aria-live")).toBe("polite");
    expect(log().getAttribute("aria-relevant")).toBe("additions");
    expect(quickBtn()).toBeTruthy();
    expect(emojiBtn()).toBeTruthy();
    expect(screen.queryByRole("button", { name: /\+30초 연장/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /넘기기/ })).toBeNull();
    // 위쪽 바: 낮 · 토론, 1일차, 타이머
    expect(r.container.textContent).toContain("낮 · 토론");
    expect(r.container.textContent).toContain("1일차");
    expect(screen.getByRole("timer").textContent).toBe("1:30");
  });

  it("[빠른 메시지] → 시트가 열리고, 하윤 → [보내기] 가 {t:say, template:suspect, target:1} 을 한 번 보내며 시트가 닫힌다", () => {
    const r = scene(makeView());
    expect(dialog("빠른 메시지")).toBeNull();
    fireEvent.click(quickBtn());
    expect(dialog("빠른 메시지")).not.toBeNull();
    fireEvent.click(within(screen.getByRole("group", { name: "대상" })).getByRole("button", { name: "하윤" }));
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));
    expect(r.conn.send).toHaveBeenCalledTimes(1);
    expect(r.conn.send).toHaveBeenCalledWith({ t: "say", template: "suspect", target: 1 });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(dialog("빠른 메시지")).toBeNull();
  });

  it("chat 이벤트(민지 → 하윤 의심돼요)가 오면 로그 마지막 줄이 그 문장이고 자리 2 이름표가 반전(--spoke)되며 말풍선은 없고, 내 줄은 '나'로 보인다", () => {
    const ev = emitter();
    const r = scene(makeView(), { onEvent: ev.onEvent });
    ev.emit(line(1, 0, 1, NOW - 500, "trust"));
    ev.emit(line(2, 2, 1, NOW));
    const rows = items();
    expect(rows.length).toBe(2);
    const last = rows[1]!;
    expect(last.querySelector(".mf-msglog__name")?.textContent).toBe("민지");
    expect(last.querySelector(".mf-msglog__text")?.textContent).toBe("하윤 의심돼요");
    // 내 자리(0) 메시지의 이름은 "나", title 은 전체 닉네임
    const mine = rows[0]!.querySelector(".mf-msglog__name");
    expect(mine?.textContent).toBe("나");
    expect(mine?.getAttribute("title")).toBe("지우");
    // 구분 점은 자리 색 변수
    expect(last.querySelector<HTMLElement>(".mf-msglog__dot")?.getAttribute("style")).toContain("--seat-3");
    // 보낸 사람(자리 2)만 머리 위 '…' 말풍선이고 이름표 반전은 없다(후광도 없다)
    expect(r.container.querySelector('.mf-dt__seat[data-seat="2"] .mf-dt__bubble--spoke')).not.toBeNull();
    expect(r.container.querySelector('.mf-dt__seat[data-seat="1"] .mf-dt__bubble')).toBeNull();
    expect(tagOf(r.container, 2)?.className).toBe("mf-dt__tag");
    expect(r.container.querySelectorAll(".mf-figure--halo-white").length).toBe(0);
    expect(r.container.querySelectorAll(".mf-bubble, .mf-float").length).toBe(0);
  });

  it("3000ms 뒤 말풍선(--spoke)은 사라지고 로그 줄은 남는다", () => {
    const ev = emitter();
    const r = scene(makeView(), { onEvent: ev.onEvent });
    ev.emit(line(1, 2, 1, NOW));
    expect(r.container.querySelectorAll(".mf-dt__bubble--spoke").length).toBe(1);
    act(() => {
      vi.advanceTimersByTime(2_999);
    });
    expect(r.container.querySelectorAll(".mf-dt__bubble--spoke").length).toBe(1);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(r.container.querySelectorAll(".mf-dt__bubble--spoke").length).toBe(0);
    expect(items().length).toBe(1);
  });

  it("처음 마운트(재접속)에는 로그가 '아직 메시지가 없어요' 이고 말풍선(--spoke)이 없다 — 서버가 지난 줄을 보내지 않고 뷰의 옛 messages 키도 읽지 않는다 (결정 0017-7)", () => {
    const base = makeView();
    const legacy = { ...base, day: { ...base.day!, messages: [{ seq: 1, seat: 2, template: "suspect", target: 1, at: NOW }] } } as unknown as RoomView;
    const r = scene(legacy);
    expect(items().length).toBe(0);
    expect(within(log()).getByText("아직 메시지가 없어요")).toBeTruthy();
    expect(r.container.querySelectorAll(".mf-dt__bubble--spoke").length).toBe(0);
  });

  it("다음 낮 토론 view(day.n 2)로 바뀌면 로그가 비어 있다", () => {
    const ev = emitter();
    const r = scene(makeView({ n: 1 }), { onEvent: ev.onEvent });
    ev.emit(line(1, 2, 1, NOW));
    expect(items().length).toBe(1);
    r.rerender(makeView({ n: 2 }));
    expect(items().length).toBe(0);
    expect(within(log()).getByText("아직 메시지가 없어요")).toBeTruthy();
  });

  it("시트를 연 채 다음 낮 발표(dayAnnounce) view 로 바뀌면 시트가 문서에서 사라진다", () => {
    const r = scene(makeView());
    fireEvent.click(quickBtn());
    expect(dialog("빠른 메시지")).not.toBeNull();
    r.rerender(makeView({ phase: "dayAnnounce", n: 2 }));
    expect(dialog("빠른 메시지")).toBeNull();
    expect(screen.queryByRole("log")).toBeNull();
  });

  it("프레임의 알 수 없는 text 필드와 HTML 은 그려지지 않는다, 닉네임은 텍스트로만 (T-02-31)", () => {
    const ev = emitter();
    const base = makeView();
    const evil = { ...base, players: base.players.map((p) => (p.seat === 2 ? { ...p, nickname: "<img src=x>" } : p)) } satisfies RoomView;
    const r = scene(evil, { onEvent: ev.onEvent });
    ev.emit({ ...line(1, 2, 1, NOW), text: "<script>alert(1)</script>" } as unknown as RoomEvent);
    expect(r.container.querySelector("img[src=\"x\"]")).toBeNull();
    expect(r.container.querySelector("script")).toBeNull();
    expect(items()[0]?.querySelector(".mf-msglog__name")?.textContent).toBe("<img src=x>");
    expect(r.container.textContent).not.toContain("alert(1)");
    expect(r.container.querySelectorAll(".mf-bubble").length).toBe(0);
  });
});

describe("낮 토론 화면 — 채팅 세 줄 + 채팅 내역 모달 (결정 0017-6·0017-7, SPEC 하단·U-chat)", () => {
  const SEATS = [1, 2, 3, 0, 1]; // 하윤·민지·도현·나·하윤
  const send5 = (ev: ReturnType<typeof emitter>) => SEATS.forEach((seat, i) => ev.emit(line(i + 1, seat, 2, NOW)));
  const moreBtn = () => screen.getByRole("button", { name: "채팅 내역 크게 보기" });
  const history = () => dialog("채팅 내역");
  const nameOf = (el: Element) => el.querySelector(".mf-msglog__name")?.textContent ?? "";

  it("chat 이벤트 다섯 줄을 받으면 패널 로그(최근 채팅)에는 마지막 세 줄만 있고 마지막 줄만 밝다", () => {
    const ev = emitter();
    scene(makeView(), { onEvent: ev.onEvent });
    send5(ev);
    const rows = items();
    expect(rows.length).toBe(3);
    expect(rows.map(nameOf).join("|")).toBe("도현|나|하윤");
    expect(rows.map((el) => (el.classList.contains("mf-msglog__item--latest") ? "1" : "0")).join("")).toBe("001");
  });

  it("로그 오른쪽에 '채팅 내역 크게 보기' 버튼이 있다(메시지가 없어도)", () => {
    scene(makeView());
    expect(items().length).toBe(0);
    expect(moreBtn().getAttribute("type")).toBe("button");
    expect(moreBtn().querySelectorAll("svg").length).toBe(1);
    // 패널 로그 면(.mf-msglog) 안에 로그와 버튼이 함께 있다
    expect(moreBtn().parentElement?.classList.contains("mf-msglog")).toBe(true);
    expect(log().parentElement === moreBtn().parentElement).toBe(true);
  });

  it("그 버튼을 누르면 dialog[aria-label=채팅 내역] 이 열리고 제목 '채팅 내역', 받은 다섯 줄이 같은 줄 모양(점·이름·문장, 내 줄은 '나')으로 모두 있다", () => {
    const ev = emitter();
    scene(makeView(), { onEvent: ev.onEvent });
    send5(ev);
    expect(history()).toBeNull();
    fireEvent.click(moreBtn());
    const dlg = history()!;
    expect(dlg === null).toBe(false);
    expect(dlg.querySelector("h2")?.textContent).toBe("채팅 내역");
    const rows = [...dlg.querySelectorAll<HTMLElement>(".mf-msglog__item")];
    expect(rows.length).toBe(5);
    expect(rows.map(nameOf).join("|")).toBe("하윤|민지|도현|나|하윤");
    expect(rows.map((el) => (el.classList.contains("mf-msglog__item--latest") ? "1" : "0")).join("")).toBe("00001");
    const mine = rows[3]!.querySelector(".mf-msglog__name");
    expect(mine?.getAttribute("title")).toBe("지우");
    expect(rows[1]!.querySelector<HTMLElement>(".mf-msglog__dot")?.getAttribute("style")).toContain("--seat-3");
    expect(rows[1]!.querySelector(".mf-msglog__text")?.textContent).toBe("민지 의심돼요");
    expect(dlg.querySelector(".mf-sheet")?.classList.contains("mf-sheet--chat")).toBe(true);
    expect(dlg.querySelector('[aria-label="닫기"]') === null).toBe(false);
    expect(dlg.querySelector('ol[role="log"]')?.getAttribute("aria-label")).toBe("채팅 내역");
  });

  it("모달을 연 뒤 새 줄이 와도 같은 줄 모양으로 늘어나고, 닫으면 문서에서 사라진다", () => {
    const ev = emitter();
    scene(makeView(), { onEvent: ev.onEvent });
    ev.emit(line(1, 1, 2, NOW));
    fireEvent.click(moreBtn());
    ev.emit(line(2, 2, 1, NOW));
    expect(history()!.querySelectorAll(".mf-msglog__item").length).toBe(2);
    fireEvent.click(within(history()!).getByRole("button", { name: "닫기" }));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(history()).toBeNull();
  });

  it("줄이 없을 때 모달은 '아직 메시지가 없어요'", () => {
    scene(makeView());
    fireEvent.click(moreBtn());
    const dlg = history()!;
    expect(dlg.querySelectorAll(".mf-msglog__item").length).toBe(0);
    expect(within(dlg).getByText("아직 메시지가 없어요")).toBeTruthy();
  });

  it("모달을 연 채 다음 낮 시작 발표(dayAnnounce) view 로 바뀌면 모달이 문서에서 사라진다", () => {
    const r = scene(makeView());
    fireEvent.click(moreBtn());
    expect(history() === null).toBe(false);
    r.rerender(makeView({ phase: "dayAnnounce", n: 2 }));
    expect(history()).toBeNull();
  });

  it("모달 줄의 닉네임·문장은 텍스트로만 그려진다 (T-02-47)", () => {
    const ev = emitter();
    const base = makeView();
    const evil = { ...base, players: base.players.map((p) => (p.seat === 2 ? { ...p, nickname: "<img src=x>" } : p)) } satisfies RoomView;
    scene(evil, { onEvent: ev.onEvent });
    ev.emit({ ...line(1, 2, 1, NOW), text: "<script>alert(1)</script>" } as unknown as RoomEvent);
    fireEvent.click(moreBtn());
    const dlg = history()!;
    expect(dlg.querySelector('img[src="x"]')).toBeNull();
    expect(dlg.querySelector("script")).toBeNull();
    expect(nameOf(dlg.querySelector(".mf-msglog__item")!)).toBe("<img src=x>");
    expect(dlg.textContent).not.toContain("alert(1)");
  });

  it("CSS: .mf-msglog 는 night-700·모서리 --radius-md·여백 8px 4px 8px 16px, .mf-msglog__more 는 폭 44px, .mf-sheet--chat 높이 min(500px, 80dvh)", () => {
    const css = readFileSync("src/styles/day.css", "utf8");
    const rule = (sel: string): string => {
      const esc = sel.replace(/[.\[\]"=:()]/g, "\\$&");
      return new RegExp(`(?:^|\\})\\s*${esc}\\s*\\{([^}]*)\\}`, "m").exec(css)?.[1] ?? "";
    };
    expect(/background:\s*var\(--night-700\)/.test(rule(".mf-msglog"))).toBe(true);
    expect(/border-radius:\s*var\(--radius-md\)/.test(rule(".mf-msglog"))).toBe(true);
    expect(/padding:\s*8px 4px 8px 16px/.test(rule(".mf-msglog"))).toBe(true);
    expect(/width:\s*44px/.test(rule(".mf-msglog__more"))).toBe(true);
    expect(/height:\s*calc\(3 \* 1\.4 \* 14px \+ 2 \* var\(--space-xs\)\)/.test(rule(".mf-msglog__list"))).toBe(true);
    expect(/height:\s*min\(500px, 80dvh\)/.test(rule(".mf-sheet.mf-sheet--chat"))).toBe(true);
    expect(/background:\s*var\(--night-700\)/.test(rule(".mf-chatlog"))).toBe(true);
  });
});

describe("낮 토론 화면 — 이모티콘·합산 쿨다운·오류 (COMM-02·COMM-04, D-14·D-16)", () => {
  const emojiCells = () =>
    [...screen.getByRole("group", { name: "이모티콘" }).querySelectorAll<HTMLButtonElement>("button")];
  const advance = (ms: number) =>
    act(() => {
      vi.advanceTimersByTime(ms);
    });

  it("[이모티콘] → 트레이가 열리고, 좋아요 칸이 {t:emoji, icon:heart} 를 보내며 트레이는 열린 채 여덟 칸과 두 버튼이 꺼진다", () => {
    const r = scene(makeView());
    fireEvent.click(emojiBtn());
    expect(dialog("이모티콘")).not.toBeNull();
    expect(emojiCells().length).toBe(8);
    expect(emojiCells().every((c) => !c.disabled)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "좋아요" }));
    expect(r.conn.send).toHaveBeenCalledTimes(1);
    expect(r.conn.send).toHaveBeenCalledWith({ t: "emoji", icon: "heart" });
    expect(dialog("이모티콘")).not.toBeNull();
    expect(emojiCells().every((c) => c.disabled)).toBe(true);
    expect(quickBtn().disabled).toBe(true);
    expect(emojiBtn().disabled).toBe(true);
    // 꺼진 동안 눌러도 더 보내지 않는다
    fireEvent.click(screen.getByRole("button", { name: "웃음" }));
    expect(r.conn.send).toHaveBeenCalledTimes(1);
  });

  it("2000ms 뒤 트레이 칸과 두 버튼이 다시 켜진다", () => {
    scene(makeView());
    fireEvent.click(emojiBtn());
    fireEvent.click(screen.getByRole("button", { name: "좋아요" }));
    advance(1_999);
    expect(emojiCells().every((c) => c.disabled)).toBe(true);
    advance(1);
    expect(emojiCells().every((c) => !c.disabled)).toBe(true);
    expect(quickBtn().disabled).toBe(false);
    expect(emojiBtn().disabled).toBe(false);
  });

  it("메시지를 보낸 직후도 같은 2초 잠금이다(합산)", () => {
    scene(makeView());
    fireEvent.click(quickBtn());
    fireEvent.click(within(screen.getByRole("group", { name: "대상" })).getByRole("button", { name: "하윤" }));
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));
    advance(300); // 시트가 닫힌다
    expect(dialog("빠른 메시지")).toBeNull();
    expect(quickBtn().disabled).toBe(true);
    expect(emojiBtn().disabled).toBe(true);
    advance(1_700);
    expect(quickBtn().disabled).toBe(false);
    expect(emojiBtn().disabled).toBe(false);
  });

  it("서버 RATE_LIMITED 는 표시 없이 지금부터 2초 다시 잠근다", () => {
    const ev = emitter();
    scene(makeView(), { onEvent: ev.onEvent });
    expect(quickBtn().disabled).toBe(false);
    ev.emit({ t: "error", code: "RATE_LIMITED" });
    expect(quickBtn().disabled).toBe(true);
    expect(emojiBtn().disabled).toBe(true);
    expect(screen.queryByRole("status")).toBeNull();
    advance(1_999);
    expect(quickBtn().disabled).toBe(true);
    advance(1);
    expect(quickBtn().disabled).toBe(false);
  });

  it("보낸 뒤 1500ms 에 RATE_LIMITED 가 오면 그 시각부터 다시 2초 잠긴다", () => {
    const ev = emitter();
    scene(makeView(), { onEvent: ev.onEvent });
    fireEvent.click(emojiBtn());
    fireEvent.click(screen.getByRole("button", { name: "웃음" }));
    advance(1_500);
    ev.emit({ t: "error", code: "RATE_LIMITED" });
    advance(1_999);
    expect(emojiBtn().disabled).toBe(true);
    advance(1);
    expect(emojiBtn().disabled).toBe(false);
  });

  it("BAD_MESSAGE 는 토스트 '보내지 못했어요. 다시 시도해 주세요'(2초)를 띄운다", () => {
    const ev = emitter();
    scene(makeView(), { onEvent: ev.onEvent });
    ev.emit({ t: "error", code: "BAD_MESSAGE" });
    expect(screen.getByRole("status").textContent).toBe("보내지 못했어요. 다시 시도해 주세요");
    expect(screen.getByRole("status").className).toContain("mf-toast--top");
    advance(2_000);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("WRONG_PHASE·NOT_HOST 는 아무 표시도 하지 않고 잠그지도 않는다", () => {
    const ev = emitter();
    scene(makeView(), { onEvent: ev.onEvent });
    ev.emit({ t: "error", code: "WRONG_PHASE" });
    ev.emit({ t: "error", code: "NOT_HOST" });
    expect(screen.queryByRole("status")).toBeNull();
    expect(quickBtn().disabled).toBe(false);
  });

  it("emoji 이벤트(자리 3, 놀람) → 자리 3 머리 위 .mf-dt__emoji 와 보이지 않는 live 줄 '도현: 놀람', 2초 뒤 사라지고 로그에는 남지 않는다", () => {
    const ev = emitter();
    const r = scene(makeView(), { onEvent: ev.onEvent });
    ev.emit({ t: "emoji", seat: 3, icon: "surprised", at: NOW });
    expect(emojiOf(r.container, 3).length).toBe(1);
    expect(emojiOf(r.container, 0).length + emojiOf(r.container, 1).length + emojiOf(r.container, 2).length).toBe(0);
    const live = screen.getByText("도현: 놀람");
    expect(live.className).toContain("mf-sr-only");
    expect(live.getAttribute("aria-live")).toBe("polite");
    expect(items().length).toBe(0);
    advance(2_000);
    expect(r.container.querySelectorAll(".mf-dt__emoji").length).toBe(0);
  });

  it("끊긴 동안(canSend false)은 [빠른 메시지]·[이모티콘] 이 꺼진다", () => {
    scene(makeView(), { canSend: false });
    expect(quickBtn().disabled).toBe(true);
    expect(emojiBtn().disabled).toBe(true);
  });

  it("낮 화면 토스트는 타이머를 가리지 않도록 top 을 덮어쓴다(CSS)", () => {
    const css = readFileSync("src/styles/day.css", "utf8");
    expect(css).toMatch(/\.mf-dayscene[^{]*\.mf-toast--top\s*\{[^}]*space-3xl[^}]*\}/);
  });
});

describe("낮 토론 화면 — 말하기 한 줄 (결정 0017-6, SPEC 하단)", () => {
  it("말하기 줄에는 버튼이 둘뿐이다: [빠른 메시지](primary·compact, 아이콘 없음)와 [이모티콘](aria-label, compact, 아이콘 하나, 글자 없음)", () => {
    const r = scene(makeView());
    const talk = r.container.querySelector(".mf-discuss__talk")!;
    const buttons = [...talk.querySelectorAll("button")];
    expect(buttons.length).toBe(2);
    const [quick, emoji] = buttons as [HTMLButtonElement, HTMLButtonElement];
    expect(quick.textContent).toBe("빠른 메시지");
    expect(quick.classList.contains("mf-btn--primary") && quick.classList.contains("mf-btn--compact")).toBe(true);
    expect(quick.classList.contains("mf-discuss__quick")).toBe(true);
    expect(quick.querySelectorAll("svg").length).toBe(0);
    expect(emoji.getAttribute("aria-label")).toBe("이모티콘");
    expect(emoji.classList.contains("mf-btn--compact")).toBe(true);
    expect(emoji.classList.contains("mf-discuss__emoji")).toBe(true);
    expect(emoji.querySelectorAll("svg").length).toBe(1);
    expect(emoji.textContent).toBe("");
    // 말하기 줄 밖에 다른 버튼이 이 조작 부품에 없다(방장 줄·채팅 내역 별도 버튼 없음)
    expect(r.container.querySelectorAll(".mf-discuss button").length).toBe(2);
  });

  it("CSS: .mf-discuss__emoji 는 폭 var(--tap-min), .mf-discuss__quick 은 flex 1, .mf-discuss__host 규칙이 없다", () => {
    const css = readFileSync("src/styles/day.css", "utf8");
    const rule = (sel: string): string => {
      const esc = sel.replace(/[.\[\]"=:()]/g, "\\$&");
      return new RegExp(`(?:^|\\})\\s*${esc}\\s*\\{([^}]*)\\}`, "m").exec(css)?.[1] ?? "";
    };
    expect(/(^|[^-])width:\s*var\(--tap-min\)/.test(rule(".mf-discuss__emoji"))).toBe(true);
    expect(/flex:\s*1[;\s]/.test(rule(".mf-discuss__quick"))).toBe(true);
    expect(/gap:\s*var\(--space-sm\)/.test(rule(".mf-discuss__talk"))).toBe(true);
    expect(css.includes("mf-discuss__host")).toBe(false);
  });
});

describe("낮 토론 화면 — 방장 전용 줄 없음 (결정 0017-5, DAY-01)", () => {
  const advance = (ms: number) =>
    act(() => {
      vi.advanceTimersByTime(ms);
    });

  it("방장(me.isHost true)에게도 연장·넘기기 버튼이 없고(이름 '+30초 연장'·'넘기기'·'이미 연장했어요' 버튼 없음), 화면은 extend·skip 을 보내지 않는다 (결정 0017-5)", () => {
    const r = scene(makeView({ isHost: true }));
    const labels = [...r.container.querySelectorAll("button")].map((b) => b.textContent ?? "").join("|");
    expect(/\+30초 연장|넘기기|이미 연장했어요/.test(labels)).toBe(false);
    expect(r.container.querySelectorAll(".mf-discuss__host").length).toBe(0);
    expect(`${quickBtn().textContent}:${emojiBtn().getAttribute("aria-label")}`).toBe("빠른 메시지:이모티콘");
    fireEvent.click(quickBtn());
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    const sentTypes = (r.conn.send as ReturnType<typeof vi.fn>).mock.calls.map((c) => (c[0] as { t: string }).t);
    expect(sentTypes.filter((t) => t === "extend" || t === "skip").length).toBe(0);
  });

  it("view 가 바뀌어도 '방장이 30초를 늘렸어요' 토스트가 없다", () => {
    const r = scene(makeView({ isHost: true }));
    // 옛 서버가 보내던 연장 표시를 키로만 넣는다(타입 선언에 기대지 않는다)
    const old = makeView({ isHost: true, endsIn: 115_000, durationMs: 120_000 });
    r.rerender({ ...old, day: { ...old.day!, extendUsed: true } } as unknown as RoomView);
    advance(100);
    expect(screen.queryAllByRole("status").length).toBe(0);
    expect(r.container.textContent).not.toContain("30초를 늘렸어요");
  });
});
