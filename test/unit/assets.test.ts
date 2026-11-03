import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROLE_IDS } from "../../shared/game/roles";
import { SCENE_IDS } from "../../src/game/scenes";

vi.mock("react-dom", () => ({ preload: vi.fn() }));

import { preload } from "react-dom";
import {
  FIGURE_IDS,
  ASSET_VERSION,
  backdropUrl,
  duskPreloadList,
  entryPreloadList,
  faceSrc,
  figureSrc,
  ghostSrc,
  journalArt,
  preloadEntryAssets,
  preloadDuskAssets,
  preloadRoleAssets,
  roleArtSrc,
  rolePreloadList,
} from "../../src/net/assets";

// node:fs 대신 Vite 의 import.meta.glob 으로 public/ 의 실제 파일 목록을 얻는다.
const characterFiles = new Set(Object.keys(import.meta.glob("/public/characters/**/*.png")));
const backdropFiles = new Set(Object.keys(import.meta.glob("/public/backgrounds/*.webp")));


/** srcSet "a 2x, b 4x" 에서 URL 만 뽑는다. */
function urlsOfSrcSet(srcSet: string): string[] {
  return srcSet.split(",").map((part) => part.trim().split(/\s+/)[0]!);
}

describe("그림 URL 헬퍼", () => {
  it("인물: src 는 @2x, srcSet 은 파일 폭 ÷ 표시 폭(72px 표시라 2x·4x), @ 는 %40", () => {
    expect(figureSrc(0).src).toBe("/characters/table/fig1_boy_brown_default%402x.png");
    expect(figureSrc(7).srcSet).toBe(
      "/characters/table/fig8_girl_tanhat_default%402x.png 2x, /characters/table/fig8_girl_tanhat_default%404x.png 4x",
    );
  });

  it("인물: 자리 번호는 8로 나눈 나머지를 쓴다(음수도)", () => {
    expect(figureSrc(9).src).toContain("fig2_boy_black");
    expect(figureSrc(9)).toEqual(figureSrc(1));
    expect(figureSrc(-1).src).toContain("fig8_girl_tanhat");
    expect(figureSrc(-1)).toEqual(figureSrc(7));
  });

  it("얼굴: /characters/faces/face-{seat % 8}.png (09-05, NIGHT-09)", () => {
    expect(faceSrc(0)).toBe("/characters/faces/face-0.png");
    expect(faceSrc(9)).toBe("/characters/faces/face-1.png");
    expect(faceSrc(-1)).toBe("/characters/faces/face-7.png");
    for (let seat = 0; seat < 8; seat++) {
      expect(characterFiles.has(`/public${faceSrc(seat)}`), `public 에 ${faceSrc(seat)} 파일`).toBe(true);
    }
  });

  it("직업 그림: src 는 @2x, srcSet 은 150px 표시라 1x·2x", () => {
    const art = roleArtSrc("mafia");
    expect(art.src).toBe("/characters/roles/mafia_default%402x.png");
    expect(art.srcSet).toBe("/characters/roles/mafia_default%402x.png 1x, /characters/roles/mafia_default%404x.png 2x");
  });

  it("배경: /backgrounds/bg_{layout}_{장면 파일 조각}.webp?v=버전", () => {
    expect(backdropUrl("game", "day")).toBe(`/backgrounds/bg_game_day.webp?v=${ASSET_VERSION}`);
    expect(backdropUrl("game", "night")).toBe(`/backgrounds/bg_game_night.webp?v=${ASSET_VERSION}`);
    expect(backdropUrl("game", "verdictDusk")).toBe(`/backgrounds/bg_game_verdict_dusk.webp?v=${ASSET_VERSION}`);
    expect(backdropUrl("entry", "lobby")).toBe(`/backgrounds/bg_entry_lobby.webp?v=${ASSET_VERSION}`);
  });

  it("배경: entry 구도는 lobby 장면만 받는다 (타입)", () => {
    // @ts-expect-error -- entry 구도에는 lobby 가 아닌 장면이 없다
    expect(backdropUrl("entry", "night")).toBe(`/backgrounds/bg_entry_night.webp?v=${ASSET_VERSION}`);
  });
});

const JOURNAL_ROLES = ["police", "mafia", "doctor"] as const;
const JOURNAL_SLOTS = ["cover", "page", "icon"] as const;

