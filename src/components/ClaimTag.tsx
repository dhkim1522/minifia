import type { ReactElement } from "react";
import type { Claim } from "../../shared/protocol";
import { claimName } from "../game/roleText";
import "../styles/seat.css";

// 이름표 아래 주장 알약. 받은 값을 그리기만 한다 — job 은 공개된 주장이지 그 사람의 실제 직업이 아니다(거짓일 수 있다).
// "말 바꿈" 은 바꿔 말했다는 사실만 작게 보이는 표시다. 진홍이나 경고 색을 쓰지 않는다(D-06, D-08).
export interface ClaimTagProps {
  job: Claim;
  changed: boolean;
}

// 주장 이름의 단일 출처는 game/roleText.ts 다. 지금 이 경로로 가져오는 화면이 컴파일되게 다시 내보내 둔다(이 파일은 02-16 이 지운다).
export { claimName } from "../game/roleText";

export function ClaimTag({ job, changed }: ClaimTagProps): ReactElement {
  return (
    <span className="mf-tag__claim">
      <b>{claimName(job)}</b>
      {changed ? <span className="mf-tag__changed">· 말 바꿈</span> : null}
    </span>
  );
}
