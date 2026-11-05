import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import "../helpers/singleLineErrors";
import { Icon } from "../../src/components/Icon";
import type { IconName } from "../../src/components/Icon";
import { V2Icon } from "../../src/components/v2/V2Icon";
import type { V2IconName } from "../../src/components/v2/V2Icon";

afterEach(cleanup);

// 08-20: 남은 이름 전부가 24×24 svg 로 그려지는지 본다(v1.0 낮·밤 화면 전용 아이콘은 지웠다).
const ICON_NAMES: IconName[] = ["back", "share", "close", "copy", "check", "card", "disconnected", "plus", "minus", "wrench"];

describe("Icon 남은 이름 (08-20)", () => {
  it.each(ICON_NAMES)("%s 는 24×24 svg 로 그려진다", (name) => {
    const { container } = render(<Icon name={name} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg?.querySelectorAll("path,circle,rect").length).toBeGreaterThan(0);
  });
});

// 09.1.1-08: v2 아이콘 새 셋(whisper·swap·quiet) — 24 격자, 선 2px, 둥근 끝(외부 라이브러리 없음). 장식이라 label 이 없으면 aria-hidden
const V2_NEW: V2IconName[] = ["whisper", "swap", "quiet"];

describe("V2Icon 새 아이콘 (09.1.1-08)", () => {
  it.each(V2_NEW)("%s 는 24 격자 svg, 선 2px·둥근 끝이고 도형이 있다", (name) => {
    const { container } = render(<V2Icon name={name} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg?.getAttribute("stroke-width")).toBe("2");
    expect(svg?.getAttribute("stroke-linecap")).toBe("round");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.querySelectorAll("path,circle").length).toBeGreaterThan(0);
  });

  it("세 아이콘은 서로 다른 모양이다", () => {
    const shapes = V2_NEW.map((name) => {
      const { container } = render(<V2Icon name={name} />);
      return [...container.querySelectorAll("path,circle")].map((e) => e.outerHTML).join("");
    });
    expect(new Set(shapes).size).toBe(3);
  });
});

// 10-05: 동작 판과 입력줄 버튼이 쓰는 아홉 아이콘(face·throat·deny·clap·cry·handshake·praise·surprise·dance).
// 경로는 design/v2.0/design-system/components/bundle.js 의 ICONS 와 같은 데이터다(새로 그리지 않는다).
const V2_EMOTE: V2IconName[] = ["face", "throat", "deny", "clap", "cry", "handshake", "praise", "surprise", "dance"];

describe("V2Icon 동작 아이콘 아홉 개 (10-05)", () => {
  it.each(V2_EMOTE)("%s 는 24 격자 svg, 선 2px·둥근 끝이고 도형이 있다", (name) => {
    const { container } = render(<V2Icon name={name} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg?.getAttribute("stroke-width")).toBe("2");
    expect(svg?.getAttribute("stroke-linecap")).toBe("round");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.querySelectorAll("path,circle").length).toBeGreaterThan(0);
  });

  it("아홉 아이콘은 서로 다른 모양이다", () => {
    const shapes = V2_EMOTE.map((name) => {
      const { container } = render(<V2Icon name={name} />);
      return [...container.querySelectorAll("path,circle")].map((e) => e.outerHTML).join("");
    });
    expect(new Set(shapes).size).toBe(9);
  });
});

// 11-07: 결과 탭 패널의 기록 탭 아이콘 timeline — 직접 그린 단순 모양(이모지·아이콘 폰트 없음), 24 격자, 선 2px, 둥근 끝
describe("V2Icon timeline (11-07)", () => {
  it("24 격자 svg, 선 2px·둥근 끝이고 도형이 있으며 다른 아이콘과 모양이 다르다", () => {
    const { container } = render(<V2Icon name="timeline" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg?.getAttribute("stroke-width")).toBe("2");
    expect(svg?.getAttribute("stroke-linecap")).toBe("round");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.querySelectorAll("path,circle").length).toBeGreaterThan(0);
    const shape = (name: V2IconName) => {
      const r = render(<V2Icon name={name} />);
      const out = [...r.container.querySelectorAll("path,circle")].map((e) => e.outerHTML).join("");
      r.unmount();
      return out;
    };
    for (const other of ["send", "ghost", "roleMafia", "whisper", "note", "quiet"] as V2IconName[]) expect(shape("timeline")).not.toBe(shape(other));
  });
});
