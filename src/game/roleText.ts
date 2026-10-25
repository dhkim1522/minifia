// 역할 이름·한 줄 설명·동료 줄 문구의 단일 출처. 주장 문장표(CLAIM_LINE·CLAIM_NONE_LINE·CLAIM_JOSA)도 이 파일 한 곳이다(D-04). 구성표·배정은 shared/game/roles.ts, 화면 문구는 여기(roles.ts 주석 4행).
import type { RoleId } from "../../shared/game/roles";
import type { Claim, RoomView } from "../../shared/protocol";

export const ROLE_TEXT: Readonly<Record<RoleId, { name: string; desc: string }>> = {
  mafia: { name: "마피아", desc: "밤에 함께 한 명을 지목해요" },
  police: { name: "경찰", desc: "밤마다 한 명을 조사해요" },
  doctor: { name: "의사", desc: "밤에 한 명을 살려요" },
  citizen: { name: "시민", desc: "대화와 투표로 마피아를 찾아요" },
};

/** 주장 채팅 줄 문장(D-04). 받침 판정 없이 직업별 고정 표다 */
export const CLAIM_LINE: Readonly<Record<RoleId, string>> = {
  mafia: "저는 마피아예요",
  police: "저는 경찰이에요",
  doctor: "저는 의사예요",
  citizen: "저는 시민이에요",
};

/** 아무 직업도 말하지 않은 차례의 줄 */
export const CLAIM_NONE_LINE = "말하지 않았어요";

/** `{직업}{조사} 말했어요` 꼴 문장에 붙는 인용 조사. 유저 기록 카드(03.1-08)가 쓴다 */
export const CLAIM_JOSA: Readonly<Record<RoleId, string>> = {
  mafia: "라고",
  police: "이라고",
  doctor: "라고",
  citizen: "이라고",
};

/** 주장의 화면 이름("말 안 함" 또는 역할 이름). 이름표·접근성 이름·하단 패널이 같은 글자를 쓰도록 이 한 곳에 둔다. */
export function claimName(job: Claim): string {
  return job === "none" ? "말 안 함" : ROLE_TEXT[job].name;
}

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
