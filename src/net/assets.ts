// 그림 URL 의 단일 출처. 그림 경로를 화면마다 문자열로 흩뿌리지 않는다.
// 파일 이름의 @ 는 URL 에서 %40 으로 쓴다(정적 에셋 서빙이 @ 를 307 리다이렉트한다).
import { preload } from "react-dom";
import { ROLE_IDS } from "../../shared/game/roles";
import type { RoleId } from "../../shared/game/roles";
import type { MapId, OutfitId } from "../../shared/protocol";
import { SCENES } from "../game/scenes";
import type { SceneId } from "../game/scenes";

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
/** entry(입구) 구도 그림은 lobby 장면 하나뿐이다. */
export type EntryScene = "lobby";
export type PreloadItem = { href: string; imageSrcSet?: string };

/**
 * 배경·유령 그림 주소 끝에 붙이는 값. 파일 이름이 같아도 그림을 바꾼 배포가 바로 보이게 한다
 * (정적 그림 캐시가 max-age 1일이라 같은 주소는 하루 동안 옛 그림이 나온다). 그림을 바꾸면 값을 바꾼다.
 */
export const ASSET_VERSION = "i5";

// 파일 이름의 @ 는 URL 에서 %40 으로 쓴다. 유령 그림은 바꾼 적이 있어 버전 값을 붙인다.
function png(dir: "table" | "roles" | "ghost", id: string, scale: 2 | 4): string {
  const v = dir === "ghost" ? `?v=${ASSET_VERSION}` : "";
  return `/characters/${dir}/${id}_default%40${scale}x.png${v}`;
}

// 인물은 72px 로 표시한다. 밀도 기술자는 파일 폭 ÷ 표시 폭이라 @2x 파일은 2x, @4x 파일은 4x 다.
// 2배 화면이 @4x 를 받지 않는다. src 는 @2x.
export function figureSrc(seat: number): { src: string; srcSet: string } {
  const id = FIGURE_IDS[((seat % FIGURE_IDS.length) + FIGURE_IDS.length) % FIGURE_IDS.length]!;
  return { src: png("table", id, 2), srcSet: `${png("table", id, 2)} 2x, ${png("table", id, 4)} 4x` };
}

// 경찰·의사 얼굴 목록의 얼굴 그림(9페이즈 NIGHT-09). 좌석 번호 → face-0~7 (design/v2.0/design-system/assets/Faces 의 복사본).
// 10페이즈가 각자의 의상 얼굴로 바꾼다.
export function faceSrc(seat: number): string {
  return `/characters/faces/face-${((seat % 8) + 8) % 8}.png`;
}

// 자리 구분색 --seat-1~8 (WR-02). 좌석 0~7 → 1~8 이라 faceSrc 와 같은 정규화에 +1 을 한다.
export function seatColorVar(seat: number): string {
  return `var(--seat-${(((seat % 8) + 8) % 8) + 1})`;
}

// 탈락한 사람의 자리에 인물 대신 쓰는 유령 그림(ASSET_SPEC §6, 결정 0021). 좌석별 유형 없음. 72px 표시 기준 밀도.
export function ghostSrc(): { src: string; srcSet: string } {
  return { src: png("ghost", "ghost", 2), srcSet: `${png("ghost", "ghost", 2)} 2x, ${png("ghost", "ghost", 4)} 4x` };
}

// 3D 장면의 유령 그림 스프라이트 텍스처 주소(0083-2). 4x 한 장을 모든 탈락자가 함께 쓴다. 입장 때 미리 받는 목록(ghostSrc)과 같은 파일이다.
export function ghostSpriteSrc(): string {
  return png("ghost", "ghost", 4);
}

// 로비 꾸미기 카드 그림(10-07, 승인 디자인 시스템 사본 아홉 장). 표시 64×80, 파일 240×300 이라 한 장으로 충분하다. 인물별 그림은 만들지 않는다(O-3).
export function outfitCardSrc(id: OutfitId): string {
  return `/outfits/outfit-${id}.png?v=${ASSET_VERSION}`;
}

// 꾸미기 시트 맵 탭의 카드 그림(11-13, 승인 디자인 시스템 사본 두 장 560×320). 표시 80×80 cover. 랜덤 카드는 그림 없이 shuffle 아이콘이다. 외부 주소 없음(O-8).
export function mapCardSrc(id: MapId): string {
  return `/maps/map-${id}.png?v=${ASSET_VERSION}`;
}

