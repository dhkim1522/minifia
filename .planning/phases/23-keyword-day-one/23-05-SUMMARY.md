---
phase: 23-keyword-day-one
plan: "05"
subsystem: game-flow
tags: [phase-id, answer-reveal, first-day, view-leak-guard, script-copies]
requires: ["23-01"]
provides:
  - "answerReveal 단계(PHASE_DEFS·ANSWER_REVEAL_MS 3000·NO_EXECUTION_MS 1400)와 firstDayAnswerPending·afterDayOf(state)"
  - "routeAfterExecution 첫날 분기(승패 없음이면 answerReveal, 승패면 ended), noExecutionOf 의 answerReveal 확장, phaseDurationOf 4.4초"
  - "answerOpenOf(서버 전용 keywordAnswer.ts)와 view.day.keyword { genre, answer } — 정답은 answerReveal 진입 프레임부터 모두에게 같은 값"
  - "DAY_PHASES·MAP_PHASES·FIXED_PHASES·lightingOf 가입, 클라이언트 표·스크립트 사본·시험 표 갱신"
affects: [23-06, 23-07, 23-09, 23-11]
status: complete
actuals:
  tokens: 23000
  tasks: 3
  commits: 6
plan_head_before: 50e65cbc6070a254fe0d96ed1195930fea381b6d
plan_head_after: 7a77fc0c7edab235486235af147bc388b9db280d
tech-stack:
  added: []
  patterns:
    - "첫날 분기는 표(PHASE_DEFS.execution.next)를 바꾸지 않고 마감 훅 routeAfterExecution 과 afterDayOf(state) 두 곳이 같은 규칙(firstDayAnswerPending)으로 가른다"
    - "정답 공개 시점은 answerOpenOf 한 함수가 정한다 — view.ts 가 이 함수 하나로만 day.keyword.answer 를 싣는다"
    - "처형 없음 여부는 공개 값(voteLog 파생)이라 answerReveal 길이(3초/4.4초)로 새는 정보가 없다"
key-files:
  created: []
  modified:
    - shared/protocol.ts
    - shared/game/phases.ts
    - shared/game/discussion.ts
    - shared/game/execution.ts
    - shared/game/endgame.ts
    - shared/game/verdict.ts
    - shared/game/nomination.ts
    - shared/game/runoff.ts
    - shared/game/showdown.ts
    - shared/game/keywordAnswer.ts
    - shared/game/view.ts
    - shared/game/movement.ts
    - src/audio/director.ts
    - src/game/scenes.ts
    - src/screens/RoomScreen.tsx
    - src/components/TestTools.tsx
    - src/world/presence.ts
    - scripts/smoke.mjs
    - scripts/e2e/lib.mjs
    - scripts/e2e/polish.mjs
key-decisions:
  - "firstDayAnswerPending·afterDayOf(state) 는 연구 안(keywordAnswer.ts)과 달리 phases.ts 에 둔다 — phases.ts 는 클라이언트가 import 하므로 키워드 모듈을 끌어오지 않고, 두 함수는 keyword 키의 존재만 본다. answerOpenOf 만 서버 전용 keywordAnswer.ts"
  - "day.keyword 는 keyword 단계 또는 answerOpenOf 일 때 싣는다(장르 라벨은 정답이 열린 뒤에도 같이, D-23). 첫날 낮·처형 단계(정답 전)에는 day.keyword 키 자체가 없다"
  - "answerReveal 은 MAP_PHASES 에 넣고 CHAT_PHASES 에는 넣지 않는다 — 서버가 채팅·동작을 받지 않는다. 같은 이유로 will.ts 의 saveWill 은 MAP_PHASES 를 통과하므로 answerReveal 에서도 유언 저장이 서버에서 허용된다(밤과 같다, 의도된 통과)"
requirements-completed: [SC4, SC7]
---

# Phase 23 Plan 05: 첫날 정답 공개 단계 answerReveal Summary

**키워드가 있는 판의 첫날은 처형 뒤(또는 처형 없는 낮 뒤) 밤 직전에 answerReveal 3초(처형 없음이면 4.4초)가 끼어 정답이 모두에게 같은 값으로 공개되고, 승패가 나면 건너뛰며, 둘째 날부터와 keyword 없는 옛 방은 원래 흐름 그대로다.**

## 해낸 것

