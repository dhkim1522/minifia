/// <reference types="node" />
import { readFileSync, readdirSync } from "node:fs";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { phaseKey } from "../../shared/game/audience";
import { ringSlots } from "../../shared/game/gather";
import type { RoleId } from "../../shared/game/roles";
import type { AwardLine, GameWinner, MapId, RoomView, SummaryRow, VoteLogEntry } from "../../shared/protocol";
import { PLAYABLE_MAPS } from "../../shared/game/maps";
import type { WorldStageProps } from "../../src/components/WorldStage";
import type { RoomConnection, RoomEvent } from "../../src/net/useRoomConnection";
import { GATHER_CENTER } from "../../src/world/camera";
import { openPlaza } from "../helpers/playable";

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
  /** 서버가 정렬해 보낸 시상 칭호 패 목록(11-09). 없으면 키 자체가 없다(옛 서버) */
  awards?: AwardLine[];
  /** 판 요약·공개 투표 기록(11-11 기록 탭). 없으면 빈 배열 */
  summary?: SummaryRow[];
  voteLog?: VoteLogEntry[];
  /** 다시 하기 준비한 좌석들(11-12, players[].ready) */
  ready?: number[];
  /** 판 번호(11-12, view.round) */
  round?: number;
  /** 방장 좌석(기본 0) */
  hostSeat?: number;
  /** 끊긴 좌석들 */
  offline?: number[];
  /** 쉬었다가 결과에 합류한 좌석들(result.seats 에는 없다, players[].sat) */
  sat?: number[];
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
    ...(o.round !== undefined ? { round: o.round } : {}),
    players: [
      ...seats.map(({ seat }) => ({
        seat,
        nickname: (o.nicknames ?? NAMES)[seat]!,
        connected: !(o.offline ?? []).includes(seat),
        isHost: seat === (o.hostSeat ?? 0),
        ...(dead.includes(seat) ? { alive: false } : {}),
        ...((o.ready ?? []).includes(seat) ? { ready: true as const } : {}),
      })),
      ...(o.sat ?? []).map((seat) => ({
        seat,
        nickname: (o.nicknames ?? NAMES)[seat]!,
        connected: !(o.offline ?? []).includes(seat),
        isHost: false,
        sat: true as const,
        ...((o.ready ?? []).includes(seat) ? { ready: true as const } : {}),
      })),
    ],
    me: { seat: me, isHost: me === (o.hostSeat ?? 0), ...(o.sat?.includes(me) ? {} : { role: jobs[me]! }), ...(chat === null ? {} : { chat }) },
    day: { n: 2, roles: ["mafia", "police", "citizen"], voteLog: o.voteLog ?? [] },
    ...(o.spectate ? { spectate: { seats } } : {}),
    ...(o.withResult === false ? {} : { result: { winner: o.winner ?? "citizenWin", seats, summary: o.summary ?? [], ...(o.awards !== undefined ? { awards: o.awards } : {}) } }),
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
    expect(hook).toEqual({ stage: "final", chips: 5, dimmed: [3], costumes: { 0: "coat", 1: "police", 2: "doctor", 3: "mafia", 4: "coat" }, tab: "all", awards: [], shown: -1, sat: [] });
    expect(r.container.querySelector('[data-result-stage="final"]')).not.toBeNull();
    // 루트 속성에 역할·의상을 싣지 않는다 — 직업은 칩([data-role-chip])의 속성과 접근성 이름뿐이다
    const root = r.container.querySelector("main")!;
    expect(root.getAttributeNames().sort()).toEqual(["class", "data-result-stage", "data-reveal", "data-winner", "style"]); // style 은 아래 패널 높이 변수(--mf-panel-h) 하나
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

  it("`result.seats` 를 읽는 소스는 ResultScreen·resultDirector·timelineView(기록 탭, ended 전용)뿐이다 (판 중 장면 경로 visibleSeats 는 읽지 않는다)", () => {
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
    expect(readers.every((p) => ["src/game/resultDirector.ts", "src/game/timelineView.ts", "src/screens/ResultScreen.tsx"].includes(p)), readers.join(",")).toBe(true);
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

// ---------- 11-07 Task 1: 결과 탭 패널 — resultLog 프레임이 저장소로 들어가 탭을 눌러야 확장된 패널에 그려진다 (D-2, D-3, D-9) ----------
describe("결과 탭 패널: 마피아 탭 (11-07 Task 1)", () => {
  type Listener = (e: RoomEvent, meta: { epoch: number }) => void;
  const mounted = (view: RoomView = makeView()) => {
    let listener: Listener | null = null;
    const onEvent = vi.fn((l: Listener) => {
      listener = l;
      return () => {};
    });
    const r = renderRoom(view, { onEvent });
    const emit = (e: RoomEvent, epoch = 1) => act(() => void listener!(e, { epoch }));
    return { ...r, emit };
  };
  const chatFrame = (part: "mafia" | "ghost", lines: { seat: number; n: number; text: string }[], i = 0, end = true): RoomEvent => ({ t: "resultLog", part, i, end, lines: lines.map((l, k) => ({ ...l, at: NOW + k })) });
  const feedAll = (emit: (e: RoomEvent) => void) => {
    emit(chatFrame("mafia", [{ seat: 3, n: 1, text: "오늘 밤은 지우" }, { seat: 3, n: 2, text: "다음은 하윤" }]));
    emit(chatFrame("ghost", [{ seat: 2, n: 2, text: "억울해" }]));
    emit({ t: "resultLog", part: "whisper", i: 0, end: true, lines: [{ seat: 0, to: 1, n: 1, text: "비밀이야", at: NOW }] });
    emit({ t: "resultLog", part: "claim", i: 0, end: true, lines: [] });
    emit({ t: "resultLog", part: "ballots", i: 0, end: true, lines: [] });
  };
  const panelOf = (c: ParentNode) => c.querySelector<HTMLElement>("[data-result-panel]")!;
  const tab = (c: ParentNode, id: string) => c.querySelector<HTMLElement>(`[data-result-tab="${id}"]`)!;

  it("연결 구독은 한 번 — resultLog 도 같은 구독으로 받는다", () => {
    const r = mounted();
    expect((connectionMock.current as RoomConnection).onEvent).toHaveBeenCalledTimes(1);
    r.unmount();
  });

  it("프레임을 받아도 탭을 열기 전에는 본문이 DOM 에 없다 (T-11-23)", () => {
    const r = mounted();
    feedAll(r.emit);
    expect(text(r.container)).not.toContain("오늘 밤은 지우");
    expect(text(r.container)).not.toContain("억울해");
    expect(text(r.container)).not.toContain("비밀이야");
    expect(panelOf(r.container).getAttribute("data-expanded")).toBe("false");
  });

  it("마피아 탭을 누르면 패널이 확장되고 `{n}밤` 구분선과 줄이 보이며 입력줄은 DOM 에 없다", () => {
    const r = mounted();
    feedAll(r.emit);
    fireEvent.click(tab(r.container, "mafia"));
    const panel = panelOf(r.container);
    expect(panel.getAttribute("data-expanded")).toBe("true");
    expect(Array.from(panel.querySelectorAll("[data-result-divider]")).map((e) => text(e))).toEqual(["1밤", "2밤"]);
    expect(Array.from(panel.querySelectorAll(".mv-chat__text")).map((e) => text(e))).toEqual(["오늘 밤은 지우", "다음은 하윤"]);
    expect(Array.from(panel.querySelectorAll(".mv-chat__name")).map((e) => text(e))).toEqual(["도현", "도현"]);
    expect(panel.querySelector("[data-chat-input]")).toBeNull();
  });

  it("전체 탭으로 돌아오면 접히고 입력줄이 다시 있다, 무대 탭으로도 접힌다", () => {
    const r = mounted();
    feedAll(r.emit);
    fireEvent.click(tab(r.container, "mafia"));
    fireEvent.click(tab(r.container, "all"));
    expect(panelOf(r.container).getAttribute("data-expanded")).toBe("false");
    expect(panelOf(r.container).querySelector("[data-chat-input]")).not.toBeNull();
    fireEvent.click(tab(r.container, "ghost"));
    expect(panelOf(r.container).getAttribute("data-expanded")).toBe("true");
    act(() => stage.props!.onStageTap!());
    expect(panelOf(r.container).getAttribute("data-expanded")).toBe("false");
    expect(tab(r.container, "all").getAttribute("aria-selected")).toBe("true");
  });

  describe("확장 높이 = min(round(0.7 × 방 높이), 520)", () => {
    const withRoomHeight = (h: number, run: () => void) => {
      const desc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
      Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => h });
      try {
        run();
      } finally {
        if (desc) Object.defineProperty(HTMLElement.prototype, "clientHeight", desc);
        else delete (HTMLElement.prototype as { clientHeight?: unknown }).clientHeight;
      }
    };
    it.each([
      [560, 392],
      [640, 448],
      [664, 465],
      [932, 520],
    ])("방 높이 %i → %ipx", (roomH, want) => {
      withRoomHeight(roomH, () => {
        const r = mounted();
        feedAll(r.emit);
        fireEvent.click(tab(r.container, "mafia"));
        expect(panelOf(r.container).style.height).toBe(`${want}px`);
        fireEvent.click(tab(r.container, "all"));
        expect(panelOf(r.container).style.height).toBe("");
        r.unmount();
      });
    });
  });

  it("낡은 연결(epoch)의 프레임은 버린다", () => {
    const r = mounted();
    r.emit(chatFrame("mafia", [{ seat: 3, n: 1, text: "새 연결" }]), 2);
    r.emit(chatFrame("mafia", [{ seat: 3, n: 1, text: "낡은 연결" }, { seat: 3, n: 1, text: "낡은 연결 둘" }], 0, true), 1);
    fireEvent.click(tab(r.container, "mafia"));
    expect(Array.from(panelOf(r.container).querySelectorAll(".mv-chat__text")).map((e) => text(e))).toEqual(["새 연결"]);
  });

  it("window.__mfResult.tab 이 현재 탭을 알린다", () => {
    const r = mounted();
    const hook = () => (window as unknown as { __mfResult?: { tab?: string } }).__mfResult!;
    expect(hook().tab).toBe("all");
    fireEvent.click(tab(r.container, "ghost"));
    expect(hook().tab).toBe("ghost");
  });
});

