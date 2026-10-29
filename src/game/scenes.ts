// 배경 장면의 단일 출처(결정 0030). DOM 을 쓰지 않는 순수 모듈이라 단위 테스트와 화면이 같은 표를 읽는다.
//
// - 장면 목록(SCENES): 앱 그림 한 장이 장면 하나다(public/backgrounds/bg_{game|entry}_{파일 조각}.webp).
// - 단계 → 장면 규칙표(PHASE_SCENE): 화면에 단계별 분기를 따로 두지 않는다.
//   4페이즈: 투표·공개·변론·처형 다섯 단계는 조명이 구워지지 않은 해질녘 그림 dusk 한 장이다(빛은 원뿔 층 하나, D-29). 종료(ended)는 night(P-2).
//   verdictDusk 는 등록만 남고 어떤 단계도 가리키지 않는다(그림에 위에서 떨어지는 조명이 구워져 있어 D-29 와 맞지 않는다, P-1).
//   PhaseId 가 늘면 Record<PhaseId, SceneId> 가 타입 오류로 알려 준다.
// - 해·달: 그림에 이미 그려져 있고 장면마다 위치가 다르다(아침 해 오른쪽 위 → 낮 해 더 왼쪽·아래, 밤 달). 이미지에서 떼어낼 수 없으므로
//   따로 그리거나 움직이지 않고 배경 크로스페이드에 맡긴다. 이중으로 보일 수 없다(결정 0030, 확인 필요 1).
// - 실내 배경(v4, 결정 0032)은 위쪽이 어두운 벽이라 모든 장면에서 막이 필요 없다(SCENES.scrim 전부 false). 야외 배경처럼 밝은 하늘이 헤더 뒤로 오면 scrim 을 true 로 켠다(HEADER_SCRIM_STOPS). 4.5:1 은 오프라인 단위 테스트
//   (test/unit/backdropContrast.test.ts)와 E2E H1 이 같은 값으로 잰다. 값을 바꾸려면 이 상수 한 곳만 고친다.
import { DAY_ANNOUNCE_MS } from "../../shared/game/phases";
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
  claim: "day",
  discussion: "day",
  night: "night",
  morning: "morning",
  execVote: "dusk",
  candidateVote: "dusk",
  candidateVoteReveal: "dusk",
  defense: "dusk",
  execution: "dusk",
  ended: "night",
});

export function sceneOfPhase(phase: PhaseId): SceneId {
  return PHASE_SCENE[phase];
}

// - 단계 시작 문구(PHASE_INTRO): 밤과 낮 시작(dayAnnounce)만 'N일차 / 밤·낮이 되었습니다' 를 2초 보여 준다. 같은 부품(SceneIntro)이 두 장면에 쓰인다.
//   낮 시작 전용 화면은 없다 — dayAnnounce 도 테이블 장면(DayScene) 위에서 그려지고 문구가 그 위에 얹힌다(서버 규칙·시간·와이어 불변).
//   4페이즈: 처형 투표 카드는 SceneIntro 가 아니라 전용 카드(UI-SPEC 9.1)다.
export type IntroTone = "night" | "day";
export interface SceneIntroDef {
  /** 막의 톤: 밤은 짙게(중앙 85%), 낮은 옅게(70%) */
  tone: IntroTone;
  /** 가운데 큰 제목 */
  title: string;
  /** 제목 아래 보조줄(선택) */
  sub?: string;
}

export const PHASE_INTRO: Readonly<Partial<Record<PhaseId, SceneIntroDef>>> = Object.freeze({
  night: Object.freeze({ tone: "night", title: "밤이 되었습니다" } as const),
  dayAnnounce: Object.freeze({ tone: "day", title: "낮이 되었습니다", sub: "토론 전에 먼저 직업을 공개해요" } as const),
});

// - 안내 문장 빈 칸 채움(PHASE_GUIDE_FILL): UX-01 점검표(05-UI-SPEC 8)에서 문장이 없던 두 곳 — 낮 시작 하단, 낮 토론 헤더 안내줄.
//   역할로 달라지지 않는다(4역할·관전자 같은 글자, D-09). 기존 문구 표(NIGHT_PANEL_TEXT·VERDICT_TEXT·PHASE_ANNOUNCE)는 옮기지 않는다.
//   문구는 확인 대기 기본값(P5-6)이라 결정 0038 에 적는다. 토론 문장은 헤더 안내줄(nowrap)에 들어가도록 n ≤ 99 에서 14자 이하여야 한다.
export const PHASE_GUIDE_FILL = Object.freeze({
  /** 낮 시작 하단 패널(NightPanel) 제목 + 안내. 생존자·탈락자 모두 같은 두 줄 */
  dayAnnounce: Object.freeze({ title: "낮이 되었어요", guide: "곧 직업 공개가 시작돼요" } as const),
  /** 낮 토론 헤더 안내줄(살아 있는 viewer 만) */
  discussion: (n: number): string => `${n}일차 · 의견을 나눠요`,
});

/** 시간이 의미 없는 단계(D-08 예외): 남은 시간 타이머가 없어도 된다. assigning 은 3초 연출 단계라 P5-5 기본값(확인 대기, 결정 0038). */
export const TIMELESS_PHASES: readonly PhaseId[] = Object.freeze(["lobby", "assigning", "ended"] as const);

/** 시작 문구가 떠 있는 시간. 서버 낮 시작 단계(DAY_ANNOUNCE_MS)와 한 곳에서 같다. */
export const SCENE_INTRO_MS = DAY_ANNOUNCE_MS;

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
