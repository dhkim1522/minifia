// 혼자 하기 튜토리얼 대본(결정 0089-15, 24페이즈 D-15~D-17·D-23·D-31, UI-SPEC P24-21~33).
// 기본 방과 실험방의 장면 표, 출연, 안내, 가짜 RoomView, 월드 스냅, 로컬 입력을 한 곳에 둔다.
// 서버·소켓·세션 모듈을 import 하지 않는다 — 정적 가드(test/unit/tutorialStaticGuard.test.ts)가 이 파일의 값 import 폐포를 지킨다.
// 순수 모듈 — DOM·window·현재 시각·난수를 읽지 않는다. 시각은 모두 인자(startedAt, at)로 받는다.
// 가짜 view 는 `satisfies RoomView` 로 만든다: RoomView 모양이 바뀌면 컴파일러가 잡는다.
// 시계(D-31): 가짜 view 는 장면 시작 기준의 실제 phaseEndsAt·phaseDurationMs 를 가진다 — 역할 카드 자동 뒤집힘·처형 순간 연출이 시계로 돌기 때문이다.
// 시간 표시를 지운 사본(머리·띠용)은 화면 쪽이 만든다. 튜토리얼 루트에 맨 이름 data-tutorial 속성은 쓰지 않는다(표식 이름은 UI-SPEC 표).
// 옛 서버 쪽 표식과 같은 이름(통과·완료 표식·튜토리얼 단계)은 만들지 않는다 — 혼자 하기는 서버 상태가 없다(D-15).
import { EARLY_GRACE_MS } from "../../shared/game/early";
import { BAR_MAP, snapToWalkable, UNIT } from "../../shared/game/map";
import { majorityOf } from "../../shared/game/nomination";
import { ANSWER_REVEAL_MS, EXECUTION_MS, WILL_REVEAL_MS } from "../../shared/game/phases";
import { PLAYTEST_DISCUSSION_MIN_MS } from "../../shared/game/playtest";
import { rolesInPlay } from "../../shared/game/roles";
import { emptyWorld, restSegment, snapFrame } from "../../shared/game/world";
import type { WorldState } from "../../shared/game/world";
import type { ClientMessage, EmoteId, KeywordAnswerRow, OutfitId, PhaseId, PublicPlayer, RoomView, WorldFrame } from "../../shared/protocol";
import { AUTO_FLIP_MS } from "../net/cardFace";

// ---- 타입 ----

export type TutorialSceneId = "roles" | "keyword" | "answers" | "discussion" | "verdict" | "pick" | "will" | "answerReveal" | "night" | "postit" | "end";

/** 장면 안의 비트. 시각표로 가는 비트(at 숫자)와 눌러서 들어가는 비트(at null) 모두 이 이름으로 가짜 view 를 고른다 */
export type TutorialBeatId = "start" | "a" | "b" | "c";

/** 링 대상의 안정 id(E2E 표식 data-tutorial-target 값) */
export type TutorialTargetId = "role-ready" | "send" | "clues-btn" | "endDiscussion" | "first-ballot" | "yes" | "tag-4" | "face-0" | "night-done" | "suspect-btn";

/** 장면 소리 큐 — 새 레시피 없이 기존 ui.* 만 쓴다(P24-31) */
export type TutorialCue = "ui.card" | "ui.tap" | "ui.host";

/** 알약 문구 키(문구는 TUTORIAL_PILLS 한 곳에만 있다) */
export type TutorialPillKey = keyof typeof TUTORIAL_PILLS;

export interface TutorialBeat {
  id: TutorialBeatId;
  /** 장면 시작부터 ms. null 이면 사람이 눌러서(또는 앞 비트의 holdMs 가 지나) 들어가는 비트 */
  at: number | null;
  /** 눌러서 들어간 비트가 머무는 시간(ms). 지나면 다음 비트(마지막 비트면 다음 장면) */
  holdMs?: number;
  pill: TutorialPillKey | null;
  sfx?: TutorialCue;
}

