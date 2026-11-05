/// <reference types="node" />
import { readFileSync, readdirSync } from "node:fs";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { phaseKey } from "../../shared/game/audience";
import { ringSlots } from "../../shared/game/gather";
import type { RoleId } from "../../shared/game/roles";
import type { GameWinner, RoomView } from "../../shared/protocol";
import type { WorldStageProps } from "../../src/components/WorldStage";
import type { RoomConnection } from "../../src/net/useRoomConnection";
import { GATHER_CENTER } from "../../src/world/camera";

// 결과 화면(11-05, 결정 D-1·D-11): 3D 무대(WorldStage) 위의 한 장면. WorldStage 는 받은 props 를 쥐고 tagProps 의 직업 칩만 그리는 가짜다
// (캔버스·런타임·의상 적용은 worldStage.test 몫). RoomScreen 의 연결 훅은 반환값을 시험이 정하는 가짜다.
const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));

const stage = vi.hoisted(() => ({ props: null as null | WorldStageProps, mounts: 0 }));
vi.mock("../../src/components/WorldStage", async () => {
  const { createElement, useEffect } = await import("react");
  const { RoleChip } = await import("../../src/components/v2/RoleChip");
  return {
    WorldStage: (props: WorldStageProps) => {
      stage.props = props;
      // 진짜 런타임처럼 장면 표에서 입은 의상·어둠을 알린다
      useEffect(() => {
        const costumes: Record<number, string> = {};
        const dimmed: number[] = [];
        for (const [seat, look] of Object.entries(props.scene?.seats ?? {})) {
          if (look.costume !== undefined) costumes[Number(seat)] = look.costume;
          if (look.dim === true) dimmed.push(Number(seat));
        }
        props.onCostumes?.(costumes, dimmed);
      });
      useEffect(() => {
        stage.mounts += 1;
      }, []);
      return createElement(
        "div",
        { "data-world-stage-fake": "" },
        props.view.players.map((p) => {
          const role = props.tagProps?.(p.seat).role;
          return role ? createElement(RoleChip, { key: p.seat, role }) : null;
        }),
      );
    },
  };
});

const { RoomScreen } = await import("../../src/screens/RoomScreen");

const NOW = 1_700_000_000_000;
const NAMES = ["지우", "하윤", "민지", "도현", "서연", "수빈", "하준", "지호"];
const DEFAULT_JOBS: RoleId[] = ["citizen", "police", "doctor", "mafia", "citizen", "mafia", "citizen", "citizen"];

interface Opts {
  count?: number;
  winner?: GameWinner;
  /** 탈락한 자리들(players[].alive false) */
  dead?: number[];
  me?: number;
  jobs?: RoleId[];
  withResult?: boolean;
  spectate?: boolean;
  chat?: RoomView["me"]["chat"] | null;
  nicknames?: string[];
}

function makeView(o: Opts = {}): RoomView {
  const count = o.count ?? 5;
  const jobs = o.jobs ?? DEFAULT_JOBS;
  const dead = o.dead ?? [2];
  const me = o.me ?? 0;
  const seats = Array.from({ length: count }, (_, seat) => ({ seat, job: jobs[seat]! }));
  const chat = o.chat === undefined ? ("all" as const) : o.chat;
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
      nickname: (o.nicknames ?? NAMES)[seat]!,
      connected: true,
      isHost: seat === 0,
      ...(dead.includes(seat) ? { alive: false } : {}),
    })),
    me: { seat: me, isHost: me === 0, role: jobs[me]!, ...(chat === null ? {} : { chat }) },
    day: { n: 2, roles: ["mafia", "police", "citizen"], voteLog: [] },
    ...(o.spectate ? { spectate: { seats } } : {}),
    ...(o.withResult === false ? {} : { result: { winner: o.winner ?? "citizenWin", seats, summary: [] } }),
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
  const ui = () => <RoomScreen code="0042" token={"t".repeat(43)} onExit={onExit} />;
  const r = render(ui());
  const rerenderRoom = (v: RoomView, o: Partial<RoomConnection> = over) => {
    connectionMock.current = conn(v, { send: (connectionMock.current as RoomConnection).send, ...o });
    r.rerender(ui());
  };
  return { ...r, rerenderRoom, onExit, send: (connectionMock.current as RoomConnection).send as ReturnType<typeof vi.fn> };
}