- **단계·상수(D-02·D-22)**: `PhaseId` 에 `answerReveal`(execution 다음). `ANSWER_REVEAL_MS 3000`, `NO_EXECUTION_MS 1400`. `PHASE_DEFS.answerReveal = { 3000, next: night, revealsOwnRole: true }`. `PHASE_DEFS.execution.next` 는 표에서 `night` 그대로(둘째 날 이후가 쓴다).
- **첫날 분기 세 곳(D-02·D-29)**: `firstDayAnswerPending(state)` = keyword 가 있고 `(day ?? 1) === 1`. `afterDayOf(state)` 가 처형 없는 낮(찬반 부결·지목 0표·동점·결선·결전 무승부)을 가른다(verdict·nomination·runoff 두 곳·showdown 두 곳, 호출 6곳을 `afterDayOf(state)` 로). `routeAfterExecution` 은 승패면 `ended`(공개 단계 건너뜀), 아니면 첫날 키워드 판이면 `answerReveal`.
- **길이·이유(D-22)**: `noExecutionOf` 가 `night` 에 더해 `answerReveal` 에서도 이유를 준다. `phaseDurationOf(answerReveal) = 3000 + (처형 없음이면 1400)`. tick 이 진입 훅 뒤 `phaseDurationOf` 로 마감을 다시 정하므로 `phaseEndsAt` 도 4.4초다. `discussion.ts → execution.ts` import 는 순환이 생기지 않아 판정을 옮기지 않았다.
- **정답 view(D-03·D-14·D-23, T-23-15)**: `answerOpenOf(state)`(keyword 있고 ended / 둘째 날 이후 / 첫날 answerReveal·night·morning). `KeywordView.answer?`. `buildDay` 가 `keyword` 단계 또는 `answerOpenOf` 일 때 `day.keyword = { genre, answer? }` 를 만들고, 정답은 `answerOpenOf` 가 참일 때만 `state.keyword.word` 로 싣는다. 서버 `DAY_PHASES` 와 `MAP_PHASES` 에 `answerReveal` 가입, `CHAT_PHASES` 에는 넣지 않음.
- **클라이언트 가입(P23-21)**: director `BED_OF` bed.vote·`ENTER_SOUND` ui.card, scenes `PHASE_SCENE` dusk, RoomScreen `PHASE_ANNOUNCE` "정답 공개"·`sceneKey` gameMap·`renderPhase` GameMap 분기, TestTools 라벨 "정답 공개", presence `FIXED_PHASES`·`lightingOf` vote(todOf 가 파생해 "저녁"). 큰 글·띠·패널 잠금은 23-07.
- **사본·시험 표**: smoke `PHASE_NEXT`·`DAY_PHASES`, lib `PHASE_GRAPH`·`EXPECTED_SCENE`, polish `TOD_BY_PHASE`. 시험: view·audience·soundDirector·tick·scenes·emotePhases·movement·e2eContract·phaseScreens·timeOfDay·presence, node lib·polish·smoke 시험.

## 커밋

| 순서 | 해시 | 내용 |
| ---- | ---- | ---- |
| 1 (RED) | b9051b1d | `test(23-05): 첫날 정답 공개 단계 분기 실패 시험` — **9건 실패**(keywordFlow 5·execution 1·presence 2·timeOfDay 1) |
| 2 (GREEN) | a08cf584 | `feat(23-05): 첫날 정답 공개 단계 — 처형 뒤·처형 없는 첫날 뒤 밤 직전` |
| 3 (RED) | c65b91b5 | `test(23-05): 정답 공개 view 실패 시험` — unit 3건·worker 1건 실패 |
| 4 (GREEN) | b413412f | `feat(23-05): 정답은 정답 공개 단계부터 모두에게 같은 값` |
| 5 (RED) | 4d21f003 | `test(23-05): answerReveal 가입 목록 실패 시험` — vitest 3건·node 5건 실패(스크립트 사본 갱신 전) |
| 6 (GREEN) | 7a77fc0c | `feat(23-05): answerReveal 가입 목록·스크립트 사본` |

- **RED 증거**: 위 표. 커밋 3의 "keyword·낮 단계 view 에 answer 없음" 단언 하나는 RED 에서도 이미 통과한다(없는 것을 단언하는 방어 시험이라 GREEN 뒤에도 같은 결과를 지킨다).
- **typecheck 결합**: `PhaseId` 에 `"answerReveal"` 을 더하면 `Record<PhaseId,…>` 표 여덟 곳(PHASE_DEFS·BED_OF·PHASE_SCENE·PHASE_ANNOUNCE·TEST_PHASE_LABEL·timeOfDay.test·emotePhases.test·phaseScreens.test)이 typecheck 로 묶이고 `afterDayOf` 시그니처 변경이 e2eContract 호출 두 곳까지 묶어, Task 1 의 GREEN 은 서버·화면·표를 한 커밋으로 나눌 수 없었다. 나머지 시험 표·스크립트 사본 churn 은 D-31 대로 Task 3 의 RED/GREEN 커밋으로 따로 냈다.

## 검증 결과

