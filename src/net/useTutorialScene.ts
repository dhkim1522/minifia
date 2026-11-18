// 혼자 하기의 시각표와 로컬 입력. 장면을 떠날 때 예약을 지우고, 현재 장면의 입력만 받는다.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClientMessage } from "../../shared/protocol";
import { autoAct, makeTutorialSend, reactTo, TUTORIAL_SCENES } from "../game/tutorialScript";
import type { TutorialAction, TutorialSceneId } from "../game/tutorialScript";

interface Cursor {
  index: number;
  startedAt: number;
  beatIndex: number;
  beatAt: number;
  ringOpen: boolean;
  acted: number;
  action: { at: number; steps: number } | null;
}

function start(index: number): Cursor {
  const now = Date.now();
  return { index, startedAt: now, beatIndex: 0, beatAt: now, ringOpen: false, acted: 0, action: null };
}

export function useTutorialScene(clickSuspect: () => void) {
  const [cursor, setCursor] = useState(() => start(0));
  const live = useRef(cursor);
  const scene = TUTORIAL_SCENES[cursor.index]!;
  const beat = scene.beats[cursor.beatIndex]!;

  const update = useCallback((previous: Cursor, next: Cursor) => {
    if (live.current !== previous) return;
    live.current = next;
    setCursor(next);
  }, []);

  const go = useCallback((id: TutorialSceneId) => {
    const index = TUTORIAL_SCENES.findIndex((entry) => entry.id === id);
    if (index >= 0) update(live.current, start(index));
  }, [update]);

  const perform = useCallback((from: Cursor, action: TutorialAction) => {
    if (!from.ringOpen || from.action !== null) return;
    const current = TUTORIAL_SCENES[from.index]!;
    const now = Date.now();
    if (action.next !== null) {
      const beatIndex = current.beats.findIndex((entry) => entry.id === action.next);
      update(from, { ...from, beatIndex, beatAt: now, ringOpen: false, acted: action.steps, action: null });
      return;
    }
    update(from, { ...from, ringOpen: false, acted: 1, action: { at: now, steps: action.steps } });
  }, [update]);

  const readAction = useCallback((message?: ClientMessage) => {
    const from = live.current;
    const current = TUTORIAL_SCENES[from.index]!;
    const currentBeat = current.beats[from.beatIndex]!.id;
    const action = message === undefined ? autoAct(current.id, currentBeat) : reactTo(current.id, currentBeat, message);
    if (action !== null) perform(from, action);
  }, [perform]);

  // 부품의 로컬 조작도 실제 에러/서버 프레임 없이 같은 대본으로 들어온다.
  const sendMessage = useMemo(() => makeTutorialSend({
      onAnswer: (answer, final) => readAction({ t: "answer", text: answer, final }),
      onEndDiscussion: (on) => readAction({ t: "endDiscussion", on }),
      onVerdict: (agree) => readAction({ t: "verdict", agree }),
      onPoint: (target) => readAction({ t: "point", target }),
      onPick: (target) => readAction({ t: "pick", target }),
      onSuspect: (target) => readAction({ t: "suspect", target }),
  }), [readAction]);

  const openSuspect = useCallback(() => {
    const from = live.current;
    const current = TUTORIAL_SCENES[from.index]!;
    const action = autoAct(current.id, current.beats[from.beatIndex]!.id);
    if (action?.target === "suspect-btn") perform(from, action);
  }, [perform]);

  useEffect(() => {
    if (scene.id === "end") return;
    const goNext = () => update(cursor, start(cursor.index + 1));
    const nextBeat = scene.beats[cursor.beatIndex + 1];
    const enterBeat = (at: number) => () => update(cursor, { ...cursor, beatIndex: cursor.beatIndex + 1, beatAt: at, ringOpen: false });
    const action = cursor.action;
    let at: number;
    let run: () => void;
    if (action !== null) {
      if (cursor.acted < action.steps) {
        at = action.at + cursor.acted * (scene.stepMs ?? 0);
        run = () => update(cursor, { ...cursor, acted: cursor.acted + 1 });
      } else {
        at = action.at + (action.steps - 1) * (scene.stepMs ?? 0) + (scene.tailMs ?? 0);
        run = goNext;
      }
    } else if (nextBeat?.at != null) {
      at = cursor.startedAt + nextBeat.at;
      run = enterBeat(at);
    } else if (beat.holdMs !== undefined) {
      at = cursor.beatAt + beat.holdMs;
      run = nextBeat ? enterBeat(at) : goNext;
    } else if (scene.kind === "watch") {
      at = cursor.startedAt + scene.ms;
      run = goNext;
    } else {
      const expected = autoAct(scene.id, beat.id);
      if (expected === null) return;
      const opensAt = Math.max(cursor.startedAt + (scene.ringAtMs ?? 0), cursor.beatAt);
      if (!cursor.ringOpen) {
        at = opensAt;
        run = () => update(cursor, { ...cursor, ringOpen: true });
      } else {
        at = opensAt + (scene.autoActMs ?? 0);
        run = () => {
          if (expected.target === "suspect-btn") clickSuspect();
          perform(cursor, expected);
        };
      }
    }

    const timer = setTimeout(run, Math.max(0, at - Date.now()));
    return () => clearTimeout(timer);
  }, [beat, clickSuspect, cursor, perform, scene, update]);

  const target = cursor.ringOpen ? autoAct(scene.id, beat.id)?.target ?? null : null;
  return { cursor, scene, beat, target, send: sendMessage, openSuspect, go };
}
