// 낮 처형 화면 연출 순수 모듈 — DAY-04·05·06, 결정 0049·0053·0060, 08-UI-SPEC.
// 순수: 시각·난수·DOM 을 읽지 않는다. 입력은 서버가 모두에게 보내는 공개 정보(day.points·players·phase·day.execution·
// day.noExecution)뿐이고, 연출 이벤트(채팅 줄·위 알림·결과 알림)는 서버 view 두 개의 차이에서만 만든다.
// 09.1(결정 0063-1): 지목은 순차라 위 알림 대기열·선두·과반 줄은 없다 — 득표는 배지 숫자, 진행은 차례 알약·위 한 줄(pickTurn.ts)이 말한다.
// 22-09 이후 지목은 순차뿐이다(동시 투표는 지웠다). 아래 집계(선두 등)는 공개 지목 줄(day.points)에서 만든 값이고, 위 알림은 대기열 없이 새 표가 이전 것을 바꾼다(U-5).
// 서버 응답 전에 남의 표·배지·선두를 미리 만들지 않는다. me.verdictVote·me.endDiscussion·spectate 는 읽지 않는다(T-08-22).
// 문구에 역할 단어를 쓰지 않는다 — 처형 알림·줄 어디에도 역할이 없다(결정 0053-2).
// 형식은 src/net/roomDiff.ts 선례: 이전 view 가 없으면(첫 스냅샷·재접속) 이벤트 없이 정상 상태만 준다.
import { isAlive } from "../../shared/game/alive";
import { majorityOf } from "../../shared/game/nomination";
import { ANSWER_REVEAL_MS, EXEC_ANNOUNCE_MS, EXECUTION_MS, NO_EXECUTION_MS, WILL_REVEAL_MS } from "../../shared/game/phases";
import type { ChatChannel, PhaseId, RoomView } from "../../shared/protocol";
import type { V2IconName } from "../components/v2/V2Icon";
import { MORNING_TEXT, morningText } from "./eliminationText";
import { isMyTurn, TURN_COPY, turnStageOf } from "./pickTurn";
import { isMySpeakTurn, pointSeatsOf, SHOWDOWN_COPY, showdownStageOf } from "./showdownView";

/** 문구 표. UI-SPEC "Copywriting Contract" 원문 — 해요체, 마침표·느낌표 없음. 역할 단어는 토론 안내의 '마피아'(모두에게 같은 문장) 하나뿐이다. */
export const DAY_COPY = {
  // ---- 채팅 시스템 줄 ----
  dayLine: (n: number): string => `${n}일차`,
  /** 결선(09.1.1-14) 시작 채팅 시스템 줄 */
  runoffStart: "결선 시작",
  executedText: (name: string): string => `${name} 님 처형`,
  noExecution: "처형 없음",
  /** 유언 공개 카드(22-12 P22-12): 처형자가 유언을 남기지 않았을 때 같은 카드·같은 3.0초에 쓰는 한 줄 */
  willEmpty: "말없이 떠났어요",
  /** 첫날 정답 공개 큰 글의 위 줄(23-07, P23-20) — 아래 줄이 키워드다 */
  answerLabel: "제시어",
  // ---- 결과 알림(36px) ----
  // 14페이즈 U-5: 아래 두 문구는 결과 알림(36px)으로 쓰지 않는다(자막 띠가 같은 말을 한다). 상수는 지우지 않는다.
  announceDay: "낮이 되었습니다",
  /** 14페이즈 U-5: 결과 알림으로 쓰지 않는다(띠가 말한다). 모든 역할에게 같은 문구라는 기록으로만 남긴다 */
  announceNight: "밤이 되었습니다",
  // ---- 단계 제목 ----
  titles: {
    keyword: "라이어 게임", // 첫날 키워드 카드(23-01, P23-2) — PreGame 틀이라 시간대 낱말이 없다
    dayAnnounce: "토론", // 앞의 "낮" 은 헤더 시간대 낱말이 말한다(결정 0083-1)
    discussion: "토론",
    nomination: "지목",
    runoff: "결선",
    showdown: SHOWDOWN_COPY.title,
    defense: "유언", // 결정 0089-19(D-15): defense id 는 처형자의 10초 유언 단계 — 변론은 없다(P22-1)
    verdict: "찬반",
    execution: "처형",
    answerReveal: "제시어", // 첫날 제시어 공개(23-07, P23-2): 앞의 "저녁" 은 헤더 시간대 낱말이 말한다
    night: "밤",
    morning: "아침",
  } as Partial<Record<PhaseId, string>>,
  // ---- 단계 안내 한 줄 ----
  discussionHint: "이야기하며 마피아를 찾아요",
  /** 밤 산 마피아 헤더 안내(UI-SPEC 단계표 202행). 이 문자열은 마피아 분기 안에서만 만든다 — 다른 신분 DOM 에 없다(T-09-29) */
  nightHintMafia: "대상에게 다가가요",
  /** 밤 산 시민·경찰·의사 헤더 안내(UI-SPEC 단계표 203~205행). 각 문자열은 그 역할 분기 안에서만 만든다 — 다른 신분 DOM 에 없다(T-09-33) */
  nightHintCitizen: "날이 밝길 기다려요",
  nightHintPolice: "조사할 사람을 골라요",
  nightHintDoctor: "지킬 사람을 골라요",
  /** 마피아 전원 일치 확정이 새로 섰을 때 마피아 채팅의 hot 줄(UI-SPEC 330행) */
  sureLine: (name: string): string => `${name} · 확정`,
  ghostHint: "모두의 직업이 보여요",
  ghostNightHint: "모두의 직업과 밤 행동이 보여요",
} as const;

