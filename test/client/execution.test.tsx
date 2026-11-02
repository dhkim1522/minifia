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

  it("처형 카드·하단·무대 부품의 소스는 직업 문구 표를 읽지 않는다", () => {
    for (const f of ["src/components/MorningCard.tsx", "src/screens/verdictScene.tsx"]) {
      const src = readFileSync(f, "utf8");
      expect(src).not.toMatch(/roleText|ROLE_TEXT|ROLE_IDS|roleArtSrc/);
    }
  });
});

describe("execution 연결 (라우팅)", () => {
  it("RoomScreen 은 execution 을 맵 화면(GameMap)으로 그리고 장면 키가 defense 와 같다(맵이 다시 마운트되지 않음, 08-13)", () => {
    const src = readFileSync("src/screens/RoomScreen.tsx", "utf8");
    expect(src).toContain('case "execution"');
    expect(src).toContain("executionTitle");
    const r = renderRoom(makeView({ phase: "defense" }));
    const stage = r.container.querySelector("[data-game-stage]");
    expect(stage).not.toBeNull();
    r.rerenderRoom(makeView({ phase: "execution" }));
    expect(r.container.querySelector("[data-game-stage]") === stage).toBe(true);
    expect(r.container.querySelector(".mf-dt")).toBeNull();
  });

  it("이모티콘·메시지 입구가 없고 말풍선 층이 없다", () => {
    const { container } = renderRoom(makeView({ me: 0 }));
    expect(container.querySelectorAll(".mf-dt__bubble").length).toBe(0);
    expect(screen.queryByRole("button", { name: "이모티콘" })).toBeNull();
  });
});
