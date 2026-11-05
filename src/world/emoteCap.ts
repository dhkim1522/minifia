// 사람 동작의 동시 재생 상한과 길이(10-03, D-13). 순수 모듈 — three·DOM 을 모르고 시각은 인자로 받는다.
import { EMOTES, type EmoteId } from "./characterData";

/** 한 화면에서 사람 동작이 동시에 재생되는 최대 수(D-13). 5번째가 오면 가장 먼저 시작한 것을 끝낸다 */
export const EMOTE_RENDER_MAX = 4;
/** 모션 줄이기(O-5): 다른 사람 동작은 정보라 재생하되 반복은 이만큼까지 */
export const REDUCED_MAX_CYCLES = 2;
/** 모션 줄이기에서 surprise 뛰어오름·dance 몸 위아래(y) 진폭에 곱하는 배율 */
export const REDUCED_Y_SCALE = 0.5;

/** 동작이 실제로 도는 반복 수. 모션 줄이기면 REDUCED_MAX_CYCLES 로 제한한다 */
export function emoteCycles(id: EmoteId, reduced: boolean): number {
  const cycles = EMOTES[id].cycles;
  return reduced ? Math.min(cycles, REDUCED_MAX_CYCLES) : cycles;
}

/** 동작 재생 길이(ms) = (프레임 수 × seg × 반복 + hold) × 1000. 보통은 서버의 EMOTE_MS 와 같다 */
export function emoteDurationMs(id: EmoteId, reduced = false): number {
  const d = EMOTES[id];
  return Math.round((d.frames.length * d.seg * emoteCycles(id, reduced) + d.hold) * 1000);
}

/** 재생 중인 사람 동작 하나: 좌석과 끝나는 시각(ms) */
export interface PlayingEmote {
  seat: number;
  until: number;
}

/**
 * 새 동작을 받아들인다. 새 동작은 항상 재생된다(거절 없음).
 * 끝난 항목(until ≤ now)과 같은 좌석의 이전 항목을 먼저 걷어 낸 뒤, 남은 수가 max 이상이면 먼저 도착한 것부터 stopSeats 로 돌려준다.
 * 순서는 도착 순서(배열 순서)다 — 프레임의 n 은 채널(all·mafia·ghost)별 번호라 채널 사이에 견줄 수 없어 쓰지 않는다(결정 0068).
 */
export function admitEmote(playing: readonly PlayingEmote[], incoming: PlayingEmote, now: number, max: number = EMOTE_RENDER_MAX): { playing: PlayingEmote[]; stopSeats: number[] } {
  const live = playing.filter((p) => p.until > now && p.seat !== incoming.seat);
  const over = Math.max(0, live.length - (max - 1));
  return { playing: [...live.slice(over), { ...incoming }], stopSeats: live.slice(0, over).map((p) => p.seat) };
}
