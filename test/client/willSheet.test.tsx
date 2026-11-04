// WILL-01·NIGHT-12, UI-SPEC 279~286행. 유언·쪽지 시트 부품(WillSheet) + 조합 종료 값 훅(useComposedText).
// happy-dom 은 실제 IME 를 재현하지 못해 compositionstart/end 이벤트 순서만 시험한다(실제 조합은 7페이즈 CDP·iPhone 몫).
import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { WillSheet } from "../../src/components/v2/WillSheet";
import { IME_WAIT_MS } from "../../src/game/chatUi";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

interface HarnessProps {
  initial?: string;
  onSave?: (t: string) => void;
  onClose?: (t: string) => void;
  saved?: boolean;
  disabled?: boolean;
  compact?: boolean;
  title?: string;
  icon?: "quill" | "note";
  tone?: "mafia";
  placeholder?: string;
}

function Harness({ initial = "", onSave = () => {}, onClose = () => {}, ...rest }: HarnessProps) {
  const [value, setValue] = useState(initial);
  return <WillSheet value={value} onChange={setValue} onSave={onSave} onClose={onClose} {...rest} />;
}

const area = (c: HTMLElement) => c.querySelector("textarea") as HTMLTextAreaElement;
const saveBtn = (c: HTMLElement) => c.querySelector(".mv-will__save") as HTMLButtonElement;
const closeBtn = (c: HTMLElement) => c.querySelector('button[aria-label="닫기"]') as HTMLButtonElement;
const count = (c: HTMLElement) => c.querySelector(".mv-will__count")?.textContent;

