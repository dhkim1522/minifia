import { describe, expect, it } from "vitest";
import { AWARD_IDS } from "../../shared/protocol";
import type { AwardId } from "../../shared/protocol";
import { awardAria, awardIcon, awardName, awardReason, CEREMONY_TITLE } from "../../src/game/awardText";

// 칭호 12개의 이름·아이콘·이유 문구 한 곳 (11-09, END-04, UI-SPEC B-1)
const TABLE: Record<AwardId, { name: string; icon: string; reason: string; k?: number; at?: "day" | "night" }> = {
  actor: { name: "연기대상", icon: "roleMafia", reason: "거짓 주장 3일", k: 3 },
  detective: { name: "명탐정", icon: "eye", reason: "마피아를 2번 가리킴", k: 2 },
  angel: { name: "수호천사", icon: "heal", reason: "1번 지킴", k: 1 },
  whiff: { name: "헛다리왕", icon: "point", reason: "헛다리 4번", k: 4 },
  target: { name: "과녁", icon: "target", reason: "5번 지목당함", k: 5 },
  firstVictim: { name: "첫 희생자", icon: "ghost", reason: "2밤에 당함", k: 2 },
  talker: { name: "수다왕", icon: "send", reason: "채팅 42번", k: 42 },
  swapper: { name: "말 바꿈 왕", icon: "swap", reason: "주장 3번 바꿈", k: 3 },
  whisperer: { name: "귓속말 달인", icon: "whisper", reason: "귓속말 6번", k: 6 },
  mood: { name: "분위기 메이커", icon: "dance", reason: "동작 9번", k: 9 },
  survivor: { name: "생존자", icon: "check", reason: "끝까지 남음" },
  spectator: { name: "관전자", icon: "ghost", reason: "2일차 낮 탈락", k: 2, at: "day" },
};

describe("칭호 문구 표", () => {
  it("표가 AWARD_IDS 열두 개를 모두 덮는다", () => {
    expect(Object.keys(TABLE).sort()).toEqual([...AWARD_IDS].sort());
  });

  it.each(AWARD_IDS)("%s: 이름·아이콘·이유가 표 그대로다", (id) => {
    const row = TABLE[id];
    expect(awardName(id)).toBe(row.name);
    expect(awardIcon(id)).toBe(row.icon);
    expect(awardReason({ award: id, ...(row.k !== undefined ? { k: row.k } : {}), ...(row.at !== undefined ? { at: row.at } : {}) })).toBe(row.reason);
  });

  it("관전자는 at 으로 낮·밤을 가른다", () => {
    expect(awardReason({ award: "spectator", k: 1, at: "night" })).toBe("1일차 밤 탈락");
    expect(awardReason({ award: "spectator", k: 3, at: "day" })).toBe("3일차 낮 탈락");
  });

  it("생존자는 k 가 없어도(있어도) 숫자 없이 같은 문구다", () => {
    expect(awardReason({ award: "survivor" })).toBe("끝까지 남음");
    expect(awardReason({ award: "survivor", k: 3 })).toBe("끝까지 남음");
  });

  it("첫 희생자 k 는 죽은 밤 n 이다", () => {
    expect(awardReason({ award: "firstVictim", k: 1 })).toBe("1밤에 당함");
    expect(awardReason({ award: "firstVictim", k: 4 })).toBe("4밤에 당함");
  });

  it("k 가 빠졌거나 이상하면 숫자 없는 말로 안전하게 간다 (던지지 않는다)", () => {
    for (const id of AWARD_IDS) {
      for (const k of [undefined, Number.NaN, -1]) {
        const text = awardReason({ award: id, ...(k !== undefined ? { k } : {}) });
        expect(text.length, id).toBeGreaterThan(0);
        expect(text, id).not.toMatch(/NaN|undefined|-1/);
      }
    }
  });

  it("알 수 없는 id 는 던지지 않고 이름·이유가 비고 아이콘은 trophy", () => {
    expect(awardName("zzz")).toBe("");
    expect(awardIcon("zzz")).toBe("trophy");
    expect(awardReason({ award: "zzz" as AwardId, k: 1 })).toBe("");
    expect(awardAria("지우", { award: "zzz" as AwardId })).toBe("지우");
    expect(awardName("constructor")).toBe("");
    expect(awardName("__proto__")).toBe("");
  });

  it("문구에 마침표·느낌표·이모지가 없다", () => {
    for (const id of AWARD_IDS) {
      const row = TABLE[id];
      const s = `${awardName(id)} ${awardReason({ award: id, ...(row.k !== undefined ? { k: row.k } : {}), ...(row.at !== undefined ? { at: row.at } : {}) })}`;
      expect(s, id).not.toMatch(/[.!?]|\p{Extended_Pictographic}/u);
    }
  });

  it("스크린리더 문구는 '{닉네임}, {칭호}, {이유}'", () => {
    expect(awardAria("지우", { award: "talker", k: 42 })).toBe("지우, 수다왕, 채팅 42번");
    expect(awardAria("하윤", { award: "survivor" })).toBe("하윤, 생존자, 끝까지 남음");
  });

  it("헤더 제목은 '시상식'", () => {
    expect(CEREMONY_TITLE).toBe("시상식");
  });

  it("직업·기록을 읽지 않는다 (T-11-32): 소스에 result·seats·job 참조가 없다", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/game/awardText.ts", "utf8");
    expect(src).not.toMatch(/\bresult\b|\bseats\b|\bjob\b|RoomView/);
  });
});
