// 첫 사건 대본(17페이즈, 결정 0078-1·7, 0080-9·16·17). 순수 모듈 — 역할·실제 닉네임·연결을 읽지 않는다.
// DOM·window·현재 시각을 읽지 않고, 시각은 모두 인자(now)로 받는다. 화면 계획(17-04 이후)은 이 표를 읽어 실제 게임 부품에 먹이기만 한다.
// 장면 표 한 곳이 그리는 방식·소리 시각·사회자 문구 키·포커스 창·넘어가는 방식을 쥐고(UI-SPEC 첫 사건 장면 계약, 시안 Main.dc.html enter),
// 가짜 방 상태(RoomView)는 출연 상수(TUTORIAL_CAST)로만 만든다 — 서버 값·내 역할·내 닉네임이 섞일 길이 없다.
import { UNIT } from "../../shared/game/map";
import { MOVE_V, emptyWorld, moveFrame, restSegment, snapFrame } from "../../shared/game/world";
import type { WorldState } from "../../shared/game/world";
import type { ClientMessage, MapId, OutfitId, PhaseId, PlaceId, PublicPlayer, RoomView, WorldFrame } from "../../shared/protocol";
import type { CameraMode, SceneLook, SeatLook } from "../world/presence";

// ---- 타입 ----

export type TutorialSceneNo = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** 사회자 문구 키 8개(UI-SPEC 사회자 문구 표). 문구는 TUTORIAL_LINES 한 곳에만 있다 */
export type TutorialLineKey =
  | "tutorial.morning.victim"
  | "tutorial.morning.mafia"
  | "tutorial.errand"
  | "tutorial.witness"
  | "tutorial.link"
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
  target: "band" | "errand" | "suspect" | "pickTags";
  from: number;
  to?: number;
}

export type TutorialAdvance =
  | { kind: "auto"; afterMs: number }
  | { kind: "next"; showAtMs: number }
  | { kind: "act"; afterMs: number }
  | { kind: "pick"; revealAfterMs: number }
  | { kind: "end" };

export interface TutorialScene {
  n: TutorialSceneNo;
  id: "opening" | "morning" | "errand" | "witness" | "evidence" | "vote" | "roles" | "end";
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
  "tutorial.errand": "우체통에서 처리하세요",
  "tutorial.witness": "가는 길에 본 사람은 기록돼요",
  "tutorial.link": "본 것과 흔적을 이어 보세요",
  "tutorial.vote": "의심되는 사람을 누르세요",
  "tutorial.vote.wrong": "흔적을 떠올려 보세요",
  "tutorial.roles": "밤에는 저마다 할 일이 있어요",
};

/**
 * 출연(T-9, T-14). 가짜 방 상태는 이 상수로만 만든다 — 닉네임·옷은 실제 사용자 것이 아니다.
 * 같은 옷 판정은 도윤(noir) 하나에만 이어지도록 의상이 정해져 있다(noir → 붉은 천 조각).
 */
export const TUTORIAL_CAST = {
  me: 5,
  victim: 2,
  suspect: 1,
  map: "plaza",
  seats: [
    { seat: 0, name: "민준", look: "detective" },
    { seat: 1, name: "도윤", look: "noir" },
    { seat: 2, name: "서연", look: "elder" },
    { seat: 3, name: "지호", look: "reporter" },
    { seat: 4, name: "하린", look: "hood" },
    { seat: 5, name: "나", look: "coat" },
  ],
  errand: { places: ["mail", "fountain", "lamp"], target: "mail" },
  witness: { seat: 1, place: "lamp" },
  trace: "redCloth",
} as const;

