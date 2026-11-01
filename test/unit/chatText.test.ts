import { describe, expect, it } from "vitest";
import { EMOTE_IDS } from "../../shared/protocol";
import { EMOTE_LABEL } from "../../src/game/chatText";

describe("EMOTE_LABEL (UI-SPEC 동작 종류 표)", () => {
  it("키가 protocol EMOTE_IDS 와 같은 순서·같은 개수(9)다", () => {
    expect(EMOTE_IDS).toHaveLength(9);
    expect(Object.keys(EMOTE_LABEL)).toEqual([...EMOTE_IDS]);
  });

  it("라벨이 UI-SPEC 표와 같다", () => {
    expect(EMOTE_LABEL).toEqual({
      throat: "목 긋기",
      deny: "나 아니야",
      clap: "박수",
      cry: "엉엉",
      handshake: "악수",
      point: "손가락질",
      praise: "최고",
      surprise: "깜짝",
      dance: "춤",
    });
  });
});
