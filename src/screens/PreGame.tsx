import type { ComponentProps, ReactNode } from "react";
import type { RoomView } from "../../shared/protocol";
import { WorldStage } from "../components/WorldStage";
import type { WorldStore } from "../world/store";
import "../styles/phase.css";

export interface PreGameProps {
  view: RoomView;
  store: WorldStore;
  send: ComponentProps<typeof WorldStage>["send"];
  /** 연결 상태. 무대에는 넘기지 않고(무대는 늘 canSend false) 이 틀의 호출 모양을 Lobby·GameMap 과 맞추기 위해 받는다 */
  canSend: boolean;
  /** 서버시각 − 로컬시각(ms) */
  offset: number;
  onLeave(): void;
  /** 역할 배정(Assigning) 또는 역할 확인(RoleReveal) */
  children: ReactNode;
}

// 역할 배정·역할 확인 화면이 함께 쓰는 3D 무대 틀(feedback-3).
// 승인 보드 design/v2.0/screens/Role.dc.html: 3D 재즈 바 + 어두운 막 — v2.0 배경은 그림 파일이 아니라 3D 맵이다.
// 두 단계가 같은 장면 키(RoomScreen sceneKey "preGame")라 이 틀과 무대는 단계 사이에 다시 만들어지지 않는다.
// 무대는 꾸밈이다: aria-hidden, 걷기 없음, 이동·행동을 보내지 않는다(canSend false).
// scene·tagProps·pick·onKick 을 넘기지 않으므로 로비 모드(이름표만)이고 직업 칩·고리가 생기지 않는다(결정 0021, T-09-55).
// 맵을 못 여는 기기의 안내 카드는 무대 층 안에 있고, 내용 층이 그 위에 있어 카드 조작을 막지 않는다(T-09-56).
export function PreGame({ view, store, send, offset, onLeave, children }: PreGameProps) {
  return (
    <div className="mf-pregame">
      <div className="mf-pregame__stage" aria-hidden="true">
        <WorldStage view={view} store={store} send={send} canSend={false} offset={offset} canWalk={false} onNotice={() => {}} onLeave={onLeave} />
      </div>
      <div className="mf-pregame__content">{children}</div>
    </div>
  );
}
