import type { ReactElement } from "react";
import type { Claim } from "../../shared/protocol";
import { ROLE_TEXT } from "../game/roleText";
import "../styles/seat.css";

// 이름표 아래 주장 알약. 받은 값을 그리기만 한다 — job 은 공개된 주장이지 그 사람의 실제 직업이 아니다(거짓일 수 있다).
// "말 바꿈" 은 바꿔 말했다는 사실만 작게 보이는 표시다. 진홍이나 경고 색을 쓰지 않는다(D-06, D-08).
export interface ClaimTagProps {
  job: Claim;
  changed: boolean;
}

/** 주장의 화면 이름. 공개 말풍선·접근성 이름과 같은 글자를 쓰도록 한 곳에 둔다. */
export function claimName(job: Claim): string {
  return job === "none" ? "말 안 함" : ROLE_TEXT[job].name;
}

export function ClaimTag({ job, changed }: ClaimTagProps): ReactElement {
  return (
    <span className="mf-tag__claim">
      <b>{claimName(job)}</b>
      {changed ? <span className="mf-tag__changed">· 말 바꿈</span> : null}
    </span>
  );
}
