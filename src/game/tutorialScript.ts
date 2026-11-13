// 첫 사건 대본(17페이즈, 결정 0078-1·7, 0080-9·16·17). 순수 모듈 — 역할·실제 닉네임·연결을 읽지 않는다.
// DOM·window·현재 시각을 읽지 않고, 시각은 모두 인자(now)로 받는다. 화면 계획(17-04 이후)은 이 표를 읽어 실제 게임 부품에 먹이기만 한다.
// 장면 표 한 곳이 그리는 방식·소리 시각·사회자 문구 키·포커스 창·넘어가는 방식을 쥐고(UI-SPEC 첫 사건 장면 계약, 시안 Main.dc.html enter),
// 가짜 방 상태(RoomView)는 출연 상수(TUTORIAL_CAST)로만 만든다 — 서버 값·내 역할·내 닉네임이 섞일 길이 없다.
import { UNIT } from "../../shared/game/map";
import { TOWN_CLUE_SPOTS, TOWN_LAMPS } from "../../shared/game/mapTown";
import { emptyWorld, restSegment, snapFrame } from "../../shared/game/world";
import type { WorldState } from "../../shared/game/world";
import type { ClientMessage, ClueLine, MapChoice, MapId, OutfitId, PhaseId, PlaceId, PublicPlayer, RoomView, WorldFrame } from "../../shared/protocol";
import type { CameraMode, SceneLook, SeatLook } from "../world/presence";

// ---- 타입 ----

export type TutorialSceneNo = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** 사회자 문구 키 9개(UI-SPEC 사회자 문구 표 + 21페이즈 새 문장). 문구는 TUTORIAL_LINES 한 곳에만 있다 */
export type TutorialLineKey =
  | "tutorial.morning.victim"
  | "tutorial.morning.mafia"
  | "tutorial.errand"
  | "tutorial.house"
  | "tutorial.link"
  | "tutorial.secret"
  | "tutorial.vote"
  | "tutorial.vote.wrong"
  | "tutorial.roles";

/** 소리 큐 id — 소리 모듈을 가져오지 않는다(SFX_IDS 와의 대조는 17-04 시험) */
export type TutorialCue =
  | "tut.lampOff"
  | "tut.scream"
  | "tut.whoosh"
  | "tut.sting"
  | "tut.step"
  | "tut.eye"
  | "tut.link"
  | "tut.buzz"
  | "tut.stamp"
  | "tut.fanfare"
  | "tut.flip"
  | "tut.warm"
  | "ui.tap";

/** 장면 시작부터 ms 에 말하거나 소리를 낸다 */
export interface TutorialBeat {
  at: number;
  say?: TutorialLineKey;
  sfx?: TutorialCue;
}

/** 포커스 테두리가 켜지는 창(장면 시작부터 ms). to 가 없으면 그 장면의 행동이 있을 때까지 */
export interface TutorialFocusWindow {
  /**
   * band 사회자 띠 · errand 가로등 타일 + 독 [켜기] · house 집 판 여섯 곳 · inspect 현장 지점 ② + 독 [살펴보기] · suspect 의심 보드의 도윤 칸 · pickTags 지목 이름표.
   * inspect·suspect 가 같이 0 에서 열려 있어도 화면은 상태(살피기 전·보드가 열린 뒤)에 맞는 쪽만 상자를 그린다
   */
  target: "band" | "errand" | "house" | "inspect" | "suspect" | "pickTags";
  from: number;
  to?: number;
}

export type TutorialAdvance =
  | { kind: "auto"; afterMs: number }
  | { kind: "next"; showAtMs: number }
  | { kind: "act"; afterMs: number }
  | { kind: "step"; afterMs: number }
  | { kind: "pick"; revealAfterMs: number }
  | { kind: "end" };

export interface TutorialScene {
  n: TutorialSceneNo;
  id: "opening" | "morning" | "errand" | "house" | "scene" | "vote" | "roles" | "end";
  render: "stage" | "map" | "home";
  dot: boolean;
  beats: readonly TutorialBeat[];
  focus: readonly TutorialFocusWindow[];
  advance: TutorialAdvance;
}

