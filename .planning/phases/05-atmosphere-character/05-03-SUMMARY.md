---
phase: 05-atmosphere-character
plan: 03
subsystem: client-atmosphere
tags: [atmosphere, night-vignette, morning-glow, css-gradient, tdd, LOOK-01]
status: complete

requires:
  - phase: 05-atmosphere-character
    provides: "05-01 의 scenes.ts·DayScene(sawNightToMorning·morningExit), 05-UI-SPEC §9.3 밤 비네팅·§9.4 아침 밝아짐 확정 값(시안 승인 2026-10-29)"
provides:
  - "scenes.ts: NIGHT_VIGNETTE_ELLIPSE·NIGHT_VIGNETTE_STOPS·NIGHT_VIGNETTE_FADE_MS·nightVignetteGradient(), MORNING_GLOW_ELLIPSE·MORNING_GLOW_ALPHA·MORNING_GLOW_RISE_MS·morningGlowGradient()"
  - "Backdrop 선택 prop vignette (game 구도 전용): night 그림 층의 자식으로 div.mf-backdrop__vignette"
  - "DayScene 아침 단계 장면 상자 첫 자식 div.mf-morningglow (밤 → 아침을 본 렌더만 --rise)"
  - "src/styles/atmosphere.css: 두 층의 위치·층·pointer-events·애니메이션 (토큰 변수만)"
affects: [05-06, 05-08, 05-09]

actuals:
  tokens: 8000
  tasks: 2
  commits: 4
plan_head_before: 2dc9bd20ea766dc3a8a6828272cdce2106552ad8
plan_head_after: e5295c24217721691f2a7f1ae0a5c0babb586891

tech-stack:
  added: []
  patterns:
    - "그라데이션 문자열은 scenes.ts 함수가 만들고 인라인 CSS 변수(--mf-vignette·--mf-glow)로 싣는다(--mf-scrim 선례, happy-dom 의 color-mix 인라인 문제 회피)"
    - "비네팅은 배경 그림 층의 자식이라 층의 opacity 크로스페이드를 그대로 따른다 — 별도 전환·애니메이션 없음"
    - "모션 줄이기 분기 없음: base.css 전역 규칙(animation/transition 0.01ms)을 따른다"

key-files:
  created:
    - src/styles/atmosphere.css
    - test/client/atmosphere.test.tsx
    - test/unit/atmosphereCss.test.ts
  modified:
    - src/game/scenes.ts
    - src/components/Backdrop.tsx
    - src/screens/DayScene.tsx
    - test/unit/scenes.test.ts

key-decisions:
  - "morningGlowGradient 는 `radial-gradient(ellipse 85% 60% at 50% 55%, color-mix(in srgb, var(--dawn) 38%, transparent), transparent)` 로 끝 멈춤을 위치 없는 transparent 로 뒀다(선형 감쇠, 타원 위쪽 경계 알파 약 0.03 = UI-SPEC 9.4 설명과 같다)."
  - "BackdropProps 의 entry 구도에 `vignette?: undefined` 를 두어 game 구도에서만 켤 수 있게 했다(타입으로 막음)."

requirements-completed: []

duration: about 15min
completed: 2026-10-29
---

# Phase 5 Plan 03: 밤 비네팅 · 아침 밝아짐 Summary

**처형 → 밤에서 밤 그림 가장자리를 `--night-950` 방사형 비네팅(0 → 0.40 → 0.72)으로 어둡게 하고, 밤 → 아침에서 장면 상자 안 DayTable 뒤에 `--dawn` 38% 밝아짐을 올리는 두 층을 CSS 그라데이션 하나씩으로 만들었다. 수치는 `src/game/scenes.ts` 상수 한 곳이고 새 에셋·토큰·진동·`backdrop-filter` 는 없다.**

## 수행한 일

서버·와이어·새 의존성·에셋·토큰 변경 없음. `ASSET_VERSION`·배경 그림·`design/tokens.json` 불변.

