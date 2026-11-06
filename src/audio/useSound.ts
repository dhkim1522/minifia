// 12-07: 방 화면이 쥐는 소리 훅 — 엔진 구독, 제스처 resume, 탭 가시성, 시험 훅 (D-9, B-2, B-3, T-12-24).
// 엔진은 DOM 을 듣지 않는다(engine.ts 머리말). 이 훅이 방 화면이 마운트된 동안만 문서 이벤트를 연결하고, 언마운트하면 모두 푼다.
// 확장 지점: 12-08 이후 감독은 UseSoundOptions 에 항목을 더하거나 같은 엔진(getEngine)을 받아 쓴다.
import { useEffect, useSyncExternalStore } from "react";
import type { SoundEngine } from "./engine";
import { installSoundHook } from "./testHook";
import { getEngine } from "./unlock";

/** 단추가 그리는 상태: 켜짐(소리 남) · 꺼짐 · 잠김(켜 둔 채 오디오가 깨어 있지 않음) */
export type SoundUiState = "on" | "off" | "locked";

export interface SoundView {
  /** 오디오 컨텍스트를 만들 수 없는 환경이면 거짓 — 단추를 그리지 않는다 */
  supported: boolean;
  state: SoundUiState;
  engine: SoundEngine;
}

export interface UseSoundOptions {
  /** 시험이 주입하는 엔진(기본: 앱 싱글턴) */
  engine?: SoundEngine;
  /** 방 화면이 보이는 동안만 참(기본). 거짓이면 문서 이벤트를 걸지 않는다 */
  active?: boolean;
  /** window.__mfSound 를 만들지(?e2e=1·개발 빌드 판정은 부르는 쪽이 한다) */
  hook?: boolean;
}

/** 깨우는 제스처. 눌림 시작 이벤트는 쓰지 않는다 — iOS 가 인정하지 않는 경우가 있다 */
const GESTURES = ["pointerup", "touchend", "keydown"] as const;

export function useSound(options: UseSoundOptions = {}): SoundView {
  const engine = options.engine ?? getEngine();
  const active = options.active ?? true;
  const hook = options.hook ?? false;
  const snap = useSyncExternalStore(engine.subscribe, engine.snapshot, engine.snapshot);

  useEffect(() => {
    if (hook) installSoundHook(engine, true);
  }, [engine, hook]);

  useEffect(() => {
    if (!active) return;
    const onGesture = (e: Event): void => {
      // 소리 단추 자신의 누르기는 단추가 처리한다(켜자마자 다시 꺼지지 않게)
      const t = e.target;
      if (t instanceof Element && t.closest("[data-sound-button]") !== null) return;
      if (!engine.isOn() || engine.state() === "running") return;
      engine.unlock();
    };
    const onVisibility = (): void => {
      if (document.visibilityState === "hidden") engine.hidden();
      else void engine.visible();
    };
    for (const type of GESTURES) document.addEventListener(type, onGesture);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      for (const type of GESTURES) document.removeEventListener(type, onGesture);
      document.removeEventListener("visibilitychange", onVisibility);
      // 방을 떠나면 침대·예약 대본을 멈춘다
      engine.stopAll();
    };
  }, [engine, active]);

  const state: SoundUiState = !snap.on ? "off" : snap.state === "running" ? "on" : "locked";
  return { supported: snap.supported, state, engine };
}