describe("WillSheet — 유언 한 번 쓰기 (WILL-01, 트레이서)", () => {
  it("열면 textarea 에 초점, role dialog, aria-label 유언, data-will-sheet=will, placeholder", () => {
    const { container } = render(<Harness />);
    const root = container.querySelector("[data-will-sheet]") as HTMLElement;
    expect(root.getAttribute("role")).toBe("dialog");
    expect(root.getAttribute("aria-label")).toBe("유언");
    expect(root.getAttribute("data-will-sheet")).toBe("will");
    expect(document.activeElement).toBe(area(container));
    expect(area(container).getAttribute("placeholder")).toBe("죽으면 모두에게 보여요");
    expect(count(container)).toBe("0/100");
  });

  it("'안녕' 입력 → 카운터 2/100, [저장] → onSave('안녕') 한 번", () => {
    const onSave = vi.fn();
    const { container } = render(<Harness onSave={onSave} />);
    fireEvent.change(area(container), { target: { value: "안녕" } });
    expect(count(container)).toBe("2/100");
    fireEvent.click(saveBtn(container));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith("안녕");
  });

  it("101 그래핌 붙여넣기 → 100 그래핌까지 잘리고 카운터 100/100 (그래핌으로 센다)", () => {
    const { container } = render(<Harness />);
    const family = "👨‍👩‍👧"; // 여러 코드 포인트지만 그래핌 하나
    fireEvent.change(area(container), { target: { value: "가".repeat(99) + family + "나" } });
    expect(count(container)).toBe("100/100");
    expect(area(container).value).toBe("가".repeat(99) + family);
    fireEvent.change(area(container), { target: { value: "다".repeat(101) } });
    expect(area(container).value).toBe("다".repeat(100));
    expect(count(container)).toBe("100/100");
  });

  it("빈 값으로 [저장] → onSave('') 한 번(유언 지우기)", () => {
    const onSave = vi.fn();
    const { container } = render(<Harness initial="있던 유언" onSave={onSave} />);
    fireEvent.change(area(container), { target: { value: "" } });
    fireEvent.click(saveBtn(container));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith("");
  });

  it("닫기 → onClose(현재 확정 값) 한 번", () => {
    const onClose = vi.fn();
    const { container } = render(<Harness onClose={onClose} />);
    fireEvent.change(area(container), { target: { value: "나중에 봐" } });
    fireEvent.click(closeBtn(container));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledWith("나중에 봐");
  });

  it("saved true → 버튼 '저장됨'·disabled", () => {
    const { container } = render(<Harness saved />);
    expect(saveBtn(container).textContent).toContain("저장됨");
    expect(saveBtn(container).disabled).toBe(true);
  });

  it("saved false(저장 실패) → 버튼 '저장' 그대로 눌린다", () => {
    const onSave = vi.fn();
    const { container } = render(<Harness saved={false} onSave={onSave} initial="값" />);
    expect(saveBtn(container).textContent).toContain("저장");
    expect(saveBtn(container).textContent).not.toContain("저장됨");
    expect(saveBtn(container).disabled).toBe(false);
  });

  it("disabled true → [저장] aria-disabled, 클릭해도 onSave 0회", () => {
    const onSave = vi.fn();
    const { container } = render(<Harness disabled onSave={onSave} initial="값" />);
    expect(saveBtn(container).getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(saveBtn(container));
    expect(onSave).not.toHaveBeenCalled();
  });

  it("렌더된 DOM 어디에도 data-typing 이나 입력 중 알약이 없다 (T-09-16)", () => {
    const { container } = render(<Harness initial="쓰는 중" />);
    fireEvent.change(area(container), { target: { value: "쓰는 중이야" } });
    expect(container.querySelector("[data-typing]")).toBeNull();
    expect(container.innerHTML).not.toContain("typing");
    expect(container.innerHTML).not.toContain("…");
  });

  it("버튼 mousedown 기본 동작을 막아 키보드를 유지한다", () => {
    const { container } = render(<Harness />);
    expect(fireEvent.mouseDown(saveBtn(container))).toBe(false);
    expect(fireEvent.mouseDown(closeBtn(container))).toBe(false);
  });
});

describe("WillSheet — 한글 조합 중 저장·닫기 (연구 Pitfall 11)", () => {
  it("조합 중 [저장] → compositionend 전에는 0회, 끝난 뒤 확정 값으로 1회", () => {
    vi.useFakeTimers();
    const onSave = vi.fn();
    const { container } = render(<Harness onSave={onSave} />);
    const ta = area(container);
    fireEvent.compositionStart(ta);
    fireEvent.change(ta, { target: { value: "한" } });
    fireEvent.click(saveBtn(container));
    expect(onSave).toHaveBeenCalledTimes(0);
    act(() => {
      vi.advanceTimersByTime(IME_WAIT_MS - 10);
    });
    expect(onSave).toHaveBeenCalledTimes(0);
    fireEvent.change(ta, { target: { value: "한글" } });
    fireEvent.compositionEnd(ta);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith("한글");
    act(() => {
      vi.advanceTimersByTime(IME_WAIT_MS * 3);
    });
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("compositionend 가 IME_WAIT_MS 안에 안 오면 그 시각 값으로 1회", () => {
    vi.useFakeTimers();
    const onSave = vi.fn();
    const { container } = render(<Harness onSave={onSave} />);
    const ta = area(container);
    fireEvent.compositionStart(ta);
    fireEvent.change(ta, { target: { value: "안녕하" } });
    fireEvent.click(saveBtn(container));
    act(() => {
      vi.advanceTimersByTime(IME_WAIT_MS - 1);
    });
    expect(onSave).toHaveBeenCalledTimes(0);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith("안녕하");
  });

  it("조합 중 닫기도 조합이 끝난 값으로 onClose 1회", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const { container } = render(<Harness onClose={onClose} />);
    const ta = area(container);
    fireEvent.compositionStart(ta);
    fireEvent.change(ta, { target: { value: "잘" } });
    fireEvent.click(closeBtn(container));
    expect(onClose).toHaveBeenCalledTimes(0);
    fireEvent.change(ta, { target: { value: "잘자" } });
    fireEvent.compositionEnd(ta);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledWith("잘자");
  });

  it("IN-01: 조합 중 [저장] → [닫기] → compositionend 이면 onSave 1회 다음 onClose 1회, 둘 다 확정 값이다", () => {
    vi.useFakeTimers();
    const order: string[] = [];
    const onSave = vi.fn((t: string) => order.push(`save:${t}`));
    const onClose = vi.fn((t: string) => order.push(`close:${t}`));
    const { container } = render(<Harness onSave={onSave} onClose={onClose} />);
    const ta = area(container);
    fireEvent.compositionStart(ta);
    fireEvent.change(ta, { target: { value: "잘" } });
    fireEvent.click(saveBtn(container));
    fireEvent.click(closeBtn(container));
    expect(order).toEqual([]);
    fireEvent.change(ta, { target: { value: "잘자" } });
    fireEvent.compositionEnd(ta);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(order).toEqual(["save:잘자", "close:잘자"]);
  });

  it("IN-01: 조합 중 [저장] → [닫기] 뒤 compositionend 가 안 와도 IME_WAIT_MS 뒤 저장 → 닫기가 한 번씩 불린다", () => {
    vi.useFakeTimers();
    const order: string[] = [];
    const { container } = render(<Harness onSave={(t) => order.push(`save:${t}`)} onClose={(t) => order.push(`close:${t}`)} />);
    const ta = area(container);
    fireEvent.compositionStart(ta);
    fireEvent.change(ta, { target: { value: "안녕하" } });
    fireEvent.click(saveBtn(container));
    fireEvent.click(closeBtn(container));
    act(() => {
      vi.advanceTimersByTime(IME_WAIT_MS - 1);
    });
    expect(order).toEqual([]);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(order).toEqual(["save:안녕하", "close:안녕하"]);
    act(() => {
      vi.advanceTimersByTime(IME_WAIT_MS * 3);
    });
    expect(order).toHaveLength(2);
  });

  it("IN-01: 조합 중 [저장] 을 두 번, [닫기] 를 두 번 눌러도 각각 1회다", () => {
    vi.useFakeTimers();
    const onSave = vi.fn();
    const onClose = vi.fn();
    const { container } = render(<Harness onSave={onSave} onClose={onClose} />);
    const ta = area(container);
    fireEvent.compositionStart(ta);
    fireEvent.change(ta, { target: { value: "가" } });
    fireEvent.click(saveBtn(container));
    fireEvent.click(saveBtn(container));
    fireEvent.click(closeBtn(container));
    fireEvent.click(closeBtn(container));
    fireEvent.compositionEnd(ta);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("기다리는 중에 다시 눌러도 두 번 가지 않는다", () => {
    vi.useFakeTimers();
    const onSave = vi.fn();
    const { container } = render(<Harness onSave={onSave} />);
    const ta = area(container);
    fireEvent.compositionStart(ta);
    fireEvent.change(ta, { target: { value: "가" } });
    fireEvent.click(saveBtn(container));
    fireEvent.click(saveBtn(container));
    act(() => {
      vi.advanceTimersByTime(IME_WAIT_MS * 2);
    });
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});

describe("WillSheet — 쪽지 모드·compact (NIGHT-12, UI-SPEC Color)", () => {
  it("title 쪽지·icon note·tone mafia → data-will-sheet=note, 루트 mv-will--mafia", () => {
    const { container } = render(<Harness title="쪽지" icon="note" tone="mafia" placeholder="이름 없이 아침에 공개돼요" />);
    const root = container.querySelector("[data-will-sheet]") as HTMLElement;
    expect(root.getAttribute("data-will-sheet")).toBe("note");
    expect(root.getAttribute("aria-label")).toBe("쪽지");
    expect(root.classList.contains("mv-will")).toBe(true);
    expect(root.classList.contains("mv-will--mafia")).toBe(true);
    expect(area(container).getAttribute("placeholder")).toBe("이름 없이 아침에 공개돼요");
  });

  it("일반 유언 시트에는 mv-will--mafia 가 없다", () => {
    const { container } = render(<Harness />);
    expect(container.querySelector(".mv-will--mafia")).toBeNull();
  });

  it("textarea rows: 기본 3, compact 면 2", () => {
    const a = render(<Harness />);
    expect(area(a.container).getAttribute("rows")).toBe("3");
    cleanup();
    const b = render(<Harness compact />);
    expect(area(b.container).getAttribute("rows")).toBe("2");
  });

  it("카운터는 tabular-nums 를 CSS 로 갖는다", () => {
    const css = readFileSync("src/styles/v2.css", "utf8");
    const rule = css.match(/\.mv-will__count\s*\{[^}]*\}/)?.[0] ?? "";
    expect(rule).toContain("tabular-nums");
  });

  it("v2.css 의 .mv-will 규칙 중 crimson 토큰은 .mv-will--mafia 로 시작하는 규칙에만 있다", () => {
    const css = readFileSync("src/styles/v2.css", "utf8");
    const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].map((m) => ({ sel: (m[1] ?? "").trim(), body: m[2] ?? "" }));
    const willRules = rules.filter((r) => /\.mv-will/.test(r.sel));
    expect(willRules.length).toBeGreaterThan(5);
    for (const r of willRules) {
      if (/crimson/.test(r.body)) expect(r.sel.startsWith(".mv-will--mafia")).toBe(true);
    }
    expect(willRules.some((r) => r.sel.startsWith(".mv-will--mafia") && /crimson-700/.test(r.body))).toBe(true);
    expect(willRules.some((r) => r.sel.startsWith(".mv-will--mafia") && /crimson-300/.test(r.body))).toBe(true);
    expect(css).not.toMatch(/\.mv-will[^{]*\{[^}]*#[0-9a-fA-F]{3,8}\b/);
  });
});

describe("WillSheet — 시트는 send 를 갖지 않는다 (WILL-01, L7)", () => {
  it("부품 소스에 send·typing 경로가 없다", () => {
    const src = readFileSync("src/components/v2/WillSheet.tsx", "utf8");
    expect(src).not.toMatch(/useChat|onTyping|typing|\bsend\(|innerHTML/);
  });
});
