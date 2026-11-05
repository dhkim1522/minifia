// 10-01: 동작(몸짓) 순수 규칙 — EMOTE_MS 가 캐릭터 표(EMOTES)와 어긋나지 않음을 잡는다 (D-3, UI-SPEC A-6).
import { describe, expect, it } from "vitest";
import { EMOTE_IDS } from "../../shared/protocol";
import { EMOTE_MS } from "../../shared/game/emote";
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
