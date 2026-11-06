// 사회자 문구 표와 그 파생 판정(14페이즈, 결정 0073 예정 — HOST-01·03·05, UI-SPEC "사회자 문구 표").
// 자막 문장은 서버가 만들지 않는다. 클라이언트가 받은 자기 view 만으로 이 파일의 순수 함수가 한 줄을 만든다 — 서버·프로토콜 diff 0.
// 읽는 값은 허용 목록뿐이다: phase · phaseEndsAt · phaseDurationMs · minPlayers · me.seat · me.role · me.isHost ·
// players[].{seat, nickname, alive, connected} · day.candidate · day.verdict.passed · day.morning(morningText 가 읽는 하위 값) · local.cardSeen.
// players[].job · spectate · me.allies · me.records · me.pick · me.verdictVote · day.points · day.turn · day.voteLog · day.roles 등 그 밖은 읽지 않는다
// (유령 줄도 남의 직업을 말하지 않는다). 시각·난수·DOM·window 를 읽지 않는다.
import type { PhaseId, RoomView } from "../../shared/protocol";
import { isAlive } from "../../shared/game/alive";
import { TIMELESS_PHASES } from "./scenes";

/** 문구 표의 키 하나 = 한 줄. 15페이즈는 errand·witness·trace 행에 문구만 채운다(함수·띠 변경 없음). */
export type HostKey =
  | "lobby.ready" | "lobby.gather" | "lobby.guest"
  | "assigning"
  | "roleReveal.act" | "roleReveal.wait"
  | "dayAnnounce.wait" | "dayAnnounce.ghost"
  | "discussion.act" | "discussion.ghost"
  | "nomination.act" | "nomination.ghost"
  | "defense.act" | "defense.wait" | "defense.ghost"
  | "verdict.act" | "verdict.wait" | "verdict.ghost"
  | "execution.passed" | "execution.failed"
  | "night.mafia" | "night.police" | "night.doctor" | "night.wait" | "night.ghost"
  | "morning" | "ended"
  | "errand" | "witness" | "trace"
  | "fallback";

/** 키를 찾지 못했을 때의 한 줄 — 빈 띠는 없다(UI#1) */
export const HOST_FALLBACK = "잠시만 기다려 주세요.";

/** 클라이언트 상태: 역할 카드 앞면을 본 적이 있는가 */
export interface HostLocal {
  cardSeen?: boolean;
}

type Line = string | ((name: string) => string);

/** 문구 표(UI-SPEC 단일 출처). 앞 문장 = 무슨 일, 뒤 문장 = 내 할 일. 빈 문자열은 예약 행이다. */
export const HOST_LINES: Readonly<Record<HostKey, Line>> = {
  "lobby.ready": "",
  "lobby.gather": "",
  "lobby.guest": "",
  assigning: "",
  "roleReveal.act": "",
  "roleReveal.wait": "",
  "dayAnnounce.wait": "",
  "dayAnnounce.ghost": "",
  "discussion.act": "토론 시간입니다. 의심 가는 사람을 이야기해 주세요.",
  "discussion.ghost": "유령은 지켜보며 유령끼리 이야기할 수 있습니다.",
  "nomination.act": "",
  "nomination.ghost": "",
  "defense.act": "",
  "defense.wait": "",
  "defense.ghost": "",
  "verdict.act": "",
  "verdict.wait": "",
  "verdict.ghost": "",
  "execution.passed": "",
  "execution.failed": "",
  "night.mafia": "",
  "night.police": "",
  "night.doctor": "",
  "night.wait": "",
  "night.ghost": "",
  morning: "",
  ended: "",
  errand: "",
  witness: "",
  trace: "",
  fallback: HOST_FALLBACK,
};

/** 내가 탈락했는가: players 에서 내 좌석의 생존 값만 본다 */
function isGhost(view: RoomView): boolean {
  const mine = view.players.find((p) => p.seat === view.me.seat);
  return mine !== undefined && !isAlive(mine);
}

export function hostKeyOf(view: RoomView, _local: HostLocal = {}): HostKey {
  if (view.phase === "discussion") return isGhost(view) ? "discussion.ghost" : "discussion.act";
  return "fallback";
}

export function hostLineOf(view: RoomView, local: HostLocal = {}): string {
  const line = HOST_LINES[hostKeyOf(view, local)];
  if (typeof line === "function") return HOST_FALLBACK;
  return line === "" ? HOST_FALLBACK : line;
}

export type CallTool = "start" | "card" | "chat" | "will" | "verdict";
export type CallTarget = { kind: "tool"; tool: CallTool } | { kind: "tag"; seats: readonly number[] };

/** 빛남 대상 — 14-04 가 쓴다. Task 2 가 채운다. */
export function callTargetsOf(_view: RoomView, _local: HostLocal = {}): CallTarget | null {
  return null;
}

/** 막대·숫자 행을 그리는가: 시간이 있는 단계이고 마감·길이가 있고 3초 이상 */
export function hostTimeOf(view: RoomView): boolean {
  if (TIMELESS_PHASES.includes(view.phase)) return false;
  if (view.phaseEndsAt === null || view.phaseDurationMs === null) return false;
  return view.phaseDurationMs >= 3000;
}

/** 알림음을 낼 프레임인가 — 14-03 이 쓴다. Task 2 가 채운다. */
export function hostChimeOf(_prev: PhaseId | null, _cur: PhaseId, _fresh: boolean): boolean {
  return false;
}