const text = (el: Element | null | undefined) => el?.textContent ?? "";
const chips = (c: ParentNode) => Array.from(c.querySelectorAll<HTMLElement>("[data-role-chip]"));
const scene = () => stage.props!.scene!;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  stage.props = null;
  stage.mounts = 0;
  delete (window as { __mfResult?: unknown }).__mfResult;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("결과 화면: 3D 무대 위 한 장면의 최종 상태 (D-1, A-5)", () => {
  it("ended + result 면 결과 화면: 헤더 제목이 승리 한 줄(+ 아이콘)이고 옛 요소는 하나도 없다", () => {
    const r = renderRoom(makeView());
    expect(screen.queryByText("연결 중…")).toBeNull();
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(text(h1)).toBe("시민 승리");
    expect(h1.querySelector("svg")).not.toBeNull();
    for (const old of [".mf-result__grid", ".mf-result__banner", ".mf-result__card", ".mf-result__foot", ".mf-result__sm", ".mf-phasebar", ".mf-timer"]) expect(r.container.querySelector(old), old).toBeNull();
    expect(screen.queryByRole("button", { name: "처음으로" })).toBeNull();
    expect(r.container.textContent).not.toContain("30분");
    expect(r.container.textContent).not.toContain("이번 판 기록");
  });

  it("마피아 승이면 제목이 마피아 승리다", () => {
    renderRoom(makeView({ winner: "mafiaWin" }));
    expect(text(screen.getByRole("heading", { level: 1 }))).toBe("마피아 승리");
  });

  it("장면: 고정 카메라(무대 중심, 줌 1)·밤 조명·긴장 0·무대 가운데 점 조명, 걷기 목적지는 막는다", () => {
    renderRoom(makeView());
    const s = scene();
    expect(s.camera).toEqual({ mode: "fixed", target: { x: GATHER_CENTER.x, z: GATHER_CENTER.z }, zoom: 1 });
    expect(s.lighting).toBe("night");
    expect(s.tension).toBe(0);
    expect(s.pin).toEqual({ mode: "point", x: GATHER_CENTER.x, z: GATHER_CENTER.z });
    expect(stage.props!.canWalk).toBe(false);
  });

  it("모든 사람(산 사람·탈락자)을 그린다: seats 의 show true, 탈락자만 ghost, 직업 의상이 입혀져 있다", () => {
    renderRoom(makeView({ dead: [2] }));
    const seats = scene().seats;
    expect(Object.keys(seats).map(Number)).toEqual([0, 1, 2, 3, 4]);
    expect(Object.values(seats).every((l) => l.show === true)).toBe(true);
    expect(Object.values(seats).map((l) => l.ghost)).toEqual([false, false, true, false, false]);
    expect(Object.values(seats).map((l) => l.costume)).toEqual(["coat", "police", "doctor", "mafia", "coat"]);
  });

  it("진 팀은 어둡다: 시민 승이면 마피아 편, 마피아 승이면 시민 편", () => {
    const a = renderRoom(makeView({ winner: "citizenWin" }));
    expect(Object.entries(scene().seats).filter(([, l]) => l.dim === true).map(([k]) => Number(k))).toEqual([3]);
    a.unmount();
    renderRoom(makeView({ winner: "mafiaWin" }));
    expect(Object.entries(scene().seats).filter(([, l]) => l.dim === true).map(([k]) => Number(k))).toEqual([0, 1, 2, 4]);
  });

  it("머리 위 직업 칩이 참가자 수만큼 있고 각자 자기 직업이다 (탈락자 포함)", () => {
    const r = renderRoom(makeView({ dead: [2] }));
    expect(chips(r.container)).toHaveLength(5);
    expect(chips(r.container).map((c) => c.dataset.roleChip)).toEqual(["citizen", "police", "doctor", "mafia", "citizen"]);
  });

  it("스토어에 한 점 구간 snap 이 들어가 모두 ringSlots(n) 의 자기 자리에 선다", () => {
    renderRoom(makeView({ count: 6 }));
    const store = stage.props!.store;
    const table = ringSlots(6);
    for (let seat = 0; seat < 6; seat++) {
      const at = store.positionOf(seat, NOW + 5000)!;
      expect(at.x).toBeCloseTo(table[seat]![0] / 100, 6);
      expect(at.z).toBeCloseTo(table[seat]![1] / 100, 6);
    }
  });

  it("모든 viewer 가 같은 화면: 산 viewer · 탈락 viewer(spectate) · 마피아 viewer 의 장면과 제목이 같다", () => {
    const sig = (v: RoomView): string => {
      const r = renderRoom(v);
      const out = JSON.stringify({ title: text(r.container.querySelector("h1")), seats: scene().seats, chips: chips(r.container).map((c) => c.dataset.roleChip) });
      r.unmount();
      return out;
    };
    const alive = sig(makeView({ me: 0 }));
    expect(sig(makeView({ me: 2, spectate: true }))).toBe(alive);
    expect(sig(makeView({ me: 3 }))).toBe(alive);
  });

  it("result 가 없는 ended 프레임은 `연결 중…` 으로 안전하게 폴백한다", () => {
    const r = renderRoom(makeView({ withResult: false }));
    expect(screen.getByText("연결 중…")).toBeTruthy();
    expect(r.container.querySelector("[data-result-panel]")).toBeNull();
    expect(r.container.querySelector(".mf-sr-only")?.textContent).toBe("게임이 끝났습니다");
  });

  it("읽기용 안내는 RoomScreen 한 곳이 한다: 승리 팀을 읽고 결과 화면은 live 영역을 더하지 않는다", () => {
    const a = renderRoom(makeView());
    expect(a.container.querySelector(".mf-sr-only")?.textContent).toBe("게임이 끝났습니다. 시민 팀 승리");
    expect(a.container.querySelector("[data-result-announce]")).toBeNull(); // 최종 상태에는 승리 알림 오버레이가 없다
    a.unmount();
    const b = renderRoom(makeView({ winner: "mafiaWin" }));
    expect(b.container.querySelector(".mf-sr-only")?.textContent).toBe("게임이 끝났습니다. 마피아 팀 승리");
  });

  it("판이 끝나면 열려 있던 테스트 시트·역할 카드 시트를 닫는다", () => {
    const before = makeView();
    before.phase = "execution";
    delete (before as { result?: unknown }).result;
    before.day = { ...before.day!, execution: { seat: 2 } };
    before.me = { ...before.me, isHost: true, testMode: true };
    const r = renderRoom(before);
    fireEvent.click(screen.getByRole("button", { name: /테스트/ }));
    expect(r.container.querySelector("dialog")).not.toBeNull();
    const after = makeView();
    after.me = { ...after.me, isHost: true, testMode: true };
    r.rerenderRoom(after);
    expect(r.container.querySelector("dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: "테스트" })).toBeNull();
    expect(screen.queryByRole("button", { name: /역할 카드/ })).toBeNull();
  });
});

describe("아래 패널: 전체 채팅 한 줄 (D-11)", () => {
  const input = (c: ParentNode) => c.querySelector<HTMLInputElement>("[data-chat-input]")!;
  const type = (el: HTMLInputElement, value: string) => fireEvent.change(el, { target: { value } });

  it("패널에 채팅 입력이 있고 동작 버튼·행동 줄은 없다", () => {
    const r = renderRoom(makeView());
    const panel = r.container.querySelector("[data-result-panel]")!;
    expect(panel).not.toBeNull();
    expect(panel.querySelector("[data-chat-input]")).not.toBeNull();
    expect(panel.querySelector("[data-emote-button]")).toBeNull();
    expect(panel.querySelector(".mf-act")).toBeNull();
    expect(panel.querySelector("[data-will-button]")).toBeNull();
  });

  it("me.chat 이 all 이면 보낸다: chat 메시지에 단계 키가 실리고 입력칸이 비워진다", () => {
    const view = makeView();
    const r = renderRoom(view);
    type(input(r.container), "수고했어요");
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));
    expect(r.send).toHaveBeenCalledWith({ t: "chat", text: "수고했어요", pk: phaseKey({ phase: "ended", day: view.day?.n, round: view.round }) });
    expect(input(r.container).value).toBe("");
  });

  it("입력 중 신호(typing)는 결과 단계에서 서버가 버리므로 보내지 않는다", () => {
    const r = renderRoom(makeView());
    type(input(r.container), "안");
    type(input(r.container), "안녕");
    act(() => void vi.advanceTimersByTime(5000));
    fireEvent.blur(input(r.container));
    expect(r.send.mock.calls.filter((c) => (c[0] as { t: string }).t === "typing")).toHaveLength(0);
  });

  it("me.chat 이 all 이 아니면(옛 서버 등) 보낼 수 없다", () => {
    const r = renderRoom(makeView({ chat: null }));
    type(input(r.container), "안녕");
    expect(screen.getByRole("button", { name: "보내기" }).getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));
    expect(r.send.mock.calls.filter((c) => (c[0] as { t: string }).t === "chat")).toHaveLength(0);
  });

  it("연결이 끊기면 보내기만 막힌다", () => {
    const r = renderRoom(makeView(), { canSend: false });
    type(input(r.container), "안녕");
    expect(screen.getByRole("button", { name: "보내기" }).getAttribute("aria-disabled")).toBe("true");
  });
});

