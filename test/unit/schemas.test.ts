// 클라이언트 메시지 스키마(ClientMessageSchema) 입력 검증 — 옛 투표 메시지 거부(08-21)와 새 메시지 모양을 본다.
import { describe, expect, it } from "vitest";
import { ClientMessageSchema, CreateRoomBodySchema, JoinRoomBodySchema, MoveMessageSchema } from "../../shared/schemas";
import { NICKNAME_MAX_GRAPHEMES, NICKNAME_MAX_UTF16, countGraphemes, validateNickname } from "../../shared/nickname";

// 08-21: 처형 여부·후보 선택 투표 메시지는 와이어에서 사라졌다(DAY-07, T-08-10). 옛 번들이 보내도 유니온에 없어 BAD_MESSAGE 다 — 새 메시지로 바꿔 받는 호환 길은 없다.
describe("옛 투표 메시지(execVote·candidateVote)는 와이어에서 사라졌다 (08-21, DAY-07)", () => {
  it.each([
    ["처형 여부 찬성", { t: "execVote", agree: true }],
    ["처형 여부 반대", { t: "execVote", agree: false }],
    ["후보 선택 0", { t: "candidateVote", target: 0 }],
    ["후보 선택 7", { t: "candidateVote", target: 7 }],
    ["후보 선택 취소(null)", { t: "candidateVote", target: null }],
  ])("%s 는 거부한다", (_name, msg) => {
    expect(ClientMessageSchema.safeParse(msg).success).toBe(false);
  });

  it("새 흐름의 세 메시지는 그대로 받는다", () => {
    expect(ClientMessageSchema.safeParse({ t: "point", target: 2 }).success).toBe(true);
    expect(ClientMessageSchema.safeParse({ t: "verdict", agree: true }).success).toBe(true);
    expect(ClientMessageSchema.safeParse({ t: "endDiscussion", on: true }).success).toBe(true);
  });

  it("nullable 이 다른 메시지로 번지지 않는다: pick·kick 의 target/seat null 은 거부", () => {
    expect(ClientMessageSchema.safeParse({ t: "pick", target: null }).success).toBe(false);
    expect(ClientMessageSchema.safeParse({ t: "kick", seat: null }).success).toBe(false);
  });
});

// 로비 이동 입력(결정 0044-17, T-06-09) — 목적지 두 정수뿐이다.
describe("MoveMessageSchema (strictObject, 정수 ±700)", () => {
  it.each([
    ["원점 근처", { t: "move", x: 0, z: -700 }],
    ["양 끝", { t: "move", x: 700, z: 700 }],
    ["음의 끝", { t: "move", x: -700, z: 0 }],
  ])("받는다: %s", (_name, msg) => {
    expect(MoveMessageSchema.safeParse(msg).success).toBe(true);
  });

  it.each([
    ["소수 x", { t: "move", x: 1.5, z: 0 }],
    ["소수 z", { t: "move", x: 0, z: 0.25 }],
    ["x 701", { t: "move", x: 701, z: 0 }],
    ["x -701", { t: "move", x: -701, z: 0 }],
    ["z 701", { t: "move", x: 0, z: 701 }],
    ["z -701", { t: "move", x: 0, z: -701 }],
    ["덧붙은 seat", { t: "move", x: 0, z: 0, seat: 1 }],
    ["덧붙은 속도 v", { t: "move", x: 0, z: 0, v: 9999 }],
    ["덧붙은 시각 t0", { t: "move", x: 0, z: 0, t0: 1 }],
    ["덧붙은 경로 p", { t: "move", x: 0, z: 0, p: [0, 0] }],
    ["빠진 z", { t: "move", x: 0 }],
    ["빠진 x", { t: "move", z: 0 }],
    ["문자열 x", { t: "move", x: "1", z: 0 }],
    ["NaN", { t: "move", x: Number.NaN, z: 0 }],
    ["Infinity", { t: "move", x: Number.POSITIVE_INFINITY, z: 0 }],
    ["null", { t: "move", x: null, z: 0 }],
    ["다른 t", { t: "pick", x: 0, z: 0 }],
  ])("거부한다: %s", (_name, msg) => {
    expect(MoveMessageSchema.safeParse(msg).success).toBe(false);
  });
});

// 06-08: move 는 ClientMessage 유니온의 멤버다 — 방 DO 가 ClientMessageSchema 로만 받는다.
describe("ClientMessageSchema move (06-08, 결정 0044-17)", () => {
  it("받는다: 정수 ±700 목적지", () => {
    expect(ClientMessageSchema.safeParse({ t: "move", x: -700, z: 700 }).success).toBe(true);
  });

  it.each([
    ["소수", { t: "move", x: 1.5, z: 0 }],
    ["범위 밖", { t: "move", x: 701, z: 0 }],
    ["덧붙은 seat", { t: "move", x: 0, z: 0, seat: 1 }],
    ["z 빠짐", { t: "move", x: 0 }],
  ])("거부한다: %s", (_name, msg) => {
    expect(ClientMessageSchema.safeParse(msg).success).toBe(false);
  });
});

