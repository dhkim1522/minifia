import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { RoomView } from "../../shared/protocol";
import type { RoomConnection } from "../../src/net/useRoomConnection";
import { COUNTS, CANDIDATE_SEAT, NAMES, NOW, STAGES, VIEWERS, previousView, verdictFixture, viewAt } from "../helpers/verdictViews";
import type { Count, FixtureOpts, VerdictStage, Viewer } from "../helpers/verdictViews";

// 처형 구간 화면 일곱 × 보는 사람 상태 여섯 × 인원 둘 (04-28, CONN-02, D-02, D-05, D-09, D-35, D-36).
// 단계별 시험은 자기 픽스처로 자기 단계만 본다. 이 표는 화면이 모두 연결된 RoomScreen 한 경로에 같은 불변식을 모든 칸에 건다.
// 서버와는 view 픽스처(test/helpers/verdictViews.ts)로만 만난다. 폰 폭별 겹침은 E2E(04-29~)가 본다.
const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));
const { RoomScreen } = await import("../../src/screens/RoomScreen");

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

// 렌더마다 새 요소를 만든다 — 같은 요소 객체로 rerender 하면 React 가 다시 그리지 않는다
const room = () => <RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />;

/** 칸을 그린다. 재접속은 같은 접속의 직전 단계(epoch 1)에서 이 단계(epoch 2)로 넘어온 것으로 그린다 */
function mount(opts: FixtureOpts) {
  const fx = verdictFixture(opts);
  if (opts.viewer === "rejoin") {
    connectionMock.current = conn(previousView(opts));
    const r = render(room());
    connectionMock.current = conn(fx.view, fx.over);
    r.rerender(room());
    settle(opts.stage);
    return r;
  }
  connectionMock.current = conn(fx.view, fx.over);
  const r = render(room());
  settle(opts.stage);
  return r;
}

// 공개 단계는 시간표가 돌아야 칩·화살표·후광이 그려진다(후광 상한이 시험 대상). 그 밖은 곧바로 그려진다.
function settle(stage: VerdictStage): void {
  if (stage === "candidateVoteReveal") act(() => vi.advanceTimersByTime(2_000));
}

let errors: string[] = [];
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  errors = [];
  const record = (kind: string) => (...args: unknown[]) => {
    errors.push(`${kind}: ${String(args[0]).split("\n")[0]}`);
  };
  vi.spyOn(console, "error").mockImplementation(record("console.error"));
  vi.spyOn(console, "warn").mockImplementation(record("console.warn"));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const all = (c: ParentNode, sel: string): HTMLElement[] => Array.from(c.querySelectorAll<HTMLElement>(sel));
const buttonsNamed = (c: ParentNode, text: string): HTMLButtonElement[] =>
  all(c, "button").filter((b) => b.textContent?.trim() === text) as HTMLButtonElement[];
const voteSeatButtons = (c: ParentNode) => all(c, 'button[aria-label$="투표 대상"]') as HTMLButtonElement[];
const textOf = (el: Element | null | undefined) => el?.textContent ?? "";

/** 모든 칸 공통 불변식. 어긋난 것을 한 줄씩 모아 어떤 칸의 무엇이 틀렸는지 한 번에 읽히게 한다 */
function commonProblems(c: HTMLElement, opts: FixtureOpts): string[] {
  const { stage, viewer, count } = opts;
  const p: string[] = [];
  if (c.textContent?.includes("연결 중…")) p.push("연결 중… 화면");
  if (stage === "ended") {
    if (!c.querySelector(".mf-result")) p.push(".mf-result 없음");
    const cards = all(c, ".mf-result__card").length;
    if (cards !== count) p.push(`결과 카드 ${cards}/${count}`);
  } else {
    if (!c.querySelector(".mf-dt")) p.push(".mf-dt 없음");
    const tags = all(c, ".mf-dt__tag").length;
    if (tags !== count) p.push(`이름표 ${tags}/${count}`);
    // D-02: 익명 — 장면(.mf-dt) 안에는 여부 표 글자가 없다
    const dt = textOf(c.querySelector(".mf-dt"));
    if (/찬성|반대/.test(dt)) p.push("테이블 안에 찬성/반대 글자");
    // D-09: 살아 있는 보는 사람 화면에는 직업 그림이 없다(동료 표시는 마름모일 뿐)
    if (viewer !== "spectator" && c.innerHTML.includes("/characters/roles/")) p.push("직업 그림 노출");
  }
  // 변론 하단은 누구에게나(후보 본인·탈락 관전자 포함) 채팅 패널이고 버튼은 보내기 하나뿐이다 — 빠른 메시지·이모티콘 입구는 없다(CHAT-06, 07-15)
  if (stage === "defense" && all(c, ".mf-dayscene__panel button:not([data-chat-send])").length > 0) p.push("변론 하단에 보내기 밖의 버튼");
  // D1: 투표·공개·처형 단계에는 입력줄이 없다(8·9페이즈가 새로 짓는다)
  if (["execVote", "candidateVote", "candidateVoteReveal", "execution"].includes(stage) && c.querySelector("[data-chat-panel], [data-chat-input]")) p.push("D1 단계에 채팅 입력줄");
  // 후광은 한 화면 최대 3개
  const halos = all(c, 'img[class*="mf-figure--halo"]').length;
  if (halos > 3) p.push(`후광 ${halos}개`);
  for (const e of errors) p.push(e);
  return p;
}