| 확인 | 결과 |
| ---- | ---- |
| Task 1 automated(keywordFlow·execution·presence·timeOfDay·emotePhases·phaseScreens·verdictRule·nomination·endgame) + typecheck | 9 files · 464 tests 통과, typecheck 에러 0 |
| Task 2 automated(keywordFlow·worker keyword·movement·audience) + typecheck | 통과(worker keyword 3 tests) |
| `npx vitest run --project unit --project client` | 200 files 통과 · 6813 tests 통과(176 skipped) |
| `node --test scripts/*.test.mjs scripts/e2e/*.test.mjs` | 636 중 636 통과 |
| `npx vitest run --project worker` | 46 files 통과 · 516 tests 통과(62 skipped) |
| `npx vitest run`(전체) | 첫 실행에서 알려진 부하 간헐 1건(`waitHelpers` "손으로 정한 봇 표…") — 단독 재실행 6 tests 통과. 나머지 245 files 통과 |
| `npm run typecheck` | 에러 0 |
| 승인 기준 grep | `"answerReveal"` protocol 1 · `firstDayAnswerPending` 1 · `answerOpenOf` 1 · 인자 없는 `afterDayOf()` 전 파일 0(주석 포함) · presence `answerReveal` 2 · polish 1 · `answerReveal: ["night"]` smoke·lib 각 1 · MAP_PHASES 1 · CHAT_PHASES 0 |

## 집합별 "넣음 / 넣지 않음" 표 (D-04, Pitfall 2, `git grep` 재현)

| 위치 | answerReveal | 이유 |
| ---- | ------------ | ---- |
| `PHASE_DEFS`·`BED_OF`(bed.vote)·`PHASE_SCENE`(dusk)·`PHASE_ANNOUNCE`·`TEST_PHASE_LABEL` | 넣음 | `Record<PhaseId>` 가입(컴파일러가 잡음) |
| `ENTER_SOUND`(ui.card) | 넣음 | 정답 카드가 나타나는 한 번 |
| `DAY_PHASES`(view.ts) | 넣음 | view.day 가 있어야 day.keyword 를 싣는다(D-23) |
| `MAP_PHASES`(movement.ts) | 넣음 | 맵 위 연출·월드 프레임·`captureHome` 이 처형·밤과 이어진다. 부수 효과: `will.ts` saveWill·`worldVisibleTo`·`audience(world)` 가 밤과 같은 규칙으로 통과 |
| `FIXED_PHASES`·`lightingOf` vote(presence.ts) | 넣음 | 카메라 고정·저녁빛(P23-21) → `todOf` 가 "저녁"으로 파생 |
| `sceneKey`·`renderPhase`(RoomScreen) | 넣음 | 처형 → 정답 공개 → 밤 사이 맵(three 렌더러)을 다시 만들지 않으려고 |
| `CHAT_PHASES`(audience.ts) | 넣지 않음 | 서버가 채팅·동작·입력 중을 받지 않는다(채널 null, emote 수신자 빈 집합) |
| `BADGE_PHASES`·`WHISPER_PHASES` | 넣지 않음 | 해당 장치 단계가 아님 |
| `TICK_PHASES`(director.ts) | 넣지 않음 | P23-26: 카운트다운 틱 없음 |
| `TIMELESS_PHASES`·`HOST_HIDDEN_PHASES` | 넣지 않음 | 시간이 있고 띠가 보인다 |
| `layoutKey`(gather.ts) | 변경 없음 | 기본 `null`, 배치 없음 |
| `hostKeyOf`(hostLine.ts)·`dayView.titles`·`dayEvents` | **이 계획에서 건드리지 않음 → 23-07** | `answerReveal` 줄·"정답" 제목·큰 글은 화면 계획 소관(현재 hostKeyOf 는 `fallback`) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 장르가 무작위가 되어 깨진 23-01 worker 시험 단언**
- **Found during:** Task 2 RED(worker keyword.test 실행)
- **Issue:** 23-04 가 장르를 7개로 늘린 뒤 `test/worker/keyword.test.ts` 의 `day.keyword` 단언이 장르 `"영화"` 고정이라 이미 실패 상태였다(이 계획이 만든 회귀가 아니다).
- **Fix:** 저장된 방의 `keyword.genre` 를 `genreLabelOf` 로 읽어 단언하도록 고침. 새 정답 공개 시험도 같은 방식.
- **Commit:** c65b91b5

