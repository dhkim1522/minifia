// 사회자 문구 표와 그 파생 판정(14페이즈, 결정 0073 예정 — HOST-01·03·05, UI-SPEC "사회자 문구 표").
// 자막 문장은 서버가 만들지 않는다. 클라이언트가 받은 자기 view 만으로 이 파일의 순수 함수가 한 줄을 만든다 — 서버·프로토콜 diff 0.
// 읽는 값은 허용 목록뿐이다: phase · phaseEndsAt · phaseDurationMs · minPlayers · me.seat · me.role · me.isHost ·
// players[].{seat, alive, connected} · day.candidate · day.execution(유무) · day.morning(유무) · local.cardSeen ·
// players[].job · spectate · me.allies · me.records · me.pick · me.verdictVote · day.points · day.turn · day.roles · me.answer.final(키워드 제출 여부, 글은 읽지 않는다) 등 그 밖은 읽지 않는다
// (유령 줄도 남의 직업을 말하지 않는다). 시각·난수·DOM·window 를 읽지 않는다. 시험(test/unit/hostLine.test.ts "HOST-05")이 읽은 경로를 기록해 고정한다.
// 역할별 줄(밤 마피아·경찰·의사)은 그 역할 분기 안에서 키가 정해진 뒤에만 꺼낸다(T-09-29 선례) — 여러 역할 줄을 모은 배열은 없다.
// 18.1-12(결정 0083-8): 띠 문장은 "할 일 한 구절"(앞말·마침표·닉네임 없음, 공백 포함 19자 이하)이라 닉네임·아침 결과 문장은 읽지 않는다.
// 빈 문자열 = 큰 글이 같은 말을 하는 동안(처형·아침) — 대체 문장으로 바꾸지 않는다(대체 문장은 키가 fallback 일 때만).
// 역할을 읽는 곳은 밤 역할별 줄 분기뿐이다(아침·토론 키와 빛남 대상은 역할을 읽지 않는다 — 마피아도 시민과 같다).
import type { PhaseId, RoomView } from "../../shared/protocol";
import { isAlive } from "../../shared/game/alive";
import { connectedCount } from "../../shared/game/room";
import { keywordAnswerOf } from "./keywordView";
import { TIMELESS_PHASES } from "./scenes";

/** 문구 표의 키 하나 = 한 줄. */
export type HostKey =
  | "lobby.ready" | "lobby.gather" | "lobby.guest"
  | "assigning"
  | "roleReveal.act" | "roleReveal.wait"
  | "keyword.act" | "keyword.wait"
  | "dayAnnounce.wait" | "dayAnnounce.ghost"
  | "discussion.act" | "discussion.ghost"
  | "nomination.act" | "nomination.ghost"
  | "defense.act" | "defense.wait" | "defense.ghost"
  | "verdict.act" | "verdict.ghost"
  | "execution.passed"
  | "answerReveal"
  | "night.mafia" | "night.police" | "night.doctor" | "night.citizen" | "night.ghost"
  | "morning" | "ended" | "ended.answer"
  | "fallback";

/** 키를 찾지 못했을 때의 한 줄(마침표 없음) */
export const HOST_FALLBACK = "잠시만 기다려 주세요";

/** 클라이언트 상태: 역할 카드 앞면을 본 적이 있는가 */
export interface HostLocal {
  cardSeen?: boolean;
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
  // 첫날 키워드(P23-8): 역할과 무관한 두 줄 — 문구가 키워드를 말하지 않아야 마피아 화면과 같은 줄이 된다. 제출 전 act, 제출 뒤 wait(23-09).
  "keyword.act": "떠오르는 말을 적어요",
  "keyword.wait": "곧 모두의 답이 나와요",
  "dayAnnounce.wait": "모두 모여 주세요",
  "dayAnnounce.ghost": "지켜봐 주세요",
  "discussion.act": "의심 가는 사람을 이야기해 주세요",
  "discussion.ghost": "유령끼리 이야기할 수 있습니다",
  "nomination.act": "차례대로 한 명을 골라요",
  "nomination.ghost": "지켜봐 주세요",
  "defense.act": "마지막 한마디",
  "defense.wait": "마지막 한마디를 들어요",
  "defense.ghost": "지켜봐 주세요",
  "verdict.act": "오늘 처형할까요?",
  "verdict.ghost": "지켜봐 주세요",
  // 큰 글(처형 결과)이 말한다
  "execution.passed": "",
  // 첫날 정답 공개(23-07, P23-20): 큰 글 "정답 + 키워드"가 말한다 — 빈 줄이라 띠는 초·막대만(blank). 역할 분기 없음
  answerReveal: "",
  "night.mafia": "없앨 사람의 얼굴을 눌러 주세요",
  "night.police": "조사할 사람의 얼굴을 눌러 주세요",
  "night.doctor": "지킬 사람의 얼굴을 눌러 주세요",
  "night.citizen": "한 명의 얼굴을 눌러 주세요",
  "night.ghost": "모두의 밤 행동을 지켜봐 주세요",
  // 큰 글(아침 결과)이 말한다
  morning: "",
  ended: "게임이 끝났습니다. 다음 판을 준비해 주세요.",
  // 결과 화면의 정답 한 줄(23-11, P23-22): 동적 — 뒤에 키워드(공개 값 day.keyword.answer)를 붙여 쓴다. 키워드 12자소 상한 덕에 "정답 · " 포함 19자 이하
  "ended.answer": "정답 · ",
  fallback: HOST_FALLBACK,
};

