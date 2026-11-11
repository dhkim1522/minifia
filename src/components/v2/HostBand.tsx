import { useEffect, useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";
import "../../styles/v2.css";
import type { SoundView } from "../../audio/useSound";
import type { RoomView } from "../../../shared/protocol";
import { hostBandModeOf, hostLineOf, hostTimeOf, type HostLocal } from "../../game/hostLine";
import { timerTone, useCountdown } from "../../net/countdown";
import { SoundButton } from "./SoundButton";

// 사회자 자막 띠 (14-01, HOST-01·03, TOOL-02, UI-SPEC "자막 띠 계약"): 모든 방 화면 헤더 바로 아래 같은 자리·같은 모양의 한 줄.
// 1행: 문장(hostLineOf — 할 일 한 구절) + 남은 초 / 2행: 시간 막대. 종 아이콘은 없다(18.1-12, 결정 0083-8). 시간이 있는 단계에서만 시간 행이 있다(hostTimeOf).
// 띠 아래 오른쪽 끝 독에 소리 단추가 있다(U-8) — 띠는 누를 수 없고(pointer-events none) 독의 단추만 받는다.
// 문장은 React 텍스트 노드로만 그린다. DOM 표식은 값 없는 data-host-band·data-host-line(= data-guide, 화면당 하나의 "지금 할 일" 표식, 14-02)·data-host-time 과 시간 톤(calm|warn|urgent)뿐이다 — 역할·좌석 값 없음(T-14-03).
// 초마다 다시 그리기는 HostTime 안에 가둔다(맵은 다시 그리지 않는다, T-14-05).

export interface HostBandProps {
  view: RoomView;
  /** 서버 시각 = 로컬 시각 + offset */
  offset: number;
  /** 역할 카드 앞면을 본 적이 있는가(클라이언트 상태) */
  cardSeen: boolean;
  /** 클라이언트 상태(15-07·18.1-12): 목격 기록을 열었는가·아침 흔적 구간인가·심부름 시작 카드가 떠 있는가. 맵 화면이 알린다. 없으면 모두 거짓 */
  local?: Pick<HostLocal, "recordOpened" | "traceOn" | "startCard">;
  /** 소리를 지원하는 환경이면 독에 단추를 둔다 */
  sound?: SoundView | null;
}

/** 화면 헤더(방 틀 본문의 첫 것): 로비·게임 맵·결과의 absolute 헤더, 역할 확인의 absolute 헤더, 배정 바 */
const HEADER_SELECTOR = ".mf-lobby__header, .mf-game__header, .mf-result__header, .mf-reveal__header, .mf-phasebar, .mf-assign__bar";
const HOST_VARS = ["--mf-host-top", "--mf-host-bottom", "--mf-host-dock"] as const;

/** 방 틀에 값이 다를 때만 쓴다. 값이 없으면(헤더 없음·측정 0) 지워서 CSS 기본값(옛 자리 70·62·80)으로 돌아간다 */
function setVar(room: HTMLElement, name: string, px: number | null): void {
  if (px === null || !(px > 0)) {
    if (room.style.getPropertyValue(name) !== "") room.style.removeProperty(name);
    return;
  }
  const value = `${Math.round(px * 10) / 10}px`;
  if (room.style.getPropertyValue(name) !== value) room.style.setProperty(name, value);
}

/**
 * 띠 아래로 밀려나는 자리의 기준을 잰다(U-1·U-6·U-8): 헤더 아랫변 + 8 → --mf-host-top, 띠 면 아랫변 → --mf-host-bottom, 독 아랫변 → --mf-host-dock.
 * 값은 방 틀 위 끝 기준이고 가상 뷰포트 이동(--mf-vv-top)을 뺀 값이라 키보드가 열려도 변하지 않는다.
 * 헤더 단추가 헤더 높이를 넘으면(14-05·14-07 이름표) 그 아랫변을 쓴다 — 띠가 단추를 덮지 않게.
 * 17-04: 첫 사건 화면의 파형 띠(TutorialHostBand)가 같은 변수를 쓰려고 export 한다(동작 그대로).
 */
export function useHostMetrics(rootRef: RefObject<HTMLDivElement | null>, bandRef: RefObject<HTMLDivElement | null>, deps: readonly unknown[]): void {
  useLayoutEffect(() => {
    const root = rootRef.current;
    const band = bandRef.current;
    const room = root?.closest<HTMLElement>(".mf-room") ?? null;
    if (root === null || room === null) return;
    const measure = (): void => {
      const roomTop = room.getBoundingClientRect().top;
      const vv = Number.parseFloat(getComputedStyle(room).getPropertyValue("--mf-vv-top")) || 0;
      const rel = (bottom: number): number => bottom - roomTop - vv;
      const header = room.querySelector<HTMLElement>(HEADER_SELECTOR);
      let headerBottom = 0;
      if (header !== null) {
        headerBottom = header.getBoundingClientRect().bottom;
        for (const button of header.querySelectorAll("button")) headerBottom = Math.max(headerBottom, button.getBoundingClientRect().bottom);
        headerBottom = rel(headerBottom);
      }
      setVar(room, "--mf-host-top", headerBottom > 0 ? headerBottom + 8 : null);
      // 위 값을 쓴 뒤에 잰다(getBoundingClientRect 가 레이아웃을 새로 계산한다)
      const dock = root.querySelector<HTMLElement>(".mv-host__dock");
      const bandBottom = band === null ? 0 : rel(band.getBoundingClientRect().bottom);
      setVar(room, "--mf-host-bottom", bandBottom);
      setVar(room, "--mf-host-dock", dock === null ? bandBottom : Math.max(bandBottom, rel(dock.getBoundingClientRect().bottom)));
    };
    measure();
    const header = room.querySelector<HTMLElement>(HEADER_SELECTOR);
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
    } else {
      observer = new ResizeObserver(measure);
      observer.observe(room);
      observer.observe(root);
      if (band !== null) observer.observe(band);
      if (header !== null) observer.observe(header);
    }
    return () => {
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps 는 호출자가 정한다(단계·문장·시간 행·소리 독이 바뀔 때 다시 잰다)
  }, deps);
  // 띠가 사라지면(쉬는 사람·화면 이동) 변수를 지워 CSS 기본값으로 돌린다
  useLayoutEffect(() => {
    const room = rootRef.current?.closest<HTMLElement>(".mf-room") ?? null;
    return () => {
      if (room !== null) for (const name of HOST_VARS) room.style.removeProperty(name);
    };
  }, [rootRef]);
}

export function HostBand({ view, offset, cardSeen, local, sound }: HostBandProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const bandRef = useRef<HTMLDivElement>(null);
  const line = hostLineOf(view, { cardSeen, ...(local ?? {}) });
  const showTime = hostTimeOf(view);
  // 세 상태(18.1-12): show = 문장 + 초·막대, blank = 초·막대만(큰 글·시작 카드가 말한다), off = 면을 보이지 않게(자리는 그대로)
  const mode = hostBandModeOf(view, line);
  useHostMetrics(rootRef, bandRef, [view.phase, line, mode, showTime, sound != null]);
  // 단계가 바뀐 렌더에서만 교체 연출(문장 페이드). 첫 마운트·같은 단계 안 다시 그리기에는 하지 않는다.
  const prevPhase = useRef<string | null>(null);
  const swap = prevPhase.current !== null && prevPhase.current !== view.phase;
  useEffect(() => {
    prevPhase.current = view.phase;
  }, [view.phase]);

  const endsAt = view.phaseEndsAt;
  const durationMs = view.phaseDurationMs;
  return (
    <div ref={rootRef} className="mv-host" data-host-band="">
      <div ref={bandRef} className={mode === "off" ? "mv-host__band is-off" : "mv-host__band"} {...(mode === "off" ? { "aria-hidden": true } : {})}>
        <p key={`line-${view.phase}`} className={swap ? "mv-host__line is-swap" : "mv-host__line"} data-host-line="" data-guide="" role="status" aria-live="polite" aria-atomic="false">
          {line}
        </p>
        {showTime && endsAt !== null && durationMs !== null ? <HostTime endsAt={endsAt} durationMs={durationMs} offset={offset} /> : null}
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
