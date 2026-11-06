// 12-07: 방 화면이 쥐는 소리 훅 — 엔진 구독, 제스처 resume, 탭 가시성, 시험 훅 (D-9, B-2, B-3, T-12-24).
// 엔진은 DOM 을 듣지 않는다(engine.ts 머리말). 이 훅이 방 화면이 마운트된 동안만 문서 이벤트를 연결하고, 언마운트하면 모두 푼다.
// 12-08: view 가 바뀔 때마다 공개 view 의 차이(AudioView)를 감독(director)에 넣고 출력을 같은 엔진(getEngine)에 적용한다.
// 이 훅은 RoomView 를 직접 읽지 않는다 — audioViewOf(audioView.ts)만 읽고, 감독은 AudioView 만 안다 (LS-6).
import { useEffect, useRef, useSyncExternalStore } from "react";
import { audioViewOf, type AudioView } from "./audioView";
import { direct, directSignal, type DirectOutput } from "./director";
import type { SoundEngine } from "./engine";
import { bindSignals } from "./signals";
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
  /** 방 화면의 서버 view (연결 전이면 null). 이 훅은 audioViewOf 로 허용 필드만 읽는다 */
  view?: Parameters<typeof audioViewOf>[0] | null;
  /** 연결 번호: 바뀐 렌더는 첫 스냅샷처럼 침대만 낸다 (LS-10) */
  epoch?: number;
  /** 서버 시각 − 로컬 시각 (connection.offset) */
  offset?: number;
  /** 로컬 시계(기본 Date.now). 시험이 엔진 시계를 넣는다 */
  now?: () => number;
  /** 각자 폰의 난수(기본 Math.random) — 밤 큐 시각. 시험은 시드 난수를 넣는다 (12-09) */
  random?: () => number;
  /**
   * 시각 맥박(TensionVignette)이 밤 큐를 내고 있는가 — RoomScreen 이 nightDarkOf(view) && !reducedMotion 으로 계산한 불리언 하나(12-09, D-11).
   * 참이면 소리는 시각 큐 신호(tensionCue)에 맞추고, 거짓이면 소리 전용 스케줄러가 같은 규칙으로 낸다. 역할 값은 이 훅에 오지 않는다.
   */
  visualCues?: boolean;
}

/** 깨우는 제스처. 눌림 시작 이벤트는 쓰지 않는다 — iOS 가 인정하지 않는 경우가 있다 */
const GESTURES = ["pointerup", "touchend", "keydown"] as const;

/** 감독 출력을 엔진에 적용한다 */
function apply(engine: SoundEngine, out: DirectOutput): void {
  for (const key of out.cancel) engine.cancelScript(key);
  if ("bed" in out) engine.setBed(out.bed ?? null);
  for (const call of out.now) engine.play(call.id, { gainDb: call.gainDb, cents: call.cents });
  for (const run of out.scripts) engine.runScript(run.key, run.items, run.duck);
  if (out.duck !== null) engine.duckBed(out.duck.db, Math.max(0, out.duck.toMs - out.duck.fromMs), out.duck.returnMs);
}

interface Directed {
  av: AudioView;
  epoch: number;
}

export function useSound(options: UseSoundOptions = {}): SoundView {
  const engine = options.engine ?? getEngine();
  const active = options.active ?? true;
  const hook = options.hook ?? false;
  const { view = null, epoch = 0, offset = 0, visualCues = false } = options;
  const clockNow = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  // 감독에 먹인 직전 상태. 방을 떠나거나(정리) 개발 모드 이중 효과 실행에서 비워 첫 스냅샷처럼 다룬다
  const last = useRef<Directed | null>(null);
  const lastJoinAt = useRef<number | null>(null);
  const offsetRef = useRef(offset);
  const nowRef = useRef(clockNow);
  const randomRef = useRef(random);
  const visualCuesRef = useRef(visualCues);
  offsetRef.current = offset;
  nowRef.current = clockNow;
  randomRef.current = random;
  visualCuesRef.current = visualCues;
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
      last.current = null;
    };
  }, [engine, active]);

  // view 차이 → 감독 → 엔진. 의존은 view·epoch 뿐이고 시계·오프셋은 ref 로 읽는다(같은 view 로 다시 실행돼도 직전과 같아 빈 출력)
  useEffect(() => {
    if (!active) return;
    if (view === null) {
      last.current = null;
      return;
    }
    const av = audioViewOf(view);
    const now = nowRef.current();
    const prev = last.current;
    const out = direct(prev?.av ?? null, av, {
      now,
      offset: offsetRef.current,
      reset: prev !== null && prev.epoch !== epoch,
      lastJoinAt: lastJoinAt.current,
      rng: randomRef.current,
      visualCues: visualCuesRef.current,
    });
    last.current = { av, epoch };
    if (out.now.some((c) => c.id === "lobby.join")) lastJoinAt.current = now;
    apply(engine, out);
  }, [engine, active, view, epoch]);

  // 닫힌 로컬 신호(주요 버튼 ui.tap). 어떤 소리를 낼지는 감독이 정한다
  useEffect(() => {
    if (!active) return;
    return bindSignals((signal) => {
      apply(engine, directSignal(signal, last.current?.av ?? null, { visualCues: visualCuesRef.current }));
    });
  }, [engine, active]);

  const state: SoundUiState = !snap.on ? "off" : snap.state === "running" ? "on" : "locked";
  return { supported: snap.supported, state, engine };
}