// WR-03(06 리뷰): HTTP 본문 스키마의 상한이 제품 규칙(8 자소)보다 먼저 유효한 닉네임을 막지 않는다.
describe("닉네임 본문 스키마 상한과 8 자소 규칙의 일관성", () => {
  const FAMILY4 = "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}"; // 11 UTF-16 단위, 자소 1
  const EIGHT_FAMILIES = FAMILY4.repeat(NICKNAME_MAX_GRAPHEMES);

  it("자소 8 개짜리 유효 닉네임(UTF-16 길이 88)을 스키마가 받는다", () => {
    expect(EIGHT_FAMILIES.length).toBe(88);
    expect(countGraphemes(EIGHT_FAMILIES)).toBe(8);
    expect(validateNickname(EIGHT_FAMILIES).ok).toBe(true);
    expect(CreateRoomBodySchema.safeParse({ nickname: EIGHT_FAMILIES }).success).toBe(true);
    expect(JoinRoomBodySchema.safeParse({ nickname: EIGHT_FAMILIES }).success).toBe(true);
  });

  it("스키마 상한은 자소 8 개의 현실적인 최악값(88)보다 넉넉하다", () => {
    expect(NICKNAME_MAX_UTF16).toBeGreaterThanOrEqual(128);
  });

  it("상한을 넘는 문자열은 스키마가 거부한다", () => {
    expect(CreateRoomBodySchema.safeParse({ nickname: "a".repeat(NICKNAME_MAX_UTF16) }).success).toBe(true);
    expect(CreateRoomBodySchema.safeParse({ nickname: "a".repeat(NICKNAME_MAX_UTF16 + 1) }).success).toBe(false);
  });
});

// 07-08: 순차 주장 메시지는 사라졌다 — 옛 번들이 보내도 스키마가 거부한다(T-07-16).
describe("ClientMessageSchema claim (07-08, CHAT-06)", () => {
  it.each([
    ["직업", { t: "claim", claim: "police" }],
    ["말 안 함", { t: "claim", claim: "none" }],
  ])("07-08 claim 메시지(%s)는 거부한다", (_name, msg) => {
    expect(ClientMessageSchema.safeParse(msg).success).toBe(false);
  });
});

// 07-10: 입력 중은 ClientMessage 유니온의 멤버다. 채널·좌석은 보내지 않는다(결정 0002) — 덧붙은 키는 거부한다(T-07-19).
describe("ClientMessageSchema typing (07-10, CHAT-04)", () => {
  it("입력 중 {t, on, pk} 를 받는다", () => {
    expect(ClientMessageSchema.safeParse({ t: "typing", on: true, pk: "0:lobby" }).success).toBe(true);
    expect(ClientMessageSchema.safeParse({ t: "typing", on: false, pk: "1:night" }).success).toBe(true);
  });

  it.each([
    ["덧붙은 seat", { t: "typing", on: true, pk: "0:lobby", seat: 3 }],
    ["덧붙은 ch", { t: "typing", on: true, pk: "0:lobby", ch: "mafia" }],
    ["덧붙은 id", { t: "typing", on: true, pk: "0:lobby", id: "x" }],
    ["pk 33자", { t: "typing", on: true, pk: "a".repeat(33) }],
    ["pk 빈 문자열", { t: "typing", on: true, pk: "" }],
    ["pk 빠짐", { t: "typing", on: true }],
    ["on 빠짐", { t: "typing", pk: "0:lobby" }],
    ["on 문자열", { t: "typing", on: "true", pk: "0:lobby" }],
  ])("입력 중 %s 는 거부한다", (_name, msg) => {
    expect(ClientMessageSchema.safeParse(msg).success).toBe(false);
  });

  it("pk 32자는 받는다", () => {
    expect(ClientMessageSchema.safeParse({ t: "typing", on: true, pk: "a".repeat(32) }).success).toBe(true);
  });
});

describe("ClientMessageSchema chat (07-11, CHAT-01·05)", () => {
  it("본문과 단계 키만 있으면 통과한다", () => {
    expect(ClientMessageSchema.safeParse({ t: "chat", text: "가", pk: "0:lobby" }).success).toBe(true);
  });

  it("본문 300자(UTF-16)는 통과하고 301자는 거부한다", () => {
    expect(ClientMessageSchema.safeParse({ t: "chat", text: "가".repeat(300), pk: "0:lobby" }).success).toBe(true);
    expect(ClientMessageSchema.safeParse({ t: "chat", text: "가".repeat(301), pk: "0:lobby" }).success).toBe(false);
  });

  it.each([
    ["덧붙은 ch", { t: "chat", text: "가", pk: "0:lobby", ch: "mafia" }],
    ["덧붙은 seat", { t: "chat", text: "가", pk: "0:lobby", seat: 3 }],
    ["pk 33자", { t: "chat", text: "가", pk: "a".repeat(33) }],
    ["pk 빈 문자열", { t: "chat", text: "가", pk: "" }],
    ["pk 빠짐", { t: "chat", text: "가" }],
    ["text 빠짐", { t: "chat", pk: "0:lobby" }],
    ["text 숫자", { t: "chat", text: 1, pk: "0:lobby" }],
  ])("%s 는 거부한다", (_name, msg) => {
    expect(ClientMessageSchema.safeParse(msg).success).toBe(false);
  });
});