// ---- 결과 알림 시간표 (결정 0060-5, UI-SPEC 남은 위험 8, 22-12 P22-13) ----
// 처형 단계 6.6초 한 표(phases.ts): 0~3.0초 유언 카드(알림·줄 없음 — willCardOf), 3.0~6.0초 "{이름} 님 처형" 큰 글과 유령, 6.0~6.6초 꼬리(핀·콘 끔).
// 표시 시간이며 서버 단계를 넘기지 않는다: WILL_REVEAL_MS + ANNOUNCE_EXEC_MS + 꼬리 ≤ EXECUTION_MS. 알림이 단계 경계에서 잘리면 다음 단계 알림이 그것을 바꾼다(한 번에 하나).
// 찬반 득표 알림("찬성 n · 반대 m")은 없다(D-14) — 부결은 처형 단계가 없어 night 진입 알림 '처형 없음' 한 가지다(P22-4).
/** 처형 큰 글 "{이름} 님 처형"이 선 채 머무는 시간 — 유언 카드(WILL_REVEAL_MS) 뒤 3.0초 */
export const ANNOUNCE_EXEC_MS = EXEC_ANNOUNCE_MS;
/** 찬반 부결·지목 동률/0표: "처형 없음" 1.4초. 서버 상수와 한 값이다(23-07 D-22) — 첫날은 answerReveal 단계가 이 시간 만큼 길어진다(phaseDurationOf) */
export const ANNOUNCE_NOEXEC_MS = NO_EXECUTION_MS;
/** 낮 시작 단계(DAY_ANNOUNCE_MS) 2초. 14 U-5 로 36px 알림은 없어졌고 상수만 남는다 */
export const ANNOUNCE_DAY_MS = 2000;
/** 처형된 사람이 반투명으로 떠오르는 시간 → 2.4초까지 사라진다(알림 시작 기준) */
export const GHOST_RISE_MS = 1400;
export const GHOST_FADE_END_MS = 2400;
// 09-18: 아침 알림(UI-SPEC 아침 시간표, 시작값). 아침 진입 시각 0 기준.
/** 아침 36px 알림 시작(막이 걷히는 0.4초 뒤)과 길이 */
export const ANNOUNCE_MORNING_AT = 400;
export const ANNOUNCE_MORNING_MS = 2400;
/** 밤 진입 알림 길이. 14 U-5 로 36px 알림은 없어졌고 상수만 남는다 */
export const ANNOUNCE_NIGHT_MS = 1600;
/** 피해자 본인 화면: 0.7초에 "암살당했습니다" 2초(다른 문장 대신) */
export const ANNOUNCE_VICTIM_AT = 700;
export const ANNOUNCE_VICTIM_MS = 2000;
/** 경찰 화면 순서(그 사람 화면 안의 일, 서버 길이·메시지는 같다): 결과 카드 2.4초, 36px 알림 2.6초에 시작해 2.2초 */
export const POLICE_CARD_AT = 2400;
export const ANNOUNCE_POLICE_AT = 2600;
export const ANNOUNCE_POLICE_MS = 2200;

