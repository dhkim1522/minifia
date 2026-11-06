/// <reference types="node" />
import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { RoleId } from "../../shared/game/roles";
import type { PhaseId, RoleRecord, RoomView } from "../../shared/protocol";
import type { RoomConnection } from "../../src/net/useRoomConnection";
import { installMemoryStorage } from "../helpers/memoryStorage";
import type { MemoryStorage } from "../helpers/memoryStorage";

// 역할 카드 흐름(03.1-11, 결정 0026, UI-SPEC A·D): 헤더 [역할 카드] 하나, 앰버 점, 읽음·NEW 를
// RoomScreen 으로 만난다. 옛 records.test.tsx(03-11)의 시나리오를 새 계약으로 옮긴 것이다.
// 실패 보고서가 한 줄이 되도록 단언은 문자열·불리언·숫자로 둔다.

const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));
vi.mock("../../src/net/assets", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/net/assets")>()),
  preloadRoleAssets: vi.fn(),
}));

const { RoomScreen } = await import("../../src/screens/RoomScreen");

const NOW = 1_700_000_000_000;
const KEY = "minifia:records:0042";

interface ViewOpts {
  phase?: PhaseId;
  role?: RoleId;
  records?: RoleRecord[];
  meAlive?: boolean;
  n?: number;
}

const POLICE_ONE: RoleRecord[] = [{ n: 1, target: 1, isMafia: false }];
const POLICE_TWO: RoleRecord[] = [...POLICE_ONE, { n: 2, target: 2, isMafia: true }];

