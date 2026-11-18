// 달빛 누아르의 인물·의상 팔레트. 관절 동작과 의상 식별자는 v2.0과 공유한다.
// 좌석별 인물 8명(FIGS)·의상 9종(OUTFITS)·표정 7종·동작 9종(EMOTES)·자세 키(KEYS)·피부/눈/입 색.

/** 피부색(머리·귀·손) */
export const SKIN = "#efbc98";
/** 눈·눈썹 색 */
export const EYE = "#26272e";
/** 입 색 */
export const MOUTH = "#623b35";

export interface Fig {
  id: string;
  name: string;
  hair: string;
  style: "boy" | "girl";
  haircut?: "bun" | "crop";
  /** 인물이 기본으로 쓰는 모자(없으면 빈 문자열). 의상의 hat 이 null 이면 이 값을 쓴다 */
  hat: string;
  tie: string;
}

/** 각 좌석의 기본 외형. 앞 다섯 인물의 순서를 유지한다. */
export const FIGS: readonly Fig[] = [
  { id: "fig1", name: "지호", hair: "#53362d", style: "boy", hat: "", tie: "#6e83a2" },
  { id: "fig3", name: "민준", hair: "#b99050", style: "boy", hat: "", tie: "#648c81" },
  { id: "fig4", name: "서연", hair: "#664236", style: "girl", hat: "", tie: "#ab8f73" },
  { id: "fig7", name: "도윤", hair: "#332922", style: "boy", hat: "fedoraDark", tie: "#a8816c" },
  { id: "fig8", name: "하은", hair: "#553830", style: "girl", hat: "fedoraTan", tie: "#9ca3b5" },
  { id: "fig6", name: "유나", hair: "#8b4539", style: "girl", haircut: "bun", hat: "", tie: "#ac6b5f" },
  { id: "fig2", name: "준호", hair: "#85858e", style: "boy", haircut: "crop", hat: "", tie: "#718f9d" },
  { id: "fig5", name: "수아", hair: "#3e3147", style: "girl", hat: "cloche", tie: "#9b749e" },
];

/** 무대와 초상화가 같은 좌석에 같은 인물을 쓴다. */
export function figForSeat(seat: number): number {
  return ((seat % FIGS.length) + FIGS.length) % FIGS.length;
}

export type OutfitId = "coat" | "police" | "doctor" | "detective" | "noir" | "mafia" | "reporter" | "elder" | "hood";

export interface Outfit {
  label: string;
  coat: string;
  shirt: string;
  /** null = 인물 기본 넥타이 색, 빈 문자열 = 넥타이 없음 */
  tie: string | null;
  pants: string;
  shoe: string;
  /** null = 인물 기본 모자, 빈 문자열 = 모자 없음 */
  hat: string | null;
  badge: string;
  prop: string;
  hair?: string;
  acc?: string;
  glove?: string;
}

export const OUTFITS: Readonly<Record<OutfitId, Outfit>> = {
  coat: { label: "기본 코트", coat: "#4e586d", shirt: "#d8cbb4", tie: null, pants: "#343846", shoe: "#2a2526", hat: null, badge: "", prop: "" },
  police: { label: "경찰", coat: "#3b5375", shirt: "#bfcbdc", tie: "#1f324c", pants: "#29384d", shoe: "#242634", hat: "police", badge: "star", prop: "" },
  doctor: { label: "의사", coat: "#d7d1c4", shirt: "#598c8a", tie: "", pants: "#6e767f", shoe: "#3a414e", hat: "", badge: "cross", prop: "" },
  detective: { label: "탐정", coat: "#a18364", shirt: "#ded0b7", tie: "#645442", pants: "#414958", shoe: "#392e2b", hat: "deer", badge: "", prop: "mag" },
  noir: { label: "누아르 정장", coat: "#333a48", shirt: "#bfaf95", tie: "#4a4f5d", pants: "#2a2d38", shoe: "#24262d", hat: "fedoraDark", badge: "", prop: "" },
  mafia: { label: "마피아", coat: "#343544", shirt: "#555565", tie: "#843e48", pants: "#2a2e38", shoe: "#25262d", hat: "fedoraMafia", badge: "", prop: "", acc: "shades" },
  reporter: { label: "기자", coat: "#688194", shirt: "#ded0b7", tie: "", pants: "#414658", shoe: "#392e2b", hat: "news", badge: "press", prop: "cam" },
  elder: { label: "어르신", coat: "#7f6b5c", shirt: "#d4c3a9", tie: "", pants: "#454754", shoe: "#392e2b", hat: "", badge: "", prop: "cane", hair: "#bfc2cb", acc: "beard" },
  hood: { label: "후드", coat: "#666477", shirt: "#515464", tie: "", pants: "#414658", shoe: "#392e2b", hat: "hood", badge: "", prop: "", glove: "#856950" },
};

/** 표정 7종(원문 buildFaces 의 그룹 이름 그대로) */
export const FACE_IDS = ["base", "happy", "angry", "cry", "surprise", "sus", "dead"] as const;
export type KnownFaceId = (typeof FACE_IDS)[number];
/** 모르는 이름은 기본 표정으로 받는다 */
export type FaceId = string;

export type EmoteId = "throat" | "deny" | "clap" | "cry" | "handshake" | "point" | "praise" | "surprise" | "dance";