/** 보는 사람 상태별 불변식 (단계에 따라 입력이 있는 칸만) */
function viewerProblems(c: HTMLElement, opts: FixtureOpts): string[] {
  const { stage, viewer } = opts;
  const p: string[] = [];
  const disabled = (els: HTMLButtonElement[]) => els.filter((b) => !b.disabled).length;
  if (viewer === "spectator" && stage !== "ended") {
    // D-35: 탈락 관전 — 어떤 입력도 없고 읽기 전용 줄이 있다
    if (buttonsNamed(c, "찬성").length + buttonsNamed(c, "반대").length > 0) p.push("관전인데 찬성/반대 버튼");
    if (voteSeatButtons(c).length > 0) p.push("관전인데 투표 대상 버튼");
    if (["execVote", "candidateVote"].includes(stage) && !c.querySelector(".mf-ro")) p.push("읽기 전용 줄 없음");
    // 변론과 밤(처형 무효로 온 밤)의 탈락 관전자는 읽기 전용 줄 대신 유령 채팅 패널을 쓴다(07-15, CHAT-03)
    if (["defense", "noExecution"].includes(stage) && c.querySelector('[data-chat-channel="ghost"]') === null) p.push("유령 채팅 패널 없음");
    // 탐지기 확인: 관전자는 다른 사람의 직업 그림을 본다(이 탐지기가 살아 있는 칸에서 비어 있는 것이 의미 있도록)
    if (!c.innerHTML.includes("/characters/roles/")) p.push("관전 직업 그림 없음(탐지기 점검)");
  }
  if (viewer === "selfOffline" && stage !== "ended") {
    // D-36: 내 연결이 끊겨 보낼 수 없으면 모든 입력이 꺼진다
    if (stage === "execVote") {
      const btns = [...buttonsNamed(c, "찬성"), ...buttonsNamed(c, "반대")];
      if (btns.length !== 2) p.push(`찬성/반대 버튼 ${btns.length}개`);
      if (disabled(btns) > 0) p.push("끊겼는데 찬성/반대가 켜져 있음");
    }
    if (stage === "candidateVote") {
      const seats = voteSeatButtons(c);
      if (seats.length === 0) p.push("투표 대상 버튼 없음");
      if (disabled(seats) > 0) p.push("끊겼는데 투표 대상이 켜져 있음");
    }
    if (!c.querySelector(".mf-reconnect")) p.push("재접속 띠 없음");
  }
  if (viewer === "otherOffline" && stage !== "ended") {
    // 남의 끊김: 그 자리는 흐리게 보이지만 규칙은 그대로다
    if (all(c, ".mf-figure--disconnected").length === 0) p.push("끊긴 자리 흐림 없음");
    if (stage === "candidateVote") {
      const target = voteSeatButtons(c).find((b) => (b.getAttribute("aria-label") ?? "").startsWith(NAMES[CANDIDATE_SEAT]!));
      if (!target) p.push("끊긴 자리가 고를 수 있는 버튼이 아님");
      else if (target.disabled) p.push("끊긴 자리 버튼이 꺼져 있음");
    }
  }
  if (viewer === "mafiaAlly" && stage !== "ended") {
    if (all(c, ".mf-dt__mark").length === 0) p.push("동료 마름모 없음");
  }
  if (viewer === "rejoin") {
    // 재접속: 같은 접속에서만 도는 연출(인트로 카드·처형 무효 카드·결과 공개)은 켜지지 않는다
    if (c.querySelector(".mf-vintro")) p.push("재접속인데 카드 연출");
    if (stage === "ended" && c.querySelector(".mf-result")?.getAttribute("data-stage") !== "done") p.push("재접속인데 결과 연출 중");
  }
  return p;
}