/** 채팅 시스템 줄 한 건. at 은 단계 진입 기준 ms(없으면 즉시) — 지연은 화면이 시계로 실행한다. */
export interface DayLine {
  kind: "system" | "vote" | "hot";
  text: string;
  at?: number;
  /** 이 줄이 보이는 채팅 흐름. 없으면 all */
  scope?: ChatChannel;
  /** 줄 앞 아이콘. 없으면 종류별 기본 */
  icon?: V2IconName;
}

/** 결과 알림(36px) 한 건 — 한 번에 하나, 새 알림이 이전 것을 바꾼다. at·ms 는 단계 진입 기준 ms. */
export interface DayAnnounce {
  text: string;
  /** 글자 위 한 줄 라벨(정답 공개 "정답"). 없으면 글자만 */
  label?: string;
  /** 알림 앞 아이콘(56). 없으면 글자만 */
  icon?: AnnounceIcon;
  at: number;
  ms: number;
}

/** 결과 알림 앞 아이콘 이름: target(피해자 있음, 진홍), heal(누군가 살아남), ghost(피해자 본인) */
export type AnnounceIcon = "target" | "heal" | "ghost";

/** 일회성 연출. ghostRise = 처형된 사람이 반투명으로 떠오르며 사라진다(서버가 유령 위치를 보내는 것이 아니다). */
export interface DayFx {
  kind: "ghostRise";
  seat: number;
  at: number;
}

export interface PointsTally {
  /** 대상 seat → 받은 표 수(0표는 키 없음) */
  counts: Record<number, number>;
  /** 최다 득표가 정확히 한 명일 때만 */
  leader?: number;
  /** 산 사람 수의 과반 수 */
  majority: number;
}

/** 이 화면에만 남는 채팅 카드(경찰 조사 결과). 서버 채널 기록이 아니다. at 은 단계 진입 기준 ms */
export interface LocalCard {
  at: number;
  title: string;
  text: string;
}

export interface DayEvents {
  lines: DayLine[];
  /** 경찰 화면에서만 생긴다(L8). 없으면 키 자체가 없다 */
  localCards?: LocalCard[];
  announces: DayAnnounce[];
  fx: DayFx[];
}

/** 지목 줄은 지목 단계에서만 의미가 있다 — 다른 단계 view 의 points 는 읽지 않는다. */
function pointsOf(view: RoomView | null): { seat: number; target: number }[] {
  if (!view || view.phase !== "nomination") return [];
  return view.day?.points ?? [];
}

/** 지금 투표 집계(공개 정보). 선두는 최다 득표가 정확히 한 명일 때만이고 동점이면 없다. */
export function pointsTally(view: RoomView): PointsTally {
  const counts: Record<number, number> = {};
  for (const line of pointsOf(view)) counts[line.target] = (counts[line.target] ?? 0) + 1;
  const top = Math.max(0, ...Object.values(counts));
  const tops = Object.keys(counts)
    .map(Number)
    .filter((seat) => counts[seat] === top && top > 0);
  const majority = majorityOf(view.players.filter(isAlive).length);
  const leader = tops.length === 1 ? tops[0]! : undefined;
  return {
    counts,
    majority,
    ...(leader !== undefined ? { leader } : {}),
  };
}

const nameOf = (view: RoomView, seat: number): string | undefined => view.players.find((p) => p.seat === seat)?.nickname;

