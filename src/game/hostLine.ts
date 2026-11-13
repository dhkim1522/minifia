// 사회자 문구 표와 그 파생 판정(14페이즈, 결정 0073 예정 — HOST-01·03·05, UI-SPEC "사회자 문구 표").
// 자막 문장은 서버가 만들지 않는다. 클라이언트가 받은 자기 view 만으로 이 파일의 순수 함수가 한 줄을 만든다 — 서버·프로토콜 diff 0.
// 읽는 값은 허용 목록뿐이다: phase · phaseEndsAt · phaseDurationMs · minPlayers · me.seat · me.role · me.isHost ·
// players[].{seat, alive, connected} · day.candidate · day.verdict.passed · day.morning(유무) · local.cardSeen ·
// (15-04) me.errand.places · me.errand.done · view.map(심부름 목록·진행·맵 id — 내 view 의 값) · local.pos(내 월드 좌표, 클라이언트 상태) ·
// (15-07) me.record 의 유무(불리언 — 줄 내용 seat·place 는 읽지 않는다) · day.morning.trace 의 유무 · local.recordOpened · local.traceOn(클라이언트 상태).
// (16-09) day.evidence.trace 의 유무(모두에게 같은 공개 값 — 조각 값·day.evidence.seen·players[].look 은 읽지 않는다).
// 심부름 분기(errand.*)와 목격 기록·흔적 분기(witness·trace)는 역할(me.role)을 읽지 않는다 — 마피아도 시민과 같은 키·같은 문장·같은 빛남 대상(D-03, D-04).
// players[].job · spectate · me.allies · me.records · me.pick · me.verdictVote · day.points · day.turn · day.voteLog · day.roles 등 그 밖은 읽지 않는다
// (유령 줄도 남의 직업을 말하지 않는다). 시각·난수·DOM·window 를 읽지 않는다. 시험(test/unit/hostLine.test.ts "HOST-05")이 읽은 경로를 기록해 고정한다.
// 역할별 줄(밤 마피아·경찰·의사)은 그 역할 분기 안에서 키가 정해진 뒤에만 꺼낸다(T-09-29 선례) — 여러 역할 줄을 모은 배열은 없다.
// 18.1-12(결정 0083-8): 띠 문장은 "할 일 한 구절"(앞말·마침표·닉네임 없음, 공백 포함 19자 이하)이라 닉네임·아침 결과 문장은 읽지 않는다.
// 빈 문자열 = 큰 글·시작 카드가 같은 말을 하는 동안(처형·아침·흔적 구간·심부름 시작 카드) — 대체 문장으로 바꾸지 않는다(대체 문장은 키가 fallback 일 때만).
// local.startCard(클라이언트 상태)는 심부름 단계 문장만 비운다 — 키·빛남 대상은 바꾸지 않는다.
// (21-08) 확장판 갈래: view.mode 는 규칙 값(rulesetOf(modeOf(view)).errand) 하나로만 읽고, me.clues·me.record 는 있는지(유무·개수)만 본다, local.sceneOn(클라이언트 상태).
// 확장판 밤은 역할(me.role)을 읽기 전에 판 규칙으로 갈린다 — 네 역할이 같은 키 night.house·같은 문장·같은 빛남 대상(T-21-21). 줄 내용(단서 종류·목격 좌석)은 읽지 않는다.
import type { PhaseId, PlaceId, RoomView } from "../../shared/protocol";
import { isAlive } from "../../shared/game/alive";
import { connectedCount } from "../../shared/game/room";
import { modeOf, rulesetOf } from "../../shared/game/ruleset";
import { actablePlaceOf, errandProgress, nextPlaceOf, placeCentersOf } from "./errandView";
import { TIMELESS_PHASES } from "./scenes";

