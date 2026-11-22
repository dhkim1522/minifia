import { ANIMAL_IDS } from "../../shared/game/animals";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROLE_IDS } from "../../shared/game/roles";
import { MAX_PLAYERS, OUTFIT_IDS } from "../../shared/protocol";
import { SCENE_IDS } from "../../src/game/scenes";

vi.mock("react-dom", () => ({ preload: vi.fn() }));

import { preload } from "react-dom";
import {
  FIGURE_IDS,
  ASSET_VERSION,
  ENTRY_ART_VERSION,
  backdropUrl,
  duskPreloadList,
  entryPreloadList,
  animalFaceSrc,
  animalFigureSrc,
  animalRoleArtSrc,
  faceSrc,
  figureSrc,
  journalArt,
  outfitCardSrc,
  participantPortraitSrc,
  preloadEntryAssets,
  preloadDuskAssets,
  preloadRoleAssets,
  roleArtSrc,
  rolePreloadList,
  seatColorVar,
  stationeryArt,
} from "../../src/net/assets";

// node:fs 대신 Vite 의 import.meta.glob 으로 public/ 의 실제 파일 목록을 얻는다.
const characterFiles = new Set(Object.keys(import.meta.glob("/public/characters/**/*.png")));
const backdropFiles = new Set(Object.keys(import.meta.glob("/public/backgrounds/*.webp")));
const stationeryFiles = new Set(Object.keys(import.meta.glob("/public/stationery/*.webp")));


/** srcSet "a 2x, b 4x" 에서 URL 만 뽑는다. */
function urlsOfSrcSet(srcSet: string): string[] {
  return srcSet.split(",").map((part) => part.trim().split(/\s+/)[0]!);
}

