---
phase: 14-host-and-labels
plan: "03"
subsystem: audio-host-chime
tags: [host-chime, sound-director, synthesized-recipe, minifia-v3, host-02, host-05]
status: complete

requires:
  - phase: 14-01
    provides: hostChimeOf 판정식(src/game/hostLine.ts)·자막 띠(HostBand)
provides:
  - "신호 종류 host(인자 없음) — SIGNAL_KINDS 끝, HostSignal"
  - "합성 레시피 ui.host — ui 버스, −24dB, gapMs 800, 사인 880→1318Hz 두 음 약 350ms (음성·외부 샘플 없음)"
  - "directSignal 의 host 갈래 — 밤 무음 판정보다 앞, 낮·밤 모두 같은 ui.host 한 번, cur 없으면 무음"
  - "RoomScreen 발신 — 띠가 그리는 view 의 단계가 바뀐 프레임에 hostChimeOf 가 참이면 emitSignal({ kind: 'host' })"
  - "소리 id 57개(배경음 7 + 효과음 50), 시험 페이지 '사회자 알림'(공통·로비·역할 묶음), docs/audio.md 행"
  - "E2E 밤 동일성 판정의 예외 상수 HOST_CHIME_ID (P1·P3 에서 ui.host 만 제외)"
affects: [14-09]

requirements-completed: [HOST-02, HOST-05]

actuals:
  tokens: 11500
  tasks: 2
  commits: 5

plan_head_before: f402bfaed1fa5dac919f32a283a47a1ed6abb5f0
plan_head_after: f0240394da81e988fcb0c3db185cf8a92f7e2db8

tech-stack:
  added: []
  patterns:
    - "닫힌 신호 → 감독 → 레시피 구조에 공개 단계 전환 신호 하나를 더함. 신호에는 인자가 없어 소리로 역할·좌석이 드러나지 않는다"
    - "RoomScreen 의 호스트 알림 효과는 {단계, epoch} ref 하나로 이전 프레임을 기억해 hostChimeOf(prev, cur, fresh) 에 먹인다 (기존 prevPhase ref 와 별개)"

key-files:
  created:
    - test/client/hostChime.test.tsx
  modified:
    - src/audio/signals.ts
    - src/audio/director.ts
    - src/audio/recipes.ts
    - src/debug/soundLabTable.ts
    - src/screens/RoomScreen.tsx
    - scripts/e2e/lib.mjs
    - scripts/e2e/sound.mjs
    - docs/audio.md
    - test/unit/soundDirector.test.ts
    - test/unit/soundNight.test.ts
    - test/unit/soundProtocol.test.ts
    - test/unit/soundRecipes.test.ts
    - test/unit/soundLab.test.ts
    - test/client/nightMap.test.tsx
    - scripts/e2e/lib.test.mjs

key-decisions:
  - "밤 진입 알림음은 LS-7(밤 무음)의 예외다. LS-7 은 사용자 행동·역할이 소리로 드러나지 않게 하는 규칙이고, host 는 인자 없는 공개 단계 전환이라 모든 역할이 같은 프레임에 같은 소리를 듣는다. tap·card·vote·deny·result 의 밤 무음은 그대로 시험이 지킨다. 결정 0073 에 기록할 계획 선택 — 0073 파일은 14-09 에서 쓴다"
  - "낮 시작 → 토론은 울리지 않는다(낮 시작에서 이미 울림, UI#5). 판정은 hostChimeOf 가 하고 RoomScreen 은 그 식만 부른다"
  - "E2E 밤 동일성은 ui.host 를 뺀 나머지 id 로 본다(nightSegments 가 HOST_CHIME_ID 를 거른다). 다른 문턱·개수는 낮추지 않았다 — lib.test 가 ui.host 와 함께 있는 ui.tap 은 계속 P3 실패, 다른 id 는 P1 실패로 확인"

duration: 약 25분
completed: 2026-11-07
---

# Phase 14 Plan 03: 사회자 알림음 ui.host Summary