// 직업 그림은 150px 로 표시한다. @2x 파일은 1x, @4x 파일은 2x. 역할을 보낼 수 있는 화면에서만 쓴다.
export function roleArtSrc(role: RoleId): { src: string; srcSet: string } {
  return { src: png("roles", role, 2), srcSet: `${png("roles", role, 2)} 1x, ${png("roles", role, 4)} 2x` };
}

export type JournalRole = "police" | "mafia" | "doctor";
export type JournalSlot = "cover" | "page" | "icon";

const JOURNAL_ROLES: readonly JournalRole[] = ["police", "mafia", "doctor"];
const JOURNAL_SLOTS: readonly JournalSlot[] = ["cover", "page", "icon"];

// 일지 그림은 이 함수로만 가져온다. 래스터로 바뀌면 여기서 srcSet 만 더한다(규칙 `<id>_<상태>@2x.png`).
// SVG 는 해상도와 무관해서 지금은 srcSet 이 없다.
export function journalArt(role: JournalRole, slot: JournalSlot): { src: string; srcSet?: string } {
  return { src: `/journals/journal_${role}_${slot}.svg` };
}

/** 배경 그림 주소의 단일 출처: /backgrounds/bg_{layout}_{장면 파일 조각}.webp?v=버전. 장면 목록은 src/game/scenes.ts. */
export function backdropUrl(layout: "entry", scene: EntryScene): string;
export function backdropUrl(layout: "game", scene: SceneId): string;
export function backdropUrl(layout: BackdropLayout, scene: SceneId): string {
  return `/backgrounds/bg_${layout}_${SCENES[scene].file}.webp?v=${ASSET_VERSION}`;
}

/** 입장 화면에서 미리 받는다: 입장·대기실 배경(WebP 약 99KB), 인물 8종(대기실 첫 그림이 비어 보이지 않게). */
export function entryPreloadList(): PreloadItem[] {
  const figures = FIGURE_IDS.map((_, seat) => {
    const { src, srcSet } = figureSrc(seat);
    return { href: src, imageSrcSet: srcSet };
  });
  return [{ href: backdropUrl("entry", "lobby") }, { href: backdropUrl("game", "lobby") }, ...figures];
}

/**
 * 대기실·배정 동안 미리 받는다: 직업 그림 4종 전부와 아침·낮·밤 배경(WebP 약 74KB), 유령 그림(탈락 순간 깜빡임 방지), 일지 SVG 9종.
 * 해질녘 배경은 낮 토론 진입 때 따로 받는다(duskPreloadList).
 * 어떤 역할이든 같은 목록 — 요청 패턴으로 역할이 드러나지 않는다(Pitfall 20).
 */
export function rolePreloadList(): PreloadItem[] {
  const arts = ROLE_IDS.map((role) => {
    const { src, srcSet } = roleArtSrc(role);
    return { href: src, imageSrcSet: srcSet };
  });
  const ghost = ghostSrc();
  // 일지 그림 아홉 개도 역할과 무관하게 모두 받는다(요청 패턴으로 역할이 드러나지 않게, T-03.1-18).
  const journals = JOURNAL_ROLES.flatMap((role) => JOURNAL_SLOTS.map((slot) => ({ href: journalArt(role, slot).src })));
  return [
    ...arts,
    { href: backdropUrl("game", "morning") },
    { href: backdropUrl("game", "day") },
    { href: backdropUrl("game", "night") },
    { href: ghost.src, imageSrcSet: ghost.srcSet },
    ...journals,
  ];
}

/**
 * 낮 토론 진입 때 미리 받는다: 해질녘 배경 하나(WebP 약 25KB, P-17). 투표·공개·변론·처형 다섯 단계가 이 한 장을 쓴다.
 * 처음 쓰일 때 불러오면 1.2초 상한(SCENE_IMAGE_WAIT_MS) 안에 크로스페이드가 늦을 수 있어 낮 토론 진입 때 하나를 미리 받는다.
 * 인자가 없는 고정 목록이다 — 어떤 역할이든 같은 요청이라 요청 패턴으로 역할이 드러나지 않는다(Pitfall 20, T-04-42).
 */
export function duskPreloadList(): PreloadItem[] {
  return [{ href: backdropUrl("game", "dusk") }];
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

export function preloadDuskAssets(): void {
  preloadImages(duskPreloadList());
}