// ---------- 11-07 Task 2: 탭 다섯 · 등장 시각 · 점 표식 · 시계 정지 (D-2, D-3, D-25) ----------
describe("결과 탭: 등장 시각·점 표식·시계 정지 (11-07 Task 2)", () => {
  type Listener = (e: RoomEvent, meta: { epoch: number }) => void;
  const executionView = (): RoomView => {
    const v = makeView();
    v.phase = "execution";
    delete (v as { result?: unknown }).result;
    v.day = { ...v.day!, candidate: 3, execution: { seat: 3 } };
    return v;
  };
  let listener: Listener | null = null;
  const onEvent = (): Partial<RoomConnection> => ({
    onEvent: vi.fn((l: Listener) => {
      listener = l;
      return () => {};
    }),
  });
  const emit = (e: RoomEvent) => act(() => void listener!(e, { epoch: 1 }));
  const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
  const tabIds = (c: ParentNode) => Array.from(c.querySelectorAll("[data-result-tab]")).map((e) => e.getAttribute("data-result-tab"));
  const tab = (c: ParentNode, id: string) => c.querySelector<HTMLElement>(`[data-result-tab="${id}"]`)!;
  const panelOf = (c: ParentNode) => c.querySelector<HTMLElement>("[data-result-panel]")!;
  const hookOf = () => (window as unknown as { __mfResult?: { stage: string; chips: number } }).__mfResult!;
  const reveal = () => {
    const r = renderRoom(executionView(), onEvent());
    r.rerenderRoom(makeView(), onEvent());
    return r;
  };
  const ALL5 = ["all", "mafia", "ghost", "whisper", "log"];

  it("연출 마운트: 탭 행은 첫 뒤집기(1200ms)까지 전체 하나뿐이고 그 시각에 다섯이 된다", () => {
    const r = reveal();
    expect(tabIds(r.container)).toEqual(["all"]);
    advance(1199);
    expect(tabIds(r.container)).toEqual(["all"]);
    advance(1);
    expect(tabIds(r.container)).toEqual(ALL5);
  });

  it("건너뛰기로 1200 전에 4600 으로 뛰면 곧바로 다섯이다", () => {
    const r = reveal();
    advance(300);
    act(() => stage.props!.onStageTap!());
    expect(tabIds(r.container)).toEqual(ALL5);
  });

  it("재접속·처음 마운트는 처음부터 다섯이다", () => {
    const r = renderRoom(makeView());
    expect(tabIds(r.container)).toEqual(ALL5);
  });

  it("모션 줄이기는 처음부터 다섯이다", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} }));
    const r = reveal();
    expect(tabIds(r.container)).toEqual(ALL5);
    vi.unstubAllGlobals();
  });

  it("점 표식: 마피아·유령·귓속말 탭에만 붙고 한 번 열면 사라지며 다시 닫아도 돌아오지 않는다 (기록 탭은 없다)", () => {
    const r = renderRoom(makeView());
    const dots = () => Array.from(r.container.querySelectorAll("[data-result-dot]")).map((d) => d.closest("[data-result-tab]")!.getAttribute("data-result-tab"));
    expect(dots()).toEqual(["mafia", "ghost", "whisper"]);
    fireEvent.click(tab(r.container, "ghost"));
    expect(dots()).toEqual(["mafia", "whisper"]);
    fireEvent.click(tab(r.container, "all"));
    expect(dots()).toEqual(["mafia", "whisper"]);
    fireEvent.click(tab(r.container, "log"));
    fireEvent.click(tab(r.container, "all"));
    expect(dots()).toEqual(["mafia", "whisper"]);
  });

  it("마피아 탭 아이콘만 진홍 표식이다", () => {
    const r = renderRoom(makeView());
    expect(Array.from(r.container.querySelectorAll(".mf-result__tab.is-mafia")).map((e) => e.getAttribute("data-result-tab"))).toEqual(["mafia"]);
  });

  it("유령·귓속말 탭: 줄이 일차 구분선과 함께 보이고 귓속말 머리줄은 닉네임을 좌석으로 찾는다", () => {
    const r = renderRoom(makeView(), onEvent());
    emit({ t: "resultLog", part: "ghost", i: 0, end: true, lines: [{ seat: 2, n: 2, text: "억울해", at: NOW }, { seat: 2, n: 3, text: "또 억울해", at: NOW + 1 }] });
    emit({ t: "resultLog", part: "whisper", i: 0, end: true, lines: [{ seat: 0, to: 4, n: 1, text: "비밀이야", at: NOW }] });
    fireEvent.click(tab(r.container, "ghost"));
    expect(Array.from(panelOf(r.container).querySelectorAll("[data-result-divider]")).map((e) => text(e))).toEqual(["2일차", "3일차"]);
    expect(Array.from(panelOf(r.container).querySelectorAll(".mv-chat__name")).map((e) => text(e))).toEqual(["민지", "민지"]);
    fireEvent.click(tab(r.container, "whisper"));
    expect(Array.from(panelOf(r.container).querySelectorAll<HTMLImageElement>(".mf-result__face")).map((i) => i.alt)).toEqual(["지우", "서연"]);
    expect(text(panelOf(r.container).querySelector(".mf-result__whisper-text"))).toBe("비밀이야");
  });

  it("기록이 없는 탭은 본문 없이 quiet 아이콘 하나지만 탭 아이콘은 나타난다", () => {
    const r = renderRoom(makeView(), onEvent());
    emit({ t: "resultLog", part: "mafia", i: 0, end: true, lines: [] });
    fireEvent.click(tab(r.container, "mafia"));
    const body = panelOf(r.container).querySelector("[data-result-body]")!;
    expect(body.querySelectorAll("svg")).toHaveLength(1);
    expect(text(body).trim()).toBe("");
  });

  describe("확장 중 연출 시계 정지 (D-25)", () => {
    it("확장되면 시계가 멈추고(경과 보존) 접히면 남은 시간부터 이어진다", () => {
      const r = reveal();
      advance(2000); // 1200 + 400*2 → 칩 3
      expect(hookOf().chips).toBe(3);
      fireEvent.click(tab(r.container, "mafia"));
      advance(10_000);
      expect(hookOf().chips).toBe(3);
      expect(hookOf().stage).toBe("flip");
      fireEvent.click(tab(r.container, "all"));
      advance(399);
      expect(hookOf().chips).toBe(3);
      advance(1); // 경과 2400 → 칩 4
      expect(hookOf().chips).toBe(4);
      advance(600); // 3000
      expect(hookOf().chips).toBe(5);
      advance(1600); // 4600
      expect(hookOf().stage).toBe("light");
    });

    it("무대 탭은 확장 중이면 접기만 하고 건너뛰기는 하지 않는다. 접힌 뒤 탭하면 건너뛴다", () => {
      const r = reveal();
      advance(1500);
      fireEvent.click(tab(r.container, "ghost"));
      act(() => stage.props!.onStageTap!());
      expect(panelOf(r.container).getAttribute("data-expanded")).toBe("false");
      expect(hookOf().stage).toBe("flip");
      act(() => stage.props!.onStageTap!());
      expect(hookOf().stage).toBe("light");
    });

    it("접힌 뒤 무대 탭이 건너뛰기를 하지 않은 시계는 이어서 흐른다", () => {
      const r = reveal();
      advance(1500);
      fireEvent.click(tab(r.container, "whisper"));
      act(() => stage.props!.onStageTap!());
      advance(3100); // 경과 1500 + 3100 = 4600
      expect(hookOf().stage).toBe("light");
    });

    it("연출이 없는 마운트(최종 상태)에서 탭을 열고 닫아도 타이머가 생기지 않는다", () => {
      const r = renderRoom(makeView());
      const before = vi.getTimerCount();
      fireEvent.click(tab(r.container, "mafia"));
      fireEvent.click(tab(r.container, "all"));
      expect(vi.getTimerCount()).toBe(before);
    });
  });
});

