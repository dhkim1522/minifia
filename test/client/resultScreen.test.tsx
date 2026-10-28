/// <reference types="node" />
import { readFileSync, readdirSync } from "node:fs";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { RoleId } from "../../shared/game/roles";
import type { GameWinner, RoomView, SummaryRow } from "../../shared/protocol";
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
    day: { n: 1, roles: ["mafia", "police", "citizen"], claimLog: [], voteLog: [] },
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
    expect(r.container.querySelector(".mf-dayscene__panel")).toBeNull();
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
