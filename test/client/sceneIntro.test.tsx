/// <reference types="node" />
import { readFileSync } from "node:fs";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DAY_ANNOUNCE_MS } from "../../shared/game/phases";
import type { RoleId } from "../../shared/game/roles";
import type { PhaseId, RoomView } from "../../shared/protocol";
import { SCENE_FADE_MS, SCENE_INTRO_MS } from "../../src/game/scenes";
import { DayScene } from "../../src/screens/DayScene";
import type { RoomConnection } from "../../src/net/useRoomConnection";

// 낮·밤 시작 문구(결정 0028 → 0030): 한 부품(SceneIntro)이 두 장면에 쓰인다.
// 같은 접속에서 단계가 바뀌는 순간에만 한 번 뜬다 — 비밤 → 밤, 비dayAnnounce → dayAnnounce.
// 길이는 서버 낮 시작 단계(DAY_ANNOUNCE_MS)와 같고, 재접속(epoch 변화)·처음 마운트·같은 단계 안 다시 그리기에는 뜨지 않는다.
// 낮 시작 전용 화면(Day)은 없다: dayAnnounce 도 테이블 장면(DayScene) 위에서 그려진다.

const NOW = 1_700_000_000_000;

function makeView(o: { phase: PhaseId; n?: number; role?: RoleId; allies?: number[]; dead?: number[] }): RoomView {
  const me: RoomView["me"] = { seat: 0, isHost: false };
  if (o.role !== undefined) me.role = o.role;
  if (o.allies !== undefined) me.allies = o.allies;
  const dead = o.dead ?? [];
  return {
    code: "0042",
    phase: o.phase,
    phaseEndsAt: NOW + 30_000,
    phaseDurationMs: 30_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players: [
      { seat: 0, nickname: "지우", connected: true, isHost: true },
      { seat: 1, nickname: "하윤", connected: true, isHost: false },
      { seat: 2, nickname: "민지", connected: true, isHost: false },
      { seat: 3, nickname: "도현", connected: true, isHost: false },
    ].map((p) => (dead.includes(p.seat) ? { ...p, alive: false } : p)),
    me,
    day: { n: o.n ?? 1, roles: ["mafia", "police", "citizen"], claimLog: [] },
  };
}

function conn(view: RoomView, epoch: number): RoomConnection {
  return {
    status: "open",
    banner: "hidden",
    view,
    offset: 0,
    epoch,
    removedReason: null,
    canSend: true,
    send: vi.fn(() => true),
    onEvent: vi.fn(() => () => {}),
    reconnect: vi.fn(),
    retry: vi.fn(),
  };
}

const btn = <button type="button">내 역할</button>;
function scene(view: RoomView, epoch = 1, arrivedFrom?: PhaseId | null) {
  const utils = render(<DayScene view={view} connection={conn(view, epoch)} myRoleButton={btn} arrivedFrom={arrivedFrom} />);
  const rerender = (v: RoomView, e = epoch) =>
    utils.rerender(<DayScene view={v} connection={conn(v, e)} myRoleButton={btn} arrivedFrom={arrivedFrom} />);
  return { ...utils, rerender };
}
const intro = (c: HTMLElement) => c.querySelector<HTMLElement>(".mf-sceneintro");
const introTexts = (c: HTMLElement) => Array.from(intro(c)!.querySelectorAll("p")).map((p) => p.textContent);
const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

const DAY_TEXTS = ["토론 전에 먼저 직업을 공개해요"];

afterEach(cleanup);

