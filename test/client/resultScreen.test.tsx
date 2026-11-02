/// <reference types="node" />
import { readFileSync, readdirSync } from "node:fs";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { RoleId } from "../../shared/game/roles";
import type { GameWinner, RoomView, SummaryRow, VoteLogEntry } from "../../shared/protocol";
import type { RoomConnection } from "../../src/net/useRoomConnection";

// RoomScreen 의 연결 훅만 가짜로 바꾼다(execIntro.test.tsx 와 같은 방식). 서버와는 view 픽스처로만 만난다.
const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));
const { RoomScreen } = await import("../../src/screens/RoomScreen");

// 결과 화면(04-25, END-01·END-02, D-17·D-18): ended + result 면 모든 viewer 가 같은 화면. 헤더 바·타이머·하단 패널이 없다.

const NOW = 1_700_000_000_000;
const NAMES = ["지우", "하윤", "민지", "도현", "서연", "수빈", "하준", "지호"];

interface Opts {
  count?: number;
  winner?: GameWinner;
  /** 탈락한 자리들(players[].alive false) */
  dead?: number[];
  /** 내 자리 */
  me?: number;
  /** 직업표. 기본: 0 시민 · 1 경찰 · 2 의사 · 3 마피아 · 4 시민 · 5 마피아 · 6 시민 · 7 시민 */
  jobs?: RoleId[];
  summary?: SummaryRow[];
  withResult?: boolean;
  connected?: boolean;
  spectate?: boolean;
  nicknames?: string[];
  voteLog?: VoteLogEntry[];
}

const DEFAULT_JOBS: RoleId[] = ["citizen", "police", "doctor", "mafia", "citizen", "mafia", "citizen", "citizen"];

