// 3D 색 상수. 재질에만 쓴다 — 화면 CSS 에는 이 상수를 쓰지 않는다(CSS 색은 src/styles/tokens.css 의 토큰이 원천).
// 값의 출처는 design/v2.0/screens/bar.js 의 색 리터럴(지하 재즈 바)이다. 따뜻한 색은 장면 안 빛에만 쓴다(UI-SPEC Color).
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

// ---------- 마을(maps/town.ts, 20페이즈) ----------

/**
 * 자리 구분색 8(= src/styles/tokens.css 의 --seat-1~8, 좌석 0~7). 집 문패·지붕 표식의 원 색이다(UI-SPEC P20-6·P20-20).
 * 새 토큰이 아니라 같은 값의 3D 상수다 — 값이 갈라지지 않게 palette.test.ts 가 tokens.css 와 대조한다.
 */
export const SEAT_COLORS = ["#7a8fb8", "#8e7ab8", "#6fa59a", "#b89a6f", "#6f8fa8", "#9aa86f", "#b87a5c", "#a9aebb"] as const;

/**
 * 마을 방·집 3D 색(UI-SPEC P20-2·P20-3, 출처는 승인 시안 사본 design/v3.0/town-map/). 재질에만 쓴다 — CSS 에는 쓰지 않는다.
 * 광장 건물과 같은 낮은 채도의 남색·회색 계열이고, 이미 있는 색은 그 상수를 가리킨다. 램프 금빛(sign)은 간판 그림·문턱 띠에만 쓴다.
 * 집은 방보다 어둡다(벽 휘도 약 47 < 63). 실내 바닥 널은 자갈보다 휘도가 약 1.5배라 바깥보다 조금 밝다(D-09).
 */
export const TOWN_PALETTE = {
  roomWall: PLAZA_PALETTE.planter,
  roomRoof: PLAZA_PALETTE.stoneD,
  /** 지붕 가장자리 띠·빈 문패 윤곽(시안의 방·집 윤곽) */
  roomEdge: "#6b7180",
  floorA: "#4a3f36",
  floorB: "#42382f",
  prop: "#6b5a48",
  houseWall: "#2b2f38",
  houseRoof: PLAZA_PALETTE.facades[3],
  /** 주인 있는 집의 켜진 창 — 가로등과 같은 "장면 안 빛"이다(강조색 아님) */
  paneLit: PLAZA_PALETTE.lampBulb,
  /** 꺼진 창·집 문 칸 */
  paneDark: PLAZA_PALETTE.paneDark,
  /** 간판 판·빈 문패의 바탕 */
  plate: PLAZA_PALETTE.paneDark,
  sign: TOKEN_COLORS.lamp,
  ground: PLAZA_PALETTE.floor,
} as const;

/**
 * 마을이 광장의 단계 조명 7칸에 더하는 두 열(UI-SPEC 조명 표, P20-13). 0~1 배율이고 재질 색에 곱한다 — 점광원은 늘리지 않는다.
 * indoor = 방 벽등·문턱 띠·빛 무리, houseOwned = 주인 있는 집의 창. 주인 없는 집의 창은 어느 단계에서도 0 이라 열이 없다.
 * 시민 편 밤은 둘 다 0 이다 — 역할마다 겉보기가 달라지지 않게(결정 0074-4).
 */
export const TOWN_LIT: Readonly<Record<LightingPhase, { indoor: number; houseOwned: number }>> = {
  talk: { indoor: 0.5, houseOwned: 0.3 },
  vote: { indoor: 0.8, houseOwned: 1 },
  trial: { indoor: 0.35, houseOwned: 0.06 },
  night: { indoor: 0.7, houseOwned: 0.7 },
  nightCitizen: { indoor: 0, houseOwned: 0 },
  nightGhost: { indoor: 0.7, houseOwned: 0.7 },
  morning: { indoor: 0.5, houseOwned: 0.3 },
};