export interface TutorialScene {
  id: TutorialSceneId;
  /** watch = 자동으로 넘어감 · do = 링 대상을 누름(12초 뒤 대본이 대신) */
  kind: "watch" | "do";
  /** 장면 길이(ms) — 가짜 view 의 실제 시계가 이만큼 흐른다(하기 장면은 링 + 12초 대행 + 뒷마무리까지 덮는다) */
  ms: number;
  beats: readonly TutorialBeat[];
  /** 하기 장면의 링 대상(눌러야 하는 순서) */
  targets?: readonly TutorialTargetId[];
  /** 링이 켜지는 시각(장면 시작부터 ms) */
  ringAtMs?: number;
  /** 링이 켜진 뒤(여러 단계면 각 단계 시작 뒤) 이만큼 안 누르면 대본이 대신 누른다 */
  autoActMs?: number;
  /** 누른 뒤 가짜 반응이 한 단계씩 나오는 간격(ms) */
  stepMs?: number;
  /** 반응이 끝난 뒤 다음 장면까지 머무는 시간(ms) */
  tailMs?: number;
}

/** 눌렀을 때(또는 12초 뒤 대본이 대신) 일어나는 일 */
export interface TutorialAction {
  target: TutorialTargetId;
  /** 대상의 실제 핸들러가 보내는 메시지. 화면 안에서만 열리는 도구의 조작은 null */
  msg: ClientMessage | null;
  /** 누른 뒤 가짜 반응이 나오는 단계 수(tutorialView 의 acted 가 0 → steps 로 올라간다) */
  steps: number;
  /** 눌러서 들어가는 다음 비트. 없으면 null */
  next: TutorialBeatId | null;
}

// ---- 상수 ----

/** 하기 장면에서 이만큼 안 누르면 대본이 대신 한다(P24-27) */
export const TUTORIAL_AUTO_ACT_MS = 12000;
/** 역할 카드가 장면 시작 뒤 이 시각에 저절로 뒤집힌다(UI-SPEC E 표 장면 1) */
export const TUTORIAL_FLIP_AT_MS = 400;
/** 역할 아이콘 4개가 올라오는 간격과 시작 시각(장면 1) */
export const ROLE_ICON_STEP_MS = 150;
export const ROLE_ICON_START_MS = 2200;
/** 모두의 기록 줄 등장: 시작·간격·마지막 답에 주는 여유(장면 3) */
export const ANSWER_ROW_START_MS = 300;
export const ANSWER_ROW_STEP_MS = 350;
export const ANSWER_ROW_LAST_EXTRA_MS = 200;
/** 장면 9: 아침으로 넘어가는 막 길이와 종이 떨어짐 시간 */
export const POSTIT_CURTAIN_MS = 600;
export const POSTIT_FALL_MS = 1200;

/** 안내 한 줄(UI-SPEC 297행, 공백 포함 17자 이하·해요체·마침표 없음) */
export const TUTORIAL_PILLS = {
  "roles.citizen": "나는 시민이에요",
  "roles.find": "마피아를 찾아내요",
  "roles.others": "경찰·의사도 있어요",
  "keyword.citizen": "시민 팀은 제시어를 알아요",
  "keyword.mafia": "마피아는 제시어를 몰라요",
  "keyword.noAnswer": "제시어 대신 단서를 써요",
  "answers.suspect": "단서를 읽고 비교해요",
  "discussion.talk": "궁금한 점을 물어봐요",
  "discussion.end": "절반 넘게 누르면 끝나요",
  "verdict.majority": "찬성이 더 많으면 지목해요",
  "pick.point": "의심 가는 사람을 가리켜요",
  "will.will": "처형되는 사람은 유언을 남겨요",
  "night.mafia": "마피아는 몰래 한 명을 노려요",
  "postit.near": "의심 가는 사람 곁에서 눌러요",
  "postit.pick": "붙일 사람을 눌러요",
  "postit.fall": "하루 한 장, 아침에 떨어져요",
  "roles.ready": "역할을 읽고 준비를 눌러요",
  "answers.open": "단서를 눌러 살펴봐요",
  "postit.tool": "가까이서 의심딱지를 눌러요",
  "discussion.unanimous": "모두 요청하면 투표해요",
  "discussion.majority": `${PLAYTEST_DISCUSSION_MIN_MS / 1000}초 뒤엔 절반만 넘으면 돼요`,
  "discussion.request": "토론 스킵을 눌러요",
  "verdict.choice": "한 명을 뽑거나 건너뛰어요",
  "night.ready": "시민은 아침을 준비해요",
} as const;