function makeView(o: Opts = {}): RoomView {
  const count = o.count ?? 5;
  const names = o.nicknames ?? NAMES;
  const jobs = o.jobs ?? DEFAULT_JOBS;
  const dead = o.dead ?? [2];
  const me = o.me ?? 0;
  const summary: SummaryRow[] = o.summary ?? [
    { n: 1, exec: { yes: 3, no: 1, passed: true, candidate: 3 }, night: { target: 2, died: true } },
  ];
  const seats = Array.from({ length: count }, (_, seat) => ({ seat, job: jobs[seat]! }));
  return {
    code: "0042",
    phase: "ended",
    phaseEndsAt: null,
    phaseDurationMs: null,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players: seats.map(({ seat }) => ({
      seat,
      nickname: names[seat]!,
      connected: seat === me ? (o.connected ?? true) : true,
      isHost: seat === 0,
      ...(dead.includes(seat) ? { alive: false } : {}),
    })),
    me: { seat: me, isHost: me === 0, role: jobs[me]! },
    day: { n: 1, roles: ["mafia", "police", "citizen"], voteLog: o.voteLog ?? [] },
    ...(o.spectate ? { spectate: { seats } } : {}),
    ...(o.withResult === false ? {} : { result: { winner: o.winner ?? "citizenWin", seats, summary } }),
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

function renderRoom(view: RoomView, over: Partial<RoomConnection> = {}, onExit = vi.fn()) {
  connectionMock.current = conn(view, over);
  const r = render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={onExit} />);
  const rerenderRoom = (v: RoomView, o: Partial<RoomConnection> = over) => {
    connectionMock.current = conn(v, o);
    r.rerender(<RoomScreen code="0042" token={"t".repeat(43)} onExit={onExit} />);
  };
  return { ...r, rerenderRoom, onExit };
}

const cards = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLElement>(".mf-result__card"));
const text = (el: Element | null | undefined) => el?.textContent ?? "";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("결과 화면 핵심 (END-01·END-02, D-17·D-18)", () => {
  it("ended + result 면 `연결 중…` 이 아니라 결과 화면: 제목 `게임 종료`, 시민 승 배너, 헤더 바·타이머·하단 패널 없음", () => {
    const r = renderRoom(makeView());
    expect(screen.queryByText("연결 중…")).toBeNull();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("게임 종료");
    const banner = r.container.querySelector<HTMLElement>(".mf-result__banner")!;
    expect(banner.dataset.winner).toBe("citizenWin");
    expect(text(banner.querySelector(".mf-result__banner-title"))).toBe("시민 팀 승리");
    expect(text(banner.querySelector(".mf-result__banner-sub"))).toBe("마피아가 모두 탈락했어요");
    expect(r.container.querySelector(".mf-phasebar")).toBeNull();
    expect(r.container.querySelector(".mf-timer")).toBeNull();
    expect(r.container.querySelector(".mf-dt")).toBeNull();
  });

  it("마피아 승이면 `마피아 팀 승리`·`마피아 수가 나머지 생존자 수와 같아졌어요`, 배너 data-winner=mafiaWin", () => {
    const r = renderRoom(makeView({ winner: "mafiaWin" }));
    const banner = r.container.querySelector<HTMLElement>(".mf-result__banner")!;
    expect(banner.dataset.winner).toBe("mafiaWin");
    expect(text(banner.querySelector(".mf-result__banner-title"))).toBe("마피아 팀 승리");
    expect(text(banner.querySelector(".mf-result__banner-sub"))).toBe("마피아 수가 나머지 생존자 수와 같아졌어요");
  });

  it("카드 5장: data-seat, 직업 그림(/characters/roles/), 이름표(점+닉네임), 직업 이름(ROLE_TEXT)", () => {
    const r = renderRoom(makeView());
    const list = cards(r.container);
    expect(list.map((c) => c.dataset.seat)).toEqual(["0", "1", "2", "3", "4"]);
    const roleNames = list.map((c) => text(c.querySelector(".mf-result__role")));
    expect(roleNames).toEqual(["시민", "경찰", "의사", "마피아", "시민"]);
    for (const c of list) {
      expect(c.querySelector("img")?.getAttribute("src")).toContain("/characters/roles/");
      expect(c.querySelector(".mf-result__tag .mf-dt__dot, .mf-result__tag i")).not.toBeNull();
    }
    expect(list.map((c) => text(c.querySelector(".mf-result__tag")))).toEqual(["지우", "하윤", "민지", "도현", "서연"]);
    expect(list[1]!.querySelector("img")?.getAttribute("src")).toContain("police");
    expect(list[3]!.querySelector("img")?.getAttribute("src")).toContain("mafia");
  });

  it("마피아 표시 클래스는 마피아 카드의 직업 이름에만 붙는다", () => {
    const r = renderRoom(makeView());
    const flagged = cards(r.container).filter((c) => c.querySelector(".mf-result__role--mafia"));
    expect(flagged.map((c) => c.dataset.seat)).toEqual(["3"]);
  });

  it("탈락 카드(players[].alive false): 그림에 흐림 클래스와 `탈락` 글자, 산 카드에는 없다. 연결 상태는 표시하지 않는다", () => {
    const r = renderRoom(makeView({ dead: [2], connected: false }));
    const list = cards(r.container);
    expect(list[2]!.querySelector("img")!.classList.contains("mf-result__art--dead")).toBe(true);
    expect(text(list[2]!.querySelector(".mf-result__out"))).toBe("탈락");
    for (const i of [0, 1, 3, 4]) {
      expect(list[i]!.querySelector(".mf-result__art--dead")).toBeNull();
      expect(list[i]!.querySelector(".mf-result__out")).toBeNull();
    }
    // 끊긴 내 카드도 흐려지지 않는다
    expect(r.container.querySelector(".mf-figure--disconnected")).toBeNull();
  });

  it("내 카드 이름표에만 내 표시 클래스", () => {
    const r = renderRoom(makeView({ me: 1 }));
    const mine = cards(r.container).filter((c) => c.querySelector(".mf-result__tag--me"));
    expect(mine.map((c) => c.dataset.seat)).toEqual(["1"]);
  });

  it("[처음으로] 를 누르면 onExit(\"left\") 가 한 번 불리고, 아래에 `이 방은 30분 뒤에 닫혀요`", () => {
    const r = renderRoom(makeView());
    const btn = screen.getByRole("button", { name: "처음으로" });
    expect(screen.getByText("이 방은 30분 뒤에 닫혀요")).toBeTruthy();
    fireEvent.click(btn);
    expect(r.onExit).toHaveBeenCalledTimes(1);
    expect(r.onExit).toHaveBeenCalledWith("left");
  });

  it("테스트 방 방장도 [테스트]·[역할 카드] 버튼이 없고 [처음으로] 만 있다", () => {
    const view = makeView();
    view.me = { ...view.me, isHost: true, testMode: true };
    renderRoom(view);
    expect(screen.queryByRole("button", { name: "테스트" })).toBeNull();
    expect(screen.queryByRole("button", { name: /역할 카드/ })).toBeNull();
    expect(screen.getByRole("button", { name: "처음으로" })).toBeTruthy();
  });

  it("result 가 없는 ended 프레임은 `연결 중…` 으로 안전하게 폴백하고 읽기용 안내는 `게임이 끝났습니다`", () => {
    const r = renderRoom(makeView({ withResult: false }));
    expect(screen.getByText("연결 중…")).toBeTruthy();
    expect(r.container.querySelector(".mf-result")).toBeNull();
    expect(r.container.querySelector(".mf-sr-only")?.textContent).toBe("게임이 끝났습니다");
  });

  it("읽기용 안내: 시민 승이면 `게임이 끝났습니다. 시민 팀 승리`, 마피아 승이면 마피아 팀", () => {
    const a = renderRoom(makeView());
    expect(a.container.querySelector(".mf-sr-only")?.textContent).toBe("게임이 끝났습니다. 시민 팀 승리");
    a.unmount();
    const b = renderRoom(makeView({ winner: "mafiaWin" }));
    expect(b.container.querySelector(".mf-sr-only")?.textContent).toBe("게임이 끝났습니다. 마피아 팀 승리");
  });

  it("모든 viewer 가 같은 화면: 살아 있던 viewer · 탈락 viewer(spectate 있음) · 끊긴 viewer 의 카드 집합과 문구가 같다", () => {
    const sig = (v: RoomView): string => {
      const r = renderRoom(v);
      const out = JSON.stringify({
        title: text(r.container.querySelector("h1")),
        banner: text(r.container.querySelector(".mf-result__banner")),
        cards: cards(r.container).map((c) => [c.dataset.seat, text(c.querySelector(".mf-result__role")), text(c.querySelector(".mf-result__out")), text(c.querySelector(".mf-result__tag"))]),
        sr: r.container.querySelector(".mf-sr-only")?.textContent,
      });
      r.unmount();
      return out;
    };
    const alive = sig(makeView({ me: 0 }));
    const deadViewer = sig(makeView({ me: 2, spectate: true }));
    const dropped = sig(makeView({ me: 0, connected: false }));
    const mafiaViewer = sig(makeView({ me: 3 }));
    expect(deadViewer).toBe(alive);
    expect(dropped).toBe(alive);
    expect(mafiaViewer).toBe(alive);
  });

  it("판이 끝나면 열려 있던 테스트 시트도 닫는다 — 열린 시트가 [처음으로] 를 가리지 않는다", () => {
    const before = makeView();
    before.phase = "execution";
    delete (before as { result?: unknown }).result;
    before.day = { ...before.day!, execution: { seat: 2, phrase: 0 } };
    before.me = { ...before.me, isHost: true, testMode: true };
    const r = renderRoom(before);
    fireEvent.click(screen.getByRole("button", { name: /테스트/ }));
    expect(r.container.querySelector("dialog")).not.toBeNull();
    const after = makeView();
    after.me = { ...after.me, isHost: true, testMode: true };
    r.rerenderRoom(after);
    expect(r.container.querySelector("dialog")).toBeNull();
    // 같은 접속의 전환이라 공개 연출이 돈다 — 900ms 뒤에 [처음으로] 가 열린다
    act(() => void vi.advanceTimersByTime(900));
    expect(screen.getByRole("button", { name: "처음으로" })).toBeTruthy();
  });

  it("판이 끝나면 열려 있던 역할 카드 시트를 닫는다", () => {
    const night = makeView();
    night.phase = "execution";
    delete (night as { result?: unknown }).result;
    night.day = { ...night.day!, execution: { seat: 2, phrase: 0 } };
    const r = renderRoom(night);
    fireEvent.click(screen.getByRole("button", { name: /역할 카드/ }));
    expect(r.container.querySelector("dialog")).not.toBeNull();
    r.rerenderRoom(makeView());
    expect(r.container.querySelector("dialog")).toBeNull();
  });
});