describe("나가기 (D-11)", () => {
  const openLeave = (c: HTMLElement) => {
    fireEvent.click(screen.getByRole("button", { name: "나가기" }));
    return c.querySelector("dialog")!;
  };
  const confirmButton = (dialog: Element) => Array.from(dialog.querySelectorAll<HTMLButtonElement>("button")).find((b) => b.textContent === "나가기")!;

  it("헤더 [나가기] → 확인 시트 `방에서 나갈까요?` → 확인하면 leave 를 보내고 onExit(\"left\")", () => {
    const r = renderRoom(makeView());
    const dialog = openLeave(r.container);
    expect(text(dialog.querySelector("h2"))).toBe("방에서 나갈까요?");
    expect(r.send).not.toHaveBeenCalledWith({ t: "leave" });
    fireEvent.click(confirmButton(dialog));
    expect(r.send).toHaveBeenCalledWith({ t: "leave" });
    expect(r.onExit).toHaveBeenCalledWith("left");
  });

  it("[취소] 는 아무것도 보내지 않는다", () => {
    const r = renderRoom(makeView());
    const dialog = openLeave(r.container);
    fireEvent.click(Array.from(dialog.querySelectorAll<HTMLButtonElement>("button")).find((b) => b.textContent === "취소")!);
    expect(r.send).not.toHaveBeenCalledWith({ t: "leave" });
    expect(r.onExit).not.toHaveBeenCalled();
  });

  it("leave 가 보내지지 않았으면(소켓 닫힘) 나가지 않고 알린다", () => {
    const send = vi.fn(() => false);
    const r = renderRoom(makeView(), { send });
    fireEvent.click(confirmButton(openLeave(r.container)));
    expect(r.onExit).not.toHaveBeenCalled();
    expect(r.container.textContent).toContain("연결이 불안정해요");
  });
});

