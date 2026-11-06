import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { ChatPanel } from "../../src/components/v2/ChatPanel";
import { FaceList } from "../../src/components/v2/FaceList";
import { HeadStack } from "../../src/components/v2/HeadStack";
import { VerdictPicker } from "../../src/components/v2/VerdictPicker";
import type { RoleId } from "../../shared/game/roles";
import type { PhaseId, PublicPlayer, RoomView } from "../../shared/protocol";
import type { WorldStageProps } from "../../src/components/WorldStage";
import type { RoomConnection } from "../../src/net/useRoomConnection";

// 맵 화면 시험은 gameMap.test 와 같은 틀: WorldStage 는 받은 props 만 쥐는 가짜(이름표 call 은 tagProps 로 읽는다), 나머지(GamePanel·채팅·찬반·얼굴 칸)는 진짜.
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

afterEach(cleanup);

// 14-04: 빛남(HOST-03·04, D-02·D-08) — "지금 이걸 누르세요". 부품은 call prop 을 받으면 같은 빛(is-call + data-call)을 낸다.
// data-call 은 값 없는 표식이다(역할·좌석 값 없음, T-14-12).

const V2_CSS = readFileSync("src/styles/v2.css", "utf8");
const TOKENS_CSS = readFileSync("src/styles/tokens.css", "utf8");
const TOKENS_JSON = readFileSync("design/tokens.json", "utf8");

const face = (seat: number) => ({ seat, name: `이름${seat}`, img: `/characters/faces/face-${seat % 8}.png`, color: `var(--seat-${(seat % 8) + 1})` });

describe("빛남 부품 (HOST-03·04)", () => {
  it("NameTag call → 이름표에 is-call, call 없으면 없다", () => {
    const on = render(<HeadStack name="민준" color="var(--seat-1)" call />);
    expect(on.container.querySelector(".mv-tag.is-call")).not.toBeNull();
    on.unmount();
    const off = render(<HeadStack name="민준" color="var(--seat-1)" />);
    expect(off.container.querySelector(".is-call")).toBeNull();
  });

  it("VerdictPicker call → 두 단추 모두 is-call·data-call(값 빈 문자열), 없으면 둘 다 없다", () => {
    const on = render(<VerdictPicker onChange={() => {}} call />);
    const btns = [...on.container.querySelectorAll<HTMLElement>("button.mv-verdict__btn")];
    expect(btns).toHaveLength(2);
    for (const b of btns) {
      expect(b.classList.contains("is-call")).toBe(true);
      expect(b.getAttribute("data-call")).toBe("");
    }
    on.unmount();
    const off = render(<VerdictPicker onChange={() => {}} />);
    expect(off.container.querySelectorAll("[data-call], .is-call")).toHaveLength(0);
  });

  it("FaceList callSeats → 그 좌석 칸만 is-call·data-call(값 빈 문자열)", () => {
    const { container } = render(<FaceList faces={[face(0), face(2), face(5)]} callSeats={new Set([0, 5])} />);
    const lit = [...container.querySelectorAll<HTMLElement>("button[data-call]")];
    expect(lit.map((b) => b.getAttribute("data-face"))).toEqual(["0", "5"]);
    for (const b of lit) {
      expect(b.getAttribute("data-call")).toBe("");
      expect(b.classList.contains("is-call")).toBe(true);
    }
    expect(container.querySelectorAll(".is-call")).toHaveLength(2);
  });

  it("FaceList callSeats 없음 → 빛 0개", () => {
    const { container } = render(<FaceList faces={[face(0), face(2)]} />);
    expect(container.querySelectorAll("[data-call], .is-call")).toHaveLength(0);
  });

  const chat = (extra: Record<string, unknown> = {}) =>
    render(<ChatPanel messages={[]} logHeight={96} value="" onChange={() => {}} onSend={() => {}} {...extra} />);

  it("ChatPanel callInput → 입력칸을 감싼 칸 is-call, 입력칸 data-call, [유언] 에는 없다", () => {
    const { container } = chat({ callInput: true, onWill: () => {} });
    expect(container.querySelector(".mv-chat__field.is-call")).not.toBeNull();
    expect(container.querySelector("input[data-chat-input]")?.getAttribute("data-call")).toBe("");
    expect(container.querySelector("[data-will-button]")?.hasAttribute("data-call")).toBe(false);
    expect(container.querySelectorAll("[data-call]")).toHaveLength(1);
  });

  it("ChatPanel callWill → [유언] 단추 is-call·data-call, 입력칸에는 없다", () => {
    const { container } = chat({ callWill: true, onWill: () => {} });
    const will = container.querySelector("[data-will-button]");
    expect(will?.classList.contains("is-call")).toBe(true);
    expect(will?.getAttribute("data-call")).toBe("");
    expect(container.querySelectorAll("[data-call]")).toHaveLength(1);
  });

  it("ChatPanel call 없음 → 빛 0개", () => {
    const { container } = chat({ onWill: () => {} });
    expect(container.querySelectorAll("[data-call], .is-call")).toHaveLength(0);
  });
});