/**
 * 출연(P24-29, 0080-16). 가짜 방은 6명이고 의상 이름에 역할 낱말(police·doctor·mafia)이 없다.
 * 나 = 시민, 마피아 = 하린(비밀), 키워드 = 장르 "동물" / "고양이". 모두 답하고 하린의 무난한 답은 토론에서 허점이 드러난다.
 * 다수는 도윤을 처형한다(직업은 공개하지 않는다). 밤에 서연이 떠나고 둘째 날 하린 곁에서 포스트잇을 붙인다.
 */
export const TUTORIAL_CAST = {
  me: 5,
  /** 마피아(비밀) — 어떤 화면 글에도 쓰지 않는다 */
  suspect: 4,
  executed: 1,
  nightVictim: 2,
  genre: "동물",
  word: "고양이",
  seats: [
    { seat: 0, name: "민준", look: "detective" },
    { seat: 1, name: "도윤", look: "noir" },
    { seat: 2, name: "서연", look: "elder" },
    { seat: 3, name: "지호", look: "reporter" },
    { seat: 4, name: "하린", look: "hood" },
    { seat: 5, name: "나", look: "coat" },
  ],
} as const;

/** 장면 2c 내 입력칸에 채워지는 글(읽기 전용)과 장면 3 의 모두의 답 */
export const TUTORIAL_MY_ANSWER = "발소리가 안 들려요";
export const TUTORIAL_ANSWERS: readonly KeywordAnswerRow[] = [
  { order: 1, seat: 0, text: "꼬리가 길어요" },
  { order: 2, seat: 2, text: "털이 부드러워요" },
  { order: 3, seat: 5, text: TUTORIAL_MY_ANSWER },
  { order: 4, seat: 3, text: "밥 줄 때만 와요" },
  { order: 5, seat: 1, text: "눈이 동그래요" },
  { order: 6, seat: 4, text: "사람을 잘 따라와요" },
];

/** 장면 4에서 답의 세부를 묻는다. 도윤은 자신에게 의심이 옮겨오자 손사래를 친다. */
export const TUTORIAL_CHAT: readonly { atMs: number; seat: number; text: string; emote?: EmoteId }[] = [
  { atMs: 500, seat: 0, text: "하린아, 언제 잘 따라와?" },
  { atMs: 1700, seat: 4, text: "목줄 들면 짖으면서 와" },
  { atMs: 3000, seat: 2, text: "짖는다고? 도윤이는 왜 조용해?" },
  { atMs: 4200, seat: 1, text: "답은 냈어. 난 아니야", emote: "deny" },
];
/** 장면 7: 처형되는 도윤의 유언 카드(공백 포함 13자) */
export const TUTORIAL_WILL = "믿어줘, 난 정말 아니야";

/** 누른 뒤 가짜 반응(다른 참가자의 행동)이 나오는 단계 수와 간격 */
const END_STEPS = 4; // 나 + 나머지 셋 = 6명 중 과반
const VERDICT_VOTES: readonly boolean[] = [true, true, false, true, false, true]; // 나 → 찬성 4 · 반대 2
/** 장면 6 차례 순서: 민준→도윤, 서연→도윤, 나→(하린), 지호→도윤, 도윤→민준, 하린→도윤 */
const PICK_ORDER: readonly number[] = [0, 2, 5, 3, 1, 4];
const PICK_LINES: readonly { seat: number; target: number }[] = [
  { seat: 0, target: 1 },
  { seat: 2, target: 1 },
  { seat: 5, target: 4 },
  { seat: 3, target: 1 },
  { seat: 1, target: 0 },
  { seat: 4, target: 1 },
];
const PICK_MINE_AT = 2; // PICK_ORDER 에서 내 차례 자리

const beat = (id: TutorialBeatId, at: number | null, pill: TutorialPillKey | null, extra: { holdMs?: number; sfx?: TutorialCue } = {}): TutorialBeat => ({ id, at, pill, ...extra });

