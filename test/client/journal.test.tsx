/// <reference types="node" />
import { readFileSync } from "node:fs";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import "../helpers/singleLineErrors";
import type { PublicPlayer, RoleRecord } from "../../shared/protocol";
import { Journal } from "../../src/components/Journal";
import { JOURNAL_TEXT, journalResult } from "../../src/game/journalText";
import { journalArt } from "../../src/net/assets";
import type { JournalRole } from "../../src/net/assets";

// 일지 3종(03.1-06 3A, 결정 0026, UI-SPEC D). 단언은 문자열·불리언·숫자로 둔다(한 줄 보고서).

afterEach(cleanup);

const players: PublicPlayer[] = [
  { seat: 0, nickname: "지우", connected: true, isHost: true },
  { seat: 1, nickname: "하윤", connected: true, isHost: false },
  { seat: 2, nickname: "민지", connected: true, isHost: false },
  { seat: 3, nickname: "다섯글자님", connected: true, isHost: false },
];

const RECORDS: Record<JournalRole, RoleRecord[]> = {
  police: [
    { n: 1, target: 1, isMafia: false },
    { n: 2, target: 2, isMafia: true },
  ],
  mafia: [
    { n: 1, target: 1, died: false },
    { n: 2, target: 3, died: true },
  ],
  doctor: [
    { n: 1, target: 0 },
    { n: 2, target: 2 },
  ],
};

const NAMES: Record<JournalRole, string> = { police: "수사일지", mafia: "암살일지", doctor: "치료일지" };
const ROLES: JournalRole[] = ["police", "mafia", "doctor"];

function renderJournal(role: JournalRole, over: { records?: readonly RoleRecord[]; mySeat?: number; newCount?: number } = {}) {
  return render(
    <Journal role={role} records={over.records ?? RECORDS[role]} players={players} mySeat={over.mySeat ?? 0} newCount={over.newCount ?? 0} />,
  );
}

const rowsOf = (c: HTMLElement): HTMLElement[] => Array.from(c.querySelectorAll<HTMLElement>(".mf-journal__row"));
const cell = (row: HTMLElement, cls: string): HTMLElement => row.querySelector<HTMLElement>(`.mf-journal__${cls}`)!;

describe("Journal 머리", () => {
  it.each(ROLES)("%s: 일지 이름·아이콘·머리 띠·종이 줄 그림이 journalArt 슬롯에서 온다", (role) => {
    const { container } = renderJournal(role);
    const section = container.querySelector<HTMLElement>(`section.mf-journal.mf-journal--${role}`)!;
    expect(section.getAttribute("aria-label")).toBe(NAMES[role]);
    expect(section.querySelector(".mf-journal__h b")?.textContent).toBe(NAMES[role]);
    const icon = section.querySelector<HTMLImageElement>("img.mf-journal__icon")!;
    expect(icon.getAttribute("src")).toBe(journalArt(role, "icon").src);
    const cover = section.querySelector<HTMLImageElement>("img.mf-journal__cover")!;
    expect(cover.getAttribute("src")).toBe(journalArt(role, "cover").src);
    for (const img of [icon, cover]) {
      expect(img.getAttribute("alt")).toBe("");
      expect(img.getAttribute("aria-hidden")).toBe("true");
    }
    expect(icon.getAttribute("width")).toBe("20");
    expect(icon.getAttribute("height")).toBe("20");
    const list = section.querySelector<HTMLElement>("ol.mf-journal__l")!;
    expect(list.getAttribute("role")).toBe("list");
    expect(list.getAttribute("style") ?? "").toContain(journalArt(role, "page").src);
  });

  it("일지 이름·빈 문구의 단일 출처가 JOURNAL_TEXT 다", () => {
    expect(JOURNAL_TEXT.police.name).toBe("수사일지");
    expect(JOURNAL_TEXT.mafia.name).toBe("암살일지");
    expect(JOURNAL_TEXT.doctor.name).toBe("치료일지");
    // 밤 끝 알림이 없어졌으므로 항목의 키는 name·empty 둘뿐이다 (결정 0028)
    for (const role of ["police", "mafia", "doctor"] as const) {
      expect(Object.keys(JOURNAL_TEXT[role]).sort().join(",")).toBe("empty,name");
    }
  });

  it("그림이 로드에 실패하면 그 img 만 숨기고 글자는 그대로다", () => {
    const { container } = renderJournal("police");
    const icon = container.querySelector<HTMLImageElement>("img.mf-journal__icon")!;
    icon.dispatchEvent(new Event("error"));
    expect(icon.style.display).toBe("none");
    expect(container.querySelector(".mf-journal__h b")?.textContent).toBe("수사일지");
  });
});