// ---------- 11-09 Task 1: 시상식 첫 창 — 첫 수상자가 무대 가운데로 걷고 패가 뜬다 (D-7, D-24) ----------
describe("시상식 첫 창 (11-09)", () => {
  // 좌석 0 시민 · 1 경찰 · 2 의사(탈락) · 3 마피아 · 4 시민, 시민 승. 서버 정렬: 진 팀(3) → 이긴 팀
  const AWARDS: AwardLine[] = [
    { seat: 3, award: "whiff", k: 2 },
    { seat: 2, award: "spectator", k: 1, at: "night" },
    { seat: 1, award: "detective", k: 1 },
    { seat: 4, award: "talker", k: 12 },
    { seat: 0, award: "survivor" },
  ];
  const executionView = (): RoomView => {
    const v = makeView();
    v.phase = "execution";
    delete (v as { result?: unknown }).result;
    v.day = { ...v.day!, candidate: 3, execution: { seat: 3 } };
    return v;
  };
  const arrive = (opts: Opts = {}) => {
    const r = renderRoom(executionView());
    r.rerenderRoom(makeView({ awards: AWARDS, ...opts }));
    return r;
  };
  const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
  const title = (c: ParentNode) => text(c.querySelector("h1"));
  const plate = (c: ParentNode) => c.querySelector<HTMLElement>("[data-award-plate]");
  const hookOf = () => (window as unknown as { __mfResult?: { awards: unknown; shown: number } }).__mfResult!;

  it("5599 까지는 헤더 `결과`, 5600 에 `시상식` + 첫 수상자(3)에게 한 사람 스포트라이트(turn), 그 사람은 어둡지 않다", () => {
    const r = arrive();
    advance(5599);
    expect(title(r.container)).toBe("결과");
    expect(plate(r.container)).toBeNull();
    advance(1);
    expect(title(r.container)).toBe("시상식");
    expect(r.container.querySelector("h1 svg")).not.toBeNull();
    expect(scene().pin).toEqual({ mode: "turn", seat: 3 });
    expect(scene().seats[3]!.dim).toBeUndefined();
    expect(plate(r.container)).toBeNull(); // 0~900 은 걷기만
  });

  it("5600: 수상자가 자리에서 무대 가운데로 걷기 시작해 900ms 안에 (0,0) 에 선다", () => {
    const r = arrive();
    advance(5600);
    const store = stage.props!.store;
    const slot = ringSlots(5)[3]!;
    const now = Date.now();
    const start = store.positionOf(3, now)!;
    expect(start.x).toBeCloseTo(slot[0] / 100, 1);
    expect(start.z).toBeCloseTo(slot[1] / 100, 1);
    const end = store.positionOf(3, now + 900)!;
    expect(Math.hypot(end.x, end.z)).toBeLessThan(0.05);
    // 다른 사람은 자리 그대로
    const p0 = store.positionOf(0, now + 900)!;
    expect(p0.x).toBeCloseTo(ringSlots(5)[0]![0] / 100, 6);
    r.unmount();
  });

  it("900ms 뒤 패가 뜬다: data-award-plate·data-award-id 와 읽기 문구 '{닉네임}, {칭호}, {이유}'", () => {
    const r = arrive();
    advance(5600 + 899);
    expect(plate(r.container)).toBeNull();
    advance(1);
    const el = plate(r.container)!;
    expect(el).not.toBeNull();
    expect(el.dataset.awardId).toBe("whiff");
    expect(el.getAttribute("role")).toBe("status");
    expect(el.textContent).toContain("도현, 헛다리왕, 헛다리 2번");
    expect(el.querySelector(".mv-award__name")?.textContent).toBe("도현");
  });

  it("훅: awards 는 서버 목록 그대로 [seat, award][], shown 은 지금 패의 index (없으면 -1)", () => {
    const r = arrive();
    expect(hookOf().awards).toEqual([[3, "whiff"], [2, "spectator"], [1, "detective"], [4, "talker"], [0, "survivor"]]);
    expect(hookOf().shown).toBe(-1);
    advance(5600 + 900);
    expect(hookOf().shown).toBe(0);
    r.unmount();
  });

  it("칭호 목록이 없거나 비어 있으면(옛 서버) 시상식 없이 최종 상태", () => {
    for (const awards of [undefined, [] as AwardLine[]]) {
      const r = renderRoom(executionView());
      r.rerenderRoom(makeView(awards === undefined ? {} : { awards }));
      advance(6000);
      expect(title(r.container)).toBe("시민 승리");
      expect(plate(r.container)).toBeNull();
      expect(hookOf().shown).toBe(-1);
      r.unmount();
    }
  });

  it("재접속·처음 마운트(arrivedFrom 없음)는 칭호가 있어도 시상식 없이 최종 상태 (O-4)", () => {
    const r = renderRoom(makeView({ awards: AWARDS }));
    advance(8000);
    expect(title(r.container)).toBe("시민 승리");
    expect(plate(r.container)).toBeNull();
    expect(hookOf().awards).toEqual([[3, "whiff"], [2, "spectator"], [1, "detective"], [4, "talker"], [0, "survivor"]]);
    expect(hookOf().shown).toBe(-1);
  });
});

