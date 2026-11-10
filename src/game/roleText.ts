// 역할 이름·카드 문구 한 덩어리(18.1 P181-0: 첫 문장 뒤 \n, 화면은 white-space: pre-line)·동료 줄 문구의 단일 출처. 구성표·배정은 shared/game/roles.ts, 화면 문구는 여기(roles.ts 주석 4행).
import type { RoleId } from "../../shared/game/roles";
import type { RoomView } from "../../shared/protocol";

export const ROLE_TEXT: Readonly<Record<RoleId, { name: string; desc: string }>> = {
  mafia: { name: "마피아", desc: "당신은 마피아입니다.\n몰래 암살하여 승리하세요." },
  police: { name: "경찰", desc: "당신은 경찰입니다.\n의심되는 사람을 조사하세요." },
  doctor: { name: "의사", desc: "당신은 의사입니다.\n시민 팀을 마피아에게서 지키세요." },
  citizen: { name: "시민", desc: "당신은 시민입니다.\n추리로 마피아를 찾아내세요." },
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
