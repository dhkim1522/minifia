// 원인 흐름 아침의 큰 글 발표 구간(21페이즈 D-02·P21-20): 밤 → 아침으로 들어온 렌더에서 시작해, 큰 글(결과 알림)이 떴다가 사라질 때까지 true 다.
// 이 동안 사회자 띠는 빈 줄이고 단서 지점 층은 그려지지 않으며, 사라지면 지점이 --dur-med 로 나타난다. 지점을 일찍 그려 큰 글과 겹치지 않게 하는 화면 연출일 뿐이고 서버 시계(30초, D-03)와 무관하다.
//   wait = 아침에 막 들어왔고 큰 글은 아직 안 떴다(지연 0.4~2.6초 — dayView 의 ANNOUNCE_*_AT). WAIT_MS 가 지나도 안 뜨면 발표는 없던 것으로 본다(알림을 받지 못한 화면).
//   on   = 큰 글이 떠 있다. 사라지면 done. 재접속·새로 고침으로 처음부터 아침인 화면은 밤에서 오지 않았으므로 idle 이라 곧바로 지점이 보인다(발표를 놓쳤다).
// 역할을 읽지 않는다(단계와 알림 유무뿐). 렌더 중 상태 갱신은 "이전 값 기억" 방식이라 단계가 바뀐 그 렌더에서 한 프레임도 틈이 없다.
import { useEffect, useState } from "react";
import { modeOf, rulesetOf } from "../../shared/game/ruleset";
import type { PhaseId, RoomView } from "../../shared/protocol";

/** 큰 글이 가장 늦게 뜨는 시각(경찰 결과 카드 뒤 ANNOUNCE_POLICE_AT 2.6초)보다 조금 더 기다린다(ms) */
export const ANNOUNCE_WAIT_MS = 3_200;

type Stage = "idle" | "wait" | "on" | "done";

/** 지금이 아침 큰 글 발표 구간인가. announcing 은 큰 글이 화면에 떠 있는가(결과 알림 글자가 있는가) */
export function useMorningAnnouncing(view: RoomView, announcing: boolean): boolean {
  const morning = view.phase === "morning" && rulesetOf(modeOf(view)).cause;
  const [prevPhase, setPrevPhase] = useState<PhaseId>(view.phase);
  const [stage, setStage] = useState<Stage>("idle");
  if (prevPhase !== view.phase) {
    setPrevPhase(view.phase);
    setStage(morning && prevPhase === "night" ? "wait" : "idle");
  }
  useEffect(() => {
    if (stage === "wait" && announcing) setStage("on");
    else if (stage === "on" && !announcing) setStage("done");
  }, [stage, announcing]);
  useEffect(() => {
    if (stage !== "wait") return;
    const timer = setTimeout(() => setStage((s) => (s === "wait" ? "done" : s)), ANNOUNCE_WAIT_MS);
    return () => clearTimeout(timer);
  }, [stage]);
  return morning && (stage === "wait" || stage === "on");
}