### Task 1 — 트레이서: 밤 비네팅 (RED `b05913d` → GREEN `0f5d970`)

- RED: `NIGHT_VIGNETTE_*` 값과 `nightVignetteGradient()` 전체 문자열, `atmosphere.css` 정적 게이트(`.mf-backdrop__vignette` 가 absolute·inset 0·pointer-events none·`var(--mf-vignette)`, 주석 포함 파일 전체에 `#` 색·`backdrop-filter` 없음, 전환·애니메이션 선언 없음), 렌더 시험(밤 렌더에서 night 그림 층의 자식 1개, 다른 단계·결과 화면 0개, discussion → night → morning 으로 가며 entering → current → leaving → 걷힌 뒤 0개, 4역할·관전자 마크업 동일).
- GREEN: `scenes.ts` 에 상수·함수, `Backdrop` 의 `vignette` prop(켜지고 `l.scene === "night"` 인 층 안에 `div.mf-backdrop__vignette` + 인라인 `--mf-vignette`), `DayScene` 이 `vignette` 를 켠다. `ResultScreen` 은 건드리지 않는다. `atmosphere.css` 는 위치·`pointer-events` 만.
- 트레이서 게이트: 자동 명령뿐인 `<verify>` 를 전부 재실행해 통과(unit 53건, client 112건) 확인 후 Task 2 로 넘어갔다.

### Task 2 — 아침 밝아짐 (RED `744ed39` → GREEN `e5295c2`)

- RED: `MORNING_GLOW_*` 값, `morningGlowGradient()` 시작·끝, `.mf-morningglow` 규칙(absolute·inset 0·z-index -1·pointer-events none·`var(--mf-glow)`, 퇴장 `mf-morningglow-out 300ms linear var(--mf-morning-exit-delay…) forwards`), `--rise`(`--mf-glow-rise-ms`·`--ease-out`·퇴장 함께 나열), 두 `@keyframes` 가 `opacity` 만 바꿈, 렌더 시험(재접속 아침: 장면 상자 첫 자식·DayTable 앞·`--rise` 없음·`--mf-morning-exit-delay` 가 아침 카드 값 4700ms 와 같음 / night → morning: `--rise`·`600ms` / 다른 단계 0개·아침을 벗어나면 사라짐 / 4역할·관전자 마크업 동일).
- GREEN: `scenes.ts` 상수·함수, `DayScene` 장면 상자 첫 자식으로 `isMorning` 일 때만 `div.mf-morningglow`(`aria-hidden`, `sawNightToMorning` 이면 `--rise`, 인라인 `--mf-glow`·`--mf-glow-rise-ms`·`--mf-morning-exit-delay`=`morningExit.delay`). 역할·연결 상태는 읽지 않는다. `atmosphere.css` 에 `.mf-morningglow`·`.mf-morningglow--rise` 와 두 `@keyframes`. 파일에 모션 줄이기 미디어 쿼리 이름이 주석에도 없다.

## 시험·검증 결과

| 검사 | 결과 |
|------|------|
| `npx vitest run --project unit test/unit/scenes.test.ts test/unit/atmosphereCss.test.ts` | 37건 통과 |
| `npx vitest run --project client test/client/atmosphere.test.tsx` | 9건 통과 |
| `npx vitest run --project client --project unit` | 91 파일, 2754건 통과 |
| `npm test` | 107 파일, 2943건 통과 |
| `npm run typecheck` / `npx tsc -p tsconfig.app.json --noEmit` | 종료 코드 0 |
| `vite build`(임시 출력 폴더) | 성공, 빌드된 CSS 에 `.mf-backdrop__vignette`·`.mf-morningglow`·`--rise` 규칙이 선언 그대로 남음 |