describe("E2E 훅 window.__mfResult (11-05)", () => {
  it("stage·칩 수·어두워진 좌석·입은 의상 표를 싣고 언마운트하면 지운다 (DOM 속성이 아니다)", () => {
    const r = renderRoom(makeView());
    const hook = (window as unknown as { __mfResult?: { stage: string; chips: number; dimmed: number[]; costumes: Record<number, string> } }).__mfResult;
    expect(hook).toEqual({ stage: "final", chips: 5, dimmed: [3], costumes: { 0: "coat", 1: "police", 2: "doctor", 3: "mafia", 4: "coat" } });
    expect(r.container.querySelector('[data-result-stage="final"]')).not.toBeNull();
    // 루트 속성에 역할·의상을 싣지 않는다 — 직업은 칩([data-role-chip])의 속성과 접근성 이름뿐이다
    const root = r.container.querySelector("main")!;
    expect(root.getAttributeNames().sort()).toEqual(["class", "data-result-stage", "data-reveal", "data-winner"]);
    r.unmount();
    expect((window as { __mfResult?: unknown }).__mfResult).toBeUndefined();
  });
});

describe("결과(직업)는 ended 경로 한 곳에서만 읽는다 (T-04-64, T-11-15)", () => {
  const componentFiles = readdirSync("src/components").filter((f) => f.endsWith(".tsx"));

  it("src/components 의 어떤 파일도 `result` 를 props 이름으로 선언하지 않는다", () => {
    expect(componentFiles.length).toBeGreaterThan(10);
    for (const f of componentFiles) {
      const src = readFileSync(`src/components/${f}`, "utf8");
      expect(src, `${f} 의 props`).not.toMatch(/\bresult\??:\s*(GameResult|RoomView\["result"\])/);
      expect(src, `${f} 의 GameResult 가져오기`).not.toMatch(/\bGameResult\b/);
    }
  });

  it("`result.seats` 를 읽는 소스는 ResultScreen·resultDirector 둘뿐이다 (판 중 장면 경로 visibleSeats 는 읽지 않는다)", () => {
    const readers: string[] = [];
    const walk = (dir: string) => {
      for (const ent of readdirSync(dir, { withFileTypes: true })) {
        const p = `${dir}/${ent.name}`;
        if (ent.isDirectory()) walk(p);
        else if (/\.tsx?$/.test(ent.name) && /\bresult\??\.seats\b/.test(readFileSync(p, "utf8"))) readers.push(p);
      }
    };
    walk("src");
    expect(readers.length).toBeGreaterThan(0);
    expect(readers.every((p) => ["src/game/resultDirector.ts", "src/screens/ResultScreen.tsx"].includes(p)), readers.join(",")).toBe(true);
  });
});