describe("SceneIntro 밤 문구 (결정 0028, U-03)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("토론 → 밤(같은 epoch)이면 aria-hidden 문구 `1일차`·`밤이 되었습니다` 가 뜨고 장면 제목 h1 은 여전히 `밤` 하나다", () => {
    const { container, rerender } = scene(makeView({ phase: "discussion", role: "citizen" }));
    expect(intro(container)).toBeNull();
    rerender(makeView({ phase: "night", role: "citizen" }));
    const el = intro(container)!;
    expect(el).not.toBeNull();
    expect(el.classList.contains("mf-sceneintro--night")).toBe(true);
    expect(el.getAttribute("aria-hidden")).toBe("true");
    expect(introTexts(container)).toEqual(["1일차", "밤이 되었습니다"]);
    const h1s = container.querySelectorAll("h1");
    expect(h1s.length).toBe(1);
    expect(h1s[0]?.textContent).toBe("밤");
    expect(el.querySelector("h1")).toBeNull();
  });

  it("처음 마운트가 밤이면 뜨지 않는다 (arrivedFrom 없음)", () => {
    const { container } = scene(makeView({ phase: "night", role: "citizen" }));
    expect(intro(container)).toBeNull();
  });

  it("단계와 epoch 가 함께 바뀌면(재접속) 뜨지 않는다", () => {
    const { container, rerender } = scene(makeView({ phase: "discussion", role: "citizen" }), 1);
    rerender(makeView({ phase: "night", role: "citizen" }), 2);
    expect(intro(container)).toBeNull();
  });

  it("SCENE_INTRO_MS 는 낮 시작 단계 길이와 같고, 1999ms 에는 있고 2000ms 에는 사라진다", () => {
    expect(SCENE_INTRO_MS).toBe(DAY_ANNOUNCE_MS);
    expect(DAY_ANNOUNCE_MS).toBe(2000);
    const { container, rerender } = scene(makeView({ phase: "discussion", role: "citizen" }));
    rerender(makeView({ phase: "night", role: "citizen" }));
    advance(1999);
    expect(intro(container)).not.toBeNull();
    advance(1);
    expect(intro(container)).toBeNull();
  });

  it("같은 밤의 새 view 로 다시 그려도 타이머가 연장되지 않고, 사라진 뒤 다시 그려도 돌아오지 않는다", () => {
    const { container, rerender } = scene(makeView({ phase: "discussion", role: "citizen" }));
    rerender(makeView({ phase: "night", role: "citizen" }));
    advance(1000);
    rerender(makeView({ phase: "night", role: "citizen" }));
    expect(intro(container)).not.toBeNull();
    advance(999);
    expect(intro(container)).not.toBeNull();
    advance(1);
    expect(intro(container)).toBeNull();
    rerender(makeView({ phase: "night", role: "citizen" }));
    expect(intro(container)).toBeNull();
    advance(5000);
    expect(intro(container)).toBeNull();
  });

  it("밤 → 아침으로 가면 즉시 사라지고, 다음 밤(2일차)에 `2일차` 로 다시 뜬다", () => {
    const { container, rerender } = scene(makeView({ phase: "discussion", role: "citizen" }));
    rerender(makeView({ phase: "night", role: "citizen" }));
    expect(intro(container)).not.toBeNull();
    advance(500);
    rerender(makeView({ phase: "morning", role: "citizen" }));
    expect(intro(container)).toBeNull();
    rerender(makeView({ phase: "discussion", role: "citizen", n: 2 }));
    rerender(makeView({ phase: "night", role: "citizen", n: 2 }));
    expect(introTexts(container)).toEqual(["2일차", "밤이 되었습니다"]);
    advance(SCENE_INTRO_MS);
    expect(intro(container)).toBeNull();
  });

  it("역할 4종과 탈락자 화면 모두 같은 글자다 (역할 유출 없음)", () => {
    const texts: string[] = [];
    const cases: Array<{ role: RoleId; dead?: number[] }> = [
      { role: "mafia" },
      { role: "police" },
      { role: "doctor" },
      { role: "citizen" },
      { role: "citizen", dead: [0] },
    ];
    for (const c of cases) {
      const { container, rerender, unmount } = scene(makeView({ phase: "discussion", role: c.role, ...(c.dead ? { dead: c.dead } : {}) }));
      rerender(makeView({ phase: "night", role: c.role, ...(c.dead ? { dead: c.dead } : {}) }));
      const el = intro(container);
      expect(el).not.toBeNull();
      texts.push(el!.textContent ?? "");
      unmount();
    }
    expect(new Set(texts).size).toBe(1);
    expect(texts[0]).toBe("1일차밤이 되었습니다");
  });
});

