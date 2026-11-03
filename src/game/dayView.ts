// 낮 처형 화면 연출 순수 모듈 — DAY-04·05·06, 결정 0049·0053·0060, 08-UI-SPEC.
// 순수: 시각·난수·DOM 을 읽지 않는다. 입력은 서버가 모두에게 보내는 공개 정보(day.points·players·phase·day.verdict·
// day.noExecution·day.voteLog)뿐이고, 연출 이벤트(채팅 줄·위 알림·결과 알림)는 서버 view 두 개의 차이에서만 만든다.
// 서버 응답 전에 남의 표·배지·선두를 미리 만들지 않는다. me.verdictVote·me.endDiscussion·spectate 는 읽지 않는다(T-08-22).
// 문구에 역할 단어를 쓰지 않는다 — 처형 알림·줄 어디에도 역할이 없다(결정 0053-2).
// 형식은 src/net/roomDiff.ts 선례: 이전 view 가 없으면(첫 스냅샷·재접속) 이벤트 없이 정상 상태만 준다.
import { isAlive } from "../../shared/game/alive";
import { majorityOf } from "../../shared/game/nomination";
import { EXECUTION_MS } from "../../shared/game/phases";
import type { ChatChannel, PhaseId, RoomView } from "../../shared/protocol";
import type { V2IconName } from "../components/v2/V2Icon";