describe("결과(직업)는 ResultScreen 하나만 받는다 (T-04-64, D-09·D-17)", () => {
  const componentFiles = readdirSync("src/components").filter((f) => f.endsWith(".tsx"));

  it("src/components 의 어떤 파일도 `result` 를 props 이름으로 선언하지 않는다", () => {
    expect(componentFiles.length).toBeGreaterThan(10);
    for (const f of componentFiles) {
      const src = readFileSync(`src/components/${f}`, "utf8");
      // interface/type 안의 `result:`·`result?:`, 구조분해 `{ ..., result, ... }` 가 props 로 쓰이는 꼴
      expect(src, `${f} 의 props`).not.toMatch(/\bresult\??:\s*(GameResult|RoomView\["result"\])/);
      expect(src, `${f} 의 props`).not.toMatch(/\bresult:\s*GameResult/);
      expect(src, `${f} 의 GameResult 가져오기`).not.toMatch(/\bGameResult\b/);
    }
  });

  it("`result.seats` 를 읽는 소스는 ResultScreen 하나다", () => {
    const readers: string[] = [];
    const walk = (dir: string) => {
      for (const ent of readdirSync(dir, { withFileTypes: true })) {
        const p = `${dir}/${ent.name}`;
        if (ent.isDirectory()) walk(p);
        else if (/\.tsx?$/.test(ent.name) && /\bresult\??\.seats\b/.test(readFileSync(p, "utf8"))) readers.push(p);
      }
    };
    walk("src");
    expect(readers).toEqual(["src/screens/ResultScreen.tsx"]);
  });
});