describe("그림 URL 헬퍼", () => {
  it("인물: src 는 @2x, srcSet 은 파일 폭 ÷ 표시 폭(72px 표시라 2x·4x), @ 는 %40", () => {
    expect(figureSrc(0).src).toBe(`/characters/table/fig1_boy_brown_default%402x.png?v=${ASSET_VERSION}`);
    expect(figureSrc(7).srcSet).toBe(
      `/characters/table/fig8_girl_tanhat_default%402x.png?v=${ASSET_VERSION} 2x, /characters/table/fig8_girl_tanhat_default%404x.png?v=${ASSET_VERSION} 4x`,
    );
  });

  it("인물: 자리 번호는 8로 나눈 나머지를 쓴다(음수도)", () => {
    expect(figureSrc(9).src).toContain("fig2_boy_black");
    expect(figureSrc(9)).toEqual(figureSrc(1));
    expect(figureSrc(-1).src).toContain("fig8_girl_tanhat");
    expect(figureSrc(-1)).toEqual(figureSrc(7));
  });

  it("seatColorVar: 좌석 0~7 → var(--seat-1)~var(--seat-8), 범위 밖은 8칸 돌려 쓴다 (WR-02)", () => {
    expect(seatColorVar(0)).toBe("var(--seat-1)");
    expect(seatColorVar(7)).toBe("var(--seat-8)");
    expect(seatColorVar(8)).toBe("var(--seat-1)");
    expect(seatColorVar(-1)).toBe("var(--seat-8)");
  });

  it("얼굴: /characters/faces/face-{seat % 8}.png (09-05, NIGHT-09)", () => {
    expect(faceSrc(0)).toBe(`/characters/faces/face-0.png?v=${ASSET_VERSION}`);
    expect(faceSrc(9)).toBe(`/characters/faces/face-1.png?v=${ASSET_VERSION}`);
    expect(faceSrc(-1)).toBe(`/characters/faces/face-7.png?v=${ASSET_VERSION}`);
    for (let seat = 0; seat < 8; seat++) {
      expect(characterFiles.has(`/public${faceSrc(seat).split("?")[0]}`), `public 에 ${faceSrc(seat)} 파일`).toBe(true);
    }
  });

  it("직업 그림: src 는 @2x, srcSet 은 150px 표시라 1x·2x", () => {
    const art = roleArtSrc("mafia");
    expect(art.src).toBe(`/characters/roles/mafia_default%402x.png?v=${ASSET_VERSION}`);
    expect(art.srcSet).toBe(`/characters/roles/mafia_default%402x.png?v=${ASSET_VERSION} 1x, /characters/roles/mafia_default%404x.png?v=${ASSET_VERSION} 2x`);
  });

  it("12종의 공개 얼굴·전신과 본인 동물의 모든 역할 그림을 제공한다", () => {
    for (const animal of ANIMAL_IDS) {
      const roleUrls = ROLE_IDS.map((role) => animalRoleArtSrc(animal, role));
      const urls = [
        animalFaceSrc(animal),
        ...urlsOfSrcSet(animalFigureSrc(animal).srcSet),
        ...roleUrls.flatMap(({ srcSet }) => urlsOfSrcSet(srcSet)),
      ];
      for (const url of urls) {
        const path = url.split("?")[0];
        expect(characterFiles.has(`/public${path}`), url).toBe(true);
      }
      const preloads = rolePreloadList(animal).map(({ href }) => href);
      for (const art of roleUrls) expect(preloads).toContain(art.src);
      expect(roleUrls.map(({ src }) => src)).toHaveLength(new Set(roleUrls.map(({ src }) => src)).size);
    }
  });

  it("경찰 역할 카드 그림은 두 해상도 모두 파란 제복을 보여 준다", async () => {
    const files = urlsOfSrcSet(roleArtSrc("police").srcSet);
    for (const [i, url] of files.entries()) {
      const file = `public${decodeURIComponent(url.split("?")[0]!)}`;
      const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      expect([info.width, info.height]).toEqual([144 * (i + 1), 192 * (i + 1)]);
      let visible = 0;
      let blue = 0;
      for (let p = 0; p < data.length; p += info.channels) {
        if (data[p + 3]! < 220) continue;
        visible++;
        if (data[p + 2]! - data[p]! > 25 && data[p + 2]! - data[p + 1]! > 10) blue++;
      }
      expect(blue / visible, file).toBeGreaterThan(0.25);
    }
  });

  it("배경: /backgrounds/bg_{layout}_{장면 파일 조각}.webp?v=버전", () => {
    expect(backdropUrl("game", "day")).toBe(`/backgrounds/bg_game_day.webp?v=${ASSET_VERSION}`);
    expect(backdropUrl("game", "night")).toBe(`/backgrounds/bg_game_night.webp?v=${ASSET_VERSION}`);
    expect(backdropUrl("game", "verdictDusk")).toBe(`/backgrounds/bg_game_verdict_dusk.webp?v=${ASSET_VERSION}`);
    expect(backdropUrl("entry", "lobby")).toBe(`/backgrounds/noir-entry.webp?v=${ENTRY_ART_VERSION}`);
  });

  it("배경: entry 구도는 lobby 장면만 받는다 (타입)", () => {
    // @ts-expect-error -- entry 구도에는 lobby 가 아닌 장면이 없다
    backdropUrl("entry", "night");
  });
});

const JOURNAL_ROLES = ["police", "mafia", "doctor"] as const;
const JOURNAL_SLOTS = ["cover", "page", "icon"] as const;

