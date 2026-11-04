// 낮 처형 화면 연출 순수 모듈 — DAY-04·05·06, 결정 0049·0053·0060, 08-UI-SPEC.
// 순수: 시각·난수·DOM 을 읽지 않는다. 입력은 서버가 모두에게 보내는 공개 정보(day.points·players·phase·day.verdict·
// day.noExecution·day.voteLog)뿐이고, 연출 이벤트(채팅 줄·위 알림·결과 알림)는 서버 view 두 개의 차이에서만 만든다.
// 09.1(결정 0063-1): 지목은 순차라 위 알림 대기열·선두·과반 줄은 없다 — 득표는 배지 숫자, 진행은 차례 알약·위 한 줄(pickTurn.ts)이 말한다.
// 서버 응답 전에 남의 표·배지·선두를 미리 만들지 않는다. me.verdictVote·me.endDiscussion·spectate 는 읽지 않는다(T-08-22).
// 문구에 역할 단어를 쓰지 않는다 — 처형 알림·줄 어디에도 역할이 없다(결정 0053-2).
// 형식은 src/net/roomDiff.ts 선례: 이전 view 가 없으면(첫 스냅샷·재접속) 이벤트 없이 정상 상태만 준다.
import { isAlive } from "../../shared/game/alive";
import { majorityOf } from "../../shared/game/nomination";
import { EXECUTION_MS } from "../../shared/game/phases";
import type { ChatChannel, PhaseId, RoomView } from "../../shared/protocol";
import type { V2IconName } from "../components/v2/V2Icon";
import { MORNING_TEXT, morningText } from "./eliminationText";
import { isMyTurn, turnStageOf } from "./pickTurn";

/** 문구 표. UI-SPEC "Copywriting Contract" 원문 — 해요체, 마침표·느낌표 없음. 역할 단어는 토론 안내의 '마피아'(모두에게 같은 문장) 하나뿐이다. */
export const DAY_COPY = {
  // ---- 채팅 시스템 줄 ----
  /** 지목 한 줄 '민준 → 도윤' (순차 지목은 바꾸기가 없다) */
  pointLine: (from: string, to: string): string => `${from} → ${to}`,
  /** 시간 안에 못 골라 기권으로 확정된 차례 '민준 · 기권' */
  abstainLine: (name: string): string => `${name} · 기권`,
  dayLine: (n: number): string => `${n}일차`,
  nominationStart: "지목 시작",
  defenseLine: (name: string, votes: number): string => `${name} 님 ${votes}표 · 최후 변론`,
  verdictStart: "찬반 시작",
  tallyText: (yes: number, no: number): string => `찬성 ${yes} · 반대 ${no}`,
  executedText: (name: string): string => `${name} 님 처형`,
  noExecution: "처형 없음",
  // ---- 결과 알림(36px) ----
  announceDay: "낮이 되었습니다",
  /** 밤 진입 알림(UI-SPEC 218행). 모든 역할에게 같다 */
  announceNight: "밤이 되었습니다",
  // ---- 단계 제목 ----
  titles: {
    dayAnnounce: "낮 토론",
    discussion: "낮 토론",
    nomination: "지목",
    defense: "최후 변론",
    verdict: "찬반",
    execution: "처형",
    night: "밤",
    morning: "아침",
  } as Partial<Record<PhaseId, string>>,
  // ---- 단계 안내 한 줄 ----
  discussionHint: "이야기하며 마피아를 찾아요",
  nominationHint: "의심되는 사람을 눌러요",
  /** 지목 시작 때 모이는 동안의 헤더 안내 */
  nominationGatherHint: "모이는 중",
  defenseHint: (name: string): string => `${name} 님의 변론`,
  defenseHintSelf: "해명할 시간이에요",
  verdictHint: (name: string): string => `${name} 님을 처형할까요?`,
  verdictHintSelf: "결과를 기다려요",
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

// ---- 결과 알림 시간표 (결정 0060-5, UI-SPEC 남은 위험 8, 가정 A3) ----
// 표시 시간이며 서버 단계를 넘기지 않는다: ANNOUNCE_TALLY_MS + max(ANNOUNCE_EXEC_MS, ANNOUNCE_NOEXEC_MS) ≤ EXECUTION_MS(처형 5초).
// 알림이 단계 경계에서 잘리면 다음 단계 알림이 그것을 바꾼다(한 번에 하나).
/** 처형 단계 0~2.0초: "찬성 n · 반대 m" */
export const ANNOUNCE_TALLY_MS = 2000;
/** 통과: 2.0~5.0초 "{이름} 님 처형" */
export const ANNOUNCE_EXEC_MS = 3000;
/** 부결(2.0초부터)·지목 동률/0표(밤 시작): "처형 없음" 1.4초 */
export const ANNOUNCE_NOEXEC_MS = 1400;
/** 낮 시작 "낮이 되었습니다" — 낮 시작 단계(DAY_ANNOUNCE_MS) 2초 */
export const ANNOUNCE_DAY_MS = 2000;
/** 처형된 사람이 반투명으로 떠오르는 시간 → 2.4초까지 사라진다(알림 시작 기준) */
export const GHOST_RISE_MS = 1400;
export const GHOST_FADE_END_MS = 2400;
// 09-18: 아침 알림(UI-SPEC 아침 시간표, 시작값). 아침 진입 시각 0 기준.
/** 아침 36px 알림 시작(막이 걷히는 0.4초 뒤)과 길이 */
export const ANNOUNCE_MORNING_AT = 400;
export const ANNOUNCE_MORNING_MS = 2400;
/** 밤 진입 "밤이 되었습니다" 길이. 처형 없음으로 온 밤은 그 알림(ANNOUNCE_NOEXEC_MS) 뒤에 이어진다 */
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
  /** 선두의 표가 과반에 닿았을 때 그 사람 */
  sure?: number;
}