describe("SceneIntro 낮 문구 (낮 시작, 결정 0030)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("아침 → 낮 시작(같은 epoch)이면 `2일차`·`낮이 되었습니다`·보조줄이 뜨고 aria-hidden 이며 제목 요소가 아니다", () => {
    const { container, rerender } = scene(makeView({ phase: "morning", role: "citizen" }));
    expect(intro(container)).toBeNull();
    rerender(makeView({ phase: "dayAnnounce", role: "citizen", n: 2 }));
    const el = intro(container)!;
    expect(el).not.toBeNull();
    expect(el.classList.contains("mf-sceneintro--day")).toBe(true);
    expect(el.getAttribute("aria-hidden")).toBe("true");
    expect(introTexts(container)).toEqual(["2일차", "낮이 되었습니다", ...DAY_TEXTS]);
    expect(el.querySelector("h1")).toBeNull();
    // 장면 제목 h1 은 `낮` 하나뿐이다
    const h1s = container.querySelectorAll("h1");
    expect(h1s.length).toBe(1);
    expect(h1s[0]?.textContent).toBe("낮");
  });

  it("처음 마운트가 낮 시작이면 뜨지 않고, epoch 가 함께 바뀌어도(재접속) 뜨지 않는다", () => {
    expect(intro(scene(makeView({ phase: "dayAnnounce", role: "citizen" })).container)).toBeNull();
    cleanup();
    const { container, rerender } = scene(makeView({ phase: "morning", role: "citizen" }), 1);
    rerender(makeView({ phase: "dayAnnounce", role: "citizen", n: 2 }), 2);
    expect(intro(container)).toBeNull();
  });

  it("역할 확인에서 새로 마운트될 때(arrivedFrom roleReveal)는 마운트 직후 `1일차` 낮 문구가 뜬다. arrivedFrom 이 없으면 뜨지 않는다", () => {
    const withArrival = scene(makeView({ phase: "dayAnnounce", role: "citizen" }), 1, "roleReveal");
    expect(introTexts(withArrival.container)).toEqual(["1일차", "낮이 되었습니다", ...DAY_TEXTS]);
    cleanup();
    expect(intro(scene(makeView({ phase: "dayAnnounce", role: "citizen" }), 1, null).container)).toBeNull();
  });

  it("2000ms 에 사라지고(1999ms 에는 있다), 같은 단계 다시 그리기로 연장·재등장하지 않는다", () => {
    const { container, rerender } = scene(makeView({ phase: "dayAnnounce", role: "citizen" }), 1, "roleReveal");
    advance(1000);
    rerender(makeView({ phase: "dayAnnounce", role: "citizen" }));
    advance(999);
    expect(intro(container)).not.toBeNull();
    advance(1);
    expect(intro(container)).toBeNull();
    rerender(makeView({ phase: "dayAnnounce", role: "citizen" }));
    expect(intro(container)).toBeNull();
  });

  it("단계가 바뀌면(낮 시작 → 주장) 즉시 사라진다", () => {
    const { container, rerender } = scene(makeView({ phase: "morning", role: "citizen" }));
    rerender(makeView({ phase: "dayAnnounce", role: "citizen", n: 2 }));
    advance(500);
    expect(intro(container)).not.toBeNull();
    rerender(makeView({ phase: "claim", role: "citizen", n: 2 }));
    expect(intro(container)).toBeNull();
  });

  it("문구는 view 의 역할·탈락 여부를 읽지 않는다 — 역할 4종과 탈락자가 같은 글자", () => {
    const texts: string[] = [];
    const cases: Array<{ role: RoleId; dead?: number[] }> = [
      { role: "mafia" },
      { role: "police" },
      { role: "doctor" },
      { role: "citizen" },
      { role: "citizen", dead: [0] },
    ];
    for (const c of cases) {
      const dead = c.dead ? { dead: c.dead } : {};
      const { container, rerender, unmount } = scene(makeView({ phase: "morning", role: c.role, ...dead }));
      rerender(makeView({ phase: "dayAnnounce", role: c.role, ...dead }));
      texts.push(intro(container)?.textContent ?? "없음");
      unmount();
    }
    expect(new Set(texts).size).toBe(1);
    expect(texts[0]).toBe("1일차낮이 되었습니다토론 전에 먼저 직업을 공개해요");
  });
});