/** 장면 표(UI-SPEC E 표 그대로 — 비트 시각·알약 키·소리 큐) */
export const TUTORIAL_SCENES: readonly TutorialScene[] = [
  {
    id: "roles",
    kind: "watch",
    ms: 6400,
    beats: [beat("start", 0, null), beat("a", TUTORIAL_FLIP_AT_MS, "roles.citizen", { sfx: "ui.card" }), beat("b", 2200, "roles.find"), beat("c", 4200, "roles.others")],
  },
  {
    id: "keyword",
    kind: "do",
    ms: 18600,
    ringAtMs: 5800,
    autoActMs: TUTORIAL_AUTO_ACT_MS,
    tailMs: 800,
    targets: ["send"],
    beats: [beat("a", 0, "keyword.citizen"), beat("b", 2600, "keyword.mafia", { sfx: "ui.card" }), beat("c", 5800, "keyword.noAnswer", { sfx: "ui.card" })],
  },
  {
    id: "answers",
    kind: "watch",
    ms: 7000,
    beats: [beat("a", 0, null, { sfx: "ui.card" }), beat("b", 2600, "answers.suspect")],
  },
  {
    id: "discussion",
    kind: "do",
    ms: 19200,
    ringAtMs: 4400,
    autoActMs: TUTORIAL_AUTO_ACT_MS,
    stepMs: 400,
    tailMs: 1200,
    targets: ["endDiscussion"],
    beats: [beat("a", 0, "discussion.talk"), beat("b", 4400, "discussion.end")],
  },
  {
    id: "verdict",
    kind: "do",
    ms: 16400,
    ringAtMs: 1000,
    autoActMs: TUTORIAL_AUTO_ACT_MS,
    stepMs: 300,
    tailMs: 1600,
    targets: ["yes"],
    beats: [beat("a", 0, "verdict.majority")],
  },
  {
    id: "pick",
    kind: "do",
    ms: 18300,
    ringAtMs: 3200,
    autoActMs: TUTORIAL_AUTO_ACT_MS,
    stepMs: 400,
    tailMs: 1500,
    targets: ["tag-4"],
    beats: [beat("a", 0, null), beat("b", 1600, null), beat("c", 3200, "pick.point")],
  },
  {
    id: "will",
    kind: "watch",
    ms: EXECUTION_MS,
    beats: [beat("a", 0, "will.will", { sfx: "ui.card" }), beat("b", WILL_REVEAL_MS, "will.will")],
  },
  {
    id: "night",
    kind: "do",
    ms: 17500,
    ringAtMs: 0,
    autoActMs: TUTORIAL_AUTO_ACT_MS,
    targets: ["face-0"],
    beats: [beat("a", 0, "night.mafia"), beat("b", null, null, { holdMs: 2500, sfx: "ui.tap" }), beat("c", null, null, { holdMs: 3000 })],
  },
  {
    id: "postit",
    kind: "do",
    ms: 28800,
    ringAtMs: 0,
    autoActMs: TUTORIAL_AUTO_ACT_MS,
    targets: ["suspect-btn", "tag-4"],
    beats: [
      beat("start", 0, "postit.near"),
      beat("a", null, "postit.pick", { sfx: "ui.tap" }),
      beat("b", null, "postit.fall", { holdMs: 3000, sfx: "ui.tap" }),
      beat("c", null, null, { holdMs: POSTIT_CURTAIN_MS + POSTIT_FALL_MS, sfx: "ui.host" }),
    ],
  },
  {
    id: "end",
    kind: "watch",
    ms: 4000,
    beats: [beat("a", 0, null, { sfx: "ui.card" })],
  },
];

const sceneOf = (id: TutorialSceneId): TutorialScene => TUTORIAL_SCENES.find((s) => s.id === id)!;

/** 실험방 첫날에는 단서와 딱지를 낮에 써 보고 투표를 한 번만 한다. */
export const TUTORIAL_PLAYTEST_SCENES: readonly TutorialScene[] = [
  {
    ...sceneOf("roles"),
    ms: 16800, kind: "do", ringAtMs: 3800, autoActMs: TUTORIAL_AUTO_ACT_MS, tailMs: 900,
    targets: ["role-ready"],
    beats: [beat("a", 0, "roles.citizen", { sfx: "ui.card" }), beat("b", 1900, "roles.find"), beat("c", 3800, "roles.ready")],
  },
  sceneOf("keyword"),
  {
    id: "answers", kind: "do", ms: 16000, autoActMs: TUTORIAL_AUTO_ACT_MS, targets: ["clues-btn"],
    beats: [beat("a", 0, "answers.open"), beat("b", null, "answers.suspect", { holdMs: 3600 })],
  },
  {
    ...sceneOf("postit"),
    beats: [
      beat("start", 0, "postit.tool"),
      beat("a", null, "postit.pick", { sfx: "ui.tap" }),
      beat("b", null, "postit.fall", { holdMs: 2200, sfx: "ui.tap" }),
    ],
  },
  {
    ...sceneOf("discussion"),
    ms: 19500, ringAtMs: 4100,
    beats: [beat("a", 0, "discussion.unanimous"), beat("b", 2100, "discussion.majority"), beat("c", 4100, "discussion.request")],
  },
  {
    id: "verdict", kind: "do", ms: 16800, autoActMs: TUTORIAL_AUTO_ACT_MS, targets: ["first-ballot"],
    beats: [beat("a", 0, "verdict.choice"), beat("b", null, null, { holdMs: EARLY_GRACE_MS }), beat("c", null, null, { holdMs: 3000 })],
  },
  {
    id: "answerReveal", kind: "watch", ms: ANSWER_REVEAL_MS, beats: [beat("a", 0, null)],
  },
  {
    ...sceneOf("night"),
    targets: ["night-done"],
    beats: [
      beat("a", 0, "night.ready"),
      beat("b", null, null, { holdMs: EARLY_GRACE_MS, sfx: "ui.tap" }),
      sceneOf("night").beats[2]!,
    ],
  },
  sceneOf("end"),
];

