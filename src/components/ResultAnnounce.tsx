import "../styles/game.css";
import type { AnnounceIcon } from "../game/dayView";
import { V2Icon } from "./v2/V2Icon";

export interface ResultAnnounceProps {
  /** 지금 띄울 알림 글자. 없으면(null) 아무것도 그리지 않는다 */
  text: string | null;
  /** 글자 위 아이콘(56). 없으면 글자만. target 은 피해자 있음(진홍 글자색), heal·ghost 는 gray-300 */
  icon?: AnnounceIcon;
  /** 편지와 함께 나타날 때는 위쪽의 작은 상태 줄로 표시한다. */
  withLetter?: boolean;
  /** 세부 내용 위에 표시하는 발표 제목. 생략하면 text가 단독 발표가 된다. */
  label?: string;
  /** 재접속 첫 화면: 등장 모션 없이 남은 시간만 보인다(is-still) */
  still?: boolean;
  /** 중앙 단계 카드 안에서 결과 내용을 그린다. */
  embedded?: boolean;
}

// 결과 알림(8페이즈, UI-SPEC "결과 알림"): 뒤 맵을 어둡게 하는 모든 단계 공용 틀이다.
// 한 줄을 넘으면 두 줄로 감기고(word-break keep-all) 글자를 줄이지 않는다(E6 #31). 9페이즈(09-18)부터 글자 위에 아이콘 56 을 둘 수 있다(밤·아침 알림).
// 한 번에 하나다 — 새 알림은 이전 것을 바꾼다(부르는 쪽 useDayFx 가 하나의 알림만 넘기고, key 가 글자라 바뀔 때 등장 모션이 다시 돈다).
// 결과가 없으면 요소 자체를 만들지 않는다. 글자는 React 텍스트 노드로만 그린다(닉네임이 들어가므로 HTML 로 읽히지 않는다, T-08-33).
// 아이콘은 장식(aria-hidden)이라 읽는 글자는 그대로 하나다. 알림은 입력을 가로채지 않는다(맵 탭·이름표 버튼이 그대로 눌린다).
// 23-07: label 이 있으면 글자 위에 한 줄 라벨을 둔다(정답 공개 "정답"). 읽는 글은 role=status 안에서 "정답 {키워드}" 하나다 — 둘 사이 공백 텍스트가 읽기 이음새다.
export function ResultAnnounce({ text, icon, withLetter, label, still, embedded }: ResultAnnounceProps) {
  if (text === null) return null;
  const cls = ["mf-announce", embedded ? "is-embedded" : "", label !== undefined ? "has-label" : "", withLetter ? "is-top is-with-letter" : "", still === true ? "is-still" : ""].filter(Boolean).join(" ");
  return (
    <div className={cls} data-announce="" role={embedded ? undefined : "status"}>
      <div key={label === undefined ? text : `${label}\n${text}`} className="mf-announce__body">
        {icon !== undefined && <V2Icon name={icon} size={withLetter ? 18 : 56} className={icon === "target" ? "mf-announce__icon is-death" : "mf-announce__icon"} />}
        {label !== undefined && (
          <>
            <span className="mf-announce__label" data-announce-label="">
              {label}
            </span>{" "}
          </>
        )}
        <span className="mf-announce__text">{text}</span>
      </div>
    </div>
  );
}