describe("dayAnnounce 는 테이블 장면(DayScene) 위에서 그려진다", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("제목 h1 `낮`·안내 `N일차`·타이머·테이블·하단 패널·[내 역할] 버튼이 있고 옛 낮 시작 화면 클래스는 없다", () => {
    const { container } = scene(makeView({ phase: "dayAnnounce", role: "citizen", n: 3 }));
    expect(container.querySelector("main.mf-dayscene")).not.toBeNull();
    const h1s = container.querySelectorAll("h1");
    expect(h1s.length).toBe(1);
    expect(h1s[0]?.textContent).toBe("낮");
    expect(container.querySelector(".mf-phasebar__do")?.textContent).toBe("3일차");
    expect(container.querySelector('[role="timer"]')).not.toBeNull();
    expect(container.querySelector(".mf-dt")).not.toBeNull();
    expect(container.querySelector(".mf-dayscene__panel")).not.toBeNull();
    expect(container.querySelector("button")?.textContent).toBe("내 역할");
    expect(container.querySelector("[class*='mf-day__'], .mf-day, [class*='mf-nightintro']")).toBeNull();
  });

  it("자리는 누를 수 없다 (기록 카드·밤 선택 버튼이 없다)", () => {
    const { container } = scene(makeView({ phase: "dayAnnounce", role: "police" }));
    expect(container.querySelectorAll(".mf-dt button").length).toBe(0);
  });

  it("경찰·의사·시민·역할 없음 view 의 마크업이 같고, 마피아만 동료 후광·마름모가 더 있다", () => {
    const html = (view: RoomView) => {
      const { container, unmount } = scene(view);
      const out = container.innerHTML;
      unmount();
      return out;
    };
    const citizen = html(makeView({ phase: "dayAnnounce", role: "citizen" }));
    expect(html(makeView({ phase: "dayAnnounce", role: "police" }))).toBe(citizen);
    expect(html(makeView({ phase: "dayAnnounce", role: "doctor" }))).toBe(citizen);
    expect(html(makeView({ phase: "dayAnnounce" }))).toBe(citizen);
    const mafia = html(makeView({ phase: "dayAnnounce", role: "mafia", allies: [2] }));
    expect(mafia).not.toBe(citizen);
    const strip = (h: string) => h.replace(/ mf-figure--halo-crimson/g, "").replace(/<svg[^>]*mf-dt__mark[\s\S]*?<\/svg>/g, "");
    expect(strip(mafia)).toBe(citizen);
    expect(mafia).toContain("mf-figure--halo-crimson");
  });

  it("낮 시작에서 탈락자는 관전 하단(읽기 전용 줄)을 본다. 살아 있는 사람 하단은 비어 있다", () => {
    const alive = scene(makeView({ phase: "dayAnnounce", role: "citizen" }));
    expect(alive.container.querySelector(".mf-dayscene__panel")?.children.length).toBe(0);
    cleanup();
    const dead = scene(makeView({ phase: "dayAnnounce", role: "citizen", dead: [0] }));
    expect((dead.container.querySelector(".mf-dayscene__panel")?.children.length ?? 0) > 0).toBe(true);
  });

  it("dayAnnounce ↔ 주장·밤·아침으로 가도 테이블과 장면 상자 노드가 유지된다", () => {
    const { container, rerender } = scene(makeView({ phase: "morning", role: "citizen" }));
    const table = container.querySelector(".mf-dt");
    const box = container.querySelector(".mf-dayscene__scene");
    expect(table).not.toBeNull();
    for (const phase of ["dayAnnounce", "claim", "discussion", "night", "morning"] as PhaseId[]) {
      rerender(makeView({ phase, role: "citizen", n: 2 }));
      expect(container.querySelector(".mf-dt") === table, phase).toBe(true);
      expect(container.querySelector(".mf-dayscene__scene") === box, phase).toBe(true);
    }
  });
});