/** 처형 단계 안에서 끝나도록 알림 길이를 자른다(at 은 처형 단계 진입 기준 ms). */
const fitExecution = (at: number, ms: number): number => Math.min(ms, EXECUTION_MS - at);

/**
 * 유언 공개 카드 계획(22-12 P22-11·P22-12): 처형 단계에서 처형자(day.execution)가 있으면 카드 글과 보이는 시간. 글은 처형자의 유언이고,
 * 비어 있으면(키 없음) "말없이 떠났어요" — 같은 카드·같은 3.0초라 길이로 구별되지 않는다. 처형 단계가 아니거나 처형자가 없으면 null.
 * 순수: view 의 공개 값(day.execution)만 읽는다 — 역할은 읽지 않는다.
 */
export function willCardOf(view: RoomView): { text: string; ms: number } | null {
  const execution = view.day?.execution;
  if (view.phase !== "execution" || execution === undefined) return null;
  const will = execution.will;
  return { text: will === undefined || will === "" ? DAY_COPY.willEmpty : will, ms: WILL_REVEAL_MS };
}

/** 경찰 결과 카드 본문. 경찰 분기(policeResultOf 가 null 이 아닐 때) 밖에서 쓰지 않는다 */
const POLICE_TEXT = { mafia: "마피아", clear: "마피아 아님" } as const;

/** 내가 같은 연결의 밤 view 에서는 산 사람이었고 아침 view 에서 탈락했는가(피해자 본인) */
function diedThisNight(prev: RoomView, cur: RoomView): boolean {
  const before = prev.players.find((p) => p.seat === prev.me.seat);
  const now = cur.players.find((p) => p.seat === cur.me.seat);
  return before !== undefined && isAlive(before) && now !== undefined && !isAlive(now);
}

/**
 * 경찰 조사 결과(가정 A1): 같은 연결에서 밤 → 아침으로 오며 내 me.records 에 그 밤 일차의 조사 줄이 새로 생겼으면 { seat, isMafia }.
 * 경찰이 그 밤에 당했어도 받는다(v1.0 동시 해결). 고르지 않았거나 경찰이 아니거나 첫 스냅샷이면 null.
 * 본인에게만 오는 me.records 에서만 읽는다 — 서버가 경찰이 아닌 사람에게는 이 줄을 보내지 않는다.
 */
export function policeResultOf(prev: RoomView | null, cur: RoomView): { seat: number; isMafia: boolean } | null {
  if (prev === null || prev.phase !== "night" || cur.phase !== "morning" || cur.me.role !== "police") return null;
  const n = cur.day?.n;
  if (n === undefined) return null;
  const isTonight = (r: NonNullable<RoomView["me"]["records"]>[number]): r is typeof r & { isMafia: boolean } => "isMafia" in r && r.n === n;
  if ((prev.me.records ?? []).some(isTonight)) return null;
  const line = (cur.me.records ?? []).find(isTonight);
  return line === undefined ? null : { seat: line.target, isMafia: line.isMafia };
}

/** 처형 없음 판정이 나는 낮 단계(찬반·지목·결선·마지막 3인)에서 막 나왔는가 — 밤·정답 공개 진입 알림의 공통 조건 */
const isDayBefore = (prev: RoomView): boolean => prev.phase === "verdict" || prev.phase === "nomination" || prev.phase === "runoff" || prev.phase === "showdown";
/** day.noExecution 의 이유 셋(찬반 부결·지목 동점·0표)은 큰 글 '처형 없음' 한 가지(P22-4) */
const isNoExecution = (day: NonNullable<RoomView["day"]>): boolean => {
  const reason = day.noExecution?.reason;
  return reason === "tie" || reason === "noVotes" || reason === "rejected";
};

/**
 * 재접속·새로고침으로 answerReveal 중간에 들어온 첫 화면(23-07, UI-SPEC partial 재접속): 정답 큰 글을 남은 시간만 모션 없이 보인다.
 * 남은 시간은 서버 시계끼리의 차(phaseEndsAt - serverNow)라 기기 시계와 무관하고, 정답 길이(3초)를 넘지 않는다 — 처형 없는 첫날의 앞 1.4초(처형 없음)는 되살리지 않는다.
 * 단계가 아니거나 정답·마감이 없거나 이미 끝났으면 null. 순수: 시각을 읽지 않는다.
 */