describe("마크업 삽입 방지 (T-04-65)", () => {
  it("`<b>` 같은 닉네임도 평문으로 그려진다(요소가 생기지 않는다)", () => {
    const nicknames = ["<b>굵게</b>", "<i>x</i>", "민지", "도현", "서연", "수빈", "하준", "지호"];
    const r = renderRoom(makeView({ nicknames }));
    expect(r.container.querySelector(".mf-result b, .mf-result i:not(.mf-dt__dot):not(.mf-result__dot)")).toBeNull();
    expect(text(cards(r.container)[0]!.querySelector(".mf-result__tag"))).toBe("<b>굵게</b>");
  });
});

// act 를 쓰는 곳이 없어도 임포트를 지키는 보조(타이머 정리 확인)
describe("정리", () => {
  it("언마운트하면 남는 타이머가 없다", () => {
    const r = renderRoom(makeView());
    r.unmount();
    act(() => void vi.runOnlyPendingTimers());
    expect(vi.getTimerCount()).toBe(0);
  });
});


// ---- Task 2: 판 요약 카드·부제·스크롤·배경 크로스페이드 (D-17·D-27, UI-SPEC 11.1·11.3) ----
const summaryRows = (c: HTMLElement) =>
  Array.from(c.querySelectorAll<HTMLElement>(".mf-result__sm-row")).map((r) => [text(r.querySelector(".mf-result__sm-label")), text(r.querySelector(".mf-result__sm-text"))]);

describe("판 요약 카드 `이번 판 기록` (UI-SPEC 7.2·11.1)", () => {
  it("제목과 행: 앞 라벨 `{n}일차 낮|밤` + 본문, 일차 오름차순으로 낮 → 밤", () => {
    const summary: SummaryRow[] = [
      { n: 2, exec: { yes: 1, no: 2, passed: false }, night: { target: 1, died: true } },
      { n: 1, exec: { yes: 3, no: 1, passed: true, candidate: 3 }, night: { target: 2, died: true } },
    ];
    const voteLog: VoteLogEntry[] = [
      { n: 1, exec: { yes: 3, no: 1, passed: true }, cand: { votes: [{ seat: 0, target: 3 }, { seat: 1, target: 3 }, { seat: 2, target: 0 }], candidate: 3 } },
    ];
    const r = renderRoom(makeView({ summary, voteLog }));
    expect(text(r.container.querySelector(".mf-result__sm-title"))).toBe("이번 판 기록");
    expect(summaryRows(r.container)).toEqual([
      ["1일차 낮", "도현님 처형 (2표)"],
      ["1일차 밤", "민지님 사망"],
      ["2일차 낮", "처형 없음 (찬성 1 · 반대 2)"],
      ["2일차 밤", "하윤님 사망"],
    ]);
  });

  it("나머지 문구: 동률 · 던진 표 없음 · 의사가 지킴 · 지목 없음", () => {
    const summary: SummaryRow[] = [
      { n: 1, exec: { yes: 3, no: 1, passed: true }, night: { target: 1, died: false } },
      { n: 2, exec: { yes: 3, no: 1, passed: true }, night: { died: false } },
    ];
    const voteLog: VoteLogEntry[] = [
      { n: 1, exec: { yes: 3, no: 1, passed: true }, cand: { votes: [{ seat: 0, target: 3 }, { seat: 1, target: 4 }] } },
      { n: 2, exec: { yes: 3, no: 1, passed: true }, cand: { votes: [] } },
    ];
    const r = renderRoom(makeView({ summary, voteLog }));
    expect(summaryRows(r.container)).toEqual([
      ["1일차 낮", "처형 없음 (동률)"],
      ["1일차 밤", "하윤님을 노렸지만 의사가 지켰어요"],
      ["2일차 낮", "처형 없음 (던진 표 없음)"],
      ["2일차 밤", "아무 일도 없었어요"],
    ]);
  });

  it("요약 행이 없으면 요약 카드와 부제를 그리지 않는다", () => {
    const r = renderRoom(makeView({ summary: [] }));
    expect(r.container.querySelector(".mf-result__sm")).toBeNull();
    expect(r.container.querySelector(".mf-result__sub")).toBeNull();
  });

  it("부제: 요약 마지막 줄에 night 가 있으면 `{n}일차 밤`, 없으면 `{n}일차 낮`", () => {
    const a = renderRoom(makeView({ summary: [{ n: 1, exec: { yes: 1, no: 2, passed: false } }, { n: 2, exec: { yes: 3, no: 0, passed: true, candidate: 3 }, night: { target: 1, died: true } }] }));
    expect(text(a.container.querySelector(".mf-result__sub"))).toBe("2일차 밤");
    a.unmount();
    const b = renderRoom(makeView({ summary: [{ n: 1, exec: { yes: 1, no: 2, passed: false }, night: { died: false } }, { n: 2, exec: { yes: 3, no: 0, passed: true, candidate: 3 } }] }));
    expect(text(b.container.querySelector(".mf-result__sub"))).toBe("2일차 낮");
  });

  it("`<b>` 닉네임이 요약 문장에도 평문이다(T-04-65)", () => {
    const nicknames = ["<b>굵게</b>", "하윤", "민지", "도현", "서연", "수빈", "하준", "지호"];
    const r = renderRoom(makeView({ nicknames, summary: [{ n: 1, exec: { yes: 3, no: 1, passed: true, candidate: 0 }, night: { target: 0, died: true } }] }));
    expect(r.container.querySelector(".mf-result__sm b")).toBeNull();
    expect(summaryRows(r.container)[1]![1]).toBe("<b>굵게</b>님 사망");
  });
});

