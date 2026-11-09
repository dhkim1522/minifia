// 첫 사건 대본(17페이즈, 결정 0078-1·7, 0080-9·16·17). 순수 모듈 — 역할·실제 닉네임·연결을 읽지 않는다.
// DOM·window·현재 시각을 읽지 않고, 시각은 모두 인자(now)로 받는다. 화면 계획(17-04 이후)은 이 표를 읽어 실제 게임 부품에 먹이기만 한다.
// 장면 표 한 곳이 그리는 방식·소리 시각·사회자 문구 키·포커스 창·넘어가는 방식을 쥐고(UI-SPEC 첫 사건 장면 계약, 시안 Main.dc.html enter),
// 가짜 방 상태(RoomView)는 출연 상수(TUTORIAL_CAST)로만 만든다 — 서버 값·내 역할·내 닉네임이 섞일 길이 없다.
import { UNIT } from "../../shared/game/map";
import { emptyWorld, restSegment, snapFrame } from "../../shared/game/world";
import type { WorldState } from "../../shared/game/world";
import type { ClientMessage, MapId, OutfitId, PlaceId, PublicPlayer, RoomView, WorldFrame } from "../../shared/protocol";

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

export const TUTORIAL_SCENES: readonly TutorialScene[] = [
  { n: 1, id: "opening", render: "stage", dot: true, beats: [], focus: [], advance: { kind: "auto", afterMs: 4600 } },
  { n: 2, id: "morning", render: "map", dot: true, beats: [], focus: [], advance: { kind: "next", showAtMs: 2600 } },
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
  { n: 4, id: "witness", render: "map", dot: true, beats: [], focus: [], advance: { kind: "next", showAtMs: 3400 } },
  { n: 5, id: "evidence", render: "map", dot: true, beats: [], focus: [], advance: { kind: "next", showAtMs: 0 } },
  { n: 6, id: "vote", render: "map", dot: true, beats: [], focus: [], advance: { kind: "pick", revealAfterMs: 1100 } },
  { n: 7, id: "roles", render: "stage", dot: true, beats: [], focus: [], advance: { kind: "next", showAtMs: 0 } },
  { n: 8, id: "end", render: "home", dot: false, beats: [], focus: [], advance: { kind: "end" } },
];

// ---- 가짜 view ----

/** 출연표에서 공개 플레이어 한 줄. 역할 키는 어디에도 없다 */
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

/** 지도 장면(3·4)의 공통 뼈대. errand 단계는 마감이 없어(phaseEndsAt null) 2초 시작 카드가 뜨지 않는다 */
function errandView(done: readonly PlaceId[], now: number): RoomView {
  return {
    code: "",
    phase: "errand",
    round: 1,
    phaseEndsAt: null,
    phaseDurationMs: null,
    serverNow: now,
    minPlayers: 4,
    maxPlayers: 8,
    mapChoice: TUTORIAL_CAST.map as MapId,
    map: TUTORIAL_CAST.map as MapId,
    players: playersOf([TUTORIAL_CAST.victim]),
    me: {
      seat: TUTORIAL_CAST.me,
      isHost: false,
      errand: { places: [...TUTORIAL_CAST.errand.places] as PlaceId[], done: [...done] },
    },
    day: { n: 1, roles: [] },
  };
}

/** 장면별 가짜 RoomView. 이번 단계에서는 3·4 만 만든다 */
export function tutorialView(n: 2 | 3 | 4 | 5 | 6, at: { now: number; picked?: boolean }): RoomView {
  if (n === 3) return errandView([], at.now);
  if (n === 4) return errandView([TUTORIAL_CAST.errand.target as PlaceId], at.now);
  throw new Error(`tutorialView(${n}) 는 아직 없다`);
}

// ---- 위치 snap ----

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

/** 그 장면에 보이는 좌석의 위치 snap. 이번 단계에서는 3·4(나 하나)만 만든다 */
export function tutorialSnap(n: TutorialSceneNo, now: number): Extract<WorldFrame, { k: "snap" }> {
  if (n === 3 || n === 4) return snapOf([{ seat: TUTORIAL_CAST.me, ...TUTORIAL_START }], now);
  throw new Error(`tutorialSnap(${n}) 는 아직 없다`);
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
