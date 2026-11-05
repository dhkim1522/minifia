// 로비 맵 런타임: rAF 한 루프가 서버 시각의 위치로 모든 캐릭터를 놓고, 카메라가 내 캐릭터를 따라가고, 렌더하고, 이름표를 투영한다.
// 내 캐릭터는 탭하자마자 서버와 같은 공용 길찾기로 예측 구간을 그리고, 내 서버 구간이 오면 그쪽으로 맞춘다(결정 0059).
// 위치의 진실은 계속 서버 구간이다(sample() 은 서버 값 그대로). 남의 캐릭터는 예측하지 않는다.
// 그릴 구간이 바뀌면 화면 위치 차이를 SEG_BLEND_MS 에 걸쳐 줄인다.
//
// three 는 loadWorld() 의 import() 두 줄로만 끌려온다(이 파일에 three 값 import 가 없다 — 메인 번들 분리, RESEARCH 번들 측정).
// 렌더러·캐릭터 모듈은 deps.loadModules 로 바꿔 끼울 수 있다(happy-dom 테스트의 가짜, 06-14 의 시나리오 스토어).
import { BAR_MAP, BAR_SPAWNS, snapToWalkable, UNIT } from "../../shared/game/map";
import { positionAt, segmentEndsAt } from "../../shared/game/world";
import type { Segment } from "../../shared/game/world";
import { NETWORK_TEXT } from "../net/copy";
import { clampTarget, DEFAULT_TARGET, followStep, gatherView, NAMETAG_GAP, NAMETAG_MAX_W, RESIZE_SETTLE_MS, stageOffsetY } from "./camera";
import { FIGS } from "./characterData";
import { admitEmote, EMOTE_RENDER_MAX, emoteDurationMs } from "./emoteCap";
import type { PlayingEmote } from "./emoteCap";
import { createTapGate } from "./input";
import { BLEND_SNAP_DIST, blendRemaining, createOwnMoves, predictSegment, stepYaw, travelYaw } from "./motion";
import { DEFAULT_BUDGET_STEP, nextLadderStep } from "./renderer";
import type { CharacterHandle, WorldRenderer } from "./renderer";
import { GHOST_MIST } from "./ghostOutfit";
import { executionFade, GHOST_OPACITY, ghostFloatY, stageLiftY } from "./presence";
import { easeInOut, pinAt, pinLevel, pinLights } from "./pinPlan";
import type { SceneLook } from "./presence";
import { initialMapStatus, inputBlocked, mapStatusReducer, shouldRecreate } from "./status";
import { rankTags } from "./tagOrder";
import type { TagBox } from "./tagOrder";
import type { MapStatusEvent, MapStatusState } from "./status";
import type { LightingPhase, RendererStatusEvent } from "./renderer";
import type { WorldStore } from "./store";
import type { EmoteId, FaceId } from "./characterData";
import type { characterKit as CharacterKitType } from "./character";
import type { createThreeRenderer as CreateThreeRendererType } from "./threeRenderer";

export interface WorldModules {
  createThreeRenderer: typeof CreateThreeRendererType;
  characterKit: typeof CharacterKitType;
}

let modulesPromise: Promise<WorldModules> | null = null;

/**
 * 월드 모듈(렌더러 + 캐릭터)을 받는다. 이 두 import() 가 three 를 끌어오는 유일한 경로다.
 * 실패한 약속은 캐시하지 않는다 — [다시 시도]가 새로 받게 한다.
 */
export function loadWorld(): Promise<WorldModules> {
  if (modulesPromise === null) {
    const p = Promise.all([import("./threeRenderer"), import("./character")]).then(
      ([renderer, character]): WorldModules => ({ createThreeRenderer: renderer.createThreeRenderer, characterKit: character.characterKit }),
    );
    modulesPromise = p;
    p.catch(() => {
      if (modulesPromise === p) modulesPromise = null;
    });
  }
  return modulesPromise;
}

/** 방 입장 화면에서 미리 받아 둔다(06-15 가 부른다). 실패는 삼킨다 — 맵을 열 때 loadWorld 가 다시 시도한다. */
export function preloadWorld(): void {
  loadWorld().catch(() => {});
}

/** 자동 강등 판정 창(ms): 이 시간의 평균 fps 가 45 미만이면 한 단계 내린다(UI-SPEC "자동 강등") */
export const AUTO_WINDOW_MS = 10_000;
/** 이보다 긴 프레임 간격은 탭이 숨었다 돌아온 것으로 보고 평균에 넣지 않는다(ms) */
const AUTO_GAP_MS = 500;

export interface AutoDegrade {
  /** 한 프레임의 간격(ms)을 알린다 */
  frame(deltaMs: number): void;
  /** 지금 사다리 단계 */
  step(): number;
}

/**
 * 제품 런타임의 자동 강등. 10초 평균이 45fps 미만이면 사다리 1~3단계를 한 단계씩 내리고 되돌리지 않는다(안내 문구 없음).
 * 4단계 이상은 사람이 결정한다(nextLadderStep). 꺼져 있으면(성능 스파이크 측정 중) 아무것도 하지 않는다.
 * 창은 판정마다 비운다 — 내린 직후 10초는 새 단계의 값으로만 잰다.
 */
export function createAutoDegrade(o: { enabled: boolean; step: number; setBudget(step: number): void }): AutoDegrade {
  let step = o.step;
  let sum = 0;
  let count = 0;
  return {
    frame(deltaMs) {
      if (!o.enabled || !(deltaMs > 0) || deltaMs > AUTO_GAP_MS) return;
      sum += deltaMs;
      count += 1;
      if (sum < AUTO_WINDOW_MS) return;
      const next = nextLadderStep(step, count / (sum / 1000));
      sum = 0;
      count = 0;
      if (next !== step) {
        step = next;
        o.setBudget(step);
      }
    },
    step() {
      return step;
    },
  };
}

export const WALK_CUE_KEY = "mf-hint-walk";
/** 새 사람 등장 연출 길이(ms) = dur-med */
export const ENTER_MS = 420;
/** 나간 사람 퇴장 연출 길이(ms) = dur-fast */
export const EXIT_MS = 180;
/** 로비를 떠날 때 맵을 night-900 으로 덮는 시간(ms) = dur-med. WorldStage 의 가림막과 RoomScreen 의 단계 전환 지연이 같은 값을 쓴다 */
export const EXIT_CURTAIN_MS = 420;
/** 프레임 오류 로그 최소 간격(ms) — 매 프레임 던져도 콘솔을 채우지 않는다 */
const FRAME_ERROR_LOG_MS = 1000;
/** 탭 뒤 이 시간 안에 내 서버 구간이 없으면 응답 없음 */
export const MOVE_ACK_TIMEOUT_MS = 1500;

/** 링 맥박 주기(ms) = dur-pulse */
const PULSE_MS = 1100;
/** 맥박 최대 배율 */
const PULSE_MAX = 1.15;
/** 링이 보정된 지점으로 미끄러지는 시간·도착 뒤 사라지는 시간(ms) = dur-fast */
const RING_MS = 180;
/** 손짓 링: 맵이 열린 뒤 보이기까지(ms)·맥박 횟수·모션 줄이기 고정 시간(ms)·내 앞 거리(월드 단위) */
const CUE_DELAY_MS = 600;
const CUE_PULSES = 3;
const CUE_REDUCED_MS = 2500;
const CUE_AHEAD = 2;
/** 소실·재생성 중 상태기계에 시각을 알리는 간격(ms) — 3초 재생성·5초 포기를 판정한다 */
const TICK_MS = 1000;
/** 크기 변화를 다시 재기 전 기다리는 시간(ms) */
const RESIZE_DEBOUNCE_MS = 150;
/** 한 프레임 dt 상한(초) — 탭이 숨었다 돌아와도 걸음 계산이 튀지 않게 */
const MAX_DT = 0.05;
/** 이동으로 보는 한 프레임 위치 변화(월드 단위) */
const MOVE_EPS = 1e-6;
/** 등장 시작 크기·낙하 높이(월드 단위) */
const ENTER_SCALE = 0.6;
const ENTER_LIFT = 0.4;
/** 고정 카메라로 옮기는 시간·확대 전환 시간(ms) = dur-slow */
const CAM_SLOW_MS = 800;
/** 분필 윤곽이 다 그려진 불투명도(블록아웃 값, bar.ts CHALK_OPACITY 와 같다) */
const CHALK_FULL = 0.85;
/** 분필이 그려지는 시간(ms) = dur-slow */
const CHALK_DRAW_MS = 800;
/** 서버가 look 을 안 준 좌석의 의상(결정 D-6: 키가 없으면 coat) */
const DEFAULT_LOOK = "coat";

/** 동작을 재생할 수 있는 캐릭터 핸들(06-11 WorldCharacter). 테스트의 가짜 캐릭터에는 playEmote 가 없을 수 있다 */
export type PlayableCharacter = CharacterHandle & { playEmote?(id: EmoteId, opts?: { reduced?: boolean }): void; stopEmote?(): void; prewarm?(face?: FaceId): void; setFace?(id: FaceId): void };

