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

// 11-09: 시상식 헤더 아이콘 trophy — 승인 bundle.js ICONS 와 같은 데이터(O-8)
describe("V2Icon trophy (11-09)", () => {
  it("trophy 는 24 격자 svg, 선 2px·둥근 끝이고 도형이 있다", () => {
    const { container } = render(<V2Icon name="trophy" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg?.getAttribute("stroke-width")).toBe("2");
    expect(svg?.getAttribute("stroke-linecap")).toBe("round");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.querySelectorAll("path,circle").length).toBeGreaterThan(0);
  });
});


// 11-12: 쉬는 사람 화면의 모래시계 — 직접 그린 단순 모양(24 격자, 선 2px, 둥근 끝)
describe("V2Icon hourglass (11-12)", () => {
  it("24 격자 svg, 선 2px·둥근 끝이고 도형이 있다 — 장식이라 label 이 없으면 aria-hidden", () => {
    const { container } = render(<V2Icon name="hourglass" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg?.getAttribute("stroke-width")).toBe("2");
    expect(svg?.getAttribute("stroke-linecap")).toBe("round");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.querySelectorAll("path,circle").length).toBeGreaterThan(0);
  });

  it("다른 아이콘과 모양이 겹치지 않는다", () => {
    const shape = (name: V2IconName) => {
      const { container } = render(<V2Icon name={name} />);
      return [...container.querySelectorAll("path,circle")].map((e) => e.outerHTML).join("");
    };
    const mine = shape("hourglass");
    for (const other of ["timeline", "trophy", "quiet", "skip"] as const) expect(shape(other)).not.toBe(mine);
  });
});

// 11-13: 맵 아이콘 셋(mapBar·mapPlaza·shuffle) — 직접 그린 단순 모양, 24 격자, 선 2px, 둥근 끝 (O-8)
const V2_MAP: V2IconName[] = ["mapBar", "mapPlaza", "shuffle"];

describe("V2Icon 맵 아이콘 (11-13)", () => {
  it.each(V2_MAP)("%s 는 24 격자 svg, 선 2px·둥근 끝이고 도형이 있다", (name) => {
    const { container } = render(<V2Icon name={name} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg?.getAttribute("stroke-width")).toBe("2");
    expect(svg?.getAttribute("stroke-linecap")).toBe("round");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.querySelectorAll("path,circle").length).toBeGreaterThan(0);
  });

  it("세 아이콘은 서로 다른 모양이다", () => {
    const shapes = V2_MAP.map((name) => {
      const { container } = render(<V2Icon name={name} />);
      return [...container.querySelectorAll("path,circle")].map((e) => e.outerHTML).join("");
    });
    expect(new Set(shapes).size).toBe(3);
  });
});

// 12-07: 소리 단추 아이콘 sound(스피커 + 파동 둘)·soundOff(스피커 + 빗금) — 직접 그린 단순 모양, 24 격자, 선 2px, 둥근 끝 (O-2)
const V2_SOUND: V2IconName[] = ["sound", "soundOff"];

describe("V2Icon 소리 아이콘 (12-07)", () => {
  it.each(V2_SOUND)("%s 는 24 격자 svg, 선 2px·둥근 끝이고 도형이 있다", (name) => {
    const { container } = render(<V2Icon name={name} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg?.getAttribute("stroke-width")).toBe("2");
    expect(svg?.getAttribute("stroke-linecap")).toBe("round");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.querySelectorAll("path,circle").length).toBeGreaterThan(0);
  });

  it("두 아이콘은 서로, 그리고 다른 아이콘과 모양이 다르다", () => {
    const shape = (name: V2IconName) => {
      const { container } = render(<V2Icon name={name} />);
      return [...container.querySelectorAll("path,circle")].map((e) => e.outerHTML).join("");
    };
    expect(shape("sound")).not.toBe(shape("soundOff"));
    for (const other of ["quiet", "whisper", "send", "face"] as V2IconName[]) {
      expect(shape("sound")).not.toBe(shape(other));
      expect(shape("soundOff")).not.toBe(shape(other));
    }
  });
});

// 17-04: [다음] 단추의 chevronRight — 24 격자, 선 2px, 둥근 끝(직접 그린 선 그림)
describe("V2Icon chevronRight (17-04)", () => {
  it("path 를 가진 24 격자 svg 로 그려지고 다른 아이콘과 모양이 다르다", () => {
    const { container } = render(<V2Icon name={"chevronRight" as V2IconName} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg?.getAttribute("stroke-width")).toBe("2");
    expect(svg?.getAttribute("stroke-linecap")).toBe("round");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.querySelectorAll("path").length).toBeGreaterThan(0);
    const shape = (name: V2IconName) => {
      const r = render(<V2Icon name={name} />);
      return [...r.container.querySelectorAll("path,circle")].map((e) => e.outerHTML).join("");
    };
    expect(shape("chevronRight" as V2IconName)).not.toBe(shape("arrow"));
    expect(shape("chevronRight" as V2IconName)).not.toBe(shape("play"));
  });
});

// 17-08: 직업 카드 배지 아이콘 mask·shield·lens — 승인 시안(Roles.dc.html)의 icon 경로, 24 격자, 선 2px, 둥근 끝
const V2_ROLE_BADGE: V2IconName[] = ["mask", "shield", "lens"];

describe("V2Icon 직업 배지 아이콘 (17-08)", () => {
  it.each(V2_ROLE_BADGE)("%s 는 24 격자 svg, 선 2px·둥근 끝이고 path 가 있다", (name) => {
    const { container } = render(<V2Icon name={name} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg?.getAttribute("stroke-width")).toBe("2");
    expect(svg?.getAttribute("stroke-linecap")).toBe("round");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.querySelectorAll("path").length).toBeGreaterThan(0);
  });

  it("세 아이콘은 서로 다르고 eye 와도 다른 모양이다", () => {
    const shape = (name: V2IconName) => {
      const { container } = render(<V2Icon name={name} />);
      const out = [...container.querySelectorAll("path,circle")].map((e) => e.outerHTML).join("");
      cleanup();
      return out;
    };
    const shapes = [...V2_ROLE_BADGE, "eye" as const].map(shape);
    expect(new Set(shapes).size).toBe(4);
  });
});

// 18-04: 목격자 없음 아이콘 eyeOff — eye 윤곽·눈동자 + 사선, 24 격자, 선 2px, 둥근 끝
describe("V2Icon eyeOff (18-04)", () => {
  it("24 격자 선 그림이고 path 가 둘 이상(눈 윤곽 + 사선)이며 eye 와 모양이 다르다", () => {
    const { container } = render(<V2Icon name="eyeOff" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg?.getAttribute("stroke-width")).toBe("2");
    expect(svg?.getAttribute("stroke-linecap")).toBe("round");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.querySelectorAll("path").length).toBeGreaterThanOrEqual(2);
    const shape = (name: V2IconName) => {
      const r = render(<V2Icon name={name} />);
      return [...r.container.querySelectorAll("path,circle")].map((e) => e.outerHTML).join("");
    };
    expect(shape("eyeOff")).not.toBe(shape("eye"));
  });

  it("label 을 주면 role=img 와 aria-label 이 붙는다", () => {
    const { container } = render(<V2Icon name="eyeOff" label="목격자 없음" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("role")).toBe("img");
    expect(svg?.getAttribute("aria-label")).toBe("목격자 없음");
    expect(svg?.getAttribute("aria-hidden")).toBeNull();
  });
});
