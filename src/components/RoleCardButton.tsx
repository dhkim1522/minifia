import type { ReactElement } from "react";
import { Icon } from "./Icon";
import "../styles/rolecard.css";
import "../styles/sheet.css";

export interface RoleCardButtonProps {
  /** 안 읽은 일지가 있는가. 있으면 아이콘 면 오른쪽 위에 점이 붙고 이름이 `내 역할, 새 기록` 이 된다 */
  unread: boolean;
  onOpen: () => void;
  /** 14-05 이전 두 모양(글자판·아이콘판)의 구분. 이제 모양은 하나라 받기만 하고 쓰지 않는다 */
  iconOnly?: boolean;
}

// 헤더 오른쪽 슬롯의 유일한 버튼(결정 0026, UI-SPEC A·TOOL-01 목록 6). 14페이즈: 두 모양을 "아이콘(면 36) 아래 한 단어 '내 역할'" 하나로 통일한다.
// 모든 역할·모든 시점에 같은 마크업이고 점만 다르다. 점은 장식(aria-hidden)이라 새 기록 여부는 이름이 읽는다 — 이름은 보이는 글자로 시작한다.
export function RoleCardButton({ unread, onOpen }: RoleCardButtonProps): ReactElement {
  const label = unread ? "내 역할, 새 기록" : "내 역할";
  return (
    <button type="button" className="mf-btn mf-rolecard-btn" aria-label={label} data-tool-label="내 역할" onClick={onOpen}>
      <span className="mf-rolecard-btn__face">
        <Icon name="card" size={22} />
        {unread ? <span className="mf-rolecard-btn__dot" aria-hidden="true" /> : null}
      </span>
      <span className="mf-rolecard-btn__label">내 역할</span>
    </button>
  );
}