/**
 * 밤 행동 선택의 발밑 고리 종류와 색. 값은 tokens.css 의 crimson-500·seat-1·seat-3 (승인 Ghost 보드 값, 9페이즈가 정식 토큰으로 정한다).
 * mafiaAlly = 마피아 화면에서 동료가 고른 사람의 고리(crimson-400, UI-SPEC 226·318행). 이름표 속성 data-ring-kind 값은 "mafia-ally" 로 쓴다.
 */
export type RingKind = "mafia" | "mafiaAlly" | "police" | "doctor" | "turn";
// turn = 순차 지목에서 지금 차례인 사람의 고리(09.1-07, UI-SPEC A-1). 색은 토큰 gray-100. 밤 고리와 같은 발밑 고리 메시를 쓰고 새 모델은 만들지 않는다.
export const RING_COLORS: Readonly<Record<RingKind, string>> = { mafia: "#c8102e", mafiaAlly: "#e0344b", police: "#7a8fb8", doctor: "#6fa59a", turn: "#e6e8ee" };
/** 마피아 밤 선택 표시의 몸 윤곽 색(crimson-400, 동료 고리와 같은 값 — 결정 0065) */
export const PICK_OUTLINE_COLOR = RING_COLORS.mafiaAlly;
/** RingKind → 이름표 속성 값(data-ring-kind). 속성은 kebab-case 다 */
export function ringKindAttr(kind: RingKind): string {
  return kind === "mafiaAlly" ? "mafia-ally" : kind;
}
/** 이름표 속성 값 → 고리 색. 모르는 값이면 null */
function ringColorOfAttr(attr: string | null): string | null {
  if (attr === null) return null;
  const kind: RingKind | undefined = attr === "mafia-ally" ? "mafiaAlly" : (["mafia", "police", "doctor", "turn"] as const).find((k) => k === attr);
  return kind === undefined ? null : RING_COLORS[kind];
}

export interface WorldRuntimeDeps {
  host: HTMLElement;
  tagLayer: HTMLElement;
  store: WorldStore;
  serverNow(): number;
  mySeat(): number;
  players(): readonly { seat: number; nickname: string; connected: boolean; look?: string }[];
  reducedMotion(): boolean;
  /** 스테이지 사각형의 위·아래 끝(px, 캔버스 위 끝 기준) */
  stageRect(): { top: number; bottom: number };
  onStatus(s: MapStatusState): void;
  onNotice(text: string): void;
  allowSoftware: boolean;
  budgetStep?: number;
  /** 10초 평균 45fps 미만이면 사다리 1~3단계를 한 단계씩 자동으로 내린다. 기본 true — 성능 스파이크(?perf=1)는 false 로 측정 중 단계를 고정한다 */
  autoDegrade?: boolean;
  /** 프레임마다 render 호출·이름표 투영·쓰기에 걸린 CPU 시간(ms). 있을 때만 잰다 — 제품은 넘기지 않는다(06-14 HUD 의 p95) */
  onFrame?(stats: { renderMs: number; tagsMs: number }): void;
  lighting?: "talk" | "vote";
  loadModules?: () => Promise<WorldModules>;
  raf?: (cb: FrameRequestCallback) => number;
  caf?: (id: number) => void;
  storage?: Storage | null;
  /** 목적지 링이 생기거나(탭)·보정되거나(구간 끝점)·없어질 때 한 번씩 불린다 — 루트의 data-ring 용 */
  onRing?: (at: { x: number; z: number } | null) => void;
  /** 지금 입힌 유령 직업 의상 표(좌석 → 의상 id)가 바뀔 때만 한 번 불린다 — E2E 훅 window.__mfGhostOutfits 용(09.1-09). 산 사람 화면은 늘 빈 표다 */
  onGhostOutfits?: (outfits: Readonly<Record<number, string>>) => void;
  /** 그리는 좌석별 고른 의상 표(좌석 → 의상 id, 직업 의상 안개와 무관)가 바뀔 때만 한 번 불린다 — E2E 훅 window.__mfLooks 용(10-04, L33). 제품은 넘기지 않는다 */
  onLooks?: (looks: Readonly<Record<number, string>>) => void;
  /** 핀 조명이 지금 비추는 좌석(없으면 null)·이동 중 여부·켜짐 수준(0~1)이 바뀔 때 불린다 — E2E 훅 window.__mfPin 용(09.1.1-11). 제품은 넘기지 않는다 */
  onPin?: (pin: { seat: number | null; moving: boolean; strength: number }) => void;
  /** 사람 동작이 시작되거나 재생 목록이 바뀔 때 불린다 — E2E 훅 window.__mfEmotes 용(10-03, L33). last 는 마지막으로 받아 그린 프레임의 사본, playing 은 재생 중 좌석(도착 순서). 제품은 넘기지 않는다 */
  onEmotes?: (state: { last: { seat: number; id: EmoteId; n: number } | null; playing: readonly number[] }) => void;
  /** 카메라 줌이 렌더러에 새로 보내질 때 소수 셋째 자리로 불린다 — E2E 훅 window.__mfPin.zoom 용(09.1.1-13). 제품은 넘기지 않는다 */
  onZoom?: (zoom: number) => void;
}

export interface WorldRuntime {
  start(): Promise<void>;
  syncPlayers(): void;
  /** seat 이 손사래(deny)를 하고 놀란 표정을 한 번 짓는다 — 지목 선두가 바뀌었을 때의 반응(결정 0049). 그릴 캐릭터가 없으면 아무것도 하지 않는다 */
  deny(seat: number): void;
  /** 재생 중인 사람 동작을 모두 부드럽게 끝낸다 — 단계가 바뀔 때 밤 → 아침으로 동작이 이어져 보이지 않게(10-03, T-10-10) */
  stopAllEmotes(): void;
  /** seat 이 놀란 표정(surprise)만 한 번 짓는다 — 손사래 없음. 암살당한 본인의 0.7초 연출(09-20, NIGHT-11). 그릴 캐릭터가 없으면 아무것도 하지 않는다 */
  surprise(seat: number): void;
  /**
   * 게임 단계의 장면 상태(08-08 SceneLook)를 건넨다. 표에 없는(show 아닌) 좌석은 캐릭터를 만들지 않고 이미 있으면 퇴장시키며,
   * ghost 좌석은 반투명으로 그린다. null 이면 장면이 없는 것(로비) — 6페이즈 동작 그대로다.
   */
  setScene(look: SceneLook | null): void;
  /** 화면 좌표의 탭. 받아들이면 바닥 교점(월드 단위)을 돌려주고 목적지 링을 바로 띄운다 */
  tap(clientX: number, clientY: number): { x: number; z: number } | null;
  /**
   * move 를 보낸 직후 부른다(서버 시각 at, 응답 없음 시계의 시작).
   * dest(보낸 1/100 정수 목적지)가 있으면 내 캐릭터가 같은 길로 바로 걷기 시작한다. 없으면 예측 없이 서버 구간만 따른다.
   */
  notifyMoveSent(at: number, dest?: { x: number; z: number }): void;
  /** move 를 보내지 못했을 때: 링을 거둔다(알림 없음 — 연결 띠가 알린다) */
  cancelMove(): void;
  retry(): Promise<void>;
  dispose(): void;
  /** 서버 시각 t(기본: 지금)의 seat 위치 */
  sample(seat: number, t?: number): { x: number; z: number } | null;
  renderer(): WorldRenderer | null;
  /** seat 의 캐릭터 핸들(없으면 null). 06-14 성능 스파이크가 동작을 재생하는 데 쓴다 — 제품 로비는 부르지 않는다(로비에서 캐릭터는 혼자 동작하지 않는다) */
  characterOf(seat: number): PlayableCharacter | null;
  /** 지금 목적지 링의 목표 지점(없으면 null) */
  ring(): { x: number; z: number } | null;
  /** 마지막 프레임에 그린 seat 의 위치(예측·섞기 포함)와 그 프레임의 Date.now(). 없으면 null. sample 과 달리 서버 값이 아니다 */
  shown(seat: number): { x: number; z: number; at: number } | null;
  /** 지금 맵 상태 */
  status(): MapStatusState;
  /** performance.mark("map-interactive") 의 시각(ms). 아직 안 열렸으면 null */
  interactiveMs(): number | null;
}

/** 06-11 figForSeat 와 같은 식(character.ts 는 three 를 끌고 와서 정적으로 가져오지 않는다) */
function figIndexForSeat(seat: number): number {
  return ((seat % FIGS.length) + FIGS.length) % FIGS.length;
}

/** 입장 지점의 방향. 없는 곳은 카메라 쪽(π/4) */
function spawnYaw(seat: number): number {
  const n = BAR_SPAWNS.length;
  return BAR_SPAWNS[((seat % n) + n) % n]?.yaw ?? Math.PI / 4;
}