describe("일지 그림 슬롯", () => {
  it("journalArt(role, slot) 은 /journals/journal_${role}_${slot}.svg 를 돌려주고 srcSet 이 없다", () => {
    expect(journalArt("police", "icon")).toEqual({ src: "/journals/journal_police_icon.svg" });
    expect(journalArt("mafia", "cover").src).toBe("/journals/journal_mafia_cover.svg");
    expect(journalArt("doctor", "page").src).toBe("/journals/journal_doctor_page.svg");
    for (const role of JOURNAL_ROLES) for (const slot of JOURNAL_SLOTS) expect("srcSet" in journalArt(role, slot)).toBe(false);
  });
});

describe("일지 색 토큰 (UI-SPEC 새 토큰 12개)", () => {
  const tokens = JSON.parse(readFileSync("design/tokens.json", "utf8")) as {
    color: { tokens: { name: string; value: string }[] };
  };
  const expected: [string, string][] = [
    ["amber-400", "#f2b84b"],
    ["journal-police-bg", "#16213d"],
    ["journal-police-head", "#1d2c52"],
    ["journal-police-edge", "#34456f"],
    ["journal-police-ink", "#9ec2ff"],
    ["journal-mafia-bg", "#241420"],
    ["journal-mafia-head", "#3a1a26"],
    ["journal-mafia-edge", "#5a2434"],
    ["journal-doctor-bg", "#10241f"],
    ["journal-doctor-head", "#15332b"],
    ["journal-doctor-edge", "#26503f"],
    ["journal-doctor-ink", "#8fd0bf"],
  ];

  it("color.tokens 에 이 열두 개가 순서와 값 그대로 들어 있다 (사이에 다른 토큰이 끼어도 순서가 같다)", () => {
    const names = new Set(expected.map(([name]) => name));
    const found = tokens.color.tokens.filter((t) => names.has(t.name)).map((t) => [t.name, t.value]);
    expect(found).toEqual(expected);
  });

  it("투표 화면 토큰 세 개(amber-700·amber-900·cone-light, P-12)가 amber-400 바로 뒤에 있고 css 에도 있다", () => {
    const list = tokens.color.tokens.map((t) => [t.name, t.value]);
    const at = list.findIndex(([name]) => name === "amber-400");
    expect(list.slice(at + 1, at + 4)).toEqual([
      ["amber-700", "#7a5314"],
      ["amber-900", "#3a2508"],
      ["cone-light", "#fff4d6"],
    ]);
    const css = readFileSync("src/styles/tokens.css", "utf8");
    expect(css).toContain("--amber-700: #7a5314;");
    expect(css).toContain("--amber-900: #3a2508;");
    expect(css).toContain("--cone-light: #fff4d6;");
  });

  it("tokens.css 가 새 토큰을 :root 변수로 가진다", () => {
    const css = readFileSync("src/styles/tokens.css", "utf8");
    expect(css).toContain("--amber-400: #f2b84b;");
    for (const [name, value] of expected) expect(css).toContain(`--${name}: ${value};`);
  });
});