/** 장면 3·4 에서 내가 서 있는 자리(월드 단위). 우체통 중심 (5.0, 3.4) 에서 처리 반경 ERRAND_ACT_R 안이다 */
export const TUTORIAL_START: Readonly<{ x: number; z: number }> = { x: 4.4, z: 3.0 };

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
    ],
    focus: [{ target: "band", from: 0, to: 2600 }],
    advance: { kind: "next", showAtMs: 2600 },
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
    advance: { kind: "act", afterMs: 700 },
  },
  {
    n: 4,
    id: "witness",
    render: "map",
    dot: true,
    beats: [...repeatSfx("tut.step", [0, 320, 640, 960, 1280]), { at: 1900, sfx: "tut.eye" }, { at: 2250, say: "tutorial.witness" }],
    focus: [{ target: "suspect", from: 1900, to: 3400 }],
    advance: { kind: "next", showAtMs: 3400 },
  },
  {
    n: 5,
    id: "evidence",
    render: "map",
    dot: true,
    beats: [...repeatSfx("tut.link", [400, 900]), { at: 1300, say: "tutorial.link" }],
    focus: [],
    advance: { kind: "next", showAtMs: 0 },
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

/** 장면 6 이름표를 눌렀을 때: 정답(도윤)은 도장, 오답은 버저와 오답 문구, 정체 공개는 팡파르 */
export const TUTORIAL_PICK = {
  right: { sfx: "tut.stamp" },
  wrong: { sfx: "tut.buzz", say: "tutorial.vote.wrong" },
  reveal: { sfx: "tut.fanfare" },
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

/** 장면 6·5 가 같은 값을 쓰는 낮 증거(실제 판의 EVID-01 처럼 낮 끝까지 같다): 붉은 천 조각과 마지막 목격 */
function evidenceOf(): { trace: typeof TUTORIAL_CAST.trace; seen: { seat: number; place: PlaceId } } {
  return { trace: TUTORIAL_CAST.trace, seen: { seat: TUTORIAL_CAST.witness.seat, place: TUTORIAL_CAST.witness.place as PlaceId } };
}

/** 가짜 view 의 공통 뼈대: 방 코드 없음(방이 아님), 1판, 광장, 나는 5번이고 방장이 아니다 */
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
    mapChoice: TUTORIAL_CAST.map as MapId,
    map: TUTORIAL_CAST.map as MapId,
    players: playersOf(deadSeats),
    me: { seat: TUTORIAL_CAST.me, isHost: false },
    day: { n: 1, roles: [] },
  };
}

/** 심부름 장면(3·4): errand 단계는 마감이 없어(phaseEndsAt null) 2초 시작 카드가 뜨지 않는다 */
function errandView(done: readonly PlaceId[], now: number): RoomView {
  const v = baseView("errand", now, [TUTORIAL_CAST.victim], null);
  return { ...v, me: { ...v.me, errand: { places: [...TUTORIAL_CAST.errand.places] as PlaceId[], done: [...done] } } };
}

/**
 * 지도 장면(2~6)의 가짜 RoomView. 매번 새 객체다.
 * 2 = 아침(서연 탈락, 흔적 없음) · 3·4 = 심부름(우체통 처리 전·후) · 5 = 아침 증거(마감 now+4000 이라 흔적 구간이 즉시 켜진다) · 6 = 지목(picked 면 나 → 도윤 한 줄)
 */