/** 문구 표의 키 하나 = 한 줄. 15페이즈는 errand.*·witness·trace 를 채웠고, 16페이즈는 trace 문장을 고치고 discussion.evidence 를 더했다. */
export type HostKey =
  | "lobby.ready" | "lobby.gather" | "lobby.guest"
  | "assigning"
  | "roleReveal.act" | "roleReveal.wait"
  | "dayAnnounce.wait" | "dayAnnounce.ghost"
  | "discussion.act" | "discussion.evidence" | "discussion.clue" | "discussion.ghost"
  | "nomination.act" | "nomination.ghost"
  | "defense.act" | "defense.wait" | "defense.ghost"
  | "verdict.act" | "verdict.wait" | "verdict.ghost"
  | "execution.passed" | "execution.failed"
  | "night.mafia" | "night.police" | "night.doctor" | "night.citizen" | "night.ghost" | "night.house"
  | "morning" | "ended"
  | "errand.act" | "errand.done" | "errand.ghost"
  | "witness" | "trace"
  | "scene.act" | "scene.done" | "scene.ghost"
  | "fallback";

/** 키를 찾지 못했을 때의 한 줄(마침표 없음) */
export const HOST_FALLBACK = "잠시만 기다려 주세요";

/** 클라이언트 상태: 역할 카드 앞면을 본 적이 있는가 */
export interface HostLocal {
  cardSeen?: boolean;
  /** 내 월드 좌표(클라이언트 상태, 15-04). 심부름의 다음 장소·처리 가능 판정에만 쓴다. 모르면 없음·null */
  pos?: { x: number; z: number } | null;
  /** 목격 기록 카드를 한 번 열었는가(15-07, 클라이언트 상태). 열면 witness 가 discussion.act 로 돌아온다 */
  recordOpened?: boolean;
  /** 지금이 아침 흔적 구간인가(15-07, 클라이언트 상태 — 서버 시계로 화면이 정한다) */
  traceOn?: boolean;
  /** 심부름 시작 카드("오늘 갈 곳")가 내 화면에 떠 있는가(18.1-12, 클라이언트 상태). 떠 있는 동안 카드가 같은 말을 하므로 띠 문장은 비어 있다 */
  startCard?: boolean;
  /** 확장판 아침의 결과 알림이 끝나 현장 조사가 시작됐는가(21-08, 클라이언트 상태 — 21-12 가 채운다). 거짓이면 아침 띠는 빈 줄이다 */
  sceneOn?: boolean;
}

/**
 * 문구 표(결정 0083-8, 합쇼체, 마침표 없음). 보이는 줄은 할 일 한 구절이고 공백 포함 19자 이하다(폭 360 한 줄).
 * lobby.*·ended 는 띠 면이 보이지 않아 화면에 나오지 않는다(옛 문장 그대로). 빈 문자열은 큰 글·시작 카드가 말하는 동안이다.
 */