describe("8명·긴 요약: 스크롤로 [처음으로] 에 닿는다 (P-2)", () => {
  const long: SummaryRow[] = [1, 2, 3].map((n) => ({ n, exec: { yes: 1, no: 2, passed: false }, night: { target: 1, died: true } }));
  it("8장 카드와 요약 6행, [처음으로] 는 스크롤 본문(.mf-result) 안에 있고 헤더 바·하단 패널은 없다", () => {
    const r = renderRoom(makeView({ count: 8, dead: [1, 2, 3], summary: long }));
    expect(cards(r.container).length).toBe(8);
    expect(summaryRows(r.container).length).toBe(6);
    const btn = screen.getByRole("button", { name: "처음으로" });
    expect(btn.closest(".mf-result")).not.toBeNull();
    expect(r.container.querySelector(".mf-phasebar")).toBeNull();
  });
});

describe("배경 크로스페이드 (UI-SPEC 11.2, P-2)", () => {
  const arts = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLElement>(".mf-backdrop__art")).map((a) => a.dataset.scene);
  const executionView = (): RoomView => {
    const v = makeView();
    v.phase = "execution";
    delete (v as { result?: unknown }).result;
    v.day = { ...v.day!, candidate: 3, execution: { seat: 3, phrase: 0 } };
    return v;
  };

  it("같은 접속에서 execution → ended 로 오면 직전 장면(dusk)에서 night 로 크로스페이드한다", () => {
    const r = renderRoom(executionView());
    r.rerenderRoom(makeView());
    expect(arts(r.container).sort()).toEqual(["dusk", "night"]);
  });

  it("morning 에서 와도 직전 장면(morning)에서 이어진다", () => {
    const v = executionView();
    v.phase = "morning";
    v.day = { ...v.day!, morning: { eliminated: 2 } as never };
    const r = renderRoom(v);
    r.rerenderRoom(makeView());
    expect(arts(r.container).sort()).toEqual(["morning", "night"]);
  });

  it("처음 마운트·재접속(arrivedFrom 없음)이면 night 한 장만 즉시", () => {
    const r = renderRoom(makeView());
    expect(arts(r.container)).toEqual(["night"]);
  });

  it("에포크가 바뀐 재접속은 직전 단계를 잇지 않는다", () => {
    const r = renderRoom(executionView());
    r.rerenderRoom(makeView(), { epoch: 2 });
    expect(arts(r.container)).toEqual(["night"]);
  });
});

