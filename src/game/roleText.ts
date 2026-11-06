// 역할 이름·한 줄 설명·목표 한 줄(14페이즈 TOOL-03)·동료 줄 문구의 단일 출처. 구성표·배정은 shared/game/roles.ts, 화면 문구는 여기(roles.ts 주석 4행).
import type { RoleId } from "../../shared/game/roles";
import type { RoomView } from "../../shared/protocol";

export const ROLE_TEXT: Readonly<Record<RoleId, { name: string; desc: string; goal: string }>> = {
  mafia: { name: "마피아", desc: "밤에 함께 한 명을 지목해요", goal: "밤마다 한 명을 없애 시민 편과 수가 같아지면 승리합니다." },
  police: { name: "경찰", desc: "밤마다 한 명을 조사해요", goal: "밤마다 한 명을 조사해 마피아를 찾아내세요." },
  doctor: { name: "의사", desc: "밤에 한 명을 살려요", goal: "밤마다 한 명을 지켜 마피아의 암살을 막으세요." },
  citizen: { name: "시민", desc: "대화와 투표로 마피아를 찾아요", goal: "대화와 투표로 마피아를 모두 처형하면 승리합니다." },
};

/** 마피아 동료 줄. 동료가 없으면 "혼자예요". */
export function alliesText(names: readonly string[]): string {
  return names.length === 0 ? "혼자예요" : `동료 · ${names.join(", ")}`;
}

/**
 * 마피아 본인 화면의 동료 닉네임. 서버가 마피아에게만 보낸 me.allies 의 자리 번호로 players 에서 찾는다.
 * 마피아가 아니면(또는 역할이 없으면) null — 동료 줄 자체가 없다. 마피아인데 동료가 없으면 [] ("혼자예요").
 */
export function allyNicknames(view: RoomView): string[] | null {
  if (view.me.role !== "mafia") return null;
  return (view.me.allies ?? []).flatMap((seat) => {
    const p = view.players.find((q) => q.seat === seat);
    return p ? [p.nickname] : [];
  });
}