/** 가짜 시계의 기준 시각 — 인자를 안 주면 쓰는 고정 값(시험·정적 미리보기용) */
export const TUTORIAL_EPOCH = 1_700_000_000_000;

// ---- 대행·반응 ----

/**
 * 장면 scene(비트 beat)의 링 대상을 눌렀을 때의 일. 12초 안 누르면 대본이 이것을 대신 한다(같은 결과). 보기 장면·눌러서 할 일이 더 없는 비트는 null.
 * 도구 열기와 선택·결과가 한 장면에 있으면 비트로 가른다.
 */
export function autoAct(id: TutorialSceneId, at?: TutorialBeatId, playtest = false): TutorialAction | null {
  switch (id) {
    case "roles":
      return playtest && at === "c" ? { target: "role-ready", msg: { t: "roleReady" }, steps: 1, next: null } : null;
    case "keyword":
      return { target: "send", msg: { t: "answer", text: TUTORIAL_MY_ANSWER, final: true }, steps: 1, next: null };
    case "answers":
      return playtest && (at === undefined || at === "a") ? { target: "clues-btn", msg: null, steps: 0, next: "b" } : null;
    case "discussion":
      return { target: "endDiscussion", msg: { t: "endDiscussion", on: true }, steps: playtest ? TUTORIAL_CAST.seats.length : END_STEPS, next: null };
    case "verdict":
      if (playtest) {
        return at === undefined || at === "a"
          ? { target: "first-ballot", msg: { t: "firstBallot", target: null }, steps: 1, next: "b" }
          : null;
      }
      return { target: "yes", msg: { t: "verdict", agree: true }, steps: VERDICT_VOTES.length, next: null };
    case "pick":
      return { target: "tag-4", msg: { t: "point", target: TUTORIAL_CAST.suspect }, steps: PICK_LINES.length - PICK_MINE_AT, next: null };
    case "night":
      if (at !== undefined && at !== "a") return null;
      return playtest
        ? { target: "night-done", msg: { t: "nightDone" }, steps: 1, next: "b" }
        : { target: "face-0", msg: { t: "pick", target: 0 }, steps: 1, next: "b" };
    case "postit":
      if (at === undefined || at === "start") return { target: "suspect-btn", msg: null, steps: 0, next: "a" };
      if (at === "a") return { target: "tag-4", msg: { t: "suspect", target: TUTORIAL_CAST.suspect }, steps: 0, next: "b" };
      return null;
    default:
      return null;
  }
}

/** 화면이 보낸 메시지가 그 비트의 링 대상 조작이면 그 일을, 아니면 null(그 밖의 조작은 대본이 반응하지 않는다) */
export function reactTo(id: TutorialSceneId, at: TutorialBeatId, msg: ClientMessage, playtest = false): TutorialAction | null {
  const act = autoAct(id, at, playtest);
  if (act === null || act.msg === null) return null;
  if (act.msg.t === "firstBallot" && msg.t === "firstBallot") {
    const valid = msg.target === null || (msg.target !== TUTORIAL_CAST.me && TUTORIAL_CAST.seats.some(({ seat }) => seat === msg.target));
    return valid ? { ...act, msg } : null;
  }
  return JSON.stringify(act.msg) === JSON.stringify(msg) ? act : null;
}