// ---- 상수 ----

/** 오답이 이만큼 쌓이면 오답 이름표의 깜빡임을 끄고 정답 하나만 남긴다(T-8) */
export const WRONG_HINT_AFTER = 2;
/** 진행 점 수 = 장면 1~7, 마무리에는 점 줄이 없다(T-23) */
export const TUTORIAL_DOT_COUNT = 7;
/** 오프닝에서 꺼지는 램프 수(0080-9) */
export const OPENING_LAMPS = 2;
/** 건너뛰기 뒤 마무리 카드를 보이지 않는다(T-1) */
export const TUTORIAL_END_CARD_ON_SKIP = false;

/** 사회자 문구(UI-SPEC 사회자 문구 표 그대로 — 말투를 통일하지 않는다, T-7) */
export const TUTORIAL_LINES: Readonly<Record<TutorialLineKey, string>> = {
  "tutorial.morning.victim": "서연 님이 당했습니다",
  "tutorial.morning.mafia": "이 중에 마피아가 있습니다",
  "tutorial.errand": "등불을 켜 보세요",
  "tutorial.house": "집 하나를 눌러 보세요",
  "tutorial.link": "단서와 같은 옷을 찾아 보세요",
  "tutorial.secret": "정체는 판이 끝나야 알아요",
  "tutorial.vote": "의심되는 사람을 누르세요",
  "tutorial.vote.wrong": "흔적을 떠올려 보세요",
  "tutorial.roles": "밤에는 저마다 할 일이 있어요",
};

/**
 * 출연(T-9, T-14). 가짜 방 상태는 이 상수로만 만든다 — 닉네임·옷은 실제 사용자 것이 아니다.
 * 같은 옷 판정은 도윤(noir) 하나에만 이어지도록 의상이 정해져 있다(noir → 붉은 천 조각).
 * 맵은 마을이다(21페이즈 D-28: 집 판·창·단서 지점이 마을에만 있다). 등불은 내 집(좌석 5)의 lamp5 와 두 곳 — 서연(2) 집 가로등은 목록에 없다.
 */
export const TUTORIAL_CAST = {
  me: 5,
  victim: 2,
  suspect: 1,
  map: "town",
  seats: [
    { seat: 0, name: "민준", look: "detective" },
    { seat: 1, name: "도윤", look: "noir" },
    { seat: 2, name: "서연", look: "elder" },
    { seat: 3, name: "지호", look: "reporter" },
    { seat: 4, name: "하린", look: "hood" },
    { seat: 5, name: "나", look: "coat" },
  ],
  errand: { places: ["lamp5", "lamp6", "lamp4"], target: "lamp5" },
  trace: "redCloth",
} as const;

/** 밤·아침에 켜져 있는 가로등(공개 값 day.lamps 와 같은 모양): 서연(2) 집만 빠졌다 — 서연 집 창은 꺼져 있고 아침에 꺼진 등불로 보인다 */
const LAMPS_LIT: readonly number[] = [0, 1, 3, 4, 5];
/** 현장 단서 지점 ②(옷 조각)에서 내가 받는 단서 한 줄 */
const CLUE_CLOTH: ClueLine = { spot: 2, kind: "cloth", piece: TUTORIAL_CAST.trace };
/** 살핀 뒤 의심 보드가 열리기까지(ms) — 카드가 올라온 뒤 한 박자 */
export const TUTORIAL_BOARD_AFTER_MS = 900;
/** 장면 3 에서 [켜기] 를 누른 뒤 다음 장면으로 넘어가기까지(ms) — 켜진 가로등 빛과 창이 보일 만큼 */
export const TUTORIAL_LAMP_NEXT_MS = 1600;

