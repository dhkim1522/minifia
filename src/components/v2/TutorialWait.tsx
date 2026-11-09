import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RoomView } from "../../../shared/protocol";
import { TUTORIAL_MS } from "../../../shared/game/phases";
import { useCountdown } from "../../net/countdown";
import { V2Icon } from "./V2Icon";
import "../../styles/tutorialRoom.css";

// 함께 진행 기다림 화면(17-07, TUT-02, UI-SPEC "기다림 화면", 시안 Together): 먼저 끝낸 사람이 다른 사람을 기다린다.
// 값은 방 전체 공개 값 view.tutorial({ done, total, endsAt }) 뿐이다. 이 화면은 단계를 먼저 넘기지 않고 서버가 단계를 바꾸면 사라진다.
// 사람 원은 최대 8개, 6명 이상이면 두 줄로 접고 가운데 정렬한다. 팁 두 장은 카드 아래 남는 높이가 모자라면 통째로 숨긴다(스크롤 없음, T-17).

const MAX_DOTS = 8;
const TIP_H = 96;
const GAP = 24;
/** 루트 아래 안쪽 여백(.tut-wait padding-bottom) */
const ROOT_PAD_BOTTOM = 24;

const TIPS = [
  { icon: "eye", text: "심부름 때 누구를 봤는지 기억해요" },
  { icon: "thread", text: "아침 흔적은 옷과 이어져요" },
] as const;

export interface TutorialWaitProps {
  view: RoomView;
  /** 서버시각 − 로컬시각(ms) */
  offset: number;
}

export function TutorialWait({ view, offset }: TutorialWaitProps) {
  const t = view.tutorial;
  const total = t?.total ?? view.players.length;
  const done = Math.min(t?.done ?? 0, total);
  const { seconds, ratio } = useCountdown(t?.endsAt ?? view.phaseEndsAt ?? 0, TUTORIAL_MS, offset);

  const rootRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [tipsOn, setTipsOn] = useState(false);
  const measure = useCallback((): void => {
    const root = rootRef.current;
    const card = cardRef.current;
    if (root === null || card === null) return;
    const left = root.clientHeight - ROOT_PAD_BOTTOM - (card.offsetTop + card.offsetHeight);
    setTipsOn(left >= TIP_H + GAP);
  }, []);
  // 그리기 전에 한 번 재서 팁이 보였다 사라지는 깜빡임을 막는다. 사람 수가 바뀌면(원 줄 높이) 다시 잰다
  useLayoutEffect(measure, [measure, total]);
  useEffect(() => {
    window.addEventListener("resize", measure);
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    if (ro !== null && rootRef.current !== null && cardRef.current !== null) {
      ro.observe(rootRef.current);
      ro.observe(cardRef.current);
    }
    return () => {
      window.removeEventListener("resize", measure);
      ro?.disconnect();
    };
  }, [measure]);

  const dots = Math.min(total, MAX_DOTS);
  // 원이 8개를 넘으면 끝낸 수도 같은 비율로 줄여 그린다(8 이하에서는 그대로)
  const dotsDone = total <= MAX_DOTS ? done : Math.round((done / total) * MAX_DOTS);

  return (
    <main ref={rootRef} className="tut-wait" data-tutorial-wait="">
      <h1 className="tut-wait__title">곧 진짜 사건이 시작돼요</h1>
      <div ref={cardRef} className="tut-wait__card" data-tutorial-card="">
        <span className="tut-wait__check" aria-hidden="true">
          <V2Icon name="check" size={32} />
        </span>
        <p className="tut-wait__msg">다른 사람을 기다리는 중…</p>
        <div className={dots >= 6 ? "tut-wait__people is-two-rows" : "tut-wait__people"} data-tutorial-people="" role="img" aria-label={`${total}명 중 ${done}명 끝냄`}>
          {Array.from({ length: dots }, (_, i) => (
            <span key={i} className={i < dotsDone ? "tut-wait__dot is-done" : "tut-wait__dot"}>
              {i < dotsDone ? <V2Icon name="check" size={20} /> : null}
            </span>
          ))}
        </div>
        <p className="tut-wait__count" data-tutorial-count={`${done}/${total}`}>
          {done} / {total}
        </p>
        <div className="tut-wait__time">
          <div className="tut-wait__track" aria-hidden="true">
            <div className="tut-wait__fill" data-tutorial-bar="" style={{ width: `${Math.round(ratio * 100)}%` }} />
          </div>
          <span className="tut-wait__sec" role="timer" aria-label={`남은 시간 ${seconds}초`}>
            {seconds}초
          </span>
        </div>
      </div>
      {tipsOn ? (
        <div className="tut-wait__tips">
          {TIPS.map((tip) => (
            <div key={tip.icon} className="tut-wait__tip" data-tutorial-tip="">
              <V2Icon name={tip.icon} size={24} />
              <span>{tip.text}</span>
            </div>
          ))}
        </div>
      ) : null}
    </main>
  );
}