// ---- 가짜 view ----

/** 그 장면·비트에서 유령인 좌석(공개 값) */
function deadSeats(id: TutorialSceneId, at: TutorialBeatId, playtest: boolean): number[] {
  const { executed, nightVictim } = TUTORIAL_CAST;
  if (playtest) return id === "end" || (id === "night" && at === "c") ? [nightVictim] : [];
  if (id === "will") return at === "a" ? [] : [executed];
  if (id === "night") return at === "c" ? [executed, nightVictim] : [executed];
  if (id === "postit" || id === "end") return [executed, nightVictim];
  return [];
}

function playersOf(dead: readonly number[]): PublicPlayer[] {
  return TUTORIAL_CAST.seats.map((c): PublicPlayer => {
    const look: OutfitId = c.look;
    return { seat: c.seat, nickname: c.name, connected: true, isHost: false, ...(dead.includes(c.seat) ? { alive: false } : {}), look };
  });
}

/**
 * 장면 id 의 비트 at 에 보이는 가짜 RoomView. 매번 새 객체다.
 * startedAt 은 장면 시작 시각(서버 시각 자리) — phaseEndsAt = startedAt + 장면 길이. acted 는 눌러서 반응이 나온 단계 수(0 = 아직)다.
 * 마피아 ??? 맛보기(keyword 의 비트 b)만 역할 mafia 이고 me.keyword 키가 없다.
 */