/** 장면 3·4 에서 내가 서 있는 자리(월드 단위). 가로등 5 장소 중심 (−4.25, 5.25) 에서 처리 반경 ERRAND_ACT_R 안의 걷는 칸이다 */
export const TUTORIAL_START: Readonly<{ x: number; z: number }> = { x: TOWN_LAMPS[5]!.x + 0.5, z: TOWN_LAMPS[5]!.z + 0.5 };

/** 장면 5 에서 내가 서 있는 자리: 서연(2) 집 앞 단서 지점 ② 위(월드 단위). 독 [살펴보기] 가 바로 켜진다 */
export const TUTORIAL_SCENE_SPOT: Readonly<{ x: number; z: number }> = (() => {
  const pt = TOWN_CLUE_SPOTS[TUTORIAL_CAST.victim]![1];
  return { x: pt.x / UNIT, z: pt.z / UNIT };
})();

// ---- 장면 표 ----

/** 오프닝 램프 소리 시각: 0.8초부터 0.5초 간격으로 OPENING_LAMPS 번(시안 enter 1) */
const LAMP_BEATS: readonly TutorialBeat[] = Array.from({ length: OPENING_LAMPS }, (_, i) => ({ at: 800 + 500 * i, sfx: "tut.lampOff" as const }));

/** 시각 목록마다 같은 소리 하나씩 */
function repeatSfx(sfx: TutorialCue, times: readonly number[]): TutorialBeat[] {
  return times.map((at) => ({ at, sfx }));
}

/** 장면 표 8행(n 오름차순). 시각은 장면 시작부터 ms — 시안 Main.dc.html enter() 와 UI-SPEC 첫 사건 장면 계약 그대로 */
export const TUTORIAL_SCENES: readonly TutorialScene[] = [
  {
    n: 1,
    id: "opening",
    render: "stage",
    dot: true,
    beats: [...LAMP_BEATS, { at: 2600, sfx: "tut.scream" }],
    focus: [],
    advance: { kind: "auto", afterMs: 4600 },
  },
  {
    n: 2,
    id: "morning",
    render: "map",
    dot: true,
    beats: [
      { at: 0, sfx: "tut.whoosh", say: "tutorial.morning.victim" },
      { at: 2600, sfx: "tut.sting", say: "tutorial.morning.mafia" },
      { at: 4000, say: "tutorial.secret" },
    ],
    focus: [{ target: "band", from: 0, to: 2600 }],
    advance: { kind: "next", showAtMs: 4000 },
  },
  {
    n: 3,
    id: "errand",
    render: "map",
    dot: true,
    beats: [
      { at: 0, sfx: "tut.whoosh" },
      { at: 500, say: "tutorial.errand" },
    ],
    focus: [{ target: "errand", from: 0 }],
    advance: { kind: "act", afterMs: TUTORIAL_LAMP_NEXT_MS },
  },
  {
    n: 4,
    id: "house",
    render: "map",
    dot: true,
    beats: [
      { at: 0, sfx: "tut.whoosh" },
      { at: 500, say: "tutorial.house" },
      { at: 900, sfx: "tut.eye" },
    ],
    focus: [{ target: "house", from: 0 }],
    advance: { kind: "step", afterMs: 700 },
  },
  {
    n: 5,
    id: "scene",
    render: "map",
    dot: true,
    // 카드가 올라오는 박자·보드가 열리는 박자(tut.link)와 '단서와 같은 옷을 찾아 보세요' 는 사용자의 행동(살피기) 뒤에 화면이 부른다
    beats: [{ at: 0, sfx: "tut.whoosh" }],
    focus: [
      { target: "inspect", from: 0 },
      { target: "suspect", from: 0 },
    ],
    advance: { kind: "step", afterMs: 1200 },
  },
  {
    n: 6,
    id: "vote",
    render: "map",
    dot: true,
    beats: [{ at: 0, sfx: "tut.whoosh", say: "tutorial.vote" }],
    focus: [{ target: "pickTags", from: 0 }],
    advance: { kind: "pick", revealAfterMs: 1100 },
  },
  {
    n: 7,
    id: "roles",
    render: "stage",
    dot: true,
    beats: [...repeatSfx("tut.flip", [100, 450, 800, 1150]), { at: 1500, say: "tutorial.roles" }],
    focus: [],
    advance: { kind: "next", showAtMs: 0 },
  },
  { n: 8, id: "end", render: "home", dot: false, beats: [{ at: 0, sfx: "tut.warm" }], focus: [], advance: { kind: "end" } },
];

