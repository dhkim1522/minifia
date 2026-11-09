import { useEffect, useRef } from "react";
import { getEngine } from "../audio/unlock";
import { hush, say } from "../audio/voice";
import { TUTORIAL_LINES, TUTORIAL_SCENES } from "../game/tutorialScript";
import type { TutorialCue, TutorialFocusWindow, TutorialLineKey, TutorialSceneNo } from "../game/tutorialScript";

// 첫 사건의 장면 시각표 예약 훅(17-04, 결정 0078-7): 장면 표(TUTORIAL_SCENES)가 정한 시각에 효과음·사회자 문장(웅얼 목소리)·포커스 창 켜짐·꺼짐·[다음] 등장·자동 넘김을 부른다.
// 소리는 앱의 엔진(getEngine)에 직접 낸다 — 켬·끔·잠김은 엔진이 따르고, 소리가 꺼져 있어도 말하는 시간(say 의 반환값)은 같아 막대·글이 같은 시간 움직인다(T-13).
// 장면이 바뀌거나 언마운트되면 예약을 전부 취소하고 남은 음절을 끊는다(hush). 시각은 장면 시계 시작(startAt, 로컬 ms)에서 잰다 — 무대 장면은 WorldStage 준비 뒤에 시계를 세운다(UI Considerations #5).
// 이 훅은 화면 상태를 모른다: 부르는 쪽이 콜백으로 받아 상태를 바꾼다. 콜백은 최신 것을 ref 로 읽는다(예약은 장면마다 한 번만 건다).

export interface TutorialDirectorOptions {
  scene: TutorialSceneNo;
  /** 장면 시계의 시작(로컬 ms). null 이면 시계가 아직 서지 않았다 — 아무것도 예약하지 않는다 */
  startAt: number | null;
  /** 사회자가 말하기 시작할 때(문구 키, 말하는 시간 ms) */
  onSay?(key: TutorialLineKey, totalMs: number): void;
  /** 효과음 큐가 불릴 때 */
  onCue?(id: TutorialCue): void;
  /** 장면의 [다음] 이 나타날 때 */
  onShowNext?(): void;
  /** 장면이 자동으로 넘어갈 때 */
  onAuto?(): void;
  /** 포커스 창이 켜지거나 꺼질 때 */
  onFocus?(target: TutorialFocusWindow["target"], on: boolean): void;
}

/** 장면 표 밖에서(정답·오답에 반응해) 효과음 큐 하나를 낸다 — 켬·끔·잠김은 엔진이 따른다. 화면(screens)은 엔진의 play 를 직접 부르지 않으므로(소리 호출 자리 규칙) 여기를 거친다 */
export function playTutorialCue(id: TutorialCue): void {
  getEngine().play(id);
}

/** 장면 표 밖에서 사회자가 한 문장을 말한다 — 새 문장이 이전 음절 예약을 끊는다(say 가 처리). 말하는 시간(ms)을 돌려준다 */
export function sayTutorialLine(key: TutorialLineKey): number {
  return say(getEngine(), TUTORIAL_LINES[key]);
}

export function useTutorialDirector(options: TutorialDirectorOptions): void {
  const live = useRef(options);
  live.current = options;
  const { scene, startAt } = options;

  useEffect(() => {
    if (startAt === null) return;
    const def = TUTORIAL_SCENES.find((s) => s.n === scene);
    if (def === undefined) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    // 시각이 이미 지났거나 지금이면 바로 부른다(장면 시작 0ms 의 큐·포커스)
    const at = (ms: number, fn: () => void): void => {
      const wait = ms - (Date.now() - startAt);
      if (wait <= 0) fn();
      else timers.push(setTimeout(fn, wait));
    };

    for (const b of def.beats) {
      at(b.at, () => {
        if (b.sfx !== undefined) {
          getEngine().play(b.sfx);
          live.current.onCue?.(b.sfx);
        }
        if (b.say !== undefined) live.current.onSay?.(b.say, say(getEngine(), TUTORIAL_LINES[b.say]));
      });
    }
    for (const w of def.focus) {
      at(w.from, () => live.current.onFocus?.(w.target, true));
      if (w.to !== undefined) at(w.to, () => live.current.onFocus?.(w.target, false));
    }
    if (def.advance.kind === "next") at(def.advance.showAtMs, () => live.current.onShowNext?.());
    if (def.advance.kind === "auto") at(def.advance.afterMs, () => live.current.onAuto?.());

    return () => {
      for (const t of timers) clearTimeout(t);
      hush(getEngine());
    };
  }, [scene, startAt]);
}