export function answerStillOf(view: RoomView): { text: string; label: string; ms: number } | null {
  const answer = view.day?.keyword?.answer;
  if (view.phase !== "answerReveal" || answer === undefined || view.phaseEndsAt === null) return null;
  const ms = Math.min(ANSWER_REVEAL_MS, view.phaseEndsAt - view.serverNow);
  return ms > 0 ? { text: answer, label: DAY_COPY.answerLabel, ms } : null;
}

/** 단계에 들어온 순간의 줄·알림·연출. 지연 이벤트는 at(단계 진입 기준 ms)으로 표시해 화면이 시계로 실행한다. */
function phaseEntry(prev: RoomView, cur: RoomView, day: NonNullable<RoomView["day"]>, out: DayEvents): void {
  switch (cur.phase) {
    case "dayAnnounce":
      // U-5: "낮이 되었습니다" 36px 알림은 없다(띠가 말한다). 채팅 줄 "{N}일차" 는 그대로
      out.lines.push({ kind: "system", text: DAY_COPY.dayLine(day.n) });
      return;
    case "runoff":
      out.lines.push({ kind: "system", text: DAY_COPY.runoffStart });
      return;
    case "showdown":
      out.lines.push({ kind: "system", text: SHOWDOWN_COPY.chatLine });
      return;
    case "defense":
      // 유언 단계(22-11 D-14·D-23): 득표 줄·알림이 없다 — 지목·찬반 기록을 남기지 않는다. 장면(처형자 스포트라이트)과 띠가 말한다
      return;
    case "execution": {
      // 처형자(day.execution)가 있을 때만(22-12 P22-14). 0~3.0초는 유언 카드(willCardOf, 화면이 시계로 그린다)라 알림·줄이 없고, 3.0초에 큰 글·줄·유령이 선다.
      const seat = day.execution?.seat;
      if (seat === undefined) return;
      const name = nameOf(cur, seat);
      if (name === undefined) return;
      const text = DAY_COPY.executedText(name);
      out.lines.push({ kind: "hot", text, at: WILL_REVEAL_MS });
      out.announces.push({ text, at: WILL_REVEAL_MS, ms: fitExecution(WILL_REVEAL_MS, ANNOUNCE_EXEC_MS) });
      out.fx.push({ kind: "ghostRise", seat, at: WILL_REVEAL_MS });
      return;
    }
    case "answerReveal": {
      // 첫날 정답 공개(23-07, D-22·P23-20): 처형이 있었으면 처형 단계가 이미 알렸으므로 정답 큰 글만 0초부터 3초. 처형 없는 첫날(부결·동점·0표)은
      // 단계가 4.4초로 길어져(서버 phaseDurationOf) "처형 없음" 0~1.4초 다음 1.4초부터 정답 3초 — 두 큰 글이 겹치지 않는다. 역할 분기 없음(T-23-27).
      // 글자는 서버가 answerReveal 진입 프레임부터 싣는 day.keyword.answer 하나뿐이다(T-23-25) — 없으면 알림도 없다.
      const answer = day.keyword?.answer;
      if (answer === undefined) return;
      let at = 0;
      if (isDayBefore(prev) && isNoExecution(day)) {
        out.lines.push({ kind: "system", text: DAY_COPY.noExecution });
        out.announces.push({ text: DAY_COPY.noExecution, at: 0, ms: ANNOUNCE_NOEXEC_MS });
        at = ANNOUNCE_NOEXEC_MS;
      }
      out.announces.push({ text: answer, label: DAY_COPY.answerLabel, at, ms: ANSWER_REVEAL_MS });
      return;
    }
    case "night": {
      // 지목 동률·0표로 처형 없이 온 밤은 "처형 없음"(0~1.4초) 알림만 남는다. 찬반 뒤의 밤은 처형 단계가 이미 알렸다.
      // 마지막 3인(showdown)의 1-1-1·무표도 같다: 처형 단계 없이 밤으로 와서 이 알림이 처형 없음을 알린다(09.1.1-16, UI-SPEC E-1).
      // U-5: "밤이 되었습니다" 36px 알림은 이어지지 않는다(띠가 말한다).
      // 22-10(P22-4): 찬반 부결(rejected)·지목 동점(tie)·0표(noVotes)는 같은 큰 글 '처형 없음' 1.4초 한 가지 — 이유를 구별해 보이지 않는다.
      // 첫날 정답 공개 뒤의 밤(prev.phase === "answerReveal")은 이 목록에 없어 알림이 다시 나오지 않는다(23-07 D-22, day.noExecution 이 밤 view 에 남아 있어도).
      if (isDayBefore(prev) && isNoExecution(day)) {
        out.lines.push({ kind: "system", text: DAY_COPY.noExecution });
        out.announces.push({ text: DAY_COPY.noExecution, at: 0, ms: ANNOUNCE_NOEXEC_MS });
      }
      return;
    }
    case "morning": {
      // 밤 → 아침으로 들어올 때만. 공개 정보(day.morning·players)와 본인 기록(me.records)만 읽는다 — 누가 살아났는지는 view 에 없다(결정 0044-22)
      if (prev.phase !== "night") return;
      const m = morningText(day.morning, (seat) => nameOf(cur, seat));
      const police = policeResultOf(prev, cur);
      const victim = diedThisNight(prev, cur);
      // 36px 알림은 한 번에 하나: 피해자 본인 문장(0.7초)이 먼저, 경찰은 결과 카드 뒤 2.6초, 나머지는 0.4초(가정 A2)
      let announce: DayAnnounce = { text: m.text, ...(m.icon !== undefined ? { icon: m.icon } : {}), at: ANNOUNCE_MORNING_AT, ms: ANNOUNCE_MORNING_MS };
      let lineAt = ANNOUNCE_MORNING_AT;
      if (victim) {
        // 경찰 본인에게 두 사건이 겹치면 비공개 조사 결과 뒤 피해 발표와 편지를 이어서 본다.
        announce = { text: MORNING_TEXT.victim, icon: "ghost", at: police === null ? ANNOUNCE_VICTIM_AT : ANNOUNCE_POLICE_AT, ms: ANNOUNCE_VICTIM_MS };
      } else if (police !== null) {
        announce = { ...announce, at: ANNOUNCE_POLICE_AT, ms: ANNOUNCE_POLICE_MS };
        lineAt = ANNOUNCE_POLICE_AT;
      }
      out.announces.push(announce);
      out.lines.push({ kind: "hot", text: m.text, at: lineAt });
      if (police !== null) {
        // 결과 문구는 이 경찰 분기 안에서만 만든다(L8, T-09-40) — 다른 신분 화면의 DOM 에 없다
        const target = nameOf(cur, police.seat);
        if (target !== undefined) out.localCards = [{ at: POLICE_CARD_AT, title: target, text: police.isMafia ? POLICE_TEXT.mafia : POLICE_TEXT.clear }];
      }
      return;
    }
    default:
      return;
  }
}