/** 장면 6 이름표를 눌렀을 때: 정답(도윤)은 도장, 오답은 버저와 오답 문구, 처형 결과는 팡파르 + '정체는 판이 끝나야 알아요'(정체 카드는 뒤집지 않는다, D-20) */
export const TUTORIAL_PICK = {
  right: { sfx: "tut.stamp" },
  wrong: { sfx: "tut.buzz", say: "tutorial.vote.wrong" },
  reveal: { sfx: "tut.fanfare", say: "tutorial.secret" },
} as const;

// ---- 가짜 view ----

/** 출연표에서 공개 플레이어 한 줄씩. 역할 키는 어디에도 없다 */
function playersOf(deadSeats: readonly number[]): PublicPlayer[] {
  return TUTORIAL_CAST.seats.map((c) => ({
    seat: c.seat,
    nickname: c.name,
    connected: true,
    isHost: false,
    ...(deadSeats.includes(c.seat) ? { alive: false } : {}),
    look: c.look as OutfitId,
  }));
}

/** 가짜 view 의 공통 뼈대: 방 코드 없음(방이 아님), 1판, 마을·확장판, 나는 5번이고 방장이 아니다 */
function baseView(phase: PhaseId, now: number, deadSeats: readonly number[], phaseEndsAt: number | null): RoomView {
  return {
    code: "",
    phase,
    round: 1,
    phaseEndsAt,
    phaseDurationMs: null,
    serverNow: now,
    minPlayers: 4,
    maxPlayers: 8,
    mapChoice: TUTORIAL_CAST.map as MapChoice,
    map: TUTORIAL_CAST.map as MapId,
    mode: "extended",
    players: playersOf(deadSeats),
    me: { seat: TUTORIAL_CAST.me, isHost: false },
    day: { n: 1, roles: [] },
  };
}

/**
 * 저녁 등불 장면(3): errand 단계는 마감이 없어(phaseEndsAt null) 2초 시작 카드가 뜨지 않는다. 저녁에는 모두 살아 있다.
 * lit 이면 내가 lamp5 를 켠 뒤 — 내 목록의 done 과 공개 값 day.lamps 에 5 가 든다(서버가 하는 일을 상수로 흉내 낸다)
 */
function errandView(lit: boolean, now: number): RoomView {
  const v = baseView("errand", now, [], null);
  const done: PlaceId[] = lit ? [TUTORIAL_CAST.errand.target as PlaceId] : [];
  return { ...v, me: { ...v.me, errand: { places: [...TUTORIAL_CAST.errand.places] as PlaceId[], done } }, day: { n: 1, roles: [], lamps: lit ? [TUTORIAL_CAST.me] : [] } };
}

/** 내가 받은 옷 조각(me.clues): 살핀 뒤에만 한 줄 — 서버가 아침~처형에만 싣는 값과 같은 모양 */
function withClue(v: RoomView): RoomView {
  return { ...v, me: { ...v.me, clues: [{ ...CLUE_CLOTH }] } };
}

/**
 * 지도 장면(2~6)의 가짜 RoomView. 매번 새 객체다. 모두 마을·확장판이다.
 * 2 = 아침(서연 탈락, 서연 등불만 꺼짐, 현장 없음) · 3 = 저녁 등불(lit 면 켠 뒤) · 4 = 밤 집 판(모두 생존, house 면 내가 고른 집) ·
 * 5 = 아침 현장(서연 집, clue 면 ② 를 살핀 뒤, board 면 토론 단계로 넘어가 의심 보드가 자동으로 열리는 때) · 6 = 지목(받은 옷 조각 유지, picked 면 나 → 도윤 한 줄)
 */