describe("빛남 토큰·CSS (D-02)", () => {
  it("glow-ring·glow-ring-peak 토큰이 tokens.json 과 tokens.css 에 있다", () => {
    for (const name of ["glow-ring", "glow-ring-peak"]) {
      expect(TOKENS_JSON).toContain(`"${name}"`);
      expect(TOKENS_CSS).toMatch(new RegExp(`--${name}:`));
    }
    // 시안(HostCaption.dc.html)의 light-lamp 두 겹 그림자 그대로
    expect(TOKENS_CSS).toMatch(/--glow-ring:\s*0 0 0 2px rgba\(255, 207, 138, 0\.35\),\s*0 0 14px rgba\(255, 207, 138, 0\.55\)/);
  });

  const bare = V2_CSS.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [...bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: (m[1] ?? "").trim(), body: m[2] ?? "" }));
  const callRules = rules.filter((r) => r.selector.includes("is-call"));

  it(".is-call 규칙이 있고 light-lamp 테두리·--glow-ring 을 쓴다, hex·rgb 리터럴 없음", () => {
    expect(callRules.length).toBeGreaterThanOrEqual(3);
    const all = callRules.map((r) => r.body).join(" ");
    expect(all).toMatch(/var\(--light-lamp\)/);
    expect(all).toMatch(/var\(--glow-ring\)/);
    for (const r of callRules) {
      expect(r.body, r.selector).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(r.body, r.selector).not.toMatch(/\brgba?\(/);
    }
  });

  it("맥박은 opacity 만 움직이고 box-shadow 값 자체는 애니메이션하지 않는다, 횟수가 정해져 있다(영원히 아님)", () => {
    const kf = bare.match(/@keyframes\s+mv-call-pulse\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/);
    expect(kf, "@keyframes mv-call-pulse").not.toBeNull();
    expect(kf?.[1] ?? "").toMatch(/opacity/);
    expect(kf?.[1] ?? "").not.toMatch(/box-shadow|transform|background|color/);
    const anim = callRules.map((r) => r.body).join(" ").match(/animation:[^;]*mv-call-pulse[^;]*/);
    expect(anim, "animation 선언").not.toBeNull();
    expect(anim?.[0] ?? "").toMatch(/var\(--dur-pulse\)/);
    expect(anim?.[0] ?? "").not.toMatch(/infinite/);
  });

  it("모션 줄이기 블록에서 맥박이 없다(정지 빛만)", () => {
    const blocks = [...bare.matchAll(/@media \(prefers-reduced-motion: reduce\)\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g)];
    const inside = blocks.flatMap((b) => [...(b[1] ?? "").matchAll(/([^{}]+)\{([^{}]*)\}/g)]).filter((m) => (m[1] ?? "").includes("is-call"));
    expect(inside.length).toBeGreaterThan(0);
    expect(inside.map((m) => m[2]).join(" ")).toMatch(/animation:\s*none/);
  });
});

// ── 맵 화면 연결 (Task 2) ─────────────────────────────────────────────

const NOW = 1_700_000_000_000;
const NAMES = ["민수", "영희", "서준", "지아", "도윤", "하은", "유진", "태오"];

interface MapOpts {
  phase: PhaseId;
  count?: number;
  mySeat?: number;
  role?: RoleId;
  dead?: number[];
  candidate?: number;
  /** 내가 이미 정한 값(서버 view) */
  points?: [number, number][];
  pick?: number;
  verdictVote?: boolean;
}

