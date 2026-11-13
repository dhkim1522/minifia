import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { RecordRows } from "../../src/components/v2/RecordCard";
import { SuspectBoard } from "../../src/components/v2/SuspectBoard";
import { boardMarksOf, clueChipsOf } from "../../src/game/causalView";
import type { RecordRow } from "../../src/game/recordView";
import { faceSrc, seatColorVar } from "../../src/net/assets";
import type { ClueLine, RecordLine } from "../../shared/protocol";

// 21-14 Task 1 (D-18·D-19·D-20, P21-14): 의심 보드 부품 — 칩 줄(받은 단서·먼저 손댄 흔적·목격·단서 없음)·목격 펼치기·얼굴 줄 같은 옷 배지.
// 부품에는 역할 prop 이 없다. 입력은 내가 받은 단서(칩)와 공개 얼굴 목록뿐이고 같은 입력이면 같은 DOM 이다(T-21-33).
afterEach(() => cleanup());

const V2_CSS = readFileSync("src/styles/v2.css", "utf8");

const CLUES: ClueLine[] = [
  { spot: 1, kind: "footprint", n: 2 },
  { spot: 2, kind: "cloth", piece: "redCloth" },
  { spot: 3, kind: "touched" },
];
const RECORD_LINES: RecordLine[] = [
  { seat: 1, place: "glass" },
  { seat: 2, place: "piano" },
];
const ROWS: RecordRow[] = [
  { n: 1, seat: 1, place: "glass", name: "하윤" },
  { n: 2, seat: 2, place: "piano", name: "민지" },
];
const FACES = [0, 1, 2, 3, 4, 5].map((seat) => ({ seat, name: ["나", "하윤", "민지", "도현", "서아", "지후"][seat]! }));

interface Over {
  clues?: ClueLine[];
  record?: RecordLine[];
  rows?: RecordRow[] | null;
  marks?: Record<number, Array<"cloth" | "window">>;
  compact?: boolean;
  ghostSeats?: ReadonlySet<number>;
  onClose?: () => void;
}
function board(o: Over = {}) {
  return render(
    <SuspectBoard
      chips={clueChipsOf(o.clues ?? CLUES, o.record ?? RECORD_LINES)}
      rows={o.rows === undefined ? ROWS : o.rows}
      faces={FACES}
      marks={o.marks ?? {}}
      faceOf={faceSrc}
      colorOf={seatColorVar}
      compact={o.compact ?? false}
      {...(o.ghostSeats ? { ghostSeats: o.ghostSeats } : {})}
      onClose={o.onClose ?? (() => {})}
    />,
  );
}

describe("SuspectBoard: 칩 줄 (D-18·D-19)", () => {
  it("칩 넷 → listitem 넷, data-clue-chip 값 넷 순서대로, 점선(is-faint)은 먼저 손댄 흔적 하나뿐", () => {
    const { container, getByRole } = board();
    const list = getByRole("list", { name: "내가 아는 것" });
    const items = [...list.querySelectorAll("[role='listitem'], li")];
    expect(items.length).toBe(4);
    expect([...list.querySelectorAll("[data-clue-chip]")].map((e) => e.getAttribute("data-clue-chip"))).toEqual(["footprint", "cloth", "touched", "witness"]);
    expect([...container.querySelectorAll(".mv-clue-chip.is-faint")].map((e) => e.getAttribute("data-clue-chip"))).toEqual(["touched"]);
    expect(container.querySelectorAll(".mv-clue-chip--chip").length).toBe(4);
  });

  it("목격 칩은 button(aria-expanded) — 누르면 줄 둘이 펼쳐지고 다시 누르면 접힌다. 처음엔 접혀 있다", () => {
    const { container } = board();
    const btn = container.querySelector<HTMLButtonElement>("button[aria-expanded]")!;
    expect(btn.textContent).toBe("목격 2");
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelectorAll("[data-record-row]").length).toBe(0);
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelectorAll("[data-record-row]").length).toBe(2);
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelectorAll("[data-record-row]").length).toBe(0);
  });

  it("목격 기록이 없으면(record null) 목격 칩도 펼치기 단추도 없다", () => {
    const { container } = board({ record: [], rows: null });
    expect(container.querySelector("[data-clue-chip='witness']")).toBeNull();
    expect(container.querySelector("button[aria-expanded]")).toBeNull();
  });

  it("단서도 목격도 없으면 점선 '단서 없음' 칩 하나만", () => {
    const { container } = board({ clues: [], record: [], rows: null });
    expect([...container.querySelectorAll("[data-clue-chip]")].map((e) => [e.getAttribute("data-clue-chip"), e.textContent])).toEqual([["none", "단서 없음"]]);
    expect(container.querySelector(".mv-clue-chip.is-faint")).not.toBeNull();
    expect(container.querySelector("button[aria-expanded]")).toBeNull();
  });

  it("목격 줄에 이미 탈락한 좌석(ghostSeats)이 있으면 그 줄 얼굴만 흐린 표시(is-ghost)이고 닉네임 글은 그대로다", () => {
    const { container } = board({ ghostSeats: new Set([2]) });
    fireEvent.click(container.querySelector("button[aria-expanded]")!);
    const faces = [...container.querySelectorAll<HTMLElement>(".mv-record__face")];
    expect(faces.map((f) => f.classList.contains("is-ghost"))).toEqual([false, true]);
    expect([...container.querySelectorAll(".mv-record__name")].map((e) => e.textContent)).toEqual(["하윤", "민지"]);
  });
});

