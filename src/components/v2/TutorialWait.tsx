import type { RoomView } from "../../../shared/protocol";
import "../../styles/tutorialRoom.css";

// 함께 진행 기다림 화면(17-07, TUT-02, UI-SPEC "기다림 화면"): 먼저 끝낸 사람이 다른 사람을 기다린다.
// 값은 서버 공개 값 view.tutorial 뿐이고 이 화면이 먼저 단계를 넘기지 않는다.

export interface TutorialWaitProps {
  view: RoomView;
  /** 서버시각 − 로컬시각(ms) */
  offset: number;
}

export function TutorialWait({ view }: TutorialWaitProps) {
  const t = view.tutorial;
  const done = t?.done ?? 0;
  const total = t?.total ?? view.players.length;
  return (
    <main className="tut-wait" data-tutorial-wait="">
      <h1 className="tut-wait__title">곧 진짜 사건이 시작돼요</h1>
      <div className="tut-wait__card">
        <p className="tut-wait__msg">다른 사람을 기다리는 중…</p>
        <p className="tut-wait__count" data-tutorial-count={`${done}/${total}`}>
          {done} / {total}
        </p>
      </div>
    </main>
  );
}
