import { useEffect, useRef } from "react";
import "../../styles/v2.css";
import type { SoundView } from "../../audio/useSound";
import type { RoomView } from "../../../shared/protocol";
import { hostLineOf, hostTimeOf } from "../../game/hostLine";
import { timerTone, useCountdown } from "../../net/countdown";
import { SoundButton } from "./SoundButton";
import { V2Icon } from "./V2Icon";

// 사회자 자막 띠 (14-01, HOST-01·03, TOOL-02, UI-SPEC "자막 띠 계약"): 모든 방 화면 헤더 바로 아래 같은 자리·같은 모양의 한 줄.
// 1행: 종 + 문장(hostLineOf) + 남은 초 / 2행: 시간 막대. 시간이 있는 단계에서만 시간 행이 있다(hostTimeOf).
// 띠 아래 오른쪽 끝 독에 소리 단추가 있다(U-8) — 띠는 누를 수 없고(pointer-events none) 독의 단추만 받는다.
// 문장은 React 텍스트 노드로만 그린다(닉네임이 들어간다). DOM 표식은 값 없는 data-host-band·data-host-line·data-host-time 과 시간 톤(calm|warn|urgent)뿐이다 — 역할·좌석 값 없음(T-14-03).
// 초마다 다시 그리기는 HostTime 안에 가둔다(맵은 다시 그리지 않는다, T-14-05).

export interface HostBandProps {
  view: RoomView;
  /** 서버 시각 = 로컬 시각 + offset */
  offset: number;
  /** 역할 카드 앞면을 본 적이 있는가(클라이언트 상태) */
  cardSeen: boolean;
  /** 소리를 지원하는 환경이면 독에 단추를 둔다 */
  sound?: SoundView | null;
}

export function HostBand({ view, offset, cardSeen, sound }: HostBandProps) {
  const line = hostLineOf(view, { cardSeen });
  // 단계가 바뀐 렌더에서만 교체 연출(문장 페이드 + 종 흔들림). 첫 마운트·같은 단계 안 다시 그리기에는 하지 않는다.
  const prevPhase = useRef<string | null>(null);
  const swap = prevPhase.current !== null && prevPhase.current !== view.phase;
  useEffect(() => {
    prevPhase.current = view.phase;
  }, [view.phase]);

  const endsAt = view.phaseEndsAt;
  const durationMs = view.phaseDurationMs;
  return (
    <div className="mv-host" data-host-band="">
      <div className="mv-host__band">
        <span key={`bell-${view.phase}`} className={swap ? "mv-host__bell is-swap" : "mv-host__bell"}>
          <V2Icon name="bell" size={16} />
        </span>
        <p key={`line-${view.phase}`} className={swap ? "mv-host__line is-swap" : "mv-host__line"} data-host-line="" role="status" aria-live="polite" aria-atomic="false">
          {line}
        </p>
        {hostTimeOf(view) && endsAt !== null && durationMs !== null ? <HostTime endsAt={endsAt} durationMs={durationMs} offset={offset} /> : null}
      </div>
      {sound ? (
        <div className="mv-host__dock">
          <SoundButton sound={sound} />
        </div>
      ) : null}
    </div>
  );
}

/** 띠 없이 소리 단추만 있는 화면(쉬는 사람·연결 실패 안내)의 독. 띠와 같은 위치 규칙을 쓴다. */
export function HostDock({ sound }: { sound: SoundView }) {
  return (
    <div className="mv-host">
      <div className="mv-host__dock">
        <SoundButton sound={sound} />
      </div>
    </div>
  );
}

/** 남은 시간 "{n}초"(올림 초)와 막대. 한 훅 값에서 나온다. 마감이 지나도 서버 시계 기준으로 0 에 머문다. */
function HostTime({ endsAt, durationMs, offset }: { endsAt: number; durationMs: number; offset: number }) {
  const { seconds, remainingMs, ratio } = useCountdown(endsAt, durationMs, offset);
  const tone = timerTone(remainingMs, durationMs);
  return (
    <>
      <span className="mv-host__time" data-host-time="" data-tone={tone} role="timer" aria-label={`남은 시간 ${seconds}초`}>
        <b>{seconds}</b>
        <span>초</span>
      </span>
      <div className="mv-host__bar" aria-hidden="true">
        <i data-tone={tone} style={{ transform: `scaleX(${ratio})` }} />
      </div>
    </>
  );
}
