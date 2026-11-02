import type { ReactNode } from "react";
import type { ClientMessage, RoomView } from "../../shared/protocol";
import { PhaseHeader } from "../components/v2/PhaseHeader";
import { TopToast, useTopToast } from "../components/v2/TopToast";
import { WorldStage } from "../components/WorldStage";
import { LOG_H_SHORT } from "../game/chatUi";
import { headerFor } from "../game/dayView";
import type { ChatStore } from "../net/chatStore";
import { useChat } from "../net/useChat";
import type { WorldStore } from "../world/store";
import { GamePanel } from "./GamePanel";
import "../styles/game.css";
import "../styles/sheet.css";
import "../styles/testtools.css";

interface GameMapProps {
  view: RoomView;
  /** RoomScreen 이 연결과 같은 수명으로 만들어 world 프레임을 먹이는 위치 스토어 */
  store: WorldStore;
  /** RoomScreen 이 연결과 같은 수명으로 만들어 채팅 프레임을 먹이는 채팅 저장소 */
  chat: ChatStore;
  /** 보냈으면 true, 소켓이 닫혀 못 보냈으면 false. 반환값이 없는 함수(void)는 보낸 것으로 본다 */
  send: (msg: ClientMessage) => boolean | void;
  /** 연결이 열려 있어 서버로 보낼 수 있는가. 기본 true */
  canSend?: boolean;
  /** 소켓이 새로 열릴 때마다 바뀌는 번호. 기본 0 */
  epoch?: number;
  /** 서버시각 − 로컬시각(ms) */
  offset?: number;
  /** 재접속 띠가 떠 있는가 */
  bannerVisible?: boolean;
  /** 헤더 오른쪽의 [역할 카드] 버튼 */
  myRoleButton?: ReactNode;
  /** 테스트 방 방장의 [테스트] 버튼(결정 0022). 있으면 헤더 아래 왼쪽에 놓는다 */
  testButton?: ReactNode;
  /** 맵을 쓸 수 없는 기기의 불가 카드 [처음으로] */
  onLeave?: () => void;
}

// 8페이즈 게임 맵 화면 틀(08-13, UI-SPEC "게임 화면 틀"): 지하 재즈 바 맵(WorldStage) 위에 위쪽 가림막, 헤더(단계 이름 + 접히는 안내), [테스트], 아래 패널을 얹는다.
// 낮 시작·낮 토론·지목·최후 변론·찬반·처형이 이 화면 하나를 같은 장면 키로 그려 단계가 바뀌어도 맵이 다시 만들어지지 않는다.
// 화면은 서버가 보낸 view 만으로 다시 그린다. 닉네임(이름표)은 WorldStage 가 React 텍스트 노드로만 그린다.
export function GameMap({ view, store, chat, send, canSend = true, offset = 0, myRoleButton, testButton, onLeave }: GameMapProps) {
  const toast = useTopToast();
  const { typingSeats, ...binding } = useChat({ store: chat, connection: { send, canSend }, view });
  const header = headerFor(view);

  return (
    <main className="mf-root mf-game" data-game-stage="" data-phase={view.phase}>
      {/* DOM 순서 = Tab 순서: 헤더([역할 카드]) → 맵(이름표) → 아래 패널(입력). 층 순서는 z 가 정한다 */}
      <div className="mf-game__scrim" aria-hidden="true" />
      <header className="mf-game__header">
        <PhaseHeader title={header.title} {...(header.hint !== undefined ? { hint: header.hint } : {})} guide extra={myRoleButton} />
      </header>
      <WorldStage
        view={view}
        store={store}
        send={send}
        canSend={canSend}
        offset={offset}
        typingSeats={typingSeats}
        onNotice={(text) => toast.show(text)}
        onKick={() => {}}
        onLeave={() => onLeave?.()}
      />
      <TopToast {...toast.props} />
      {testButton ? <div className="mf-game__test">{testButton}</div> : null}
      <GamePanel view={view} send={send} canSend={canSend} binding={binding} logHeight={LOG_H_SHORT} />
    </main>
  );
}