export function tutorialView(
  id: TutorialSceneId,
  at?: TutorialBeatId,
  startedAt: number = TUTORIAL_EPOCH,
  acted = 0,
  { playtest = false, firstBallot }: { playtest?: boolean; firstBallot?: number | null } = {},
): RoomView {
  const scene = (playtest ? TUTORIAL_PLAYTEST_SCENES : TUTORIAL_SCENES).find((entry) => entry.id === id)!;
  at ??= scene.beats[0]!.id;
  // 역할 확인은 시작 5초에 저절로 뒤집힌다 — 시계를 앞당겨 0.4초에 뒤집히게 한다(실제 카드 규칙을 그대로 쓴다)
  const duration = id === "roles" ? scene.ms + (AUTO_FLIP_MS - TUTORIAL_FLIP_AT_MS) : scene.ms;
  const roles = rolesInPlay(TUTORIAL_CAST.seats.length);
  const phase = phaseOf(id, at);
  const dayN = playtest ? id === "end" ? 2 : 1 : id === "postit" ? (at === "c" ? 3 : 2) : id === "end" ? 3 : 1;
  const daytime = phase === "discussion" || phase === "verdict" || phase === "nomination" || phase === "execution" || phase === "morning";
  const mine = { seat: TUTORIAL_CAST.me, isHost: false, ...(daytime ? { chat: "all" as const } : {}) } as const;
  const keyword = { genre: TUTORIAL_CAST.genre };

  const view = {
    code: "",
    phase,
    round: 1,
    phaseEndsAt: startedAt + scene.ms,
    phaseDurationMs: duration,
    serverNow: startedAt,
    minPlayers: 4,
    maxPlayers: 8,
    mapChoice: playtest ? "bar" : "plaza",
    map: playtest ? "bar" : "plaza",
    ...(playtest ? { playtest: true as const } : {}),
    players: playersOf(deadSeats(id, at, playtest)),
    me: { ...mine },
    day: { n: dayN, roles },
  } satisfies RoomView;

  const out: RoomView = view;
  const day = out.day!;
  if (playtest && phase === "discussion" && dayN === 1) {
    day.voteOpensAt = startedAt + PLAYTEST_DISCUSSION_MIN_MS;
    day.voteReadyTotal = TUTORIAL_CAST.seats.length;
    day.voteReadyRequired = majorityOf(TUTORIAL_CAST.seats.length);
  }
  switch (id) {
    case "roles":
      out.me = { ...mine, role: "citizen", ...(playtest && acted >= 1 ? { roleReady: true as const } : {}) };
      break;
    case "keyword": {
      if (at === "b") {
        // 마피아 면: 모양은 같고 키워드 줄만 ??? — me.keyword 키가 없다
        out.me = { ...mine, role: "mafia" };
      } else {
        out.me = { ...mine, role: "citizen", keyword: TUTORIAL_CAST.word, ...(at === "c" ? { answer: { text: TUTORIAL_MY_ANSWER, final: acted >= 1 } } : {}) };
      }
      day.keyword = keyword;
      break;
    }
    case "answers":
      out.me = { ...mine, role: "citizen" };
      day.keyword = { ...keyword, answers: TUTORIAL_ANSWERS.map((r) => ({ ...r })) };
      break;
    case "discussion": {
      const count = Math.min(acted, playtest ? TUTORIAL_CAST.seats.length : END_STEPS);
      out.me = { ...mine, role: "citizen", ...(count >= 1 ? { endDiscussion: true as const } : {}) };
      day.endCount = count;
      day.keyword = { ...keyword, answers: TUTORIAL_ANSWERS.map((r) => ({ ...r })) };
      if (playtest) day.suspects = [{ to: TUTORIAL_CAST.suspect, from: TUTORIAL_CAST.me }];
      break;
    }
    case "verdict": {
      if (playtest) {
        const count = at === "a" ? 0 : TUTORIAL_CAST.seats.length;
        // 다른 참가자들은 건너뛴다. 어느 얼굴을 고르든 그 한 표까지 공개 집계에 반영한다.
        const votes = typeof firstBallot === "number" ? 1 : 0;
        out.me = { ...mine, role: "citizen", ...(at === "b" ? { firstBallot: firstBallot ?? null } : {}) };
        day.firstBallot = {
          count,
          ...(at === "c" ? { result: { target: null, votes, holds: count - votes, reason: "held" as const } } : {}),
        };
        break;
      }
      const shown = VERDICT_VOTES.slice(0, Math.min(acted, VERDICT_VOTES.length));
      out.me = { ...mine, role: "citizen", ...(acted >= 1 ? { verdictVote: true } : {}) };
      day.verdictCount = { yes: shown.filter((v) => v).length, no: shown.filter((v) => !v).length };
      break;
    }
    case "pick": {
      // 비트 a·b 는 앞 차례(0, 1), 비트 c 는 내 차례에서 시작해 acted 만큼 뒤 차례가 나온다
      const turn = at === "a" ? 0 : at === "b" ? 1 : PICK_MINE_AT + Math.min(acted, PICK_LINES.length - PICK_MINE_AT);
      const shown = PICK_LINES.slice(0, at === "c" ? turn : turn + 1).map((l) => ({ ...l }));
      out.me = { ...mine, role: "citizen" };
      day.points = shown;
      day.turn = { order: [...PICK_ORDER], i: turn, ...(turn < PICK_ORDER.length ? { endsAt: startedAt + scene.ms } : {}) };
      break;
    }
    case "will":
      out.me = { ...mine, role: "citizen" };
      day.candidate = TUTORIAL_CAST.executed;
      day.execution = { seat: TUTORIAL_CAST.executed, will: TUTORIAL_WILL };
      break;
    case "answerReveal":
      out.me = { ...mine, role: "citizen" };
      day.keyword = { ...keyword, answer: TUTORIAL_CAST.word };
      break;
    case "night":
      out.me = { ...mine, role: "citizen", ...(at === "b" ? playtest ? { nightDone: true as const } : { pick: 0 } : {}) };
      if (at === "c") day.morning = { eliminated: TUTORIAL_CAST.nightVictim };
      break;
    case "postit":
      out.me = { ...mine, role: "citizen", ...(at === "b" ? { suspectTo: TUTORIAL_CAST.suspect } : {}) };
      if (playtest) day.keyword = { ...keyword, answers: TUTORIAL_ANSWERS.map((r) => ({ ...r })) };
      if (at === "b") day.suspects = [{ to: TUTORIAL_CAST.suspect, from: TUTORIAL_CAST.me }];
      break;
    case "end":
      out.me = { ...mine, role: "citizen" };
      break;
  }
  return out;
}

function phaseOf(id: TutorialSceneId, at: TutorialBeatId): PhaseId {
  switch (id) {
    case "roles":
      return "roleReveal";
    case "keyword":
      return "keyword";
    case "answers":
    case "discussion":
    case "end":
      return "discussion";
    case "verdict":
      return "verdict";
    case "pick":
      return "nomination";
    case "will":
      return "execution";
    case "answerReveal":
      return "answerReveal";
    case "night":
      return at === "c" ? "morning" : "night";
    case "postit":
      return at === "c" ? "dayAnnounce" : "discussion";
  }
}