function mapView(o: MapOpts): RoomView {
  const count = o.count ?? 4;
  const mySeat = o.mySeat ?? 0;
  const players: PublicPlayer[] = Array.from({ length: count }, (_, seat) => ({
    seat,
    nickname: NAMES[seat] ?? `p${seat}`,
    connected: true,
    isHost: seat === 0,
    ...(o.dead?.includes(seat) ? { alive: false } : {}),
  }));
  const meDead = o.dead?.includes(mySeat) === true;
  const night = o.phase === "night";
  return {
    code: "0042",
    phase: o.phase,
    phaseEndsAt: NOW + 30_000,
    phaseDurationMs: 30_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players,
    me: {
      seat: mySeat,
      isHost: mySeat === 0,
      chat: meDead ? "ghost" : night && o.role === "mafia" ? "mafia" : "all",
      ...(o.role !== undefined ? { role: o.role } : {}),
      ...(o.pick !== undefined ? { pick: o.pick } : {}),
      ...(o.verdictVote !== undefined ? { verdictVote: o.verdictVote } : {}),
    },
    day: {
      n: 1,
      roles: [],
      ...(o.candidate !== undefined ? { candidate: o.candidate } : {}),
      ...(o.points ? { points: o.points.map(([seat, target]) => ({ seat, target })) } : {}),
    },
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
    send: vi.fn(),
    onEvent: vi.fn(() => () => {}),
    reconnect: vi.fn(),
    retry: vi.fn(),
    ...over,
  };
}

const mount = (view: RoomView, over: Partial<RoomConnection> = {}) => {
  connectionMock.current = conn(view, over);
  const ui = () => <RoomScreen code="0042" token={"t".repeat(43)} onExit={() => {}} />;
  const r = render(ui());
  return {
    ...r,
    show: (v: RoomView) => {
      const prev = connectionMock.current as RoomConnection;
      connectionMock.current = conn(v, { send: prev.send, onEvent: prev.onEvent, epoch: prev.epoch });
      r.rerender(ui());
    },
  };
};

/** 방 화면 전체의 빛남 DOM 과 이름표 call 좌석 */
const calls = (c: ParentNode): HTMLElement[] => [...c.querySelectorAll<HTMLElement>("[data-call]")];
const tagCalls = (count: number): number[] =>
  Array.from({ length: count }, (_, seat) => seat).filter((seat) => stage.props?.tagProps?.(seat).call === true);