describe("result.css 정적 단언 (happy-dom 은 레이아웃을 재지 못한다)", () => {
  const css = readFileSync("src/styles/result.css", "utf8");
  const rule = (sel: string): string => {
    const m = css.match(new RegExp(`${sel.replace(/[.\[\]="]/g, "\\$&")}\\s*\\{([^}]*)\\}`));
    return m?.[1] ?? "";
  };

  it("스크롤 본문: overflow-y auto · overflow-x hidden · overscroll-behavior contain", () => {
    const body = rule(".mf-result");
    expect(body).toMatch(/overflow-y:\s*auto/);
    expect(body).toMatch(/overflow-x:\s*hidden/);
    expect(body).toMatch(/overscroll-behavior:\s*contain/);
  });

  it("격자는 3열(repeat(3, minmax(0, 1fr))) 간격 8, 카드는 min-width 0", () => {
    const grid = rule(".mf-result__grid");
    expect(grid).toMatch(/grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(grid).toMatch(/gap:\s*var\(--space-sm\)/);
    expect(rule(".mf-result__card")).toMatch(/min-width:\s*0/);
  });

  it("글자 크기는 14·16·24·36 만, 색 직접 지정(#)이 없고 진홍은 배너·마피아 글자에만", () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    const sizes = new Set([...css.matchAll(/font-size:\s*(\d+)px/g)].map((m) => Number(m[1])));
    for (const n of sizes) expect([14, 16, 24, 36]).toContain(n);
    const crimsonRules = [...css.matchAll(/([^{}]+)\{[^}]*crimson[^}]*\}/g)].map((m) => m[1]!.trim());
    for (const sel of crimsonRules) expect(sel).toMatch(/banner|band|role--mafia|glow/);
  });

  it("닉네임 말줄임 없음: 이름표에 text-overflow 가 없고, 5글자 이름표 폭(99)이 360 폰 카드 폭(104) 안에 든다", () => {
    expect(rule(".mf-result__tag")).not.toMatch(/text-overflow|overflow:\s*hidden/);
    // 이름표 = 테두리 2 + 안쪽 7+8 + 점 8 + 간격 4 + 글자 5×14
    const tagW = 2 + 7 + 8 + 8 + 4 + 5 * 14;
    expect(tagW).toBe(99);
    // 360 폰: 좌우 16 → 격자 328, 간격 8 두 개 → 카드 (328 − 16)/3 = 104
    const cardW = (360 - 2 * 16 - 2 * 8) / 3;
    expect(cardW).toBe(104);
    expect(tagW).toBeLessThanOrEqual(cardW - 2);
  });

  it("스크롤 본문 아래 여백은 24 + 안전 영역, 배경은 스크롤해도 고정(글로우는 본문 밖 형제)", () => {
    expect(rule(".mf-result__inner")).toMatch(/padding:[^;]*var\(--space-lg\)[^;]*safe-area-inset-bottom/);
    expect(css).toMatch(/\.mf-result__glow\s*\{[^}]*position:\s*absolute/);
  });

  it("요약 카드: night-800 92% · 모서리 14 · 라벨 열 64px · 행 간격 4", () => {
    expect(rule(".mf-result__sm")).toMatch(/border-radius:\s*var\(--radius-md\)/);
    expect(rule(".mf-result__sm")).toMatch(/night-800/);
    expect(rule(".mf-result__sm-label")).toMatch(/width:\s*64px/);
    expect(rule(".mf-result__sm")).toMatch(/gap:\s*var\(--space-xs\)/);
  });
});