describe("마크업 삽입 방지 (T-04-65)", () => {
  it("`<b>` 같은 닉네임도 평문이다 (이름표는 WorldStage 몫, 결과 화면은 닉네임을 문자열로 쓰지 않는다)", () => {
    const r = renderRoom(makeView({ nicknames: ["<b>x</b>", "하윤", "민지", "도현", "서연"] }));
    expect(r.container.querySelector("b")).toBeNull();
  });
});

describe("result.css 정적 단언 (happy-dom 은 레이아웃을 재지 못한다)", () => {
  const css = readFileSync("src/styles/result.css", "utf8");

  it("색 직접 지정(#)이 없고 글자 크기는 14·16·24·36 만이다", () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    const sizes = [...css.matchAll(/font-size:\s*(\d+)px/g)].map((m) => Number(m[1]));
    for (const s of sizes) expect([14, 16, 24, 36], `font-size ${s}`).toContain(s);
  });

  it("옛 카드 격자·배너·요약 규칙이 남아 있지 않다", () => {
    for (const old of [".mf-result__grid", ".mf-result__card", ".mf-result__banner", ".mf-result__sm", ".mf-result__foot", ".mf-result__glow", ".mf-result__neutral"]) expect(css, old).not.toContain(old);
  });

  it("아래 패널은 채팅 패널과 같은 틀(좌우 16·위 14·아래 22)이다", () => {
    expect(css).toMatch(/\.mf-result__panel\s*\{[^}]*padding:\s*14px var\(--space-md\) 22px/);
  });
});

