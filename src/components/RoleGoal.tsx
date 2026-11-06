// 역할 목표 한 줄(14페이즈 TOOL-03, D-05). 호출하는 쪽이 자기 역할의 ROLE_TEXT[role].goal 하나만 넘긴다 —
// 이 부품은 다른 역할의 문장을 모르고 모으지도 않는다(HOST-05, T-14-14). 카드 앞면·[내 역할] 시트 앞면에서만 쓴다.
export function RoleGoal({ goal }: { goal: string }) {
  return (
    <div className="mf-goal" data-role-goal="">
      <span className="mf-goal__chip">목표</span>
      <span className="mf-goal__text">{goal}</span>
    </div>
  );
}