인수 기준 grep: `export function nightVignetteGradient` 1, `export function morningGlowGradient` 1, Backdrop 의 `nightVignetteGradient` 2, `ResultScreen.tsx` 의 `vignette` 0, DayScene 의 `morningGlowGradient` 2, `atmosphere.css` 의 `mf-morningglow` 7·`prefers-reduced-motion` 0·`#` 색/`backdrop-filter` 0, `src/net/assets.ts`·`public`·`design/tokens.json` 을 건드린 `(05-03)` 커밋 0. E2E 한도·`APPROVED_RELAXATIONS` 는 건드리지 않았다. `.planning/milestone.lock`·`state.json`·`Claude outputs/` 는 커밋하지 않았다. 배포하지 않았다.

## 계획과 달라진 점

### 자동 수정한 것

없음 - 계획대로 실행했다.

### 계획 문구와 다르게 한 것

1. **`Backdrop` entry 구도 타입:** `vignette` 를 game 구도 변형에만 두고 entry 변형에는 `vignette?: undefined` 로 막았다(계획의 "game 구도 전용" 을 타입으로 강제).
2. **`morningGlowGradient` 끝 멈춤:** 위치 없는 `transparent` 로 마무리했다(계획: "끝 멈춤이 `transparent`"). 선형 감쇠라 UI-SPEC 의 "타원 위쪽 경계 알파 약 0.03" 설명과 맞는다.

## 남은 알림

- 쌓임 순서(인물·이름표가 비네팅·밝아짐 위)와 탭 통과는 단위 시험이 CSS 원문으로만 지킨다. 실제 `elementFromPoint` 확인은 05-06 의 E2E AT1·AT2, 헤더 대비 H1 은 05-06/05-08/05-09 의 몫이다.
- 체감(비네팅 0.40/0.72 가 충분히 무거운가, 탈락자 강조 어둡게 층 뒤에서 아침 밝아짐이 보이는가)은 계획의 backstop 이라 실기기 확인 목록으로 간다. 약하면 `MORNING_GLOW_ALPHA`(또는 색 `--morning`)·`NIGHT_VIGNETTE_STOPS` 만 `scenes.ts` 한 곳에서 고친다. 이 계획에서 요구사항 LOOK-01 은 완료 표시하지 않는다(E2E 판정 뒤).
- 빌드된 CSS 에서 minify 가 `4700ms` 기본값을 `4.7s` 로 바꾸지만 실제 지연은 DayScene 이 싣는 인라인 변수(ms)라 영향이 없다.

## 인증 게이트

없음.

## 알려진 스텁

없음.

## 위협 표면 점검

새 엔드포인트·인증 경로·파일 접근·스키마 변경 없음. T-05-06(탭 가로채기)은 두 층 `pointer-events: none`·비네팅은 콘텐츠 아래 그림 층 안·밝아짐 `z-index: -1` 을 CSS 정적 시험으로 고정해 닫았다(실제 쌓임은 05-06). T-05-07(처지 추측)은 두 층이 `view.phase` 와 같은 접속의 전환 여부만 읽고 4역할·관전자 마크업 동일을 시험이 단언해 닫았다. T-05-08(접두 짝 선언)은 `backdrop-filter` 를 쓰지 않음을 파일 전체 정적 시험으로, T-05-SC 는 새 패키지 없음으로 닫았다.

## 사람이 할 일 · 이어지는 계획

- 05-06: 두 층이 인물·이름표 아래이고 탭을 막지 않음(AT1·AT2 elementFromPoint), 헤더 대비 불변(H1)을 로컬·배포본에서 확인.
- 실기기: 위 체감 두 항목.

## Self-Check: PASSED

- 만든 파일 `src/styles/atmosphere.css`, `test/client/atmosphere.test.tsx`, `test/unit/atmosphereCss.test.ts`, 이 SUMMARY 존재 확인.
- 커밋 `b05913d`·`0f5d970`·`744ed39`·`e5295c2` 가 HEAD 의 조상임을 확인.
- `commits: 4` 는 `git rev-list --count 2dc9bd2..HEAD` 로 쟀다(이 SUMMARY 의 docs 커밋 전).