export const HOST_LINES: Readonly<Record<HostKey, string>> = {
  "lobby.ready": "모두 모였습니다. 시작 단추를 눌러 주세요.",
  "lobby.gather": "대기실입니다. 친구들이 모일 때까지 기다려 주세요.",
  "lobby.guest": "대기실입니다. 방장이 시작할 때까지 기다려 주세요.",
  assigning: "잠시만 기다려 주세요",
  "roleReveal.act": "내 역할 카드를 확인해 주세요",
  "roleReveal.wait": "그대로 기다려 주세요",
  "dayAnnounce.wait": "모두 모여 주세요",
  "dayAnnounce.ghost": "지켜봐 주세요",
  "discussion.act": "의심 가는 사람을 이야기해 주세요",
  "discussion.evidence": "같은 옷과 엇갈린 목격을 살펴보세요",
  // 21페이즈(UI-SPEC 자막 띠 표): 확장판 토론에서 단서·목격이 하나라도 있을 때
  "discussion.clue": "단서를 말로 나눠 보세요",
  "discussion.ghost": "유령끼리 이야기할 수 있습니다",
  "nomination.act": "처형할 사람의 이름표를 눌러 주세요",
  "nomination.ghost": "지켜봐 주세요",
  "defense.act": "마지막 말과 유언을 남겨 주세요",
  "defense.wait": "변론을 들어 주세요",
  "defense.ghost": "변론을 지켜봐 주세요",
  "verdict.act": "찬성 또는 반대를 눌러 주세요",
  "verdict.wait": "결과를 기다려 주세요",
  "verdict.ghost": "지켜봐 주세요",
  // 큰 글(처형 결과)이 말한다
  "execution.passed": "",
  "execution.failed": "",
  "night.mafia": "없앨 사람의 얼굴을 눌러 주세요",
  "night.police": "조사할 사람의 얼굴을 눌러 주세요",
  "night.doctor": "지킬 사람의 얼굴을 눌러 주세요",
  "night.citizen": "한 명의 얼굴을 눌러 주세요",
  "night.ghost": "모두의 밤 행동을 지켜봐 주세요",
  // 21페이즈: 확장판 밤 — 네 역할이 같은 문장(문장으로도 역할이 갈리지 않는다)
  "night.house": "집 하나를 눌러 주세요",
  // 큰 글(아침 결과)·증거 카드(흔적 구간)가 말한다
  morning: "",
  ended: "게임이 끝났습니다. 다음 판을 준비해 주세요.",
  // 15페이즈(UI-SPEC 표 원문, 합쇼체·역할 단어 없음). 마피아도 같은 문장이다. 심부름 시작 카드가 떠 있는 동안은 hostLineOf 가 빈 줄을 돌려준다(18.1-12).
  // 21페이즈(UI-SPEC 자막 띠 표): 심부름 단계는 확장판에만 있다 — 저녁 등불 켜기 문장
  "errand.act": "등불 세 곳을 켜 주세요",
  "errand.done": "곧 밤이 됩니다",
  "errand.ghost": "지켜봐 주세요",
  // 15페이즈(UI-SPEC 표 원문): 목격 기록이 있는 토론. 마피아도 같은 문장이다. 16페이즈(D-11): 흔적이 있는 날 토론은 discussion.evidence 다 —
  // '범인'·'증거'·'확정' 없이 공개된 두 근거(같은 옷·목격)만 말한다.
  witness: "기록 단추로 본 것을 확인해 주세요",
  trace: "",
  // 21페이즈: 확장판 아침 현장 조사
  "scene.act": "빛나는 곳을 살펴보세요",
  "scene.done": "곧 토론이 시작됩니다",
  "scene.ghost": "지켜봐 주세요",
  fallback: HOST_FALLBACK,
};

/** 내가 탈락했는가: players 에서 내 좌석의 생존 값만 본다 */
function isGhost(view: RoomView): boolean {
  const mine = view.players.find((p) => p.seat === view.me.seat);
  return mine !== undefined && !isAlive(mine);
}

/** 확장판 판인가 — 판 규칙 값 하나만 읽는다(판 이름을 직접 가르지 않는다) */
function extendedOf(view: RoomView): boolean {
  return rulesetOf(modeOf(view)).errand;
}