describe("빠른 메시지(say)는 와이어에서 사라졌다 (07-11, CHAT-06)", () => {
  it.each([
    ["낮 문구", { t: "say", template: "innocent" }],
    ["대상이 있는 문구", { t: "say", template: "suspect", target: 2 }],
    ["직업이 있는 문구", { t: "say", template: "claimed", target: 2, claimedRole: "police" }],
    ["밤 문구", { t: "say", template: "nightAgree" }],
    ["변론 문구", { t: "say", template: "defNotMe" }],
  ])("%s 의 say 는 거부한다", (_name, msg) => {
    expect(ClientMessageSchema.safeParse(msg).success).toBe(false);
  });
});

describe("텍스트 이모티콘(emoji)은 와이어에서 사라졌다 (07-12, CHAT-06)", () => {
  it.each([
    ["웃는 얼굴", { t: "emoji", icon: "smile" }],
    ["느낌표", { t: "emoji", icon: "exclaim" }],
    ["모르는 아이콘", { t: "emoji", icon: "nope" }],
  ])("%s 의 emoji 는 거부한다", (_name, msg) => {
    expect(ClientMessageSchema.safeParse(msg).success).toBe(false);
  });
});

// 08-07: 낮 처형 세 메시지(결정 0060). 모두 strictObject — 행위자는 소켓 첨부 playerId 뿐이라 seat·id·ch 가 덧붙으면 거부한다(T-08-04, T-08-24).
describe("ClientMessageSchema point (08-07, DAY-04: target 은 0..7 정수)", () => {
  it.each([
    ["0", { t: "point", target: 0 }],
    ["7", { t: "point", target: 7 }],
  ])("받는다: target %s", (_name, msg) => {
    expect(ClientMessageSchema.safeParse(msg).success).toBe(true);
  });

  it.each([
    ["target 빠짐", { t: "point" }],
    ["8", { t: "point", target: 8 }],
    ["-1", { t: "point", target: -1 }],
    ["1.5", { t: "point", target: 1.5 }],
    ['"1"', { t: "point", target: "1" }],
    ["null (취소는 없다)", { t: "point", target: null }],
    ["덧붙은 seat", { t: "point", target: 1, seat: 2 }],
    ["덧붙은 id", { t: "point", target: 1, id: "x" }],
    ["덧붙은 ch", { t: "point", target: 1, ch: "all" }],
  ])("거부한다: %s", (_name, msg) => {
    expect(ClientMessageSchema.safeParse(msg).success).toBe(false);
  });
});

describe("ClientMessageSchema verdict (08-07, DAY-06: agree 는 불리언)", () => {
  it.each([
    ["찬성", { t: "verdict", agree: true }],
    ["반대", { t: "verdict", agree: false }],
  ])("받는다: %s", (_name, msg) => {
    expect(ClientMessageSchema.safeParse(msg).success).toBe(true);
  });

  it.each([
    ["agree 빠짐", { t: "verdict" }],
    ['문자열 "true"', { t: "verdict", agree: "true" }],
    ["숫자 1", { t: "verdict", agree: 1 }],
    ["null", { t: "verdict", agree: null }],
    ["덧붙은 seat", { t: "verdict", agree: true, seat: 1 }],
    ["덧붙은 id", { t: "verdict", agree: true, id: "x" }],
  ])("거부한다: %s", (_name, msg) => {
    expect(ClientMessageSchema.safeParse(msg).success).toBe(false);
  });
});

describe("ClientMessageSchema endDiscussion (08-07, DAY-03: on 은 불리언)", () => {
  it.each([
    ["켜기", { t: "endDiscussion", on: true }],
    ["끄기", { t: "endDiscussion", on: false }],
  ])("받는다: %s", (_name, msg) => {
    expect(ClientMessageSchema.safeParse(msg).success).toBe(true);
  });

  it.each([
    ["on 빠짐", { t: "endDiscussion" }],
    ['문자열 "true"', { t: "endDiscussion", on: "true" }],
    ["숫자 1", { t: "endDiscussion", on: 1 }],
    ["덧붙은 seat", { t: "endDiscussion", on: true, seat: 1 }],
    ["덧붙은 count", { t: "endDiscussion", on: true, count: 99 }],
  ])("거부한다: %s", (_name, msg) => {
    expect(ClientMessageSchema.safeParse(msg).success).toBe(false);
  });
});