describe("미리 받기 목록", () => {
  it("입장 화면 목록: 입장·대기실 배경(WebP)과 인물 8종", () => {
    const hrefs = entryPreloadList().map((item) => item.href);
    expect(hrefs).toContain(`/backgrounds/bg_entry_lobby.webp?v=${ASSET_VERSION}`);
    expect(hrefs).toContain(`/backgrounds/bg_game_lobby.webp?v=${ASSET_VERSION}`);
    expect(hrefs.some((h) => h.endsWith(".svg"))).toBe(false);
    for (let seat = 0; seat < FIGURE_IDS.length; seat++) expect(hrefs).toContain(figureSrc(seat).src);
    expect(hrefs).toHaveLength(10);
  });

  it("역할 화면 목록: 직업 그림 4종 전부와 아침·낮·밤 배경, 유령 그림(역할과 무관하게 같은 목록)", () => {
    const hrefs = rolePreloadList().map((item) => item.href);
    for (const role of ROLE_IDS) expect(hrefs).toContain(roleArtSrc(role).src);
    expect(hrefs).toContain(`/backgrounds/bg_game_morning.webp?v=${ASSET_VERSION}`);
    expect(hrefs).toContain(`/backgrounds/bg_game_day.webp?v=${ASSET_VERSION}`);
    expect(hrefs).toContain(`/backgrounds/bg_game_night.webp?v=${ASSET_VERSION}`);
    expect(hrefs).toContain(ghostSrc().src);
    expect(hrefs).toHaveLength(17);
    expect(rolePreloadList()).toEqual(rolePreloadList());
  });

  it("해질녘 배경은 입장·역할 미리 받기 목록에 없다 (낮 토론 진입 때 따로 받는다), verdictDusk 는 어디에도 없다", () => {
    const hrefs = [...entryPreloadList(), ...rolePreloadList()].map((item) => item.href);
    expect(hrefs).not.toContain(backdropUrl("game", "dusk"));
    expect(hrefs).not.toContain(backdropUrl("game", "verdictDusk"));
    expect(hrefs.filter((h) => h.endsWith(".svg") && h.startsWith("/backgrounds/"))).toEqual([]);
  });

  it("해질녘 목록: dusk 배경 하나뿐이고 인자가 없어 매번 같다 (역할·인원과 무관, T-04-42)", () => {
    expect(duskPreloadList()).toEqual([{ href: backdropUrl("game", "dusk") }]);
    expect(duskPreloadList()).toEqual(duskPreloadList());
    expect(duskPreloadList.length).toBe(0);
    expect(preloadDuskAssets.length).toBe(0);
  });

  it("역할 화면 목록은 역할과 무관한 한 목록이고 일지 SVG 아홉 개가 들어 있다 (T-03.1-18)", () => {
    const hrefs = rolePreloadList().map((item) => item.href);
    const journals = hrefs.filter((href) => href.startsWith("/journals/"));
    expect(journals).toHaveLength(9);
    for (const role of JOURNAL_ROLES) for (const slot of JOURNAL_SLOTS) expect(journals).toContain(journalArt(role, slot).src);
  });

  describe("react-dom preload 호출", () => {
    beforeEach(() => vi.mocked(preload).mockClear());

    it("목록 항목마다 as: image 로 미리 받는다", () => {
      preloadEntryAssets();
      expect(preload).toHaveBeenCalledTimes(10);
      for (const item of entryPreloadList()) {
        const expected = item.imageSrcSet ? { as: "image", imageSrcSet: item.imageSrcSet } : { as: "image" };
        expect(preload).toHaveBeenCalledWith(item.href, expected);
      }
      vi.mocked(preload).mockClear();
      preloadRoleAssets();
      expect(preload).toHaveBeenCalledTimes(17);
      vi.mocked(preload).mockClear();
      preloadDuskAssets();
      expect(preload).toHaveBeenCalledTimes(1);
      expect(preload).toHaveBeenCalledWith(backdropUrl("game", "dusk"), { as: "image" });
    });
  });
});

describe("실제 파일과의 일치", () => {
  it("이 모듈이 만드는 모든 그림 URL 이 public/ 의 실제 파일을 가리킨다", () => {
    const urls: string[] = [];
    for (let seat = 0; seat < FIGURE_IDS.length; seat++) {
      const fig = figureSrc(seat);
      urls.push(fig.src, ...urlsOfSrcSet(fig.srcSet));
    }
    for (const role of ROLE_IDS) {
      const art = roleArtSrc(role);
      urls.push(art.src, ...urlsOfSrcSet(art.srcSet));
    }
    for (const scene of SCENE_IDS) urls.push(backdropUrl("game", scene));
    urls.push(backdropUrl("entry", "lobby"));
    for (const item of [...entryPreloadList(), ...rolePreloadList(), ...duskPreloadList()]) {
      urls.push(item.href);
      if (item.imageSrcSet) urls.push(...urlsOfSrcSet(item.imageSrcSet));
    }

    // 일지 SVG(/journals/)의 실제 파일 존재는 journalAssets.test.ts 가 확인한다(03.1-06 Task 2).
    const nonJournal = urls.filter((url) => !url.startsWith("/journals/"));
    expect(nonJournal.length).toBeGreaterThan(30);
    for (const url of nonJournal) {
      const path = decodeURIComponent(url.split("?")[0]!);
      const files = path.startsWith("/backgrounds/") ? backdropFiles : characterFiles;
      expect(files.has(`/public${path}`), `${url} → /public${path}`).toBe(true);
    }
  });

  it("어떤 URL 에도 @ 문자가 없다", () => {
    const urls: string[] = [];
    for (let seat = 0; seat < FIGURE_IDS.length; seat++) urls.push(figureSrc(seat).src, figureSrc(seat).srcSet);
    for (const role of ROLE_IDS) urls.push(roleArtSrc(role).src, roleArtSrc(role).srcSet);
    for (const item of [...entryPreloadList(), ...rolePreloadList()]) urls.push(item.href, item.imageSrcSet ?? "");
    expect(urls.filter((url) => url.includes("%40")).length).toBeGreaterThan(20);
    expect(urls.some((url) => url.includes("@"))).toBe(false);
  });
});
