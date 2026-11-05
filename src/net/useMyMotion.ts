// 내 캐릭터의 걷는 중(moving)·내 동작 재생 중(emoting)을 정하는 훅 (10-05, D-10).
// 동작 판의 칸 비활성 규칙이 읽는다: 서버는 걷는 중·앞 동작 진행 중의 emote 를 조용히 버리므로(10-01) 화면이 스스로 비활성을 정한다.
// - moving: 내 좌석의 서버 구간이 있고 segmentEndsAt(seg) > serverNow(). 구간 끝 시각에 타이머를 걸어 다시 그린다.
// - emoting: 저장소 onEmote 로 받은 내 좌석 프레임의 id 가 EMOTE_MS[id] 동안 참. 내 이동이 시작되면 바로 null.
// 시각은 부르는 쪽이 serverNow()(Date.now() + offset)로 넘긴다. 이 훅은 알림·문구를 만들지 않는다(L30).
import { useEffect, useRef, useState } from "react";
import { EMOTE_MS } from "../../shared/game/emote";
import { segmentEndsAt, type Segment } from "../../shared/game/world";
import type { EmoteFrame, EmoteId } from "../../shared/protocol";

/** WorldStore 중 이 훅이 읽는 부분 */
export interface MotionStore {
  segOf(seat: number): Segment | undefined;
  subscribe(cb: () => void): () => void;
  onEmote(cb: (frame: EmoteFrame) => void): () => void;
}

export interface MyMotion {
  moving: boolean;
  emoting: EmoteId | null;
}

function isMoving(store: MotionStore, seat: number, now: number): boolean {
  const seg = store.segOf(seat);
  return seg !== undefined && segmentEndsAt(seg) > now;
}

export function useMyMotion(store: MotionStore, mySeat: number, serverNow: () => number): MyMotion {
  const [, setTick] = useState(0);
  const [emoting, setEmoting] = useState<EmoteId | null>(null);
  const nowRef = useRef(serverNow);
  nowRef.current = serverNow;

  // 구간 변화 구독 + 구간 끝 타이머. 타이머가 일찍 깨어 아직 걷는 중이면 다시 건다.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      const seg = store.segOf(mySeat);
      if (seg === undefined) return;
      const left = segmentEndsAt(seg) - nowRef.current();
      if (left <= 0) return;
      timer = setTimeout(() => {
        timer = undefined;
        setTick((n) => n + 1);
        arm();
      }, left);
    };
    const onChange = () => {
      if (isMoving(store, mySeat, nowRef.current())) setEmoting(null);
      setTick((n) => n + 1);
      arm();
    };
    const off = store.subscribe(onChange);
    arm();
    setTick((n) => n + 1);
    return () => {
      off();
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [store, mySeat]);

  // 내 동작 프레임 구독 + 동작 끝 타이머
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = store.onEmote((frame) => {
      if (frame.seat !== mySeat) return;
      if (timer !== undefined) clearTimeout(timer);
      setEmoting(frame.id);
      timer = setTimeout(() => {
        timer = undefined;
        setEmoting(null);
      }, EMOTE_MS[frame.id]);
    });
    return () => {
      off();
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [store, mySeat]);

  const moving = isMoving(store, mySeat, serverNow());
  return { moving, emoting: moving ? null : emoting };
}