/** 단계 × 상태(act|wait|ghost) × 역할(밤만) → 키. 꺼진 장치 단계(결선·마지막 3인)와 모르는 단계는 fallback */
export function hostKeyOf(view: RoomView, local: HostLocal = {}): HostKey {
  const ghost = isGhost(view);
  const defender = view.day?.candidate === view.me.seat;
  switch (view.phase) {
    case "lobby":
      if (!view.me.isHost) return "lobby.guest";
      return connectedCount(view.players) >= view.minPlayers ? "lobby.ready" : "lobby.gather";
    case "assigning":
      return "assigning";
    case "roleReveal":
      if (view.me.role === undefined) return "fallback";
      return local.cardSeen === true ? "roleReveal.wait" : "roleReveal.act";
    case "dayAnnounce":
      return ghost ? "dayAnnounce.ghost" : "dayAnnounce.wait";
    case "errand": {
      // 역할을 읽지 않는다: 유령 → ghost, 3곳을 마친 산 사람 → done, 그 밖 → act
      if (ghost) return "errand.ghost";
      return errandProgress(view)?.complete === true ? "errand.done" : "errand.act";
    }
    case "discussion":
      if (ghost) return "discussion.ghost";
      // 21-08: 확장판 갈래를 먼저 — 단서(me.clues)나 목격 기록(me.record)이 하나라도 있으면 discussion.clue, 아니면 discussion.act. witness·discussion.evidence 는 쓰지 않는다
      if (extendedOf(view)) return (view.me.clues?.length ?? 0) > 0 || (view.me.record?.length ?? 0) > 0 ? "discussion.clue" : "discussion.act";
      // 역할을 읽지 않는다. 우선순위: 기록을 아직 안 연 사람 → witness, 흔적이 있는 날 → discussion.evidence, 그 밖 → discussion.act.
      // 기록이 있다는 사실(불리언)과 day.evidence.trace 의 유무만 본다 — 줄 내용·조각 값·목격자는 읽지 않는다
      if (view.me.record !== undefined && local.recordOpened !== true) return "witness";
      return view.day?.evidence?.trace !== undefined ? "discussion.evidence" : "discussion.act";
    case "nomination":
      return ghost ? "nomination.ghost" : "nomination.act";
    case "defense":
      if (ghost) return "defense.ghost";
      return defender ? "defense.act" : "defense.wait";
    case "verdict":
      if (ghost) return "verdict.ghost";
      return defender ? "verdict.wait" : "verdict.act";
    case "execution": {
      const passed = view.day?.verdict?.passed;
      if (passed === undefined) return "fallback";
      return passed ? "execution.passed" : "execution.failed";
    }
    case "night": {
      if (ghost) return "night.ghost";
      // 21-08: 확장판 밤은 역할을 읽기 전에 갈린다(T-21-21) — 네 역할 모두 같은 키
      if (extendedOf(view)) return "night.house";
      const role = view.me.role;
      if (role === "mafia") return "night.mafia";
      if (role === "police") return "night.police";
      if (role === "doctor") return "night.doctor";
      return "night.citizen";
    }
    case "morning": {
      const morning = view.day?.morning;
      if (morning === undefined) return "fallback";
      // 21-08: 확장판 아침 — 결과 알림이 끝나기 전(sceneOn 거짓)은 빈 줄, 그 뒤 유령 scene.ghost · 단서 셋을 다 살폈으면 scene.done · 그 밖 scene.act. 역할을 읽지 않는다
      if (extendedOf(view)) {
        if (local.sceneOn !== true) return "morning";
        if (ghost) return "scene.ghost";
        return (view.me.clues?.length ?? 0) >= 3 ? "scene.done" : "scene.act";
      }
      return local.traceOn === true && morning.trace !== undefined ? "trace" : "morning";
    }
    case "ended":
      return "ended";
    default:
      return "fallback";
  }
}

/**
 * 한 줄 — 키의 줄 그대로. 빈 줄은 빈 줄이다(큰 글·시작 카드가 말하는 동안). 대체 문장은 키가 fallback 일 때만(HOST_FALLBACK).
 * 심부름 단계에서 시작 카드가 떠 있으면(local.startCard) 키·빛남 대상은 그대로 두고 문장만 비운다(카드가 같은 말을 한다).
 */
export function hostLineOf(view: RoomView, local: HostLocal = {}): string {
  if (view.phase === "errand" && local.startCard === true) return "";
  return HOST_LINES[hostKeyOf(view, local)];
}

/** 띠 면이 보이지 않는 단계: 대기실·결과(초가 없다). 면의 한 줄 자리는 그대로 차지한다(18.1-12) */
export const HOST_HIDDEN_PHASES: readonly PhaseId[] = Object.freeze(["lobby", "ended"] as const);

/** 띠의 세 상태: show = 문장(+초·막대), blank = 문장 없이 초·막대만, off = 면을 보이지 않게(자리는 남는다) */
export type HostBandMode = "show" | "blank" | "off";

/**
 * 띠 상태. 숨는 단계(HOST_HIDDEN_PHASES)이거나 문장이 비었는데 시간 행도 없으면 off(빈 상자가 뜨지 않게 하는 안전 규칙),
 * 문장이 비었고 시간 행이 있으면 blank, 그 밖은 show.
 */
export function hostBandModeOf(view: RoomView, line: string): HostBandMode {
  if (HOST_HIDDEN_PHASES.includes(view.phase)) return "off";
  if (line === "") return hostTimeOf(view) ? "blank" : "off";
  return "show";
}

export type CallTool = "start" | "card" | "chat" | "will" | "verdict" | "errand" | "record" | "scene";
/** 15페이즈: place = 다음 장소 표지(화면 밖이면 화살표 칩). 21페이즈: house = 확장판 밤의 집 판(산 사람 좌석 전원) */
export type CallTarget = { kind: "tool"; tool: CallTool } | { kind: "tag"; seats: readonly number[] } | { kind: "place"; id: PlaceId } | { kind: "house"; seats: readonly number[] };

