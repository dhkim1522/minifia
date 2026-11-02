// 배경 장면의 단일 출처(결정 0030). DOM 을 쓰지 않는 순수 모듈이라 단위 테스트와 화면이 같은 표를 읽는다.
//
// - 장면 목록(SCENES): 앱 그림 한 장이 장면 하나다(public/backgrounds/bg_{game|entry}_{파일 조각}.webp).
// - 단계 → 장면 규칙표(PHASE_SCENE): 화면에 단계별 분기를 따로 두지 않는다.
//   투표·공개·변론·처형 단계는 해질녘 그림 dusk 한 장이다. 종료(ended)는 night(P-2).
//   verdictDusk 는 등록만 남고 어떤 단계도 가리키지 않는다(그림에 위에서 떨어지는 조명이 구워져 있어 D-29 와 맞지 않는다, P-1).
//   PhaseId 가 늘면 Record<PhaseId, SceneId> 가 타입 오류로 알려 준다.
// - 해·달: 그림에 이미 그려져 있고 장면마다 위치가 다르다(아침 해 오른쪽 위 → 낮 해 더 왼쪽·아래, 밤 달). 이미지에서 떼어낼 수 없으므로
//   따로 그리거나 움직이지 않고 배경 크로스페이드에 맡긴다. 이중으로 보일 수 없다(결정 0030, 확인 필요 1).
// - 실내 배경(v4, 결정 0032)은 위쪽이 어두운 벽이라 모든 장면에서 막이 필요 없다(SCENES.scrim 전부 false). 야외 배경처럼 밝은 하늘이 헤더 뒤로 오면 scrim 을 true 로 켠다(HEADER_SCRIM_STOPS). 4.5:1 은 오프라인 단위 테스트
//   (test/unit/backdropContrast.test.ts)와 E2E H1 이 같은 값으로 잰다. 값을 바꾸려면 이 상수 한 곳만 고친다.
import type { PhaseId } from "../../shared/protocol";

export const SCENE_IDS = ["lobby", "night", "morning", "day", "dusk", "verdictDusk"] as const;
export type SceneId = (typeof SCENE_IDS)[number];

export interface SceneDef {
  /** 파일 이름 조각: bg_{game|entry}_{file}.webp */
  file: string;
  /** 헤더 위쪽 어두운 막이 필요한 장면(막 없이는 헤더 글씨 대비가 4.5 미만인 장면). 실내 배경(v4)은 위쪽이 어두운 벽이라 없다. 막 장치는 남겨 둔다. */
  scrim: boolean;
  /** 입구(entry) 구도 그림이 있는 장면 */
  entry: boolean;
}

export const SCENES: Readonly<Record<SceneId, SceneDef>> = Object.freeze({
  lobby: Object.freeze({ file: "lobby", scrim: false, entry: true }),
  night: Object.freeze({ file: "night", scrim: false, entry: false }),
  morning: Object.freeze({ file: "morning", scrim: false, entry: false }),
  day: Object.freeze({ file: "day", scrim: false, entry: false }),
  dusk: Object.freeze({ file: "dusk", scrim: false, entry: false }),
  verdictDusk: Object.freeze({ file: "verdict_dusk", scrim: false, entry: false }),
});

export const PHASE_SCENE: Readonly<Record<PhaseId, SceneId>> = Object.freeze({
  lobby: "lobby",
  assigning: "lobby",
  roleReveal: "lobby",
  dayAnnounce: "day",
  discussion: "day",
  night: "night",
  morning: "morning",
  execVote: "dusk",
  candidateVote: "dusk",
  candidateVoteReveal: "dusk",
  defense: "dusk",
  execution: "dusk",
  nomination: "dusk", // 8페이즈: defense 와 같은 값. 옛 단계 행은 08-21·22 가 PhaseId 와 함께 지운다
  verdict: "dusk",
  ended: "night",
});

export function sceneOfPhase(phase: PhaseId): SceneId {
  return PHASE_SCENE[phase];
}

/** 시간이 의미 없는 단계(D-08 예외): 남은 시간 타이머가 없어도 된다. assigning 은 3초 연출 단계라 P5-5 기본값(확인 대기, 결정 0038). */
export const TIMELESS_PHASES: readonly PhaseId[] = Object.freeze(["lobby", "assigning", "ended"] as const);

/** 크로스페이드 길이. src/styles/tokens.css 의 --dur-slow(800ms)와 같다. */
export const SCENE_FADE_MS = 800;
/** 새 그림이 준비되기를 기다리는 상한. 넘으면 준비되지 않았어도 크로스페이드를 시작한다. */
export const SCENE_IMAGE_WAIT_MS = 1200;

/** 헤더 위쪽 어두운 막: [위에서의 거리 px, night-900 알파]. 시안 Y3·Y5 의 .66/.42/.18/0 은 타이머 구역 대비가 3.5~4.1:1 이라 .70/.58/.40/0 으로 올렸고, 지평선 18% 의 새 배경(v3)은 하늘이 더 밝아 .80/.70/.55/0 으로 다시 올렸다(길이 150px 은 그대로). */
export const HEADER_SCRIM_STOPS: ReadonlyArray<readonly [number, number]> = [
  [0, 0.8],
  [60, 0.7],
  [110, 0.55],
  [150, 0],
];
export const HEADER_SCRIM_LENGTH_PX = 150;

/** 막의 CSS 그라데이션 값. 색은 night-900 토큰의 color-mix 라 # 색 값이 없다. */
export function headerScrimGradient(): string {
  const stops = HEADER_SCRIM_STOPS.map(([px, alpha]) => `color-mix(in srgb, var(--night-900) ${Math.round(alpha * 100)}%, transparent) ${px}px`);
  return `linear-gradient(to bottom, ${stops.join(", ")})`;
}

// - 밤 비네팅(LOOK-01, D-05): 밤 그림 위 가장자리를 어둡게 하는 방사형 층. P5-1 확정(시안 승인 2026-10-29). 값은 이 한 곳만 고친다(D-05).
//   색은 night-950 한 가지(토큰 usage "장면 비네트 가장자리"), 앰버·진홍·# 색 값 없음(D-07).
/** 타원의 가로·세로 반지름과 중심(radial-gradient 의 `ellipse` 뒤 부분) */
export const NIGHT_VIGNETTE_ELLIPSE = "70% 60% at 50% 44%";
/** [타원 위 위치 %, night-950 알파]: 중심~45% 는 그대로, 75% 에서 0.40, 모서리 100% 에서 0.72 */
export const NIGHT_VIGNETTE_STOPS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [45, 0],
  [75, 0.4],
  [100, 0.72],
];
/** 켜지고 꺼지는 시간. 밤 배경 크로스페이드와 같은 박자라 따로 전환을 두지 않고 그림 층의 opacity 전환을 따른다. */
export const NIGHT_VIGNETTE_FADE_MS = SCENE_FADE_MS;

/** 비네팅의 CSS 그라데이션 값. 색은 night-950 토큰의 color-mix 라 # 색 값이 없다. */
export function nightVignetteGradient(): string {
  const stops = NIGHT_VIGNETTE_STOPS.map(([pos, alpha]) => `color-mix(in srgb, var(--night-950) ${Math.round(alpha * 100)}%, transparent) ${pos}%`);
  return `radial-gradient(ellipse ${NIGHT_VIGNETTE_ELLIPSE}, ${stops.join(", ")})`;
}