/** 정상 상태: 지목 집계 + 변론자 + (처형 단계에서 찬반이 통과했으면) 처형된 사람 */
export interface DayState extends PointsTally {
  candidate?: number;
  executed?: number;
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
  /** cur 에서 곧바로 그릴 정상 상태(득표·선두·과반·변론자·처형된 사람). 이벤트가 없어도 항상 있다 */
  state: DayState;
}

/** 지목 줄은 지목 단계에서만 의미가 있다 — 다른 단계 view 의 points 는 읽지 않는다. */
function pointsOf(view: RoomView | null): { seat: number; target: number }[] {
  if (!view || view.phase !== "nomination") return [];
  return view.day?.points ?? [];
}

/** 지금 지목 집계(공개 정보). 선두는 최다 득표가 정확히 한 명일 때만이고 동점이면 없다. */
export function pointsTally(view: RoomView): PointsTally {
  const counts: Record<number, number> = {};
  for (const line of pointsOf(view)) counts[line.target] = (counts[line.target] ?? 0) + 1;
  const top = Math.max(0, ...Object.values(counts));
  const tops = Object.keys(counts)
    .map(Number)
    .filter((seat) => counts[seat] === top && top > 0);
  const majority = majorityOf(view.players.filter(isAlive).length);
  const leader = tops.length === 1 ? tops[0]! : undefined;
  const sure = leader !== undefined && counts[leader]! >= majority ? leader : undefined;
  return {
    counts,
    majority,
    ...(leader !== undefined ? { leader } : {}),
    ...(sure !== undefined ? { sure } : {}),
  };
}

/**
 * 최후 변론에서 변론자 이름표에 유지하는 지목 득표 수(공개 기록). 그날 voteLog 줄의 cand.votes 에서 변론자를 가리킨 수이고,
 * 변론자가 없거나 줄이 없으면(재접속 직후 등) undefined — 화면은 배지를 그리지 않는다.
 */