// ---------- 11-09 Task 2: 시상식 완성 — 교대·박수·넘기기 k / n·일시정지·의상 복귀·모션 줄이기 (D-1, D-25, O-13) ----------
describe("시상식 완성 (11-09)", () => {
  // 좌석 0 시민 · 1 경찰 · 2 의사(탈락) · 3 마피아 · 4 시민, 시민 승. 서버 정렬: 진 팀(3) → 이긴 팀
  const AWARDS5: AwardLine[] = [
    { seat: 3, award: "whiff", k: 2 },
    { seat: 2, award: "spectator", k: 1, at: "night" },
    { seat: 1, award: "detective", k: 1 },
    { seat: 4, award: "talker", k: 12 },
    { seat: 0, award: "survivor" },
  ];
  /** 8명: 마피아 2명(3, 5)이 진 팀이라 먼저 */
  const AWARDS8: AwardLine[] = [
    { seat: 5, award: "actor", k: 2 },
    { seat: 3, award: "whiff", k: 3 },
    { seat: 7, award: "spectator", k: 2, at: "day" },
    { seat: 6, award: "mood", k: 4 },
    { seat: 4, award: "whisperer", k: 3 },
    { seat: 2, award: "target", k: 3 },
    { seat: 1, award: "angel", k: 1 },
    { seat: 0, award: "survivor" },
  ];
  const S = 5600;
  const executionView = (count = 5): RoomView => {
    const v = makeView({ count });
    v.phase = "execution";
    delete (v as { result?: unknown }).result;
    v.day = { ...v.day!, candidate: 3, execution: { seat: 3 } };
    return v;
  };
  const arrive = (opts: Opts = {}) => {
    const r = renderRoom(executionView(opts.count));
    r.rerenderRoom(makeView({ awards: AWARDS5, ...opts }));
    return r;
  };
  // 표시각(100ms 배수)마다 React 가 그리도록 100ms 경계에서 끊어 나아간다 — 한 번에 길게 나아가면 렌더가 끝에서야 일어나 걷기 snap 의 t0 가 밀린다(실제 폰은 마크마다 그린다)
  const advance = (ms: number) => {
    let left = ms;
    while (left > 0) {
      const into = (Date.now() - NOW) % 100;
      const step = Math.min(left, into === 0 ? 100 : 100 - into);
      act(() => void vi.advanceTimersByTime(step));
      left -= step;
    }
  };
  const title = (c: ParentNode) => text(c.querySelector("h1"));
  const plate = (c: ParentNode) => c.querySelector<HTMLElement>("[data-award-plate]");
  const skipBtn = (c: ParentNode) => c.querySelector<HTMLElement>('[data-float="skip"]');
  const count = (c: ParentNode) => text(c.querySelector("[data-float-count]"));
  const hookOf = () => (window as unknown as { __mfResult?: { shown: number; dimmed: number[]; costumes: Record<number, string> } }).__mfResult!;
  const posAt = (seat: number, ahead = 0) => stage.props!.store.positionOf(seat, Date.now() + ahead)!;
  const slotOf = (n: number, seat: number) => ({ x: ringSlots(n)[seat]![0] / 100, z: ringSlots(n)[seat]![1] / 100 });
  const withReduced = async (fn: () => void | Promise<void>) => {
    const real = window.matchMedia;
    Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: () => ({ matches: true, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }) });
    try {
      await fn();
    } finally {
      Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: real });
    }
  };

  it("창 교대: 2500 에 둘째 사람(2)이 걸어 나오고 앞사람(3)은 자리로 돌아가며 3 은 다시 어두워진다", () => {
    const r = arrive();
    advance(S + 2499);
    expect(plate(r.container)!.dataset.awardId).toBe("whiff");
    expect(hookOf().dimmed).not.toContain(3);
    advance(1);
    expect(plate(r.container)).toBeNull(); // 둘째 창의 첫 900ms 는 걷기만
    expect(scene().pin).toEqual({ mode: "turn", seat: 2 });
    const c = posAt(3);
    expect(Math.hypot(c.x, c.z)).toBeLessThan(0.05); // 앞사람은 방금까지 무대 가운데
    const home = posAt(3, 900);
    expect(home.x).toBeCloseTo(slotOf(5, 3).x, 1);
    expect(home.z).toBeCloseTo(slotOf(5, 3).z, 1);
    const toCenter = posAt(2, 900);
    expect(Math.hypot(toCenter.x, toCenter.z)).toBeLessThan(0.05);
    expect(hookOf().dimmed).toContain(3);
    advance(900);
    expect(plate(r.container)!.textContent).toContain("민지, 관전자, 1일차 밤 탈락");
    expect(hookOf().shown).toBe(1);
  });

  it("박수: 패가 뜨는 순간 수상자를 뺀 오름차순 최대 4명(탈락자 포함)에게 clap 큐, 동시에 4를 넘지 않는다", () => {
    const r = arrive();
    advance(S + 899);
    const before = Math.max(0, ...stage.props!.emoteCues!.map((c) => c.nonce));
    advance(1);
    const cues = stage.props!.emoteCues!;
    expect(cues.map((c) => c.seat)).toEqual([0, 1, 2, 4]);
    expect(cues.every((c) => c.id === "clap" && c.nonce > before)).toBe(true);
    advance(2500);
    expect(stage.props!.emoteCues!.map((c) => c.seat)).toEqual([0, 1, 3, 4]);
    expect(stage.props!.emoteCues!.length).toBeLessThanOrEqual(4);
    r.unmount();
  });

  it("8명 판: 창 8개, 첫 창 박수는 수상자(5)를 뺀 0~4 중 4명, 마지막에 8 / 8", () => {
    const r = renderRoom(executionView(8));
    r.rerenderRoom(makeView({ count: 8, awards: AWARDS8 }));
    advance(S + 900);
    expect(count(r.container)).toBe("1 / 8");
    expect(stage.props!.emoteCues!.map((c) => c.seat)).toEqual([0, 1, 2, 3]);
    advance(2500 * 7);
    expect(count(r.container)).toBe("8 / 8");
    expect(plate(r.container)!.dataset.awardId).toBe("survivor");
    advance(2500);
    expect(skipBtn(r.container)).toBeNull();
    expect(title(r.container)).toBe("시민 승리");
  });

  it("[넘기기]: 시상 중에만, 접근성 이름 '넘기기'·위에 'k / n', 시작 전·끝난 뒤에는 없다", () => {
    const r = arrive();
    advance(S - 1);
    expect(skipBtn(r.container)).toBeNull();
    advance(1);
    const b = skipBtn(r.container)!;
    expect(b.getAttribute("aria-label")).toBe("넘기기");
    expect(count(r.container)).toBe("1 / 5");
    expect(b.querySelector("svg")).not.toBeNull();
    advance(2500);
    expect(count(r.container)).toBe("2 / 5");
    advance(2500 * 4);
    expect(title(r.container)).toBe("시민 승리");
    expect(skipBtn(r.container)).toBeNull();
    expect(r.container.querySelector("[data-float-count]")).toBeNull();
  });

  it("[넘기기] 한 번이면 앞사람은 순간 이동, 다음 사람이 걸어 나온다 (패 탭도 같다)", () => {
    const r = arrive();
    advance(S + 1000);
    expect(plate(r.container)).not.toBeNull();
    act(() => void fireEvent.click(skipBtn(r.container)!));
    expect(count(r.container)).toBe("2 / 5");
    expect(plate(r.container)).toBeNull();
    expect(scene().pin).toEqual({ mode: "turn", seat: 2 });
    const home = posAt(3);
    expect(home.x).toBeCloseTo(slotOf(5, 3).x, 1);
    expect(home.z).toBeCloseTo(slotOf(5, 3).z, 1);
    advance(900);
    act(() => void fireEvent.click(plate(r.container)!));
    expect(count(r.container)).toBe("3 / 5");
    expect(scene().pin).toEqual({ mode: "turn", seat: 1 });
  });

  it("연타: 같은 프레임에 n 번 눌러도 안전하게 끝까지 가고 한 번 더 눌러도 아무 일 없다", () => {
    const r = arrive();
    advance(S + 100);
    const btn = skipBtn(r.container)!;
    act(() => {
      for (let i = 0; i < 4; i++) fireEvent.click(btn);
    });
    expect(count(r.container)).toBe("5 / 5");
    expect(scene().pin).toEqual({ mode: "turn", seat: 0 });
    act(() => void fireEvent.click(btn));
    expect(title(r.container)).toBe("시민 승리");
    expect(skipBtn(r.container)).toBeNull();
    const timers = vi.getTimerCount();
    advance(5000);
    expect(title(r.container)).toBe("시민 승리");
    expect(vi.getTimerCount()).toBeLessThanOrEqual(timers);
  });

  it("끝: 모두 자리로 돌아가고 +600 에 직업 의상이 걷힌다 (고른 look 으로)", () => {
    const r = arrive();
    advance(S + 2500 * 5 - 1);
    expect(Object.keys(hookOf().costumes)).toHaveLength(5);
    advance(1);
    expect(title(r.container)).toBe("시민 승리");
    expect(scene().pin).toEqual({ mode: "point", x: GATHER_CENTER.x, z: GATHER_CENTER.z });
    const start = posAt(0);
    expect(Math.hypot(start.x, start.z)).toBeLessThan(0.05); // 마지막 수상자(0)는 아직 무대 가운데
    const home = posAt(0, 900);
    expect(home.x).toBeCloseTo(slotOf(5, 0).x, 1);
    advance(599);
    expect(Object.values(scene().seats).filter((l) => l.costume !== undefined)).toHaveLength(5);
    advance(1);
    expect(Object.values(scene().seats).filter((l) => l.costume !== undefined)).toHaveLength(0);
    expect(hookOf().costumes).toEqual({});
    expect(hookOf().dimmed).toEqual([3]);
    expect(hookOf().shown).toBe(-1);
  });

  it("일시정지: 확장 탭이 열리면 시계가 멈추고 [넘기기]가 숨는다 — 패는 그대로, 접으면 이어진다 (O-13)", () => {
    const r = arrive();
    advance(S + 1500);
    expect(hookOf().shown).toBe(0);
    act(() => void fireEvent.click(r.container.querySelector<HTMLElement>('[data-result-tab="mafia"]')!));
    expect(skipBtn(r.container)).toBeNull();
    advance(20_000);
    expect(hookOf().shown).toBe(0);
    expect(plate(r.container)!.dataset.awardId).toBe("whiff");
    expect(title(r.container)).toBe("시상식");
    act(() => stage.props!.onStageTap!()); // 무대 탭은 접기만
    expect(skipBtn(r.container)).not.toBeNull();
    expect(count(r.container)).toBe("1 / 5");
    advance(900); // 1500 + 900 = 2400 < 2500
    expect(hookOf().shown).toBe(0);
    advance(100);
    expect(count(r.container)).toBe("2 / 5");
  });

  it("진 팀 수상자: 패가 뜬 동안만 어둡지 않다 (창이 끝나면 다시 dim)", () => {
    const r = arrive();
    advance(S + 1000);
    expect(scene().seats[3]!.dim).toBeUndefined();
    advance(1500);
    expect(scene().seats[3]!.dim).toBe(true);
    r.unmount();
  });

  it("같은 결과가 다시 와도 되돌아가지 않고 타이머가 늘지 않는다 · 언마운트하면 타이머가 모두 정리된다", () => {
    const r = arrive();
    advance(S + 3000);
    const timers = vi.getTimerCount();
    r.rerenderRoom(makeView({ awards: AWARDS5 }));
    r.rerenderRoom(makeView({ awards: AWARDS5 }));
    expect(count(r.container)).toBe("2 / 5");
    expect(vi.getTimerCount()).toBe(timers);
    r.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("모션 줄이기: 앞 연출은 건너뛰고 시상식은 걷기·박수 없이 패만 2.5초씩, [넘기기]는 되고 끝나면 의상이 곧바로 돌아온다", async () => {
    await withReduced(() => {
      const r = arrive();
      expect(title(r.container)).toBe("시상식");
      expect(r.container.querySelector("[data-result-stage]")!.getAttribute("data-reveal")).toBe("false");
      advance(1000);
      expect(plate(r.container)!.dataset.awardId).toBe("whiff");
      expect(stage.props!.emoteCues ?? []).toEqual([]);
      // 아무도 걷지 않는다: 수상자도 자리 그대로
      const p3 = posAt(3, 900);
      expect(p3.x).toBeCloseTo(slotOf(5, 3).x, 6);
      expect(p3.z).toBeCloseTo(slotOf(5, 3).z, 6);
      advance(2400);
      expect(plate(r.container)!.dataset.awardId).toBe("spectator");
      act(() => void fireEvent.click(skipBtn(r.container)!));
      expect(count(r.container)).toBe("3 / 5");
      act(() => void fireEvent.click(plate(r.container) ?? skipBtn(r.container)!));
      act(() => void fireEvent.click(skipBtn(r.container)!));
      act(() => void fireEvent.click(skipBtn(r.container)!));
      expect(title(r.container)).toBe("시민 승리");
      expect(Object.values(scene().seats).filter((l) => l.costume !== undefined)).toHaveLength(0); // 즉시 look 복귀
      expect(stage.props!.emoteCues ?? []).toEqual([]);
    });
  });

  it("떠 있는 [넘기기] 묶음은 위 칸을 쓰고 루트에 패널 높이 변수(--mf-panel-h)를 둔다", () => {
    const r = arrive();
    advance(S + 10);
    const stack = r.container.querySelector("[data-float-stack]")!;
    expect(stack.hasAttribute("data-float-single")).toBe(false); // 두 칸 자리: 아래 칸은 11-12 의 [꾸미기]
    expect(stack.querySelectorAll("button")).toHaveLength(1);
    expect(r.container.querySelector<HTMLElement>("main.mf-result")!.style.getPropertyValue("--mf-panel-h")).not.toBe("");
  });
});

