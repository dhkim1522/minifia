// 클라이언트 메시지 스키마(ClientMessageSchema) 입력 검증 — 후보 선택 취소(target null, 결정 0040)가 다른 메시지로 번지지 않는지 본다.
import { describe, expect, it } from "vitest";
import { ClientMessageSchema } from "../../shared/schemas";

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
