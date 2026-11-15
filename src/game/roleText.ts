// 역할 이름·카드 문구 한 문장(18.1 P181-0. 2026-11-12 사용자 요청으로 첫 문장(정체 선언)과 줄바꿈 제거 — 할 일 한 문장만 남긴다)·동료 줄 문구의 단일 출처. 구성표·배정은 shared/game/roles.ts, 화면 문구는 여기(roles.ts 주석 4행).
import type { RoleId } from "../../shared/game/roles";
import { modeOf, rulesetOf } from "../../shared/game/ruleset";
import type { RoomView } from "../../shared/protocol";

export const ROLE_TEXT: Readonly<Record<RoleId, { name: string; desc: string }>> = {
  mafia: { name: "마피아", desc: "몰래 암살하여 승리하세요." },
  police: { name: "경찰", desc: "의심되는 사람을 조사하세요." },
  doctor: { name: "의사", desc: "시민 팀을 마피아에게서 지키세요." },
  citizen: { name: "시민", desc: "추리로 마피아를 찾아내세요." },
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

/**
 * 마피아 본인 역할 카드의 한 줄 안내(21페이즈 P21-7): 원인 흐름 판에서 내 역할이 마피아일 때만. 길게 누르기 조작은 모든 역할이 같이 가지고 있어
 * 이 안내가 유일한 차이다 — 서버가 본인에게만 보낸 me.role 로 고르는 본인 카드 안에만 있고 다른 역할 카드·화면 어디에도 없다.
 */
export function roleHintOf(view: RoomView): string | null {
  return view.me.role === "mafia" && rulesetOf(modeOf(view)).cause ? CAUSE_MAFIA_HINT : null;
}

const CAUSE_MAFIA_HINT = "길게 누르면 심지를 잘라요";