**2. [Rule 3 - Blocking] 계획 밖 시험 파일 갱신**
- **Found during:** Task 1·Task 3 전체 unit 실행(Task 1 verify 가 지정 파일만 돌려 놓침)
- **Issue:** `scenes.test`(PHASE_SCENE 전수·EXPECTED_SCENE 대조)·`soundDirector.test`(침대 표)·`tick.test`(단계 수·행 값)·`audience.test`·`movement.test`(MAP_PHASES 목록)·`emotePhases.test`(이동 차단 낮 단계 목록)·`view.test`(허용 키·길이 사슬: 첫날 night 가 이제 answerReveal 을 거쳐 4400 이 더해지고, 정답이 열린 첫날 night·morning 의 day 에 `keyword` 키가 더해진다)·`scripts/smoke.test.mjs`·`polish.test` fixture 가 새 단계를 몰라 깨졌다.
- **Fix:** 모두 answerReveal 을 아는 기대값으로 고침(view.test `endedState` 는 첫날 처형 뒤 answerReveal 을 한 걸음 더 넘김, 허용 키 검사는 정답이 열린 단계에 `answer,genre` 를 기대).
- **Commit:** a08cf584(movement 는 b413412f) · 4d21f003 · 7a77fc0c

**3. [Rule 1 - 설계 선택] `answerOpenOf` 주변 키 모양**
- 계획은 "answerReveal·night 에도 genre 가 있다" 만 적었다. day.keyword 를 `keyword` 단계 또는 `answerOpenOf` 일 때만 만들므로, 첫날 낮·처형 단계(정답 전)에는 day.keyword 키가 없고 정답 후(첫날 night·morning, 둘째 날 이후)에는 `{ genre, answer }` 두 키다. 23-06 이 `answers`(제출 답)를 같은 객체에 더하며 낮 단계에도 싣게 될 때 이 조건을 넓힌다.

**4. [작은 보강] e2eContract 의 `afterDayOf()` 호출 두 곳**
- 시그니처 변경으로 typecheck 가 깨져 Task 1 GREEN 에서 최소 수정(`afterDayOf({ day: 2 })`)하고, 첫날 두 경우·execution 전이·answerReveal 전이 단언은 Task 3 에서 더했다.

### 계획과 같게 한 것

- `execution.next` 는 표에서 `night`, `PHASE_DEFS.answerReveal.revealsOwnRole: true`, answerReveal 의 phaseDurationOf 는 `noExecutionOf(state)` 유무로 갈림(import 순환 없음).

## Known Stubs

없음. `hostKeyOf` 의 `answerReveal` 줄은 아직 `fallback` 이지만 23-07 이 채운다(위 표, 의도된 단계).

## 이월 · 확인하지 못한 것

- **23-07**: 큰 글("정답"·"처형 없음" 1.4초 순서)·띠 문장·패널 잠금(`data-chat-locked`), `hostKeyOf`/`HOST_LINES` 의 answerReveal 줄, `dayView.titles`·`dayEvents.phaseEntry` 의 answerReveal·ANNOUNCE_NOEXEC_MS 를 `NO_EXECUTION_MS` 로 맞추기, `SceneCurtain`·`ResultScreen`(arrivedFrom)·`pinPlan` 등 `"execution"`/`"night"` 만 보는 화면 분기 점검. `useWill` 은 `MAP_PHASES` 를 읽어 answerReveal 에서 유언 펜이 열릴 수 있다(서버도 통과) — 23-07 에서 의도 확인.
- **`scripts/uat-test-room.mjs`**: 23-01 이월 그대로(전이 표·낮 순서가 낡았고 answerReveal 도 없다). 24 배포 검증 전에 고친다.
- **`bots.test.ts` allowed 목록**(23-01 이월): 키워드를 켠 봇 판을 돌리는 계획이 keyword·answerReveal 을 더해야 한다. 이 계획은 스위치를 끈 봇 판만 돌려 영향이 없었다.
- 둘째 날 부결 → night 의 worker 시험은 첫날 한 바퀴 뒤 실제 둘째 날이 아니라 `editRoom` 으로 `day: 2` 를 박아 만들었다(unit keywordFlow 가 실제 tick 사슬로도 확인).
- 로컬 dev 서버·실기기·E2E 브라우저 실행·배포는 하지 않았다(사용자 지시: 배포 없음, 실기기는 끝에).

## Threat Flags

없음. 새 네트워크·인증·파일 접근 표면이 없다. 계획의 위협은 mitigate 대로 닫았다: T-23-15 `answerOpenOf` 단일 함수 + keywordFlow 단언(첫날 낮·처형 단계 모든 viewer 에 키 없음, 마피아 view 에 단어 문자열 없음) + worker 실제 프레임 단언, T-23-16 `firstDayAnswerPending` 이 keyword 키 존재를 봄(옛 방 night), T-23-17 accept.

## Self-Check: PASSED

- 파일 존재: shared/game/keywordAnswer.ts · shared/game/phases.ts · shared/game/endgame.ts · shared/game/view.ts · scripts/smoke.mjs · scripts/e2e/lib.mjs · scripts/e2e/polish.mjs
- 커밋 존재: b9051b1d · a08cf584 · c65b91b5 · b413412f · 4d21f003 · 7a77fc0c
