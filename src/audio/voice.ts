// 17-02: 사회자 웅얼 목소리 — 문장을 글자마다 voice.syl 음절 대본으로 예약한다 (TUT-04, 결정 0078-4·0080-8).
// 문구는 인자로만 받는다. 대본 모듈·view 를 가져오지 않는다(정적 가드, T-17-07) — 이 모듈은 길이와 글자 수만 안다.
// 음높이는 6단계 순환 + 7번째 글자마다 ×0.88 을 cents 로 항목에 싣는다(레시피 자체는 205Hz 하나).
// 같은 key(VOICE_KEY)의 runScript 가 이전 예약을 끊으므로 새 문장이 앞 문장을 이긴다. 소리 끔·잠금·노드 예산은 엔진이 처리한다.
import type { SoundEngine } from "./engine";
import type { ScriptItem } from "./script";

/** 사회자 목소리 대본의 key. 같은 key 는 이전 예약을 취소한다 */
export const VOICE_KEY = "voice.host";

/** 음높이 6단계 순환 비율 (Sound.dc.html 목소리 식) */
const STEPS = [1, 1.12, 1.26, 1.06, 1.19, 0.94] as const;
/** 7번째 글자마다 곱하는 비율 */
const LOW_EVERY = 7;
const LOW_RATIO = 0.88;
/** 첫 음절 시작, 글자 간격, 띄어쓰기 추가 간격, 마지막 음절 뒤 여유(ms) */
const START_MS = 50;
const SYL_MS = 85;
const SPACE_MS = 50;
const TAIL_MS = 80;

/**
 * 문장을 음절 항목으로. 띄어쓰기는 항목 없이 시간만 더하고, 그 밖 글자마다 항목 하나.
 * totalMs 는 루프가 끝난 뒤의 at + 80 — 파형·글 드러남이 움직이는 시간이다(소리 켬·끔과 무관).
 */
export function sayItems(text: string): { items: ScriptItem[]; totalMs: number } {
  const items: ScriptItem[] = [];
  let at = START_MS;
  let n = 0;
  for (const ch of text) {
    if (/\s/.test(ch)) {
      at += SPACE_MS;
      continue;
    }
    const ratio = STEPS[n % STEPS.length]! * (n % LOW_EVERY === LOW_EVERY - 1 ? LOW_RATIO : 1);
    items.push({ at, id: "voice.syl", cents: Math.round(1200 * Math.log2(ratio)) });
    at += SYL_MS;
    n += 1;
  }
  return { items, totalMs: at + TAIL_MS };
}

/** 문장을 말한다: runScript 한 번(앞 문장 예약은 엔진이 끊는다). 말하는 시간(ms)을 돌려준다 */
export function say(engine: Pick<SoundEngine, "runScript">, text: string): number {
  const { items, totalMs } = sayItems(text);
  engine.runScript(VOICE_KEY, items);
  return totalMs;
}

/** 남은 음절 예약을 끊는다(장면 넘김·건너뛰기·언마운트) */
export function hush(engine: Pick<SoundEngine, "runScript">): void {
  engine.runScript(VOICE_KEY, []);
}