describe("일지 그림 슬롯", () => {
  it("일지 표지는 역할마다 다르고 속지 재질은 공유하며 아이콘은 SVG를 유지한다", () => {
    expect(journalArt("police", "icon")).toEqual({ src: `/journals/journal_police_icon.svg?v=${ASSET_VERSION}` });
    expect(journalArt("mafia", "cover").src).toBe(stationeryArt("journal-mafia"));
    for (const role of JOURNAL_ROLES) expect(journalArt(role, "page").src).toBe(stationeryArt("paper"));
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
  it("입장 화면 목록: 입장·대기실 배경(WebP)", () => {
    const hrefs = entryPreloadList().map((item) => item.href);
    expect(hrefs).toContain(`/backgrounds/noir-entry.webp?v=${ENTRY_ART_VERSION}`);
    expect(hrefs).toContain(`/backgrounds/bg_game_lobby.webp?v=${ASSET_VERSION}`);
    expect(hrefs.some((h) => h.endsWith(".svg"))).toBe(false);
    expect(hrefs).toHaveLength(2);
  });

  it("역할 화면 목록: 직업 그림 4종 전부와 아침·낮·밤 배경(역할과 무관하게 같은 목록)", () => {
    const hrefs = rolePreloadList().map((item) => item.href);
    for (const role of ROLE_IDS) expect(hrefs).toContain(roleArtSrc(role).src);
    expect(hrefs).toContain(`/backgrounds/bg_game_morning.webp?v=${ASSET_VERSION}`);
    expect(hrefs).toContain(`/backgrounds/bg_game_day.webp?v=${ASSET_VERSION}`);
    expect(hrefs).toContain(`/backgrounds/bg_game_night.webp?v=${ASSET_VERSION}`);
    expect(hrefs).toHaveLength(19);
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

  it("역할 화면에서 일지와 종이 소품을 역할과 무관하게 함께 받는다 (T-03.1-18)", () => {
    const hrefs = rolePreloadList().map((item) => item.href);
    for (const role of JOURNAL_ROLES) for (const slot of JOURNAL_SLOTS) expect(hrefs).toContain(journalArt(role, slot).src);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs.filter((href) => href.startsWith("/stationery/"))).toHaveLength(stationeryFiles.size);
    const css = readFileSync("src/styles/base.css", "utf8");
    for (const asset of ["role-front", "role-back", "paper", "will-paper", "note"] as const) {
      const href = stationeryArt(asset);
      expect(hrefs).toContain(href);
      expect(css).toContain(`--stationery-${asset}: url("${href}")`);
    }
    expect(hrefs).toContain(stationeryArt("seal"));
    expect(entryPreloadList().some(({ href }) => href.startsWith("/stationery/"))).toBe(false);
  });

  describe("react-dom preload 호출", () => {
    beforeEach(() => vi.mocked(preload).mockClear());

    it("목록 항목마다 as: image 로 미리 받는다", () => {
      preloadEntryAssets();
      expect(preload).toHaveBeenCalledTimes(2);
      for (const item of entryPreloadList()) {
        const expected = item.imageSrcSet ? { as: "image", imageSrcSet: item.imageSrcSet } : { as: "image" };
        expect(preload).toHaveBeenCalledWith(item.href, expected);
      }
      vi.mocked(preload).mockClear();
      preloadRoleAssets();
      expect(preload).toHaveBeenCalledTimes(rolePreloadList().length);
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
      urls.push(faceSrc(seat), fig.src, ...urlsOfSrcSet(fig.srcSet));
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
      const files = path.startsWith("/stationery/") ? stationeryFiles
        : path.startsWith("/backgrounds/") ? backdropFiles
        : characterFiles;
      expect(files.has(`/public${path}`), `${url} → /public${path}`).toBe(true);
    }
  });

  it("좌석마다 얼굴·전신 PNG의 픽셀이 다르고 표시 규격을 지킨다", async () => {
    expect(FIGURE_IDS).toHaveLength(MAX_PLAYERS);
    const faces = new Set<string>();
    const figures2x = new Set<string>();
    const figures4x = new Set<string>();
    const files = FIGURE_IDS.flatMap((_, seat) => {
      const [body2x, body4x] = urlsOfSrcSet(figureSrc(seat).srcSet);
      return [
        { url: faceSrc(seat), width: 200, height: 200, group: faces },
        { url: body2x!, width: 144, height: 192, group: figures2x },
        { url: body4x!, width: 288, height: 384, group: figures4x },
      ];
    });
    await Promise.all(files.map(async ({ url, width, height, group }) => {
      const path = decodeURIComponent(url.split("?")[0]!);
      const file = readFileSync(`public${path}`);
      expect(file.subarray(0, 8).toString("hex"), path).toBe("89504e470d0a1a0a");
      const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      expect([info.width, info.height], path).toEqual([width, height]);
      const hash = createHash("sha256").update(data).digest("hex");
      expect(group.has(hash), `${path} 이미지 중복`).toBe(false);
      group.add(hash);
    }));
  });

  it("홈 아이콘과 공유 그림도 최신 그림 캐시 버전을 쓴다", () => {
    expect(ASSET_VERSION).not.toBe("noir-2");
    const html = readFileSync("index.html", "utf8");
    for (const icon of ["favicon.svg", "favicon-32.png", "apple-touch-icon.png"]) {
      expect(html).toContain(`/${icon}?v=${ASSET_VERSION}`);
    }
    expect(html).toContain(`/og.png?v=${ENTRY_ART_VERSION}`);
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

// 옷장 카드에서는 현재 동물의 실제 의상 렌더를 읽는다.
describe("outfitCardSrc (10-07)", () => {
  const outfitFiles = new Set(Object.keys(import.meta.glob("/public/outfits/*.png")));

  it("/outfits/outfit-{id}.png?v={ASSET_VERSION} 모양이다", () => {
    expect(outfitCardSrc("coat")).toBe(`/outfits/outfit-coat.png?v=${ASSET_VERSION}`);
    expect(outfitCardSrc("noir")).toBe(`/outfits/outfit-noir.png?v=${ASSET_VERSION}`);
  });

  it("참가자 상반신은 공개 동물과 의상 그림을 쓰고 동물이 없는 좌석의 인물도 표시한다", () => {
    expect(participantPortraitSrc(2, "rabbit", "hood")).toBe(outfitCardSrc("hood", "rabbit"));
    expect(participantPortraitSrc(2, "rabbit")).toBe(animalFigureSrc("rabbit").src);
    expect(participantPortraitSrc(2)).toBe(figureSrc(2).src);
  });

  it("동물 12종의 아홉 의상에 같은 동물의 실제 렌더 파일이 있다", () => {
    for (const animal of ANIMAL_IDS) {
      for (const outfit of OUTFIT_IDS) {
        const form = outfit === "coat" ? "figure" : outfit;
        const path = `/characters/animals/${animal}/${form}-sm.png`;
        expect(outfitCardSrc(outfit, animal)).toBe(`${path}?v=${ASSET_VERSION}`);
        expect(characterFiles.has(`/public${path}`), path).toBe(true);
      }
    }
  });

  it("ASSET_VERSION 은 i3 에서 올라갔다", () => {
    expect(ASSET_VERSION).not.toBe("i3");
  });

  it("의상 id 아홉 개 모두 public/outfits 에 실제 파일이 있고 그 밖의 파일은 없다", () => {
    for (const id of OUTFIT_IDS) {
      const path = `public/outfits/outfit-${id}.png`;
      expect(outfitFiles.has(`/${path}`), id).toBe(true);
      const png = readFileSync(path);
      expect([png.readUInt32BE(16), png.readUInt32BE(20)], id).toEqual([144, 192]);
    }
    expect(outfitFiles.size).toBe(OUTFIT_IDS.length);
  });

  it("public/_headers 에 /outfits/* 1일 캐시 규칙이 있다", () => {
    expect(readFileSync("public/_headers", "utf8")).toMatch(/^\/outfits\/\*\s*\n\s+Cache-Control: public, max-age=86400/m);
  });
});

// 맵 카드 두 장(560×320). 두 맵 모두 B안의 실제 렌더.
describe("이전 맵 카드 렌더 자산", () => {
  const mapFiles = new Set(Object.keys(import.meta.glob("/public/maps/*.png")));

  it("재즈 바와 광장이 각각 560×320 PNG다", () => {
    expect(mapFiles.size).toBe(2);
    for (const id of ["bar", "plaza"]) {
      expect(mapFiles.has(`/public/maps/map-${id}.png`), id).toBe(true);
      const file = readFileSync(`public/maps/map-${id}.png`);
      expect(file.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
      expect([file.readUInt32BE(16), file.readUInt32BE(20)]).toEqual([560, 320]);
    }
  });

  it("public/_headers 에 /maps/* 1일 캐시 규칙이 있고 규칙은 100개 아래다", () => {
    const headers = readFileSync("public/_headers", "utf8");
    expect(headers).toMatch(/^\/maps\/\*\s*\n\s+Cache-Control: public, max-age=86400/m);
    expect(headers.split("\n").filter((l) => /^\//.test(l)).length).toBeLessThan(100);
  });
});
