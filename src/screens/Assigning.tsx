import type { RoomView } from "../../shared/protocol";
import { Backdrop } from "../components/Backdrop";
import { Icon } from "../components/Icon";
import "../styles/phase.css";

// S-04 역할 배정(약 3초, 서버 단계). 입력도 [내 역할] 도 없고 모든 사람에게 같은 마크업이다(D-12, T-01-44):
// view.me.role·me.allies 는 읽지 않는다.
// 테이블 상자는 08-19 에 뺐다 — 사용자 확정(2026-11-02) 임시 처리(UI-SPEC A1 과 같음), 다듬기는 뒤 페이즈.
// 어두운 막·맥박 링·안내 문구는 화면 전체 위에 얹힌다.
export function Assigning({ view }: { view: RoomView }) {
  return (
    <Backdrop layout="game" scene="lobby" className="mf-assign__backdrop">
      <main className="mf-root mf-assign">
        <header className="mf-assign__bar">
          <h1 className="mf-t-heading">역할 배정</h1>
        </header>
        <div className="mf-assign__panel" />
        <div className="mf-assign__veil" aria-hidden="true" />
        <div className="mf-assign__center">
          <div className="mf-assign__pulse" aria-hidden="true">
            <span className="mf-assign__ring" />
            <span className="mf-assign__ring" />
            <span className="mf-assign__ring" />
            <div className="mf-assign__core">
              <Icon name="card" size={32} />
            </div>
          </div>
          <h2 className="mf-t-heading" data-guide="">
            직업을 배정하고 있습니다…
          </h2>
          <p className="mf-t-label">잠시만 기다려 주세요</p>
        </div>
      </main>
    </Backdrop>
  );
}
