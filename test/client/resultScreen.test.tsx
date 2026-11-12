/// <reference types="node" />
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { phaseKey } from "../../shared/game/audience";
import { ringSlots } from "../../shared/game/gather";
import type { RoleId } from "../../shared/game/roles";
import type { AwardLine, GameMode, GameWinner, MapId, RoomView, SummaryRow, VoteLogEntry } from "../../shared/protocol";
import { PLAYABLE_MAPS } from "../../shared/game/maps";
import type { WorldStageProps } from "../../src/components/WorldStage";
import type { ResultPanelProps } from "../../src/components/v2/ResultPanel";
import type { RoomConnection, RoomEvent } from "../../src/net/useRoomConnection";
import { LOG_H } from "../../src/game/chatUi";
import { RESULT_TABS_SHOWN } from "../../src/game/resultText";
import { GATHER_CENTER } from "../../src/world/camera";
import { openPlaza } from "../helpers/playable";

// 결과 화면(11-05, 결정 D-1·D-11): 3D 무대(WorldStage) 위의 한 장면. WorldStage 는 받은 props 를 쥐고 tagProps 의 직업 칩만 그리는 가짜다
// (캔버스·런타임·의상 적용은 worldStage.test 몫). RoomScreen 의 연결 훅은 반환값을 시험이 정하는 가짜다.
const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));

// 12-11: 결과 사건 신호(result)를 가로채 모은다 — 처리기는 그대로 불러 RoomScreen 의 소리 훅 동작은 바뀌지 않는다
const sigs = vi.hoisted(() => ({ got: [] as { kind: string; [k: string]: unknown }[] }));
vi.mock("../../src/audio/signals", async (importOriginal) => {
  const m = await importOriginal<typeof import("../../src/audio/signals")>();
  return {
    ...m,
    emitSignal: (s: Parameters<typeof m.emitSignal>[0]) => {
      sigs.got.push(s as unknown as { kind: string });
      m.emitSignal(s);
    },
  };
});

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

