import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { bindSignals } from "../../src/audio/signals";
import { RoleChip } from "../../src/components/v2/RoleChip";
import { SureStamp } from "../../src/components/v2/SureStamp";
import { VerdictPicker } from "../../src/components/v2/VerdictPicker";
import { V2Icon, type V2IconName } from "../../src/components/v2/V2Icon";
import { VoteBadge } from "../../src/components/v2/VoteBadge";
import type { RoleId } from "../../shared/game/roles";

afterEach(cleanup);

// 08-03: 승인 v2.0 부품(design/v2.0/design-system/components/bundle.js)을 React 19 로 옮긴 득표·도장·직업 칩·찬반 부품.
// happy-dom 은 글자 폭·애니메이션을 재지 못한다. 여기서는 마크업과 v2.css 스타일 계약을 고정한다.

const V2_CSS = readFileSync("src/styles/v2.css", "utf8");
const BUNDLE_JS = readFileSync("design/v2.0/design-system/components/bundle.js", "utf8");

// 주석을 지운 규칙 본문 중 선택자가 `selector` 로 시작하는 것만 모은다(다음 글자가 이름 글자가 아니어야 한다).
function rulesFor(css: string, selector: string): string[] {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => (m[1] ?? "").split(",").some((s) => s.trim().startsWith(selector) && !/[\w-]/.test(s.trim().charAt(selector.length))))
    .map((m) => m[2] ?? "");
}