function aliveSeats(view: RoomView, includeMe: boolean): number[] {
  return view.players
    .filter((p) => isAlive(p) && (includeMe || p.seat !== view.me.seat))
    .map((p) => p.seat)
    .sort((a, b) => a - b);
}

/**
 * 빛남 대상(UI-SPEC "빛남 계약" 표). 공개 정보와 내 역할만으로 정한다 — 밤 고르기는 네 역할이 같은 칸이 빛나 빛으로 역할이 드러나지 않는다.
 * "이미 썼는가"(내 선택·시트 열림)는 이 함수가 보지 않는다 — 화면이 끈다(14-04).
 */
export function callTargetsOf(view: RoomView, local: HostLocal = {}): CallTarget | null {
  const key = hostKeyOf(view, local);
  switch (key) {
    case "lobby.ready":
      return { kind: "tool", tool: "start" };
    case "roleReveal.act":
      return { kind: "tool", tool: "card" };
    case "witness":
      return { kind: "tool", tool: "record" };
    case "discussion.act":
    case "discussion.clue":
    case "discussion.evidence":
      return { kind: "tool", tool: "chat" };
    case "scene.act":
      return { kind: "tool", tool: "scene" };
    case "night.house": {
      // 확장판 밤 집 판(21-11): 산 사람 전원(나 포함)이 같이 빛난다 — 역할과 무관하다
      const seats = aliveSeats(view, true);
      return seats.length === 0 ? null : { kind: "house", seats };
    }
    case "nomination.act": {
      const seats = aliveSeats(view, false);
      return seats.length === 0 ? null : { kind: "tag", seats };
    }
    case "defense.act":
      return { kind: "tool", tool: "will" };
    case "verdict.act":
      return { kind: "tool", tool: "verdict" };
    case "errand.act": {
      // 처리 반경 안 미완료 장소가 있으면 [처리] 가 빛나고(장소 표지는 꺼짐), 아니면 다음 장소 표지가 빛난다(한 화면 한 종류)
      const progress = errandProgress(view);
      if (progress === null) return null;
      const centers = placeCentersOf(view);
      if (actablePlaceOf(local.pos, centers, progress.done) !== null) return { kind: "tool", tool: "errand" };
      const next = nextPlaceOf(local.pos, centers, progress.done);
      return next === null ? null : { kind: "place", id: next };
    }
    case "night.mafia":
    case "night.citizen":
    case "night.police":
    case "night.doctor": {
      // 밤 고르기는 역할과 무관하다(D-05) — 산 사람 모두 나를 포함한 산 사람 전원이 같이 빛난다
      const seats = aliveSeats(view, true);
      return seats.length === 0 ? null : { kind: "tag", seats };
    }
    default:
      return null;
  }
}

/** 막대·숫자 행을 그리는가: 시간이 있는 단계이고 마감·길이가 있고 3초 이상 */
export function hostTimeOf(view: RoomView): boolean {
  if (TIMELESS_PHASES.includes(view.phase)) return false;
  if (view.phaseEndsAt === null || view.phaseDurationMs === null) return false;
  return view.phaseDurationMs >= 3000;
}

/**
 * 알림음을 낼 프레임인가(HOST-02). 이전 단계가 있고 단계가 바뀌었고 처음 마운트·연결 번호가 바뀐 첫 프레임(fresh)이 아닐 때.
 * 낮 시작 → 심부름은 낮 시작에서 이미 울렸으므로 울리지 않고, 심부름 → 토론은 울린다(15-04, UI-SPEC U-15).
 * 낮 시작 → 토론(심부름을 건너뛴 옛 흐름)도 그대로 울리지 않는다(알림음은 한 번).
 */
export function hostChimeOf(prev: PhaseId | null, cur: PhaseId, fresh: boolean): boolean {
  if (prev === null || fresh || prev === cur) return false;
  // 17-07(결정 0080-14): 함께 진행 튜토리얼은 자기 띠·소리를 가진다 — 대기실 → tutorial, tutorial → 배정에는 실제 사회자 알림음이 없다(띠·알림음이 겹치지 않게)
  if (prev === "tutorial" || cur === "tutorial") return false;
  if (prev === "dayAnnounce" && (cur === "discussion" || cur === "errand")) return false;
  return true;
}