/** 내가 탈락했는가: players 에서 내 좌석의 생존 값만 본다 */
function isGhost(view: RoomView): boolean {
  const mine = view.players.find((p) => p.seat === view.me.seat);
  return mine !== undefined && !isAlive(mine);
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
    case "keyword":
      return view.me.answer?.final === true ? "keyword.wait" : "keyword.act"; // 제출 여부만 읽는다 — 역할·글은 읽지 않는다(P23-8)
    case "dayAnnounce":
      return ghost ? "dayAnnounce.ghost" : "dayAnnounce.wait";
    case "discussion":
      if (ghost) return "discussion.ghost";
      return "discussion.act";
    case "nomination":
      return ghost ? "nomination.ghost" : "nomination.act";
    case "defense":
      if (ghost) return "defense.ghost";
      return defender ? "defense.act" : "defense.wait";
    case "verdict":
      // 후보가 없다(22-10, D-11): 산 사람 전원이 같은 줄이다
      return ghost ? "verdict.ghost" : "verdict.act";
    case "execution":
      // 22-12 P22-14: 처형자 존재(day.execution)가 키다 — 부결·동점·0표는 처형 단계가 없어 실패 갈래가 없다. 줄은 비어 있고 유언 카드·큰 글이 말한다
      return view.day?.execution === undefined ? "fallback" : "execution.passed";
    case "answerReveal":
      return "answerReveal"; // 역할·생존을 읽지 않는다 — 모두 같은 줄(23-07)
    case "night": {
      if (ghost) return "night.ghost";
      const role = view.me.role;
      // 역할을 읽는 곳은 이 밤 줄 분기뿐이다.
      if (role === "mafia") return "night.mafia";
      if (role === "police") return "night.police";
      if (role === "doctor") return "night.doctor";
      return "night.citizen";
    }
    case "morning":
      return view.day?.morning === undefined ? "fallback" : "morning";
    case "ended":
      return keywordAnswerOf(view) === undefined ? "ended" : "ended.answer"; // 정답은 공개 값 한 선택기로만 읽는다(23-11, T-23-40)
    default:
      return "fallback";
  }
}

/**
 * 한 줄 — 키의 줄 그대로. 빈 줄은 빈 줄이다(큰 글이 말하는 동안). 대체 문장은 키가 fallback 일 때만(HOST_FALLBACK).
 */
export function hostLineOf(view: RoomView, local: HostLocal = {}): string {
  const key = hostKeyOf(view, local);
  if (key === "ended.answer") return `${HOST_LINES[key]}${keywordAnswerOf(view) ?? ""}`;
  return HOST_LINES[key];
}

/**
 * 띠 면이 기본으로 보이지 않는 단계: 대기실·결과(초가 없다). 면의 한 줄 자리는 그대로 차지한다(18.1-12).
 * 결과(ended)는 예외가 하나 있다 — 첫날 정답 값(day.keyword.answer)이 있으면 띠 자리에 `정답 · {키워드}` 한 줄을 보인다(23-11, P23-22).
 * 그래서 목록은 그대로 두고 hostBandModeOf 가 ended 만 정답 유무로 가른다(e2e 사본 HOST_OFF_PHASES 와 같은 값을 유지한다).
 */
export const HOST_HIDDEN_PHASES: readonly PhaseId[] = Object.freeze(["lobby", "ended"] as const);

/** 띠의 세 상태: show = 문장(+초·막대), blank = 문장 없이 초·막대만, off = 면을 보이지 않게(자리는 남는다) */
export type HostBandMode = "show" | "blank" | "off";

/**
 * 띠 상태. 숨는 단계(HOST_HIDDEN_PHASES)이거나 문장이 비었는데 시간 행도 없으면 off(빈 상자가 뜨지 않게 하는 안전 규칙),
 * 문장이 비었고 시간 행이 있으면 blank, 그 밖은 show.
 */
export function hostBandModeOf(view: RoomView, line: string): HostBandMode {
  if (view.phase === "ended" ? keywordAnswerOf(view) === undefined : HOST_HIDDEN_PHASES.includes(view.phase)) return "off";
  if (line === "") return hostTimeOf(view) ? "blank" : "off";
  return "show";
}

export type CallTool = "start" | "card" | "chat" | "will" | "verdict";
export type CallTarget =
  | { kind: "tool"; tool: CallTool }
  | { kind: "tag"; seats: readonly number[] };

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
    case "discussion.act":
      return { kind: "tool", tool: "chat" };
    case "keyword.act":
      return { kind: "tool", tool: "chat" }; // 입력칸 빛남 — 시각은 이 함수가 아니라 화면이 3초 잠금으로 정한다(P23-6)
    case "nomination.act": {
      // 순차 지목(P22-17): 내 차례(공개 값 day.turn — 차례 중이고 order[i] 가 나)에만 빛난다. 차례 전·후·확정 직후는 거짓 신호라 null
      const turn = view.day?.turn;
      const myTurn = turn !== undefined && turn.i >= 0 && turn.i < turn.order.length && turn.doneAt === undefined && turn.order[turn.i] === view.me.seat;
      if (!myTurn) return null;
      const seats = aliveSeats(view, false);
      return seats.length === 0 ? null : { kind: "tag", seats };
    }
    case "defense.act":
      return { kind: "tool", tool: "will" };
    case "verdict.act":
      return { kind: "tool", tool: "verdict" };
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
 * 낮 시작 → 토론은 낮 시작에서 이미 울렸으므로 울리지 않는다(알림음은 한 번).
 */
export function hostChimeOf(prev: PhaseId | null, cur: PhaseId, fresh: boolean): boolean {
  if (prev === null || fresh || prev === cur) return false;
  if (prev === "dayAnnounce" && cur === "discussion") return false;
  return true;
}