// 19-05: 진짜 ResultPanel 을 그대로 그리되 받은 props 를 쥔다(DOM 은 달라지지 않는다). 탭 행이 숨은 뒤(18.1)로는 화면 조작으로 기록 늘림(expanded)에 닿을 수 없어,
// 그 경로를 보는 시험만 onTab 을 직접 부른다
const panel = vi.hoisted(() => ({ props: null as null | ResultPanelProps }));
vi.mock("../../src/components/v2/ResultPanel", async (importOriginal) => {
  const m = await importOriginal<typeof import("../../src/components/v2/ResultPanel")>();
  const { createElement } = await import("react");
  return {
    ...m,
    ResultPanel: (props: ResultPanelProps) => {
      panel.props = props;
      return createElement(m.ResultPanel, props);
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
  panel.props = null;
  sigs.got.length = 0;
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

  it("모든 사람(산 사람·탈락자)을 그린다: seats 의 show true, 탈락자만 ghost(직업 의상 없음), 산 사람은 직업 의상이 입혀져 있다", () => {
    renderRoom(makeView({ dead: [2] }));
    const seats = scene().seats;
    expect(Object.keys(seats).map(Number)).toEqual([0, 1, 2, 3, 4]);
    expect(Object.values(seats).every((l) => l.show === true)).toBe(true);
    expect(Object.values(seats).map((l) => l.ghost)).toEqual([false, false, true, false, false]);
    expect(Object.values(seats).map((l) => l.costume)).toEqual(["coat", "police", undefined, "mafia", "coat"]);
    expect("costume" in seats[2]!).toBe(false);
  });

  it("탈락한 진 팀 좌석은 유령 그림 그대로 어둡다 — 의상 키 없이 ghost 와 dim 만 (0083-2)", () => {
    renderRoom(makeView({ dead: [3] }));
    expect(scene().seats[3]).toEqual({ show: true, ghost: true, dim: true });
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
    expect(screen.queryByRole("button", { name: /내 역할/ })).toBeNull();
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

  it("헤더 [나가기] 는 글 없는 아이콘 단추이고 이름은 aria-label '나가기' 다(TOOL-04)", () => {
    const r = renderRoom(makeView());
    const btn = r.container.querySelector<HTMLElement>(".mf-result__header button");
    expect(btn?.hasAttribute("data-tool-label")).toBe(false);
    expect(btn?.getAttribute("aria-label")).toBe("나가기");
    expect(btn?.querySelector(".mv-tool__label")).toBeNull();
    expect(btn?.textContent).toBe("");
    expect(btn?.querySelector("svg")).not.toBeNull();
    expect(btn?.classList.contains("mv-tool")).toBe(true);
  });

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
    expect(Object.keys(hook!).sort()).toEqual(["chips", "costumes", "dimmed", "sat", "stage", "tab"]); // 시상 필드(awards·shown)는 없다(0083-7)
    expect(hook).toEqual({ stage: "final", chips: 5, dimmed: [3], costumes: { 0: "coat", 1: "police", 3: "mafia", 4: "coat" }, tab: "all", sat: [] });
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

  it("탈락자는 연출 처음부터 유령 그림이고 뒤집힌 뒤에도 의상이 없다 — 직업 표식은 순서대로 뒤집힌다 (0083-2)", () => {
    const r = reveal({ dead: [2] });
    expect(scene().seats[2]!.ghost).toBe(true);
    expect("costume" in scene().seats[2]!).toBe(false);
    advance(1200 + 400 * 2); // 0·1·2 번이 뒤집힌 시각
    expect(chips(r.container).map((c) => c.dataset.roleChip)).toEqual(["citizen", "police", "doctor"]);
    expect(scene().seats[2]!.ghost).toBe(true);
    expect("costume" in scene().seats[2]!).toBe(false);
    expect(costumeCount()).toBe(2); // 산 좌석 0·1 만 직업 의상
    expect(Object.keys(hookOf().costumes).map(Number)).toEqual([0, 1]);
    advance(5600);
    expect(Object.keys(hookOf().costumes).map(Number)).toEqual([0, 1, 3, 4]);
    expect(chips(r.container)).toHaveLength(5);
  });

  it("1200+400i 마다 한 명씩 늘어난다 (좌석 오름차순), 4600 전까지 flip", () => {
    const r = reveal();
    advance(1200);
    for (let i = 1; i < 5; i++) {
      advance(399);
      expect(chips(r.container)).toHaveLength(i);
      advance(1);
      expect(chips(r.container)).toHaveLength(i + 1);
      expect(costumeCount()).toBe(i + 1 - (i + 1 >= 3 ? 1 : 0)); // 탈락한 2 번은 의상이 없다
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
    expect(hookOf().costumes).toEqual({ 0: "coat", 1: "police", 3: "mafia", 4: "coat" });
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
  it("시상 패 규칙·keyframes 와 [넘기기] 진행 숫자 규칙이 없다 (0083-7) — 가운데 승리 알림·헤더 제목·아이콘 규칙은 그대로다", () => {
    expect(css).not.toMatch(/award/i);
    expect(readFileSync("src/styles/v2.css", "utf8")).not.toContain("mv-float__count");
    expect(css).toContain(".mf-result__announce");
    expect(css).toContain(".mf-result__title");
    expect(css).toContain(".mf-result__title-icon");
  });
  it("시상 부품·문구 모듈과 [넘기기] 종류·진행 숫자 속성이 저장소에 없다 (0083-7)", () => {
    // 이름을 쪼개 적는다 — 저장소에 남은 참조가 0 인지 grep 으로 확인하는 검사에 이 시험이 걸리지 않게
    const gone = [["src/components/v2/Aw", "ardPlate.tsx"], ["src/game/aw", "ardText.ts"], ["test/client/aw", "ardPlate.test.tsx"], ["test/unit/aw", "ardText.test.ts"]].map((p) => p.join(""));
    for (const f of gone) expect(existsSync(f), f).toBe(false);
    const float = readFileSync("src/components/v2/FloatAction.tsx", "utf8");
    expect(float).not.toContain('"skip"');
    expect(float).not.toContain("data-float-count");
  });
  it("전이·애니메이션은 opacity·transform 만 쓴다", () => {
    const frames = [...css.matchAll(/@keyframes[^{]+\{([\s\S]*?\n)\}/g)].map((m) => m[1]!).join("\n");
    for (const prop of ["width", "height", "top", "left", "margin", "padding"]) expect(frames, prop).not.toMatch(new RegExp(`\\b${prop}\\s*:`));
  });
});

// ---------- 18.1-05: 결과 화면은 전체 대화 하나 — 탭·역할별 기록 숨김 (R5, P181-7). 옛 11-07·11-11 탭 시험은 이 describe 로 바뀌었다 ----------
describe("결과 화면 기록 숨김 (18.1 R5, P181-7)", () => {
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
  const panelOf = (c: ParentNode) => c.querySelector<HTMLElement>("[data-result-panel]")!;
  const chatFrame = (part: "mafia" | "ghost", lines: { seat: number; n: number; text: string }[]): RoomEvent => ({ t: "resultLog", part, i: 0, end: true, lines: lines.map((l, k) => ({ ...l, at: NOW + k })) });
  const feedAll = () => {
    emit(chatFrame("mafia", [{ seat: 3, n: 1, text: "오늘 밤은 지우" }, { seat: 3, n: 2, text: "다음은 하윤" }]));
    emit(chatFrame("ghost", [{ seat: 2, n: 2, text: "억울해" }]));
    emit({ t: "resultLog", part: "whisper", i: 0, end: true, lines: [{ seat: 0, to: 1, n: 1, text: "비밀이야", at: NOW }] });
    emit({ t: "resultLog", part: "claim", i: 0, end: true, lines: [{ seat: 0, n: 1, v: "citizen" }] });
    emit({ t: "resultLog", part: "ballots", i: 0, end: true, lines: [{ n: 1, yes: [2, 3], no: [1] }] });
  };
  /** 탭·기록 본문·역할별 줄이 하나도 없다 */
  const expectOnlyAllChat = (c: ParentNode) => {
    expect(c.querySelector(".mf-result__tabs")).toBeNull();
    expect(c.querySelector("[role=tablist]")).toBeNull();
    expect(c.querySelector("[data-result-tab]")).toBeNull();
    expect(c.querySelector("[data-result-body]")).toBeNull();
    expect(c.querySelector('[data-ch="mafia"]')).toBeNull();
    expect(c.querySelector('[data-ch="ghost"]')).toBeNull();
    expect(c.querySelector("[data-result-whisper]")).toBeNull();
    expect(c.querySelector("[data-day-card]")).toBeNull();
    expect(c.querySelector("[data-day-detail]")).toBeNull();
    expect(panelOf(c).getAttribute("data-expanded")).toBe("false");
    expect(c.querySelector("[data-chat-input]")).not.toBeNull();
    expect(c.querySelector("[data-ready-pill]")).not.toBeNull();
  };

  it("연결 구독은 한 번 — resultLog 도 같은 구독으로 받는다", () => {
    const r = renderRoom(makeView(), onEvent());
    expect((connectionMock.current as RoomConnection).onEvent).toHaveBeenCalledTimes(1);
    r.unmount();
  });

  it("마피아·유령·귓속말·주장·찬반 프레임을 모두 받아도 탭 행·기록 본문·역할별 줄 글자가 DOM 에 없다 (E1)", () => {
    const r = renderRoom(makeView(), onEvent());
    feedAll();
    expectOnlyAllChat(r.container);
    for (const t of ["오늘 밤은 지우", "다음은 하윤", "억울해", "비밀이야"]) expect(text(r.container)).not.toContain(t);
  });

  it("window.__mfResult.tab 은 늘 all 이다", () => {
    renderRoom(makeView(), onEvent());
    const hook = (window as unknown as { __mfResult?: { tab?: string } }).__mfResult!;
    feedAll();
    expect(hook.tab).toBe("all");
  });

  it("연출 마운트: 4600ms 이후까지 탭 행이 한 번도 나타나지 않는다(첫 뒤집기 1200ms 포함)", () => {
    const r = renderRoom(executionView(), onEvent());
    r.rerenderRoom(makeView(), onEvent());
    for (const ms of [0, 1199, 1, 1, 2000, 1400, 1000]) {
      advance(ms);
      expect(r.container.querySelector("[data-result-tab]")).toBeNull();
      expect(r.container.querySelector(".mf-result__tabs")).toBeNull();
    }
    feedAll();
    expectOnlyAllChat(r.container);
  });

  it("건너뛰기·재접속·모션 줄이기에서도 탭 행이 없다", () => {
    const r = renderRoom(executionView(), onEvent());
    r.rerenderRoom(makeView(), onEvent());
    advance(300);
    act(() => stage.props!.onStageTap!());
    expectOnlyAllChat(r.container);
    r.unmount();
    expectOnlyAllChat(renderRoom(makeView(), onEvent()).container);
    cleanup();
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} }));
    const m = renderRoom(executionView(), onEvent());
    m.rerenderRoom(makeView(), onEvent());
    expect(m.container.querySelector("[data-result-tab]")).toBeNull();
    vi.unstubAllGlobals();
  });

  it("기록 칸 높이는 게임 채팅 패널과 같은 68 한 값이다 — 방 높이로 가르지 않는다 (B 계약 5, E2)", () => {
    const orig = window.innerHeight;
    try {
      for (const h of [600, 900]) {
        Object.defineProperty(window, "innerHeight", { configurable: true, value: h });
        const r = renderRoom(makeView(), onEvent());
        const log = r.container.querySelector<HTMLElement>("[data-chat-log]")!;
        expect(log.style.height).toBe(`${LOG_H}px`)
        expect(LOG_H).toBe(68);
        r.unmount();
      }
    } finally {
      Object.defineProperty(window, "innerHeight", { configurable: true, value: orig });
    }
  });

  it("보이는 탭 상수는 전체 하나이고 확장·시계 정지 경로에 닿지 않는다 — 무대 탭은 건너뛰기만 한다", () => {
    expect([...RESULT_TABS_SHOWN]).toEqual(["all"]);
    const r = renderRoom(executionView(), onEvent());
    r.rerenderRoom(makeView(), onEvent());
    advance(1500);
    act(() => stage.props!.onStageTap!());
    expect(panelOf(r.container).getAttribute("data-expanded")).toBe("false");
    expect((window as unknown as { __mfResult: { stage: string } }).__mfResult.stage).toBe("light");
  });
});

// ---------- 18.1-16: 결과 화면에는 시상식이 없다 (G-18.1-4, 결정 0083-7) — 서버가 칭호를 보내도 화면은 읽지도 그리지도 않는다 ----------
describe("시상식 없는 결과 (18.1-16, 0083-7)", () => {
  // 좌석 0 시민 · 1 경찰 · 2 의사(탈락) · 3 마피아 · 4 시민, 시민 승. 서버가 보낸 칭호 넷(화면은 쓰지 않는다)
  const AWARDS4: AwardLine[] = [
    { seat: 3, award: "whiff", k: 2 },
    { seat: 2, award: "spectator", k: 1, at: "night" },
    { seat: 1, award: "detective", k: 1 },
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
    r.rerenderRoom(makeView({ awards: AWARDS4, ...opts }));
    return r;
  };
  // 표시각(100ms 배수)마다 React 가 그리도록 100ms 경계에서 끊어 나아간다
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
  const stageName = (c: ParentNode) => c.querySelector<HTMLElement>("[data-result-stage]")!.dataset.resultStage;
  const noAwardUi = (c: ParentNode) => {
    expect(c.querySelectorAll("[data-award-plate], [data-award-slot]")).toHaveLength(0);
    expect(c.querySelectorAll('[data-float="skip"], [data-float-count]')).toHaveLength(0);
    expect(c.querySelector("h1")!.dataset.title).not.toBe("ceremony");
  };
  const dress = (c: ParentNode) => c.querySelector<HTMLElement>('[data-float="dress"]');
  const costumeCount = () => Object.values(scene().seats).filter((l) => l.costume !== undefined).length;

  it("칭호가 넷인 판: 연출은 gather → flip → light → announce → final 로 그대로 돌고 5600 에 헤더가 승패, 그 뒤 20초 동안 그대로이며 패·[넘기기]·'시상식' 이 한 번도 없다", () => {
    const r = arrive();
    const seen: string[] = [];
    const titles = new Set<string>();
    for (let t = 0; t < 5600 + 20_000; t += 100) {
      advance(t === 0 ? 0 : 100);
      const s = stageName(r.container)!;
      if (seen[seen.length - 1] !== s) seen.push(s);
      titles.add(title(r.container));
      noAwardUi(r.container);
    }
    expect(seen).toEqual(["gather", "flip", "light", "announce", "final"]);
    expect([...titles].sort()).toEqual(["결과", "시민 승리"]);
    expect(title(r.container)).toBe("시민 승리");
    expect(r.container.querySelector("h1")!.dataset.title).toBe("citizenWin");
    expect(chips(r.container)).toHaveLength(5);
  });

  it("4600~5200 에 가운데 승리 알림이 뜨고 5599 까지 헤더는 `결과`, 5600 에 승패다", () => {
    const r = arrive();
    advance(4600);
    expect(r.container.querySelector("[data-result-announce]")).not.toBeNull();
    advance(999);
    expect(title(r.container)).toBe("결과");
    expect(stageName(r.container)).toBe("announce");
    advance(1);
    expect(stageName(r.container)).toBe("final");
    expect(title(r.container)).toBe("시민 승리");
    expect(r.container.querySelector("h1 svg")).not.toBeNull();
    expect(r.container.querySelector("[data-result-announce]")).toBeNull();
  });

  it("소리 신호: flip 은 참가자 수만큼(0..4), light 한 번, plate 는 없다 — 박수 큐는 4600 의 이긴 팀 것 하나뿐", () => {
    const r = arrive();
    const cueNonces = new Set<number>();
    for (let t = 0; t < 5600 + 20_000; t += 100) {
      advance(t === 0 ? 0 : 100);
      for (const c of stage.props!.emoteCues ?? []) cueNonces.add(c.nonce);
    }
    const results = sigs.got.filter((s) => s.kind === "result");
    expect(results.filter((s) => s.step === "flip").map((s) => s.i)).toEqual([0, 1, 2, 3, 4]);
    expect(results.filter((s) => s.step === "light")).toHaveLength(1);
    expect(results.filter((s) => s.step === "plate")).toHaveLength(0);
    expect(results).toHaveLength(6);
    expect(cueNonces.size).toBe(4); // 이긴 팀(0·1·2·4) 박수 한 묶음
    expect((stage.props!.emoteCues ?? []).map((c) => c.seat)).toEqual([0, 1, 2, 4]);
    r.unmount();
  });

  it("오른쪽 열(옷장)은 5599 까지 없고 5600 부터 있다 — 칭호가 있어도 더 기다리지 않는다. 알약은 4600 부터 활성이다", () => {
    const r = arrive({ me: 1 });
    advance(4599);
    expect(r.container.querySelector("button[data-ready-pill]")!.hasAttribute("data-inactive")).toBe(true);
    advance(1);
    expect(r.container.querySelector("button[data-ready-pill]")!.hasAttribute("data-inactive")).toBe(false);
    advance(999);
    expect(dress(r.container)).toBeNull();
    expect(r.container.querySelector("[data-side-column]")).toBeNull();
    advance(1);
    expect(dress(r.container)).not.toBeNull();
    expect(r.container.querySelectorAll("[data-side-column]")).toHaveLength(1);
  });

  it("최종 상태: 산 좌석이 직업 의상을 입은 채 남는다 — 탈락 좌석은 유령 그림 (연출 뒤 30초를 돌려도 걷히지 않는다)", () => {
    const r = arrive();
    advance(5600);
    expect(costumeCount()).toBe(4);
    advance(30_000);
    expect(costumeCount()).toBe(4);
    expect(Object.keys((window as unknown as { __mfResult: { costumes: object } }).__mfResult.costumes)).toHaveLength(4);
    expect(chips(r.container)).toHaveLength(5);
    expect(scene().pin).toEqual({ mode: "point", x: GATHER_CENTER.x, z: GATHER_CENTER.z });
  });

  it("재접속·처음 마운트: 칭호가 있어도 곧바로 최종 상태(승패 제목), 패·[넘기기] 없음", () => {
    const r = renderRoom(makeView({ awards: AWARDS4 }));
    advance(8000);
    expect(title(r.container)).toBe("시민 승리");
    noAwardUi(r.container);
    expect(dress(r.container)).not.toBeNull();
  });

  it("모션 줄이기: 칭호가 있어도 곧바로 최종 상태, 패 없음, 타이머 없음", () => {
    const real = window.matchMedia;
    Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: () => ({ matches: true, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }) });
    try {
      const r = arrive();
      expect(stageName(r.container)).toBe("final");
      expect(title(r.container)).toBe("시민 승리");
      noAwardUi(r.container);
      expect(sigs.got.filter((s) => s.kind === "result" && s.step === "plate")).toHaveLength(0);
    } finally {
      Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: real });
    }
  });

  it("언마운트하면 타이머가 모두 정리된다", () => {
    const r = arrive();
    advance(3000);
    r.unmount();
    expect(vi.getTimerCount()).toBe(0);
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

  it("최종 상태: 오른쪽 열에 [꾸미기]가 있고 [넘기기]는 없다", () => {
    const r = renderRoom(makeView({ me: 1 }));
    expect(dress(r.container)).not.toBeNull();
    expect(dress(r.container)!.getAttribute("aria-label")).toBe("옷장");
    expect(skip(r.container)).toBeNull();
  });

  it("칭호가 있는 판도 5600 에 오른쪽 열 [꾸미기]가 나타나고 [넘기기]는 끝까지 없다 (0083-7 — 시상식 뒤를 기다리지 않는다)", () => {
    const r = renderRoom(executionView());
    r.rerenderRoom(makeView({ awards: AW }));
    advance(5600 - 100);
    expect(dress(r.container)).toBeNull();
    expect(skip(r.container)).toBeNull();
    advance(100);
    expect(dress(r.container)).not.toBeNull();
    expect(skip(r.container)).toBeNull();
    advance(10_000);
    expect(dress(r.container)).not.toBeNull();
    expect(skip(r.container)).toBeNull();
  });

  it("방장이면 5600 에 오른쪽 열 [dress] 와 왼쪽 줄(맵 단추 포함)이 한 번에 나타난다 — 떠 있는 [넘기기]는 없다 (16-06 D-05 → 19-05 D-13)", () => {
    const r = renderRoom(executionView());
    r.rerenderRoom(makeView({ me: 0, awards: AW }));
    advance(5600 - 100);
    expect(r.container.querySelector("[data-side-column]")).toBeNull();
    expect(r.container.querySelector("[data-host-rail]")).toBeNull();
    expect(r.container.querySelector("[data-map-chip]")).toBeNull();
    advance(100);
    expect(skip(r.container)).toBeNull();
    expect(r.container.querySelectorAll("[data-side-column]")).toHaveLength(1);
    expect(r.container.querySelectorAll("[data-host-rail]")).toHaveLength(1);
    expect(dress(r.container)!.getAttribute("data-side-button")).toBe("dress");
    // 맵 단추는 오른쪽 열이 아니라 왼쪽 줄에 있다(허용 맵이 둘 이상인 빌드)
    expect(r.container.querySelectorAll("[data-side-column] [data-map-chip]")).toHaveLength(0);
    expect(r.container.querySelectorAll("[data-host-rail] [data-map-chip]")).toHaveLength(PLAYABLE_MAPS.length > 1 ? 1 : 0);
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

  it("다른 사람(연결이 끊긴 사람 포함)이 직접 고른 옷은 시트에서 data-taken 이고 내 옷·기본 coat 는 잠기지 않는다 (18-05, D-02)", () => {
    const v = makeView({ me: 1, offline: [3] });
    v.players = v.players.map((p) => (p.seat === 3 ? { ...p, look: "noir" as const } : p.seat === 2 ? { ...p, look: "hood" as const } : p.seat === 1 ? { ...p, look: "hood" as const } : p));
    const r = renderRoom(v);
    fireEvent.click(dress(r.container)!);
    const locked = Array.from(r.container.querySelectorAll<HTMLElement>("button[data-outfit][data-taken]")).map((c) => c.dataset.outfit);
    expect(locked).toEqual(["noir"]); // hood 는 내 옷(좌석 1)이라 남이 같은 옷을 가져도 잠기지 않는다
    expect(r.container.querySelector("button[data-outfit='hood']")?.getAttribute("aria-pressed")).toBe("true");
    expect(r.container.querySelector("button[data-outfit='coat']")?.hasAttribute("data-taken")).toBe(false);
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
  const sideButtons = (c: ParentNode) => [...c.querySelectorAll("[data-side-column] [data-side-button]")].map((e) => e.getAttribute("data-side-button"));
  const railIds = (c: ParentNode) => [...c.querySelectorAll("[data-host-rail] [data-host-rail-btn]")].map((e) => e.getAttribute("data-host-rail-btn")).join(",");
  const withMap = (v: RoomView, mapChoice: "bar" | "plaza" | "random", map?: "bar" | "plaza"): RoomView => ({ ...v, mapChoice, ...(map ? { map } : {}) });

  it("칩은 방장에게만 보이고 서버의 mapChoice(random 이 정해진 뒤에도 choice, 결과 map 은 노출하지 않음)를 따른다", () => {
    for (const [choice, map, name] of [["plaza", undefined, "맵 광장"], ["random", "plaza", "맵 랜덤"], ["bar", "bar", "맵 재즈 바"]] as const) {
      const r = renderRoom(withMap(makeView({ me: 0 }), choice, map));
      expect(chip(r.container)?.getAttribute("aria-label")).toBe(name);
      r.unmount();
    }
  });

  it("참가자 화면에는 칩이 없다 — 오른쪽 열은 [dress] 하나(16-06 V-5, T-16-13)", () => {
    const r = renderRoom(withMap(makeView({ me: 1 }), "plaza"));
    expect(chip(r.container)).toBeNull();
    expect(sideButtons(r.container)).toEqual(["dress"]);
  });

  it("최종 상태에서 방장의 오른쪽 열은 소리 자리 다음 [dress] 하나이고 맵 단추는 왼쪽 줄의 둘째 칸이다 (16-06 D-05 → 19-05 D-13)", () => {
    const r = renderRoom(makeView({ me: 0 }));
    expect(r.container.querySelectorAll("[data-side-column]")).toHaveLength(1);
    expect(sideButtons(r.container).join(",")).toBe("dress");
    expect(r.container.querySelector(".mv-side__col")!.firstElementChild!.classList.contains("mv-side__slot")).toBe(true);
    expect(railIds(r.container)).toBe("mode,map");
    expect(r.container.querySelectorAll("[data-host-rail] [data-map-chip]")).toHaveLength(1);
    expect(r.container.querySelectorAll("[data-side-column] [data-map-chip]")).toHaveLength(0);
    expect(chip(r.container)?.hasAttribute("data-side-button")).toBe(false); // 줄 변형은 오른쪽 열 표식을 달지 않는다
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
    expect(r.container.querySelector("[data-side-column]")).toBeNull(); // 시트가 열린 동안 열은 그리지 않는다
    r.send.mockClear();
    fireEvent.click(r.container.querySelector("button[data-map-card='plaza']")!);
    expect(r.send.mock.calls.map((c) => c[0])).toEqual([{ t: "mapPick", map: "plaza" }]);
    expect(r.container.querySelector("button[data-map-card='random']")?.getAttribute("aria-pressed")).toBe("true");
    r.rerenderRoom(withMap(makeView({ me: 0 }), "plaza"));
    expect(r.container.querySelector("button[data-map-card='plaza']")?.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(chip(r.container)?.getAttribute("aria-label")).toBe("맵 광장");
  });

  it("방장이 [꾸미기]로 열면 의상 탭이고 탭 둘이 있다", () => {
    const r = renderRoom(makeView({ me: 0 }));
    fireEvent.click(r.container.querySelector<HTMLElement>("[data-float='dress']")!);
    expect(r.container.querySelectorAll("button[data-outfit]")).toHaveLength(9);
    expect(r.container.querySelectorAll("button[data-map-tab]")).toHaveLength(2);
  });

  it("참가자는 꾸미기 시트에 탭이 없다", () => {
    const r = renderRoom(makeView({ me: 1 }));
    expect(chip(r.container)).toBeNull();
    fireEvent.click(r.container.querySelector<HTMLElement>("[data-float='dress']")!);
    expect(r.container.querySelector("[data-map-tab]")).toBeNull();
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

// ---------- 19-05: 결과 화면 방장 줄과 판 종류 (D-05·D-06·D-07·D-13, UI-SPEC D 절, P19-10·P19-13) ----------
// 연출이 끝난 뒤(5600) 방장은 왼쪽 줄 [판 종류]·[맵], 참가자는 읽기 전용 칩. 고른 표시는 서버 view.mode 만 따른다(결정 0002)
describe("결과 화면 방장 줄과 판 종류 (19-05, D-06·D-13)", () => {
  let restore = () => {};
  beforeEach(() => {
    restore = openPlaza();
  });
  afterEach(() => restore());
  const executionView = (): RoomView => {
    const v = makeView();
    v.phase = "execution";
    delete (v as { result?: unknown }).result;
    v.day = { ...v.day!, candidate: 3, execution: { seat: 3 } };
    return v;
  };
  // 표시각(100ms 배수)마다 React 가 그리도록 100ms 경계에서 끊어 나아간다
  const advance = (ms: number) => {
    let left = ms;
    while (left > 0) {
      const into = (Date.now() - NOW) % 100;
      const step = Math.min(left, into === 0 ? 100 : 100 - into);
      act(() => void vi.advanceTimersByTime(step));
      left -= step;
    }
  };
  const withMode = (v: RoomView, mode: GameMode): RoomView => ({ ...v, mode });
  const rails = (c: ParentNode) => c.querySelectorAll("[data-host-rail]").length;
  const chipCount = (c: ParentNode) => c.querySelectorAll("[data-mode-chip]").length;
  const railIds = (c: ParentNode) => [...c.querySelectorAll("[data-host-rail] [data-host-rail-btn]")].map((e) => e.getAttribute("data-host-rail-btn")).join(",");
  const side = (c: ParentNode) => [...c.querySelectorAll("[data-side-column] [data-side-button]")].map((e) => e.getAttribute("data-side-button")).join(",");
  const modeBtn = (c: ParentNode) => c.querySelector<HTMLButtonElement>('[data-host-rail-btn="mode"]');
  const card = (mode: GameMode) => document.querySelector<HTMLButtonElement>(`[data-mode-card="${mode}"]`);
  const pressedCards = () => `basic=${card("basic")?.getAttribute("aria-pressed") ?? "없음"},extended=${card("extended")?.getAttribute("aria-pressed") ?? "없음"}`;
  const sheets = () => document.querySelectorAll("[data-mode-sheet]").length;
  const chipOf = (c: ParentNode) => c.querySelector<HTMLElement>("[data-mode-chip]");
  const toastText = (c: ParentNode) => c.querySelector(".mv-toast")?.textContent ?? "";
  const pillOf = (c: ParentNode) => c.querySelector<HTMLElement>("[data-result-panel] [data-ready-pill]");
  const sentOf = (send: ReturnType<typeof vi.fn>) => JSON.stringify(send.mock.calls.map((c) => c[0]));
  /** [판 종류] 단추가 하나 있음을 확인하고 누른다 */
  const pressMode = (c: ParentNode) => {
    expect(c.querySelectorAll('[data-host-rail-btn="mode"]')).toHaveLength(1);
    fireEvent.click(modeBtn(c)!);
  };

  it("방장(최종 상태): 왼쪽 줄 하나에 위에서부터 [판 종류]·[맵]뿐이고 [봇]·[튜토리얼 먼저]는 없다. 오른쪽 열은 [옷장] 하나(첫 칸은 소리 자리)다", () => {
    // 봇 도구 값이 실려 와도(대기실 전용 키) 결과 화면 줄에는 [봇]이 없다
    const v = makeView({ me: 0 });
    const r = renderRoom({ ...v, me: { ...v.me, testBots: 2 } });
    expect(rails(r.container)).toBe(1);
    expect(railIds(r.container)).toBe("mode,map");
    expect(r.container.querySelectorAll('[data-host-rail-btn="bots"], [data-host-rail-btn="tutorial"], [data-float="bots"], [data-tutorial-toggle]')).toHaveLength(0);
    expect(side(r.container)).toBe("dress");
    expect(r.container.querySelector(".mv-side__col")!.firstElementChild!.classList.contains("mv-side__slot")).toBe(true);
    expect(r.container.querySelectorAll("[data-side-column] [data-map-chip]")).toHaveLength(0);
    expect(modeBtn(r.container)?.getAttribute("aria-label")).toBe("판 종류: 확장판");
    expect(r.container.querySelector("[data-host-rail]")?.getAttribute("aria-label")).toBe("방장 전용");
    expect(chipCount(r.container)).toBe(0); // 방장에게는 칩이 없다
  });

  it("허용 맵이 하나뿐이면 줄은 [판 종류] 하나다", () => {
    restore();
    const list = PLAYABLE_MAPS as MapId[];
    const saved = [...list];
    list.splice(0, list.length, "bar");
    try {
      const r = renderRoom(makeView({ me: 0 }));
      expect(railIds(r.container)).toBe("mode");
    } finally {
      list.splice(0, list.length, ...saved);
      restore = openPlaza();
    }
  });

  it("방장: 연출이 끝나기 전(5600 전)에는 줄·칩이 없고 5600 에 줄이 오른쪽 열과 함께 나타난다", () => {
    const r = renderRoom(executionView());
    r.rerenderRoom(makeView({ me: 0 }));
    for (const ms of [0, 1200, 3400, 900]) {
      advance(ms);
      expect(`${rails(r.container)},${chipCount(r.container)}`).toBe("0,0");
    }
    advance(100);
    expect(r.container.querySelectorAll("[data-side-column]")).toHaveLength(1);
    expect(`${rails(r.container)},${chipCount(r.container)}`).toBe("1,0");
    expect(railIds(r.container)).toBe("mode,map");
  });

  it("참가자: 연출이 끝나기 전(5600 전)에는 줄·칩이 없고 5600 에 칩이 나타난다", () => {
    const r = renderRoom(executionView());
    r.rerenderRoom(makeView({ me: 1 }));
    for (const ms of [0, 1200, 3400, 900]) {
      advance(ms);
      expect(`${rails(r.container)},${chipCount(r.container)}`).toBe("0,0");
    }
    advance(100);
    expect(`${rails(r.container)},${chipCount(r.container)}`).toBe("0,1");
  });

  it("[판 종류] → 시트가 열리고 확장판이 골라져 있다. [기본 마피아]를 누르면 modePick 이 한 번 가고 표시는 서버 값이 올 때까지 그대로다 (D-05·D-06)", () => {
    const r = renderRoom(makeView({ me: 0 }));
    expect(sheets()).toBe(0);
    pressMode(r.container);
    expect(sheets()).toBe(1);
    expect(pressedCards()).toBe("basic=false,extended=true");
    expect(modeBtn(r.container)?.getAttribute("aria-pressed")).toBe("true");
    r.send.mockClear();
    fireEvent.click(card("basic")!);
    expect(sentOf(r.send)).toBe(JSON.stringify([{ t: "modePick", mode: "basic" }]));
    expect(pressedCards()).toBe("basic=false,extended=true"); // 낙관 갱신 없음(P19-6)
    expect(modeBtn(r.container)?.getAttribute("aria-label")).toBe("판 종류: 확장판");
    r.rerenderRoom(withMode(makeView({ me: 0 }), "basic"));
    expect(pressedCards()).toBe("basic=true,extended=false");
    expect(modeBtn(r.container)?.getAttribute("aria-label")).toBe("판 종류: 기본 마피아");
    expect(r.send).toHaveBeenCalledTimes(1);
  });

  it("판 종류가 바뀌어도 방장 [시작] 알약의 마크업·자리(패널 안)와 준비 수는 그대로다 (D-06, P19-13)", () => {
    const r = renderRoom(makeView({ me: 0, ready: [0, 1, 2] }));
    expect(rails(r.container)).toBe(1);
    const before = pillOf(r.container)!.outerHTML;
    expect(before).toContain('data-ready-count="3/5"');
    pressMode(r.container);
    fireEvent.click(card("basic")!);
    r.rerenderRoom(withMode(makeView({ me: 0, ready: [0, 1, 2] }), "basic"));
    fireEvent.click(within(screen.getByRole("dialog", { name: "판 종류" })).getByRole("button", { name: "닫기" }));
    advance(300);
    expect(sheets()).toBe(0);
    expect(pillOf(r.container)!.outerHTML).toBe(before);
    expect(r.container.querySelectorAll("[data-ready-pill]")).toHaveLength(1);
    expect(r.container.querySelectorAll("[data-host-rail] [data-ready-pill]")).toHaveLength(0);
  });

  it("[판 종류]를 누르면 채팅 입력칸의 포커스를 먼저 풀고, 시트를 [닫기]로 닫으면 초점이 [판 종류] 단추로 돌아온다", () => {
    const r = renderRoom(makeView({ me: 0 }));
    const input = r.container.querySelector<HTMLInputElement>("[data-chat-input]")!;
    const blur = vi.spyOn(input, "blur");
    pressMode(r.container);
    expect(blur).toHaveBeenCalledTimes(1);
    expect(sheets()).toBe(1);
    fireEvent.click(within(screen.getByRole("dialog", { name: "판 종류" })).getByRole("button", { name: "닫기" }));
    advance(300);
    expect(sheets()).toBe(0);
    expect(document.activeElement?.getAttribute("data-host-rail-btn") ?? "없음").toBe("mode");
    expect(modeBtn(r.container)?.getAttribute("aria-pressed")).toBe("false");
  });

  it("연결이 끊기면(canSend 거짓) 줄 단추가 모두 aria-disabled 이고 눌러도 시트가 열리지 않는다. 열린 채 끊기면 칸을 눌러도 보내지 않는다", () => {
    const off = renderRoom(makeView({ me: 0 }), { canSend: false });
    const btns = [...off.container.querySelectorAll("[data-host-rail] [data-host-rail-btn]")];
    expect(btns).toHaveLength(2);
    expect(btns.map((b) => b.getAttribute("aria-disabled")).join(",")).toBe("true,true");
    pressMode(off.container);
    expect(sheets()).toBe(0);
    off.unmount();
    const r = renderRoom(makeView({ me: 0 }));
    pressMode(r.container);
    expect(sheets()).toBe(1);
    r.rerenderRoom(makeView({ me: 0 }), { canSend: false });
    r.send.mockClear();
    fireEvent.click(card("basic")!);
    expect(sentOf(r.send)).toBe("[]");
  });

  it("참가자: 방장 줄 마크업이 없고(미렌더) 읽기 전용 칩 하나 '판 종류: 확장판' (T-19-16)", () => {
    const r = renderRoom(makeView({ me: 1 }));
    expect(r.container.querySelectorAll("[data-host-rail], [data-host-rail-btn], [data-map-chip]")).toHaveLength(0);
    expect(chipCount(r.container)).toBe(1);
    expect(chipOf(r.container)?.getAttribute("data-mode-chip")).toBe("extended");
    expect(chipOf(r.container)?.textContent).toBe("판 종류: 확장판");
    expect(chipOf(r.container)?.tagName).toBe("DIV"); // 누를 수 없다
    expect(chipOf(r.container)?.hasAttribute("data-test-shift")).toBe(false); // 결과 화면에는 [테스트] 단추가 없다
    expect(sheets()).toBe(0);
  });

  it("참가자: 판 종류가 바뀐 view 가 오면 칩이 바뀌고 알림 한 줄 '판 종류: 기본 마피아' → 다시 바뀌면 '판 종류: 확장판'. 눌러 둔 준비는 그대로다 (P19-9·P19-10·P19-13)", () => {
    const r = renderRoom(makeView({ me: 1, ready: [1] }));
    expect(chipCount(r.container)).toBe(1);
    expect(toastText(r.container)).toBe("");
    const pill = pillOf(r.container)!.outerHTML;
    r.rerenderRoom(withMode(makeView({ me: 1, ready: [1] }), "basic"));
    expect(chipOf(r.container)?.getAttribute("data-mode-chip")).toBe("basic");
    expect(chipOf(r.container)?.textContent).toBe("판 종류: 기본 마피아");
    expect(toastText(r.container)).toBe("판 종류: 기본 마피아");
    expect(pillOf(r.container)!.outerHTML).toBe(pill);
    r.rerenderRoom(withMode(makeView({ me: 1, ready: [1] }), "extended"));
    expect(chipOf(r.container)?.getAttribute("data-mode-chip")).toBe("extended");
    expect(toastText(r.container)).toBe("판 종류: 확장판");
  });

  it("연출 중에 판 종류가 바뀌어도 참가자에게 알림 한 줄은 뜬다(칩은 5600 뒤에 바뀐 값으로 나타난다)", () => {
    const r = renderRoom(executionView());
    r.rerenderRoom(makeView({ me: 1 }));
    advance(2000);
    r.rerenderRoom(withMode(makeView({ me: 1 }), "basic"));
    expect(chipCount(r.container)).toBe(0);
    expect(toastText(r.container)).toBe("판 종류: 기본 마피아");
    advance(3600);
    expect(chipOf(r.container)?.getAttribute("data-mode-chip") ?? "없음").toBe("basic");
  });

  it("알림이 없는 때: 방장 본인 · 처음 그릴 때(기본 마피아 방) · 재연결 직후(epoch)", () => {
    const host = renderRoom(makeView({ me: 0 }));
    expect(rails(host.container)).toBe(1);
    host.rerenderRoom(withMode(makeView({ me: 0 }), "basic"));
    expect(modeBtn(host.container)?.getAttribute("aria-label")).toBe("판 종류: 기본 마피아");
    expect(toastText(host.container)).toBe("");
    host.unmount();
    const first = renderRoom(withMode(makeView({ me: 1 }), "basic"));
    expect(chipOf(first.container)?.getAttribute("data-mode-chip") ?? "없음").toBe("basic");
    expect(toastText(first.container)).toBe("");
    first.unmount();
    const re = renderRoom(makeView({ me: 1 }));
    re.rerenderRoom(withMode(makeView({ me: 1 }), "basic"), { epoch: 2 });
    expect(chipOf(re.container)?.getAttribute("data-mode-chip") ?? "없음").toBe("basic");
    expect(toastText(re.container)).toBe("");
  });

  it("방장 변경과 판 종류 바뀜이 같은 view 에 오면 방장 알림이 먼저다(한 번에 하나)", () => {
    const r = renderRoom(makeView({ me: 2, hostSeat: 0 }));
    expect(chipCount(r.container)).toBe(1);
    r.rerenderRoom(withMode(makeView({ me: 2, hostSeat: 1 }), "basic"));
    expect(chipOf(r.container)?.getAttribute("data-mode-chip")).toBe("basic");
    expect(toastText(r.container)).toBe("방장 · 하윤");
  });

  it("방장이 바뀌면 다음 view 에서 칩 ↔ 줄이 바뀌고, 방장을 넘겨준 화면의 열려 있던 시트는 닫힌다", () => {
    const r = renderRoom(makeView({ me: 1, hostSeat: 0 }));
    expect(`${rails(r.container)},${chipCount(r.container)}`).toBe("0,1");
    r.rerenderRoom(makeView({ me: 1, hostSeat: 1 }));
    expect(`${rails(r.container)},${chipCount(r.container)}`).toBe("1,0");
    pressMode(r.container);
    expect(sheets()).toBe(1);
    r.rerenderRoom(makeView({ me: 1, hostSeat: 0 }));
    expect(`${rails(r.container)},${chipCount(r.container)}`).toBe("0,1");
    expect(sheets()).toBe(0);
    r.rerenderRoom(makeView({ me: 1, hostSeat: 1 }));
    expect(`${rails(r.container)},${chipCount(r.container)}`).toBe("1,0");
    expect(sheets()).toBe(0); // 다시 방장이 돼도 저절로 뜨지 않는다
  });

  it("줄의 [맵]을 누르면 꾸미기 시트의 맵 탭이 열린다(대기실과 같은 줄 변형: 금빛 방장 단추, 오른쪽 열 표식 없음)", () => {
    const r = renderRoom(makeView({ me: 0 }));
    const map = r.container.querySelector<HTMLElement>("[data-host-rail] [data-map-chip]");
    expect(map?.getAttribute("data-host-rail-btn") ?? "없음").toBe("map");
    expect(map!.classList.contains("mv-hostrail-btn")).toBe(true);
    expect(map!.hasAttribute("data-side-button")).toBe(false);
    fireEvent.click(map!);
    expect(r.container.querySelectorAll("button[data-map-card]")).toHaveLength(3);
  });

  // ---- 숨김 조건과 화면 이동 (P19-16): 기록 늘림 · 꾸미기 시트 · 키보드, 가상 뷰포트 ----
  const count = (c: ParentNode) => `${rails(c)},${chipCount(c)}`;
  const expandedOf = (c: ParentNode) => c.querySelector("[data-result-panel]")?.getAttribute("data-expanded") ?? "없음";
  const dressBtn = (c: ParentNode) => c.querySelector<HTMLElement>('[data-float="dress"]');
  /** 가짜 visualViewport(높이 844)를 깔고 fn 을 돌린 뒤 되돌린다. open() 은 입력칸 포커스 + 키보드 336, shut() 은 블러 + 원래 높이 */
  const withKeyboard = (fn: (kb: { open(c: ParentNode): void; shut(c: ParentNode): void }) => void) => {
    const vv = Object.assign(new EventTarget(), { height: 844, offsetTop: 0 });
    Object.defineProperty(window, "visualViewport", { value: vv, configurable: true, writable: true });
    const realInnerH = window.innerHeight;
    Object.defineProperty(window, "innerHeight", { value: 844, configurable: true, writable: true });
    const input = (c: ParentNode) => c.querySelector<HTMLInputElement>("[data-chat-input]")!;
    // 훅은 다음 프레임(rAF)과 100ms 뒤 다시 읽기로 높이를 잰다. 이 파일은 시계를 과거(NOW)로 돌려 두어 가짜 rAF 의 다음 프레임까지가 16~32ms 로 달라지므로, 다시 읽기(100ms)까지 넉넉히 넘긴다
    const resize = (h: number) => {
      vv.height = h;
      act(() => void vv.dispatchEvent(new Event("resize")));
      advance(120);
    };
    try {
      fn({
        open: (c) => {
          act(() => input(c).focus());
          resize(844 - 336);
        },
        shut: (c) => {
          act(() => input(c).blur());
          resize(844);
        },
      });
    } finally {
      Reflect.deleteProperty(window, "visualViewport");
      Object.defineProperty(window, "innerHeight", { value: realInnerH, configurable: true, writable: true });
    }
  };
  const kbOf = (c: ParentNode) => c.querySelector("main.mf-result")?.getAttribute("data-kb-open") ?? "없음";

  it("방장: 연출 뒤 전체 기록이 늘어난 동안(expanded)에는 줄이 없고, 접으면 다시 있다", () => {
    const r = renderRoom(makeView({ me: 0 }));
    expect(count(r.container)).toBe("1,0");
    act(() => panel.props!.onTab("mafia"));
    expect(expandedOf(r.container)).toBe("true");
    expect(count(r.container)).toBe("0,0");
    act(() => stage.props!.onStageTap!()); // 무대 탭 = 접기
    expect(expandedOf(r.container)).toBe("false");
    expect(count(r.container)).toBe("1,0");
  });

  it("참가자: 연출 뒤 전체 기록이 늘어난 동안(expanded)에는 칩이 없고, 접으면 다시 있다", () => {
    const r = renderRoom(makeView({ me: 1 }));
    expect(count(r.container)).toBe("0,1");
    act(() => panel.props!.onTab("mafia"));
    expect(expandedOf(r.container)).toBe("true");
    expect(count(r.container)).toBe("0,0");
    act(() => stage.props!.onStageTap!());
    expect(expandedOf(r.container)).toBe("false");
    expect(count(r.container)).toBe("0,1");
  });

  it("방장: 꾸미기 시트를 열면(옷장·줄의 [맵] 어느 쪽이든) 줄이 없고 닫으면 다시 있다", () => {
    const r = renderRoom(makeView({ me: 0 }));
    expect(count(r.container)).toBe("1,0");
    fireEvent.click(dressBtn(r.container)!);
    expect(r.container.querySelectorAll("button[data-outfit]").length).toBeGreaterThan(1);
    expect(count(r.container)).toBe("0,0");
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    advance(300);
    expect(r.container.querySelectorAll("button[data-outfit]")).toHaveLength(0);
    expect(count(r.container)).toBe("1,0");
    fireEvent.click(r.container.querySelector<HTMLElement>("[data-host-rail] [data-map-chip]")!);
    expect(r.container.querySelectorAll("button[data-map-card]")).toHaveLength(3);
    expect(count(r.container)).toBe("0,0");
  });

  it("참가자: 꾸미기 시트를 열면 칩이 없고 닫으면 다시 있다", () => {
    const r = renderRoom(makeView({ me: 1 }));
    expect(count(r.container)).toBe("0,1");
    fireEvent.click(dressBtn(r.container)!);
    expect(r.container.querySelectorAll("button[data-outfit]").length).toBeGreaterThan(1);
    expect(count(r.container)).toBe("0,0");
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    advance(300);
    expect(count(r.container)).toBe("0,1");
  });

  it("방장: 키보드가 열리면(data-kb-open) 줄이 없고 닫히면 다시 있다", () => {
    withKeyboard((kb) => {
      const r = renderRoom(makeView({ me: 0 }));
      expect(count(r.container)).toBe("1,0");
      kb.open(r.container);
      expect(kbOf(r.container)).toBe("true");
      expect(count(r.container)).toBe("0,0");
      kb.shut(r.container);
      expect(kbOf(r.container)).toBe("없음");
      expect(count(r.container)).toBe("1,0");
    });
  });

  it("참가자: 키보드가 열리면(data-kb-open) 칩이 없고 닫히면 다시 있다", () => {
    withKeyboard((kb) => {
      const r = renderRoom(makeView({ me: 1 }));
      expect(count(r.container)).toBe("0,1");
      kb.open(r.container);
      expect(kbOf(r.container)).toBe("true");
      expect(count(r.container)).toBe("0,0");
      kb.shut(r.container);
      expect(kbOf(r.container)).toBe("없음");
      expect(count(r.container)).toBe("0,1");
    });
  });

  it("result.css: 가상 뷰포트 이동 줄(--mf-vv-top)에 방장 줄·판 종류 칩이 오른쪽 열과 함께 묶여 있다", () => {
    const css = readFileSync("src/styles/result.css", "utf8");
    const line = css.split("\n").find((l) => l.includes("translateY(var(--mf-vv-top")) ?? "";
    const selectors = (line.split("{")[0] ?? "").split(",").map((x) => x.trim());
    const want = [".mf-result .mv-side", ".mf-result .mf-hostrail", ".mf-result .mf-modechip"];
    expect(want.filter((w) => selectors.includes(w)).join(" | ")).toBe(want.join(" | "));
  });
});

// ---------- 12-11: 결과·시상 사건 신호 — 시계가 낸 사건에 소리가 붙는다 (D-15, LS-10, T-12-41, T-12-44) ----------
describe("결과 사건 신호 (12-11)", () => {
  const AWARDS5: AwardLine[] = [
    { seat: 3, award: "whiff", k: 2 },
    { seat: 2, award: "spectator", k: 1, at: "night" },
    { seat: 1, award: "detective", k: 1 },
    { seat: 4, award: "talker", k: 12 },
    { seat: 0, award: "survivor" },
  ];
  const executionView = (count = 5): RoomView => {
    const v = makeView({ count });
    v.phase = "execution";
    delete (v as { result?: unknown }).result;
    v.day = { ...v.day!, candidate: 3, execution: { seat: 3 } };
    return v;
  };
  const arrive = (opts: Opts = {}) => {
    const r = renderRoom(executionView(opts.count));
    r.rerenderRoom(makeView(opts));
    return r;
  };
  // 100ms 경계마다 끊어 나아간다(시상식 시험과 같은 방식)
  const advance = (ms: number) => {
    let left = ms;
    while (left > 0) {
      const into = (Date.now() - NOW) % 100;
      const step = Math.min(left, into === 0 ? 100 : 100 - into);
      act(() => void vi.advanceTimersByTime(step));
      left -= step;
    }
  };
  const results = () => sigs.got.filter((s) => s.kind === "result");
  const flips = () => results().filter((s) => s.step === "flip").map((s) => s.i);
  const lights = () => results().filter((s) => s.step === "light").map((s) => s.win);
  const plates = () => results().filter((s) => s.step === "plate").map((s) => [s.k, s.total]);
  const withReduced = (fn: () => void) => {
    const real = window.matchMedia;
    Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: () => ({ matches: true, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }) });
    try {
      fn();
    } finally {
      Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: real });
    }
  };

  it("도착 직후(t=0)와 1199 까지는 신호가 없다", () => {
    arrive();
    advance(1199);
    expect(results()).toEqual([]);
  });

  it("n=4: 1200·1600·2000·2400 에 flip 0..3 이 한 번씩, 4600 에 light 한 번", () => {
    arrive({ count: 4, dead: [] });
    advance(1200);
    expect(flips()).toEqual([0]);
    advance(400);
    expect(flips()).toEqual([0, 1]);
    advance(400);
    expect(flips()).toEqual([0, 1, 2]);
    advance(400);
    expect(flips()).toEqual([0, 1, 2, 3]);
    advance(2199);
    expect(lights()).toEqual([]);
    advance(1);
    expect(lights()).toHaveLength(1);
    advance(5000);
    expect(flips()).toEqual([0, 1, 2, 3]);
    expect(lights()).toHaveLength(1);
  });

  it("n=8: flip 이 여덟 번 (0..7)", () => {
    arrive({ count: 8, dead: [] });
    advance(4600);
    expect(flips()).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("light 의 win: 내 팀이 이기면 참, 지면 거짓 (시민 viewer·마피아 viewer × 두 결과)", () => {
    // 좌석 0 시민 · 3 마피아
    const cases: [number, "citizenWin" | "mafiaWin", boolean][] = [
      [0, "citizenWin", true],
      [3, "citizenWin", false],
      [0, "mafiaWin", false],
      [3, "mafiaWin", true],
    ];
    for (const [me, winner, win] of cases) {
      sigs.got.length = 0;
      const r = arrive({ me, winner });
      advance(4600);
      expect(lights(), `${me}/${winner}`).toEqual([win]);
      r.unmount();
    }
  });

  it("내 좌석이 출연자 표에 없으면(쉬는 사람) win 은 참이다", () => {
    arrive({ me: 6, sat: [6], jobs: DEFAULT_JOBS });
    advance(4600);
    expect(lights()).toEqual([true]);
  });

  it("신호 인자는 닫힌 값뿐이다: flip{i} · light{win} 만, 좌석·직업·닉네임 키가 없다", () => {
    arrive({ awards: AWARDS5 });
    advance(5600 + 900);
    const keys = new Set(results().flatMap((s) => Object.keys(s)));
    expect([...keys].sort()).toEqual(["i", "kind", "step", "win"]);
    for (const s of results()) for (const v of Object.values(s)) expect(["string", "number", "boolean"]).toContain(typeof v);
    expect(JSON.stringify(results())).not.toMatch(/mafia|police|doctor|citizen|지우|하윤/);
  });

  it("건너뛰기(1500): 남은 flip 신호를 만들지 않고 light 한 번만, 이후 탭·시간 경과에도 더 없다", () => {
    arrive();
    advance(1500);
    expect(flips()).toEqual([0]);
    act(() => stage.props!.onStageTap!());
    expect(lights()).toHaveLength(1);
    expect(flips()).toEqual([0]);
    act(() => stage.props!.onStageTap!());
    advance(8000);
    expect(flips()).toEqual([0]);
    expect(lights()).toHaveLength(1);
  });

  it("재접속·처음 마운트(arrivedFrom 없음)는 신호가 하나도 없다", () => {
    renderRoom(makeView({ awards: AWARDS5 }));
    advance(20_000);
    expect(results()).toEqual([]);
  });

  it("에포크가 바뀐 재접속으로 받은 ended 도 신호가 없다", () => {
    const r = renderRoom(executionView());
    r.rerenderRoom(makeView({ awards: AWARDS5 }), { epoch: 2 });
    advance(20_000);
    expect(results()).toEqual([]);
  });

  it("모션 줄이기로 곧바로 최종 상태가 열리면 light 한 번만 (flip 없음)", () => {
    withReduced(() => {
      arrive();
      advance(50);
      expect(flips()).toEqual([]);
      expect(lights()).toEqual([true]);
      advance(10_000);
      expect(lights()).toHaveLength(1);
    });
  });

  it("시상 패 신호는 없다: 칭호가 있어도 5600 이후 20초 동안 plate 가 0회이고 flip·light 개수는 그대로다 (0083-7)", () => {
    arrive({ awards: AWARDS5 });
    advance(5600 + 20_000);
    expect(plates()).toEqual([]);
    expect(flips()).toEqual([0, 1, 2, 3, 4]);
    expect(lights()).toHaveLength(1);
  });

  it("모션 줄이기라도 시상 패 신호는 없다", () => {
    withReduced(() => {
      arrive({ awards: AWARDS5 });
      advance(10_000);
      expect(plates()).toEqual([]);
    });
  });

  it("다시 하기: 승리 조명 전 알약은 신호가 없고, 조명 뒤 손님이 준비를 토글하면 tap 신호 (ui.tap)", () => {
    const r = arrive({ me: 1 });
    const pill = () => r.container.querySelector<HTMLElement>("button[data-ready-pill]")!;
    advance(2000);
    fireEvent.click(pill());
    expect(sigs.got.filter((s) => s.kind === "tap")).toEqual([]);
    advance(2600); // 4600
    fireEvent.click(pill());
    expect(sigs.got.filter((s) => s.kind === "tap")).toEqual([{ kind: "tap" }]);
  });
});