// 변론·처형은 08-13 부터, 처형 무효로 온 밤(noExecution)은 08-18 부터 맵 화면(GameMap)이라 옛 테이블 화면 불변식(마름모·후광·유령 패널 등)은 이 세 단계에서 뺐다.
// 맵 화면의 같은 뜻(익명·직업 비노출·유령 채널·밤 고리)은 gameMap.test·nightMap.test 와 뒤 계획의 화면 시험이 본다.
const TABLE_STAGES: readonly VerdictStage[] = STAGES.filter((s) => s !== "defense" && s !== "execution" && s !== "noExecution");

describe.each(TABLE_STAGES)("처형 구간 화면 %s", (stage: VerdictStage) => {
  describe.each(VIEWERS)("보는 사람 %s", (viewer: Viewer) => {
    it.each(COUNTS)("%i명: 연결 중… 이 아닌 화면에 익명·직업 비노출·후광 상한·연결 규칙이 모두 맞다", (count: Count) => {
      const opts: FixtureOpts = { stage, viewer, count };
      const { container } = mount(opts);
      const problems = [...commonProblems(container, opts), ...viewerProblems(container, opts)];
      expect(problems.join(" | "), `${stage}/${viewer}/${count}명`).toBe("");
    });
  });
});

describe("재접속 대조: 같은 접속의 같은 전환에서는 연출이 켜진다", () => {
  const cases: Array<{ stage: VerdictStage; selector: string; attr?: [string, string] }> = [
    { stage: "ended", selector: ".mf-result", attr: ["data-stage", "neutral"] },
  ];
  it.each(cases)("$stage: epoch 가 같으면 연출이 있고(재접속 칸의 없음이 의미를 가진다)", ({ stage, selector, attr }) => {
    const opts: FixtureOpts = { stage, viewer: "alive", count: 4 };
    connectionMock.current = conn(previousView(opts));
    const r = render(room());
    connectionMock.current = conn(verdictFixture(opts).view);
    r.rerender(room());
    const el = r.container.querySelector(selector);
    expect(el, `${stage} 연출 요소`).not.toBeNull();
    if (attr) expect(el!.getAttribute(attr[0]), `${stage} ${attr[0]}`).toBe(attr[1]);
  });
});

describe("내가 후보인 변론 화면 (D-36, D-09, CHAT-01, 07-15)", () => {
  it.each(COUNTS)("%i명: 후보 본인도 남과 같은 채팅 패널이고, 연결이 끊기면 보내기만 꺼지고 입력칸은 쓸 수 있다", (count: Count) => {
    const opts: FixtureOpts = { stage: "defense", viewer: "selfOffline", count, meIsCandidate: true };
    const { container } = mount(opts);
    const panel = container.querySelector(".mf-game__panel")!;
    expect(panel.querySelectorAll('[data-chat-panel][data-chat-channel="all"]').length, "채팅 패널").toBe(1);
    expect(panel.querySelectorAll(".mf-turnpanel, .st-row").length, "옛 상태 줄").toBe(0);
    expect([...panel.querySelectorAll("button")].map((b) => b.getAttribute("aria-label")), "버튼").toEqual(["보내기"]);
    expect(panel.querySelector("[data-chat-send]")?.getAttribute("aria-disabled"), "보내기").toBe("true");
    expect(panel.querySelector<HTMLInputElement>("[data-chat-input]")?.disabled, "입력칸").toBe(false);
    expect(errors.join(" | ")).toBe("");
  });

  it.each(COUNTS)("%i명: 연결이 멀쩡해도 입구는 채팅 패널 하나뿐이고 직업 그림은 없다", (count: Count) => {
    const opts: FixtureOpts = { stage: "defense", viewer: "alive", count, meIsCandidate: true };
    const { container } = mount(opts);
    const panel = container.querySelector(".mf-game__panel")!;
    expect(panel.querySelectorAll('[data-chat-panel][data-chat-channel="all"]').length, "채팅 패널").toBe(1);
    expect(panel.querySelectorAll(".mf-turnpanel, .st-row").length, "옛 상태 줄").toBe(0);
    expect(panel.querySelectorAll("input, textarea").length, "입력칸").toBe(1);
    expect([...panel.querySelectorAll("button")].map((b) => b.getAttribute("aria-label")), "버튼").toEqual(["보내기"]);
    expect(container.innerHTML.includes("/characters/roles/"), "직업 그림").toBe(false);
    expect(errors.join(" | ")).toBe("");
  });
});

describe("도우미 점검", () => {
  it("viewAt: 같은 입력은 같은 view 를 만든다(결정적)", () => {
    const o: FixtureOpts = { stage: "candidateVoteReveal", viewer: "alive", count: 8 };
    expect(JSON.stringify(viewAt("candidateVoteReveal", o, false))).toBe(JSON.stringify(viewAt("candidateVoteReveal", o, false)));
  });
});
