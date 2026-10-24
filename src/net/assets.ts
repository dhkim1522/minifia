// 그림 URL 의 단일 출처. 그림 경로를 화면마다 문자열로 흩뿌리지 않는다.
// 파일 이름의 @ 는 URL 에서 %40 으로 쓴다(정적 에셋 서빙이 @ 를 307 리다이렉트한다).
import { preload } from "react-dom";
import { ROLE_IDS } from "../../shared/game/roles";
import type { RoleId } from "../../shared/game/roles";

// design/design-system/components/bundle.js 의 FIGURE_IDS 와 같다. 자리 번호 → 인물.
export const FIGURE_IDS = [
  "fig1_boy_brown",
  "fig2_boy_black",
  "fig3_boy_blonde",
  "fig4_girl_brown",
  "fig5_girl_black",
  "fig6_girl_auburn",
  "fig7_boy_blackhat",
  "fig8_girl_tanhat",
] as const;

export type BackdropLayout = "entry" | "game";
export type BackdropVariant = "lobby" | "night" | "day" | "verdict";
export type PreloadItem = { href: string; imageSrcSet?: string };

// 파일 이름의 @ 는 URL 에서 %40 으로 쓴다.
function png(dir: "table" | "roles" | "ghost", id: string, scale: 2 | 4): string {
  return `/characters/${dir}/${id}_default%40${scale}x.png`;
}

// 인물은 72px 로 표시한다. 밀도 기술자는 파일 폭 ÷ 표시 폭이라 @2x 파일은 2x, @4x 파일은 4x 다.
// 2배 화면이 @4x 를 받지 않는다. src 는 @2x.
export function figureSrc(seat: number): { src: string; srcSet: string } {
  const id = FIGURE_IDS[((seat % FIGURE_IDS.length) + FIGURE_IDS.length) % FIGURE_IDS.length]!;
  return { src: png("table", id, 2), srcSet: `${png("table", id, 2)} 2x, ${png("table", id, 4)} 4x` };
}

// 탈락한 사람의 자리에 인물 대신 쓰는 유령 그림(ASSET_SPEC §6, 결정 0021). 좌석별 유형 없음. 72px 표시 기준 밀도.
export function ghostSrc(): { src: string; srcSet: string } {
  return { src: png("ghost", "ghost", 2), srcSet: `${png("ghost", "ghost", 2)} 2x, ${png("ghost", "ghost", 4)} 4x` };
}

// 직업 그림은 150px 로 표시한다. @2x 파일은 1x, @4x 파일은 2x. 역할을 보낼 수 있는 화면에서만 쓴다.
export function roleArtSrc(role: RoleId): { src: string; srcSet: string } {
  return { src: png("roles", role, 2), srcSet: `${png("roles", role, 2)} 1x, ${png("roles", role, 4)} 2x` };
}

export function backdropUrl(layout: BackdropLayout, variant: BackdropVariant): string {
  return `/backgrounds/bg_${layout}_${variant}.svg`;
}

/** 입장 화면에서 미리 받는다: 입장·대기실 배경, 인물 8종(대기실 첫 그림이 비어 보이지 않게). */
export function entryPreloadList(): PreloadItem[] {
  const figures = FIGURE_IDS.map((_, seat) => {
    const { src, srcSet } = figureSrc(seat);
    return { href: src, imageSrcSet: srcSet };
  });
  return [{ href: backdropUrl("entry", "lobby") }, { href: backdropUrl("game", "lobby") }, ...figures];
}

/**
 * 대기실·배정 동안 미리 받는다: 직업 그림 4종 전부와 낮 배경.
 * 어떤 역할인지와 무관하게 같은 목록이라 요청 패턴으로 역할이 드러나지 않는다.
 */
export function rolePreloadList(): PreloadItem[] {
  const arts = ROLE_IDS.map((role) => {
    const { src, srcSet } = roleArtSrc(role);
    return { href: src, imageSrcSet: srcSet };
  });
  return [...arts, { href: backdropUrl("game", "day") }];
}

function preloadImages(list: PreloadItem[]): void {
  for (const item of list) {
    if (item.imageSrcSet) preload(item.href, { as: "image", imageSrcSet: item.imageSrcSet });
    else preload(item.href, { as: "image" });
  }
}

// react-dom preload: 같은 href 중복 호출은 한 번과 같다.
export function preloadEntryAssets(): void {
  preloadImages(entryPreloadList());
}

export function preloadRoleAssets(): void {
  preloadImages(rolePreloadList());
}
