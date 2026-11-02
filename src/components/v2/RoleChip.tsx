import "../../styles/v2.css";
import type { RoleId } from "../../../shared/game/roles";
import { ROLE_TEXT } from "../../game/roleText";
import { V2Icon, type V2IconName } from "./V2Icon";

// 직업 칩(RoleChip). design/v2.0/design-system/components/bundle.js 의 RoleChip 과 bundle.css 113-114 를 React 19 로 옮겼다(승인 2026-10-31).
// 머리 위 이름표 위에 작은 원(28) 안의 직업 아이콘을 띄운다. 마피아만 진홍 테두리·페도라(.is-mafia), 나머지는 gray-300 테두리.
//
// 유령 화면 분기에서만 만든다 — 산 사람 DOM 에 두지 않는다(결정 0021·UI-SPEC 산 사람 쪽 규칙).
// 이 부품은 신분을 판단하지 않는다: 부르는 쪽(유령 분기·마피아 동료·결과 화면)이 role 을 넘긴다(T-08-16).
// 접근성 이름은 ROLE_TEXT 의 역할 이름이고 문자열은 React 노드·속성으로만 그린다(innerHTML 없음, T-08-09).

const ROLE_ICON: Readonly<Record<RoleId, V2IconName>> = {
  mafia: "roleMafia",
  police: "rolePolice",
  doctor: "roleDoctor",
  citizen: "roleCitizen",
};

export interface RoleChipProps {
  role: RoleId;
}

export function RoleChip({ role }: RoleChipProps) {
  const cls = ["mv-rolechip", role === "mafia" && "is-mafia"].filter(Boolean).join(" ");
  return (
    <span className={cls} role="img" aria-label={ROLE_TEXT[role].name} data-role-chip={role}>
      <V2Icon name={ROLE_ICON[role]} size={18} />
    </span>
  );
}