export function tutorialView(n: 2 | 3 | 4 | 5 | 6, at: { now: number; picked?: boolean }): RoomView {
  const dead = [TUTORIAL_CAST.victim];
  if (n === 3) return errandView([], at.now);
  if (n === 4) return errandView([TUTORIAL_CAST.errand.target as PlaceId], at.now);
  if (n === 2) {
    const v = baseView("morning", at.now, dead, null);
    return { ...v, day: { n: 1, roles: [], morning: { eliminated: TUTORIAL_CAST.victim } } };
  }
  if (n === 5) {
    const v = baseView("morning", at.now, dead, at.now + 4000);
    return { ...v, day: { n: 1, roles: [], morning: { eliminated: TUTORIAL_CAST.victim, ...evidenceOf() }, evidence: evidenceOf() } };
  }
  const v = baseView("nomination", at.now, dead, null);
  const points = at.picked === true ? [{ seat: TUTORIAL_CAST.me, target: TUTORIAL_CAST.suspect }] : [];
  return { ...v, day: { n: 1, roles: [], evidence: evidenceOf(), points } };
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
 * 튜토리얼 지도 장면 2·5·6 의 카메라: 광장 가운데 고정·줌 1. 광장 가운데 = GATHER_CENTER, 지목 단계와 같은 구도 —
 * 장면 5 의 선이 화면 안 도윤에게 닿게(P18-8). target 은 18-08 이 폰 6종 측정으로 조정할 수 있다.
 */
export const TUTORIAL_FIXED_CAMERA: CameraMode = { mode: "fixed", target: { x: 0, z: 0 }, zoom: 1 };

/** 지도 장면 n 의 카메라 덮어쓰기: 2·5·6 은 고정, 그 밖(3·4 는 나를 따라간다)은 undefined — 실제 판의 sceneLook 카메라 그대로 */
export function tutorialCameraOf(n: number): CameraMode | undefined {
  return n === 2 || n === 5 || n === 6 ? TUTORIAL_FIXED_CAMERA : undefined;
}

// ---- 위치 ----

/**
 * 지도 장면 2·5·6 과 무대 장면 1·7 에서 좌석이 서는 자리(월드 단위): 광장 가운데 연단 둘레 반지름 약 2.6. 모두 걸을 수 있는 칸이다(시험).
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

/** 장면 4 에서 도윤이 걷는 길(월드 단위): 오른쪽 화면 밖에서 내 근처까지 약 3.3 — MOVE_SPEED 로 1.8초 남짓 */
export const SUSPECT_WALK: Readonly<{ from: { x: number; z: number }; to: { x: number; z: number } }> = {
  from: { x: 5.6, z: -1.9 },
  to: { x: 4.0, z: 1.0 },
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

/** 그 장면에 보이는 좌석의 위치 snap. 1 = 서연 포함 전원 · 2·5·6·7 = 산 사람 전원 · 3·4 = 나 하나 · 8 은 첫 화면이라 자리가 없다(빈 snap) */
export function tutorialSnap(n: TutorialSceneNo, now: number): Extract<WorldFrame, { k: "snap" }> {
  if (n === 3 || n === 4) return snapOf([{ seat: TUTORIAL_CAST.me, ...TUTORIAL_START }], now);
  if (n === 8) return snapOf([], now);
  const seats = TUTORIAL_CAST.seats.filter((c) => n === 1 || c.seat !== TUTORIAL_CAST.victim);
  return snapOf(
    seats.map((c) => ({ seat: c.seat, ...TUTORIAL_SPOTS[c.seat]! })),
    now,
  );
}

/** 장면 4: 도윤이 화면 오른쪽 밖에서 SUSPECT_WALK 끝점까지 MOVE_SPEED 로 걷는 move 한 프레임. 시각 now 에 출발한다 */
export function tutorialSuspectWalk(now: number): WorldFrame {
  const { from, to } = SUSPECT_WALK;
  const p = [Math.round(from.x * UNIT), Math.round(from.z * UNIT), Math.round(to.x * UNIT), Math.round(to.z * UNIT)];
  return moveFrame(TUTORIAL_CAST.suspect, { p, t0: now, v: MOVE_V });
}

/** 장면 4 모션 줄이기: 걷지 않고 처음부터 끝점에 서 있는 도윤 + 내 자리의 snap 한 프레임("제자리 등장", UI-SPEC 모션 줄이기) */
export function tutorialSuspectStand(now: number): Extract<WorldFrame, { k: "snap" }> {
  return snapOf(
    [
      { seat: TUTORIAL_CAST.me, ...TUTORIAL_START },
      { seat: TUTORIAL_CAST.suspect, ...SUSPECT_WALK.to },
    ],
    now,
  );
}

// ---- 로컬 send 어댑터 ----

/**
 * 로컬 send. GameMap 이 보내는 것 중 심부름 처리(errand)와 지목(point)만 알아듣고, 그 밖의 메시지(이동·채팅·입력 중·동작 …)는
 * 아무 일 없이 true 를 돌려준다 — false 를 주면 보내지 못한 분기를 타기 때문이다. 서버로는 아무것도 나가지 않는다.
 */
export function makeTutorialSend(h: { onErrand(): void; onPoint(seat: number): void }): (msg: ClientMessage) => boolean {
  return (msg) => {
    if (msg.t === "errand") h.onErrand();
    else if (msg.t === "point") h.onPoint(msg.target);
    return true;
  };
}