**자막 띠 단계가 바뀌는 프레임에 합성 알림음(사인 두 음 880→1318Hz, 약 350ms)이 한 번 울리고, 첫 프레임·재접속·같은 단계·낮 시작→토론·쉬는 사람에는 울리지 않으며, 인자 없는 host 신호라 밤 진입에도 모든 역할이 같은 소리를 듣는다.**

## 수행한 일

### Task 1 — 신호 host → 감독 → 레시피 ui.host (HOST-02, D-01)

- `signals.ts`: `HostSignal { kind: "host" }`(인자 없음)를 유니온과 `SIGNAL_KINDS` 끝에 추가.
- `recipes.ts`: `SFX_IDS` 공통 줄에 `ui.host`(ui.card 뒤), `RECIPES["ui.host"]` = ui 버스·우선순위 2·−24dB·gapMs 800, 사인 두 레이어(0ms 880Hz 120ms, 120ms 뒤 1318Hz 230ms, 각 `perc` 감쇠). `SCREEN_COUNTERPART` 에 "자막 띠 문장이 바뀌는 모습". `SOUND_IDS` 57개.
- `director.ts`: `directSignal` 에서 `cur === null` 검사 직후, 밤 무음 `if` 보다 앞에 `host` 갈래(ui.host 를 now 에 넣고 반환). 주석으로 LS-7 예외의 이유를 적음.
- `soundLabTable.ts`: `common` 묶음에 `ui.host`, 이름표 "사회자 알림", `SOUND_LIMITS.count` 57.
- `scripts/e2e/lib.mjs`: `SOUND_RENDER_LIMITS.count` 57, 상수 `HOST_CHIME_ID = "ui.host"`, `nightSegments` 가 이 id 를 emote 처럼 걸러 P1·P3 에서 제외. `sound.mjs` 주석의 개수만 정정.
- `docs/audio.md`: 개수(57, 효과음 50)와 레시피 지도 `ui.host` 행.
- 시험: soundDirector(describe "사회자 알림음 host"), soundNight(SAMPLE 표에 host, 밤 무음 시험을 "host 를 뺀 UI 신호" 로 나누고 "host 는 밤에도 모든 역할 같은 ui.host" 추가), soundProtocol·soundRecipes·soundLab 개수 56→57·49→50 과 ui.host 레시피 규칙·시험 페이지 묶음·이름표, lib.test P1·P3 ui.host 예외와 문턱 유지 시험.
- 커밋: `3ceef159`(RED), `1cb8272a`(GREEN).

### Task 2 — RoomScreen 발신 (HOST-02, UI#3, UI#5)

- `RoomScreen.tsx`: 띠에 넘기는 `shown`(= `curtain ?? view`)의 단계와 `connection.epoch` 를 ref 하나(`hostPrev`)로 기억하는 효과. `fresh = prev.epoch !== connection.epoch`, `hostChimeOf(prev.phase, 지금, fresh)` 가 참이면 `emitSignal({ kind: "host" })`. 쉬는 사람·replaced·failed(띠 없는 화면)는 ref 만 갱신하고 보내지 않는다. 기존 `prevPhase` 효과는 건드리지 않았다.
- `test/client/hostChime.test.tsx`: 처음 마운트 0번, 토론→지목→같은 지목(view 만 새로)→변론 = 2번, 재접속(epoch 변경)과 같은 프레임 단계 변경 0번 후 다음 전환 다시 셈, 낮 시작은 울리고 토론 진입은 안 울림, 처형→밤 1번, 쉬는 사람 0번, 대기실 가림막 동안 0번·걷힌 뒤 배정 프레임 1번.
- 커밋: `12b58181`(RED), `96658103`(GREEN).

## 검증

