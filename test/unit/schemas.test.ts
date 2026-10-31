// 클라이언트 메시지 스키마(ClientMessageSchema) 입력 검증 — 후보 선택 취소(target null, 결정 0040)가 다른 메시지로 번지지 않는지 본다.
import { describe, expect, it } from "vitest";
import { ClientMessageSchema, MoveMessageSchema } from "../../shared/schemas";

describe("ClientMessageSchema candidateVote (결정 0040: target 은 0..7 정수 또는 null)", () => {
  it.each([
    ["null (취소)", { t: "candidateVote", target: null }],
    ["0", { t: "candidateVote", target: 0 }],
    ["7", { t: "candidateVote", target: 7 }],
  ])("받는다: target %s", (_name, msg) => {
    expect(ClientMessageSchema.safeParse(msg).success).toBe(true);
  });

  it.each([
    ["target 빠짐", { t: "candidateVote" }],
    ["8", { t: "candidateVote", target: 8 }],
    ["-1", { t: "candidateVote", target: -1 }],
    ["1.5", { t: "candidateVote", target: 1.5 }],
    ['"1"', { t: "candidateVote", target: "1" }],
    ["true", { t: "candidateVote", target: true }],
    ["undefined", { t: "candidateVote", target: undefined }],
    ["덧붙은 키(target null + seat)", { t: "candidateVote", target: null, seat: 1 }],
    ["덧붙은 키(target 1 + id)", { t: "candidateVote", target: 1, id: "x" }],
  ])("거부한다: %s", (_name, msg) => {
    expect(ClientMessageSchema.safeParse(msg).success).toBe(false);
  });

  it("nullable 이 다른 메시지로 번지지 않는다: pick·kick 의 target/seat null 은 거부, say 의 target null 도 거부", () => {
    expect(ClientMessageSchema.safeParse({ t: "pick", target: null }).success).toBe(false);
    expect(ClientMessageSchema.safeParse({ t: "kick", seat: null }).success).toBe(false);
    expect(ClientMessageSchema.safeParse({ t: "say", template: "innocent", target: null }).success).toBe(false);
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
