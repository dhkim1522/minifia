import type { ReactElement } from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";
import "../styles/rolecard.css";
import "../styles/sheet.css";

export interface RoleCardButtonProps {
  /** 안 읽은 일지가 있는가. 있으면 오른쪽 위에 점이 붙고 이름이 `역할 카드, 새 기록` 이 된다(텍스트 모양은 앰버, 아이콘 모양은 gray-100) */
  unread: boolean;
  onOpen: () => void;
  /** 글자 없는 44×44 아이콘 버튼(8페이즈 맵 화면 헤더, 시간 링 왼쪽, UI-SPEC A2). 기본은 글자가 있는 v1.0 모양 */
  iconOnly?: boolean;
}

// 헤더 오른쪽 슬롯의 유일한 버튼(결정 0026, UI-SPEC A). 모든 역할·모든 시점에 같은 마크업이고 점만 다르다.
// 점은 장식(aria-hidden)이라 새 기록 여부는 이름이 읽는다.
export function RoleCardButton({ unread, onOpen, iconOnly = false }: RoleCardButtonProps): ReactElement {
  const label = unread ? "역할 카드, 새 기록" : "역할 카드";
  if (iconOnly) {
    return (
      <Button
        variant="secondary"
        compact
        className="mf-rolecard-btn mf-rolecard-btn--icon mf-iconbtn"
        icon={<Icon name="card" size={22} />}
        aria-label={label}
        onClick={onOpen}
      >
        {unread ? <span className="mf-rolecard-btn__dot" aria-hidden="true" /> : null}
      </Button>
    );
  }
  return (
    <Button variant="secondary" compact className="mf-rolecard-btn" icon={<Icon name="card" size={20} />} aria-label={label} onClick={onOpen}>
      역할 카드
      {unread ? <span className="mf-rolecard-btn__dot" aria-hidden="true" /> : null}
    </Button>
  );
}