- `npm test` 전체 초록: 240 파일 / 6948 통과(261 skip). 14-02 기준 6933 에서 +15. `node --test scripts/e2e/lib.test.mjs` 324 통과 0 실패. `npm run typecheck` 오류 0.
- 수락 기준: `"host"` signals.ts 2 이상, `"ui.host"` recipes.ts 3 이상(SFX_IDS·RECIPES·SCREEN_COUNTERPART), `count: 57` lib.mjs 1, `ui.host` 가 docs/audio.md·soundLabTable.ts·director.ts 모두 1 이상, RoomScreen `hostChimeOf` 2(import + 호출), `kind: "host"` 1, `git diff --quiet 2736a336 -- worker shared` 성공(서버·공유 diff 0).
- 소리 끄기·잠김(UI#12, backstop): 레시피를 막는 코드를 새로 만들지 않았다 — 기존 엔진의 잠김·끔 처리를 그대로 따른다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - 계약 변경에 따른 시험 수정] nightMap "밤 소리" 시험이 밤 로그에 ui.* 0 을 단언**
- **Found during:** 전체 `npm test` (Task 2 뒤)
- **Issue:** `test/client/nightMap.test.tsx` 의 "산 시민·경찰·의사·마피아·유령·모션 줄이기 시민의 밤 로그가 같다" 가 모든 `ui.*` 가 0 임을 단언해, 밤 진입에 울리는 ui.host 로 실패했다. 계획의 files 목록 밖 파일이다.
- **Fix:** `ui.host` 를 뺀 `ui.*` 는 0, `ui.host` 는 여섯 로그 모두 정확히 한 번으로 단언을 바꿨다. 모든 역할(마피아·경찰·의사·시민·유령·모션 줄이기)이 같은 소리를 듣는다는 HOST-05 증거가 더 강해졌다.
- **Files modified:** test/client/nightMap.test.tsx
- **Commit:** f0240394

**2. [Rule 3 - 막힘 해소] 계획 목록 밖 개수 지점 정정**
- `src/debug/soundLabTable.ts` 의 `SOUND_LIMITS.count`(56→57, 계획 files 에는 파일만 있고 이 값은 명시 없음)와 `scripts/e2e/lib.test.mjs` 의 `soundRows` 효과음 49→50, 개수 시험 문구를 바꿨다. `scripts/e2e/sound.mjs` 는 주석의 56개만 57개로 고쳤다(코드 변경 없음).
- **Commit:** 3ceef159, 1cb8272a

**3. [Rule 1 - 타입 완전성] director switch 에 host case 를 두지 않음**
- 계획은 "switch 에도 host 를 다룬다" 고 했으나 host 를 앞에서 처리해 `signal` 이 좁혀지므로 `case "host"` 는 타입 오류(TS2678)다. 좁힘 자체가 완전성을 보장하므로 case 를 두지 않았다.
- **Commit:** 1cb8272a

### 계획 대비 보류

- 결정 0073 파일은 아직 없어(14-09 에서 쓴다) "밤 진입 알림음은 LS-7 예외, 낮 시작→토론은 울리지 않음" 계획 선택을 거기에 적지 못했다. key-decisions 에 남겼다.

## Known Stubs

없음.

## Threat Flags

없음 (새 네트워크·인증·파일 표면 없음). T-14-08(역할 누설)은 host 신호에 인자가 없고 soundNight 시험이 밤 view 다섯 개에서 같은 출력을, nightMap 시험이 여섯 역할 로그에서 같은 ui.host 한 번을 단언해 완화. T-14-09(밤 무음 예외 확대)는 tap·card·vote·deny·result 밤 무음 시험이 그대로 통과. T-14-10(E2E 문턱)은 ui.host 만 뺐고 lib.test 가 ui.tap·다른 id 의 실패를 계속 확인. T-14-SC 패키지 설치 없음.

## Self-Check: PASSED

- 파일 존재: test/client/hostChime.test.tsx, src/audio/{signals,director,recipes}.ts, src/debug/soundLabTable.ts, src/screens/RoomScreen.tsx, docs/audio.md — 확인.
- 커밋 존재: 3ceef159, 1cb8272a, 12b58181, 96658103, f0240394 — `git merge-base --is-ancestor` 확인.
