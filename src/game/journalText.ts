// 일지 문구의 단일 출처(결정 0026, UI-SPEC Copywriting). 화면 문구는 여기, 줄 모양 해석도 여기다.
import type { RoleRecord } from "../../shared/protocol";
import type { JournalRole } from "../net/assets";

export const JOURNAL_TEXT: Readonly<Record<JournalRole, { name: string; empty: string }>> = {
  police: { name: "수사일지", empty: "아직 조사한 사람이 없어요" },
  mafia: { name: "암살일지", empty: "아직 지목한 사람이 없어요" },
  doctor: { name: "치료일지", empty: "아직 보호한 사람이 없어요" },
};

export type JournalTone = "bad" | "ok" | "heal";

/**
 * 한 줄의 결과 말과 색 계열. me.records 는 세 모양의 합집합이라 역할이 읽는 키가 실제로 있는지 확인하고,
 * 없으면 null 을 돌려준다 — 호출한 쪽은 그 줄을 그리지 않는다(없는 값을 `마피아 아님` 같은 말로 위장하지 않는다).
 * 직업 이름·의사의 구출 여부는 줄 모양에 실리지 않으므로 여기서도 만들지 않는다(결정 0027).
 */
export function journalResult(role: JournalRole, record: RoleRecord): { text: string; tone: JournalTone } | null {
  switch (role) {
    case "police": {
      if (!("isMafia" in record) || typeof record.isMafia !== "boolean") return null;
      return record.isMafia ? { text: "마피아", tone: "bad" } : { text: "마피아 아님", tone: "ok" };
    }
    case "mafia": {
      if (!("died" in record) || typeof record.died !== "boolean") return null;
      return record.died ? { text: "사망", tone: "bad" } : { text: "생존", tone: "ok" };
    }
    case "doctor":
      return { text: "보호", tone: "heal" };
  }
}
