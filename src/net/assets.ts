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
