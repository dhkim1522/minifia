// 3D 색 상수. 재질에만 쓴다 — 화면 CSS 에는 이 상수를 쓰지 않는다(CSS 색은 src/styles/tokens.css 의 토큰이 원천).
// 달빛 누아르 시안의 월넛·청색 그림자·황동 팔레트.
import type { LightingPhase } from "./renderer";

/**
 * design/tokens.json 의 토큰과 같은 값을 쓰는 4색. 값이 갈라지지 않게 palette.test.ts 가 토큰 파일과 대조한다.
 * 이름 대응: ring = gray-50, ringOutline = night-950, lamp = light-lamp, moon = light-moon.
 */
export const TOKEN_COLORS = {
  /** gray-50: 목적지 링·손짓 링 */
  ring: "#f1f2f5",
  /** night-950: 링 윤곽 */
  ringOutline: "#0a0e1c",
  /** light-lamp: 실내등·촛불·벽등·펜던트 전구의 따뜻한 빛 */
  lamp: "#ffcf8a",
  /** light-moon: 달빛 방향광 */
  moon: "#c9d4ff",
} as const;

/**
 * 좌석 0~7 의 색 = design/tokens.json 의 seat-1..8 복사(24-04, D-28). "의심" 종이의 틴트 원천이다.
 * 값이 갈라지지 않게 palette.test.ts 가 토큰 파일과 대조한다(gen-tokens --check 는 이 파일을 보지 않는다).
 */
export const SEAT_COLORS = ["#7a8fb8", "#8e7ab8", "#6fa59a", "#b89a6f", "#6f8fa8", "#9aa86f", "#b87a5c", "#a9aebb"] as const;

/** "의심" 종이 그림 색: 바탕 = gray-50, 손글씨·밑줄 = night-950 (새 hex 없음 — TOKEN_COLORS 를 가리킨다) */
export const NOTE_COLORS = {
  paper: TOKEN_COLORS.ring,
  ink: TOKEN_COLORS.ringOutline,
  edge: "#ad936f",
} as const;

export const PALETTE = {
  ring: TOKEN_COLORS.ring,
  ringOutline: TOKEN_COLORS.ringOutline,
  lamp: TOKEN_COLORS.lamp,
  moon: TOKEN_COLORS.moon,

  // 바닥·벽
  floorA: "#2c2931",
  floorB: "#25262e",
  floorC: "#31303a",
  /** 연장 판: 바닥 널 색(floorB)과 같다 */
  plate: "#25262e",
  wall: "#202431",
  wainscot: "#292933",
  wallTrim: "#3f3b45",
  inlay: "#806851",

  // 창
  windowGlass: "#56648f",
  windowBeam: "#8eb2f2",
  blind: "#252b39",
  sill: "#514852",

  // 바 카운터·선반·스툴
  counter: "#31282d",
  counterTop: "#65463b",
  shelf: "#45332e",
  bottles: ["#d9a050", "#7d9681", "#b99575", "#8190a7"],
  stoolSeat: "#764d45",
  darkMetal: "#14161c",

  // 피아노
  pianoKeys: "#e0d6bc",
  pianoBody: "#272a36",

  // 무대·놋쇠·마이크
  stageBody: "#2c2630",
  stageWood: "#654736",
  stageSeam: "#42303a",
  brass: "#ad8855",
  rimBulb: "#ffd59a",
  stageGlow: "#ffd59a",
  micStand: "#a9aebb",
  micHead: "#2b2f38",

  // 탁자·의자·펜던트
  tableTop: "#53413d",
  chairSeat: "#593f42",
  chairBack: "#392f37",
  shade: "#5d4d42",
} as const;

/**
 * 시계탑 광장은 청회색 석재·아연 지붕과 따뜻한 가로등을 중심으로 잡았다.
 */
export const PLAZA_PALETTE = {
  floor: "#222938",
  cobbles: ["#3b4353", "#464c5a", "#505566", "#353d4a"],
  curb: "#555d6b",
  daisLow: "#70717a",
  daisHigh: "#afb0ae",
  brass: "#b59261",
  stoneL: "#5a5d6b",
  stoneD: "#454957",
  cream: "#8f8f8c",
  roof: "#303844",
  roofEdge: "#475160",
  clockFace: "#e5d9b8",
  clockHand: "#242932",
  flood: "#ffe6c4",
  lampPost: "#272d39",
  lampBulb: "#f6c88b",
  facades: ["#454757", "#585060", "#4b5362", "#484958"],
  facadeCap: "#333744",
  paneDark: "#252c3c",
  paneLit: "#e9c792",
  bench: "#69554c",
  benchLeg: "#2d3542",
  planter: "#505764",
  treeDark: "#363344",
  leaves: ["#444c54", "#495258", "#3b4560"],
} as const;
