import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { SuspectBoard } from "../../src/components/v2/SuspectBoard";
import type { BoardModel } from "../../src/game/boardView";
import { faceSrc, seatColorVar } from "../../src/net/assets";

afterEach(cleanup);

// 21-11 의심 보드 부품(D-18·D-19·P21-18): props 만 받는다(서버 훅·역할 없음 — 튜토리얼 공용). 얼굴 칸은 보기 전용, 직업·"범인" 없음.
const V2_CSS = readFileSync("src/styles/v2.css", "utf8");

const MODEL: BoardModel = {
  chips: [
    { spot: "footprint", kind: "clue", n: 2 },
    { spot: "cloth", kind: "clue", piece: "blackCloth" },
    { spot: "window", kind: "dark" },
  ],
  lamps: [true, false, true, true, false, false, true, true],
  offCount: 3,
  faces: [
    { seat: 0, nickname: "민수", marks: [] },
    { seat: 1, nickname: "영희", marks: [{ kind: "cloth", piece: "blackCloth" }] },
    { seat: 3, nickname: "지아", marks: [] },
    { seat: 4, nickname: "도윤", marks: [{ kind: "cloth", piece: "blackCloth" }, { kind: "window", piece: "whiteCloth" }] },
    { seat: 5, nickname: "하준", marks: [] },
  ],
  witness: [
    { n: 1, seat: 1, place: "glass", name: "영희" },
    { n: 2, seat: 3, place: "piano", name: "지아" },
  ],
};

function board(model: BoardModel = MODEL, onClose = () => {}) {
  return render(<SuspectBoard model={model} faceOf={faceSrc} colorOf={seatColorVar} onClose={onClose} />);
}