describe("Journal 줄", () => {
  it("경찰: 오름차순 입력도 최신이 위, 한 줄은 일차 | 점+이름 | 결과 순서", () => {
    const { container } = renderJournal("police");
    const rows = rowsOf(container);
    expect(rows.length).toBe(2);
    expect(cell(rows[0]!, "d").textContent).toBe("2일차 밤");
    expect(cell(rows[1]!, "d").textContent).toBe("1일차 밤");
    expect(cell(rows[0]!, "w").querySelector("b")?.textContent).toBe("민지");
    expect(cell(rows[0]!, "rz").textContent).toBe("마피아");
    expect(cell(rows[0]!, "rz").className).toContain("mf-journal__rz--bad");
    expect(cell(rows[1]!, "rz").textContent).toBe("마피아 아님");
    expect(cell(rows[1]!, "rz").className).toContain("mf-journal__rz--ok");
    const order = Array.from(rows[0]!.children).map((el) => el.className.split(" ")[0]);
    expect(order).toEqual(["mf-journal__d", "mf-journal__w", "mf-journal__rz", "mf-journal__nw"]);
  });

  it("색깔점은 이름표와 같은 (seat % 8) + 1 좌석색이다", () => {
    const { container } = renderJournal("police");
    const rows = rowsOf(container);
    expect(cell(rows[0]!, "w").querySelector<HTMLElement>("i.mf-journal__dot")?.getAttribute("style")).toContain("var(--seat-3)");
    expect(cell(rows[1]!, "w").querySelector<HTMLElement>("i.mf-journal__dot")?.getAttribute("style")).toContain("var(--seat-2)");
    expect(cell(rows[1]!, "w").querySelector("i")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("마피아: died true → 사망(bad), died false → 생존(ok) — 의사가 막은 것을 알리는 다른 글자가 없다", () => {
    const { container } = renderJournal("mafia");
    const rows = rowsOf(container);
    expect(cell(rows[0]!, "rz").textContent).toBe("사망");
    expect(cell(rows[0]!, "rz").className).toContain("mf-journal__rz--bad");
    expect(cell(rows[1]!, "rz").textContent).toBe("생존");
    expect(cell(rows[1]!, "rz").className).toContain("mf-journal__rz--ok");
    for (const word of ["보호", "구출", "살렸", "막"]) expect(container.textContent).not.toContain(word);
  });

  it("의사: 보호(heal)", () => {
    const { container } = renderJournal("doctor");
    for (const row of rowsOf(container)) {
      expect(cell(row, "rz").textContent).toBe("보호");
      expect(cell(row, "rz").className).toContain("mf-journal__rz--heal");
    }
  });

  it.each(ROLES)("%s: 어느 일지에도 `처형` 글자가 없다 (D-09)", (role) => {
    const { container } = renderJournal(role);
    expect(container.textContent).not.toContain("처형");
    expect(container.innerHTML).not.toContain("처형");
  });

  it("대상이 나이면 `나`, 아니면 닉네임이고 5자 이름도 전부 보인다", () => {
    const doctor = renderJournal("doctor");
    const rows = rowsOf(doctor.container);
    expect(cell(rows[1]!, "w").querySelector("b")?.textContent).toBe("나");
    expect(cell(rows[0]!, "w").querySelector("b")?.textContent).toBe("민지");
    doctor.unmount();
    const mafia = renderJournal("mafia");
    expect(cell(rowsOf(mafia.container)[0]!, "w").querySelector("b")?.textContent).toBe("다섯글자님");
  });

  it("줄 aria-label 은 `{N}일차 밤, {이름}, {결과}` 이다", () => {
    const { container } = renderJournal("police");
    const rows = rowsOf(container);
    expect(rows[0]!.getAttribute("aria-label")).toBe("2일차 밤, 민지, 마피아");
    expect(rows[1]!.getAttribute("aria-label")).toBe("1일차 밤, 하윤, 마피아 아님");
  });
});

describe("Journal NEW", () => {
  it("newCount 개의 맨 위 줄에만 NEW 알약이 있고 aria-label 이 `새 기록, ` 로 시작한다", () => {
    const { container } = renderJournal("police", { newCount: 1 });
    const rows = rowsOf(container);
    expect(container.querySelectorAll(".mf-journal__new").length).toBe(1);
    expect(rows[0]!.querySelector(".mf-journal__new")?.textContent).toBe("NEW");
    expect(rows[1]!.querySelector(".mf-journal__new")).toBeNull();
    expect(rows[0]!.getAttribute("aria-label")).toBe("새 기록, 2일차 밤, 민지, 마피아");
    expect(rows[1]!.getAttribute("aria-label")?.startsWith("새 기록")).toBe(false);
    // NEW 는 줄의 맨 오른쪽 칸이다
    expect(rows[0]!.lastElementChild?.className).toContain("mf-journal__nw");
    expect(rows[0]!.lastElementChild?.querySelector(".mf-journal__new")).not.toBeNull();
  });

  it("newCount 2 면 위 두 줄, 0 이면 NEW 가 없다", () => {
    const two = renderJournal("doctor", { newCount: 2 });
    expect(two.container.querySelectorAll(".mf-journal__new").length).toBe(2);
    two.unmount();
    const zero = renderJournal("doctor", { newCount: 0 });
    expect(zero.container.querySelectorAll(".mf-journal__new").length).toBe(0);
  });

  it("newCount 가 줄 수보다 커도 줄 수까지만 단다", () => {
    const { container } = renderJournal("police", { newCount: 9 });
    expect(container.querySelectorAll(".mf-journal__new").length).toBe(2);
  });
});

describe("Journal 빈 상태", () => {
  it.each([
    ["police", "아직 조사한 사람이 없어요"],
    ["mafia", "아직 지목한 사람이 없어요"],
    ["doctor", "아직 보호한 사람이 없어요"],
  ] as const)("%s: 줄 없이 한 줄 문구", (role, text) => {
    const { container } = renderJournal(role, { records: [] });
    expect(rowsOf(container).length).toBe(0);
    const empty = container.querySelectorAll(".mf-journal__empty");
    expect(empty.length).toBe(1);
    expect(empty[0]!.textContent).toBe(text);
    // 머리는 그대로 있다
    expect(container.querySelector(".mf-journal__h b")?.textContent).toBe(NAMES[role]);
  });
});

describe("journalResult — 합집합 records 방어 (T-03.1-21)", () => {
  it("역할별 키로 읽는다", () => {
    expect(journalResult("police", { n: 1, target: 1, isMafia: true })).toEqual({ text: "마피아", tone: "bad" });
    expect(journalResult("police", { n: 1, target: 1, isMafia: false })).toEqual({ text: "마피아 아님", tone: "ok" });
    expect(journalResult("mafia", { n: 1, target: 1, died: true })).toEqual({ text: "사망", tone: "bad" });
    expect(journalResult("mafia", { n: 1, target: 1, died: false })).toEqual({ text: "생존", tone: "ok" });
    expect(journalResult("doctor", { n: 1, target: 1 })).toEqual({ text: "보호", tone: "heal" });
  });

  it("키가 없는 모양은 null 이라 줄을 그리지 않는다(빈 처리로 위장하지 않는다)", () => {
    expect(journalResult("police", { n: 1, target: 1 })).toBeNull();
    expect(journalResult("police", { n: 1, target: 1, died: true })).toBeNull();
    expect(journalResult("mafia", { n: 1, target: 1 })).toBeNull();
    expect(journalResult("mafia", { n: 1, target: 1, isMafia: true })).toBeNull();
  });

  it("잘못된 모양의 줄은 그리지 않고, 남은 줄이 없으면 빈 문구를 보인다", () => {
    const bad = [{ n: 1, target: 1 }] as RoleRecord[];
    const { container } = renderJournal("police", { records: bad });
    expect(rowsOf(container).length).toBe(0);
    expect(container.querySelector(".mf-journal__empty")?.textContent).toBe("아직 조사한 사람이 없어요");
  });
});

describe("Journal 입력 불변", () => {
  it("입력 배열을 바꾸지 않는다(얼려도 그려진다) — 순서도 그대로", () => {
    const frozen = Object.freeze([...RECORDS.police]) as readonly RoleRecord[];
    const { container } = renderJournal("police", { records: frozen });
    expect(rowsOf(container).length).toBe(2);
    expect(frozen.map((r) => r.n)).toEqual([1, 2]);
  });
});

describe("rolecard.css — Journal 규약", () => {
  const css = readFileSync("src/styles/rolecard.css", "utf8");

  /** 선택자 목록에 `selector` 가 들어 있는 규칙들의 본문을 이어 붙인다. */
  function rule(selector: string): string {
    const bodies: string[] = [];
    for (const m of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      const selectors = m[1]!.replace(/\/\*[\s\S]*?\*\//g, "").split(",").map((s) => s.trim());
      if (selectors.includes(selector)) bodies.push(m[2]!);
    }
    expect(bodies.length, `규칙 ${selector}`).toBeGreaterThan(0);
    return bodies.join(" ").replace(/\s+/g, " ");
  }

  it("줄 격자: 52 · 84 · 가변 · 48, 열 간격 4, 최소 높이 52, 일차 칸은 줄바꿈 없음", () => {
    const row = rule(".mf-journal__row");
    expect(row).toContain("grid-template-columns: 52px 84px minmax(0, 1fr) 48px");
    expect(row).toContain("column-gap: 4px");
    expect(row).toContain("min-height: 52px");
    expect(rule(".mf-journal__d")).toContain("white-space: nowrap");
  });

  it("이름 칸에 말줄임(text-overflow) 규칙이 없다", () => {
    expect(rule(".mf-journal__w")).not.toContain("text-overflow");
    expect(css).not.toMatch(/text-overflow/);
  });

  it("종류별 변수 --jr-* 가 일지 토큰으로 정의된다(마피아 ink 는 crimson-300)", () => {
    for (const role of ["police", "doctor"]) {
      const body = rule(`.mf-journal--${role}`);
      expect(body).toContain(`--jr-bg: var(--journal-${role}-bg)`);
      expect(body).toContain(`--jr-head: var(--journal-${role}-head)`);
      expect(body).toContain(`--jr-edge: var(--journal-${role}-edge)`);
      expect(body).toContain(`--jr-ink: var(--journal-${role}-ink)`);
    }
    const mafia = rule(".mf-journal--mafia");
    expect(mafia).toContain("--jr-bg: var(--journal-mafia-bg)");
    expect(mafia).toContain("--jr-head: var(--journal-mafia-head)");
    expect(mafia).toContain("--jr-edge: var(--journal-mafia-edge)");
    expect(mafia).toContain("--jr-ink: var(--crimson-300)");
  });

  it("결과 글자색과 NEW 알약 면", () => {
    expect(rule(".mf-journal__rz--bad")).toContain("color: var(--crimson-300)");
    expect(rule(".mf-journal__rz--heal")).toContain("color: var(--journal-doctor-ink)");
    expect(rule(".mf-journal__rz--ok")).toContain("color: var(--gray-50)");
    const nw = rule(".mf-journal__new");
    expect(nw).toContain("background: var(--amber-400)");
    expect(nw).toContain("color: var(--night-900)");
  });

  it("색 hex 가 없고 전환·애니메이션도 없다", () => {
    const code = css.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(/#[0-9a-fA-F]{3,8}\b/.test(code)).toBe(false);
    expect(/transition|animation/.test(code)).toBe(false);
  });
});
