import { useEffect, useRef, useState } from "react";
import type { RoomView } from "../../shared/protocol";
import { pointsTally } from "../game/dayView";
import "../styles/night.css";

export interface SceneCurtainProps {
  view: RoomView;
  /** 서버시각 − 로컬시각(ms) */
  offset: number;
  reducedMotion: boolean;
  /** 이 시각(Date.now 기준)까지는 다음 단계 view 가 와도 막을 걷지 않는다(피해자 연출, NIGHT-11) */
  holdUntil?: number;
}

// 장면 전환 막(09-20, UI-SPEC 143·214~220·256행, E8 #41): night-950 한 장이 화면을 덮어 낮 → 밤·밤 → 아침의 위치 되돌림·조명 전환·분필 설치를 가린다.
// 덮기 시작은 **공개 마감만의 함수**다: phaseEndsAt − offset(서버 시계 보정) − 420ms. 누가 죽을지·경찰 결과 같은 비공개 정보는 읽지 않으므로 모든 역할이 같은 시각에 덮는다(결정 0061-4, 연구 Pitfall 8, T-09-43).
// 걷기는 다음 단계(밤·아침) view 가 온 뒤 800ms. 재접속 첫 view 는 막 없이 시작한다(UI-SPEC 212행). 모션 줄이기면 마감 시각에 즉시 덮고 다음 view 에서 즉시 사라진다(UI-SPEC 446행).
// 표식은 `data-curtain="true"` 이고 막이 없으면 요소 자체가 없다. 입력을 가로채지 않고 보조기기에는 숨긴다.

/** 덮기 시작은 마감보다 이만큼 앞선다(dur-med) */
export const CURTAIN_COVER_MS = 420;
/** 걷는 시간(dur-slow) */
export const CURTAIN_LIFT_MS = 800;

type Mode = "none" | "covering" | "covered" | "lifting";

/**
 * 이 view 의 단계가 끝나면 막이 필요한가: 처형·밤은 언제나(다음이 밤·아침).
 * 지목(09.1)은 끝 알림 단계(day.turn.i === order.length)이고 공개 집계에 단독 선두가 없을 때만(다음이 밤) — 차례 중·모이는 중에는 차례 마감이 와도 덮지 않는다.
 * 그 밖의 단계는 맵이 그대로 이어진다. 공개 정보(day.turn·day.points)만 읽는다.
 */
export function coversNext(view: RoomView): boolean {
  if (view.phase === "execution" || view.phase === "night") return true;
  if (view.phase === "nomination") {
    const turn = view.day?.turn;
    return turn !== undefined && turn.i >= turn.order.length && pointsTally(view).leader === undefined;
  }
  return false;
}

export function SceneCurtain({ view, offset, reducedMotion, holdUntil }: SceneCurtainProps) {
  const [mode, setMode] = useState<Mode>("none");
  /** 같은 렌더에서 효과가 읽는 현재 모드(상태는 비동기라 거울로 둔다) */
  const modeRef = useRef<Mode>("none");
  /** 걷기 대기 중(피해자 연출로 holdUntil 까지 진한 채 둔다). 이 동안 아침 알림이 막 위에 뜨게 하는 표식 */
  const [held, setHeld] = useState(false);
  /** 지금 덮기 예약이 걸린 단계. 다른 단계 view 가 오면 막을 걷는다 */
  const armed = useRef<RoomView["phase"] | null>(null);
  const coverTimers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const liftTimers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const holdRef = useRef(holdUntil);
  holdRef.current = holdUntil;
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;

  const put = (m: Mode): void => {
    modeRef.current = m;
    setMode(m);
  };
  const clearCover = (): void => {
    for (const id of coverTimers.current) clearTimeout(id);
    coverTimers.current = [];
  };
  const clearLift = (): void => {
    for (const id of liftTimers.current) clearTimeout(id);
    liftTimers.current = [];
  };

  // 막을 걷는다: 모션 줄이기면 즉시 없앤다. 아니면 holdUntil 이 지난 뒤 800ms 동안 걷고 사라진다
  const lift = (): void => {
    clearCover();
    clearLift();
    if (modeRef.current === "none") return;
    if (reducedRef.current) {
      setHeld(false);
      put("none");
      return;
    }
    const wait = Math.max(0, (holdRef.current ?? 0) - Date.now());
    const start = (): void => {
      setHeld(false);
      put("lifting");
      liftTimers.current.push(setTimeout(() => put("none"), CURTAIN_LIFT_MS));
    };
    if (wait === 0) {
      start();
      return;
    }
    setHeld(true);
    liftTimers.current.push(setTimeout(start, wait));
  };

  useEffect(() => {
    const phase = view.phase;
    // 다른 단계로 넘어왔다 = 막 뒤에서 일어난 전환의 결과 view. 덮여 있었다면 걷는다
    if (armed.current !== null && armed.current !== phase) {
      armed.current = null;
      lift();
    }
    if (!coversNext(view) || view.phaseEndsAt === null) {
      // 이 view 로는 막이 필요 없다(같은 단계에서 단독 선두가 생김 등): 아직 안 덮였으면 예약을 지우고, 덮였으면 걷는다
      if (armed.current === phase) {
        armed.current = null;
        if (modeRef.current === "covering" || modeRef.current === "covered") lift();
        else clearCover();
      }
      return;
    }
    // 이미 덮는 중·덮인 같은 단계면 그대로 둔다. 아니면 마감 기준으로 (다시) 예약한다 — 서버 마감이 바뀌어도 따라간다
    if (armed.current === phase && (modeRef.current === "covering" || modeRef.current === "covered")) return;
    armed.current = phase;
    clearCover();
    const endsIn = view.phaseEndsAt - offset - Date.now();
    const cover = (): void => {
      clearLift();
      setHeld(false);
      put("covering");
    };
    if (reducedRef.current) {
      // 모션 줄이기: 미리 덮지 않고 마감 시각에 즉시 덮는다
      coverTimers.current.push(
        setTimeout(() => {
          clearLift();
          setHeld(false);
          put("covered");
        }, Math.max(0, endsIn)),
      );
      return;
    }
    coverTimers.current.push(setTimeout(cover, Math.max(0, endsIn - CURTAIN_COVER_MS)));
    coverTimers.current.push(
      setTimeout(() => {
        // 마감: 불투명 100%
        if (modeRef.current === "covering") put("covered");
      }, Math.max(0, endsIn)),
    );
    // view 의 정체가 바뀔 때마다 다시 본다(lift 등은 ref 와 setState 만 쓴다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, offset]);

  // 언마운트 때 모든 타이머를 푼다
  useEffect(
    () => () => {
      for (const id of coverTimers.current) clearTimeout(id);
      for (const id of liftTimers.current) clearTimeout(id);
    },
    [],
  );

  if (mode === "none") return null;
  const cls = mode === "covering" ? "is-covering" : mode === "covered" ? "is-covered" : "is-lifting";
  return <div className={`mf-curtain ${cls}${held ? " is-held" : ""}`} data-curtain="true" aria-hidden="true" />;
}
