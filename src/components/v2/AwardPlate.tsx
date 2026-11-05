import "../../styles/result.css";
import { awardAria, awardIcon, awardName, awardReason } from "../../game/awardText";
import type { AwardId, AwardLine } from "../../../shared/protocol";
import { V2Icon } from "./V2Icon";

// 칭호 패 (11-09, 결정 D-7·D-24, UI-SPEC B-3·G): 시상식에서 무대로 걸어 나온 사람의 칭호를 보여 준다.
// 구성: 놋쇠 테두리 + 아이콘 24 + 칭호 24px 700 + 이유 14px 한 줄 + 이름 점(자리 색)·닉네임. 마피아 칭호도 테두리는 놋쇠다(진홍은 마피아 승리 아이콘 전용).
// 닉네임·이유는 React 텍스트로만 그린다(T-11-31). 읽기 이름은 role=status(aria-live polite) 안의 숨은 문구 '{닉네임}, {칭호}, {이유}' 한 줄이다.
// 위치(스테이지 윗변 + 8)는 쓰는 쪽(ResultScreen)이 정한다 — 이 부품은 틀과 안쪽만 갖는다.
export interface AwardPlateProps {
  /** 닉네임(8자 이내) */
  name: string;
  /** 이름 점 색(자리 색 변수) */
  color: string;
  award: AwardId;
  k?: number;
  at?: AwardLine["at"];
  /** 폭(px). 없으면 CSS 의 min(328, 폭 − 32) */
  width?: number;
  /** 패를 눌렀다(시상식에서 다음 사람으로 넘긴다) */
  onTap?(): void;
}

export function AwardPlate({ name, color, award, k, at, width, onTap }: AwardPlateProps) {
  const line = { award, ...(k !== undefined ? { k } : {}), ...(at !== undefined ? { at } : {}) };
  return (
    <div
      className="mv-award"
      role="status"
      aria-live="polite"
      data-award-plate=""
      data-award-id={award}
      {...(width !== undefined ? { style: { width: `${width}px` } } : {})}
      {...(onTap ? { onClick: onTap } : {})}
    >
      <span className="mf-sr-only">{awardAria(name, line)}</span>
      <span className="mv-award__row" aria-hidden="true">
        <span className="mv-award__icon">
          <V2Icon name={awardIcon(award)} size={24} />
        </span>
        <span className="mv-award__title">{awardName(award)}</span>
      </span>
      <span className="mv-award__reason" aria-hidden="true">
        {awardReason(line)}
      </span>
      <span className="mv-award__name" aria-hidden="true">
        <i style={{ background: color }} />
        {name}
      </span>
    </div>
  );
}
