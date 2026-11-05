// 동작(몸짓) 순수 규칙(10-01, 결정 D-3·D-10·D-19, 미결 O-1).
// 순수 모듈이다: 시각·난수를 읽지 않고 입력을 바꾸지 않으며, DOM·workerd API 가 없다(앱·워커 두 tsconfig 에 모두 들어간다).
import type { EmoteId } from "../protocol";

/**
 * 동작 재생 길이(ms). src/world/characterData.ts 의 EMOTES 표에서 (프레임 수 × seg × cycles + hold) × 1000 을 반올림한 값이다.
 * 서버는 장면 데이터를 import 하지 않는다(three 의존 없음) — 표가 바뀌면 test/unit/emote.test.ts 가 어긋남을 잡는다.
 */
export const EMOTE_MS: Readonly<Record<EmoteId, number>> = {
  throat: 1780,
  deny: 1320,
  clap: 1280,
  cry: 1760,
  handshake: 1380,
  point: 1700,
  praise: 1280,
  surprise: 1060,
  dance: 2080,
};