const easeOut = (p: number): number => 1 - (1 - p) * (1 - p) * (1 - p);

function defaultStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

interface Actor {
  seat: number;
  handle: CharacterHandle;
  /** 표정 병합 선행(prewarm)을 걸어 둔 유휴 작업 id. 없으면 null */
  idleId: number | null;
  /** 생성 때 root.scale (캐릭터 자체 크기). 연출 배율은 여기에 곱한다 */
  base: number;
  pos: { x: number; z: number };
  /** 마지막으로 그린 구간(예측 또는 서버). 바뀌면 화면 위치 차이를 새로 잡는다 */
  seg: Segment | undefined;
  /** 구간이 바뀐 순간의 화면 위치 차이(그린 위치 − 새 구간 위치). blendRemaining 만큼 남는다 */
  off: { x: number; z: number };
  /** off 를 잡은 Date.now() */
  offAt: number;
  yaw: number;
  /** 걷는 선분의 방향(travelYaw). 구간이 끝나도 남겨 두어 돌던 중이면 마저 돈다. 멈춘 뒤에는 새로 정하지 않는다 */
  yawGoal: number | null;
  headY: number;
  dim: boolean;
  /** 지금 손가락 자세(holdPose("point"))를 유지하나 */
  pointing: boolean;
  /** handle.setRing 에 마지막으로 보낸 고리 종류(null = 고리 없음) */
  ringKind: string | null;
  /** handle.setPickMark 에 마지막으로 보낸 상태(true = 켬). animate(움직임 줄이기)는 켤 때 한 번 정한다 */
  pickMark: boolean;
  /** 처형 연출로 handle.setOpacity 에 마지막으로 보낸 불투명도(1 = 연출 없음) */
  fadeOpacity: number;
  /** 지금 유령으로 그리고 있나(handle.setGhost 에 마지막으로 보낸 값) */
  ghost: boolean;
  /** 유령 직업 의상 + 안개를 입었나(그 의상 id, 없으면 null) — 장면 표에 outfit 이 있을 때만(spectate 를 받은 유령 분기) */
  ghostOutfit: string | null;
  /** 서버가 준 고른 의상(view.players[].look, 없으면 coat) — 유령 안개 중에도 여기에 최신 값을 두고 안개가 끝나면 이 의상으로 돌아온다 */
  look: string;
  /** 등장 시작 시각(없으면 서 있다) */
  enter: number | null;
  /** 퇴장 시작 시각 */
  exit: number | null;
  tag: HTMLElement | null;
  tagStyle: string;
  tagAlpha: string;
  tagZ: string;
  /** 이름표 폭(px). null = 아직 안 쟀다 — 처음 필요할 때 한 번 재고 view 가 바뀔 때(syncPlayers)만 다시 잰다 */
  tagW: number | null;
  /** 지금 래퍼에 data-front 가 붙어 있나 */
  tagFront: boolean;
}

interface Ring {
  /** 지금 그려지는 위치 */
  at: { x: number; z: number };
  /** 마지막으로 알린(또는 ack 로 정해진) 목표 */
  target: { x: number; z: number };
  from: { x: number; z: number } | null;
  to: { x: number; z: number } | null;
  slideStart: number;
  acked: boolean;
  endsAt: number;
  fadeStart: number | null;
}

