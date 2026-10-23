// 그림 URL 의 단일 출처. 그림 경로를 화면마다 문자열로 흩뿌리지 않는다.
// 파일 이름의 @ 는 URL 에서 %40 으로 쓴다(정적 에셋 서빙이 @ 를 307 리다이렉트한다).

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

export function backdropUrl(layout: BackdropLayout, variant: BackdropVariant): string {
  return `/backgrounds/bg_${layout}_${variant}.svg`;
}

// RED 단계의 뼈대: 테스트가 로드되어 단언에서 실패하도록 빈 값을 돌려준다. GREEN 에서 채운다.
export type PreloadItem = { href: string; imageSrcSet?: string };
export function figureSrc(_seat: number): { src: string; srcSet: string } {
  return { src: "", srcSet: "" };
}
export function roleArtSrc(_role: "mafia" | "police" | "doctor" | "citizen"): { src: string; srcSet: string } {
  return { src: "", srcSet: "" };
}
export function entryPreloadList(): PreloadItem[] {
  return [];
}
export function rolePreloadList(): PreloadItem[] {
  return [];
}
export function preloadEntryAssets(): void {}
export function preloadRoleAssets(): void {}
