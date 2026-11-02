// 낮 처형 화면 연출 순수 모듈 — DAY-04·05·06, 결정 0049·0053·0060, 08-UI-SPEC.
// 순수: 시각·난수·DOM 을 읽지 않는다. 입력은 서버가 모두에게 보내는 공개 정보(day.points·players·phase·day.verdict·
// day.noExecution·day.voteLog)뿐이고, 연출 이벤트(채팅 줄·위 알림·결과 알림)는 서버 view 두 개의 차이에서만 만든다.
// 서버 응답 전에 남의 표·배지·선두를 미리 만들지 않는다. me.verdictVote·me.endDiscussion·spectate 는 읽지 않는다(T-08-22).
// 문구에 역할 단어를 쓰지 않는다 — 처형 알림·줄 어디에도 역할이 없다(결정 0053-2).
// 형식은 src/net/roomDiff.ts 선례: 이전 view 가 없으면(첫 스냅샷·재접속) 이벤트 없이 정상 상태만 준다.
import { isAlive } from "../../shared/game/alive";
import { majorityOf } from "../../shared/game/nomination";
import type { RoomView } from "../../shared/protocol";

/** 문구 표. UI-SPEC "Copywriting Contract" 원문 — 해요체, 마침표·느낌표 없음. */
export const DAY_COPY = {
  /** 지목 한 줄 '민준 → 도윤', 바꾸면 '(바꿈)' */
  pointLine: (from: string, to: string, changed: boolean): string => `${from} → ${to}${changed ? " (바꿈)" : ""}`,
  leadLine: (name: string): string => `${name} 님이 앞서요`,
  majorityLine: (name: string): string => `${name} 님 과반`,
} as const;

/** 채팅 시스템 줄 한 건. at 은 단계 진입 기준 ms(없으면 즉시) — 지연은 화면이 시계로 실행한다. */
export interface DayLine {
  kind: "system" | "vote" | "hot";
  text: string;
  at?: number;
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

const nameOf = (view: RoomView, seat: number): string | undefined => view.players.find((p) => p.seat === seat)?.nickname;

/**
 * 연속한 서버 view 두 개의 공개 정보 차이에서 연출 이벤트를 만든다.
 * prev 가 null 이거나 opts.reset(epoch 가 바뀐 첫 스냅샷)이면 이벤트 없이 정상 상태만 준다.
 */
export function dayEvents(prev: RoomView | null, cur: RoomView, opts: { reset?: boolean } = {}): DayEvents {
  const state = pointsTally(cur);
  const events: DayEvents = { lines: [], toasts: [], announces: [], fx: [], state: { ...state } };
  if (!prev || opts.reset || !cur.day) return events;

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
  return events;
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

// 자리표시자 — 구현은 다음 커밋.
export const ANNOUNCE_TALLY_MS = 2000;
export const ANNOUNCE_EXEC_MS = 3000;
export const ANNOUNCE_NOEXEC_MS = 1400;
export const ANNOUNCE_DAY_MS = 2000;
export const GHOST_RISE_MS = 1400;
export const GHOST_FADE_END_MS = 2400;

export function headerFor(_view: RoomView): { title: string; hint?: string } {
  return { title: "" };
}