/** 문구 표. UI-SPEC "Copywriting Contract" 원문 — 해요체, 마침표·느낌표 없음. 역할 단어는 토론 안내의 '마피아'(모두에게 같은 문장) 하나뿐이다. */
export const DAY_COPY = {
  // ---- 채팅 시스템 줄 ----
  /** 지목 한 줄 '민준 → 도윤', 바꾸면 '(바꿈)' */
  pointLine: (from: string, to: string, changed: boolean): string => `${from} → ${to}${changed ? " (바꿈)" : ""}`,
  leadLine: (name: string): string => `${name} 님이 앞서요`,
  majorityLine: (name: string): string => `${name} 님 과반`,
  dayLine: (n: number): string => `${n}일차`,
  nominationStart: "지목 시작",
  defenseLine: (name: string, votes: number): string => `${name} 님 ${votes}표 · 최후 변론`,
  verdictStart: "찬반 시작",
  tallyText: (yes: number, no: number): string => `찬성 ${yes} · 반대 ${no}`,
  executedText: (name: string): string => `${name} 님 처형`,
  noExecution: "처형 없음",
  // ---- 결과 알림(36px) ----
  announceDay: "낮이 되었습니다",
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

/** 위 알림 재료 한 건: from 이 to 를 가리켰다. 이름은 만든 순간의 닉네임이다. */
export interface PointToast {
  to: number;
  from: number[];
  toName: string;
  fromNames: string[];
  /** 대상을 바꾼 지목(단독 알림에만 '(바꿈)' 이 붙는다) */
  changed?: boolean;
}

/** 결과 알림(36px) 한 건 — 한 번에 하나, 새 알림이 이전 것을 바꾼다. at·ms 는 단계 진입 기준 ms. */
export interface DayAnnounce {
  text: string;
  at: number;
  ms: number;
}

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

export interface DayEvents {
  lines: DayLine[];
  toasts: PointToast[];
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
      // 지목 동률·0표로 처형 없이 온 밤만. 찬반 뒤의 밤은 처형 단계가 이미 알렸다.
      const reason = day.noExecution?.reason;
      if (prev.phase !== "nomination" || (reason !== "tie" && reason !== "noVotes")) return;
      out.lines.push({ kind: "system", text: DAY_COPY.noExecution });
      out.announces.push({ text: DAY_COPY.noExecution, at: 0, ms: ANNOUNCE_NOEXEC_MS });
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
  const events: DayEvents = { lines: [], toasts: [], announces: [], fx: [], state };
  if (!prev || opts.reset || !cur.day) return events;

  // ---- 단계 진입: 줄·결과 알림·연출 ----
  if (prev.phase !== cur.phase) phaseEntry(prev, cur, cur.day, events);

  // ---- 지목 차이: 새 지목·바꿈은 vote 줄과 위 알림 재료, 선두·과반이 새로 생기면 hot 줄 ----
  const before = new Map(pointsOf(prev).map((l) => [l.seat, l.target]));
  const after = [...pointsOf(cur)].sort((a, b) => a.seat - b.seat);
  for (const line of after) {
    const old = before.get(line.seat);
    if (old === line.target) continue;
    const from = nameOf(cur, line.seat);
    const to = nameOf(cur, line.target);
    if (from === undefined || to === undefined) continue;
    const changed = old !== undefined;
    events.lines.push({ kind: "vote", text: DAY_COPY.pointLine(from, to, changed) });
    events.toasts.push({
      to: line.target,
      from: [line.seat],
      toName: to,
      fromNames: [from],
      ...(changed ? { changed: true } : {}),
    });
  }
  const was = pointsTally(prev);
  if (state.leader !== undefined && state.leader !== was.leader) {
    const name = nameOf(cur, state.leader);
    if (name !== undefined) events.lines.push({ kind: "hot", text: DAY_COPY.leadLine(name) });
  }
  if (state.sure !== undefined && state.sure !== was.sure) {
    const name = nameOf(cur, state.sure);
    if (name !== undefined) events.lines.push({ kind: "hot", text: DAY_COPY.majorityLine(name) });
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
    case "nomination":
      return { title, hint: DAY_COPY.nominationHint };
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

// ---- 위 알림 줄 세우기 (UI Considerations E2 #9, 남은 위험 7: 시작값 — 9페이즈 팀 테스트에서 확인) ----
/** 같은 대상을 가리킨 표를 한 알림으로 합치는 창. 알림은 이 창이 닫힌 뒤에 나온다. */
export const TOAST_MERGE_MS = 400;
export const TOAST_MS = 1500;
/** 대기가 2건 이상일 때 건당 시간 */
export const TOAST_FAST_MS = 800;
/** 대기 상한. 넘친 알림은 토스트에서만 건너뛴다(채팅 기록에는 모두 남는다) */
export const TOAST_QUEUE_MAX = 4;
/** 합친 알림에 쓰는 이름 수. 넘으면 '…' */
export const TOAST_NAMES_MAX = 3;

export interface ToastShow {
  text: string;
  icon: "point";
  durationMs: number;
}

interface Pending {
  toast: PointToast;
  /** 이 알림이 만들어진 시각(합치기 창의 시작) */
  since: number;
}

/**
 * 위 알림 대기열. 시계는 메서드 인자 now 로만 받는다(가짜 시계 없이 결정적).
 * - push: 창 안(< 400ms)의 같은 대상 알림이 대기 중이면 이름을 합치고, 아니면 줄 끝에 선다. 대기가 가득이면 건너뛴다.
 * - next: 보이는 알림이 끝났고 맨 앞 알림의 창이 닫혔으면 하나를 꺼낸다. 대기(꺼내는 것 포함)가 2건 이상이면 0.8초, 1건이면 1.5초.
 */
export class ToastQueue {
  private queue: Pending[] = [];
  private busyUntil = 0;
  private lost = 0;

  push(t: PointToast, now: number): void {
    const open = this.queue.find((p) => p.toast.to === t.to && now - p.since < TOAST_MERGE_MS);
    if (open) {
      for (let i = 0; i < t.from.length; i += 1) {
        if (open.toast.from.includes(t.from[i]!)) continue;
        open.toast.from.push(t.from[i]!);
        open.toast.fromNames.push(t.fromNames[i]!);
      }
      return;
    }
    if (this.queue.length >= TOAST_QUEUE_MAX) {
      this.lost += 1;
      return;
    }
    // 호출한 쪽의 객체를 합치기로 바꾸지 않도록 복사해 둔다.
    this.queue.push({ toast: { ...t, from: [...t.from], fromNames: [...t.fromNames] }, since: now });
  }

  next(now: number): ToastShow | null {
    if (now < this.busyUntil) return null;
    const head = this.queue[0];
    if (!head || now - head.since < TOAST_MERGE_MS) return null;
    const durationMs = this.queue.length >= 2 ? TOAST_FAST_MS : TOAST_MS;
    this.queue.shift();
    this.busyUntil = now + durationMs;
    const names = head.toast.fromNames;
    const shown = names.slice(0, TOAST_NAMES_MAX).join("·") + (names.length > TOAST_NAMES_MAX ? "…" : "");
    const changed = head.toast.changed === true && names.length === 1;
    return { text: DAY_COPY.pointLine(shown, head.toast.toName, changed), icon: "point", durationMs };
  }

  /** 대기가 가득 차서 토스트에서 건너뛴 알림 수(누적) */
  dropped(): number {
    return this.lost;
  }
}
