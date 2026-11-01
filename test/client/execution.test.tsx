/// <reference types="node" />
import { readFileSync } from "node:fs";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { RoomView } from "../../shared/protocol";
import type { RoomConnection } from "../../src/net/useRoomConnection";
import { VERDICT_BLUR_PX, VERDICT_DIM_PERCENT, VERDICT_TEXT } from "../../src/game/verdict";

// RoomScreen 의 연결 훅만 가짜로 바꾼다(defense.test.tsx 와 같은 방식). 서버와는 view 픽스처로만 만난다.
const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));
const { RoomScreen } = await import("../../src/screens/RoomScreen");

// 처형(execution) 04-23: 후보가 변론 자리에 그대로 있다가 유령이 되고 앰버 카드가 뜬다. 직업은 어디에도 보이지 않는다(D-09).

const NOW = 1_700_000_000_000;
const NAMES = ["지우", "하윤", "민지", "도현", "서연", "다온"];

interface Opts {
  me?: number;
  count?: number;
  phase?: RoomView["phase"];
  phrase?: number;
  /** 처형 발표 없이 후보만(서버 이상) */
  noExecution?: boolean;
  dead?: number[];
  mafia?: number[];
  endsIn?: number;
  candidate?: number;
  /** 탈락한 viewer 의 관전 화면에서 다른 자리의 직업 */
  spectateJobs?: Array<{ seat: number; job: "mafia" | "police" | "doctor" | "citizen" }>;
}

