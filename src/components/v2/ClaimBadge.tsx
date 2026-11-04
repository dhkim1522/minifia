import "../../styles/v2.css";
import type { BadgeId } from "../../../shared/protocol";
import { BADGE_TEXT, claimLabel } from "../../game/badgeView";
import { V2Icon } from "./V2Icon";
import type { V2IconName } from "./V2Icon";

// 이름표 모서리 직업 주장 배지 (09.1.1-08, UI-SPEC A-1). 표시 전용 — 포인터 이벤트가 없고 눌리지 않는다.
// 모양: 지름 20 원, 면 overlay-ink-strong, 테두리 1.5px gray-100, 안에 직업 아이콘 14(gray-100). 어떤 직업도 진홍을 쓰지 않는다(마피아 주장도 같다).
// 말 안 함(직업을 말했다가 되돌린 사람)은 quiet 아이콘 + 점선 테두리. 말 바꿈이면 오른쪽 아래에 지름 16 점(swap 아이콘).
// 표식은 `data-claim`·`data-claim-changed` 뿐이다 — `data-role-chip` 은 유령 화면의 실제 역할 칩(RoleChip)만 쓴다(L10·L23).
// 이 부품은 이름표(.mv-tag, position: relative) 안에 놓인다. 앵커(.mv-claim-anchor)가 이름표 전체를 덮고 포인터를 받지 않는다.
// 팝(pop)은 부르는 쪽이 key 를 바꿔 다시 마운트시킬 때 한 번 돈다. 글자 알약(notice)은 장식이라 스크린리더에는 읽히지 않는다 — live 한 줄이 따로 알린다.

/** 주장 값 → 아이콘. 칩·떠 있는 버튼도 같은 표를 쓴다 */
export const CLAIM_ICON: Readonly<Record<BadgeId, V2IconName>> = {
  citizen: "roleCitizen",
  police: "rolePolice",
  doctor: "roleDoctor",
  mafia: "roleMafia",
  none: "quiet",
};

export interface ClaimBadgeProps {
  claim: BadgeId;
  /** 말 바꿈 점 */
  swapped?: boolean;
  /** 마운트 때 한 번 팝 */
  pop?: boolean;
  /** 바꾼 순간의 "말 바꿈" 글자 알약 */
  notice?: boolean;
}

export function ClaimBadge({ claim, swapped = false, pop = false, notice = false }: ClaimBadgeProps) {
  const cls = ["mv-claim", claim === "none" && "is-quiet", pop && "is-pop"].filter(Boolean).join(" ");
  return (
    <span className="mv-claim-anchor">
      <span className={cls} role="img" aria-label={claimLabel(claim, swapped)} data-claim={claim} data-claim-changed={swapped ? "true" : undefined}>
        <V2Icon name={CLAIM_ICON[claim]} size={14} />
        {swapped ? (
          <span className="mv-claim__swap">
            <V2Icon name="swap" size={12} />
          </span>
        ) : null}
      </span>
      {notice ? (
        <span className="mv-claim__notice" aria-hidden="true">
          {BADGE_TEXT.swapNotice}
        </span>
      ) : null}
    </span>
  );
}