export function tutorialView(n: 2 | 3 | 4 | 5 | 6, at: { now: number; picked?: boolean; lit?: boolean; house?: number; clue?: boolean; board?: boolean }): RoomView {
  const dead = [TUTORIAL_CAST.victim];
  if (n === 3) return errandView(at.lit === true, at.now);
  if (n === 4) {
    const v = baseView("night", at.now, [], null);
    return { ...v, me: { ...v.me, ...(at.house !== undefined ? { pick: at.house } : {}) }, day: { n: 1, roles: [], lamps: [...LAMPS_LIT] } };
  }
  if (n === 2) {
    const v = baseView("morning", at.now, dead, null);
    return { ...v, day: { n: 1, roles: [], morning: { eliminated: TUTORIAL_CAST.victim }, lamps: [...LAMPS_LIT] } };
  }
  if (n === 5) {
    if (at.board === true) return withClue({ ...baseView("discussion", at.now, dead, null), day: { n: 1, roles: [] } });
    const v = baseView("morning", at.now, dead, null);
    const morning: RoomView = { ...v, day: { n: 1, roles: [], morning: { eliminated: TUTORIAL_CAST.victim }, scene: { house: TUTORIAL_CAST.victim }, lamps: [...LAMPS_LIT] } };
    return at.clue === true ? withClue(morning) : morning;
  }
  const v = baseView("nomination", at.now, dead, null);
  const points = at.picked === true ? [{ seat: TUTORIAL_CAST.me, target: TUTORIAL_CAST.suspect }] : [];
  return withClue({ ...v, day: { n: 1, roles: [], points } });
}

/** 무대 장면(1·7)의 가짜 view: 밤 단계. 7 에서는 서연이 이미 없다 */
export function tutorialStageView(n: 1 | 7, now: number): RoomView {
  return baseView("night", now, n === 7 ? [TUTORIAL_CAST.victim] : [], null);
}

/**
 * WorldStage 직접 장면의 모양: 카메라는 광장 가운데 고정, 조명은 night 여부, 서연 좌석은 victimGone 이면 불투명도 0(장면 1 에서 사라짐).
 * 장면 7 에는 서연 자리가 아예 없다.
 */
export function tutorialStageLook(n: 1 | 7, s: { night: boolean; victimGone: boolean }): SceneLook {
  const seats: Record<number, SeatLook> = {};
  for (const c of TUTORIAL_CAST.seats) {
    if (c.seat === TUTORIAL_CAST.victim) {
      if (n === 7) continue;
      seats[c.seat] = s.victimGone ? { show: true, ghost: false, opacity: 0 } : { show: true, ghost: false };
      continue;
    }
    seats[c.seat] = { show: true, ghost: false };
  }
  return { camera: { mode: "fixed", target: { x: 0, z: 0 }, zoom: 1 }, lighting: s.night ? "night" : "talk", tension: 0, seats };
}

// ---- 카메라 (P18-8) ----

/**
 * 튜토리얼 지도 장면 2·6 의 카메라: 광장 가운데 고정·줌 1. 광장 가운데 = GATHER_CENTER, 지목 단계와 같은 구도(P18-8).
 * 장면 3·4·5 는 덮어쓰지 않는다 — 저녁 등불·현장은 나를 따라가고, 밤 집 판은 실제 판의 마을 밤 시점이다.
 */
export const TUTORIAL_FIXED_CAMERA: CameraMode = { mode: "fixed", target: { x: 0, z: 0 }, zoom: 1 };

/** 지도 장면 n 의 카메라 덮어쓰기: 2·6 은 고정, 그 밖은 undefined — 실제 판의 sceneLook 카메라 그대로 */
export function tutorialCameraOf(n: number): CameraMode | undefined {
  return n === 2 || n === 6 ? TUTORIAL_FIXED_CAMERA : undefined;
}

