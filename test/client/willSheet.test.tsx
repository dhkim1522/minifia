// WILL-01·NIGHT-12, UI-SPEC 279~286행. 유언·쪽지 시트 부품(WillSheet) + 조합 종료 값 훅(useComposedText).
// happy-dom 은 실제 IME 를 재현하지 못해 compositionstart/end 이벤트 순서만 시험한다(실제 조합은 7페이즈 CDP·iPhone 몫).
import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { WillSheet } from "../../src/components/v2/WillSheet";
import { WILL_MAX_GRAPHEMES } from "../../shared/game/will";
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
  saveLabel?: string;
  savedLabel?: string;
  secondsLeft?: number;
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
    expect(count(container)).toBe("0/20");
  });

  it("'안녕' 입력 → 카운터 2/20, [저장] → onSave('안녕') 한 번", () => {
    const onSave = vi.fn();
    const { container } = render(<Harness onSave={onSave} />);
    fireEvent.change(area(container), { target: { value: "안녕" } });
    expect(count(container)).toBe("2/20");
    fireEvent.click(saveBtn(container));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith("안녕");
  });

  it("21 그래핌 붙여넣기 → 20 그래핌까지 잘리고 카운터 20/20", () => {
    expect(WILL_MAX_GRAPHEMES).toBe(20);
    const { container } = render(<Harness />);
    const family = "👨‍👩‍👧"; // 여러 코드 포인트지만 그래핌 하나
    fireEvent.change(area(container), { target: { value: "가".repeat(19) + family + "나" } });
    expect(count(container)).toBe("20/20");
    expect(area(container).value).toBe("가".repeat(19) + family);
    fireEvent.change(area(container), { target: { value: "다".repeat(21) } });
    expect(area(container).value).toBe("다".repeat(20));
    expect(count(container)).toBe("20/20");
  });

  it("max 를 주면(쪽지 100) 그 값으로 자르고 센다", () => {
    const { container } = render(<WillSheet value={"라".repeat(60)} onChange={() => {}} onSave={() => {}} onClose={() => {}} max={100} />);
    expect(count(container)).toBe("60/100");
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
  it("20자 경계에서 조합 중인 글자를 유지하고 조합이 끝나면 상한을 적용한다", () => {
    const prefix = "가".repeat(19);
    const onSave = vi.fn();
    const { container } = render(<Harness initial={prefix} onSave={onSave} />);
    const ta = area(container);
    fireEvent.compositionStart(ta);
    fireEvent.change(ta, { target: { value: prefix + "한ㄱ" } });
    expect(ta.value).toBe(prefix + "한ㄱ");
    expect(count(container)).toBe("20/20");
    fireEvent.compositionEnd(ta);
    expect(ta.value).toBe(prefix + "한");
    fireEvent.click(saveBtn(container));
    expect(onSave).toHaveBeenCalledWith(prefix + "한");
  });

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
      // 예외 하나: 유언 단계 남은 초의 마지막 5초 진홍은 시간 신호다(22-11 P22-8, 역할과 무관한 timerTone)
      if (/crimson/.test(r.body)) expect(r.sel.startsWith(".mv-will--mafia") || r.sel === '.mv-will__secs[data-tone="urgent"]').toBe(true);
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


describe("WillSheet — 유언 단계 [남기기]·남은 초 (22-11 P22-7·8)", () => {
  it("saveLabel·savedLabel·secondsLeft: 아래줄이 글자 수 → 남은 초 → [남기기] 순서이고 남은 초는 aria-hidden, 단추 이름은 '유언 남기기'다", () => {
    const { container } = render(<Harness initial="안녕" saveLabel="남기기" savedLabel="남김" secondsLeft={7} />);
    const foot = container.querySelector(".mv-will__foot")!;
    expect([...foot.children].map((e) => e.classList[0]).join(",")).toBe("mv-will__count,mv-will__secs,mv-will__save");
    expect(count(container)).toBe("2/20");
    const secs = container.querySelector(".mv-will__secs") as HTMLElement;
    expect(secs.textContent).toBe("7초");
    expect(secs.getAttribute("aria-hidden")).toBe("true");
    expect(secs.getAttribute("data-tone")).toBe("calm");
    expect(saveBtn(container).textContent).toBe("남기기");
    expect(saveBtn(container).hasAttribute("data-will-save")).toBe(true);
    expect(saveBtn(container).getAttribute("aria-label")).toBe("유언 남기기");
  });

  it("남은 초가 5초 이하면 진홍(urgent) 톤이다", () => {
    for (const n of [5, 3, 1]) {
      const { container } = render(<Harness saveLabel="남기기" savedLabel="남김" secondsLeft={n} />);
      expect((container.querySelector(".mv-will__secs") as HTMLElement).getAttribute("data-tone"), `${n}`).toBe("urgent");
      cleanup();
    }
    const six = render(<Harness saveLabel="남기기" savedLabel="남김" secondsLeft={6} />);
    expect((six.container.querySelector(".mv-will__secs") as HTMLElement).getAttribute("data-tone")).toBe("calm");
  });

  it("saved 이면 savedLabel '남김' 이고 비활성이다", () => {
    const { container } = render(<Harness saveLabel="남기기" savedLabel="남김" secondsLeft={4} saved />);
    expect(saveBtn(container).textContent).toBe("남김");
    expect(saveBtn(container).disabled).toBe(true);
  });

  it("세 prop 이 없으면 지금 모양이다 — 남은 초 없음, [저장]·저장됨, 단추에 data-will-save 만 붙는다(밤 유언·쪽지 회귀 없음)", () => {
    const { container } = render(<Harness />);
    expect(container.querySelector(".mv-will__secs")).toBeNull();
    expect(saveBtn(container).textContent).toBe("저장");
    expect(saveBtn(container).getAttribute("aria-label")).toBeNull();
    expect(saveBtn(container).hasAttribute("data-will-save")).toBe(true);
  });
});
