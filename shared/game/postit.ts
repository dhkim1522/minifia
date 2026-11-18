// 의심 포스트잇 규칙(결정 0089-10, 24 D-01~D-05·D-22·D-25·D-26). 낮 토론에서 산 사람이 가까이 있는 산 사람에게 하루 한 장 종이를 붙인다(옮기기만 되고 받은 사람은 뗄 수 없다).
// 서버·클라이언트 공용 순수 모듈 — three·DOM·시각 함수를 import 하지 않는다. 시각은 인자로만 받고 입력 상태를 바꾸지 않는다.
// 판정·투표·단계 마감과 무관한 서버 기록이다: stickNote 는 RoomState.notes 외의 키를 바꾸지 않는다.
import type { PhaseId } from "../protocol";
import { isAlive } from "./alive";
import type { RoomState } from "./room";
import { positionAtFx } from "./world";
import type { Segment, WorldState } from "./world";

/** 붙일 수 있는 단계(D-02): 낮 토론 하나. dayAnnounce 는 걷기를 허용하지만 2초뿐이라 뺀다. */
export const NOTE_PHASES: ReadonlySet<PhaseId> = new Set<PhaseId>(["discussion"]);
/** 첫날은 키워드 문제가 근거를 대신하므로 둘째 날부터(D-22). 서버·화면이 같은 상수를 쓴다. */
export const NOTE_FIRST_DAY = 2;
/** 붙일 수 있는 거리(고정소수점, 2.4 단위 = CHAR_RADIUS 의 약 6.9배, D-25). 서버 구간 기준이고 걷는 중 지연을 감안한 값이다. */
export const NOTE_REACH_FX = 240;
/** 화면이 [의심] 대상을 켜는 문턱 비율(%) — 끄는 문턱은 100. 켠 대상은 서버가 언제나 받아 준다(히스테리시스, D-25). */
export const NOTE_REACH_ON_PCT = 92;
/** 한 사람 위에 보이는 종이 수(UI-SPEC P24-14). 저장은 전부, 3D 쪽이 마지막 이만큼만 그린다. */
export const NOTE_MAX_VISIBLE = 3;
/** 한 사람의 요청 간격(ms). 간격 안은 오류 없이 버린다 — 옮기기 연타가 쓰기·방송을 늘리지 않게(결정 0076). */
export const SUSPECT_MIN_GAP_MS = 600;

/** 이 단계·일차에 붙일 수 있는가. 서버 stickNote 와 화면 suspectVisible 이 같은 함수를 쓴다(D-22). */
export const noteAllowedNow = (phase: PhaseId, day: number | undefined, playtest?: boolean): boolean =>
  NOTE_PHASES.has(phase) && (playtest === true || (day ?? 1) >= NOTE_FIRST_DAY);

/**
 * 두 구간의 시각 now 위치가 붙일 거리 안인가. 정수 제곱 비교라 삼각함수·제곱근이 없고 서버와 폰이 같은 값을 얻는다.
 * pct 는 거리 문턱 비율(기본 100). 한쪽 구간이 없으면 거짓이다.
 */
export function withinNoteReach(a: Segment | undefined, b: Segment | undefined, now: number, pct = 100): boolean {
  if (a === undefined || b === undefined) return false;
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
}

export type StickResult = { ok: true; state: RoomState } | { ok: false; error: "BAD_MESSAGE" };

const REJECT: StickResult = { ok: false, error: "BAD_MESSAGE" };

/**
 * 의심 붙이기. 검사 순서가 계약이다: ① 단계·일차 ② 행위자(방에 있고 산 사람) ③ 대상(정수·방에 앉은 산 사람·자기 자신 아님)
 * ④ 거리(world.segs 는 플레이어 id 키) — 모든 실패가 같은 BAD_MESSAGE 하나다(거절 사유로 단계·거리·생존이 드러나지 않는다, D-26).
 * ⑤ 같은 n·from·to 가 이미 있으면 들어온 state 그대로(같은 객체 — 저장·방송을 건너뛰는 근거) ⑥ 같은 n·from 줄은 빼고 끝에 새 줄(옮기기, 쌓기 순서 최신이 위).
 * 결과는 { ...state, notes } 하나만 바꾼다. 연결이 끊긴 대상·봇에게도 붙는다(D-05).
 */
export function stickNote(state: RoomState, world: Pick<WorldState, "segs">, actorId: string, toSeat: number, now: number): StickResult {
  if (!noteAllowedNow(state.phase, state.day, state.playtest)) return REJECT;
  const actor = state.players.find((p) => p.id === actorId);
  if (!actor || !isAlive(actor)) return REJECT;
  if (!Number.isInteger(toSeat)) return REJECT;
  const target = state.players.find((p) => p.seat === toSeat);
  if (!target || !isAlive(target) || target.id === actor.id) return REJECT;
  if (!withinNoteReach(world.segs[actor.id], world.segs[target.id], now)) return REJECT;
  const n = state.day ?? 1;
  const notes = state.notes ?? [];
  if (notes.some((x) => x.n === n && x.from === actor.seat && x.to === target.seat)) return { ok: true, state };
  const next: NoteRow[] = [...notes.filter((x) => !(x.n === n && x.from === actor.seat)), { n, from: actor.seat, to: target.seat }];
  return { ok: true, state: { ...state, notes: next } };
}
