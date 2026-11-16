// 의심 포스트잇의 순수 화면 모델(24-01, 결정 0089-10). 서버 view 의 공개 값(day.suspects·day.suspectLog·me.suspectTo)과 서버 구간만 읽는다.
// UI-SPEC P24-6 교정 — 내 예측 위치가 아니라 서버 구간(store.segOf)만 읽는다(D-25): 서버가 같은 구간·같은 함수로 거리를 재므로 켠 대상은 언제나 서버가 받아 준다.
// 시각·난수를 읽지 않고 입력을 바꾸지 않는다(whisperView.ts 와 같은 규칙). 시각은 인자(serverNow)로만 받는다.
import { isAlive } from "../../shared/game/alive";
import { NOTE_REACH_ON_PCT, noteAllowedNow, withinNoteReach } from "../../shared/game/postit";
import type { NoteRow } from "../../shared/game/postit";
import type { Segment } from "../../shared/game/world";
import type { RoomView } from "../../shared/protocol";

/** 하루치 기록(기록 카드 한 구역). */
export interface SuspectDayRows {
  n: number;
  rows: NoteRow[];
}

/** [의심] 을 낼 수 있는가: 서버와 같은 noteAllowedNow(토론·둘째 날부터, D-22) + 내가 산 사람 + 나를 뺀 산 사람 ≥ 1. 유령에게는 만들지 않는다. */
export function suspectVisible(view: RoomView): boolean {
  if (!noteAllowedNow(view.phase, view.day?.n)) return false;
  const me = view.players.find((p) => p.seat === view.me.seat);
  if (me === undefined || !isAlive(me)) return false;
  return view.players.some((p) => p.seat !== view.me.seat && isAlive(p));
}

/** 오늘 이미 붙였는가(옮기기 표시) — 서버가 본인 view 에만 싣는 값 */
export function suspectUsed(view: RoomView): boolean {
  return view.me.suspectTo !== undefined;
}

/**
 * 지금 붙일 수 있는 근처 대상 좌석: 나를 뺀 산 사람 중 서버 구간 거리 판정을 통과한 좌석(권위는 서버 stickNote).
 * 히스테리시스: prev(이전 집합)에 있던 좌석은 끄는 문턱 100%, 없던 좌석은 켜는 문턱 NOTE_REACH_ON_PCT(92%)로 잰다 — 경계에서 깜빡이지 않고, 켠 대상은 서버가 받아 준다.
 * 내 구간이 없으면 빈 집합이다.
 */
export function suspectTargets(
  view: RoomView,
  segOf: (seat: number) => Segment | undefined,
  serverNow: number,
  prev?: ReadonlySet<number>,
): ReadonlySet<number> {
  const out = new Set<number>();
  const mine = segOf(view.me.seat);
  if (mine === undefined) return out;
  for (const p of view.players) {
    if (p.seat === view.me.seat || !isAlive(p)) continue;
    const pct = prev?.has(p.seat) === true ? 100 : NOTE_REACH_ON_PCT;
    if (withinNoteReach(mine, segOf(p.seat), serverNow, pct)) out.add(p.seat);
  }
  return out;
}

/** 받은 좌석 → 붙인 좌석 배열(day.suspects 순서 = 쌓는 순서 아래→위). 죽은 받은 좌석은 뺀다. 보이는 3장 자르기는 그리는 쪽이 NOTE_MAX_VISIBLE 로 한다. */
export function suspectStacks(view: RoomView): ReadonlyMap<number, readonly number[]> {
  const alive = new Set(view.players.filter((p) => isAlive(p)).map((p) => p.seat));
  const out = new Map<number, number[]>();
  for (const x of view.day?.suspects ?? []) {
    if (!alive.has(x.to)) continue;
    const list = out.get(x.to);
    if (list === undefined) out.set(x.to, [x.from]);
    else list.push(x.from);
  }
  return out;
}

/** 그 좌석이 받은 종이 수(없으면 0) */
export function suspectCountOf(view: RoomView, seat: number): number {
  return suspectStacks(view).get(seat)?.length ?? 0;
}

/** 기록 카드용: 최신 일차 먼저, 일차 안은 붙인 좌석 오름차순, 줄 없는 일차는 없다. */
export function suspectLogByDay(view: RoomView): SuspectDayRows[] {
  const byDay = new Map<number, NoteRow[]>();
  for (const x of view.day?.suspectLog ?? []) {
    const row: NoteRow = { n: x.n, from: x.from, to: x.to };
    const list = byDay.get(x.n);
    if (list === undefined) byDay.set(x.n, [row]);
    else list.push(row);
  }
  return [...byDay.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([n, rows]) => ({ n, rows: rows.sort((a, b) => a.from - b.from) }));
}