describe("기록 탭: 일차 카드 띠와 하루 상세 (11-11, D-8)", () => {
  const TL_JOBS: RoleId[] = ["mafia", "mafia", "police", "doctor", "citizen", "citizen"];
  const TL_SUMMARY: SummaryRow[] = [
    { n: 1, exec: { yes: 4, no: 1, passed: true, candidate: 4 }, night: { target: 2, died: false } },
    { n: 2, exec: { yes: 1, no: 3, passed: false, candidate: 2 }, night: { target: 3, died: true } },
  ];
  const TL_VOTES: VoteLogEntry[] = [
    { n: 1, exec: { yes: 4, no: 1, passed: true }, cand: { votes: [{ seat: 2, target: 4 }, { seat: 3, target: 4 }, { seat: 1, target: 2 }], candidate: 4 } },
    { n: 2, exec: { yes: 1, no: 3, passed: false }, cand: { votes: [{ seat: 0, target: 2 }], candidate: 2 } },
  ];
  const timelineView = (): RoomView => makeView({ count: 6, jobs: TL_JOBS, dead: [4, 3], summary: TL_SUMMARY, voteLog: TL_VOTES });
  const tabBtn = (c: ParentNode, id: string) => c.querySelector<HTMLElement>(`[data-result-tab="${id}"]`)!;
  const panelOf = (c: ParentNode) => c.querySelector<HTMLElement>("[data-result-panel]")!;

  it("탭을 열기 전에는 기록 DOM 이 없다 (카드도 상세도)", () => {
    const r = renderRoom(timelineView());
    expect(r.container.querySelector("[data-day-card]")).toBeNull();
    expect(r.container.querySelector("[data-day-detail]")).toBeNull();
  });

  it("기록 탭을 열면 확장 패널 안에 일차 카드 띠와 1일차 상세(지목 줄)가 그려지고 1일차가 선택돼 있다", () => {
    const r = renderRoom(timelineView());
    fireEvent.click(tabBtn(r.container, "log"));
    const panel = panelOf(r.container);
    expect(panel.getAttribute("data-expanded")).toBe("true");
    const cards = Array.from(panel.querySelectorAll<HTMLElement>("[data-day-card]"));
    expect(cards.map((c) => c.getAttribute("data-day-card"))).toEqual(["1", "2"]);
    expect(cards.map((c) => c.getAttribute("aria-pressed"))).toEqual(["true", "false"]);
    const detail = panel.querySelector("[data-day-detail]")!;
    expect(detail.getAttribute("data-day-detail")).toBe("1");
    expect(detail.querySelector("[data-row=pointing]")).not.toBeNull();
    // 처형된 4(시민) 의 직업 칩이 카드에 있다
    expect(cards[0]!.querySelector("[data-role-chip]")?.getAttribute("data-role-chip")).toBe("citizen");
  });

  it("다른 카드를 누르면 상세가 그 일차로 바뀐다", () => {
    const r = renderRoom(timelineView());
    fireEvent.click(tabBtn(r.container, "log"));
    fireEvent.click(r.container.querySelector("[data-day-card='2']")!);
    expect(r.container.querySelector("[data-day-detail]")?.getAttribute("data-day-detail")).toBe("2");
    expect(r.container.querySelector("[data-day-card='2']")?.getAttribute("aria-pressed")).toBe("true");
    expect(r.container.querySelector("[data-day-card='1']")?.getAttribute("aria-pressed")).toBe("false");
  });

  it("다른 탭으로 가면 기록 DOM 이 다시 없어진다", () => {
    const r = renderRoom(timelineView());
    fireEvent.click(tabBtn(r.container, "log"));
    fireEvent.click(tabBtn(r.container, "all"));
    expect(r.container.querySelector("[data-day-card]")).toBeNull();
  });

  type Listener = (e: RoomEvent, meta: { epoch: number }) => void;
  const withEvents = () => {
    let listener: Listener | null = null;
    const over: Partial<RoomConnection> = {
      onEvent: vi.fn((l: Listener) => {
        listener = l;
        return () => {};
      }),
    };
    return { over, emit: (e: RoomEvent) => act(() => void listener!(e, { epoch: 1 })) };
  };

  it("찬반·주장·귓속말 부분은 resultLog 프레임으로 받은 값이 하루 상세에 그려진다 (거짓 주장은 마피아만 is-lie)", () => {
    const { over, emit } = withEvents();
    const r = renderRoom(timelineView(), over);
    emit({ t: "resultLog", part: "claim", i: 0, end: true, lines: [{ seat: 0, n: 1, v: "citizen" }, { seat: 4, n: 1, v: "police" }] });
    emit({ t: "resultLog", part: "ballots", i: 0, end: true, lines: [{ n: 1, yes: [2, 3], no: [1] }] });
    emit({ t: "resultLog", part: "whisper", i: 0, end: true, lines: [{ seat: 2, to: 3, n: 1, text: "비밀", at: NOW }] });
    fireEvent.click(tabBtn(r.container, "log"));
    const detail = r.container.querySelector("[data-day-detail='1']")!;
    expect(Array.from(detail.querySelectorAll("[data-claim]")).map((e) => [e.getAttribute("data-claim"), e.classList.contains("is-lie")])).toEqual([["0", true], ["4", false]]);
    expect(detail.querySelector("[data-ballot=yes]")).not.toBeNull();
    expect(detail.querySelectorAll("[data-whisper-pair]")).toHaveLength(1);
    expect(((detail.textContent ?? "") + (r.container.querySelector("[data-timeline-strip]")?.textContent ?? "")).replace(/[\d\s]/g, "")).toBe("");
  });

  it("귓속말 쌍을 누르면 귓속말 탭으로 이동하고 그날 구분선이 몸통 맨 위에 오도록 스크롤한다", () => {
    const rect = (top: number) => ({ top, bottom: top + 20, left: 0, right: 0, width: 0, height: 20, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;
    const spy = vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      if (this.getAttribute("data-result-divider") !== null) return rect(Number(this.getAttribute("data-day")) * 100);
      return rect(0);
    });
    const { over, emit } = withEvents();
    const r = renderRoom(timelineView(), over);
    emit({ t: "resultLog", part: "whisper", i: 0, end: true, lines: [{ seat: 2, to: 3, n: 1, text: "하나", at: NOW }, { seat: 1, to: 0, n: 2, text: "둘", at: NOW + 1 }] });
    fireEvent.click(tabBtn(r.container, "log"));
    fireEvent.click(r.container.querySelector("[data-day-card='2']")!);
    fireEvent.click(r.container.querySelector("[data-day-detail='2'] [data-whisper-pair]")!);
    expect(panelOf(r.container).getAttribute("data-tab")).toBe("whisper");
    expect(r.container.querySelector("[data-day-card]")).toBeNull();
    expect(r.container.querySelector<HTMLElement>("[data-result-body=whisper]")!.scrollTop).toBe(200);
    spy.mockRestore();
  });

  it("기록 상세의 보이는 글자는 숫자뿐이다", () => {
    const r = renderRoom(timelineView());
    fireEvent.click(tabBtn(r.container, "log"));
    const body = r.container.querySelector("[data-result-body=log]")!;
    expect((body.textContent ?? "").replace(/[\d\s]/g, "")).toBe("");
  });
});