describe("맵 화면 빛남 (HOST-03·04·05)", () => {
  afterEach(() => {
    cleanup();
    stage.props = null;
  });

  describe("토론 — 채팅 입력칸", () => {
    it("산 사람: data-call 은 채팅 입력칸 하나(값 없음), 이름표 call 은 0", () => {
      const { container } = mount(mapView({ phase: "discussion" }));
      const lit = calls(container);
      expect(lit).toHaveLength(1);
      expect(lit[0]?.matches("input[data-chat-input]")).toBe(true);
      expect(lit[0]?.getAttribute("data-call")).toBe("");
      expect(tagCalls(4)).toEqual([]);
    });

    it("입력칸에 포커스하면 즉시 0개, 같은 view 가 다시 와도 되살아나지 않는다(UI#8)", () => {
      const { container, show } = mount(mapView({ phase: "discussion" }));
      fireEvent.focus(container.querySelector("input[data-chat-input]")!);
      expect(calls(container)).toHaveLength(0);
      show(mapView({ phase: "discussion" }));
      expect(calls(container)).toHaveLength(0);
    });

    it("단계가 바뀌면 새 단계의 빛으로 넘어간다(토론 → 투표: 입력칸은 꺼지고 이름표가 켜진다)", () => {
      const { container, show } = mount(mapView({ phase: "discussion" }));
      fireEvent.focus(container.querySelector("input[data-chat-input]")!);
      show(mapView({ phase: "nomination" }));
      expect(calls(container)).toHaveLength(0);
      expect(tagCalls(4)).toEqual([1, 2, 3]);
    });

    it("유령 토론은 0개", () => {
      const { container } = mount(mapView({ phase: "discussion", dead: [0] }));
      expect(calls(container)).toHaveLength(0);
      expect(tagCalls(4)).toEqual([]);
    });
  });

  describe("투표 — 이름표 전부 (UI#7)", () => {
    it("4명 중 1명 사망: 나와 죽은 사람을 뺀 이름표만 call", () => {
      mount(mapView({ phase: "nomination", dead: [2] }));
      expect(tagCalls(4)).toEqual([1, 3]);
    });

    it("zero-one-many: 산 사람이 2명이면 1개, 8명이면 7개, 유령은 0개", () => {
      mount(mapView({ phase: "nomination", dead: [2, 3] }));
      expect(tagCalls(4)).toEqual([1]);
      cleanup();
      mount(mapView({ phase: "nomination", count: 8 }));
      expect(tagCalls(8)).toEqual([1, 2, 3, 4, 5, 6, 7]);
      cleanup();
      mount(mapView({ phase: "nomination", dead: [0] }));
      expect(tagCalls(4)).toEqual([]);
    });

    it("하나를 누르면 모두 꺼지고, 서버가 거절해도 되살아나지 않는다", () => {
      const listeners: Array<(e: { t: "error"; code: string }, meta: { epoch: number }) => void> = [];
      const onEvent = vi.fn((l: (typeof listeners)[number]) => {
        listeners.push(l);
        return () => {};
      });
      mount(mapView({ phase: "nomination" }), { onEvent: onEvent as unknown as RoomConnection["onEvent"] });
      expect(tagCalls(4)).toEqual([1, 2, 3]);
      act(() => stage.props!.pick!.onPick(2));
      expect(tagCalls(4)).toEqual([]);
      act(() => listeners.forEach((l) => l({ t: "error", code: "WRONG_PHASE" }, { epoch: 1 })));
      expect(stage.props?.pick?.mine).toBeUndefined();
      expect(tagCalls(4)).toEqual([]);
    });

    it("이미 골랐으면(재접속) 처음부터 켜지 않는다. is-blink 는 기본판 투표에 없다(U-7)", () => {
      mount(mapView({ phase: "nomination", points: [[0, 2]] }));
      expect(tagCalls(4)).toEqual([]);
      cleanup();
      mount(mapView({ phase: "nomination" }));
      for (const seat of [1, 2, 3]) expect(stage.props?.tagProps?.(seat).blink).toBeUndefined();
    });

    it("순차 지목(day.turn)에는 빛이 없다 — 13 기본판 투표만", () => {
      const v = mapView({ phase: "nomination" });
      mount({ ...v, day: { ...v.day!, turn: { order: [1, 2, 3, 0], i: 0 } } as RoomView["day"] });
      expect(tagCalls(4)).toEqual([]);
    });
  });

  describe("최후 변론 — [유언] (HOST-04)", () => {
    it("변론자 본인: [유언] 단추 하나만 data-call, 누르면 시트가 열리며 0개", () => {
      const { container } = mount(mapView({ phase: "defense", mySeat: 2, candidate: 2 }));
      const lit = calls(container);
      expect(lit).toHaveLength(1);
      expect(lit[0]?.matches("button[data-will-button]")).toBe(true);
      expect(container.querySelector("input[data-chat-input]")?.hasAttribute("data-call")).toBe(false);
      fireEvent.click(lit[0]!);
      expect(calls(container)).toHaveLength(0);
    });

    it("변론자가 아닌 산 사람·유령은 0개", () => {
      const a = mount(mapView({ phase: "defense", mySeat: 0, candidate: 2 }));
      expect(calls(a.container)).toHaveLength(0);
      a.unmount();
      const b = mount(mapView({ phase: "defense", mySeat: 0, candidate: 2, dead: [0] }));
      expect(calls(b.container)).toHaveLength(0);
    });
  });

  describe("찬반 — [찬성]·[반대]", () => {
    it("변론자 아닌 산 사람: 두 단추 모두 call, 하나를 고르면 0개", () => {
      const { container } = mount(mapView({ phase: "verdict", mySeat: 0, candidate: 2 }));
      const lit = calls(container);
      expect(lit).toHaveLength(2);
      expect(lit.map((b) => b.getAttribute("data-verdict"))).toEqual(["yes", "no"]);
      fireEvent.click(lit[1]!);
      expect(calls(container)).toHaveLength(0);
    });

    it("변론자 본인·유령·이미 고른 사람은 0개", () => {
      const a = mount(mapView({ phase: "verdict", mySeat: 2, candidate: 2 }));
      expect(calls(a.container)).toHaveLength(0);
      a.unmount();
      const b = mount(mapView({ phase: "verdict", mySeat: 0, candidate: 2, dead: [0] }));
      expect(calls(b.container)).toHaveLength(0);
      b.unmount();
      const c = mount(mapView({ phase: "verdict", mySeat: 0, candidate: 2, verdictVote: true }));
      expect(calls(c.container)).toHaveLength(0);
    });
  });

  describe("밤 — 경찰·의사 얼굴 칸만, 그 밖은 0개 (T-14-11)", () => {
    const faceCalls = (c: ParentNode) => calls(c).map((b) => b.getAttribute("data-face"));

    it("산 경찰: 나(1)를 뺀 산 사람 얼굴 칸 전부, 하나를 고르면 0개", () => {
      const { container } = mount(mapView({ phase: "night", mySeat: 1, role: "police", dead: [3] }));
      expect(faceCalls(container)).toEqual(["0", "2"]);
      expect(calls(container).every((b) => b.getAttribute("data-call") === "")).toBe(true);
      fireEvent.click(container.querySelector('button[data-face="2"]')!);
      expect(calls(container)).toHaveLength(0);
    });

    it("산 의사: 나 포함 산 사람 얼굴 칸 전부", () => {
      const { container } = mount(mapView({ phase: "night", mySeat: 2, role: "doctor" }));
      expect(faceCalls(container)).toEqual(["0", "1", "2", "3"]);
    });

    it("이미 고른 경찰(재접속)은 켜지 않는다", () => {
      const { container } = mount(mapView({ phase: "night", mySeat: 1, role: "police", pick: 0 }));
      expect(calls(container)).toHaveLength(0);
    });

    it("산 마피아·산 시민·유령·죽은 경찰: 방 화면 전체에 data-call 0개, 이름표 call 도 0", () => {
      for (const o of [
        { mySeat: 0, role: "mafia" as RoleId },
        { mySeat: 3, role: "citizen" as RoleId },
        { mySeat: 1, role: "police" as RoleId, dead: [1] },
        { mySeat: 0, role: "mafia" as RoleId, dead: [0] },
      ]) {
        const { container, unmount } = mount(mapView({ phase: "night", ...o }));
        expect(calls(container), JSON.stringify(o)).toHaveLength(0);
        expect(tagCalls(4), JSON.stringify(o)).toEqual([]);
        unmount();
      }
    });
  });

  describe("그 밖 단계·한 종류만", () => {
    it("낮 시작·처형·아침은 0개", () => {
      for (const phase of ["dayAnnounce", "execution", "morning"] as PhaseId[]) {
        const v = mapView({ phase, candidate: 2 });
        const { container, unmount } = mount(
          phase === "execution" ? { ...v, day: { ...v.day!, verdict: { yes: 3, no: 0, passed: true } } } : phase === "morning" ? { ...v, day: { ...v.day!, morning: {} } } : v,
        );
        expect(calls(container), phase).toHaveLength(0);
        expect(tagCalls(4), phase).toEqual([]);
        unmount();
      }
    });

    it("한 화면에는 한 종류만: 투표는 이름표만(DOM data-call 0), 토론은 입력칸만(이름표 call 0)", () => {
      const vote = mount(mapView({ phase: "nomination" }));
      expect(calls(vote.container)).toHaveLength(0);
      expect(tagCalls(4)).toHaveLength(3);
      vote.unmount();
      const talk = mount(mapView({ phase: "discussion" }));
      expect(calls(talk.container)).toHaveLength(1);
      expect(tagCalls(4)).toHaveLength(0);
    });

    it("빛남은 소리를 내지 않는다 — 신호 관련 새 코드 없음(소스 검사)", () => {
      const src = readFileSync("src/screens/GameMap.tsx", "utf8");
      const block = src.slice(src.indexOf("callTargetsOf(view)"), src.indexOf("const stageTagProps"));
      expect(block).not.toMatch(/emitSignal/);
    });
  });
});