/**
 * 연속한 서버 view 두 개의 공개 정보 차이에서 연출 이벤트를 만든다.
 * prev 가 null 이거나 opts.reset(epoch 가 바뀐 첫 스냅샷)이면 이벤트 없이 빈 묶음만 준다.
 */
export function dayEvents(prev: RoomView | null, cur: RoomView, opts: { reset?: boolean } = {}): DayEvents {
  const events: DayEvents = { lines: [], announces: [], fx: [] };
  if (!prev || opts.reset || !cur.day) return events;

  // ---- 단계 진입: 줄·결과 알림·연출 ----
  if (prev.phase !== cur.phase) phaseEntry(prev, cur, cur.day, events);

  // 지목 줄·기권 줄·단계 시작 줄은 채팅에 쌓이지 않는다(22-10, UI-SPEC C '끝': 누가 누구를 골랐는지 흔적이 남지 않는다) — 차례 위 한 줄·핀·손가락이 그 순간만 보인다.

  // ---- 밤 마피아 확정: 서버가 산 마피아에게만 보낸 me.nightSure 가 새로 서거나 바뀌면 마피아 채널에 한 줄(깨질 때는 줄 없음). 마피아가 아닌 view 는 읽지 않는다 ----
  if (cur.me.role === "mafia" && cur.phase === "night" && cur.me.nightSure !== undefined && cur.me.nightSure !== prev.me.nightSure) {
    const name = nameOf(cur, cur.me.nightSure);
    if (name !== undefined) events.lines.push({ kind: "hot", text: DAY_COPY.sureLine(name), scope: "mafia", icon: "target" });
  }
  return events;
}

