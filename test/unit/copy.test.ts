import { describe, expect, it } from "vitest";
import { NETWORK_TEXT as EXPORTED_NETWORK_TEXT, exitReasonText, messageForApiError, nicknameErrorText } from "../../src/net/copy";

const NETWORK_TEXT = "연결이 불안정해요. 다시 시도해 주세요";

// UI-SPEC Copywriting Contract 의 Error state 표를 한 행씩 옮긴 것.
describe("messageForApiError (Error state 표)", () => {
  it.each([
    ["NICKNAME_INVALID", "create", "nickname", "1~8자로 입력해 주세요"],
    ["NICKNAME_INVALID", "home-code", "nickname", "1~8자로 입력해 주세요"],
    ["NICKNAME_INVALID", "link", "nickname", "1~8자로 입력해 주세요"],
    ["NICKNAME_TAKEN", "home-code", "nickname", "같은 이름이 이미 있어요"],
    ["NICKNAME_TAKEN", "link", "nickname", "같은 이름이 이미 있어요"],
    ["ROOM_NOT_FOUND", "home-code", "code", "방을 찾을 수 없어요. 코드를 다시 확인해 주세요"],
    ["ROOM_NOT_FOUND", "link", "card", "방을 찾을 수 없어요"],
    ["ROOM_FULL", "home-code", "code", "이미 8명이 모였어요"],
    ["ROOM_FULL", "link", "card", "이미 8명이 모였어요"],
    ["GAME_STARTED", "home-code", "code", "이미 게임이 시작된 방이에요"],
    ["GAME_STARTED", "link", "card", "이미 게임이 시작된 방이에요"],
    ["CODE_EXHAUSTED", "create", "toast", "지금은 방을 만들 수 없어요. 잠시 후 다시 해 주세요"],
    ["NETWORK", "create", "toast", NETWORK_TEXT],
    ["NETWORK", "home-code", "toast", NETWORK_TEXT],
    ["NETWORK", "link", "toast", NETWORK_TEXT],
    ["BAD_REQUEST", "create", "toast", NETWORK_TEXT],
    ["NOT_FOUND", "create", "toast", NETWORK_TEXT],
  ] as const)("%s (%s) → %s: %s", (error, context, place, text) => {
    expect(messageForApiError(error, context)).toEqual({ place, text });
  });

  it("그 맥락에서 나올 수 없는 코드는 서버 내부 정보를 드러내지 않고 연결 불안정 토스트로 접는다", () => {
    expect(messageForApiError("CODE_EXHAUSTED", "link")).toEqual({ place: "toast", text: NETWORK_TEXT });
    expect(messageForApiError("ROOM_FULL", "create")).toEqual({ place: "toast", text: NETWORK_TEXT });
  });
});

describe("NETWORK_TEXT export", () => {
  it("연결 불안정 문구를 export 한다 (06-13 이 이동 응답 없음 알림에 쓴다)", () => {
    expect(EXPORTED_NETWORK_TEXT).toBe(NETWORK_TEXT);
  });
});

describe("nicknameErrorText", () => {
  it.each([
    ["EMPTY", "1~8자로 입력해 주세요"],
    ["TOO_LONG", "1~8자로 입력해 주세요"],
    ["INVALID_CHARS", "쓸 수 없는 글자가 있어요"],
  ] as const)("%s → %s", (reason, text) => {
    expect(nicknameErrorText(reason)).toBe(text);
  });
});

describe("exitReasonText", () => {
  it.each([
    ["kicked", "방장이 방에서 내보냈어요"],
    ["room_closed", "방이 닫혔어요"],
    ["invalid_token", "이 방의 입장 정보가 없어요. 다시 들어와 주세요"],
  ] as const)("%s → %s", (reason, text) => {
    expect(exitReasonText(reason)).toBe(text);
  });
});
