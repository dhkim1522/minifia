// 산 사람은 첫날 답안 발표의 현재 발표자와 낮 토론의 상대에게 하루 한 장 붙이고 뗄 수 있다.
// 바에서는 고정 좌석의 상대를 모두 고를 수 있다. 광장은 이전의 가까운 대상 거리 판정을 쓴다.
// 서버·클라이언트 공용 순수 모듈 — three·DOM·시각 함수를 import 하지 않는다. 시각은 인자로만 받고 입력 상태를 바꾸지 않는다.
// 판정·투표·단계 마감과 무관한 서버 기록이다: stickNote 는 RoomState.notes 외의 키를 바꾸지 않는다.
import type { PhaseId } from "../protocol";
import { isAlive } from "./alive";
import { keywordPresentationOf } from "./keywordPresentation";
import type { RoomState } from "./room";
import { positionAtFx } from "./world";
import type { Segment, WorldState } from "./world";

/** 붙일 수 있는 단계(D-02): 낮 토론 하나. dayAnnounce 는 걷기를 허용하지만 2초뿐이라 뺀다. */
export const NOTE_PHASES: ReadonlySet<PhaseId> = new Set<PhaseId>(["discussion"]);
/** 봇이 토론 중에 의심 표시를 붙이기 시작하는 날. */
export const NOTE_FIRST_DAY = 2;
/** 붙일 수 있는 거리(고정소수점, 2.4 단위 = CHAR_RADIUS 의 약 6.9배, D-25). 서버 구간 기준이고 걷는 중 지연을 감안한 값이다. */
export const NOTE_REACH_FX = 240;
/** 화면이 [의심] 대상을 켜는 문턱 비율(%) — 끄는 문턱은 100. 켠 대상은 서버가 언제나 받아 준다(히스테리시스, D-25). */
export const NOTE_REACH_ON_PCT = 92;
/** 한 사람 위에 보이는 종이 수(UI-SPEC P24-14). 저장은 전부, 3D 쪽이 마지막 이만큼만 그린다. */
export const NOTE_MAX_VISIBLE = 3;
/** 한 사람의 요청 간격(ms). 간격 안은 오류 없이 버린다 — 옮기기 연타가 쓰기·방송을 늘리지 않게(결정 0076). */
export const SUSPECT_MIN_GAP_MS = 600;

/** 토론 중 표시를 붙이고 옮기고 뗄 수 있다. 발표 중에는 현재 발표자만 허용한다. */
export const noteAllowedNow = (phase: PhaseId): boolean => NOTE_PHASES.has(phase);

/**
 * 두 구간의 시각 now 위치가 붙일 거리 안인가. 정수 제곱 비교라 삼각함수·제곱근이 없고 서버와 폰이 같은 값을 얻는다.
 * pct는 거리 문턱 비율(기본 100)이다. 고정 좌석은 두 구간이 존재할 때 도달 가능하다.
 */
export function withinNoteReach(a: Segment | undefined, b: Segment | undefined, now: number, pct = 100, seated = false): boolean {
  if (a === undefined || b === undefined) return false;
  if (seated) return true;
  const p = positionAtFx(a, now);
  const q = positionAtFx(b, now);
  const dx = p.x - q.x;
  const dz = p.z - q.z;
  return (dx * dx + dz * dz) * 10_000 <= (NOTE_REACH_FX * pct) ** 2;
}

/** 서버 전용 보관 한 줄: 일차 n, 붙인 좌석 from, 받은 좌석 to. */
export interface NoteRow {
  n: number;
  from: number;
  to: number;
  removed?: true; // 떼면 현재 쌓임에서 빠지고 그날 마지막으로 표시한 대상은 기록에 남는다.
}

export type StickResult = { ok: true; state: RoomState } | { ok: false; error: "BAD_MESSAGE" };

const REJECT: StickResult = { ok: false, error: "BAD_MESSAGE" };

/**
 * 의심 붙이기·떼기. 검사 순서가 계약이다: ① 단계 ② 행위자(방에 있고 산 사람) ③ 대상(정수·방에 앉은 산 사람·자기 자신 아님)
 * ④ 거리(world.segs 는 플레이어 id 키) — 모든 실패가 같은 BAD_MESSAGE 하나다(거절 사유로 단계·거리·생존이 드러나지 않는다, D-26).
 * 같은 표시를 붙이거나 떼는 중복 요청은 같은 state 를 돌려준다. 다른 대상에게 붙이면 같은 n·from 줄을 끝으로 옮긴다.
 * 결과는 { ...state, notes } 하나만 바꾼다. 연결이 끊긴 대상·봇에게도 붙는다(D-05).
 */
export function stickNote(state: RoomState, world: Pick<WorldState, "segs">, actorId: string, toSeat: number, now: number, remove = false): StickResult {
  const presentation = keywordPresentationOf(state, now);
  if (presentation !== undefined ? toSeat !== presentation.seat : !noteAllowedNow(state.phase)) return REJECT;
  const actor = state.players.find((p) => p.id === actorId);
  if (!actor || !isAlive(actor)) return REJECT;
  if (!Number.isInteger(toSeat)) return REJECT;
  const target = state.players.find((p) => p.seat === toSeat);
  if (!target || !isAlive(target) || target.id === actor.id) return REJECT;
  if (!withinNoteReach(world.segs[actor.id], world.segs[target.id], now, 100, (state.map ?? "bar") === "bar")) return REJECT;
  const n = state.day ?? 1;
  const notes = state.notes ?? [];
  const mine = notes.find((x) => x.n === n && x.from === actor.seat);
  if (remove) {
    if (mine?.to !== target.seat || mine.removed === true) return { ok: true, state };
    return { ok: true, state: { ...state, notes: notes.map((x) => x === mine ? { ...x, removed: true } : x) } };
  }
  if (mine?.to === target.seat && mine.removed !== true) return { ok: true, state };
  const next: NoteRow[] = [...notes.filter((x) => !(x.n === n && x.from === actor.seat)), { n, from: actor.seat, to: target.seat }];
  return { ok: true, state: { ...state, notes: next } };
}