// ---- 04-26 Task 1·2: 결과 공개 연출 neutral → flip → done (D-17, UI-SPEC 11.2) ----
describe("결과 공개 연출 상태기계 (D-17, UI-SPEC 11.2)", () => {
  const stageOf = (c: HTMLElement) => c.querySelector<HTMLElement>(".mf-result")!.dataset.stage;
  const neutralImgs = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLImageElement>(".mf-result__neutral"));
  const roleImgs = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLImageElement>(".mf-result__art"));
  const rises = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLElement>(".mf-result__rise"));
  const execView = (): RoomView => {
    const v = makeView();
    v.phase = "execution";
    delete (v as { result?: unknown }).result;
    v.day = { ...v.day!, candidate: 3, execution: { seat: 3, phrase: 0 } };
    return v;
  };
  const morningView = (): RoomView => {
    const v = execView();
    v.phase = "morning";
    v.day = { ...v.day!, morning: { eliminated: 2 } as never };
    return v;
  };
  /** 같은 접속에서 from 단계 → ended 로 넘어온 렌더 */
  const arrive = (from: "execution" | "morning" = "execution", opts: Opts = {}) => {
    const r = renderRoom(from === "execution" ? execView() : morningView());
    r.rerenderRoom(makeView(opts));
    return r;
  };
  const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
  /** fn 이 거는 setTimeout 의 지연들. 연출 타이머는 300·900 이다(배경 크로스페이드 등 다른 타이머와 구분) */
  const delaysOf = (fn: () => void): number[] => {
    const spy = vi.spyOn(globalThis, "setTimeout");
    fn();
    const delays = spy.mock.calls.map((c) => Number(c[1] ?? 0));
    spy.mockRestore();
    return delays;
  };

  afterEach(() => vi.unstubAllGlobals());

  it("t=0: stage neutral — 카드에는 중립 인물·이름표만, 직업 이름·탈락·요약·[처음으로] 는 숨김", () => {
    const r = arrive("execution");
    expect(stageOf(r.container)).toBe("neutral");
    const neutrals = neutralImgs(r.container);
    expect(neutrals.length).toBe(5);
    for (const img of neutrals) expect(img.getAttribute("src")).toContain("/table/");
    for (const c of cards(r.container)) {
      expect(c.querySelector(".mf-result__role")?.getAttribute("aria-hidden")).toBe("true");
      expect(c.querySelector(".mf-result__tag")).not.toBeNull();
    }
    expect(r.container.querySelector(".mf-result__out")?.getAttribute("aria-hidden")).toBe("true");
    expect(rises(r.container).length).toBe(2);
    for (const el of rises(r.container)) expect(el.getAttribute("aria-hidden")).toBe("true");
    expect((screen.getByRole("button", { name: "처음으로", hidden: true }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("t=299 는 아직 neutral, t=300 에 모든 카드가 같은 순간 flip(직업 이름·탈락 표시)", () => {
    const r = arrive("execution");
    advance(299);
    expect(stageOf(r.container)).toBe("neutral");
    advance(1);
    expect(stageOf(r.container)).toBe("flip");
    // 한꺼번에: 카드마다 다른 지연·순서 표시가 없다
    for (const c of cards(r.container)) {
      expect(c.getAttribute("style")).toBeNull();
      expect(c.querySelector(".mf-result__role")?.getAttribute("aria-hidden")).toBeNull();
    }
    expect(r.container.querySelector(".mf-result__out")?.getAttribute("aria-hidden")).toBeNull();
    // flip 동안은 중립 층이 남아 있다(크로스페이드)
    expect(neutralImgs(r.container).length).toBe(5);
    // 요약·버튼은 아직 숨김
    for (const el of rises(r.container)) expect(el.getAttribute("aria-hidden")).toBe("true");
  });

  it("t=899 는 아직 flip, t=900 에 done: 요약·[처음으로] 표시, 중립 층 제거, 버튼 눌림", () => {
    const r = arrive("execution");
    advance(899);
    expect(stageOf(r.container)).toBe("flip");
    fireEvent.click(screen.getByRole("button", { name: "처음으로", hidden: true }));
    expect(r.onExit).not.toHaveBeenCalled();
    advance(1);
    expect(stageOf(r.container)).toBe("done");
    expect(neutralImgs(r.container).length).toBe(0);
    for (const el of rises(r.container)) expect(el.getAttribute("aria-hidden")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "처음으로" }));
    expect(r.onExit).toHaveBeenCalledTimes(1);
    expect(r.onExit).toHaveBeenCalledWith("left");
  });

  it("done 의 모습은 04-25 의 최종 상태와 같다(직업 그림·이름·탈락·요약)", () => {
    const r = arrive("execution");
    advance(900);
    const list = cards(r.container);
    expect(list.map((c) => text(c.querySelector(".mf-result__role")))).toEqual(["시민", "경찰", "의사", "마피아", "시민"]);
    expect(text(list[2]!.querySelector(".mf-result__out"))).toBe("탈락");
    expect(roleImgs(r.container).length).toBe(5);
    expect(r.container.querySelector(".mf-result__sm")).not.toBeNull();
  });

  it("morning → ended 도 같은 연출이 돈다", () => {
    const r = arrive("morning");
    expect(stageOf(r.container)).toBe("neutral");
    advance(300);
    expect(stageOf(r.container)).toBe("flip");
    advance(600);
    expect(stageOf(r.container)).toBe("done");
  });

  it("연출 중 같은 result 가 다시 와도 stage 가 되돌아가지 않고 타이머가 늘지 않는다", () => {
    const r = arrive("execution");
    expect(vi.getTimerCount()).toBeGreaterThanOrEqual(2);
    advance(300);
    expect(stageOf(r.container)).toBe("flip");
    const again = delaysOf(() => r.rerenderRoom(makeView()));
    expect(again).not.toContain(300);
    expect(again).not.toContain(900);
    expect(stageOf(r.container)).toBe("flip");
    advance(600);
    expect(stageOf(r.container)).toBe("done");
    const late = delaysOf(() => r.rerenderRoom(makeView()));
    expect(stageOf(r.container)).toBe("done");
    expect(late).not.toContain(300);
    expect(late).not.toContain(900);
  });

  it("재접속·처음 마운트(arrivedFrom 없음)는 곧바로 done: 중립 층이 없다", () => {
    let r!: ReturnType<typeof renderRoom>;
    const delays = delaysOf(() => void (r = renderRoom(makeView())));
    expect(stageOf(r.container)).toBe("done");
    expect(neutralImgs(r.container).length).toBe(0);
    expect(r.container.querySelector(".mf-result__role")?.getAttribute("aria-hidden")).toBeNull();
    expect(delays).not.toContain(300);
    expect(delays).not.toContain(900);
    expect(r.container.querySelector(".mf-result")!.getAttribute("data-reveal")).toBe("false");
  });

  it("에포크가 바뀐 재접속으로 ended 를 받으면 연출 없이 done", () => {
    const r = renderRoom(execView());
    r.rerenderRoom(makeView(), { epoch: 2 });
    expect(stageOf(r.container)).toBe("done");
    expect(neutralImgs(r.container).length).toBe(0);
  });

  it("모션 줄이기: 같은 접속 전환이어도 곧바로 done, 타이머 없음", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} }));
    let r!: ReturnType<typeof arrive>;
    const delays = delaysOf(() => void (r = arrive("execution")));
    expect(stageOf(r.container)).toBe("done");
    expect(neutralImgs(r.container).length).toBe(0);
    expect(delays).not.toContain(300);
    expect(delays).not.toContain(900);
  });

  it("execution·morning 이외 단계에서 온 ended 도 예외 없이 최종 상태(done)를 그린다", () => {
    const night = execView();
    night.phase = "night";
    const r = renderRoom(night);
    r.rerenderRoom(makeView());
    expect(stageOf(r.container)).toBe("done");
    expect(neutralImgs(r.container).length).toBe(0);
    expect(cards(r.container).length).toBe(5);
  });

  it("마피아 승 연출 시작에는 진홍 번짐이 reveal 표시로 페이드인, 시민 승에는 번짐이 없다", () => {
    const m = arrive("execution", { winner: "mafiaWin" });
    const glow = m.container.querySelector<HTMLElement>(".mf-result__glow")!;
    expect(glow).not.toBeNull();
    expect(glow.dataset.reveal).toBe("true");
    m.unmount();
    const c = arrive("execution", { winner: "citizenWin" });
    expect(c.container.querySelector(".mf-result__glow")).toBeNull();
    c.unmount();
    // 재접속이면 번짐은 있되 페이드인 표시는 없다
    const re = renderRoom(makeView({ winner: "mafiaWin" }));
    expect(re.container.querySelector<HTMLElement>(".mf-result__glow")!.dataset.reveal).toBe("false");
  });

  it("언마운트하면 타이머 둘이 정리되어 이후 상태 갱신·경고가 없다 (T-04-66)", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = arrive("execution");
    expect(vi.getTimerCount()).toBeGreaterThanOrEqual(2);
    r.unmount();
    expect(vi.getTimerCount()).toBe(0);
    advance(2000);
    expect(err).not.toHaveBeenCalled();
    err.mockRestore();
  });

  it("ended 화면은 낮 장면과 다른 DOM 노드로 새로 마운트된다 — 이전 투표 카드·층이 남지 않는다", () => {
    const r = renderRoom(execView());
    const dayScene = r.container.querySelector("[data-game-stage]");
    expect(dayScene).not.toBeNull();
    r.rerenderRoom(makeView());
    expect(r.container.querySelector("[data-game-stage]")).toBeNull();
    expect(dayScene!.isConnected).toBe(false);
    expect(r.container.querySelector(".mf-verdict, .mf-defense, .mf-exec")).toBeNull();
  });
});

