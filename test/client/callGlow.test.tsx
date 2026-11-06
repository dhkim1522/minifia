import { readFileSync } from "node:fs";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import "../helpers/singleLineErrors";
import { ChatPanel } from "../../src/components/v2/ChatPanel";
import { FaceList } from "../../src/components/v2/FaceList";
import { HeadStack } from "../../src/components/v2/HeadStack";
import { VerdictPicker } from "../../src/components/v2/VerdictPicker";

afterEach(cleanup);

// 14-04: 빛남(HOST-03·04, D-02·D-08) — "지금 이걸 누르세요". 부품은 call prop 을 받으면 같은 빛(is-call + data-call)을 낸다.
// data-call 은 값 없는 표식이다(역할·좌석 값 없음, T-14-12).

const V2_CSS = readFileSync("src/styles/v2.css", "utf8");
const TOKENS_CSS = readFileSync("src/styles/tokens.css", "utf8");
const TOKENS_JSON = readFileSync("design/tokens.json", "utf8");

const face = (seat: number) => ({ seat, name: `이름${seat}`, img: `/characters/faces/face-${seat % 8}.png`, color: `var(--seat-${(seat % 8) + 1})` });

describe("빛남 부품 (HOST-03·04)", () => {
  it("NameTag call → 이름표에 is-call, call 없으면 없다", () => {
    const on = render(<HeadStack name="민준" color="var(--seat-1)" call />);
    expect(on.container.querySelector(".mv-tag.is-call")).not.toBeNull();
    on.unmount();
    const off = render(<HeadStack name="민준" color="var(--seat-1)" />);
    expect(off.container.querySelector(".is-call")).toBeNull();
  });

  it("VerdictPicker call → 두 단추 모두 is-call·data-call(값 빈 문자열), 없으면 둘 다 없다", () => {
    const on = render(<VerdictPicker onChange={() => {}} call />);
    const btns = [...on.container.querySelectorAll<HTMLElement>("button.mv-verdict__btn")];
    expect(btns).toHaveLength(2);
    for (const b of btns) {
      expect(b.classList.contains("is-call")).toBe(true);
      expect(b.getAttribute("data-call")).toBe("");
    }
    on.unmount();
    const off = render(<VerdictPicker onChange={() => {}} />);
    expect(off.container.querySelectorAll("[data-call], .is-call")).toHaveLength(0);
  });

  it("FaceList callSeats → 그 좌석 칸만 is-call·data-call(값 빈 문자열)", () => {
    const { container } = render(<FaceList faces={[face(0), face(2), face(5)]} callSeats={new Set([0, 5])} />);
    const lit = [...container.querySelectorAll<HTMLElement>("button[data-call]")];
    expect(lit.map((b) => b.getAttribute("data-face"))).toEqual(["0", "5"]);
    for (const b of lit) {
      expect(b.getAttribute("data-call")).toBe("");
      expect(b.classList.contains("is-call")).toBe(true);
    }
    expect(container.querySelectorAll(".is-call")).toHaveLength(2);
  });

  it("FaceList callSeats 없음 → 빛 0개", () => {
    const { container } = render(<FaceList faces={[face(0), face(2)]} />);
    expect(container.querySelectorAll("[data-call], .is-call")).toHaveLength(0);
  });

  const chat = (extra: Record<string, unknown> = {}) =>
    render(<ChatPanel messages={[]} logHeight={96} value="" onChange={() => {}} onSend={() => {}} {...extra} />);

  it("ChatPanel callInput → 입력칸을 감싼 칸 is-call, 입력칸 data-call, [유언] 에는 없다", () => {
    const { container } = chat({ callInput: true, onWill: () => {} });
    expect(container.querySelector(".mv-chat__field.is-call")).not.toBeNull();
    expect(container.querySelector("input[data-chat-input]")?.getAttribute("data-call")).toBe("");
    expect(container.querySelector("[data-will-button]")?.hasAttribute("data-call")).toBe(false);
    expect(container.querySelectorAll("[data-call]")).toHaveLength(1);
  });

  it("ChatPanel callWill → [유언] 단추 is-call·data-call, 입력칸에는 없다", () => {
    const { container } = chat({ callWill: true, onWill: () => {} });
    const will = container.querySelector("[data-will-button]");
    expect(will?.classList.contains("is-call")).toBe(true);
    expect(will?.getAttribute("data-call")).toBe("");
    expect(container.querySelectorAll("[data-call]")).toHaveLength(1);
  });

  it("ChatPanel call 없음 → 빛 0개", () => {
    const { container } = chat({ onWill: () => {} });
    expect(container.querySelectorAll("[data-call], .is-call")).toHaveLength(0);
  });
});

describe("빛남 토큰·CSS (D-02)", () => {
  it("glow-ring·glow-ring-peak 토큰이 tokens.json 과 tokens.css 에 있다", () => {
    for (const name of ["glow-ring", "glow-ring-peak"]) {
      expect(TOKENS_JSON).toContain(`"${name}"`);
      expect(TOKENS_CSS).toMatch(new RegExp(`--${name}:`));
    }
    // 시안(HostCaption.dc.html)의 light-lamp 두 겹 그림자 그대로
    expect(TOKENS_CSS).toMatch(/--glow-ring:\s*0 0 0 2px rgba\(255, 207, 138, 0\.35\),\s*0 0 14px rgba\(255, 207, 138, 0\.55\)/);
  });

  const bare = V2_CSS.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [...bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: (m[1] ?? "").trim(), body: m[2] ?? "" }));
  const callRules = rules.filter((r) => r.selector.includes("is-call"));

  it(".is-call 규칙이 있고 light-lamp 테두리·--glow-ring 을 쓴다, hex·rgb 리터럴 없음", () => {
    expect(callRules.length).toBeGreaterThanOrEqual(3);
    const all = callRules.map((r) => r.body).join(" ");
    expect(all).toMatch(/var\(--light-lamp\)/);
    expect(all).toMatch(/var\(--glow-ring\)/);
    for (const r of callRules) {
      expect(r.body, r.selector).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(r.body, r.selector).not.toMatch(/\brgba?\(/);
    }
  });

  it("맥박은 opacity 만 움직이고 box-shadow 값 자체는 애니메이션하지 않는다, 횟수가 정해져 있다(영원히 아님)", () => {
    const kf = bare.match(/@keyframes\s+mv-call-pulse\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/);
    expect(kf, "@keyframes mv-call-pulse").not.toBeNull();
    expect(kf?.[1] ?? "").toMatch(/opacity/);
    expect(kf?.[1] ?? "").not.toMatch(/box-shadow|transform|background|color/);
    const anim = callRules.map((r) => r.body).join(" ").match(/animation:[^;]*mv-call-pulse[^;]*/);
    expect(anim, "animation 선언").not.toBeNull();
    expect(anim?.[0] ?? "").toMatch(/var\(--dur-pulse\)/);
    expect(anim?.[0] ?? "").not.toMatch(/infinite/);
  });

  it("모션 줄이기 블록에서 맥박이 없다(정지 빛만)", () => {
    const blocks = [...bare.matchAll(/@media \(prefers-reduced-motion: reduce\)\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g)];
    const inside = blocks.flatMap((b) => [...(b[1] ?? "").matchAll(/([^{}]+)\{([^{}]*)\}/g)]).filter((m) => (m[1] ?? "").includes("is-call"));
    expect(inside.length).toBeGreaterThan(0);
    expect(inside.map((m) => m[2]).join(" ")).toMatch(/animation:\s*none/);
  });
});
