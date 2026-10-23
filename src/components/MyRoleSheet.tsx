import type { RoomView } from "../../shared/protocol";
import { ROLE_TEXT, alliesText, allyNicknames } from "../game/roleText";
import { roleArtSrc } from "../net/assets";
import { Diamond } from "./RoleCard";
import { Sheet } from "./Sheet";
import "../styles/phase.css";

export interface MyRoleSheetProps {
  view: RoomView;
  /** true 면 카드 뒷면만 보인다(역할 확인 단계에서 앞면을 본 적이 없는 사람). 역할 글자·그림을 아예 그리지 않는다 */
  showBack: boolean;
  onClose: () => void;
}

// C-01 [내 역할] 시트. 열림 상태는 RoomScreen 이 쥐므로 단계가 바뀌어도 열린 채다(Pitfall 19 ⑧).
// 앞면 내용은 서버가 본인에게만 보낸 me.role 에서만 만든다(T-01-45). 조사 기록·소리 켜기는 3·5페이즈 몫이다.
export function MyRoleSheet({ view, showBack, onClose }: MyRoleSheetProps) {
  const role = view.me.role ?? null;

  return (
    <Sheet label="내 역할" onClose={onClose} showClose>
      <h2 className="mf-t-heading mf-sheet__title">내 역할</h2>
      {role === null ? (
        <p className="mf-myrole-sheet__empty">아직 역할이 없어요</p>
      ) : showBack ? (
        <div className="mf-myrole-sheet__back" aria-hidden="true">
          <Diamond />
        </div>
      ) : (
        <Front view={view} role={role} />
      )}
    </Sheet>
  );
}

function Front({ view, role }: { view: RoomView; role: NonNullable<RoomView["me"]["role"]> }) {
  const { src, srcSet } = roleArtSrc(role);
  const text = ROLE_TEXT[role];
  const allies = allyNicknames(view);
  return (
    <div className="mf-myrole-sheet">
      <img className="mf-myrole-sheet__art" src={src} srcSet={srcSet} width={150} alt="" draggable={false} />
      <div className="mf-myrole-sheet__text">
        <h3 className="mf-t-heading">{text.name}</h3>
        <p className="mf-myrole-sheet__desc">{text.desc}</p>
        {allies !== null ? <p className="mf-myrole-sheet__mates">{alliesText(allies)}</p> : null}
      </div>
    </div>
  );
}
