import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import "../../styles/v2.css";
import "../../styles/tutorial.css";
import type { SoundView } from "../../audio/useSound";
import { useReducedMotion } from "../../net/useReducedMotion";
import { useHostMetrics } from "./HostBand";
import { SoundButton } from "./SoundButton";

// 첫 사건의 사회자 파형 + 자막 띠(17-04, 결정 0078-4·9 C, UI-SPEC "사회자 띠 · 목소리 계약"): 실제 자막 띠(HostBand)와 같은 자리·같은 모양(.mv-host__band)에
// 종 아이콘 대신 파형 막대 5개 + 한 줄(두 줄까지), 시간 행 없음. 같은 --mf-host-top/bottom/dock 변수를 갱신한다(useHostMetrics).
// 말하는 동안(speakMs = 글자 수에 따른 sayItems 의 totalMs) data-speaking 이 켜지고 막대가 움직인다. 소리가 꺼져 있어도 같은 시간 움직인다 — 소리만 없다(T-13).
// 새 문장(nonce)이 오면 글 드러남과 말하는 시간이 처음부터 다시 시작한다. 모션 줄이기면 말하는 동안 막대를 중간 높이(12)로 고정하고 글은 바로 보인다.
// 문장은 React 텍스트 노드로만 그린다. 소리 단추는 띠 독(.mv-host__dock)에 있고 전역 소리 설정을 따른다.

const BARS = 5;
/** shake 가 바뀐 뒤 띠가 흔들리는 시간(ms) — 17-05 가 오답에 쓴다 */
const SHAKE_MS = 400;

export interface TutorialHostBandProps {
  /** 지금 말하는 문장. null 이면 띠 면 없이 독만 있다(말 없는 장면) */
  line: string | null;
  /** 이 문장을 말하는 시간(ms). 0 이면 말하지 않는다 */
  speakMs: number;
  /** 문장이 새로 시작될 때마다 늘어나는 번호(같은 글이어도 다시 말한다) */
  nonce: number;
  /** 바뀔 때마다 띠가 0.4초 흔들린다(17-05 의 오답 연출) */
  shake?: number;
  /** 포커스 상자가 이 띠를 감싼다는 표시 — 상자는 FocusRing 이 띠 사각형을 재서 그리므로 이 부품은 아무것도 하지 않는다 */
  focus?: boolean;
  /** 소리를 지원하는 환경이면 독에 단추를 둔다 */
  sound?: SoundView | null;
}

export function TutorialHostBand({ line, speakMs, nonce, shake = 0, sound }: TutorialHostBandProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const bandRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    if (!(speakMs > 0)) {
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    const timer = setTimeout(() => setSpeaking(false), speakMs);
    return () => clearTimeout(timer);
  }, [nonce, speakMs]);

  const [shaking, setShaking] = useState(false);
  useEffect(() => {
    if (!(shake > 0)) return;
    setShaking(true);
    const timer = setTimeout(() => setShaking(false), SHAKE_MS);
    return () => clearTimeout(timer);
  }, [shake]);

  useHostMetrics(rootRef, bandRef, [line !== null, sound != null]);

  const lineStyle = speakMs > 0 ? ({ "--tut-say-ms": `${speakMs}ms` } as CSSProperties) : undefined;
  return (
    <div ref={rootRef} className="mv-host tut-host" data-host-band="" data-tutorial-host="" data-speaking={speaking ? "true" : undefined}>
      {line !== null ? (
        <div ref={bandRef} className={shaking ? "mv-host__band tut-band is-shake" : "mv-host__band tut-band"}>
          <span className={reduced ? "tut-wave is-reduced" : "tut-wave"} aria-hidden="true">
            {Array.from({ length: BARS }, (_, i) => (
              <i key={i} className="tut-wave__bar" />
            ))}
          </span>
          <p key={nonce} className="mv-host__line tut-band__line" data-host-line="" data-say={speakMs > 0 ? "" : undefined} style={lineStyle} role="status" aria-live="polite" aria-atomic="false">
            {line}
          </p>
        </div>
      ) : null}
      {sound ? (
        <div className="mv-host__dock">
          <SoundButton sound={sound} />
        </div>
      ) : null}
    </div>
  );
}