describe("SuspectBoard: 얼굴 줄 같은 옷 배지 (D-18)", () => {
  it("얼굴 6 → data-board-face 6, 배지 칸은 data-board-mark, 5번은 배지 둘, 이름은 접근성 이름", () => {
    const { container, getByRole } = board({ marks: { 3: ["cloth"], 5: ["cloth", "window"] } });
    const grid = getByRole("list", { name: "참가자" });
    expect([...grid.querySelectorAll("[data-board-face]")].map((e) => e.getAttribute("data-board-face"))).toEqual(["0", "1", "2", "3", "4", "5"]);
    const marked = [...container.querySelectorAll("[data-board-mark]")].map((e) => [e.getAttribute("data-board-face"), e.getAttribute("data-board-mark")]);
    expect(marked).toEqual([["3", "cloth"], ["5", "cloth,window"]]);
    expect(container.querySelector("[data-board-face='5']")!.querySelectorAll(".mv-suspect-board__badge").length).toBe(2);
    expect(container.querySelector("[data-board-face='3']")!.querySelectorAll(".mv-suspect-board__badge").length).toBe(1);
    expect(container.querySelector("[data-board-face='1']")!.querySelectorAll(".mv-suspect-board__badge").length).toBe(0);
    expect(container.querySelector("[data-board-face='3']")!.getAttribute("aria-label")).toBe("도현, 같은 옷 조각");
    expect(container.querySelector("[data-board-face='1']")!.getAttribute("aria-label")).toBe("하윤");
  });

  it("얼굴 칸은 누를 수 없는 표시다(button·a 아님, 글자 없음) — 닉네임 텍스트는 보드 안 얼굴 줄에 없다", () => {
    const { container } = board({ marks: { 3: ["cloth"] } });
    for (const f of container.querySelectorAll("[data-board-face]")) {
      expect(f.tagName).toBe("DIV");
      expect(f.querySelector("button, a, input")).toBeNull();
      expect(f.textContent).toBe("");
    }
  });

  it("boardMarksOf 결과 모양(좌석 → 배지 목록)을 그대로 받는다", () => {
    const marks = boardMarksOf([{ seat: 2, alive: true, look: "doctor" }], [{ spot: 2, kind: "cloth", piece: "whiteCloth" }]);
    const { container } = board({ marks });
    expect(container.querySelector("[data-board-face='2']")!.getAttribute("data-board-mark")).toBe("cloth");
  });

  it("compact 면 is-compact(얼굴 칸 56), 아니면 64", () => {
    expect(board({ compact: true }).container.querySelector("[data-suspect-board]")!.classList.contains("is-compact")).toBe(true);
    cleanup();
    expect(board({ compact: false }).container.querySelector("[data-suspect-board]")!.classList.contains("is-compact")).toBe(false);
  });
});