// 모션 줄이기 @media 블록 안의 규칙 중 선택자 목록에 `selector` 가 정확히 들어 있는 것의 본문.
function reducedMotionRules(css: string, selector: string): string[] {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const blocks = [...bare.matchAll(/@media \(prefers-reduced-motion: reduce\)\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g)];
  return blocks.flatMap((b) =>
    [...(b[1] ?? "").matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter((m) => (m[1] ?? "").split(",").some((s) => s.trim() === selector))
      .map((m) => m[2] ?? ""),
  );
}

// 규칙 본문을 합쳐 돌려준다. 규칙이 없으면 빈 문자열을 비교하지 않고 개수 단언에서 먼저 실패한다.
function bodyOf(rules: string[], label: string): string {
  expect(rules.length, `${label} 규칙 개수`).toBeGreaterThan(0);
  return rules.join(" ");
}

describe("VoteBadge (DAY-04, 결정 0049)", () => {
  it("count 3 은 span.mv-badge 안에 숫자 3 과 단위 표, data-count 를 그린다", () => {
    const { container } = render(<VoteBadge count={3} />);
    const badge = container.querySelector("span.mv-badge");
    expect(badge).not.toBeNull();
    expect(badge?.getAttribute("data-count")).toBe("3");
    expect(badge?.querySelector(".mv-badge__num")?.textContent).toBe("3");
    expect(badge?.querySelector(".mv-badge__unit")?.textContent).toBe("표");
  });

  it.each([0, -1, Number.NaN])("count %s 이면 아무 요소도 그리지 않는다", (count) => {
    const { container } = render(<VoteBadge count={count} />);
    expect(container.firstChild).toBeNull();
  });

  it("count 가 없으면(undefined) 아무 요소도 그리지 않는다", () => {
    const { container } = render(<VoteBadge {...({} as { count: number })} />);
    expect(container.firstChild).toBeNull();
  });

  it("lead 면 .is-lead 가 붙고, 없으면 붙지 않는다", () => {
    const a = render(<VoteBadge count={2} lead />);
    expect(a.container.querySelector("span.mv-badge")?.classList.contains("is-lead")).toBe(true);
    cleanup();
    const b = render(<VoteBadge count={2} />);
    expect(b.container.querySelector("span.mv-badge")?.classList.contains("is-lead")).toBe(false);
  });

  it("8표도 그대로 그린다", () => {
    const { container } = render(<VoteBadge count={8} />);
    expect(container.querySelector(".mv-badge__num")?.textContent).toBe("8");
  });

  it("3 에서 4 로 다시 그려도 같은 DOM 노드에서 숫자만 바뀐다", () => {
    const { container, rerender } = render(<VoteBadge count={3} />);
    const before = container.querySelector("span.mv-badge");
    const num = container.querySelector(".mv-badge__num");
    rerender(<VoteBadge count={4} />);
    expect(container.querySelector("span.mv-badge")).toBe(before);
    expect(container.querySelector(".mv-badge__num")).toBe(num);
    expect(num?.textContent).toBe("4");
    expect(before?.getAttribute("data-count")).toBe("4");
  });
});

describe("v2.css 득표 배지 스타일 계약 (DAY-04)", () => {
  it(".mv-badge 는 overlay-ink-strong 면·brass-400 2px 테두리·radius-badge 이고 색은 토큰 변수만 쓴다", () => {
    const body = bodyOf(rulesFor(V2_CSS, ".mv-badge"), ".mv-badge");
    expect(body).toContain("var(--overlay-ink-strong)");
    expect(body).toMatch(/border:\s*2px solid var\(--brass-400\)/);
    expect(body).toContain("var(--radius-badge)");
    expect(body).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });

  it("숫자·단위 규칙이 있고 숫자는 명조 토큰 변수를 쓴다(08-05 가 토큰을 더해 대체값을 걷었다)", () => {
    expect(bodyOf(rulesFor(V2_CSS, ".mv-badge__num"), ".mv-badge__num")).toContain("var(--font-serif)");
    expect(rulesFor(V2_CSS, ".mv-badge__unit").length).toBeGreaterThan(0);
  });

  it("모션 줄이기면 배지 애니메이션이 꺼지고 선두 배지는 scale(1.18) 로 고정된다", () => {
    expect(bodyOf(reducedMotionRules(V2_CSS, ".mv-badge"), "모션 줄이기 " + ".mv-badge")).toContain("animation: none");
    expect(bodyOf(reducedMotionRules(V2_CSS, ".mv-badge.is-lead"), "모션 줄이기 " + ".mv-badge.is-lead")).toContain("scale(1.18)");
  });
});

describe("SureStamp (DAY-04, 결정 0049)", () => {
  it("span.mv-stamp 에 글자 유력 한 단어를 그린다", () => {
    const { container } = render(<SureStamp />);
    const stamp = container.querySelector("span.mv-stamp");
    expect(stamp).not.toBeNull();
    expect(stamp?.textContent).toBe("유력");
  });
});

// 직업 칩이 쓰는 아이콘 — 경로 d 는 bundle.js ICONS 에서 그대로 옮긴다(승인 2026-10-31).
const ROLE_ICON_PATHS: Readonly<Record<"rolePolice" | "roleDoctor", readonly string[]>> = {
  rolePolice: [
    "M12 3l7 3v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V6z",
    "M12 8.5l1.2 2.4 2.6.4-1.9 1.8.5 2.6L12 14.5l-2.4 1.2.5-2.6-1.9-1.8 2.6-.4z",
  ],
  roleDoctor: ["M12 7.5v9", "M7.5 12h9"],
};

describe("V2Icon — 직업 아이콘 rolePolice·roleDoctor (GHOST-02)", () => {
  it.each(["rolePolice", "roleDoctor"] as const)("%s 경로 d 가 bundle.js 와 같다", (name) => {
    for (const d of ROLE_ICON_PATHS[name]) expect(BUNDLE_JS.includes(d), `bundle.js 에 ${name} 경로`).toBe(true);
    const iconName: V2IconName = name;
    const { container } = render(<V2Icon name={iconName} />);
    expect([...container.querySelectorAll("svg path")].map((p) => p.getAttribute("d")).join("|")).toBe(ROLE_ICON_PATHS[name].join("|"));
  });

  it("rolePolice 의 별은 채워지고 방패는 채워지지 않는다", () => {
    const { container } = render(<V2Icon name="rolePolice" />);
    const paths = [...container.querySelectorAll("svg path")];
    expect(paths.map((p) => p.getAttribute("fill"))).toEqual(["none", "currentColor"]);
  });

  it("roleDoctor 는 원 하나와 십자 경로 두 개를 그린다", () => {
    const { container } = render(<V2Icon name="roleDoctor" />);
    expect(container.querySelectorAll("svg circle").length).toBe(1);
    expect(container.querySelectorAll("svg path").length).toBe(2);
  });
});

describe("RoleChip (GHOST-02, 결정 0021)", () => {
  const CASES: ReadonlyArray<readonly [RoleId, string, string]> = [
    ["mafia", "마피아", "M6.5 12.5h11"],
    ["police", "경찰", "M12 3l7 3v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V6z"],
    ["doctor", "의사", "M12 7.5v9"],
    ["citizen", "시민", "M5 20c.8-3.8 3.6-6 7-6s6.2 2.2 7 6"],
  ];

  it.each(CASES)("%s 칩은 role=img, 이름 %s, data-role-chip, 해당 아이콘을 그린다", (role, name, iconPath) => {
    const { container } = render(<RoleChip role={role} />);
    const chip = container.querySelector("span.mv-rolechip");
    expect(chip).not.toBeNull();
    expect(chip?.getAttribute("role")).toBe("img");
    expect(chip?.getAttribute("aria-label")).toBe(name);
    expect(chip?.getAttribute("data-role-chip")).toBe(role);
    expect([...(chip?.querySelectorAll("svg path") ?? [])].some((p) => p.getAttribute("d") === iconPath)).toBe(true);
  });

  it("마피아만 .is-mafia 를 가진다", () => {
    for (const [role] of CASES) {
      const { container } = render(<RoleChip role={role} />);
      expect(container.querySelector("span.mv-rolechip")?.classList.contains("is-mafia"), role).toBe(role === "mafia");
      cleanup();
    }
  });
});

describe("v2.css 도장·직업 칩 스타일 계약 (DAY-04, GHOST-02)", () => {
  it(".mv-stamp 는 brass-200 글자·brass-400 테두리·-10° 기울임·dur-med 떨어짐이고 색은 토큰 변수만 쓴다", () => {
    const body = bodyOf(rulesFor(V2_CSS, ".mv-stamp"), ".mv-stamp");
    expect(body).toContain("var(--brass-200)");
    expect(body).toContain("var(--brass-400)");
    expect(body).toContain("rotate(-10deg)");
    expect(body).toContain("var(--dur-med)");
    expect(body).toContain("var(--font-serif)");
    expect(body).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });

  it("모션 줄이기면 .mv-stamp 애니메이션이 꺼진다", () => {
    expect(bodyOf(reducedMotionRules(V2_CSS, ".mv-stamp"), "모션 줄이기 " + ".mv-stamp")).toContain("animation: none");
  });

  it(".mv-rolechip 은 28 원형 칩이고 .is-mafia 만 진홍 테두리다", () => {
    const base = bodyOf(rulesFor(V2_CSS, ".mv-rolechip"), ".mv-rolechip");
    expect(base).toMatch(/width:\s*28px/);
    expect(base).toMatch(/height:\s*28px/);
    expect(base).toContain("1.5px solid var(--gray-300)");
    const mafia = bodyOf(rulesFor(V2_CSS, ".mv-rolechip.is-mafia"), ".mv-rolechip.is-mafia");
    expect(mafia).toContain("var(--crimson-400)");
    expect(mafia).toContain("var(--crimson-300)");
  });
});

// 찬반 버튼이 쓰는 아이콘 — 경로 d 는 bundle.js ICONS 에서 그대로 옮긴다(승인 2026-10-31).
const VERDICT_ICON_PATHS: Readonly<Record<"skip" | "thumbUp" | "thumbDown", readonly string[]>> = {
  skip: ["M4 6.5l7 5.5-7 5.5z", "M13 6.5l7 5.5-7 5.5z"],
  thumbUp: ["M7 10.5V20H4v-9.5z", "M7 10.5l4-7a2 2 0 0 1 3.4 1.9L13.5 9h5.2a2 2 0 0 1 2 2.4l-1.3 6.9a2 2 0 0 1-2 1.7H7"],
  thumbDown: ["M7 13.5V4H4v9.5z", "M7 13.5l4 7a2 2 0 0 0 3.4-1.9L13.5 15h5.2a2 2 0 0 0 2-2.4l-1.3-6.9A2 2 0 0 0 17.4 4H7"],
};

describe("V2Icon — 찬반·건너뛰기 아이콘 skip·thumbUp·thumbDown (DAY-06, DAY-03)", () => {
  it.each(["skip", "thumbUp", "thumbDown"] as const)("%s 경로 d 가 bundle.js 와 같다", (name) => {
    for (const d of VERDICT_ICON_PATHS[name]) expect(BUNDLE_JS.includes(d), `bundle.js 에 ${name} 경로`).toBe(true);
    const iconName: V2IconName = name;
    const { container } = render(<V2Icon name={iconName} />);
    expect([...container.querySelectorAll("svg path")].map((p) => p.getAttribute("d")).join("|")).toBe(VERDICT_ICON_PATHS[name].join("|"));
  });

  it("skip 은 경로 두 개를 그린다", () => {
    const { container } = render(<V2Icon name="skip" />);
    expect(container.querySelectorAll("svg path").length).toBe(2);
  });
});

describe("VerdictPicker 소리 신호 (12-10, LS-7)", () => {
  it("찬성·반대·같은 쪽 다시 누르기가 모두 값 없는 같은 vote 신호 하나를 보낸다", () => {
    const seen: unknown[] = [];
    const unbind = bindSignals((s) => seen.push(s));
    const picks: string[] = [];
    const { container } = render(<VerdictPicker value="yes" onChange={(v) => picks.push(v)} />);
    fireEvent.click(container.querySelector('button[data-verdict="yes"]')!);
    fireEvent.click(container.querySelector('button[data-verdict="no"]')!);
    fireEvent.click(container.querySelector('button[data-verdict="no"]')!);
    unbind();
    expect(picks).toEqual(["yes", "no", "no"]);
    expect(seen).toEqual([{ kind: "vote" }, { kind: "vote" }, { kind: "vote" }]);
  });

  it("disabled 이면 신호도 없다", () => {
    const seen: unknown[] = [];
    const unbind = bindSignals((s) => seen.push(s));
    const { container } = render(<VerdictPicker onChange={() => {}} disabled />);
    fireEvent.click(container.querySelector('button[data-verdict="yes"]')!);
    unbind();
    expect(seen).toEqual([]);
  });
});

describe("VerdictPicker (DAY-06, 결정 0053)", () => {
  function buttons(container: HTMLElement) {
    const yes = container.querySelector<HTMLButtonElement>('button[data-verdict="yes"]');
    const no = container.querySelector<HTMLButtonElement>('button[data-verdict="no"]');
    return { yes, no };
  }

  it("div.mv-verdict(role=group, 이름 찬반) 안에 찬성·반대 버튼 두 개를 그린다", () => {
    const { container } = render(<VerdictPicker onChange={() => {}} />);
    const group = container.querySelector("div.mv-verdict");
    expect(group?.getAttribute("role")).toBe("group");
    expect(group?.getAttribute("aria-label")).toBe("찬반");
    const { yes, no } = buttons(container);
    expect(yes?.type).toBe("button");
    expect(no?.type).toBe("button");
    expect(yes?.classList.contains("mv-verdict__btn")).toBe(true);
    expect(yes?.textContent).toBe("찬성");
    expect(no?.textContent).toBe("반대");
  });

  it("버튼 아이콘은 thumbUp·thumbDown 32 크기다", () => {
    const { container } = render(<VerdictPicker onChange={() => {}} />);
    const { yes, no } = buttons(container);
    const up = yes?.querySelector("svg");
    const down = no?.querySelector("svg");
    expect(up?.getAttribute("width")).toBe("32");
    expect(down?.getAttribute("width")).toBe("32");
    expect([...(up?.querySelectorAll("path") ?? [])].map((p) => p.getAttribute("d")).join("|")).toBe(VERDICT_ICON_PATHS.thumbUp.join("|"));
    expect([...(down?.querySelectorAll("path") ?? [])].map((p) => p.getAttribute("d")).join("|")).toBe(VERDICT_ICON_PATHS.thumbDown.join("|"));
  });

  it("고른 쪽이 없으면 두 버튼 모두 is-on 이 없고 aria-pressed 가 false 다", () => {
    const { container } = render(<VerdictPicker onChange={() => {}} />);
    const { yes, no } = buttons(container);
    expect(yes?.classList.contains("is-on")).toBe(false);
    expect(no?.classList.contains("is-on")).toBe(false);
    expect(yes?.getAttribute("aria-pressed")).toBe("false");
    expect(no?.getAttribute("aria-pressed")).toBe("false");
  });

  it("value yes 면 찬성만, no 면 반대만 is-on·aria-pressed true 다", () => {
    const a = render(<VerdictPicker value="yes" onChange={() => {}} />);
    const ay = buttons(a.container);
    expect(ay.yes?.classList.contains("is-on")).toBe(true);
    expect(ay.no?.classList.contains("is-on")).toBe(false);
    expect(ay.yes?.getAttribute("aria-pressed")).toBe("true");
    expect(ay.no?.getAttribute("aria-pressed")).toBe("false");
    cleanup();
    const b = render(<VerdictPicker value="no" onChange={() => {}} />);
    const bn = buttons(b.container);
    expect(bn.yes?.classList.contains("is-on")).toBe(false);
    expect(bn.no?.classList.contains("is-on")).toBe(true);
    expect(bn.yes?.getAttribute("aria-pressed")).toBe("false");
    expect(bn.no?.getAttribute("aria-pressed")).toBe("true");
  });

  it("누르면 onChange 가 고른 값으로 한 번 불린다", () => {
    const onChange = vi.fn();
    const { container } = render(<VerdictPicker onChange={onChange} />);
    const { yes, no } = buttons(container);
    fireEvent.click(yes as HTMLButtonElement);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith("yes");
    fireEvent.click(no as HTMLButtonElement);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith("no");
  });

  it("disabled 면 두 버튼이 disabled 이고 눌러도 onChange 가 없다", () => {
    const onChange = vi.fn();
    const { container } = render(<VerdictPicker value="yes" disabled onChange={onChange} />);
    const { yes, no } = buttons(container);
    expect(yes?.disabled).toBe(true);
    expect(no?.disabled).toBe(true);
    fireEvent.click(yes as HTMLButtonElement);
    fireEvent.click(no as HTMLButtonElement);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("버튼 mousedown 의 기본 동작을 막아 채팅 입력칸 포커스를 뺏지 않는다", () => {
    const { container } = render(<VerdictPicker onChange={() => {}} />);
    const { yes } = buttons(container);
    // fireEvent 는 preventDefault 가 불렸으면 false 를 돌려준다
    expect(fireEvent.mouseDown(yes as HTMLButtonElement)).toBe(false);
  });
});

describe("v2.css 찬반 스타일 계약 (DAY-06, UI Considerations E4)", () => {
  const verdictBody = () => [...bodyOf(rulesFor(V2_CSS, ".mv-verdict"), ".mv-verdict"), bodyOf(rulesFor(V2_CSS, ".mv-verdict__btn"), ".mv-verdict__btn")].join(" ");

  it("버튼은 min-height 84, 안 고른 쪽 night-700, 고른 쪽 gray-100 면에 night-900 글자다", () => {
    const base = bodyOf(rulesFor(V2_CSS, ".mv-verdict__btn"), ".mv-verdict__btn");
    expect(base).toMatch(/min-height:\s*84px/);
    expect(base).toContain("background: var(--night-700)");
    const on = bodyOf(rulesFor(V2_CSS, ".mv-verdict__btn.is-on"), ".mv-verdict__btn.is-on");
    expect(on).toContain("background: var(--gray-100)");
    expect(on).toContain("color: var(--night-900)");
  });

  it("disabled 는 불투명도 0.45 이고 포커스 링 규칙이 있다", () => {
    expect(bodyOf(rulesFor(V2_CSS, ".mv-verdict__btn:disabled"), ".mv-verdict__btn:disabled")).toContain("opacity: 0.45");
    expect(V2_CSS).toMatch(/\.mv-verdict__btn:focus-visible/);
  });

  it("찬반 규칙 어디에도 진홍·놋쇠·hex 색이 없다(역할마다 같은 화면)", () => {
    const body = verdictBody();
    expect(body).not.toMatch(/crimson|brass/);
    expect(body).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });
});