// ---------- 11-12 Task 1: 다시 하기 알약 (D-11, D-12) ----------
describe("다시 하기 알약 (11-12)", () => {
  const pillOf = (c: ParentNode) => c.querySelector<HTMLButtonElement>("[data-ready-pill]");
  const sentOf = (send: ReturnType<typeof vi.fn>) => send.mock.calls.map((c) => c[0] as { t: string });
  const executionView = (): RoomView => {
    const v = makeView();
    v.phase = "execution";
    delete (v as { result?: unknown }).result;
    v.day = { ...v.day!, candidate: 3, execution: { seat: 3 } };
    return v;
  };

  it("입력줄 오른쪽 끝(보내기 뒤)에 알약 하나가 있다 — 손님은 '준비' 토글", () => {
    const r = renderRoom(makeView({ me: 1, ready: [0] }));
    const pill = pillOf(r.container)!;
    expect(pill).not.toBeNull();
    expect(pill.closest("[data-chat-trailing]")).not.toBeNull();
    expect(pill.textContent).toBe("준비");
    expect(pill.getAttribute("data-ready")).toBe("false");
    expect(r.container.querySelectorAll("[data-ready-pill]")).toHaveLength(1);
  });

  it("손님이 누르면 { t:'ready', on:true, round } 가 나가고, 서버 state 가 오면 '준비됨' 으로 바뀐다", () => {
    const r = renderRoom(makeView({ me: 1, ready: [0], round: 2 }));
    fireEvent.click(pillOf(r.container)!);
    expect(sentOf(r.send).filter((m) => m.t === "ready")).toEqual([{ t: "ready", on: true, round: 2 }]);
    expect(pillOf(r.container)!.getAttribute("data-ready")).toBe("false"); // 낙관적으로 바꾸지 않는다
    r.rerenderRoom(makeView({ me: 1, ready: [0, 1], round: 2 }));
    expect(pillOf(r.container)!.getAttribute("data-ready")).toBe("true");
    expect(pillOf(r.container)!.getAttribute("aria-label")).toBe("준비됨, 눌러서 취소");
  });

  it("방장은 '시작' 과 'n / m' 두 줄 — n 은 준비한 연결된 사람, m 은 연결된 사람", () => {
    const r = renderRoom(makeView({ count: 5, me: 0, ready: [0, 1, 2], offline: [4] }));
    const pill = pillOf(r.container)!;
    expect(pill.getAttribute("data-ready-count")).toBe("3/4");
    expect(text(pill)).toBe("시작3 / 4");
    expect(pill.getAttribute("aria-label")).toBe("다음 판 시작, 3명 준비");
    expect(pill.getAttribute("data-dim")).toBe("true"); // 3 < 4
  });

  it("방장이 4명 미만에서 누르면 토스트 '4명부터 시작해요' 만 — rematch 는 나가지 않는다", () => {
    const r = renderRoom(makeView({ count: 5, me: 0, ready: [0, 1] }));
    fireEvent.click(pillOf(r.container)!);
    expect(sentOf(r.send).filter((m) => m.t === "rematch")).toEqual([]);
    expect(r.container.querySelector(".mv-toast")?.textContent).toBe("4명부터 시작해요");
  });

  it("방장이 모두 준비한 상태에서 누르면 확인 없이 { t:'rematch', round } 를 보낸다", () => {
    const r = renderRoom(makeView({ count: 5, me: 0, ready: [0, 1, 2, 3, 4], round: 3 }));
    fireEvent.click(pillOf(r.container)!);
    expect(sentOf(r.send).filter((m) => m.t === "rematch")).toEqual([{ t: "rematch", round: 3 }]);
  });

  it("준비한 좌석의 이름표에 체크(done, '준비됨')가 모두에게 같게 붙는다", () => {
    renderRoom(makeView({ count: 5, me: 1, ready: [0, 2] }));
    const tag = (seat: number) => stage.props!.tagProps!(seat) as { done?: boolean; doneLabel?: string };
    expect(tag(0)).toMatchObject({ done: true, doneLabel: "준비됨" });
    expect(tag(2)).toMatchObject({ done: true, doneLabel: "준비됨" });
    expect(tag(1).done).toBeUndefined();
    expect(tag(3).done).toBeUndefined();
  });

  it("승리 조명(4600) 전에는 알약이 비활성이고 눌러도 아무 일 없다 — 4600 이 되면 활성", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const r = renderRoom(executionView());
    r.rerenderRoom(makeView({ me: 1, ready: [0] }));
    const pill = pillOf(r.container)!;
    expect(pill.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(pill);
    expect(sentOf(r.send).filter((m) => m.t === "ready")).toEqual([]);
    act(() => void vi.advanceTimersByTime(4600));
    expect(pillOf(r.container)!.getAttribute("aria-disabled")).toBeNull();
    fireEvent.click(pillOf(r.container)!);
    expect(sentOf(r.send).filter((m) => m.t === "ready")).toHaveLength(1);
  });

  it("확장 탭에서는 입력줄이 숨고 알약만 남는다 (ResultPanel 의 pill 자리)", () => {
    const r = renderRoom(makeView({ me: 1, ready: [0] }));
    fireEvent.click(r.container.querySelector("[data-result-tab='mafia']")!);
    expect(r.container.querySelector("[data-chat-trailing]")).toBeNull();
    expect(r.container.querySelector("[data-chat-input]")).toBeNull();
    const pill = pillOf(r.container)!;
    expect(pill.closest(".mf-result__pill")).not.toBeNull();
    expect(r.container.querySelectorAll("[data-ready-pill]")).toHaveLength(1);
  });

  it("끊기면(canSend 거짓) 알약을 눌러도 아무것도 보내지 않는다", () => {
    const r = renderRoom(makeView({ me: 1, ready: [0] }), { canSend: false });
    fireEvent.click(pillOf(r.container)!);
    expect(sentOf(r.send)).toEqual([]);
  });
});