describe("SuspectBoard 껍데기·머리줄", () => {
  it("role region · aria-label 의심 보드 · data-board, 머리 '내가 아는 것' + [닫기](누르면 onClose 한 번)", () => {
    const onClose = vi.fn();
    const { container } = board(MODEL, onClose);
    const root = container.querySelector("[data-board]") as HTMLElement;
    expect(root).not.toBeNull();
    expect(root.getAttribute("role")).toBe("region");
    expect(root.getAttribute("aria-label")).toBe("의심 보드");
    expect(root.textContent).toContain("내가 아는 것");
    const close = container.querySelector("button[aria-label='닫기']") as HTMLButtonElement;
    expect(close).not.toBeNull();
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("SuspectBoard 칩 줄", () => {
  it("칩 수 = chips 길이, 발자국 칩은 숫자·옷 조각 칩은 조각 이름, 어두움은 점선 표식(is-dim)", () => {
    const { container } = board();
    const row = container.querySelector("[data-board-chips]") as HTMLElement;
    expect(row).not.toBeNull();
    const chips = [...row.querySelectorAll<HTMLElement>("[data-board-chip]")];
    expect(chips.map((c) => c.dataset.boardChip).join(",")).toBe("footprint,cloth,window");
    expect(chips[0]!.textContent).toBe("2");
    expect(chips[1]!.textContent).toBe("검은 천 조각");
    expect(chips[0]!.classList.contains("is-dim")).toBe(false);
    expect(chips[2]!.classList.contains("is-dim")).toBe(true);
  });

  it("칩 0이면 data-board-chips 줄 자체가 없다", () => {
    const { container } = board({ ...MODEL, chips: [] });
    expect(container.querySelector("[data-board-chips]")).toBeNull();
    expect(container.querySelector("[data-board]")).not.toBeNull();
  });
});

describe("SuspectBoard 등불 줄", () => {
  it("data-board-lamps = 꺼진 수, aria-label '꺼진 등불 n개', 점 8개(켜짐 5·꺼짐 3)", () => {
    const { container } = board();
    const row = container.querySelector("[data-board-lamps]") as HTMLElement;
    expect(row.getAttribute("data-board-lamps")).toBe("3");
    expect(row.getAttribute("aria-label")).toBe("꺼진 등불 3개");
    expect(row.querySelectorAll(".mv-board__lamp")).toHaveLength(8);
    expect(row.querySelectorAll(".mv-board__lamp.is-on")).toHaveLength(5);
  });

  it("lamps 가 비면 등불 줄이 없다", () => {
    const { container } = board({ ...MODEL, lamps: [], offCount: 0 });
    expect(container.querySelector("[data-board-lamps]")).toBeNull();
  });
});

describe("SuspectBoard 얼굴 줄", () => {
  it("산 사람 수만큼 data-board-face, 얼굴 칸은 button 이 아니다(보기 전용), 닉네임·얼굴 그림·자리색", () => {
    const { container } = board();
    const faces = [...container.querySelectorAll<HTMLElement>("[data-board-face]")];
    expect(faces.map((f) => f.dataset.boardFace).join(",")).toBe("0,1,3,4,5");
    for (const f of faces) {
      expect(f.tagName).not.toBe("BUTTON");
      expect(f.querySelector("button")).toBeNull();
      expect(f.closest("button")).toBeNull();
    }
    expect(faces[0]!.querySelector(".mv-board__name")?.textContent).toBe("민수");
    const img = faces[0]!.querySelector("img") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe(faceSrc(0));
    expect(img.getAttribute("style")).toContain(seatColorVar(0));
  });

  it("마크가 있는 얼굴에만 data-mark 와 thread 배지가 있다(옷 조각 → cloth, 둘 다면 'cloth window')", () => {
    const { container } = board();
    const by = (s: number): HTMLElement => container.querySelector(`[data-board-face='${s}']`) as HTMLElement;
    expect(by(0).hasAttribute("data-mark")).toBe(false);
    expect(by(0).querySelector(".mv-board__badge")).toBeNull();
    expect(by(1).getAttribute("data-mark")).toBe("cloth");
    expect(by(1).querySelector(".mv-board__badge svg")).not.toBeNull();
    expect(by(4).getAttribute("data-mark")).toBe("cloth window");
  });

  it("8자 닉네임은 한 줄 텍스트 노드로 들어가고 마크업 문자열은 요소를 만들지 않는다", () => {
    const eight = "가나다라마바사아";
    const evil = "<b>x</b>";
    const { container } = board({ ...MODEL, faces: [{ seat: 0, nickname: eight, marks: [] }, { seat: 1, nickname: evil, marks: [] }] });
    const names = [...container.querySelectorAll(".mv-board__name")];
    expect(names[0]!.textContent).toBe(eight);
    expect(names[0]!.childNodes).toHaveLength(1);
    expect(names[1]!.textContent).toBe(evil);
    expect(names[1]!.querySelector("b")).toBeNull();
  });
});

describe("SuspectBoard 목격 칸", () => {
  it("witness 가 있으면 접힌 한 줄(줄 수), 누르면 data-board-record-rows 와 기존 기록 줄, 다시 누르면 접힘", () => {
    const { container } = board();
    const btn = container.querySelector("button[data-board-witness]") as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.textContent).toBe("2");
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector("[data-board-record-rows]")).toBeNull();
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    const rows = container.querySelector("[data-board-record-rows]") as HTMLElement;
    expect(rows.getAttribute("data-board-record-rows")).toBe("2");
    expect(rows.querySelectorAll("li[data-record-row]")).toHaveLength(2);
    expect(rows.querySelector(".mv-record__name")?.textContent).toBe("영희");
    fireEvent.click(btn);
    expect(container.querySelector("[data-board-record-rows]")).toBeNull();
  });

  it("witness 가 null 이거나 줄이 0 이면 목격 칸이 없다", () => {
    expect(board({ ...MODEL, witness: null }).container.querySelector("[data-board-witness]")).toBeNull();
    cleanup();
    expect(board({ ...MODEL, witness: [] }).container.querySelector("[data-board-witness]")).toBeNull();
  });
});

describe("SuspectBoard 금지 말·스타일", () => {
  it("'범인'·'증거'·'확정'·직업 이름 문자열이 마크업 어디에도 없다", () => {
    const { container } = board();
    fireEvent.click(container.querySelector("button[data-board-witness]")!);
    const all = container.innerHTML;
    for (const word of ["범인", "증거", "확정", "마피아", "경찰", "의사", "시민"]) expect(all).not.toContain(word);
  });

  it("스타일: .mv-board 규칙이 v2.css 에 있고 hex 가 없으며 모션 줄이기에서 애니메이션이 없다", () => {
    const css = V2_CSS.slice(V2_CSS.indexOf(".mv-board"));
    expect(V2_CSS.indexOf(".mv-board")).toBeGreaterThan(V2_CSS.indexOf(".mv-record {"));
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
    expect(css).toMatch(/prefers-reduced-motion: reduce[\s\S]*mv-board[\s\S]*animation: none/);
  });
});