describe("SuspectBoard: 머리·정체 없음·닫기 (D-20)", () => {
  it("접근성 이름 '의심 보드', 머리 글 '내가 아는 것', 닫기는 이름 '닫기' 단추이고 누르면 onClose", () => {
    const onClose = vi.fn();
    const { container, getByRole, getByLabelText } = board({ onClose });
    expect(container.querySelector("section[data-suspect-board]")!.getAttribute("aria-label")).toBe("의심 보드");
    expect(container.querySelector(".mv-suspect-board__title")!.textContent).toBe("내가 아는 것");
    fireEvent.click(getByRole("button", { name: "닫기" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(getByLabelText("의심 보드")).not.toBeNull();
  });

  it("정체·역할 글·역할 아이콘이 보드 어디에도 없다 — 닫힌 글표와 닉네임 접근성 이름뿐", () => {
    const { container } = board({ marks: { 3: ["cloth"] } });
    const html = container.innerHTML;
    expect(html).not.toMatch(/마피아|경찰|의사|시민|범인|증거|확정|처형|정체/);
    expect(html).not.toMatch(/data-role|data-mafia|roleMafia|rolePolice|roleDoctor|roleCitizen/);
    expect(container.querySelector("[data-board-face]")!.getAttribute("class") ?? "").not.toMatch(/ghost|dead/);
    // 글(텍스트 노드)은 머리 제목·칩 글·닫힌 줄 글뿐이다
    const texts = [...container.querySelectorAll("*")].flatMap((e) => [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent!.trim())).filter(Boolean);
    expect(texts.sort()).toEqual(["내가 아는 것", "먼저 손댄 흔적", "목격 2", "발자국 둘", "붉은 천 조각"].sort());
  });

  it("같은 입력이면 같은 DOM (마피아·시민 렌더 구분 없음)", () => {
    const a = board({ marks: { 3: ["cloth"] } }).container.innerHTML;
    cleanup();
    const b = board({ marks: { 3: ["cloth"] } }).container.innerHTML;
    expect(a).toBe(b);
  });
});

describe("RecordRows 부분 export", () => {
  it("RecordCard 의 줄 목록과 같은 DOM(ul.mv-record__rows > li[data-record-row])", () => {
    const { container } = render(<RecordRows rows={ROWS} faceOf={faceSrc} colorOf={seatColorVar} />);
    const ul = container.querySelector("ul.mv-record__rows")!;
    expect([...ul.querySelectorAll("li")].map((li) => li.querySelector(".mv-record__name")!.textContent)).toEqual(["하윤", "민지"]);
    expect(ul.querySelector("li")!.querySelector(".mv-record__n")!.textContent).toBe("1");
  });
});

describe("스타일 정적", () => {
  const css = (): string => V2_CSS.slice(V2_CSS.indexOf(".mv-suspect-board"));
  it("보드 카드: night-800 면·1px night-600·둥근 14(radius-md)·카드 안 스크롤·머리 고정, hex 없음", () => {
    expect(V2_CSS.indexOf(".mv-suspect-board")).toBeGreaterThan(0);
    const c = css();
    const card = /\.mv-suspect-board\s*\{([^}]*)\}/.exec(c)?.[1] ?? "";
    for (const token of ["night-800", "1px solid var(--night-600)", "radius-md"]) expect(card).toContain(token);
    expect(c).toMatch(/\.mv-suspect-board__body\s*\{[^}]*overflow-y: auto/);
    expect(c).toMatch(/\.mv-suspect-board__head\s*\{[^}]*flex: none/);
    expect(c).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });
  it("얼굴 칸: 4열 격자·64 높이(compact 56)·같은 옷 2px light-lamp 테두리·배지 18", () => {
    const c = css();
    expect(c).toMatch(/\.mv-suspect-board__faces\s*\{[^}]*repeat\(4/);
    expect(c).toMatch(/\.mv-suspect-board__face\s*\{[^}]*height: 64px/);
    expect(c).toMatch(/\.mv-suspect-board\.is-compact \.mv-suspect-board__face\s*\{[^}]*height: 56px/);
    expect(c).toMatch(/\.mv-suspect-board__face\[data-board-mark\]\s*\{[^}]*2px solid var\(--light-lamp\)/);
    expect(c).toMatch(/\.mv-suspect-board__badge\s*\{[^}]*width: 18px[^}]*height: 18px/);
  });
});