// ---------- 11-12 Task 2: 쉬게 될 사람 확인·쉬었던 사람(sat)·꾸미기·방장 이양 알림 (D-13, D-16, D-17) ----------
describe("쉬게 될 사람 확인 시트 (11-12, D-12)", () => {
  const pillOf = (c: ParentNode) => c.querySelector<HTMLButtonElement>("[data-ready-pill]")!;
  const dialogOf = (c: ParentNode) => c.querySelector("dialog");
  const btn = (d: Element, label: string) => Array.from(d.querySelectorAll<HTMLButtonElement>("button")).find((b) => b.textContent === label)!;
  const rematches = (send: ReturnType<typeof vi.fn>) => send.mock.calls.map((c) => c[0] as { t: string }).filter((m) => m.t === "rematch");
  // 7명: 방장 포함 준비 4명(0~3), 미준비 둘(4 연결, 5 sat) + 끊긴 6
  const mixed = () => makeView({ count: 7, me: 0, ready: [0, 1, 2, 3], sat: [7], offline: [6], round: 2 });

  it("준비 안 한 연결된 사람이 있으면 시트가 뜬다: 얼굴(닉네임은 alt)·'이번 판은 쉬어요'·[시작][취소]", () => {
    const r = renderRoom(mixed());
    fireEvent.click(pillOf(r.container));
    const d = dialogOf(r.container)!;
    expect(d).not.toBeNull();
    expect(rematches(r.send)).toEqual([]); // 아직 안 보냈다
    const faces = Array.from(d.querySelectorAll<HTMLImageElement>("img[data-rest-face]"));
    expect(faces.map((f) => f.getAttribute("alt"))).toEqual(["서연", "수빈", "지호"]); // 연결된 미준비자(sat 포함), 끊긴 사람(하준)은 아니다
    expect(text(d.querySelector("h2"))).toBe("이번 판은 쉬어요");
    expect(btn(d, "시작")).toBeTruthy();
    expect(btn(d, "취소")).toBeTruthy();
    // 이름 글자는 보이지 않는다(얼굴 + 한 줄)
    for (const name of ["서연", "수빈", "지호"]) expect(text(d)).not.toContain(name);
  });

  it("[취소] 는 닫기만 한다", () => {
    const r = renderRoom(mixed());
    fireEvent.click(pillOf(r.container));
    fireEvent.click(btn(dialogOf(r.container)!, "취소"));
    act(() => void vi.advanceTimersByTime(300));
    expect(dialogOf(r.container)).toBeNull();
    expect(rematches(r.send)).toEqual([]);
  });

  it("[시작] 은 rematch 를 한 번 보내고 닫는다 — 2초 안에 다시 눌러도 더 보내지 않는다", () => {
    const r = renderRoom(mixed());
    fireEvent.click(pillOf(r.container));
    fireEvent.click(btn(dialogOf(r.container)!, "시작"));
    expect(rematches(r.send)).toEqual([{ t: "rematch", round: 2 }]);
    act(() => void vi.advanceTimersByTime(300));
    expect(dialogOf(r.container)).toBeNull();
    fireEvent.click(pillOf(r.container));
    expect(rematches(r.send)).toHaveLength(1);
    expect(dialogOf(r.container)).toBeNull();
  });

  it("얼굴은 쉬게 될 사람 수만큼 (8명 방에서 준비 4 → 4개)", () => {
    const r = renderRoom(makeView({ count: 8, me: 0, ready: [0, 1, 2, 3] }));
    fireEvent.click(pillOf(r.container));
    expect(dialogOf(r.container)!.querySelectorAll("img[data-rest-face]")).toHaveLength(4);
  });

  it("n 이 4 미만이면 시트가 아니라 토스트", () => {
    const r = renderRoom(makeView({ count: 7, me: 0, ready: [0, 1] }));
    fireEvent.click(pillOf(r.container));
    expect(dialogOf(r.container)).toBeNull();
  });
});

