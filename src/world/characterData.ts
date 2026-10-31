// 캐릭터 원문 데이터 — 원본 design/v2.0/blockout/character.js(결정 0047·0048) 의 값을 그대로 옮겼다.
// 값을 고치려면 원본 아티팩트(https://claude.ai/artifact/NP1XfUrYTTqQ5nAB1HKYT5)를 먼저 고친다.
// 인물 5명(FIGS)·의상 9종(OUTFITS)·표정 7종·동작 9종(EMOTES)·자세 키(KEYS)·피부/눈/입 색.

/** 피부색(머리·귀·손) */
export const SKIN = "#f7c9a6";
/** 눈·눈썹 색 */
export const EYE = "#2b2118";
/** 입 색 */
export const MOUTH = "#7a3b2e";

export interface Fig {
  id: string;
  name: string;
  hair: string;
  style: "boy" | "girl";
  /** 인물이 기본으로 쓰는 모자(없으면 빈 문자열). 의상의 hat 이 null 이면 이 값을 쓴다 */
  hat: string;
  tie: string;
}

/** 인물 5명: 갈색 머리·금발·단발·검은 페도라·갈색 페도라 */
export const FIGS: readonly Fig[] = [
  { id: "fig1", name: "지호", hair: "#6b4630", style: "boy", hat: "", tie: "#7a8fb8" },
  { id: "fig3", name: "민준", hair: "#d9b25c", style: "boy", hat: "", tie: "#6fa59a" },
  { id: "fig4", name: "서연", hair: "#6b4630", style: "girl", hat: "", tie: "#b89a6f" },
  { id: "fig7", name: "도윤", hair: "#2b2118", style: "boy", hat: "fedoraDark", tie: "#b87a5c" },
  { id: "fig8", name: "하은", hair: "#5a3a26", style: "girl", hat: "fedoraTan", tie: "#a9aebb" },
];

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
  coat: { label: "기본 코트", coat: "#4a5163", shirt: "#eef0f4", tie: null, pants: "#2b2f38", shoe: "#1f2229", hat: null, badge: "", prop: "" },
  police: { label: "경찰", coat: "#2a4372", shirt: "#c9d3ea", tie: "#16213d", pants: "#1e2847", shoe: "#16181e", hat: "police", badge: "star", prop: "" },
  doctor: { label: "의사", coat: "#e9ecf2", shirt: "#2FA4A0", tie: "", pants: "#6b7180", shoe: "#3a3f4b", hat: "", badge: "cross", prop: "" },
  detective: { label: "탐정", coat: "#8a6a45", shirt: "#eef0f4", tie: "#4a3a28", pants: "#3a3f4b", shoe: "#2b2118", hat: "deer", badge: "", prop: "mag" },
  noir: { label: "누아르 정장", coat: "#1a1d24", shirt: "#a9aebb", tie: "#3a3f4b", pants: "#16181e", shoe: "#0a0e1c", hat: "fedoraDark", badge: "", prop: "" },
  mafia: { label: "마피아", coat: "#1a1d24", shirt: "#3a3f4b", tie: "#8e0b21", pants: "#16181e", shoe: "#0a0e1c", hat: "fedoraMafia", badge: "", prop: "", acc: "shades" },
  reporter: { label: "기자", coat: "#6f8fa8", shirt: "#eef0f4", tie: "", pants: "#3a3f4b", shoe: "#2b2118", hat: "news", badge: "press", prop: "cam" },
  elder: { label: "어르신", coat: "#6b5a48", shirt: "#e6e8ee", tie: "", pants: "#3a3f4b", shoe: "#2b2118", hat: "", badge: "", prop: "cane", hair: "#d8dbe3", acc: "beard" },
  hood: { label: "후드", coat: "#5a5f6c", shirt: "#3a3f4b", tie: "", pants: "#3a3f4b", shoe: "#2b2118", hat: "hood", badge: "", prop: "", glove: "#7a5236" },
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
