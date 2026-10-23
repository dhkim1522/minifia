// 역할 이름·한 줄 설명·동료 줄 문구의 단일 출처. 구성표·배정은 shared/game/roles.ts, 화면 문구는 여기(roles.ts 주석 4행).
import type { RoleId } from "../../shared/game/roles";

export const ROLE_TEXT: Readonly<Record<RoleId, { name: string; desc: string }>> = {
  mafia: { name: "마피아", desc: "밤에 함께 한 명을 지목해요" },
  police: { name: "경찰", desc: "밤마다 한 명을 조사해요" },
  doctor: { name: "의사", desc: "밤에 한 명을 살려요" },
  citizen: { name: "시민", desc: "대화와 투표로 마피아를 찾아요" },
};

/** 마피아 동료 줄. 동료가 없으면 "혼자예요". */
export function alliesText(names: readonly string[]): string {
  return names.length === 0 ? "혼자예요" : `동료 · ${names.join(", ")}`;
}
