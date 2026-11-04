import "../../styles/v2.css";

// 인원·진행 숫자 '현재 / 최대'(feedback-13, 결정 0062 가 0051-4 의 점 표기를 바꾼다).
// 글자 모양은 .mv-count 가 정한다(16px 700, 숫자 폭 고정, 놓인 자리의 글자색).
export interface HeadCountProps {
  count: number;
  total: number;
  /** 읽어 주는 이름. 예: "투표한 사람". 없으면 "3/8" */
  label?: string;
}

export function HeadCount({ count, total, label }: HeadCountProps) {
  return (
    <span className="mv-count" role="img" aria-label={label ?? `${count}/${total}`}>
      {`${count} / ${total}`}
    </span>
  );
}
