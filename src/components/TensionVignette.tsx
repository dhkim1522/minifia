import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { startTension, TENSION_BEAT_MS, TENSION_CUE_PEAK, TENSION_REDUCED_OPACITY } from "../world/tension";
import "../styles/night.css";

// 시민 편 긴장 비네트 (NIGHT-10, 결정 0061-15, 누설 불변식 L3).
// 밤 산 시민·경찰·의사 화면의 가장자리에 진홍 맥박을 그린다. 세 역할이 똑같이 본다.
// 시작·강도·큐 시각은 이 부품이 마운트될 때 로컬 스케줄러(startTension)가 자기 난수로 정한다 — 서버가 보낸 시각·프레임·마피아 움직임을 받지 않는다.
// 그래서 이 파일은 연결·스토어·프로토콜 모듈을 불러오지 않고 props 에도 서버 값이 없다(정적 검사 시험이 고정한다).
// 마운트될 때 시작하고 언마운트될 때 멈춘다. 모션 줄이기면 맥박·큐 없이 고정 불투명도로만 보인다.

export interface TensionVignetteProps {
  /** 모션 줄이기 설정. 켜져 있으면 맥박과 큐를 모두 끄고 고정 불투명도를 쓴다 */
  reducedMotion: boolean;
  /** 큐가 울린 로컬 시각(마운트 기준 ms). 12페이즈 소리와 E2E 기록이 얹는 자리 */
  onCue?: (atMs: number) => void;
}

export function TensionVignette({ reducedMotion, onCue }: TensionVignetteProps) {
  const [cue, setCue] = useState(false);
  // 부르는 쪽이 렌더마다 새 함수를 줘도 스케줄러를 다시 시작하지 않는다
  const onCueRef = useRef(onCue);
  useEffect(() => {
    onCueRef.current = onCue;
  });

  useEffect(() => {
    let off: ReturnType<typeof setTimeout> | undefined;
    const handle = startTension({
      reducedMotion,
      onCue: (at) => {
        setCue(true);
        clearTimeout(off);
        // 강한 맥박 한 번 + 약한 한 번 = 맥박 한 바퀴
        off = setTimeout(() => setCue(false), TENSION_BEAT_MS);
        onCueRef.current?.(at);
      },
    });
    return () => {
      handle.stop();
      clearTimeout(off);
      setCue(false);
    };
  }, [reducedMotion]);

  const className = reducedMotion ? "mf-tension is-reduced" : cue ? "mf-tension is-beat is-cue" : "mf-tension is-beat";
  return (
    <div
      className={className}
      data-tension-pulse="true"
      aria-hidden="true"
      style={reducedMotion ? { opacity: TENSION_REDUCED_OPACITY } : ({ "--mf-tension-peak": TENSION_CUE_PEAK } as CSSProperties)}
    />
  );
}