export function createWorldRuntime(deps: WorldRuntimeDeps): WorldRuntime {
  const { host, store, tagLayer } = deps;
  const raf = deps.raf ?? ((cb: FrameRequestCallback) => requestAnimationFrame(cb));
  const caf = deps.caf ?? ((id: number) => cancelAnimationFrame(id));
  const storage = deps.storage === undefined ? defaultStorage() : deps.storage;

  let disposed = false;
  let bootGen = 0;
  let renderer: WorldRenderer | null = null;
  let kit: WorldModules["characterKit"] | null = null;
  let rafId: number | null = null;
  let status: MapStatusState = initialMapStatus;
  let offRendererStatus: (() => void) | null = null;
  let tickTimer: ReturnType<typeof setInterval> | null = null;
  let interactiveAt: number | null = null;
  let visibilityBound = false;

  const degrade = createAutoDegrade({ enabled: deps.autoDegrade !== false, step: deps.budgetStep ?? DEFAULT_BUDGET_STEP, setBudget: (n) => renderer?.setBudget(n) });

  let look: SceneLook | null = null;
  /** 렌더러에 마지막으로 보낸 조명 단계·긴장 키·확대(바뀔 때만 다시 보낸다) */
  let lightSent: LightingPhase | null = null;
  let tensionKey: string | null = "0";
  /** 핀 조명(결정 0066-6): 켜짐 수준 0~1, 마지막으로 비춘 자리, 이어짐 키(다른 좌석으로 건너뛰면 다시 켠다), 렌더러·훅에 마지막으로 보낸 키 */
  let pinK = 0;
  let pinPos: { x: number; z: number } | null = null;
  let pinSeatKey: string | null = null;
  let pinSentKey: string | null = "-";
  let pinHookKey: string | null = null;
  /** 분필 윤곽: 마지막으로 렌더러에 보낸 자리·불투명도 키(바뀔 때만 다시 보낸다) */
  let chalkKey: string | null = "-";
  /** 분필 자리 키(불투명도 제외)와 그려지기 시작한 시각(ms, 그리는 중이 아니면 null). 장면이 있는 프레임에서 분필이 없던 적이 있어야 '새로 나타남' 이다(첫 장면·재접속은 즉시) */
  let chalkPos = "-";
  let chalkDrawFrom: number | null = null;
  let chalkSawNone = false;
  /** 내 캐릭터 빛: 마지막으로 보낸 자리 키(nightCitizen 이 아니면 "-") */
  let selfLightKey: string | null = "-";
  let zoomSent = 1;
  /** 지금 그리는 확대와, 고정 카메라로 옮기는 중인 전환(고정이 아니면 null) */
  let zoomCur = 1;
  let fixed: { zoom: number; start: number; from: { x: number; z: number; off: number; zoom: number } } | null = null;
  let zoomBackFrom = 1;
  let zoomBackStart = 0;
  /** 이 좌석을 그리나: 장면이 없으면 view 의 모든 좌석, 있으면 표에서 show 인 좌석만 */
  const isShown = (seat: number): boolean => look === null || look.seats[seat]?.show === true;
  /** 처형 연출이 끝나 사라졌어야 하는 좌석인가(표에 아직 남아 있어도 다시 만들지 않는다). 유령 시점의 ghost 좌석은 연출 없이 유령으로 남는다 */
  const fadeEnded = (seat: number, now: number): boolean => {
    const l = look?.seats[seat];
    return l !== undefined && !l.ghost && l.fadeAt !== undefined && executionFade(now - l.fadeAt, deps.reducedMotion()).hidden;
  };
  const mix = (a: number, b: number, e: number): number => (e >= 1 ? b : a + (b - a) * e);

  const actors = new Map<number, Actor>();
  const pendingEntered = new Set<number>();
  // 서버 동작 프레임(10-03, D-9): 눌렀을 때 미리 재생하는 경로는 없다 — 보낸 사람도 이 프레임으로만 재생한다
  let lastEmote: { seat: number; id: EmoteId; n: number } | null = null;
  /** 지금 재생 중인 사람 동작(도착 순서). 상한 EMOTE_RENDER_MAX 를 지킨다 — 시스템 반응 deny 는 넣지 않는다 */
  let emotePlaying: PlayingEmote[] = [];
  function emitEmotes(): void {
    deps.onEmotes?.({ last: lastEmote === null ? null : { ...lastEmote }, playing: emotePlaying.map((p) => p.seat) });
  }
  function stopHandleEmote(seat: number): void {
    (actors.get(seat)?.handle as PlayableCharacter | undefined)?.stopEmote?.();
  }
  /** seat 이 지금 사람 동작을 재생 중인가(끝난 항목은 아직 걷지 않았어도 아니다) */
  function isEmoting(seat: number, now: number): boolean {
    return emotePlaying.some((p) => p.seat === seat && p.until > now);
  }
  /** 끝난 항목·걷는 좌석을 목록에서 걷어 내고 바뀌었으면 알린다 */
  function sweepEmotes(now: number, walking: ReadonlySet<number>): void {
    if (emotePlaying.length === 0) return;
    const next = emotePlaying.filter((p) => p.until > now && !walking.has(p.seat) && actors.has(p.seat));
    if (next.length === emotePlaying.length) return;
    emotePlaying = next;
    emitEmotes();
  }
  const offEmote = store.onEmote((f) => {
    if (disposed) return;
    const a = actors.get(f.seat);
    if (a === undefined || a.exit !== null) return;
    const now = Date.now();
    // 상한: 새 동작은 항상 재생하고, 넘치면 가장 먼저 시작한 것을 부드럽게 끝낸다(D-13). 순서는 도착 순서다
    const reduced = deps.reducedMotion();
    const admitted = admitEmote(emotePlaying, { seat: f.seat, until: now + emoteDurationMs(f.id, reduced) }, now, EMOTE_RENDER_MAX);
    for (const seat of admitted.stopSeats) stopHandleEmote(seat);
    emotePlaying = admitted.playing;
    (a.handle as PlayableCharacter).playEmote?.(f.id, { reduced }); // 모션 줄이기에서도 다른 사람의 동작은 정보라 재생한다(O-5)
    lastEmote = { seat: f.seat, id: f.id, n: f.n };
    emitEmotes();
  });
  const gate = createTapGate();
  let ring: Ring | null = null;
  // 내 이동 추적(결정 0059-2): 보낸 move 와 서버가 적용한 move 수를 맞춰 응답을 알아보고, 예측 구간을 든다
  const own = createOwnMoves(store.moveSeqOf(deps.mySeat()));
  let ackTimer: ReturnType<typeof setTimeout> | null = null;
  let lastDrawAt = 0;
  let cue: { at: { x: number; z: number }; start: number } | null = null;
  let cueTimer: ReturnType<typeof setTimeout> | null = null;
  let cueStarted = false;

  let lastFrameAt = 0;
  let cam: { x: number; z: number } | null = null;
  let lastEpoch = store.currentEpoch();
  let resync = true;
  let offsetCur: number | null = null;
  let offsetTarget = 0;
  let offsetFrom = 0;
  let offsetStart = 0;
  let seenSize = { w: 0, h: 0 };
  let resizeTimer: ReturnType<typeof setTimeout> | null = null;

  function size(): { w: number; h: number } {
    const w = host.clientWidth || (typeof window !== "undefined" ? window.innerWidth : 0) || 1;
    const h = host.clientHeight || (typeof window !== "undefined" ? window.innerHeight : 0) || 1;
    return { w, h };
  }

  // ---------- 상태기계 ----------

  function dispatch(e: MapStatusEvent): void {
    const prev = status;
    const next = mapStatusReducer(prev, e);
    if (next === prev) return;
    status = next;
    deps.onStatus(next);
    if (next.status === "ready") {
      if (prev.status === "loading") {
        markInteractive();
        startCueWait();
      } else {
        resync = true; // 복구·재생성 뒤 첫 프레임: 카메라와 모든 캐릭터를 서버 위치에 바로 놓는다
        lightSent = null; // 새 렌더러에는 조명·긴장·확대를 다시 보낸다
        tensionKey = null;
        pinSentKey = null;
        chalkKey = null;
        selfLightKey = null;
        zoomSent = Number.NaN;
      }
    }
    // 소실·재생성 동안만 1초 tick 으로 시간을 알린다
    const ticking = next.status === "lost" || next.status === "recreating";
    if (ticking && tickTimer === null) {
      tickTimer = setInterval(() => {
        // 숨은 탭에서는 세지 않는다. 돌아오면 onVisibility 의 visible 이벤트가 시계를 그때부터 다시 시작한다(06 리뷰 WR-02).
        if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
        dispatch({ t: "tick", now: Date.now() });
      }, TICK_MS);
    } else if (!ticking && tickTimer !== null) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
    // 렌더러 재생성은 소실 한 번에 한 번이다(T-06-06)
    if (shouldRecreate(prev, next) && renderer !== null) {
      renderer
        .recreate()
        .then(() => {
          if (!disposed && status.status === "recreating") dispatch({ t: "recreated" });
        })
        .catch(() => {
          // 재생성이 실패하면 5초 tick 이 [새로 고침] 카드로 끝낸다
        });
    }
  }

  function markInteractive(): void {
    if (interactiveAt !== null) return;
    try {
      const mark = performance.mark("map-interactive");
      interactiveAt = mark?.startTime ?? performance.now();
    } catch {
      interactiveAt = typeof performance !== "undefined" ? performance.now() : 0;
    }
  }

  /** 렌더러가 알리는 소실·복구·재생성을 상태기계로 넣는다 */
  function onRendererStatus(e: RendererStatusEvent): void {
    if (disposed) return;
    if (e.t === "lost") {
      if (status.status === "loading") {
        // 불러오는 중의 소실은 리듀서가 무시한다 — 불러오기 실패로 처리하고 렌더러를 정리한다
        dispatch({ t: "loadError" });
        teardownRenderer();
      } else {
        dispatch({ t: "lost", at: Date.now() });
      }
      return;
    }
    dispatch({ t: e.t });
  }

  function onVisibility(): void {
    if (disposed || renderer === null) return;
    if (document.visibilityState === "hidden") {
      if (rafId !== null) caf(rafId);
      rafId = null;
      return;
    }
    if (renderer.isContextLost()) dispatch({ t: "visible", contextLost: true, at: Date.now() });
    resync = true;
    lastFrameAt = Date.now();
    schedule();
  }

  /** 렌더러와 캐릭터를 정리한다(불러오는 중 소실, dispose) */
  function teardownRenderer(): void {
    if (rafId !== null) caf(rafId);
    rafId = null;
    offRendererStatus?.();
    offRendererStatus = null;
    clearRing();
    hideCue();
    const r = renderer;
    renderer = null;
    kit = null;
    for (const a of actors.values()) {
      cancelPrewarm(a);
      r?.removeCharacter(a.seat);
      a.handle.dispose();
    }
    actors.clear();
    cam = null;
    offsetCur = null;
    resync = true;
    r?.dispose();
  }

  // ---------- 불러오기 ----------

  async function boot(): Promise<void> {
    const gen = ++bootGen;
    const alive = (): boolean => !disposed && gen === bootGen;
    let mods: WorldModules;
    try {
      mods = await (deps.loadModules ?? loadWorld)();
    } catch {
      if (alive()) dispatch({ t: "loadError" });
      return;
    }
    if (!alive()) return;
    const s = size();
    let r: WorldRenderer;
    try {
      r = await mods.createThreeRenderer({ host, width: s.w, height: s.h, budgetStep: degrade.step(), allowSoftware: deps.allowSoftware });
    } catch {
      if (alive()) dispatch({ t: "unsupported" });
      return;
    }
    if (!alive()) {
      r.dispose();
      return;
    }
    renderer = r;
    kit = mods.characterKit;
    seenSize = s;
    offRendererStatus = r.onStatus(onRendererStatus);
    lightSent = deps.lighting ?? "talk";
    r.setLighting(lightSent);
    syncPlayers();
    lastFrameAt = Date.now();
    schedule();
  }

  // ---------- 사람 ----------

  function applyDim(a: Actor, dim: boolean): void {
    if (a.dim === dim) return;
    a.dim = dim;
    a.handle.setDim(dim);
  }

  /** 유령 직업 의상 표가 바뀌었나(적용·해제·액터 제거) — 프레임 끝에서 한 번 알린다 */
  let ghostOutfitsDirty = false;
  function emitGhostOutfits(): void {
    if (!ghostOutfitsDirty) return;
    ghostOutfitsDirty = false;
    const map: Record<number, string> = {};
    for (const a of actors.values()) if (a.ghostOutfit !== null) map[a.seat] = a.ghostOutfit;
    deps.onGhostOutfits?.(map);
  }

  /** 동작이 쓰는 표정의 머리 병합을 표정마다 따로 유휴 시간에 미리 만든다(O-10). requestIdleCallback 이 없으면 첫 사용 때 병합한다 */
  const PREWARM_ORDER = ["angry", "sus", "surprise", "happy", "cry"] as const;
  type IdleScheduler = { requestIdleCallback?: (cb: () => void) => number; cancelIdleCallback?: (id: number) => void };
  function prewarmLater(a: Actor, i = 0): void {
    const ric = (globalThis as IdleScheduler).requestIdleCallback;
    if (typeof ric !== "function" || i >= PREWARM_ORDER.length) {
      a.idleId = null;
      return;
    }
    a.idleId = ric(() => {
      a.idleId = null;
      if (disposed || actors.get(a.seat) !== a) return;
      (a.handle as PlayableCharacter).prewarm?.(PREWARM_ORDER[i]);
      prewarmLater(a, i + 1);
    });
  }
  function cancelPrewarm(a: Actor): void {
    if (a.idleId === null) return;
    (globalThis as IdleScheduler).cancelIdleCallback?.(a.idleId);
    a.idleId = null;
  }

  /** 그리는 좌석의 고른 의상 표가 바뀌었을 때만 알린다(E2E 훅용). 안개 의상과 무관하게 a.look 이다 */
  let looksSent = "";
  function emitLooks(): void {
    if (deps.onLooks === undefined) return;
    const map: Record<number, string> = {};
    for (const a of actors.values()) map[a.seat] = a.look;
    const sig = JSON.stringify(map);
    if (sig === looksSent) return;
    looksSent = sig;
    deps.onLooks(map);
  }

  function lookOf(seat: number): string {
    return deps.players().find((p) => p.seat === seat)?.look ?? DEFAULT_LOOK;
  }

  function removeActor(a: Actor): void {
    cancelPrewarm(a);
    if (a.ghostOutfit !== null) ghostOutfitsDirty = true;
    renderer?.removeCharacter(a.seat);
    a.handle.dispose();
    actors.delete(a.seat);
    emitLooks();
  }

  function beginExit(seat: number, now: number): void {
    const a = actors.get(seat);
    if (a === undefined || a.exit !== null) return;
    if (deps.reducedMotion()) removeActor(a);
    else a.exit = now;
  }

  /** view 가 바뀔 때마다: view 에 없는 seat 의 구간을 지우고 퇴장 연출, 끊김 어둡게를 맞춘다 */
  function syncPlayers(): void {
    if (disposed) return;
    const players = deps.players();
    const now = Date.now();
    for (const seat of store.retainSeats(players.map((p) => p.seat))) beginExit(seat, now);
    for (const p of players) {
      const a = actors.get(p.seat);
      if (a === undefined) continue;
      applyDim(a, !p.connected);
      // 서버가 준 look 이 바뀌면 그 좌석만 갈아입는다. 안개 중이면 안개 의상을 건드리지 않고 값만 갱신한다(안개가 끝날 때 최신 look 으로 돌아온다)
      const want = p.look ?? DEFAULT_LOOK;
      if (want !== a.look) {
        a.look = want;
        if (a.ghostOutfit === null) a.handle.applyOutfit?.(want);
      }
    }
    emitLooks();
    // 닉네임·표시가 바뀔 수 있어 이름표 폭을 다음 프레임에 다시 잰다
    for (const a of actors.values()) a.tagW = null;
  }

  function createActor(seat: number, now: number): void {
    if (renderer === null || kit === null) return;
    const look = lookOf(seat);
    const handle = kit.create(figIndexForSeat(seat), look);
    const at = store.positionOf(seat, deps.serverNow());
    const a: Actor = {
      seat,
      handle,
      idleId: null,
      base: handle.root.scale.x,
      pos: at ?? { x: 0, z: 0 },
      seg: store.segOf(seat),
      off: { x: 0, z: 0 },
      offAt: now,
      yaw: spawnYaw(seat),
      yawGoal: null,
      headY: 0,
      dim: false,
      pointing: false,
      ringKind: null,
      pickMark: false,
      fadeOpacity: 1,
      ghost: false,
      ghostOutfit: null,
      look,
      enter: null,
      exit: null,
      tag: null,
      tagStyle: "",
      tagAlpha: "",
      tagZ: "",
      tagW: null,
      tagFront: false,
    };
    // 첫 snap 에 있던 사람은 바로 서 있고, 뒤에 move 로 들어온 사람만 내려앉는다
    if (pendingEntered.delete(seat) && !deps.reducedMotion()) a.enter = now;
    handle.setYaw(a.yaw);
    handle.root.position.set(a.pos.x, 0, a.pos.z);
    renderer.addCharacter(seat, handle);
    actors.set(seat, a);
    prewarmLater(a);
    const p = deps.players().find((q) => q.seat === seat);
    if (p !== undefined) applyDim(a, !p.connected);
    emitLooks();
  }

  // ---------- 링·손짓 링 ----------

  function clearAckTimer(): void {
    if (ackTimer === null) return;
    clearTimeout(ackTimer);
    ackTimer = null;
  }

  function clearRing(): void {
    if (ring === null) return;
    ring = null;
    renderer?.setMarker("ring", null, 1, 0);
    deps.onRing?.(null);
  }

  function ackRing(g: Ring, s: Segment, now: number): void {
    g.acked = true;
    const n = s.p.length;
    const to = n >= 2 ? { x: (s.p[n - 2] ?? 0) / UNIT, z: (s.p[n - 1] ?? 0) / UNIT } : g.at;
    g.endsAt = segmentEndsAt(s);
    g.target = to;
    if (deps.reducedMotion()) {
      g.at = { ...to };
    } else {
      g.from = { ...g.at };
      g.to = to;
      g.slideStart = now;
    }
    deps.onRing?.(to);
  }

  /**
   * 핀 조명(결정 0066-6): look.pin 과 서버 시각으로 비출 자리를 정하고 켜짐 수준을 180ms 켜기·420ms 끄기로 옮겨 렌더러에 보낸다(바뀔 때만).
   * 대상 좌석의 캐릭터가 없으면 핀을 끈다. 다른 좌석으로 건너뛰면(미끄러짐이 아닌 다음 차례) 수준을 0 으로 내려 다시 켠다. 렌더러의 광원·메시는 늘리지 않는다
   */
  function updatePin(r: WorldRenderer, dtMs: number, sNow: number, reduced: boolean): void {
    const desc = look?.pin ?? null;
    const at = pinAt(desc, sNow, reduced);
    let pos: { x: number; z: number } | null = null;
    let seatKey: string | null = null;
    if (at.on && desc !== null) {
      if (desc.mode === "point") {
        pos = { x: desc.x, z: desc.z };
        seatKey = "p";
      } else if (desc.mode === "turn" || desc.mode === "fixed") {
        const a = actors.get(desc.seat)?.pos;
        if (a !== undefined) pos = { x: a.x, z: a.z };
        seatKey = `s${desc.seat}`;
      } else {
        const a = actors.get(desc.from)?.pos;
        const b = actors.get(desc.to)?.pos;
        if (a !== undefined && b !== undefined) pos = { x: a.x + (b.x - a.x) * at.t, z: a.z + (b.z - a.z) * at.t };
        seatKey = `s${desc.from}`;
      }
    }
    const want = pos !== null;
    if (pos !== null) {
      if (pinK > 0 && pinSeatKey !== null && seatKey !== pinSeatKey) pinK = 0;
      pinSeatKey = seatKey;
      pinPos = pos;
    }
    pinK = pinLevel(pinK, want, dtMs, reduced);
    const lit = pinK > 0 && pinPos !== null;
    const { strength, dim } = pinLights(pinK);
    const key = lit ? `${pinPos!.x.toFixed(2)},${pinPos!.z.toFixed(2)}|${Math.round(strength / 0.02)}|${Math.round(dim / 0.02)}` : "-";
    if (key !== pinSentKey) {
      pinSentKey = key;
      r.setPin?.(lit ? { x: pinPos!.x, z: pinPos!.z, strength } : null, lit ? dim : 1);
    }
    if (deps.onPin !== undefined) {
      const seat = want ? (at.seat ?? null) : null;
      const moving = want && at.moving;
      const hookKey = `${seat ?? "-"}|${moving ? 1 : 0}|${pinK <= 0 ? 0 : Math.max(1, Math.round(pinK / 0.05))}`; // 0 은 따로 구분한다(꺼짐 도착을 놓치지 않게)
      if (hookKey !== pinHookKey) {
        pinHookKey = hookKey;
        deps.onPin({ seat, moving, strength: pinK });
      }
    }
  }

  function updateRing(r: WorldRenderer, now: number, sNow: number): void {
    const g = ring;
    if (g === null) return;
    if (g.acked) {
      if (g.from !== null && g.to !== null) {
        const p = Math.min(1, (now - g.slideStart) / RING_MS);
        const e = easeOut(p);
        g.at = { x: g.from.x + (g.to.x - g.from.x) * e, z: g.from.z + (g.to.z - g.from.z) * e };
        if (p >= 1) {
          g.at = { ...g.to };
          g.from = null;
          g.to = null;
        }
      }
      if (g.fadeStart === null && sNow >= g.endsAt) g.fadeStart = now;
    }
    let opacity = 1;
    if (g.fadeStart !== null) {
      const p = (now - g.fadeStart) / RING_MS;
      if (p >= 1) {
        clearRing();
        return;
      }
      opacity = 1 - p;
    }
    r.setMarker("ring", g.at, pulse(now), opacity);
  }

  function pulse(elapsed: number): number {
    if (deps.reducedMotion()) return 1;
    return 1 + (PULSE_MAX - 1) * Math.sin(Math.PI * ((elapsed % PULSE_MS) / PULSE_MS));
  }

  function readCueKey(): boolean {
    try {
      return storage?.getItem(WALK_CUE_KEY) != null;
    } catch {
      return false;
    }
  }

  function writeCueKey(): void {
    try {
      storage?.setItem(WALK_CUE_KEY, "1");
    } catch {
      // 저장소를 못 쓰는 환경(개인 모드): 이번 방문에서만 본다
    }
  }

  /** 맵이 처음 열린 뒤 600ms 에 손짓 링을 띄운다(처음 방문한 기기에서만) */
  function startCueWait(): void {
    if (cueStarted) return;
    cueStarted = true;
    if (readCueKey()) return;
    cueTimer = setTimeout(() => {
      cueTimer = null;
      const mine = actors.get(deps.mySeat());
      if (disposed || mine === undefined) return;
      const k = Math.SQRT1_2 * CUE_AHEAD; // 화면 아래 방향 = +x +z
      const p = snapToWalkable(BAR_MAP, { x: Math.round((mine.pos.x + k) * UNIT), z: Math.round((mine.pos.z + k) * UNIT) });
      cue = { at: { x: p.x / UNIT, z: p.z / UNIT }, start: Date.now() };
      writeCueKey();
    }, CUE_DELAY_MS);
  }

  function hideCue(): void {
    if (cueTimer !== null) {
      clearTimeout(cueTimer);
      cueTimer = null;
    }
    if (cue !== null) {
      cue = null;
      renderer?.setMarker("cue", null, 1, 0);
    }
  }

  function updateCue(r: WorldRenderer, now: number): void {
    if (cue === null) return;
    const elapsed = now - cue.start;
    const reduced = deps.reducedMotion();
    if (elapsed >= (reduced ? CUE_REDUCED_MS : CUE_PULSES * PULSE_MS)) {
      hideCue();
      return;
    }
    r.setMarker("cue", cue.at, pulse(elapsed), 1);
  }

  // ---------- 프레임 ----------

  function schedule(): void {
    if (disposed || rafId !== null || renderer === null) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return; // 숨겨진 동안은 그리지 않는다(배터리)
    rafId = raf(frame);
  }

  let lastFrameErrorAt = -Infinity;

  /** 프레임 한 번의 예외는 로그로 남기되 루프를 멈추지 않는다. 계속 던져도 로그는 1초에 한 번만 낸다 */
  function reportFrameError(err: unknown): void {
    const at = Date.now();
    if (at - lastFrameErrorAt < FRAME_ERROR_LOG_MS) return;
    lastFrameErrorAt = at;
    console.error("[world] 프레임 처리 중 오류 — 다음 프레임에서 계속합니다", err);
  }

  function frame(): void {
    rafId = null;
    const r = renderer;
    if (disposed || r === null) return;
    try {
      drawFrame(r);
    } catch (err) {
      reportFrameError(err);
    } finally {
      // 한 프레임의 throw 가 다음 프레임 예약을 막아 맵이 영구 정지하지 않게 한다(06 리뷰 WR-01)
      schedule();
    }
  }

  function drawFrame(r: WorldRenderer): void {
    const now = Date.now();
    const gapMs = now - lastFrameAt;
    const dt = Math.min(Math.max(gapMs / 1000, 0), MAX_DT);
    lastFrameAt = now;
    const sNow = deps.serverNow();
    const reduced = deps.reducedMotion();

    // 새 연결의 첫 프레임: 날아가지 않고 서버 위치에 바로 붙는다
    const epoch = store.currentEpoch();
    if (epoch !== lastEpoch) {
      lastEpoch = epoch;
      resync = true;
      own.reset(store.moveSeqOf(deps.mySeat()));
      clearAckTimer();
      clearRing(); // 알림 없이 거둔다 — 새 연결의 서버 위치가 진실이다
    } else {
      const ev = own.observe(store.moveSeqOf(deps.mySeat()), store.segOf(deps.mySeat()));
      if (ev === "answered") {
        clearAckTimer();
        const mineSeg = store.segOf(deps.mySeat());
        if (ring !== null && !ring.acked && mineSeg !== undefined) ackRing(ring, mineSeg, now);
      } else if (ev === "reset") {
        clearAckTimer();
        clearRing();
      }
    }

    for (const seat of store.takeEntered()) pendingEntered.add(seat);
    for (const seat of store.seats()) {
      if (!actors.has(seat) && isShown(seat) && !fadeEnded(seat, now)) createActor(seat, now);
    }

    const gone: Actor[] = [];
    const walkingSeats = new Set<number>(); // 이번 프레임 걸은 좌석 — 동작이 끊긴 것으로 보아 재생 목록에서 뺀다
    const mySeat = deps.mySeat();
    for (const a of actors.values()) {
      const server = store.segOf(a.seat);
      if ((server === undefined || !isShown(a.seat)) && a.exit === null) {
        beginExit(a.seat, now); // 구간이 없어졌다(snap 에서 빠짐) 또는 장면이 이 좌석을 그리지 않는다
        if (!actors.has(a.seat)) continue; // 모션 줄이기면 바로 지워졌다
      }
      if (fadeEnded(a.seat, now)) {
        // 처형 연출이 끝났다: 산 사람 화면에서 이 좌석은 사라진다
        removeActor(a);
        if (a.tag !== null) a.tag.style.opacity = "0";
        continue;
      }
      const seatLook = look?.seats[a.seat];
      const wantGhost = seatLook?.ghost === true;
      // 유령 직업 의상 + 안개(09.1-09, B-3): 의상 교체와 재질은 같은 프레임에 — 의상 먼저, 그다음 안개. 의상은 장면 표(spectate 에서 온 값)에 있을 때만
      const wantOutfit = wantGhost ? (seatLook?.outfit ?? null) : null;
      if (wantOutfit !== null) {
        if (wantOutfit !== a.ghostOutfit || !a.ghost) {
          if (wantOutfit !== a.ghostOutfit) a.handle.applyOutfit?.(wantOutfit);
          a.ghost = true;
          a.ghostOutfit = wantOutfit;
          a.handle.setGhost?.(true, GHOST_MIST.opacity, { color: GHOST_MIST.emissive, intensity: GHOST_MIST.intensity });
          ghostOutfitsDirty = true;
        }
      } else if (wantGhost !== a.ghost) {
        a.ghost = wantGhost;
        a.handle.setGhost?.(wantGhost);
        if (a.ghostOutfit !== null) {
          a.ghostOutfit = null;
          ghostOutfitsDirty = true;
        }
      }
      // 손가락 자세: 지목 중인 좌석만 유지하고, 풀리면 평소 자세로 돌아온다
      const pointAt = seatLook?.pointAt;
      if ((pointAt !== undefined) !== a.pointing) {
        a.pointing = pointAt !== undefined;
        a.handle.holdPose?.(a.pointing ? "point" : null);
      }
      // 그릴 구간: 내 자리는 예측 중이면 예측, 남은 언제나 서버 구간(결정 0059-4)
      const eff = a.exit !== null || server === undefined ? undefined : a.seat === mySeat ? own.effective(server) : server;
      const live = eff === undefined ? null : positionAt(eff, sNow);
      if (eff !== undefined && eff !== a.seg) {
        // 구간이 바뀌었다: 새 구간이 직전 프레임에도 이어졌다면 있었을 자리와 지금 그린 자리의 차이를 잡는다(한 프레임 걸음은 차이가 아니다)
        const was = positionAt(eff, sNow - Math.max(gapMs, 0));
        const ox = a.pos.x - was.x;
        const oz = a.pos.z - was.z;
        const far = ox * ox + oz * oz > BLEND_SNAP_DIST * BLEND_SNAP_DIST;
        a.off = resync || reduced || far ? { x: 0, z: 0 } : { x: ox, z: oz };
        a.offAt = now;
      }
      if (eff !== undefined || a.exit !== null) a.seg = eff;
      if (resync || reduced) a.off = { x: 0, z: 0 };
      const keep = live === null ? 0 : blendRemaining(now - a.offAt);
      const at = live === null ? a.pos : { x: live.x + a.off.x * keep, z: live.z + a.off.z * keep };
      const dx = at.x - a.pos.x;
      const dz = at.z - a.pos.z;
      const moving = !resync && dx * dx + dz * dz > MOVE_EPS * MOVE_EPS;
      if (moving) walkingSeats.add(a.seat);
      // 방향: 걷는 선분의 방향으로 짧은 쪽으로 돌되 한 프레임에 YAW_TURN_RATE × dt 까지만(모션 줄이기면 바로). 복귀 프레임은 건드리지 않는다
      if (resync) {
        a.yawGoal = null;
      } else {
        const target = eff === undefined ? null : travelYaw(eff, sNow);
        if (target !== null) a.yawGoal = target;
        else if (pointAt !== undefined) {
          // 서 있는 채 가리킨다: 대상 쪽을 본다(걷는 중에는 걷는 방향이 먼저)
          const tp = actors.get(pointAt)?.pos;
          if (tp !== undefined && (tp.x !== at.x || tp.z !== at.z)) a.yawGoal = Math.atan2(tp.x - at.x, tp.z - at.z);
        }
        if (a.yawGoal !== null) {
          const next = reduced ? a.yawGoal : stepYaw(a.yaw, a.yawGoal, dt);
          if (next !== a.yaw) {
            a.yaw = next;
            a.handle.setYaw(a.yaw);
          }
        }
      }
      a.pos = { x: at.x, z: at.z };

      // 등장·퇴장 연출: 크기·높이는 캐릭터에, 불투명도는 이름표에
      let scale = 1;
      let lift = 0;
      let alpha = 1;
      if (a.exit !== null) {
        const p = Math.min(1, (now - a.exit) / EXIT_MS);
        scale = 1 - (1 - ENTER_SCALE) * p;
        alpha = 1 - p;
        if (p >= 1) gone.push(a);
      } else if (a.enter !== null) {
        const p = Math.min(1, (now - a.enter) / ENTER_MS);
        const e = easeOut(p);
        scale = ENTER_SCALE + (1 - ENTER_SCALE) * e;
        lift = ENTER_LIFT * (1 - e);
        alpha = e;
        if (p >= 1) a.enter = null;
      }
      // 처형 연출(fadeAt): 떠오르며 흐려진다. 유령 시점의 ghost 좌석은 연출 없이 유령으로 남는다
      let rise = 0;
      let fade = 1;
      const fadeAt = wantGhost ? undefined : seatLook?.fadeAt;
      if (fadeAt !== undefined && a.exit === null) {
        const f = executionFade(now - fadeAt, reduced);
        rise = f.rise;
        fade = f.opacity;
      }
      if (fade !== a.fadeOpacity) {
        a.fadeOpacity = fade;
        a.handle.setOpacity?.(fade === 1 && a.ghost ? (a.ghostOutfit !== null ? GHOST_MIST.opacity : GHOST_OPACITY) : fade);
      }
      alpha = Math.min(alpha, fade);
      // 높이: 등장 낙하 + (장면이 있을 때) 무대 위 0.29 + 유령 떠다님 + 처형 떠오름
      const y = lift + (look === null ? 0 : stageLiftY(at)) + (a.ghost ? ghostFloatY(now / 1000, reduced) : 0) + rise;
      a.handle.root.scale.setScalar(a.base * scale);
      a.handle.root.position.set(at.x, y, at.z);
      a.headY = y + a.handle.update(dt, now / 1000, moving).headY * scale;
      a.tagAlpha = alpha === 1 ? "1" : String(Math.round(alpha * 1000) / 1000);
    }

    // 카메라: 기본은 내 캐릭터를 따라간다(한계 상자 안에서). 장면이 고정이면 모이는 자리 구도로 옮긴 뒤 움직이지 않는다(UI-SPEC 카메라 표)
    const s = size();
    const rect = deps.stageRect();
    const stageOff = stageOffsetY(s.h, rect.top, rect.bottom);
    const camLook = look?.camera;
    let offsetGoal = stageOff;
    let blending = false;
    if (camLook !== undefined && camLook.mode === "fixed") {
      // zoomMs 가 있는 구도(판결 순간 느린 확대, 09.1.1-13): 위치·세로 오프셋·줌이 모두 그 시간에 ease-in-out 으로 같이 간다. 모션 줄이기는 줌 없이 1 을 지킨다
      const slow = camLook.zoomMs !== undefined;
      const goalZoom = slow && reduced ? 1 : camLook.zoom;
      const g = gatherView(rect, { w: s.w, h: s.h }, { ghost: look?.seats[deps.mySeat()]?.ghost === true, zoom: goalZoom });
      offsetGoal = g.offsetY;
      if (fixed === null || fixed.zoom !== goalZoom) {
        const here = cam ?? DEFAULT_TARGET;
        fixed = { zoom: goalZoom, start: now, from: { x: here.x, z: here.z, off: offsetCur ?? stageOff, zoom: zoomCur } };
      }
      // 모션 줄이기·재접속 첫 프레임은 블렌드를 끝난 것으로 만든다(다음 프레임에 처음 값으로 되돌아가 다시 시작하지 않게)
      if (reduced || resync) fixed.start = Number.NEGATIVE_INFINITY;
      const p = Math.min(1, (now - fixed.start) / (camLook.zoomMs ?? CAM_SLOW_MS));
      const e = slow ? easeInOut(p) : easeOut(p);
      cam = { x: mix(fixed.from.x, g.target.x, e), z: mix(fixed.from.z, g.target.z, e) };
      zoomCur = mix(fixed.from.zoom, goalZoom, e);
      if (p < 1) {
        blending = true;
        offsetCur = mix(fixed.from.off, g.offsetY, e);
        offsetTarget = g.offsetY;
        offsetFrom = offsetCur;
        offsetStart = now;
      }
    } else {
      if (fixed !== null) {
        fixed = null;
        zoomBackFrom = zoomCur;
        zoomBackStart = now;
      }
      const mine = actors.get(deps.mySeat());
      const goal = clampTarget(mine ? mine.pos : DEFAULT_TARGET);
      cam = cam === null || resync ? goal : followStep(cam, goal, dt * 1000, reduced);
      if (zoomCur !== 1) zoomCur = mix(zoomBackFrom, 1, reduced || resync ? 1 : easeOut(Math.min(1, (now - zoomBackStart) / CAM_SLOW_MS)));
    }

    // 스테이지 사각형이 바뀌면(패널 높이·헤더) 장면을 dur-fast 에 걸쳐 옮긴다
    if (!blending) {
      if (offsetCur === null || resync || reduced) {
        offsetCur = offsetGoal;
        offsetTarget = offsetGoal;
      } else {
        if (offsetGoal !== offsetTarget) {
          offsetFrom = offsetCur;
          offsetTarget = offsetGoal;
          offsetStart = now;
        }
        const p = Math.min(1, (now - offsetStart) / RESIZE_SETTLE_MS);
        offsetCur = offsetFrom + (offsetTarget - offsetFrom) * p;
      }
    }
    offsetCur ??= offsetGoal;
    r.setView(cam, offsetCur);
    if (zoomCur !== zoomSent) {
      zoomSent = zoomCur;
      r.setZoom?.(zoomCur);
      deps.onZoom?.(Math.round(zoomCur * 1000) / 1000);
    }

    // 단계 조명·긴장: 바뀐 때만 렌더러에 보낸다. 장면이 없으면 부팅 때 정한 조명(로비·성능 스파이크)
    const wantLight = look?.lighting ?? deps.lighting ?? "talk";
    if (wantLight !== lightSent) {
      lightSent = wantLight;
      r.setLighting(wantLight);
    }
    const tension = look?.tension ?? 0;
    const focusPos = tension > 0 && look?.focusSeat !== undefined ? actors.get(look.focusSeat)?.pos : undefined;
    const nextTensionKey = tension === 0 ? "0" : `${tension}|${focusPos === undefined ? "-" : `${focusPos.x.toFixed(2)},${focusPos.z.toFixed(2)}`}`;
    if (nextTensionKey !== tensionKey) {
      tensionKey = nextTensionKey;
      r.setTension?.(tension, focusPos === undefined ? undefined : { x: focusPos.x, z: focusPos.z });
    }

    updatePin(r, dt * 1000, sNow, reduced);

    // 내 캐릭터 빛(NIGHT-07): nightCitizen 조명에서만 내 캐릭터 위로 따라가고, 다른 단계에서는 기본 자리(세기는 조명 단계가 0 으로 만든다).
    // 광원은 렌더러가 처음부터 갖고 있다 — 여기서 만들거나 지우지 않는다(Pitfall 7)
    const selfAt = wantLight === "nightCitizen" ? (actors.get(deps.mySeat())?.pos ?? null) : null;
    const nextSelfKey = selfAt === null ? "-" : `${selfAt.x.toFixed(3)},${selfAt.z.toFixed(3)}`;
    if (nextSelfKey !== selfLightKey) {
      selfLightKey = nextSelfKey;
      r.setSelfLight?.(selfAt === null ? null : { x: selfAt.x, z: selfAt.z });
    }
    // 분필 윤곽(MORN-01): 서버가 공개한 자리가 있으면 바닥에 그 자리 그대로. 없으면 숨김. 렌더러에 setChalk 가 없으면(가짜 렌더러) 건너뛴다.
    // 같은 연결에서 새로 나타나면 dur-slow(800ms) 동안 0 → 0.85 로 그려진다. 모션 줄이기·첫 장면(재접속)은 바로 0.85 (UI-SPEC 262행, E5 #29)
    const chalk = look?.chalk ?? null;
    const nextChalkPos = chalk === null ? "-" : `${chalk.x.toFixed(3)},${chalk.z.toFixed(3)}`;
    if (nextChalkPos !== chalkPos) {
      chalkPos = nextChalkPos;
      chalkDrawFrom = chalk !== null && !reduced && chalkSawNone ? now : null;
    }
    if (look !== null && chalk === null) chalkSawNone = true;
    if (chalkDrawFrom !== null && now - chalkDrawFrom >= CHALK_DRAW_MS) chalkDrawFrom = null;
    const chalkOpacity = chalkDrawFrom === null ? CHALK_FULL : CHALK_FULL * Math.max(0, Math.min(1, (now - chalkDrawFrom) / CHALK_DRAW_MS));
    const nextChalkKey = chalk === null ? "-" : `${chalkPos}|${chalkOpacity.toFixed(3)}`;
    if (nextChalkKey !== chalkKey) {
      chalkKey = nextChalkKey;
      r.setChalk?.(chalk === null ? null : { x: chalk.x, z: chalk.z }, chalkOpacity);
    }

    if (s.w !== seenSize.w || s.h !== seenSize.h) {
      seenSize = s;
      if (resizeTimer !== null) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        if (disposed || renderer === null) return;
        renderer.resize(seenSize.w, seenSize.h);
      }, RESIZE_DEBOUNCE_MS);
    }

    updateRing(r, now, sNow);
    updateCue(r, now);

    // 소실·재생성·포기 중에는 GL 을 그리지 않는다(이름표와 서버 위치 갱신은 계속한다)
    const timed = deps.onFrame !== undefined;
    let renderMs = 0;
    let tagsMs = 0;
    if (status.status === "loading" || status.status === "ready") {
      const a = timed ? performance.now() : 0;
      r.render();
      if (timed) renderMs = performance.now() - a;
    }
    const b = timed ? performance.now() : 0;
    writeTags(r);
    if (timed) tagsMs = performance.now() - b;
    for (const a of gone) {
      removeActor(a);
      if (a.tag !== null) a.tag.style.opacity = "0";
    }
    emitGhostOutfits();
    sweepEmotes(Date.now(), walkingSeats);
    resync = false;
    lastDrawAt = now;

    if (status.status === "loading" && store.isReady()) dispatch({ t: "ready" });
    if (status.status === "ready") degrade.frame(gapMs);
    deps.onFrame?.({ renderMs, tagsMs });
  }

  /**
   * 이름표: 머리 꼭대기 투영 좌표를 장치 픽셀에 반올림해 놓는다(밀지 않는다). 내 이름표가 맨 위, 나머지는 발끝 화면 y 가
   * 큰 쪽이 위이고, 다른 이름표와 겹친 것 가운데 맨 앞 하나에만 래퍼 data-front="true" 를 붙인다(면이 overlay-ink-strong).
   */
  function writeTags(r: WorldRenderer): void {
    const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
    const snap = (v: number): number => Math.round(v * dpr) / dpr;
    const mine = deps.mySeat();
    const live: Actor[] = [];
    for (const a of actors.values()) {
      if (a.tag === null || !a.tag.isConnected) a.tag = tagLayer.querySelector<HTMLElement>(`[data-seat="${a.seat}"]`);
      if (a.tag === null) continue;
      // 폭 읽기는 쓰기보다 먼저 모아 한 번에 한다(레이아웃 강제를 한 번으로)
      if (a.tagW === null) a.tagW = a.tag.offsetWidth;
      live.push(a);
    }
    const boxes: TagBox[] = [];
    for (const a of live) {
      const tag = a.tag;
      if (tag === null) continue;
      const head = r.project({ x: a.pos.x, y: a.headY, z: a.pos.z });
      const x = snap(head.sx);
      const bottom = snap(head.sy - NAMETAG_GAP);
      const style = `translate(${x}px, ${bottom}px) translate(-50%, -100%)`;
      if (style !== a.tagStyle) {
        a.tagStyle = style;
        tag.style.transform = style;
      }
      if (tag.style.opacity !== a.tagAlpha) tag.style.opacity = a.tagAlpha;
      const w = a.tagW !== null && a.tagW > 0 ? a.tagW : NAMETAG_MAX_W;
      boxes.push({ seat: a.seat, me: a.seat === mine, lead: tag.hasAttribute("data-lead"), turn: tag.hasAttribute("data-turn"), foot: r.project({ x: a.pos.x, y: 0, z: a.pos.z }).sy, x, bottom, w });
      // 발밑 고리: 이름표(WorldStage)가 data-ring-kind 로 알린 종류를 캐릭터에 옮긴다(바뀔 때만)
      const kind = tag.getAttribute("data-ring-kind");
      if (kind !== a.ringKind) {
        a.ringKind = kind;
        a.handle.setRing?.(ringColorOfAttr(kind));
      }
      // 마피아 밤 선택 표시(결정 0065): 이름표가 data-night-pick="mine" 으로 알린 좌석만 몸 윤곽·고리 조임을 받는다(바뀔 때만).
      // 이름표 속성은 산 마피아 화면의 WorldStage 만 쓴다 — 다른 화면의 이름표에는 이 속성이 없어 이 분기가 일어나지 않는다.
      const pickOn = tag.getAttribute("data-night-pick") === "mine";
      if (pickOn !== a.pickMark) {
        a.pickMark = pickOn;
        if (pickOn) a.handle.setPickMark?.(true, { color: PICK_OUTLINE_COLOR, animate: !deps.reducedMotion() });
        else a.handle.setPickMark?.(false);
      }
    }
    const bySeat = new Map(live.map((a) => [a.seat, a]));
    for (const { seat, z, front } of rankTags(boxes)) {
      const a = bySeat.get(seat);
      if (a === undefined || a.tag === null) continue;
      const zs = String(z);
      if (a.tagZ !== zs) {
        a.tagZ = zs;
        a.tag.style.zIndex = zs;
      }
      if (a.tagFront !== front) {
        a.tagFront = front;
        if (front) a.tag.setAttribute("data-front", "true");
        else a.tag.removeAttribute("data-front");
      }
    }
  }

  // ---------- 입력 ----------

  function tap(clientX: number, clientY: number): { x: number; z: number } | null {
    if (disposed || renderer === null || inputBlocked(status)) return null;
    if (!gate.accept(Date.now())) return null;
    const rect = host.getBoundingClientRect();
    const at = renderer.groundAt(clientX - rect.left, clientY - rect.top);
    hideCue();
    writeCueKey();
    clearRing();
    const here = { x: at.x, z: at.z };
    ring = { at: here, target: here, from: null, to: null, slideStart: 0, acked: false, endsAt: 0, fadeStart: null };
    renderer.setMarker("ring", here, 1, 1);
    deps.onRing?.(here);
    return { x: at.x, z: at.z };
  }

  function notifyMoveSent(at: number, dest?: { x: number; z: number }): void {
    if (dest === undefined) {
      // 예측 없이 서버 구간만 따른다(성능 스파이크가 move 를 먼저 넣고 부른다): 이미 있는 내 구간으로 링을 바로 맞춘다
      const mineSeg = store.segOf(deps.mySeat());
      if (ring !== null && !ring.acked && mineSeg !== undefined) ackRing(ring, mineSeg, Date.now());
      return;
    }
    own.sent(predictSegment(own.effective(store.segOf(deps.mySeat())), dest, at));
    clearAckTimer();
    ackTimer = setTimeout(() => {
      ackTimer = null;
      if (disposed || !own.expire()) return;
      clearRing();
      deps.onNotice(NETWORK_TEXT);
    }, MOVE_ACK_TIMEOUT_MS);
  }

  return {
    async start() {
      if (!visibilityBound && typeof document !== "undefined") {
        visibilityBound = true;
        document.addEventListener("visibilitychange", onVisibility);
      }
      await boot();
    },
    syncPlayers,
    setScene(l) {
      look = l;
    },
    deny(seat) {
      const a = actors.get(seat) ?? null;
      if (a === null || a.exit !== null) return;
      // 사람이 하는 동작이 먼저다: 재생 중이면 손사래도 놀란 표정도 건너뛴다(상한에도 넣지 않는다)
      if (isEmoting(seat, Date.now())) return;
      const h = a.handle as PlayableCharacter;
      h.playEmote?.("deny");
      h.setFace?.("surprise");
    },
    stopAllEmotes() {
      if (emotePlaying.length === 0) return;
      for (const p of emotePlaying) stopHandleEmote(p.seat);
      emotePlaying = [];
      emitEmotes();
    },
    surprise(seat) {
      const a = actors.get(seat) ?? null;
      if (a === null || a.exit !== null) return;
      (a.handle as PlayableCharacter).setFace?.("surprise");
    },
    tap,
    notifyMoveSent,
    cancelMove: clearRing,
    async retry() {
      dispatch({ t: "retry" });
      await boot();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      offEmote();
      bootGen++;
      if (visibilityBound) document.removeEventListener("visibilitychange", onVisibility);
      if (resizeTimer !== null) clearTimeout(resizeTimer);
      if (cueTimer !== null) clearTimeout(cueTimer);
      if (tickTimer !== null) clearInterval(tickTimer);
      clearAckTimer();
      ring = null;
      cue = null;
      teardownRenderer();
    },
    sample(seat, t) {
      return store.positionOf(seat, t ?? deps.serverNow());
    },
    renderer() {
      return renderer;
    },
    characterOf(seat) {
      return actors.get(seat)?.handle ?? null;
    },
    ring() {
      return ring === null ? null : { ...ring.target };
    },
    shown(seat) {
      const a = actors.get(seat);
      return a === undefined ? null : { x: a.pos.x, z: a.pos.z, at: lastDrawAt };
    },
    status() {
      return status;
    },
    interactiveMs() {
      return interactiveAt;
    },
  };
}