// ---- 월드 스냅 ----

/**
 * 좌석이 서는 자리(월드 단위, 시계탑 광장). 둘레 반지름 약 2.6 의 고리 — 연단(반지름 1.4 + 캐릭터 0.35) 밖이고 모두 걸을 수 있는 칸이다(시험).
 * 도윤(1)·서연(2)의 자리는 이름표가 폰 화면 안쪽에 들게 정한 옛 측정값을 따른다(24-10 스크린샷에서 다시 확인).
 */
const RING_SPOTS: Readonly<Record<number, { x: number; z: number }>> = {
  0: { x: -2.6, z: 0 },
  1: { x: 1.3, z: -1.5 },
  2: { x: -1.3, z: -2.3 },
  3: { x: -1.3, z: 2.3 },
  4: { x: 2.6, z: 0 },
  5: { x: 1.3, z: 2.3 },
};
/**
 * 장면 9: 내 자리(5) 곁에 하린(4)·민준(0)·지호(3)가 모여 선다 — 모두 켜는 문턱(92%, 2.2 단위) 안이다.
 * 도윤(1)·서연(2) 은 유령이고 멀리 있다(근처 판정 거짓). 시험이 withinNoteReach 로 지킨다.
 */
const NOTE_SPOTS: Readonly<Record<number, { x: number; z: number }>> = {
  0: { x: 2.2, z: 4.0 },
  1: { x: -2.6, z: 0 },
  2: { x: -1.3, z: -2.3 },
  3: { x: -0.4, z: 3.4 },
  4: { x: 2.6, z: 2.8 },
  5: { x: 1.3, z: 2.3 },
};

/** 서 있는 여섯 좌석의 위치 snap 한 프레임(로컬 WorldStore.applyFrame 에 주는 값). 시각 at 은 호출한 쪽이 준다 */
export function tutorialSnap(id: TutorialSceneId, at: number, playtest = false): Extract<WorldFrame, { k: "snap" }> {
  const spots = id === "postit" ? NOTE_SPOTS : RING_SPOTS;
  let world: WorldState = emptyWorld();
  const players: { id: string; seat: number }[] = [];
  for (const { seat } of TUTORIAL_CAST.seats) {
    const spot = spots[seat]!;
    const pid = `tut-${seat}`;
    players.push({ id: pid, seat });
    const position = { x: Math.round(spot.x * UNIT), z: Math.round(spot.z * UNIT) };
    const { x, z } = playtest ? snapToWalkable(BAR_MAP, position) : position;
    world = { ...world, segs: { ...world.segs, [pid]: restSegment(x, z, at) } };
  }
  return snapFrame(world, players, at);
}

// ---- 로컬 send 어댑터 ----

export interface TutorialSendHandlers {
  onRoleReady?: () => void;
  onAnswer?: (text: string, final: boolean) => void;
  onEndDiscussion?: (on: boolean) => void;
  onVerdict?: (agree: boolean) => void;
  onFirstBallot?: (target: number | null) => void;
  onPoint?: (target: number) => void;
  onPick?: (target: number) => void;
  onNightDone?: () => void;
  onSuspect?: (target: number) => void;
}

/**
 * 로컬 send. 대본이 아는 메시지만 해당 콜백을 부르고, 그 밖(이동·채팅·입력 중·동작 …)은
 * 아무 일 없이 true 를 돌려준다 — false 를 주면 보내지 못한 분기를 타기 때문이다. 서버·소켓으로는 아무것도 나가지 않는다.
 */
export function makeTutorialSend(h: TutorialSendHandlers): (msg: ClientMessage) => boolean {
  return (msg) => {
    switch (msg.t) {
      case "roleReady":
        h.onRoleReady?.();
        break;
      case "answer":
        h.onAnswer?.(msg.text, msg.final);
        break;
      case "endDiscussion":
        h.onEndDiscussion?.(msg.on);
        break;
      case "verdict":
        h.onVerdict?.(msg.agree);
        break;
      case "firstBallot":
        h.onFirstBallot?.(msg.target);
        break;
      case "point":
        h.onPoint?.(msg.target);
        break;
      case "pick":
        h.onPick?.(msg.target);
        break;
      case "nightDone":
        h.onNightDone?.();
        break;
      case "suspect":
        h.onSuspect?.(msg.target);
        break;
      default:
        break;
    }
    return true;
  };
}