function makeView(o: Opts = {}): RoomView {
  const count = o.count ?? 4;
  const me = o.me ?? 0;
  const candidate = o.candidate ?? 2;
  const phase = o.phase ?? "execution";
  const dead = phase === "execution" ? [...new Set([...(o.dead ?? []), candidate])] : (o.dead ?? []);
  const view: RoomView = {
    code: "0042",
    phase,
    phaseEndsAt: NOW + (o.endsIn ?? 5_000),
    phaseDurationMs: 5_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players: Array.from({ length: count }, (_, seat) => ({
      seat,
      nickname: NAMES[seat] ?? `사람${seat}`,
      connected: true,
      isHost: seat === 0,
      ...(dead.includes(seat) ? { alive: false } : {}),
    })),
    me: { seat: me, isHost: me === 0, role: o.mafia ? "mafia" : "citizen" },
    day: {
      n: 1,
      roles: ["mafia", "police", "citizen"],
      candidate,
      ...(phase === "execution" && !o.noExecution ? { execution: { seat: candidate, phrase: o.phrase ?? 2 } } : {}),
    },
  };
  if (o.mafia && !dead.includes(me)) view.me.allies = o.mafia.filter((s) => s !== me);
  if (dead.includes(me)) {
    const jobs = o.spectateJobs ?? o.mafia?.map((seat) => ({ seat, job: "mafia" as const })) ?? [];
    view.spectate = { seats: jobs };
  }
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

function renderRoom(view: RoomView, over: Partial<RoomConnection> = {}) {
  connectionMock.current = conn(view, over);
  const r = render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
  const rerenderRoom = (v: RoomView, o: Partial<RoomConnection> = over) => {
    connectionMock.current = conn(v, o);
    r.rerender(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
  };
  return { ...r, rerenderRoom };
}

const panelOf = (c: HTMLElement) => c.querySelector<HTMLElement>(".mf-dayscene__panel")!;
const seatOf = (c: HTMLElement, n: number) => c.querySelector<HTMLElement>(`.mf-dt__seat[data-seat="${n}"]`)!;
const imgsOf = (c: HTMLElement, n: number) => Array.from(seatOf(c, n).querySelectorAll<HTMLImageElement>("img.mf-figure"));
const haloSeats = (c: HTMLElement, kind: "white" | "crimson") =>
  Array.from(c.querySelectorAll<HTMLElement>(`img.mf-figure--halo-${kind}`))
    .map((img) => img.closest<HTMLElement>(".mf-dt__seat")!.dataset.seat)
    .join(",");
const announce = (c: HTMLElement) => c.querySelector<HTMLElement>(".mf-room > p.mf-sr-only[aria-live]")?.textContent;
const card = (c: HTMLElement) => c.querySelector<HTMLElement>(".mf-morningcard");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("execution 화면 한 경로 (VOTE-04, END-01, D-06·D-11·D-16)", () => {
  it("헤더 `낮 · 처형`/`1일차`, 후보는 가운데 z 31·흰 후광 하나·어둡게 층 하나·원뿔 하나, 이름표 탈락 표시, `연결 중…` 아님", () => {
    const { container } = renderRoom(makeView());
    expect(screen.queryByText("연결 중…")).toBeNull();
    expect(screen.queryByRole("heading", { name: "낮 · 처형" })).not.toBeNull();
    expect(container.querySelector(".mf-phasebar__do")?.textContent).toBe("1일차");
    expect(container.querySelector(".mf-dayscene")?.classList.contains("mf-dayscene--verdict")).toBe(true);
    expect(seatOf(container, 2).style.zIndex).toBe("31");
    expect(haloSeats(container, "white")).toBe("2");
    expect(container.querySelectorAll('img[class*="mf-figure--halo"]').length).toBe(1);
    expect(container.querySelectorAll(".mf-dt__dim--verdict").length).toBe(1);
    expect(container.querySelectorAll(".mf-dt__cone").length).toBe(1);
    const tag = container.querySelector<HTMLElement>('.mf-dt__tag[data-seat="2"]')!;
    expect(tag.classList.contains("mf-dt__tag--dead")).toBe(true);
    expect(tag.style.zIndex).toBe("32");
    const dim = container.querySelector<HTMLElement>(".mf-dt__dim--verdict")!;
    expect(dim.style.getPropertyValue("--mf-verdict-dim")).toBe(`${VERDICT_DIM_PERCENT}%`);
    expect(dim.style.getPropertyValue("--mf-verdict-blur")).toBe(`${VERDICT_BLUR_PX}px`);
  });

  it("앰버 처형 카드: 제목 `민지님이 형장의 이슬이 되었습니다`(phrase 2)·부제 `처형이 집행됐어요`, 장면 상자 안, 앰버·장면 변형 클래스, 안내문도 같은 문장", () => {
    const { container } = renderRoom(makeView());
    const c = card(container)!;
    expect(container.querySelectorAll(".mf-morningcard").length).toBe(1);
    expect(c.querySelector(".mf-morningcard__t")?.textContent).toBe("민지님이 형장의 이슬이 되었습니다");
    expect(c.querySelector(".mf-morningcard__s")?.textContent).toBe(VERDICT_TEXT.executionCardSub);
    expect(c.querySelector(".mf-morningcard__s")?.textContent).toBe("처형이 집행됐어요");
    expect(c.classList.contains("mf-morningcard--amber")).toBe(true);
    expect(c.classList.contains("mf-morningcard--scene")).toBe(true);
    expect(c.parentElement?.classList.contains("mf-dayscene__scene")).toBe(true);
    expect(announce(container)).toBe("민지님이 형장의 이슬이 되었습니다");
  });

  it("문구 번호가 범위 밖이면 첫 문구를 쓴다(카드·안내 모두)", () => {
    const { container } = renderRoom(makeView({ phrase: 9 }));
    expect(card(container)!.querySelector(".mf-morningcard__t")?.textContent).toBe("민지님이 더는 함께할 수 없게 되었습니다");
    expect(announce(container)).toBe("민지님이 더는 함께할 수 없게 되었습니다");
  });

  it("카드 퇴장 지연은 exitDelayOf(남은 시간): 5000ms → 4700ms, 2000ms 남은 중간 합류 → 1700ms", () => {
    const a = renderRoom(makeView());
    expect(card(a.container)!.style.getPropertyValue("--mf-morning-exit-delay")).toBe("4700ms");
    cleanup();
    const b = renderRoom(makeView({ endsIn: 2_000 }));
    expect(card(b.container)!.style.getPropertyValue("--mf-morning-exit-delay")).toBe("1700ms");
  });

  it("퇴장 지연은 마감 시각이 바뀔 때만 다시 정한다: 시간이 흐른 뒤 같은 마감으로 다시 그려도 값이 그대로다", () => {
    const r = renderRoom(makeView());
    act(() => void vi.advanceTimersByTime(1_500));
    r.rerenderRoom(makeView());
    expect(card(r.container)!.style.getPropertyValue("--mf-morning-exit-delay")).toBe("4700ms");
  });
});

describe("execution 하단 (P-10, VOTE-04)", () => {
  const cases: Array<[string, Opts]> = [
    ["살아 있는 viewer", { me: 0 }],
    ["탈락한 viewer(관전)", { me: 1, dead: [1] }],
    ["처형된 본인", { me: 2 }],
  ];
  for (const [name, o] of cases) {
    it(`${name}: NightPanel 제목 \`처형이 끝났어요\` + 안내 \`곧 다음으로 넘어가요\`, 입구(버튼·입력)가 없다`, () => {
      const { container } = renderRoom(makeView(o));
      const p = panelOf(container);
      expect(p.querySelector("h2")?.textContent).toBe("처형이 끝났어요");
      expect(p.querySelector(".mf-claimpanel__guide")?.textContent).toBe("곧 다음으로 넘어가요");
      expect(p.querySelectorAll("button, input, textarea, .mf-ro").length).toBe(0);
      expect(p.textContent).not.toContain("밤이 시작");
    });
  }

  it("서버 이상(처형 발표도 후보도 없음): 멈추지 않고 같은 하단, 카드·후보 무대 없이 안내 `처형`", () => {
    const view = makeView({ noExecution: true });
    delete view.day!.candidate;
    const { container } = renderRoom(view);
    expect(panelOf(container).querySelector("h2")?.textContent).toBe("처형이 끝났어요");
    expect(card(container)).toBeNull();
    expect(container.querySelectorAll(".mf-dt__cone").length).toBe(0);
    expect(announce(container)).toBe("처형");
  });

  it("처형 발표는 없고 후보만 있으면 후보 자리를 가운데로 쓰고 카드는 첫 문구", () => {
    const { container } = renderRoom(makeView({ noExecution: true }));
    expect(seatOf(container, 2).style.zIndex).toBe("31");
    expect(card(container)!.querySelector(".mf-morningcard__t")?.textContent).toBe("민지님이 더는 함께할 수 없게 되었습니다");
  });
});

describe("defense → execution 이어 가기 (D-16)", () => {
  it("같은 접속에서 defense 에서 오면 후보 좌석이 사람 층 + 유령 층 두 장이고, 좌표·DOM 노드가 그대로다(이동 전이가 새로 시작되지 않음)", () => {
    const r = renderRoom(makeView({ phase: "defense" }));
    const before = seatOf(r.container, 2);
    const left = before.style.left;
    const top = before.style.top;
    const transform = before.style.transform;
    const table = r.container.querySelector(".mf-dt");
    expect(imgsOf(r.container, 2).length).toBe(1);
    r.rerenderRoom(makeView({ phase: "execution" }));
    const after = seatOf(r.container, 2);
    expect(after === before).toBe(true);
    expect([after.style.left, after.style.top, after.style.transform].join("|")).toBe([left, top, transform].join("|"));
    expect(r.container.querySelector(".mf-dt") === table).toBe(true);
    const imgs = imgsOf(r.container, 2);
    expect(imgs.length).toBe(2);
    expect(imgs.filter((i) => i.getAttribute("src")?.includes("/characters/ghost/")).length).toBe(1);
    expect(r.container.querySelectorAll('img[class*="mf-figure--halo"]').length).toBe(1);
    // 400ms 뒤 유령 한 장
    act(() => void vi.advanceTimersByTime(400));
    expect(imgsOf(r.container, 2).length).toBe(1);
    expect(imgsOf(r.container, 2)[0]!.getAttribute("src")).toContain("/characters/ghost/");
    expect(haloSeats(r.container, "white")).toBe("2");
  });

  it("처음부터 execution 인 렌더(재접속·중간 합류)는 유령 한 장이고 전환 클래스가 없다", () => {
    const { container } = renderRoom(makeView());
    const imgs = imgsOf(container, 2);
    expect(imgs.length).toBe(1);
    expect(imgs[0]!.getAttribute("src")).toContain("/characters/ghost/");
    expect(container.querySelectorAll(".mf-figure--exec-out, .mf-figure--exec-in").length).toBe(0);
  });

  it("defense → execution 이어도 접속 번호(epoch)가 바뀌면(재접속) 유령 한 장이다", () => {
    const r = renderRoom(makeView({ phase: "defense" }));
    r.rerenderRoom(makeView({ phase: "execution" }), { epoch: 2 });
    expect(imgsOf(r.container, 2).length).toBe(1);
    expect(r.container.querySelectorAll(".mf-figure--exec-out").length).toBe(0);
  });
});

describe("직업 비노출 (T-04-61, D-09)", () => {
  const ROLE_WORDS = /마피아|경찰|의사|시민/;

  it("살아 있는 viewer 의 화면에 직업 그림(/characters/roles/)도 직업 단어도 없다", () => {
    for (const phase of ["defense", "execution"] as const) {
      const r = renderRoom(makeView({ me: 0, phase }));
      if (phase === "defense") r.rerenderRoom(makeView({ me: 0, phase: "execution" }));
      expect(r.container.innerHTML).not.toContain("/characters/roles/");
      expect(ROLE_WORDS.test(r.container.textContent ?? "")).toBe(false);
      expect(ROLE_WORDS.test(r.container.innerHTML.replace(/<[^>]*>/g, ""))).toBe(false);
      cleanup();
    }
  });

  it("마피아 viewer 도 처형된 후보의 직업을 보지 못한다(동료 마름모 이름 `마피아` 는 동료 자리에만)", () => {
    const { container } = renderRoom(makeView({ me: 0, mafia: [0, 1] }));
    expect(container.innerHTML).not.toContain("/characters/roles/");
    const seat2 = seatOf(container, 2);
    expect(seat2.getAttribute("aria-label") ?? "").not.toMatch(ROLE_WORDS);
    expect(seat2.querySelector(".mf-dt__mark")).toBeNull();
  });

  it("처형된 본인은 기존 관전 규칙대로 다른 사람의 직업 그림이 올 수 있다(허용)", () => {
    const { container } = renderRoom(makeView({ me: 2, spectateJobs: [{ seat: 1, job: "police" }] }));
    expect(imgsOf(container, 1)[0]!.getAttribute("src")).toContain("/characters/roles/");
    // 하단은 여전히 같은 두 줄이다
    expect(panelOf(container).querySelector("h2")?.textContent).toBe("처형이 끝났어요");
  });

  it("처형 카드·하단·무대 부품의 소스는 직업 문구 표를 읽지 않는다", () => {
    for (const f of ["src/components/MorningCard.tsx", "src/screens/verdictScene.tsx"]) {
      const src = readFileSync(f, "utf8");
      expect(src).not.toMatch(/roleText|ROLE_TEXT|ROLE_IDS|roleArtSrc/);
    }
  });
});

describe("execution 후광 상한 (결정 0030, D-33)", () => {
  it("마피아 viewer 의 진홍 동료 후광은 유지되되 합이 3 을 넘으면 진홍부터 꺼진다(후보 흰 후광이 우선, 마름모는 남는다)", () => {
    // 6명, 나(0)는 마피아, 동료 1·3·4 → 요청: 흰 2 + 진홍 1·3·4 = 4개 → 자리 번호가 큰 진홍(4)이 꺼진다
    const view = makeView({ me: 0, count: 6, mafia: [0, 1, 3, 4] });
    const { container } = renderRoom(view);
    expect(haloSeats(container, "white")).toBe("2");
    expect(haloSeats(container, "crimson")).toBe("1,3");
    expect(container.querySelectorAll(".mf-dt__mark").length).toBe(3);
  });

  it("동료가 적으면 진홍 후광이 그대로 모두 남는다", () => {
    const { container } = renderRoom(makeView({ me: 0, count: 6, mafia: [0, 1] }));
    expect(haloSeats(container, "white")).toBe("2");
    expect(haloSeats(container, "crimson")).toBe("1");
  });
});

describe("execution 연결 (라우팅)", () => {
  it("RoomScreen 은 execution 을 DayScene 으로 그리고 장면 키가 defense 와 같다(테이블이 다시 마운트되지 않음)", () => {
    const src = readFileSync("src/screens/RoomScreen.tsx", "utf8");
    expect(src).toContain('case "execution"');
    expect(src).toContain("executionTitle");
    const r = renderRoom(makeView({ phase: "defense" }));
    const table = r.container.querySelector(".mf-dt");
    r.rerenderRoom(makeView({ phase: "execution" }));
    expect(r.container.querySelector(".mf-dt") === table).toBe(true);
  });

  it("이모티콘·메시지 입구가 없고 말풍선 층이 없다", () => {
    const { container } = renderRoom(makeView({ me: 0 }));
    expect(container.querySelectorAll(".mf-dt__bubble").length).toBe(0);
    expect(screen.queryByRole("button", { name: "이모티콘" })).toBeNull();
  });
});