// ---- 배경 전환: 같은 DayScene 안에서 층만 바뀐다 ----

function stubImages() {
  class FakeImage {
    src = "";
    decode(): Promise<void> {
      return Promise.resolve();
    }
  }
  vi.stubGlobal("Image", FakeImage);
}
const layers = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>(".mf-backdrop__art")].map((el) => `${el.dataset.scene}:${el.dataset.state}`);
const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};
const advanceAsync = async (ms: number) => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
};

describe("DayScene 배경 장면 전환 (결정 0030, 해·달은 이미지에 맡김)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    stubImages();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("토론(day) → 밤(night) → 아침(morning) → 낮 시작(day): 전환이 끝나면 매번 한 층, 장면은 단계의 장면이다", async () => {
    const { container, rerender } = scene(makeView({ phase: "discussion", role: "citizen" }));
    expect(layers(container)).toEqual(["day:current"]);
    for (const [phase, sceneId] of [
      ["night", "night"],
      ["morning", "morning"],
      ["dayAnnounce", "day"],
    ] as const) {
      rerender(makeView({ phase, role: "citizen", n: 2 }));
      expect(layers(container).at(-1)).toBe(`${sceneId}:entering`);
      await flush();
      expect(layers(container).at(-1)).toBe(`${sceneId}:current`);
      await advanceAsync(SCENE_FADE_MS + 200);
      expect(layers(container)).toEqual([`${sceneId}:current`]);
    }
  });

  it("단계와 epoch 가 함께 바뀌면(재접속) 크로스페이드 없이 곧바로 한 층이다", () => {
    const { container, rerender } = scene(makeView({ phase: "discussion", role: "citizen" }), 1);
    rerender(makeView({ phase: "night", role: "citizen" }), 2);
    expect(layers(container)).toEqual(["night:current"]);
  });

  it("같은 epoch 의 단계 변화는 instant 가 아니다 (이전 층이 남고 새 층이 켜진다). 이후 재접속 전환 뒤에도 다시 크로스페이드한다", async () => {
    const { container, rerender } = scene(makeView({ phase: "discussion", role: "citizen" }), 1);
    rerender(makeView({ phase: "night", role: "citizen" }), 2);
    expect(layers(container)).toEqual(["night:current"]);
    rerender(makeView({ phase: "morning", role: "citizen" }), 2);
    expect(layers(container)).toEqual(["night:current", "morning:entering"]);
    await flush();
    expect(layers(container)).toEqual(["night:leaving", "morning:current"]);
  });

  it("역할 확인에서 새로 마운트되면(arrivedFrom roleReveal) lobby 그림으로 시작해 day 로 크로스페이드한다", async () => {
    const { container } = scene(makeView({ phase: "dayAnnounce", role: "citizen" }), 1, "roleReveal");
    expect(layers(container)).toEqual(["lobby:current", "day:entering"]);
    await flush();
    expect(layers(container)).toEqual(["lobby:leaving", "day:current"]);
    await advanceAsync(SCENE_FADE_MS + 200);
    expect(layers(container)).toEqual(["day:current"]);
  });

  it("처음 마운트(arrivedFrom 없음)는 곧바로 한 층이다", () => {
    const { container } = scene(makeView({ phase: "dayAnnounce", role: "citizen" }));
    expect(layers(container)).toEqual(["day:current"]);
  });
});

