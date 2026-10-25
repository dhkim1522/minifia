/// <reference types="node" />
import { existsSync, readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { RoleId } from "../../shared/game/roles";
import type { InvestigationRecord, PhaseId, RoomView } from "../../shared/protocol";
import type { RoomConnection } from "../../src/net/useRoomConnection";
import { installMemoryStorage } from "../helpers/memoryStorage";
import type { MemoryStorage } from "../helpers/memoryStorage";

// 경찰 수사 기록(03-11): [수사 기록] 버튼·새 기록 점·시트·알림을 RoomScreen 으로 만난다.
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
  allies?: number[];
  records?: InvestigationRecord[];
  meAlive?: boolean;
  n?: number;
}

function makeView(o: ViewOpts = {}): RoomView {
  const me: RoomView["me"] = { seat: 0, isHost: false };
  me.role = o.role ?? "police";
  if (o.allies !== undefined) me.allies = o.allies;
  if (o.records !== undefined) me.records = o.records;
  const phase = o.phase ?? "discussion";
  const names = ["지우", "하윤", "민지", "도현"];
  return {
    code: "0042",
    phase,
    phaseEndsAt: NOW + 20_000,
    phaseDurationMs: phase === "morning" ? 5_000 : 30_000,
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
      ...(phase === "claim" ? { turn: { seat: 1 } } : {}),
      claimLog: [],
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

const recordsBtn = (): HTMLElement | null => document.querySelector<HTMLElement>(".mf-records-btn");
const roleBtn = (): HTMLElement | null =>
  Array.from(document.querySelectorAll<HTMLElement>("button")).find((b) => b.textContent?.includes("내 역할")) ?? null;
const sheet = (): HTMLElement | null => document.querySelector<HTMLElement>('dialog[aria-label="수사 기록"]');
const rows = (): HTMLElement[] => Array.from(document.querySelectorAll<HTMLElement>('dialog[aria-label="수사 기록"] .mf-records__row'));

function openSheet() {
  const b = recordsBtn();
  expect(b, "[수사 기록] 버튼").not.toBeNull();
  fireEvent.click(b!);
}

function closeSheet() {
  const x = document.querySelector<HTMLElement>('dialog[aria-label="수사 기록"] .mf-sheet__close');
  expect(x, "시트 닫기 버튼").not.toBeNull();
  fireEvent.click(x!);
  act(() => {
    vi.advanceTimersByTime(400);
  });
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

describe("[수사 기록] 버튼과 새 기록 점 (03-11)", () => {
  it("경찰 낮 토론: '수사 기록, 새 기록' 버튼이 '내 역할' 앞에 있고 안에 aria-hidden 점이 있다", () => {
    renderRoom(makeView({ records: [{ n: 1, target: 2, isMafia: true }] }));
    const b = recordsBtn();
    expect(b?.getAttribute("aria-label") ?? "(없음)").toBe("수사 기록, 새 기록");
    const dot = b?.querySelector(".mf-records-btn__dot");
    expect(dot === null || dot === undefined ? "(점 없음)" : dot.getAttribute("aria-hidden")).toBe("true");
    const role = roleBtn();
    expect(role === null ? "(내 역할 없음)" : "ok").toBe("ok");
    expect(Boolean(b!.compareDocumentPosition(role!) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });

  it.each([
    ["citizen", undefined],
    ["mafia", [1]],
    ["doctor", undefined],
  ] as const)("%s 화면에는 수사 기록 버튼이 없다", (role, allies) => {
    renderRoom(makeView({ role, ...(allies ? { allies: [...allies] } : {}) }));
    expect(recordsBtn() === null ? "없음" : "있음").toBe("없음");
    expect(document.body.textContent?.includes("수사 기록") ? "문구 있음" : "문구 없음").toBe("문구 없음");
  });

  it("직업 공개·밤·아침·낮 시작 발표에서도 경찰에게는 버튼이 있다", () => {
    for (const phase of ["dayAnnounce", "claim", "discussion", "night", "morning"] as const) {
      const r = renderRoom(makeView({ phase }));
      expect(`${phase}:${recordsBtn() === null ? "없음" : "있음"}`).toBe(`${phase}:있음`);
      r.unmount();
    }
  });

  it("누르면 '마피아 수사 기록' 시트가 열리고 줄 하나에 NEW 가 붙으며 본 개수가 저장된다", () => {
    renderRoom(makeView({ records: [{ n: 1, target: 2, isMafia: true }] }));
    openSheet();
    expect(sheet() === null ? "(시트 없음)" : "열림").toBe("열림");
    expect(sheet()!.querySelector("h2")?.textContent).toBe("마피아 수사 기록");
    const list = sheet()!.querySelector("ol.mf-records");
    expect(list?.getAttribute("role") ?? "(role 없음)").toBe("list");
    expect(rows().length).toBe(1);
    const row = rows()[0]!;
    expect(row.querySelector(".mf-records__d")?.textContent).toBe("1일차 밤");
    expect(row.querySelector(".mf-records__w")?.textContent).toBe("민지");
    expect(row.querySelector(".mf-records__rz")?.textContent).toBe("마피아");
    expect(row.querySelector(".mf-records__rz")?.classList.contains("mf-records__rz--mafia")).toBe(true);
    expect(row.querySelector(".mf-records__new")?.textContent ?? "(NEW 없음)").toBe("NEW");
    expect(row.getAttribute("aria-label")).toBe("새 기록, 1일차 밤, 민지, 마피아");
    expect(recordsBtn()?.getAttribute("aria-label")).toBe("수사 기록");
    expect(recordsBtn()?.querySelector(".mf-records-btn__dot") === null ? "점 없음" : "점 있음").toBe("점 없음");
    expect(storage.getItem(KEY)).toBe("1");
  });

  it("두 기록이면 최신(2일차)이 위, NEW 는 맨 위 줄에만, '마피아 아님' 은 진홍 클래스가 아니다", () => {
    renderRoom(
      makeView({
        records: [
          { n: 1, target: 1, isMafia: false },
          { n: 2, target: 2, isMafia: true },
        ],
      }),
    );
    openSheet();
    expect(rows().map((r) => r.querySelector(".mf-records__d")?.textContent)).toEqual(["2일차 밤", "1일차 밤"]);
    expect(rows().map((r) => (r.querySelector(".mf-records__new") ? "NEW" : "-"))).toEqual(["NEW", "-"]);
    const second = rows()[1]!.querySelector(".mf-records__rz");
    expect(second?.textContent).toBe("마피아 아님");
    expect(second?.classList.contains("mf-records__rz--mafia")).toBe(false);
    expect(rows()[1]!.getAttribute("aria-label")).toBe("1일차 밤, 하윤, 마피아 아님");
  });

  it("records [] → 점 없음, 시트 빈 상태 '아직 조사한 사람이 없어요'", () => {
    renderRoom(makeView({ records: [] }));
    expect(recordsBtn()?.querySelector(".mf-records-btn__dot") === null ? "점 없음" : "점 있음").toBe("점 없음");
    expect(recordsBtn()?.getAttribute("aria-label")).toBe("수사 기록");
    openSheet();
    expect(sheet()?.textContent?.includes("아직 조사한 사람이 없어요") ? "빈 문구 있음" : "빈 문구 없음").toBe("빈 문구 있음");
    expect(rows().length).toBe(0);
  });

  it("view.me.records 가 없는 경찰(옛 서버)도 깨지지 않고 빈 상태다", () => {
    renderRoom(makeView({}));
    openSheet();
    expect(sheet()?.textContent?.includes("아직 조사한 사람이 없어요") ? "빈 문구 있음" : "빈 문구 없음").toBe("빈 문구 있음");
  });

  it("저장된 본 개수 1 + 기록 1개면 처음부터 점이 없고, 열어도 NEW 가 없다(재접속 유지)", () => {
    storage.setItem(KEY, "1");
    renderRoom(makeView({ records: [{ n: 1, target: 2, isMafia: true }] }));
    expect(recordsBtn()?.querySelector(".mf-records-btn__dot") === null ? "점 없음" : "점 있음").toBe("점 없음");
    openSheet();
    expect(rows().length).toBe(1);
    expect(rows()[0]!.querySelector(".mf-records__new") === null ? "NEW 없음" : "NEW 있음").toBe("NEW 없음");
    expect(rows()[0]!.getAttribute("aria-label")).toBe("1일차 밤, 민지, 마피아");
  });

  it("저장된 값이 기록 수보다 적으면 모자란 만큼이 새 기록이다(2개 중 1개 봄 → 점 켜짐)", () => {
    storage.setItem(KEY, "1");
    renderRoom(
      makeView({
        records: [
          { n: 1, target: 1, isMafia: false },
          { n: 2, target: 2, isMafia: true },
        ],
      }),
    );
    expect(recordsBtn()?.getAttribute("aria-label")).toBe("수사 기록, 새 기록");
  });

  it("탈락한 경찰도 버튼이 있고 시트가 열린다", () => {
    renderRoom(makeView({ meAlive: false, phase: "night", records: [{ n: 1, target: 2, isMafia: false }] }));
    expect(recordsBtn() === null ? "버튼 없음" : "버튼 있음").toBe("버튼 있음");
    openSheet();
    expect(sheet() === null ? "시트 없음" : "시트 열림").toBe("시트 열림");
    expect(rows().length).toBe(1);
  });
});

describe("열린 시트와 새 판 (03-11)", () => {
  const one: InvestigationRecord[] = [{ n: 1, target: 1, isMafia: false }];
  const two: InvestigationRecord[] = [...one, { n: 2, target: 2, isMafia: true }];

  it("시트를 연 채 records 가 하나 늘면 새 맨 위 줄에 NEW(전 줄은 없음), 점은 켜지지 않고 저장 개수가 새 길이다. 닫았다 열면 NEW 가 없다", () => {
    const r = renderRoom(makeView({ phase: "night", records: one }));
    openSheet();
    expect(rows().map((x) => (x.querySelector(".mf-records__new") ? "NEW" : "-"))).toEqual(["NEW"]);
    feed(r, makeView({ phase: "morning", records: two }));
    expect(rows().map((x) => x.querySelector(".mf-records__d")?.textContent)).toEqual(["2일차 밤", "1일차 밤"]);
    expect(rows().map((x) => (x.querySelector(".mf-records__new") ? "NEW" : "-"))).toEqual(["NEW", "-"]);
    expect(recordsBtn()?.querySelector(".mf-records-btn__dot") === null ? "점 없음" : "점 있음").toBe("점 없음");
    expect(storage.getItem(KEY)).toBe("2");
    closeSheet();
    expect(sheet() === null ? "닫힘" : "열림").toBe("닫힘");
    openSheet();
    expect(rows().map((x) => (x.querySelector(".mf-records__new") ? "NEW" : "-"))).toEqual(["-", "-"]);
  });

  it("단계가 night → morning → dayAnnounce 로 바뀌어도 열린 시트가 닫히지 않는다", () => {
    const r = renderRoom(makeView({ phase: "night", records: one }));
    openSheet();
    feed(r, makeView({ phase: "morning", records: one }));
    expect(sheet() === null ? "닫힘" : "열림").toBe("열림");
    feed(r, makeView({ phase: "dayAnnounce", n: 2, records: one }));
    expect(sheet() === null ? "닫힘" : "열림").toBe("열림");
    expect(recordsBtn() === null ? "버튼 없음" : "버튼 있음").toBe("버튼 있음");
  });

  it("lobby 또는 assigning view 를 받으면 저장된 본 개수가 0 이 되고 시트가 닫힌다", () => {
    for (const phase of ["lobby", "assigning"] as const) {
      storage.setItem(KEY, "3");
      const r = renderRoom(makeView({ phase: "discussion", records: one }));
      openSheet();
      feed(r, { ...makeView({ phase }), me: { seat: 0, isHost: true } });
      expect(`${phase}:${storage.getItem(KEY)}`).toBe(`${phase}:0`);
      expect(sheet() === null ? "닫힘" : "열림").toBe("닫힘");
      r.unmount();
    }
  });

  it("기록 내용(대상·결과)은 저장소에 쓰지 않는다 — 값은 숫자 하나", () => {
    renderRoom(makeView({ records: [{ n: 1, target: 2, isMafia: true }] }));
    openSheet();
    expect(storage.length).toBe(1);
    expect(/^\d+$/.test(storage.getItem(KEY) ?? "")).toBe(true);
  });
});

describe("알림·흐름 (03-11)", () => {
  const toastEl = (): HTMLElement | null => document.querySelector<HTMLElement>(".mf-records-toast");
  const dotOn = (): boolean => recordsBtn()?.querySelector(".mf-records-btn__dot") != null;

  it("경찰 night(records []) → morning(records 1개) 같은 epoch: 알림이 뜨고 2000ms 뒤 사라지며 점이 켜진다", () => {
    const r = renderRoom(makeView({ phase: "night", records: [] }));
    expect(toastEl() === null ? "없음" : "있음").toBe("없음");
    feed(r, makeView({ phase: "morning", records: [{ n: 1, target: 2, isMafia: true }] }));
    const t = toastEl();
    expect(t === null ? "(알림 없음)" : t.textContent).toBe("수사 기록이 추가됐어요");
    expect(t?.getAttribute("role") ?? "(role 없음)").toBe("status");
    expect(t?.querySelector("svg") === null ? "아이콘 없음" : "아이콘 있음").toBe("아이콘 있음");
    expect(t?.parentElement?.classList.contains("mf-dayscene") ? "장면 직계" : "장면 밖").toBe("장면 직계");
    expect(dotOn() ? "점 켜짐" : "점 꺼짐").toBe("점 켜짐");
    act(() => {
      vi.advanceTimersByTime(1900);
    });
    expect(toastEl() === null ? "사라짐" : "있음").toBe("있음");
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(toastEl() === null ? "사라짐" : "있음").toBe("사라짐");
  });

  it("morning 으로 처음 마운트(records 1개)하면 알림이 없다", () => {
    renderRoom(makeView({ phase: "morning", records: [{ n: 1, target: 2, isMafia: true }] }));
    expect(toastEl() === null ? "없음" : "있음").toBe("없음");
    expect(dotOn() ? "점 켜짐" : "점 꺼짐").toBe("점 켜짐");
  });

  it("epoch 가 바뀐 view(재접속)로 records 가 늘어도 알림이 없다", () => {
    const r = renderRoom(makeView({ phase: "night", records: [] }), { epoch: 1 });
    feed(r, makeView({ phase: "morning", records: [{ n: 1, target: 2, isMafia: true }] }), { epoch: 2 });
    expect(toastEl() === null ? "없음" : "있음").toBe("없음");
  });

  it("records 길이가 그대로면(경찰이 안 골랐다) 알림도 점도 없다", () => {
    const r = renderRoom(makeView({ phase: "night", records: [{ n: 1, target: 1, isMafia: false }] }));
    openSheet();
    closeSheet();
    feed(r, makeView({ phase: "morning", n: 2, records: [{ n: 1, target: 1, isMafia: false }] }));
    expect(toastEl() === null ? "없음" : "있음").toBe("없음");
    expect(dotOn() ? "점 켜짐" : "점 꺼짐").toBe("점 꺼짐");
  });

  it("경찰이 아니면 records 가 있어도(있을 수 없지만) 알림이 없다", () => {
    const r = renderRoom(makeView({ role: "citizen", phase: "night" }));
    const v = makeView({ role: "citizen", phase: "morning" });
    v.me.records = [{ n: 1, target: 2, isMafia: true }];
    feed(r, v);
    expect(toastEl() === null ? "없음" : "있음").toBe("없음");
  });
});

describe("머리말 버튼 간격 (03-11)", () => {
  const css = existsSync("src/styles/phase.css") ? readFileSync("src/styles/phase.css", "utf8") : "";
  const rule = (sel: string) => css.match(new RegExp(`(^|\\n)${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`))?.[2] ?? "";
  it(".mf-phasebar__extra 와 .mf-day__top 에 gap var(--space-sm)", () => {
    expect(/gap:\s*var\(--space-sm\)/.test(rule(".mf-phasebar__extra"))).toBe(true);
    expect(/display:\s*flex/.test(rule(".mf-phasebar__extra"))).toBe(true);
    expect(/gap:\s*var\(--space-sm\)/.test(rule(".mf-day__top"))).toBe(true);
  });
});

describe("records.css (03-11)", () => {
  const css = existsSync("src/styles/records.css") ? readFileSync("src/styles/records.css", "utf8") : "";
  const rule = (sel: string) => css.match(new RegExp(`(^|\\n)${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`))?.[2] ?? "";

  it(".mf-records__row 는 4열 격자 52/84/1fr/48·열 간격 6·최소 높이 52·점선 구분", () => {
    const r = rule(".mf-records__row");
    expect(/grid-template-columns:\s*52px 84px minmax\(0, 1fr\) 48px/.test(r)).toBe(true);
    expect(/column-gap:\s*6px/.test(r)).toBe(true);
    expect(/min-height:\s*52px/.test(r)).toBe(true);
    expect(/border-bottom:\s*1px dashed var\(--night-600\)/.test(r)).toBe(true);
  });

  it("마피아는 crimson-400 굵게, NEW 는 12px 700 gray-50 면", () => {
    const m = rule(".mf-records__rz--mafia");
    expect(/color:\s*var\(--crimson-400\)/.test(m)).toBe(true);
    expect(/font-weight:\s*700/.test(m)).toBe(true);
    const n = rule(".mf-records__new");
    expect(/font-size:\s*12px/.test(n)).toBe(true);
    expect(/font-weight:\s*700/.test(n)).toBe(true);
    expect(/background:\s*var\(--gray-50\)/.test(n)).toBe(true);
  });

  it("점은 10px·오른쪽 6·위 6·2px gray-800 테두리", () => {
    const d = rule(".mf-records-btn__dot");
    expect(/width:\s*10px/.test(d)).toBe(true);
    expect(/right:\s*6px/.test(d)).toBe(true);
    expect(/top:\s*6px/.test(d)).toBe(true);
    expect(/border:\s*2px solid var\(--gray-800\)/.test(d)).toBe(true);
  });

  it("색 값(#)이 없다", () => {
    const body = css
      .split("\n")
      .filter((l) => !/^\s*\/?\*/.test(l))
      .join("\n");
    expect(/#[0-9a-fA-F]{3,6}/.test(body)).toBe(false);
    expect(css.length > 0 ? "파일 있음" : "파일 없음").toBe("파일 있음");
  });
});