/**
 * 단계 머리(제목 24px + 안내 한 줄): UI-SPEC 단계표 그대로. 안내는 단계 시작 뒤 약 2.5초만 보이고 접히는 것은 화면 몫이다.
 * 지목(09.1)은 순차라 모이는 중 '모이는 중', 내 차례 '의심되는 사람을 눌러요', 남의 차례·끝 알림은 제목만.
 * 유령(내 alive 가 false)은 같은 제목에 '모두의 직업이 보여요'(밤은 '모두의 직업과 밤 행동이 보여요').
 * 밤은 산 사람마다 역할별 한 줄(마피아 '대상에게 다가가요', 경찰 '조사할 사람을 골라요', 의사 '지킬 사람을 골라요', 시민 '날이 밝길 기다려요'). 아침은 제목만. 낮 틀이 아닌 단계는 빈 제목.
 */
export function headerFor(view: RoomView): { title: string; hint?: string } {
  const title = DAY_COPY.titles[view.phase];
  if (title === undefined) return { title: "" };
  const me = view.players.find((p) => p.seat === view.me.seat);
  if (me !== undefined && !isAlive(me)) {
    return { title, hint: view.phase === "night" ? DAY_COPY.ghostNightHint : DAY_COPY.ghostHint };
  }
  switch (view.phase) {
    case "discussion":
      return { title, hint: DAY_COPY.discussionHint };
    case "nomination":
      // 22-10(P22-1, D-23): 제목만 — 안내는 띠('차례대로 한 명을 골라요')가 말해 같은 글을 두 번 쓰지 않는다
      return { title };
    case "runoff": {
      // 결선(09.1.1-14): 후보 본인 '결과를 기다려요', 후보 아닌 산 사람은 투표 중에만 '둘 중 한 명을 눌러요', 앞머리·결과는 제목만
      const runoff = view.day?.runoff;
      if (runoff === undefined) return { title };
      if (runoff.cand.includes(view.me.seat)) return { title, hint: TURN_COPY.runoffWait };
      return runoff.step === 1 ? { title, hint: TURN_COPY.runoffPick } : { title };
    }
    case "showdown": {
      // 마지막 3인(09.1.1-15): 내 한마디 차례 '한마디를 골라요', 동시 지목의 산 사람 '의심되는 사람을 눌러요', 그 밖은 제목만
      const stage = showdownStageOf(view);
      if (stage === "speak" && isMySpeakTurn(view)) return { title, hint: SHOWDOWN_COPY.speakHint };
      if (stage === "point" && pointSeatsOf(view).length > 0) return { title, hint: SHOWDOWN_COPY.pointHint };
      return { title };
    }
    case "defense":
      // 유언 단계(22-11 D-23): 제목만 — 안내는 띠('마지막 한마디'·'마지막 한마디를 들어요')가 말한다
      return { title };
    case "verdict":
      // 후보가 없다(22-10, D-11): 제목만 — 안내는 띠('오늘 처형할까요?')가 말한다
      return { title };
    case "night":
      switch (view.me.role) {
        case "mafia":
          return { title, hint: DAY_COPY.nightHintMafia };
        case "police":
          return { title, hint: DAY_COPY.nightHintPolice };
        case "doctor":
          return { title, hint: DAY_COPY.nightHintDoctor };
        default:
          return { title, hint: DAY_COPY.nightHintCitizen };
      }
    default:
      return { title };
  }
}