describe("night.css: .mf-sceneintro (밤·낮 시작 문구 한 부품)", () => {
  const raw = readFileSync("src/styles/night.css", "utf8");
  const css = raw.replace(/\/\*[\s\S]*?\*\//g, "");
  const blocks = css.match(/[^{}]*mf-sceneintro[^{}]*\{[^}]*\}/g) ?? [];
  const rule = (sel: string): string => {
    const m = new RegExp(`(?:^|\\})\\s*${sel.replace(/[.]/g, "\\.")}\\s*\\{([^}]*)\\}`).exec(css);
    return m?.[1] ?? "";
  };

  it("루트: absolute·inset 0·pointer-events none·z-index 40(DayTable 위, 닻·토스트 50 아래)", () => {
    const r = rule(".mf-sceneintro");
    expect(/position:\s*absolute/.test(r)).toBe(true);
    expect(/inset:\s*0\b/.test(r)).toBe(true);
    expect(/pointer-events:\s*none/.test(r)).toBe(true);
    expect(/z-index:\s*40\b/.test(r)).toBe(true);
    expect(/--z-overlay:\s*50\b/.test(readFileSync("src/styles/tokens.css", "utf8"))).toBe(true);
  });

  it("막은 같은 방사형 기하(70% 55% at 50% 38%)에 night-950, 밤 톤 85%·낮 톤 70%", () => {
    expect(/radial-gradient\(\s*70% 55% at 50% 38%/.test(rule(".mf-sceneintro__veil"))).toBe(true);
    expect(rule(".mf-sceneintro__veil").includes("var(--night-950)")).toBe(true);
    expect(/--mf-sceneintro-veil:\s*85%/.test(rule(".mf-sceneintro--night"))).toBe(true);
    expect(/--mf-sceneintro-veil:\s*70%/.test(rule(".mf-sceneintro--day"))).toBe(true);
  });

  it("퇴장 지연은 인라인 변수에서 받고, 막·제목·보조줄 번짐은 --dur-slow·--ease-out 이다", () => {
    expect(/animation:[^;]*var\(--mf-sceneintro-exit-delay[,)]/.test(rule(".mf-sceneintro"))).toBe(true);
    expect(/animation:[^;]*var\(--dur-slow\)\s+var\(--ease-out\)/.test(rule(".mf-sceneintro__veil"))).toBe(true);
    expect(/animation:[^;]*var\(--dur-slow\)\s+var\(--ease-out\)/.test(rule(".mf-sceneintro__title"))).toBe(true);
    expect(/animation:[^;]*var\(--dur-slow\)\s+var\(--ease-out\)/.test(rule(".mf-sceneintro__sub"))).toBe(true);
    expect(/@keyframes mf-sceneintro-\w+/.test(css)).toBe(true);
  });

  it("보조줄은 16px/1.5·gray-100·글자 그림자 (옛 낮 시작 보조줄과 같은 값)", () => {
    const r = rule(".mf-sceneintro__sub");
    expect(/font-size:\s*16px/.test(r)).toBe(true);
    expect(/line-height:\s*1\.5/.test(r)).toBe(true);
    expect(/color:\s*var\(--gray-100\)/.test(r)).toBe(true);
    expect(/text-shadow:\s*var\(--shadow-text\)/.test(r)).toBe(true);
  });

  it("축소 모션 개별 규칙이 없고(전역 규칙에 맡김) 그 전역 규칙이 있다", () => {
    expect(blocks.length).toBeGreaterThan(0);
    const re = /@media[^{]*prefers-reduced-motion[^{]*\{/g;
    for (let m = re.exec(css); m; m = re.exec(css)) {
      let depth = 1;
      let i = re.lastIndex;
      for (; i < css.length && depth > 0; i++) depth += css[i] === "{" ? 1 : css[i] === "}" ? -1 : 0;
      expect(css.slice(re.lastIndex, i).includes("mf-sceneintro")).toBe(false);
    }
    const base = readFileSync("src/styles/base.css", "utf8");
    expect(/prefers-reduced-motion:\s*reduce\)\s*\{[^@]*animation-duration:\s*0\.01ms\s*!important/.test(base)).toBe(true);
  });

  it("코드 줄에 # 색 값이 없다 (토큰 변수만)", () => {
    expect(blocks.some((b) => /#[0-9a-fA-F]{3,8}\b/.test(b))).toBe(false);
  });

  it("옛 낮 시작 화면·밤 문구 규칙이 남아 있지 않다 (phase.css·day.css·night.css)", () => {
    for (const f of ["src/styles/phase.css", "src/styles/day.css", "src/styles/night.css"]) {
      const text = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      expect(/mf-day__|\.mf-day\b|mf-day-(morning|title)|mf-nightintro/.test(text), f).toBe(false);
    }
  });
});