// ---- 위치 ----

/**
 * 지도 장면 2·6 과 무대 장면 1·7 에서 좌석이 서는 자리(월드 단위): 광장 가운데 연단 둘레 반지름 약 2.6. 모두 걸을 수 있는 칸이다(시험).
 * 도윤(좌석 1) 자리는 18-08 측정값 — 장면 5 선·이름표가 폰 6종 화면 안쪽 8 안(D-07). 처음 (1.3, −2.3) 은 이름표 오른쪽이 폭 360~402 에서 화면 밖,
 * 후보 A (1.1, −1.9) 는 360 폭에서 1px 모자라고, B (0.9, −1.5) 는 연단에 걸려 걸을 수 없는 칸이라, C (1.3, −1.5) 가 처음 통과했다.
 */
export const TUTORIAL_SPOTS: Readonly<Record<number, { x: number; z: number }>> = {
  0: { x: -2.6, z: 0 },
  1: { x: 1.3, z: -1.5 },
  2: { x: -1.3, z: -2.3 },
  3: { x: -1.3, z: 2.3 },
  4: { x: 2.6, z: 0 },
  5: { x: 1.3, z: 2.3 },
};

/** 서버와 같은 구간 단위(고정소수점)로 쉬는 좌석들의 snap 한 프레임 */
function snapOf(spots: ReadonlyArray<{ seat: number; x: number; z: number }>, now: number): Extract<WorldFrame, { k: "snap" }> {
  let world: WorldState = emptyWorld();
  const players: { id: string; seat: number }[] = [];
  for (const s of spots) {
    const id = `tut-${s.seat}`;
    players.push({ id, seat: s.seat });
    world = { ...world, segs: { ...world.segs, [id]: restSegment(Math.round(s.x * UNIT), Math.round(s.z * UNIT), now) } };
  }
  return snapFrame(world, players, now);
}

/** 그 장면에 보이는 좌석의 위치 snap. 1 = 서연 포함 전원 · 2·6·7 = 산 사람 전원 · 3·4 = 가로등 5 곁의 나 하나 · 5 = 서연 집 앞 지점 ② 위의 나 하나 · 8 은 첫 화면이라 자리가 없다(빈 snap) */
export function tutorialSnap(n: TutorialSceneNo, now: number): Extract<WorldFrame, { k: "snap" }> {
  if (n === 3 || n === 4) return snapOf([{ seat: TUTORIAL_CAST.me, ...TUTORIAL_START }], now);
  if (n === 5) return snapOf([{ seat: TUTORIAL_CAST.me, ...TUTORIAL_SCENE_SPOT }], now);
  if (n === 8) return snapOf([], now);
  const seats = TUTORIAL_CAST.seats.filter((c) => n === 1 || c.seat !== TUTORIAL_CAST.victim);
  return snapOf(
    seats.map((c) => ({ seat: c.seat, ...TUTORIAL_SPOTS[c.seat]! })),
    now,
  );
}

// ---- 로컬 send 어댑터 ----

/**
 * 로컬 send. GameMap 이 보내는 것 중 등불 켜기(errand)·집 고르기(pick)·현장 살피기(inspect)·지목(point)만 알아듣고, 그 밖의 메시지(이동·채팅·입력 중·동작·건너뛰기 …)는
 * 아무 일 없이 true 를 돌려준다 — false 를 주면 보내지 못한 분기를 타기 때문이다. 서버로는 아무것도 나가지 않는다.
 */
export function makeTutorialSend(h: { onErrand(): void; onPoint(seat: number): void; onPick?(seat: number): void; onInspect?(): void }): (msg: ClientMessage) => boolean {
  return (msg) => {
    if (msg.t === "errand") h.onErrand();
    else if (msg.t === "point") h.onPoint(msg.target);
    else if (msg.t === "pick") h.onPick?.(msg.target);
    else if (msg.t === "inspect") h.onInspect?.();
    return true;
  };
}
