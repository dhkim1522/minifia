import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROLE_IDS } from "../../shared/game/roles";

vi.mock("react-dom", () => ({ preload: vi.fn() }));

import { preload } from "react-dom";
import {
  FIGURE_IDS,
  backdropUrl,
  entryPreloadList,
  figureSrc,
  preloadEntryAssets,
  preloadRoleAssets,
  roleArtSrc,
  rolePreloadList,
} from "../../src/net/assets";

// node:fs 대신 Vite 의 import.meta.glob 으로 public/ 의 실제 파일 목록을 얻는다.
const characterFiles = new Set(Object.keys(import.meta.glob("/public/characters/**/*.png")));
const backdropFiles = new Set(Object.keys(import.meta.glob("/public/backgrounds/*.svg")));

const LAYOUTS = ["entry", "game"] as const;
const VARIANTS = ["lobby", "night", "day", "verdict"] as const;

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

  it("직업 그림: src 는 @2x, srcSet 은 150px 표시라 1x·2x", () => {
    const art = roleArtSrc("mafia");
    expect(art.src).toBe("/characters/roles/mafia_default%402x.png");
    expect(art.srcSet).toBe("/characters/roles/mafia_default%402x.png 1x, /characters/roles/mafia_default%404x.png 2x");
  });

  it("배경: /backgrounds/bg_{layout}_{variant}.svg", () => {
    expect(backdropUrl("game", "day")).toBe("/backgrounds/bg_game_day.svg");
    expect(backdropUrl("entry", "lobby")).toBe("/backgrounds/bg_entry_lobby.svg");
  });
});

describe("미리 받기 목록", () => {
  it("입장 화면 목록: 입장·대기실 배경과 인물 8종", () => {
    const hrefs = entryPreloadList().map((item) => item.href);
    expect(hrefs).toContain("/backgrounds/bg_entry_lobby.svg");
    expect(hrefs).toContain("/backgrounds/bg_game_lobby.svg");
    for (let seat = 0; seat < FIGURE_IDS.length; seat++) expect(hrefs).toContain(figureSrc(seat).src);
    expect(hrefs).toHaveLength(10);
  });

  it("역할 화면 목록: 직업 그림 4종 전부와 낮 배경(역할과 무관하게 같은 목록)", () => {
    const hrefs = rolePreloadList().map((item) => item.href);
    for (const role of ROLE_IDS) expect(hrefs).toContain(roleArtSrc(role).src);
    expect(hrefs).toContain("/backgrounds/bg_game_day.svg");
    expect(hrefs).toHaveLength(5);
    expect(rolePreloadList()).toEqual(rolePreloadList());
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
      expect(preload).toHaveBeenCalledTimes(5);
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
    for (const layout of LAYOUTS) for (const variant of VARIANTS) urls.push(backdropUrl(layout, variant));
    for (const item of [...entryPreloadList(), ...rolePreloadList()]) {
      urls.push(item.href);
      if (item.imageSrcSet) urls.push(...urlsOfSrcSet(item.imageSrcSet));
    }

    expect(urls.length).toBeGreaterThan(30);
    for (const url of urls) {
      const path = decodeURIComponent(url);
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
