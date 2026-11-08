import "../../styles/v2.css";
import { progressLabel } from "../../game/errandView";

// 심부름 진행 점(16페이즈 D-06, UI-SPEC V-23): 화면 아래 가운데 떠 있는 점 total 개, 끝낸 곳은 채움. 아래 패널은 없다.
// 보이는 "n/3" 글자는 없다 — role=group + aria-label + aria-live 로 알린다. 점은 포커스를 받지 않고 눌림을 통과한다.
// 마피아도 시민과 같은 마크업이다(V-25): 역할·좌석 prop 이 없고 속성 값은 숫자(진행 수)뿐이다(D-08).

export interface ErrandDotsProps {
  total: number;
  done: number;
}

export function ErrandDots({ total, done }: ErrandDotsProps) {
  if (total <= 0) return null;
  const n = Math.min(Math.max(done, 0), total);
  const label = progressLabel(n, total);
  return (
    <div className="mv-errand-dots" data-errand-dots="" data-errand-progress={`${n}/${total}`} role="group" aria-label={label} aria-live="polite">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className="mv-errand-dot" data-errand-dot={String(i + 1)} data-done={i < n ? "" : undefined} />
      ))}
    </div>
  );
}