describe("쉬었던 사람(sat) 표시 (11-12, D-13, UI-SPEC A-5)", () => {
  it("sat 는 장면에 반투명 0.5 로 서고 직업 의상·어둠·칩이 없다", () => {
    renderRoom(makeView({ count: 5, sat: [5], me: 1 }));
    const s = scene().seats;
    expect(Object.keys(s).map(Number)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(s[5]).toEqual({ show: true, ghost: false, opacity: 0.5 });
    for (const seat of [0, 1, 2, 3, 4]) expect(s[seat]).not.toHaveProperty("opacity");
  });

  it("sat 는 참가자 링에 들지 않는다: 참가자 5명의 링 자리는 그대로이고 sat 는 그 바깥에 선다", () => {
    renderRoom(makeView({ count: 5, sat: [5], me: 1 }));
    const store = stage.props!.store;
    const ring = ringSlots(5);
    for (let seat = 0; seat < 5; seat++) {
      const p = store.positionOf(seat, Date.now())!;
      expect(p.x).toBeCloseTo(ring[seat]![0] / 100, 1);
      expect(p.z).toBeCloseTo(ring[seat]![1] / 100, 1);
    }
    const sat = store.positionOf(5, Date.now())!;
    expect(Math.hypot(sat.x, sat.z)).toBeGreaterThan(3);
  });

  it("sat 의 이름표에는 직업 칩이 없다 (참가자만 칩)", () => {
    const r = renderRoom(makeView({ count: 5, sat: [5], me: 1 }));
    expect(chips(r.container)).toHaveLength(5);
    expect(stage.props!.tagProps!(5).role).toBeUndefined();
  });

  it("sat 도 알약은 손님과 같고, 준비하면 이름표 체크가 붙는다", () => {
    const r = renderRoom(makeView({ count: 5, sat: [5], me: 5, ready: [0, 5] }));
    const pill = r.container.querySelector<HTMLElement>("[data-ready-pill]")!;
    expect(pill.getAttribute("data-ready")).toBe("true");
    expect(stage.props!.tagProps!(5)).toMatchObject({ done: true, doneLabel: "준비됨" });
  });

  it("훅 window.__mfResult.sat 에 sat 좌석이 실린다 (참가자는 없다)", () => {
    renderRoom(makeView({ count: 5, sat: [5], me: 1 }));
    expect((window as unknown as { __mfResult: { sat: number[] } }).__mfResult.sat).toEqual([5]);
  });

  it("sat 가 없으면 장면 좌석은 참가자뿐이고 훅 sat 는 빈 배열", () => {
    renderRoom(makeView({ count: 5 }));
    expect(Object.keys(scene().seats)).toHaveLength(5);
    expect((window as unknown as { __mfResult: { sat: number[] } }).__mfResult.sat).toEqual([]);
  });
});

describe("결과 단계 꾸미기 (11-12, D-16)", () => {
  const dress = (c: ParentNode) => c.querySelector<HTMLElement>('[data-float="dress"]');
  const skip = (c: ParentNode) => c.querySelector<HTMLElement>('[data-float="skip"]');
  const AW = [{ seat: 3, award: "whiff" as const, k: 2 }, { seat: 0, award: "survivor" as const }];
  const executionView = (): RoomView => {
    const v = makeView();
    v.phase = "execution";
    delete (v as { result?: unknown }).result;
    v.day = { ...v.day!, candidate: 3, execution: { seat: 3 } };
    return v;
  };
  const advance = (ms: number) => {
    let left = ms;
    while (left > 0) {
      const into = (Date.now() - NOW) % 100;
      const step = Math.min(left, into === 0 ? 100 : 100 - into);
      act(() => void vi.advanceTimersByTime(step));
      left -= step;
    }
  };

  it("시상식이 없는 최종 상태: 아래 칸에 [꾸미기]가 있고 [넘기기]는 없다", () => {
    const r = renderRoom(makeView({ me: 1 }));
    expect(dress(r.container)).not.toBeNull();
    expect(dress(r.container)!.getAttribute("aria-label")).toBe("꾸미기");
    expect(skip(r.container)).toBeNull();
  });

  it("시상 중에는 위 칸 [넘기기]만 있고 [꾸미기]는 없다 — 끝나면 [꾸미기]가 나타나고 [넘기기]는 사라진다", () => {
    const r = renderRoom(executionView());
    r.rerenderRoom(makeView({ awards: AW }));
    advance(5600 + 100);
    expect(skip(r.container)).not.toBeNull();
    expect(dress(r.container)).toBeNull();
    advance(5000 + 700); // 두 창(2500 × 2) + 의상 복귀
    expect(skip(r.container)).toBeNull();
    expect(dress(r.container)).not.toBeNull();
  });

  it("연출 중(5600 전)에도 [꾸미기]는 없다", () => {
    const r = renderRoom(executionView());
    r.rerenderRoom(makeView());
    advance(2000);
    expect(dress(r.container)).toBeNull();
  });

  it("[꾸미기]를 누르면 DressSheet 가 열리고 떠 있는 버튼은 숨는다 — 카드를 고르면 { t:'dress', look } 가 간다", () => {
    const r = renderRoom(makeView({ me: 1 }));
    fireEvent.click(dress(r.container)!);
    const cards = Array.from(r.container.querySelectorAll<HTMLElement>("button[data-outfit]"));
    expect(cards.length).toBeGreaterThan(1);
    expect(dress(r.container)).toBeNull();
    const other = cards.find((c) => c.getAttribute("aria-pressed") !== "true")!;
    fireEvent.click(other);
    act(() => void vi.advanceTimersByTime(300));
    expect(r.send.mock.calls.map((c) => c[0] as { t: string }).filter((m) => m.t === "dress")).toEqual([{ t: "dress", look: other.getAttribute("data-outfit") }]);
  });

  it("확장 탭이 열려 있으면 떠 있는 버튼 열 전체가 숨는다", () => {
    const r = renderRoom(makeView({ me: 1 }));
    fireEvent.click(r.container.querySelector("[data-result-tab='mafia']")!);
    expect(dress(r.container)).toBeNull();
    expect(r.container.querySelector("[data-float-stack]")).toBeNull();
  });

  it("꾸미기 시트는 의상 카드만이다 (지도 탭은 11-13 몫)", () => {
    const r = renderRoom(makeView({ me: 1 }));
    fireEvent.click(dress(r.container)!);
    expect(r.container.querySelectorAll("[data-map-card], [data-map-tab]")).toHaveLength(0);
  });
});

describe("방장 이양 알림 (11-12, D-17)", () => {
  it("방장이 다른 좌석으로 바뀐 view 를 받으면 위 알림 '방장 · {닉네임}' (crown)", () => {
    const r = renderRoom(makeView({ me: 1, hostSeat: 0 }));
    expect(r.container.querySelector(".mv-toast")?.textContent).toBe(""); // 첫 스냅샷에는 없다
    r.rerenderRoom(makeView({ me: 1, hostSeat: 1 }));
    const toast = r.container.querySelector(".mv-toast")!;
    expect(toast.textContent).toBe("방장 · 하윤");
    expect(toast.querySelector("svg")).not.toBeNull();
  });

  it("새 방장의 알약이 [시작] 으로 바뀐다", () => {
    const r = renderRoom(makeView({ me: 1, hostSeat: 0, ready: [0] }));
    expect(r.container.querySelector("[data-ready-pill]")!.hasAttribute("data-ready-count")).toBe(false);
    r.rerenderRoom(makeView({ me: 1, hostSeat: 1, ready: [0, 1] }));
    expect(r.container.querySelector("[data-ready-pill]")!.getAttribute("data-ready-count")).toBe("2/5");
  });

  it("방장이 그대로인 새 view 에는 알림이 없다. 입장·퇴장 알림은 결과 단계에 없다", () => {
    const r = renderRoom(makeView({ me: 1, hostSeat: 0 }));
    r.rerenderRoom(makeView({ me: 1, hostSeat: 0, count: 6 }));
    expect(r.container.querySelector(".mv-toast")?.textContent).toBe("");
  });

  it("기록 칸에 crown 줄을 남기지 않는다 (대기실 전용)", () => {
    const r = renderRoom(makeView({ me: 1, hostSeat: 0 }));
    r.rerenderRoom(makeView({ me: 1, hostSeat: 1 }));
    expect(r.container.querySelector(".mv-chat__sys")).toBeNull();
  });
});

describe("결과 단계 지도 칩과 맵 탭 (11-13, D-20·O-11)", () => {
  let restore = () => {};
  beforeEach(() => {
    restore = openPlaza();
  });
  afterEach(() => restore());
  const chip = (c: ParentNode) => c.querySelector<HTMLElement>("[data-map-chip]");
  const withMap = (v: RoomView, mapChoice: "bar" | "plaza" | "random", map?: "bar" | "plaza"): RoomView => ({ ...v, mapChoice, ...(map ? { map } : {}) });

  it("칩은 모두에게 보이고 서버의 mapChoice(random 이 정해진 뒤에도 choice, 결과 map 은 노출하지 않음)를 따른다", () => {
    for (const [me, choice, map, name] of [[0, "plaza", undefined, "맵 광장"], [1, "random", "plaza", "맵 랜덤"], [1, "bar", "bar", "맵 재즈 바"]] as const) {
      const r = renderRoom(withMap(makeView({ me }), choice, map));
      expect(chip(r.container)?.getAttribute("aria-label")).toBe(name);
      r.unmount();
    }
  });

  it("mapChoice 가 없는 옛 view 는 랜덤으로 읽는다", () => {
    const r = renderRoom(makeView());
    expect(chip(r.container)?.getAttribute("aria-label")).toBe("맵 랜덤");
  });

  it("방장이 누르면 맵 탭으로 시트가 열리고 카드를 누르면 {t:'mapPick', map} 만 간다 — 서버 값이 오기 전에는 바뀌지 않는다", () => {
    const r = renderRoom(makeView({ me: 0 }));
    fireEvent.click(chip(r.container)!);
    expect(r.container.querySelectorAll("button[data-map-card]")).toHaveLength(3);
    expect(r.container.querySelectorAll("button[data-map-tab]")).toHaveLength(2);
    r.send.mockClear();
    fireEvent.click(r.container.querySelector("button[data-map-card='plaza']")!);
    expect(r.send.mock.calls.map((c) => c[0])).toEqual([{ t: "mapPick", map: "plaza" }]);
    expect(chip(r.container)?.getAttribute("aria-label")).toBe("맵 랜덤");
    r.rerenderRoom(withMap(makeView({ me: 0 }), "plaza"));
    expect(chip(r.container)?.getAttribute("aria-label")).toBe("맵 광장");
    expect(r.container.querySelector("button[data-map-card='plaza']")?.getAttribute("aria-pressed")).toBe("true");
  });

  it("방장이 [꾸미기]로 열면 의상 탭이고 탭 둘이 있다", () => {
    const r = renderRoom(makeView({ me: 0 }));
    fireEvent.click(r.container.querySelector<HTMLElement>("[data-float='dress']")!);
    expect(r.container.querySelectorAll("button[data-outfit]")).toHaveLength(9);
    expect(r.container.querySelectorAll("button[data-map-tab]")).toHaveLength(2);
  });

  it("손님은 눌러도 시트가 열리지 않고(aria-disabled), 꾸미기 시트에 탭이 없다", () => {
    const r = renderRoom(makeView({ me: 1 }));
    expect(chip(r.container)?.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(chip(r.container)!);
    expect(r.container.querySelector("[data-dress-sheet]")).toBeNull();
    fireEvent.click(r.container.querySelector<HTMLElement>("[data-float='dress']")!);
    expect(r.container.querySelector("[data-map-tab]")).toBeNull();
  });

  it("칩은 시상식·연출 중에도 보이고(헤더 아래 자리), 눌러도 연출 단계가 되돌아가지 않는다", () => {
    const r = renderRoom(makeView({ me: 0, awards: [{ seat: 3, award: "whiff" as const, k: 2 }, { seat: 0, award: "survivor" as const }] }));
    expect(chip(r.container)).not.toBeNull();
    expect(r.container.querySelector(".mf-result__map [data-map-chip]")).not.toBeNull();
    const stageBefore = r.container.querySelector("main")!.getAttribute("data-result-stage");
    fireEvent.click(chip(r.container)!);
    expect(r.container.querySelector("main")!.getAttribute("data-result-stage")).toBe(stageBefore);
  });

  it("허용 맵이 하나뿐이면 칩이 없다", () => {
    restore();
    const list = PLAYABLE_MAPS as MapId[];
    const saved = [...list];
    list.splice(0, list.length, "bar");
    try {
      const r = renderRoom(makeView());
      expect(chip(r.container)).toBeNull();
    } finally {
      list.splice(0, list.length, ...saved);
      restore = openPlaza();
    }
  });
});