export interface EmoteDef {
  label: string;
  /** 프레임 하나의 길이(초) */
  seg: number;
  cycles: number;
  /** 끝난 뒤 자세를 붙들고 있는 시간(초) */
  hold: number;
  frames: readonly Record<string, number | string>[];
}

// 라디안: aAx·aBx 앞으로 들기(-), aAz 왼팔 바깥(+), aBz 오른팔 바깥(-), fA·fB 어깨를 앞으로, lA·lB 다리, hx·hy·hz 머리, y 몸 높이, s 찌그러짐, ry 몸 비틀기
// 팔이 짧아 손이 머리에 닿지 않는다. 손을 얼굴 쪽으로 올리는 동작은 머리 둘레 밖(턱 앞·볼 아래·머리 옆)에서 멈춘다
export const EMOTES: Readonly<Record<EmoteId, EmoteDef>> = {
  throat: {
    label: "목 긋기",
    seg: 0.32,
    cycles: 1,
    hold: 0.5,
    frames: [
      { aBx: -0.4, aBz: -0.2, face: "angry" },
      { aBx: -1.87, aBz: -0.15, fB: 0.1, hz: 0.12, face: "angry" },
      { aBx: -1.86, aBz: 0.78, fB: 0.1, hz: -0.15, face: "sus" },
      { aBx: -1.86, aBz: 0.78, fB: 0.1, hz: -0.15, face: "sus" },
    ],
  },
  deny: {
    label: "나 아니야",
    seg: 0.22,
    cycles: 3,
    hold: 0,
    frames: [
      { aAx: -1.5, aAz: -0.45, aBx: -1.5, aBz: 0.45, hy: 0.35, face: "surprise" },
      { aAx: -1.5, aAz: 0.15, aBx: -1.5, aBz: -0.15, hy: -0.35, face: "surprise" },
    ],
  },
  clap: {
    label: "박수",
    seg: 0.16,
    cycles: 4,
    hold: 0,
    frames: [
      { aAx: -1.2, aAz: -0.2, aBx: -1.2, aBz: 0.2, face: "happy" },
      { aAx: -1.25, aAz: -0.6, aBx: -1.25, aBz: 0.6, face: "happy", y: 0.03 },
    ],
  },
  cry: {
    label: "엉엉",
    seg: 0.22,
    cycles: 4,
    hold: 0,
    frames: [
      { aAx: -2.07, aAz: -0.34, aBx: -2.07, aBz: 0.34, fA: 0.15, fB: 0.15, face: "cry", hx: 0.14 },
      { aAx: -1.98, aAz: -0.4, aBx: -1.98, aBz: 0.4, fA: 0.15, fB: 0.15, face: "cry", hx: 0.2, y: -0.03, s: 0.96 },
    ],
  },
  handshake: {
    label: "악수",
    seg: 0.18,
    cycles: 3,
    hold: 0.3,
    frames: [
      { aBx: -1.3, aBz: -0.15, face: "happy", hz: -0.08 },
      { aBx: -1.6, aBz: -0.15, face: "happy", hz: -0.08 },
    ],
  },
  point: {
    label: "손가락질",
    seg: 0.3,
    cycles: 1,
    hold: 1.1,
    frames: [
      { aBx: -0.6, aBz: -0.3, face: "sus" },
      { aBx: -1.55, aBz: -0.55, aAz: 0.55, aAx: 0.25, hy: -0.25, hz: 0.1, face: "sus" },
    ],
  },
  praise: {
    label: "최고",
    seg: 0.18,
    cycles: 3,
    hold: 0.2,
    frames: [
      { aBz: -2.3, face: "happy", y: 0.06 },
      { aBz: -2.1, face: "happy", y: 0 },
    ],
  },
  surprise: {
    label: "깜짝",
    seg: 0.22,
    cycles: 1,
    hold: 0.4,
    frames: [
      { aAz: 0.3, aBz: -0.3, s: 0.88, face: "surprise" },
      { aAz: 2.25, aBz: -2.25, y: 0.4, face: "surprise" },
      { aAz: 2.15, aBz: -2.15, y: 0, face: "surprise" },
    ],
  },
  dance: {
    label: "춤",
    seg: 0.26,
    cycles: 4,
    hold: 0,
    frames: [
      { aAz: 2.35, aBz: -0.4, hz: 0.22, y: 0.07, ry: 0.45, lA: -0.3, face: "happy" },
      { aAz: 0.4, aBz: -2.35, hz: -0.22, y: 0.07, ry: -0.45, lB: -0.3, face: "happy" },
    ],
  },
};

/** 자세 키(동작 프레임이 숫자로 덮어쓰는 값들) */
export const EMOTE_KEYS = ["aAx", "aAz", "aBx", "aBz", "fA", "fB", "lA", "lB", "hx", "hy", "hz", "y", "s", "ry"] as const;
export type PoseKey = (typeof EMOTE_KEYS)[number];

/** 유령 묶음의 배율: 산 캐릭터의 75%(D-20, 결정 0089-17). 이름표 높이 기준(character.ts GHOST_ART_H)은 그대로다. three 를 부르지 않는 런타임도 E2E 훅용으로 읽으므로 이 파일에 둔다 */
export const GHOST_SCALE = 0.75;