export function defenderVotes(view: RoomView): number | undefined {
  const seat = view.day?.candidate;
  if (seat === undefined) return undefined;
  const entry = view.day?.voteLog?.find((e) => e.n === view.day?.n);
  if (!entry?.cand) return undefined;
  return entry.cand.votes.filter((v) => v.target === seat).length;
}

const nameOf = (view: RoomView, seat: number): string | undefined => view.players.find((p) => p.seat === seat)?.nickname;

/** 처형 단계 안에서 끝나도록 알림 길이를 자른다(at 은 처형 단계 진입 기준 ms). */
const fitExecution = (at: number, ms: number): number => Math.min(ms, EXECUTION_MS - at);

/** 정상 상태: 지목 집계 + 변론자 + 처형 단계에서 찬반이 통과했으면 처형된 사람(유령 상태). */
function stateOf(view: RoomView): DayState {
  const state: DayState = { ...pointsTally(view) };
  const day = view.day;
  if (day?.candidate !== undefined) state.candidate = day.candidate;
  if (view.phase === "execution" && day?.verdict?.passed) {
    const seat = day.execution?.seat ?? day.candidate;
    if (seat !== undefined) state.executed = seat;
  }
  return state;
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

/** 단계에 들어온 순간의 줄·알림·연출. 지연 이벤트는 at(단계 진입 기준 ms)으로 표시해 화면이 시계로 실행한다. */
function phaseEntry(prev: RoomView, cur: RoomView, day: NonNullable<RoomView["day"]>, out: DayEvents): void {
  switch (cur.phase) {
    case "dayAnnounce":
      out.lines.push({ kind: "system", text: DAY_COPY.dayLine(day.n) });
      out.announces.push({ text: DAY_COPY.announceDay, at: 0, ms: ANNOUNCE_DAY_MS });
      return;
    case "nomination":
      out.lines.push({ kind: "system", text: DAY_COPY.nominationStart });
      return;
    case "defense": {
      const seat = day.candidate;
      const name = seat === undefined ? undefined : nameOf(cur, seat);
      if (seat === undefined || name === undefined) return;
      // 가정 A2: 그날 voteLog 줄의 cand.votes 에서 변론자를 가리킨 수(공개 기록). 줄이 없으면 이전 지목 집계.
      const entry = day.voteLog?.find((e) => e.n === day.n);
      const votes = entry?.cand
        ? entry.cand.votes.filter((v) => v.target === seat).length
        : (pointsTally(prev).counts[seat] ?? 0);
      out.lines.push({ kind: "hot", text: DAY_COPY.defenseLine(name, votes) });
      return;
    }
    case "verdict":
      out.lines.push({ kind: "system", text: DAY_COPY.verdictStart });
      return;
    case "execution": {
      const verdict = day.verdict;
      if (!verdict) return;
      const tally = DAY_COPY.tallyText(verdict.yes, verdict.no);
      out.lines.push({ kind: "hot", text: tally });
      out.announces.push({ text: tally, at: 0, ms: fitExecution(0, ANNOUNCE_TALLY_MS) });
      if (verdict.passed) {
        const seat = day.execution?.seat ?? day.candidate;
        const name = seat === undefined ? undefined : nameOf(cur, seat);
        if (seat === undefined || name === undefined) return;
        const text = DAY_COPY.executedText(name);
        out.lines.push({ kind: "hot", text, at: ANNOUNCE_TALLY_MS });
        out.announces.push({ text, at: ANNOUNCE_TALLY_MS, ms: fitExecution(ANNOUNCE_TALLY_MS, ANNOUNCE_EXEC_MS) });
        out.fx.push({ kind: "ghostRise", seat, at: ANNOUNCE_TALLY_MS });
      } else {
        out.lines.push({ kind: "system", text: DAY_COPY.noExecution, at: ANNOUNCE_TALLY_MS });
        out.announces.push({
          text: DAY_COPY.noExecution,
          at: ANNOUNCE_TALLY_MS,
          ms: fitExecution(ANNOUNCE_TALLY_MS, ANNOUNCE_NOEXEC_MS),
        });
      }
      return;
    }
    case "night": {
      // 지목 동률·0표로 처형 없이 온 밤은 "처형 없음"(0~1.4초) 뒤에 "밤이 되었습니다"가 이어진다. 찬반 뒤의 밤은 처형 단계가 이미 알렸다.
      const reason = day.noExecution?.reason;
      let at = 0;
      if (prev.phase === "nomination" && (reason === "tie" || reason === "noVotes")) {
        out.lines.push({ kind: "system", text: DAY_COPY.noExecution });
        out.announces.push({ text: DAY_COPY.noExecution, at: 0, ms: ANNOUNCE_NOEXEC_MS });
        at = ANNOUNCE_NOEXEC_MS;
      }
      out.announces.push({ text: DAY_COPY.announceNight, at, ms: ANNOUNCE_NIGHT_MS });
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
        announce = { text: MORNING_TEXT.victim, icon: "ghost", at: ANNOUNCE_VICTIM_AT, ms: ANNOUNCE_VICTIM_MS };
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
 * prev 가 null 이거나 opts.reset(epoch 가 바뀐 첫 스냅샷)이면 이벤트 없이 정상 상태만 준다.
 */
export function dayEvents(prev: RoomView | null, cur: RoomView, opts: { reset?: boolean } = {}): DayEvents {
  const state = stateOf(cur);
  const events: DayEvents = { lines: [], announces: [], fx: [], state };
  if (!prev || opts.reset || !cur.day) return events;

  // ---- 단계 진입: 줄·결과 알림·연출 ----
  if (prev.phase !== cur.phase) phaseEntry(prev, cur, cur.day, events);

  // ---- 지목 차이: 새로 생긴 지목 줄마다 vote 줄, 지금 차례가 새로 기권이 되면 '{이름} · 기권' (선두·과반 줄은 없다, M-4) ----
  const before = new Map(pointsOf(prev).map((l) => [l.seat, l.target]));
  const after = [...pointsOf(cur)].sort((a, b) => a.seat - b.seat);
  for (const line of after) {
    if (before.get(line.seat) === line.target) continue;
    const from = nameOf(cur, line.seat);
    const to = nameOf(cur, line.target);
    if (from === undefined || to === undefined) continue;
    events.lines.push({ kind: "vote", text: DAY_COPY.pointLine(from, to) });
  }
  const turn = cur.phase === "nomination" ? cur.day.turn : undefined;
  if (turn !== undefined && turn.skip === true && turn.i >= 0 && turn.i < turn.order.length) {
    const was = prev.phase === "nomination" ? prev.day?.turn : undefined;
    if (was === undefined || was.i !== turn.i || was.skip !== true) {
      const name = nameOf(cur, turn.order[turn.i]!);
      if (name !== undefined) events.lines.push({ kind: "vote", text: DAY_COPY.abstainLine(name) });
    }
  }

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
  const candidate = view.day?.candidate;
  const defender = candidate === undefined ? undefined : nameOf(view, candidate);
  const isSelf = candidate !== undefined && candidate === view.me.seat;
  switch (view.phase) {
    case "discussion":
      return { title, hint: DAY_COPY.discussionHint };
    case "nomination": {
      // 09.1: 모이는 중 → '모이는 중', 내 차례 → '의심되는 사람을 눌러요', 남의 차례·끝 알림·day.turn 없음 → 제목만
      const stage = turnStageOf(view);
      if (stage === "gather") return { title, hint: DAY_COPY.nominationGatherHint };
      return isMyTurn(view) ? { title, hint: DAY_COPY.nominationHint } : { title };
    }
    case "defense":
      if (isSelf) return { title, hint: DAY_COPY.defenseHintSelf };
      return defender === undefined ? { title } : { title, hint: DAY_COPY.defenseHint(defender) };
    case "verdict":
      if (isSelf) return { title, hint: DAY_COPY.verdictHintSelf };
      return defender === undefined ? { title } : { title, hint: DAY_COPY.verdictHint(defender) };
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