// ---------- Task 2: 시간표 · 건너뛰기 · 모션 줄이기 · 재접속 (D-1, D-25) ----------
describe("결과 시간표 연출 (A-1)", () => {
  // 좌석 0 시민 · 1 경찰 · 2 의사(탈락) · 3 마피아 · 4 시민, 시민 승
  const executionView = (): RoomView => {
    const v = makeView();
    v.phase = "execution";
    delete (v as { result?: unknown }).result;
    v.day = { ...v.day!, candidate: 3, execution: { seat: 3 } };
    return v;
  };
  /** execution → ended 로 같은 접속에서 넘어온 마운트(= 처음 받은 결과). 넘기 전 스토어에 출발 위치를 심을 수 있다 */
  const reveal = (opts: Opts = {}, seed?: (store: NonNullable<typeof stage.props>["store"]) => void) => {
    const r = renderRoom(executionView());
    seed?.(stage.props!.store);
    r.rerenderRoom(makeView(opts));
    return r;
  };
  const hookOf = () => (window as unknown as { __mfResult?: { stage: string; chips: number; dimmed: number[]; costumes: Record<number, string> } }).__mfResult!;
  const stageName = (c: ParentNode) => c.querySelector<HTMLElement>("[data-result-stage]")!.dataset.resultStage;
  const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
  const title = (c: ParentNode) => text(c.querySelector("h1"));
  const announce = (c: ParentNode) => c.querySelector<HTMLElement>("[data-result-announce]");
  const costumeCount = () => Object.values(scene().seats).filter((l) => l.costume !== undefined).length;
  const dimCount = () => Object.values(scene().seats).filter((l) => l.dim === true).length;

  it("t=0: 모임 — 헤더 `결과`, 칩·의상·어둠·조명·승리 알림 없음", () => {
    const r = reveal();
    expect(stageName(r.container)).toBe("gather");
    expect(title(r.container)).toBe("결과");
    expect(r.container.querySelector("h1 svg")).toBeNull();
    expect(chips(r.container)).toHaveLength(0);
    expect(costumeCount()).toBe(0);
    expect(dimCount()).toBe(0);
    expect(scene().pin).toBeNull();
    expect(announce(r.container)).toBeNull();
    expect(hookOf()).toMatchObject({ stage: "gather", chips: 0, dimmed: [], costumes: {} });
  });

  it("모임 걷기: 스토어의 마지막 위치에서 자리까지 1200ms 안에 도착하는 구간, 위치가 없는 사람은 자리에서 시작한다", () => {
    const r = reveal({ count: 5 }, (store) => {
      store.applyFrame({ t: "world", k: "snap", at: NOW, ents: [{ s: 0, p: [500, -400], t0: NOW, v: 0 }, { s: 1, p: [-300, 100], t0: NOW, v: 0 }] }, 1);
    });
    const store = stage.props!.store;
    const table = ringSlots(5);
    const p0 = store.positionOf(0, NOW)!;
    expect(p0.x).toBeCloseTo(5, 6);
    expect(p0.z).toBeCloseTo(-4, 6);
    const mid = store.positionOf(0, NOW + 600)!;
    expect(mid.x).toBeLessThan(5); // 출발(5)에서 자리(0)로 걷는 중간이다
    expect(mid.x).toBeGreaterThan(table[0]![0] / 100);
    const end = store.positionOf(0, NOW + 1200)!;
    expect(end.x).toBeCloseTo(table[0]![0] / 100, 6);
    expect(end.z).toBeCloseTo(table[0]![1] / 100, 6);
    // 위치가 없던 좌석 3 은 처음부터 자리에 서 있다
    const p3 = store.positionOf(3, NOW)!;
    expect(p3.x).toBeCloseTo(table[3]![0] / 100, 6);
    expect(p3.z).toBeCloseTo(table[3]![1] / 100, 6);
    r.unmount();
  });

  it("t=1199 는 아직 모임, t=1200 에 flip: 0번 사람만 칩이 뒤집히고 직업 의상", () => {
    const r = reveal();
    advance(1199);
    expect(stageName(r.container)).toBe("gather");
    expect(chips(r.container)).toHaveLength(0);
    advance(1);
    expect(stageName(r.container)).toBe("flip");
    expect(chips(r.container).map((c) => c.dataset.roleChip)).toEqual(["citizen"]);
    expect(costumeCount()).toBe(1);
    expect(scene().seats[0]!.costume).toBe("coat");
    expect(hookOf()).toMatchObject({ stage: "flip", chips: 1 });
  });

  it("1200+400i 마다 한 명씩 늘어난다 (좌석 오름차순), 4600 전까지 flip", () => {
    const r = reveal();
    advance(1200);
    for (let i = 1; i < 5; i++) {
      advance(399);
      expect(chips(r.container)).toHaveLength(i);
      advance(1);
      expect(chips(r.container)).toHaveLength(i + 1);
      expect(costumeCount()).toBe(i + 1);
    }
    expect(chips(r.container).map((c) => c.dataset.roleChip)).toEqual(["citizen", "police", "doctor", "mafia", "citizen"]);
    advance(1799); // 2800 → 4599
    expect(stageName(r.container)).toBe("flip");
    expect(dimCount()).toBe(0);
    expect(scene().pin).toBeNull();
  });

  it("t=4600: 이긴 팀 조명(점 조명)·진 팀 어둠·박수 큐·승리 알림(아이콘, 접근성 이름 승리 한 줄), 헤더는 아직 `결과`", () => {
    const r = reveal();
    advance(4600);
    expect(stageName(r.container)).toBe("light");
    expect(chips(r.container)).toHaveLength(5);
    expect(scene().pin).toEqual({ mode: "point", x: GATHER_CENTER.x, z: GATHER_CENTER.z });
    expect(Object.entries(scene().seats).filter(([, l]) => l.dim).map(([k]) => Number(k))).toEqual([3]);
    const cues = stage.props!.emoteCues!;
    expect(cues.map((c) => c.seat)).toEqual([0, 1, 2, 4]);
    expect(cues.every((c) => c.id === "clap")).toBe(true);
    expect(new Set(cues.map((c) => c.nonce)).size).toBe(cues.length);
    const a = announce(r.container)!;
    expect(a).not.toBeNull();
    expect(a.getAttribute("aria-label")).toBe("시민 승리");
    expect(text(a)).toBe("시민 승리");
    expect(a.querySelector("svg")).not.toBeNull();
    expect(title(r.container)).toBe("결과");
    expect(hookOf()).toMatchObject({ stage: "light", chips: 5, dimmed: [3] });
    expect(hookOf().costumes).toEqual({ 0: "coat", 1: "police", 2: "doctor", 3: "mafia", 4: "coat" });
  });

  it("마피아 승 알림은 마피아 승리 + 진홍 아이콘 표식", () => {
    const r = reveal({ winner: "mafiaWin" });
    advance(4600);
    const a = announce(r.container)!;
    expect(text(a)).toBe("마피아 승리");
    expect(a.dataset.winner).toBe("mafiaWin");
    expect(Object.entries(scene().seats).filter(([, l]) => l.dim).map(([k]) => Number(k))).toEqual([0, 1, 2, 4]);
    expect(stage.props!.emoteCues!.map((c) => c.seat)).toEqual([3]);
  });

  it("t=5200 알림이 꺼지고, t=5600 에 final — 헤더가 승리 한 줄(아이콘)이 되고 큐가 없다", () => {
    const r = reveal();
    advance(5199);
    expect(announce(r.container)).not.toBeNull();
    advance(1);
    expect(announce(r.container)).toBeNull();
    expect(stageName(r.container)).toBe("announce");
    expect(title(r.container)).toBe("결과");
    advance(399);
    expect(title(r.container)).toBe("결과");
    advance(1);
    expect(stageName(r.container)).toBe("final");
    expect(title(r.container)).toBe("시민 승리");
    expect(r.container.querySelector("h1 svg")).not.toBeNull();
    expect(hookOf().stage).toBe("final");
  });

  it("건너뛰기: 4600 전 무대 탭 한 번이면 즉시 4600 상태 — 전원 뒤집힘·조명, 승리 알림 없음, 자리에 한 점 구간", () => {
    const r = reveal({}, (store) => {
      store.applyFrame({ t: "world", k: "snap", at: NOW, ents: [{ s: 0, p: [500, -400], t0: NOW, v: 0 }] }, 1);
    });
    advance(2000);
    expect(chips(r.container)).toHaveLength(3);
    act(() => stage.props!.onStageTap!());
    expect(stageName(r.container)).toBe("light");
    expect(chips(r.container)).toHaveLength(5);
    expect(scene().pin).not.toBeNull();
    expect(dimCount()).toBe(1);
    expect(announce(r.container)).toBeNull();
    const table = ringSlots(5);
    const p0 = stage.props!.store.positionOf(0, NOW + 2000)!;
    expect(p0.x).toBeCloseTo(table[0]![0] / 100, 6);
    expect(p0.z).toBeCloseTo(table[0]![1] / 100, 6);
    // 남은 시간표는 이어진다: 알림 없이 5600 에 final
    advance(1000);
    expect(stageName(r.container)).toBe("final");
    expect(title(r.container)).toBe("시민 승리");
    expect(announce(r.container)).toBeNull();
  });

  it("이후 탭은 아무 일 없다 (4600 이후 · 이미 건너뛴 뒤)", () => {
    const r = reveal();
    advance(1500);
    act(() => stage.props!.onStageTap!());
    const nonces = stage.props!.emoteCues!.map((c) => c.nonce);
    const timers = vi.getTimerCount();
    act(() => stage.props!.onStageTap!());
    expect(stageName(r.container)).toBe("light");
    expect(stage.props!.emoteCues!.map((c) => c.nonce)).toEqual(nonces);
    expect(vi.getTimerCount()).toBe(timers);
    // 시간표를 끝까지 돌린 뒤의 탭도 같다
    advance(2000);
    act(() => stage.props!.onStageTap!());
    expect(stageName(r.container)).toBe("final");
  });

  it("걷는 중(모임)에도 탭하면 건너뛴다 — 걷기 목적지 move 는 보내지 않는다", () => {
    const r = reveal();
    advance(300);
    expect(stage.props!.canWalk).toBe(false);
    act(() => stage.props!.onStageTap!());
    expect(stageName(r.container)).toBe("light");
    expect(r.send.mock.calls.filter((c) => (c[0] as { t: string }).t === "move")).toHaveLength(0);
  });

  it("재접속·처음 마운트(arrivedFrom 없음)는 곧바로 final: 걷기·큐·알림·타이머가 없다", () => {
    const before = vi.getTimerCount();
    const r = renderRoom(makeView());
    expect(stageName(r.container)).toBe("final");
    expect(title(r.container)).toBe("시민 승리");
    expect(stage.props!.emoteCues ?? []).toEqual([]);
    expect(announce(r.container)).toBeNull();
    expect(r.container.querySelector("[data-result-stage]")!.getAttribute("data-reveal")).toBe("false");
    advance(10_000);
    expect(stageName(r.container)).toBe("final");
    void before;
  });

  it("에포크가 바뀐 재접속으로 ended 를 받으면 연출 없이 final", () => {
    const r = renderRoom(executionView());
    r.rerenderRoom(makeView(), { epoch: 2 });
    expect(stageName(r.container)).toBe("final");
  });

  it("execution·morning 이외 단계에서 온 ended 도 예외 없이 final", () => {
    const night = executionView();
    night.phase = "night";
    const r = renderRoom(night);
    r.rerenderRoom(makeView());
    expect(stageName(r.container)).toBe("final");
  });

  it("morning 에서 와도 같은 연출이 돈다", () => {
    const v = executionView();
    v.phase = "morning";
    v.day = { ...v.day!, morning: { eliminated: 2 } as never };
    const r = renderRoom(v);
    r.rerenderRoom(makeView());
    expect(stageName(r.container)).toBe("gather");
  });

  it("모션 줄이기: 같은 접속 전환이어도 곧바로 final, 칩 뒤집힘 애니메이션 표식도 없다", () => {
    const real = window.matchMedia;
    Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: () => ({ matches: true, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }) });
    try {
      const r = reveal();
      expect(stageName(r.container)).toBe("final");
      expect(r.container.querySelector("[data-result-stage]")!.getAttribute("data-reveal")).toBe("false");
      expect(stage.props!.emoteCues ?? []).toEqual([]);
    } finally {
      Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: real });
    }
  });

  it("연출 중 같은 결과가 다시 와도 되돌아가지 않고 타이머가 늘지 않는다", () => {
    const r = reveal();
    advance(2000);
    const timers = vi.getTimerCount();
    r.rerenderRoom(makeView());
    r.rerenderRoom(makeView());
    expect(chips(r.container)).toHaveLength(3);
    expect(stageName(r.container)).toBe("flip");
    expect(vi.getTimerCount()).toBe(timers);
  });

  it("언마운트하면 연출 타이머가 모두 정리된다 (T-04-66)", () => {
    const r = reveal();
    advance(500);
    r.unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(() => advance(10_000)).not.toThrow();
  });
});

describe("result.css 연출 정적 단언 (11-05)", () => {
  const css = readFileSync("src/styles/result.css", "utf8");
  it("승리 알림은 36px 한 줄·배경 어둡게 80%·터치 통과, 칩 뒤집힘은 transform 0.3초이고 모션 줄이기에서는 없다", () => {
    expect(css).toMatch(/\.mf-result__announce\s*\{[^}]*pointer-events:\s*none/);
    expect(css).toMatch(/\.mf-result__announce\s*\{[^}]*night-950\) 80%/);
    expect(css).toMatch(/\.mf-result__announce-text\s*\{[^}]*font-size:\s*36px/);
    expect(css).toMatch(/mv-rolechip[^{]*\{[^}]*animation:\s*mf-chip-flip 300ms/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[^{]*\{[^}]*mv-rolechip[^}]*animation:\s*none/);
  });
  it("전이·애니메이션은 opacity·transform 만 쓴다", () => {
    const frames = [...css.matchAll(/@keyframes[^{]+\{([\s\S]*?\n)\}/g)].map((m) => m[1]!).join("\n");
    for (const prop of ["width", "height", "top", "left", "margin", "padding"]) expect(frames, prop).not.toMatch(new RegExp(`\\b${prop}\\s*:`));
  });
});