describe("result.css 공개 연출 정적 단언 (04-26)", () => {
  const css = readFileSync("src/styles/result.css", "utf8");
  it("단계별 규칙: 배너 팝·번짐 페이드·카드 팝(scale)·떠오름 키프레임이 있고 시간은 verdict.ts 상수와 같다", () => {
    expect(css).toMatch(/@keyframes mf-result-banner-pop/);
    expect(css).toMatch(/@keyframes mf-result-glow-in/);
    expect(css).toMatch(/@keyframes mf-result-card-pop/);
    expect(css).toMatch(/@keyframes mf-result-rise/);
    expect(css).toMatch(/\[data-stage="neutral"\]/);
    expect(css).toMatch(/\[data-stage="flip"\]/);
    expect(css).toMatch(/360ms/);
    expect(css).toMatch(/600ms/);
    expect(css).toMatch(/300ms/);
    expect(css).toMatch(/scale:\s*1\.06/);
    expect(css).toMatch(/translateY\(8px\)/);
  });
  it("전이·애니메이션은 opacity·transform·scale 만 쓴다(레이아웃 속성 없음)", () => {
    const props = [...css.matchAll(/transition(?:-property)?:\s*([^;]+);/g)].map((m) => m[1]!);
    for (const p of props) expect(p).not.toMatch(/\b(width|height|top|left|margin|padding)\b/);
  });
  it("새 색 직접 지정이 없고 진홍은 번짐·배너·마피아 글자에만", () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
