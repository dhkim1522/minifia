// 10-01: 동작(몸짓) 순수 규칙 — EMOTE_MS 가 캐릭터 표(EMOTES)와 어긋나지 않음을 잡는다 (D-3, UI-SPEC A-6).
import { describe, expect, it } from "vitest";
import { EMOTE_IDS } from "../../shared/protocol";
import { EMOTE_BURST_MAX, EMOTE_BURST_WINDOW_MS, EMOTE_MIN_GAP_MS, EMOTE_MS, emoteGate } from "../../shared/game/emote";
import type { EmoteSenderState } from "../../shared/game/emote";
import { EMOTES } from "../../src/world/characterData";

describe("EMOTE_MS — 재생 길이 표 (10-01 트레이서)", () => {
  it("아홉 키가 모두 있다", () => {
    expect(Object.keys(EMOTE_MS).sort()).toEqual([...EMOTE_IDS].sort());
  });

  it.each(EMOTE_IDS)("%s 는 EMOTES 표에서 계산한 값((프레임 수 × seg × cycles + hold) × 1000 반올림)과 같다", (id) => {
    const d = EMOTES[id];
    expect(EMOTE_MS[id]).toBe(Math.round((d.frames.length * d.seg * d.cycles + d.hold) * 1000));
  });
});

// 연타 규칙(O-1 기본값): 앞 동작이 끝나기 전 불가 · 마지막 수락 뒤 1000ms · 10초 창에 5번. 시각은 인자로 받는다.
describe("emoteGate — 연타 규칙 (10-01 Task 2, D-19)", () => {
  it("상수는 계약 값이다", () => {
    expect(EMOTE_MIN_GAP_MS).toBe(1000);
    expect(EMOTE_BURST_WINDOW_MS).toBe(10_000);
    expect(EMOTE_BURST_MAX).toBe(5);
  });

  it("prev 가 없으면 받아들이고 until = now + EMOTE_MS[id] 다", () => {
    const r = emoteGate(undefined, "clap", 5000);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.next).toEqual({ until: 5000 + EMOTE_MS.clap, at: [5000] });
  });

  it("now < prev.until 이면 거절한다(앞 동작이 안 끝남), until 과 같은 시각은 받아들인다", () => {
    const prev: EmoteSenderState = { until: 3000, at: [0] };
    expect(emoteGate(prev, "deny", 2999).ok).toBe(false);
    expect(emoteGate(prev, "deny", 3000).ok).toBe(true);
  });

  it("마지막 수락 뒤 1000ms 미만이면 거절한다(합성 prev: until 이 이미 지난 경우)", () => {
    const prev: EmoteSenderState = { until: 0, at: [10_000] };
    expect(emoteGate(prev, "deny", 10_999).ok).toBe(false);
    expect(emoteGate(prev, "deny", 11_000).ok).toBe(true);
  });

  it("10초 창에 수락 기록이 5개면 6번째를 거절하고, 가장 오래된 기록이 창 밖으로 밀리면 다시 받아들인다", () => {
    const prev: EmoteSenderState = { until: 0, at: [1000, 2500, 4000, 5500, 7000] };
    expect(emoteGate(prev, "deny", 10_999).ok).toBe(false); // 창 = (now-10000, now] → 1000 은 now=10999 에서 아직 안(>999)
    expect(emoteGate(prev, "deny", 11_000).ok).toBe(true); // 1000 은 now-10000 이하라 창 밖
  });

  it("수락하면 창 안 기록 + now 로 next.at 을 만들고 창 밖 기록은 버린다", () => {
    const prev: EmoteSenderState = { until: 0, at: [1000, 4000] };
    const r = emoteGate(prev, "surprise", 12_000);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.next.at).toEqual([4000, 12_000]); // 1000 은 창(now-10000 초과) 밖이라 버린다
  });

  it("거절하면 next 가 없다(기록 갱신은 수락 때만)", () => {
    const r = emoteGate({ until: 9000, at: [0] }, "clap", 100);
    expect(r).toEqual({ ok: false });
  });

  it("입력 prev 를 바꾸지 않는다", () => {
    const prev: EmoteSenderState = Object.freeze({ until: 0, at: Object.freeze([1]) as readonly number[] });
    expect(() => emoteGate(prev, "clap", 50_000)).not.toThrow();
  });
});
