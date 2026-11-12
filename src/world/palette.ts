// 3D 색 상수. 재질에만 쓴다 — 화면 CSS 에는 이 상수를 쓰지 않는다(CSS 색은 src/styles/tokens.css 의 토큰이 원천).
// 값의 출처는 design/v2.0/screens/bar.js 의 색 리터럴(지하 재즈 바)이다. 따뜻한 색은 장면 안 빛에만 쓴다(UI-SPEC Color).

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

export const PALETTE = {
  ring: TOKEN_COLORS.ring,
  ringOutline: TOKEN_COLORS.ringOutline,
  lamp: TOKEN_COLORS.lamp,
  moon: TOKEN_COLORS.moon,

  // 바닥·벽
  floorA: "#3a2a22",
  floorB: "#33241d",
  /** 연장 판: 바닥 널 색(floorB)과 같다 */
  plate: "#33241d",
  wall: "#211a26",
  wainscot: "#3b2a22",

  // 창
  windowGlass: "#56648f",
  blind: "#16131c",
  sill: "#3b2a22",

  // 바 카운터·선반·스툴
  counter: "#2e2018",
  counterTop: "#5a3f2f",
  shelf: "#3b2a22",
  bottles: ["#d9a050", "#7fb08a", "#c9a0c0", "#a9c0d9"],
  stoolSeat: "#4a2f3a",
  darkMetal: "#14161c",

  // 피아노
  pianoKeys: "#e6e8ee",

  // 무대·놋쇠·마이크
  stageBody: "#2c2234",
  brass: "#a98559",
  rimBulb: "#ffd59a",
  stageGlow: "#ffd59a",
  micStand: "#a9aebb",
  micHead: "#2b2f38",

  // 탁자·의자·펜던트
  tableTop: "#4a3426",
  chairSeat: "#4a2f3a",
  chairBack: "#2e2018",
  shade: "#2b2f38",
} as const;

/**
 * 시계탑 광장(maps/plaza.ts) 3D 색. 값의 출처는 design/v2.0/blockout/plaza.js 의 색 리터럴이다. 재질에만 쓴다 — CSS 에는 쓰지 않는다.
 * 진홍(crimson)은 마피아 전용이라 장면 색에 없다. 낮 하늘은 흐린 보랏빛 회색(sky-overcast #8a8496 계열)이다.
 */
export const PLAZA_PALETTE = {
  floor: "#121a30",
  cobbles: ["#1c2440", "#202a4a", "#192138"],
  daisLow: "#b9b09a",
  daisHigh: "#e0d8c4",
  brass: "#a98559",
  stoneL: "#3a3f55",
  stoneD: "#2a2f45",
  cream: "#b9b09a",
  roof: "#151c36",
  clockFace: "#e8dfc6",
  clockHand: "#14161c",
  flood: "#ffe6c4",
  lampPost: "#0b1024",
  lampBulb: "#ffd59a",
  facades: ["#1e2847", "#24305a", "#24305a", "#1b2442"],
  facadeCap: "#151c36",
  paneDark: "#0e1326",
  paneLit: "#9fb3e0",
  bench: "#3b2a22",
  benchLeg: "#0b1024",
  planter: "#3a3f4b",
  treeDark: "#0b1024",
} as const;

// ---------- 마을(20페이즈) 자리: 값은 GREEN 에서 채운다 ----------
export const SEAT_COLORS: readonly string[] = [];
export const TOWN_PALETTE: Readonly<Record<string, string>> = {};
export const TOWN_LIT: Readonly<Record<string, { indoor: number; houseOwned: number }>> = {};