function makeView(o: ViewOpts = {}): RoomView {
  const role = o.role ?? "police";
  const me: RoomView["me"] = { seat: 0, isHost: false, role };
  if (role === "mafia") me.allies = [1];
  if (o.records !== undefined) me.records = o.records;
  const phase = o.phase ?? "discussion";
  const names = ["지우", "하윤", "민지", "도현"];
  const roleReveal = phase === "roleReveal";
  return {
    code: "0042",
    phase,
    phaseEndsAt: roleReveal ? NOW + 15_000 : NOW + 20_000,
    phaseDurationMs: roleReveal ? 15_000 : phase === "morning" ? 5_000 : 30_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players: names.map((nickname, seat) => ({
      seat,
      nickname,
      connected: true,
      isHost: seat === 0,
      ...(seat === 0 && o.meAlive === false ? { alive: false } : {}),
    })),
    me,
    day: {
      n: o.n ?? 1,
      roles: ["mafia", "police", "doctor", "citizen"],
      ...(phase === "morning" ? { morning: {} } : {}),
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

function renderRoom(view: RoomView, over: Partial<RoomConnection> = {}) {
  connectionMock.current = conn(view, over);
  return render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
}

// 같은 RoomScreen 에 새 view 를 준다(연결 mock 의 값을 바꾸고 다시 그린다)
function feed(r: ReturnType<typeof renderRoom>, view: RoomView, over: Partial<RoomConnection> = {}) {
  connectionMock.current = conn(view, over);
  r.rerender(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
}

const advance = (ms: number): void => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

const headBtn = (): HTMLElement | null => document.querySelector<HTMLElement>(".mf-rolecard-btn");
const headDot = (): boolean => headBtn()?.querySelector(".mf-rolecard-btn__dot") != null;
const sheet = (): HTMLElement | null => document.querySelector<HTMLElement>('dialog[aria-label="역할 카드"]');
const tabs = (): HTMLElement[] => Array.from(document.querySelectorAll<HTMLElement>('dialog[aria-label="역할 카드"] [role="tab"]'));
const tabNamed = (label: string): HTMLElement | null => tabs().find((t) => t.textContent?.startsWith(label)) ?? null;
const selectedTab = (): string => tabs().find((t) => t.getAttribute("aria-selected") === "true")?.textContent ?? "(선택 없음)";
const tabDot = (): boolean => document.querySelector(".mf-rolecard__tab .mf-rolecard__dot") != null;
const rows = (): HTMLElement[] => Array.from(document.querySelectorAll<HTMLElement>("dialog .mf-journal__row"));
const newMarks = (): string[] => rows().map((r) => (r.querySelector(".mf-journal__new") ? "NEW" : "-"));

function openSheet() {
  const b = headBtn();
  expect(b === null ? "(버튼 없음)" : "버튼").toBe("버튼");
  fireEvent.click(b!);
}
function openActivity() {
  const t = tabNamed("활동 기록");
  expect(t === null ? "(활동 기록 탭 없음)" : "탭").toBe("탭");
  fireEvent.click(t!);
}
function closeSheet() {
  const x = document.querySelector<HTMLElement>('dialog[aria-label="역할 카드"] .mf-sheet__close');
  expect(x === null ? "(닫기 없음)" : "닫기").toBe("닫기");
  fireEvent.click(x!);
  advance(400);
}

let storage: MemoryStorage;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  storage = installMemoryStorage();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("헤더 [역할 카드] 버튼 하나 (D-08)", () => {
  const ROLES: RoleId[] = ["police", "mafia", "doctor", "citizen"];
  const PHASES: PhaseId[] = ["roleReveal", "dayAnnounce", "discussion", "night", "morning"];

  it.each(ROLES)("%s: 모든 단계에서 `역할 카드` 버튼이 정확히 하나, `수사 기록`·`내 역할` 이름의 버튼은 없다", (role) => {
    for (const phase of PHASES) {
      const r = renderRoom(makeView({ role, phase }));
      const buttons = Array.from(document.querySelectorAll<HTMLElement>("button"));
      const names = buttons.map((b) => b.getAttribute("aria-label") ?? b.textContent ?? "");
      const head = buttons.filter((b) => b.classList.contains("mf-rolecard-btn"));
      expect(`${phase}:${head.length}`).toBe(`${phase}:1`);
      // 낮 시작~아침은 08-13·08-18 부터 맵 화면이라 글자 없는 아이콘 버튼이다(UI-SPEC A2). 이름은 두 모양 모두 `역할 카드`
      const mapPhase = phase !== "roleReveal";
      expect(`${phase}:${head[0]!.textContent}`).toBe(`${phase}:${mapPhase ? "" : "역할 카드"}`);
      expect(`${phase}:${head[0]!.getAttribute("aria-label")}`).toBe(`${phase}:역할 카드`);
      expect(`${phase}:${names.some((x) => x.includes("수사 기록"))}`).toBe(`${phase}:false`);
      expect(`${phase}:${names.some((x) => x === "내 역할")}`).toBe(`${phase}:false`);
      r.unmount();
    }
  });

  it("버튼에는 아이콘 20 이 있고 글자는 `역할 카드` 뿐이다 (역할 확인 — 글자가 있는 틀; 옛 투표 단계 화면은 08-19 에 지움)", () => {
    renderRoom(makeView({ phase: "roleReveal" }));
    const svg = headBtn()?.querySelector("svg");
    expect(svg?.getAttribute("width") ?? "(아이콘 없음)").toBe("20");
    expect(headBtn()?.textContent).toBe("역할 카드");
  });

  it("맵 화면(낮 토론)의 버튼은 아이콘 22 만 있고 글자가 없는 44×44 아이콘 버튼이다 (08-13, UI-SPEC A2)", () => {
    renderRoom(makeView({ phase: "discussion" }));
    const svg = headBtn()?.querySelector("svg");
    expect(svg?.getAttribute("width") ?? "(아이콘 없음)").toBe("22");
    expect(headBtn()?.textContent).toBe("");
    expect(headBtn()?.classList.contains("mf-iconbtn")).toBe(true);
  });
});

describe("앰버 점과 읽음 (D-11)", () => {
  it("경찰이 기록 2개·읽은 개수 0: 이름 `역할 카드, 새 기록`, 점 1개(aria-hidden)", () => {
    renderRoom(makeView({ phase: "discussion", records: POLICE_TWO }));
    expect(headBtn()?.getAttribute("aria-label")).toBe("역할 카드, 새 기록");
    const dots = headBtn()!.querySelectorAll(".mf-rolecard-btn__dot");
    expect(dots.length).toBe(1);
    expect(dots[0]!.getAttribute("aria-hidden")).toBe("true");
  });

  it("기록 0개 또는 모두 읽음이면 이름 `역할 카드`, 점 없음", () => {
    renderRoom(makeView({ records: [] }));
    expect(headBtn()?.getAttribute("aria-label")).toBe("역할 카드");
    expect(headDot()).toBe(false);
    cleanup();
    storage.setItem(KEY, "2");
    renderRoom(makeView({ records: POLICE_TWO }));
    expect(headBtn()?.getAttribute("aria-label")).toBe("역할 카드");
    expect(headDot()).toBe(false);
  });

  it("시민·기록 없는 view 는 점이 없다", () => {
    renderRoom(makeView({ role: "citizen" }));
    expect(headDot()).toBe(false);
    expect(headBtn()?.getAttribute("aria-label")).toBe("역할 카드");
  });

  it("누르면 dialog `역할 카드` 가 `내 역할` 탭으로 열리고 점은 그대로이며 탭에 `활동 기록, 새 기록` 점이 있다", () => {
    renderRoom(makeView({ records: POLICE_TWO }));
    openSheet();
    expect(sheet() === null ? "닫힘" : "열림").toBe("열림");
    expect(selectedTab()).toBe("내 역할");
    expect(headDot()).toBe(true);
    expect(tabNamed("활동 기록")?.getAttribute("aria-label")).toBe("활동 기록, 새 기록");
    expect(tabDot()).toBe(true);
    expect(storage.getItem(KEY) ?? "(저장 없음)").toBe("(저장 없음)");
  });

  it("`활동 기록` 탭을 보면 두 점이 함께 사라지고 저장값이 `2`, 이번에 새로 본 2줄에 NEW 가 붙는다", () => {
    renderRoom(makeView({ records: POLICE_TWO }));
    openSheet();
    openActivity();
    expect(selectedTab()).toBe("활동 기록");
    expect(headDot()).toBe(false);
    expect(headBtn()?.getAttribute("aria-label")).toBe("역할 카드");
    expect(tabDot()).toBe(false);
    expect(storage.getItem(KEY)).toBe("2");
    expect(newMarks()).toEqual(["NEW", "NEW"]);
  });

  it("시트를 닫으면 NEW 가 사라지고 다시 열어도 점도 NEW 도 없다", () => {
    renderRoom(makeView({ records: POLICE_TWO }));
    openSheet();
    openActivity();
    closeSheet();
    expect(sheet() === null ? "닫힘" : "열림").toBe("닫힘");
    openSheet();
    expect(tabDot()).toBe(false);
    expect(headDot()).toBe(false);
    openActivity();
    expect(rows().length).toBe(2);
    expect(newMarks()).toEqual(["-", "-"]);
  });

  it("저장소에는 방 코드 키 하나뿐이고 값은 숫자 문자열이다(기록 내용·토큰 없음)", () => {
    renderRoom(makeView({ records: POLICE_TWO }));
    openSheet();
    openActivity();
    expect(storage.length).toBe(1);
    expect(storage.key(0)).toBe(KEY);
    expect(/^\d+$/.test(storage.getItem(KEY) ?? "")).toBe(true);
    expect(JSON.stringify(Object.keys(storage)).includes("tttt")).toBe(false);
  });

  it("재마운트(새로고침): 읽은 뒤에는 점이 없고, 안 읽고 나가면 점이 그대로 복원된다", () => {
    const first = renderRoom(makeView({ records: POLICE_TWO }));
    first.unmount();
    renderRoom(makeView({ records: POLICE_TWO }));
    expect(headDot()).toBe(true);
    openSheet();
    openActivity();
    cleanup();
    renderRoom(makeView({ records: POLICE_TWO }));
    expect(headDot()).toBe(false);
  });

  it("활동 기록 탭을 보는 중 기록이 하나 늘면 점은 생기지 않고(즉시 읽음) 새 줄에 NEW 가 더해지고 저장값이 오른다", () => {
    const r = renderRoom(makeView({ phase: "night", records: POLICE_ONE }));
    openSheet();
    openActivity();
    expect(newMarks()).toEqual(["NEW"]);
    feed(r, makeView({ phase: "morning", records: POLICE_TWO }));
    expect(headDot()).toBe(false);
    expect(tabDot()).toBe(false);
    expect(newMarks()).toEqual(["NEW", "NEW"]);
    expect(storage.getItem(KEY)).toBe("2");
  });

  it("`내 역할` 탭을 보는 중 기록이 늘면 읽음 처리하지 않고 점이 켜진다", () => {
    const r = renderRoom(makeView({ phase: "night", records: [] }));
    openSheet();
    feed(r, makeView({ phase: "morning", records: POLICE_ONE }));
    expect(selectedTab()).toBe("내 역할");
    expect(headDot()).toBe(true);
    expect(storage.getItem(KEY) ?? "(저장 없음)").toBe("(저장 없음)");
  });
});

describe("옛 [수사 기록] 시나리오 이전 (03.1-11 Task 3)", () => {
  it("기록 0개: 활동 기록 탭은 빈 문구 `아직 조사한 사람이 없어요` 이고 줄이 없다", () => {
    renderRoom(makeView({ records: [] }));
    openSheet();
    openActivity();
    expect(document.querySelector("dialog .mf-journal__empty")?.textContent ?? "(빈 문구 없음)").toBe("아직 조사한 사람이 없어요");
    expect(rows().length).toBe(0);
  });

  it("view.me.records 가 없는 경찰(옛 서버)도 깨지지 않고 빈 상태다", () => {
    renderRoom(makeView({}));
    expect(headDot()).toBe(false);
    openSheet();
    openActivity();
    expect(document.querySelector("dialog .mf-journal__empty") === null ? "빈 문구 없음" : "빈 문구").toBe("빈 문구");
  });

  it("읽은 개수 1 + 기록 2개면 점이 켜지고, 활동 기록 탭에서 모자란 한 줄(맨 위)만 NEW 다", () => {
    storage.setItem(KEY, "1");
    renderRoom(makeView({ records: POLICE_TWO }));
    expect(headBtn()?.getAttribute("aria-label")).toBe("역할 카드, 새 기록");
    openSheet();
    openActivity();
    expect(newMarks()).toEqual(["NEW", "-"]);
    expect(storage.getItem(KEY)).toBe("2");
  });

  it("읽은 개수가 기록 수보다 커도(위조·새 판) 점이 켜지지 않는다", () => {
    storage.setItem(KEY, "99");
    renderRoom(makeView({ records: POLICE_ONE }));
    expect(headDot()).toBe(false);
  });
});

describe("css 규약: 머리말 간격과 [역할 카드] 버튼 (UI-SPEC A·S5)", () => {
  const phaseCss = readFileSync("src/styles/phase.css", "utf8");
  const roleCss = readFileSync("src/styles/rolecard.css", "utf8");
  const rule = (css: string, sel: string): string => {
    const at = css.indexOf(`\n${sel} {`);
    return at < 0 ? "" : css.slice(css.indexOf("{", at) + 1, css.indexOf("}", at));
  };

  it(".mf-phasebar__extra 에 gap var(--space-sm) (옛 낮 시작 상단 줄은 없다)", () => {
    expect(/gap:\s*var\(--space-sm\)/.test(rule(phaseCss, ".mf-phasebar__extra"))).toBe(true);
    expect(/display:\s*flex/.test(rule(phaseCss, ".mf-phasebar__extra"))).toBe(true);
    expect(rule(phaseCss, ".mf-day__top")).toBe("");
  });

  it("버튼은 14px 굵게·안쪽 12·아이콘 간격 8·줄바꿈 없음·점이 밖으로 나오도록 overflow visible", () => {
    const r = rule(roleCss, ".mf-rolecard-btn");
    expect(/position:\s*relative/.test(r)).toBe(true);
    expect(/overflow:\s*visible/.test(r)).toBe(true);
    expect(/padding:\s*0 12px/.test(r)).toBe(true);
    expect(/gap:\s*8px/.test(r)).toBe(true);
    expect(/font-size:\s*14px/.test(r)).toBe(true);
    expect(/font-weight:\s*700/.test(r)).toBe(true);
    expect(/white-space:\s*nowrap/.test(r)).toBe(true);
  });

  it("점은 안쪽 12 + 테두리 2 night-900, 오른쪽 위 -4, 앰버 면, 전환·애니메이션 없음", () => {
    const d = rule(roleCss, ".mf-rolecard-btn__dot");
    expect(/width:\s*12px/.test(d) && /height:\s*12px/.test(d)).toBe(true);
    expect(/right:\s*-4px/.test(d) && /top:\s*-4px/.test(d)).toBe(true);
    expect(/background:\s*var\(--amber-400\)/.test(d)).toBe(true);
    expect(/border:\s*2px solid var\(--night-900\)/.test(d)).toBe(true);
    expect(/box-sizing:\s*content-box/.test(d)).toBe(true);
    expect(/transition|animation/.test(d)).toBe(false);
  });
});

describe("단계가 바뀌어도, 새 판에서 (Pitfall 19 ⑧, D-11)", () => {
  it("night → morning → dayAnnounce 로 바뀌어도 열린 시트와 선택한 탭이 유지된다", () => {
    const r = renderRoom(makeView({ phase: "night", records: POLICE_ONE }));
    openSheet();
    openActivity();
    feed(r, makeView({ phase: "morning", records: POLICE_ONE }));
    expect(sheet() === null ? "닫힘" : "열림").toBe("열림");
    expect(selectedTab()).toBe("활동 기록");
    feed(r, makeView({ phase: "dayAnnounce", n: 2, records: POLICE_ONE }));
    expect(sheet() === null ? "닫힘" : "열림").toBe("열림");
    expect(selectedTab()).toBe("활동 기록");
    expect(headBtn() === null ? "버튼 없음" : "버튼 있음").toBe("버튼 있음");
  });

  it("lobby·assigning view 를 받으면 시트가 닫히고 읽은 개수가 0 으로 저장된다", () => {
    for (const phase of ["lobby", "assigning"] as const) {
      storage.setItem(KEY, "3");
      const r = renderRoom(makeView({ phase: "discussion", records: POLICE_ONE }));
      openSheet();
      feed(r, { ...makeView({ phase }), me: { seat: 0, isHost: true } });
      expect(`${phase}:${storage.getItem(KEY)}`).toBe(`${phase}:0`);
      expect(`${phase}:${sheet() === null ? "닫힘" : "열림"}`).toBe(`${phase}:닫힘`);
      r.unmount();
    }
  });
});

describe("역할 확인에서 앞면을 본 적이 없으면 뒷면만", () => {
  it("앞면을 보기 전에는 탭·직업 글자·그림이 없는 뒷면이고, 앞면을 본 뒤에는 앞면 본문과 탭이 보인다", () => {
    renderRoom(makeView({ phase: "roleReveal", role: "police", records: [] }));
    openSheet();
    expect(tabs().length).toBe(0);
    expect(sheet()?.querySelectorAll("img").length).toBe(0);
    expect(sheet()?.textContent?.includes("경찰") ? "직업 글자 있음" : "직업 글자 없음").toBe("직업 글자 없음");
    expect(sheet()?.querySelector(".mf-rolecard__back") === null ? "뒷면 없음" : "뒷면").toBe("뒷면");
    closeSheet();
    advance(5_000);
    openSheet();
    expect(tabs().length).toBe(2);
    expect(sheet()?.querySelector(".mf-rolecard__name")?.textContent).toBe("경찰");
    expect(sheet()?.querySelector(".mf-rolecard__back") === null ? "뒷면 없음" : "뒷면").toBe("뒷면 없음");
  });
});

describe("탈락한 사람과 역할별 일지", () => {
  it.each(["police", "mafia", "doctor"] as const)("탈락한 %s 도 같은 버튼·탭·일지를 본다", (role) => {
    const records: RoleRecord[] =
      role === "police" ? POLICE_ONE : role === "mafia" ? [{ n: 1, target: 2, died: true }] : [{ n: 1, target: 2 }];
    renderRoom(makeView({ role, phase: "night", meAlive: false, records }));
    openSheet();
    expect(tabs().length).toBe(2);
    openActivity();
    expect(rows().length).toBe(1);
  });

  it("마피아 일지는 팀 암살일지 줄(`사망`/`생존`)로, 의사 일지는 `보호` 줄로 그려진다", () => {
    renderRoom(
      makeView({
        role: "mafia",
        records: [
          { n: 1, target: 2, died: true },
          { n: 2, target: 3, died: false },
        ],
      }),
    );
    openSheet();
    openActivity();
    expect(document.querySelector(".mf-journal--mafia") === null ? "암살일지 아님" : "암살일지").toBe("암살일지");
    expect(rows().map((x) => x.querySelector(".mf-journal__rz")?.textContent)).toEqual(["생존", "사망"]);
    cleanup();
    renderRoom(makeView({ role: "doctor", records: [{ n: 1, target: 2 }] }));
    openSheet();
    openActivity();
    expect(document.querySelector(".mf-journal--doctor") === null ? "치료일지 아님" : "치료일지").toBe("치료일지");
    expect(rows().map((x) => x.querySelector(".mf-journal__rz")?.textContent)).toEqual(["보호"]);
  });
});

describe("밤 끝 알림 없음 (결정 0028, UI-SPEC D·R6)", () => {
  const nightEnd = (role: RoleId, rec: RoleRecord) => {
    const r = renderRoom(makeView({ role, phase: "night", records: [] }));
    feed(r, makeView({ role, phase: "morning", records: [rec] }));
    return r;
  };
  // 일지 알림이 없다는 뜻이라, 맵 화면의 구조 자리(맵 불러오는 카드·빈 위 알림 영역)와 아침 결과 알림([data-announce], 08-18)과 자막 띠 문장([data-host-line], 14-01)은 세지 않는다
  const statusCount = (): number =>
    [...document.querySelectorAll('[role="status"]')].filter(
      (e) => !e.classList.contains("mf-mapcard") && !e.hasAttribute("data-announce") && !e.hasAttribute("data-host-line") && (e.textContent ?? "").trim() !== "",
    ).length;

  it.each([
    ["police", { n: 1, target: 2, isMafia: true }],
    ["mafia", { n: 1, target: 2, died: true }],
    ["doctor", { n: 1, target: 2 }],
  ] as const)("%s: 같은 접속에서 기록이 늘어도 알림은 없고 헤더 앰버 점만 켜진다", (role, rec) => {
    nightEnd(role, rec as RoleRecord);
    expect(statusCount()).toBe(0);
    expect(document.body.textContent?.includes("눌러서 보기") ? "있음" : "없음").toBe("없음");
    expect(document.body.textContent?.includes("일지가 추가됐어요") ? "있음" : "없음").toBe("없음");
    expect(headDot()).toBe(true);
  });

  it("시민에게는 알림이 없다", () => {
    const r = renderRoom(makeView({ role: "citizen", phase: "night" }));
    const v = makeView({ role: "citizen", phase: "morning" });
    v.me.records = [{ n: 1, target: 2, isMafia: true }];
    feed(r, v);
    expect(statusCount()).toBe(0);
  });

  it("헤더 [역할 카드] -> 활동 기록 탭을 열면 점이 사라지고 새 줄에 NEW 가 붙고 읽은 개수 1 이 저장된다", () => {
    nightEnd("police", { n: 1, target: 2, isMafia: true });
    expect(headDot()).toBe(true);
    openSheet();
    openActivity();
    expect(selectedTab()).toBe("활동 기록");
    expect(headDot()).toBe(false);
    expect(tabDot()).toBe(false);
    expect(newMarks()).toEqual(["NEW"]);
    expect(storage.getItem(KEY)).toBe("1");
  });
});
