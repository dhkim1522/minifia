---
phase: 04-execution-verdict
plan: 02
subsystem: client-tables-and-regressions
tags: [phase-tables, scenes, regression, tick, typecheck]

requires:
  - phase: 04-execution-verdict
    provides: "04-01 의 PhaseId 여섯 개·PHASE_DEFS 새 행·tick 마감 분기·day.voteLog"
provides:
  - "화면 쪽 단계 표 세 곳(PHASE_SCENE·TEST_PHASE_LABEL·PHASE_ANNOUNCE)이 열네 단계를 모두 안다"
  - "E2E 기대 장면표(EXPECTED_SCENE)와 PHASE_SCENE 동일, verdictDusk 다섯 단계 정확 나열"
  - "discussion → execVote(10초) → 표 없으면 night 흐름으로 옮긴 옛 회귀(같은 강도)"
  - "npm test(unit·client·worker) 1939 통과, tsc app·worker 종료 코드 0"
affects: [04-03, 04-04, 04-05, 04-06, 04-07]

actuals:
  tokens: 14000
  tasks: 2
  commits: 3
plan_head_before: ef82fbe8db87f322e2e3b6f2cc9f76d90cdde35d
plan_head_after: 3a84de5267ac3016f31176665249d00d96a04016
commits: 3

tech-stack:
  added: []
  patterns:
    - "새 PhaseId 는 Record<PhaseId, …> 타입 오류로 표 누락을 알린다 — 표 한 줄씩 채움"
    - "execVote 처럼 표에 따라 다음 단계가 갈리는 단계는 skipPhase 반복(표의 기본 next 만 읽음)에 넣지 않고 분기별로 따로 검증"

key-files:
  created: []
  modified:
    - src/game/scenes.ts
    - src/components/TestTools.tsx
    - src/screens/RoomScreen.tsx
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - test/client/phaseScreens.test.tsx
    - test/unit/scenes.test.ts
    - test/unit/tick.test.ts
    - test/unit/testTools.test.ts
    - test/unit/view.test.ts
    - test/unit/claim.test.ts
    - test/unit/night.test.ts
    - test/worker/alarm.test.ts
    - test/worker/testTools.test.ts
    - HANDOFF.md

key-decisions:
  - "ended 의 장면은 lobby(결과 화면 장면은 UI-SPEC 4 가 표 한 줄로 바꾼다)"
  - "view.test.ts 의 PHASES(여덟 단계 전수 누출 검사)는 넓히지 않는다 — 새 단계 전수 검사는 04-04 몫(Pitfall 12)"

requirements-completed: [VOTE-01, CONN-02]

duration: 약 15분 (시작 시각을 따로 기록하지 못해 추정값)
completed: 2026-10-26
status: complete
---

# Phase 4 Plan 02: 화면 쪽 단계 표와 옛 회귀 이전 Summary

**04-01 이 늘린 열네 단계가 화면 쪽 표(장면·테스트 방 아랫줄·aria-live 안내)와 E2E 기대 표에 모두 들어가고, discussion → night 직결을 전제로 한 옛 회귀가 단언을 느슨하게 하지 않은 채 discussion → execVote(10초) → 밤 흐름으로 옮겨져 `npm test` 와 두 tsc 가 초록이다. renderPhase 는 그대로다.**

## 진행 기록

Task 1 — 커밋 1f88a46 / tsc app·worker 0, scenes+phaseScreens 76 통과, e2e lib.test 107 통과 / 남은 태스크 있음(Task 2).
Task 2 — 커밋 d4d3411 / `npm test` 83 파일 1939 통과, tsc app·worker 0 / 남은 태스크 없음. HANDOFF 진행 줄 3a84de5(로컬 커밋만).
(두 태스크를 한 실행기가 이어서 끝내 별도 `docs(04-02): progress checkpoint` 커밋은 두지 않았다.)

## Accomplishments

- `src/game/scenes.ts` PHASE_SCENE: execVote·candidateVote·candidateVoteReveal·defense·execution → `verdictDusk`, ended → `lobby`. 머리 주석 갱신. `scripts/e2e/lib.mjs` EXPECTED_SCENE 도 같은 여섯 행.
- `TEST_PHASE_LABEL`(처형 여부 투표·후보 선택·투표 공개·최후 변론·처형·판 종료)과 `PHASE_ANNOUNCE`(보이지 않는 aria-live 안내)에 여섯 행. `renderPhase` 의 `case "` 는 11 그대로.
- `scenes.test.ts`: verdictDusk 가 투표·공개·변론·처형 다섯 단계를 정확히 가리키고 dusk 는 어떤 단계도 가리키지 않는다(단언을 뒤집되 정확 나열). `lib.test.mjs` 는 열네 키 목록으로.
- 옛 회귀 이전(같은 강도): tick 열네 단계 표·행 단언(`90000/execVote/true` 등)·마감 연쇄 숫자(execVote 10초 반영: night T+40000, morning T+45000, dayAnnounce T+47000, claim T+55000, discussion T+169000)·알람 steps 에 `["execVote", 10_000]`·testTools 단위·워커·view/claim/night 의 `voteLog`·단계 흐름.
- 새 단언: 훅 next 가 표 기본 next 보다 앞섬(0표 → night, voteLog 한 줄), ended 는 아무리 늦게 tick 해도 입력 그대로, skipPhase 의 execVote 분기 세 가지(discussion→execVote now+10000, 표 없음→night now+30000, 과반 찬성→candidateVote now+15000, 정상 tick 과 마감 시각만 다름), 워커 testSkip discussion→execVote→night, testReset 이 execVote 에서도 voteLog·verdict·execVote 키를 지움.

## 기준선 (Task 2 시작 시점 실패 목록)

전체 20건(Task 1 이후 18건): tick.test 6 · alarm.test 1 · view.test 8 · claim.test 2 · night.test 1 (scenes.test 2 건은 Task 1 이 닫음). 모두 계획 파일 목록 안(04-01 이 지적한 view·claim·night 포함)이라 "추가로 고친 파일" 은 없다. testTools 단위·워커 테스트는 표 기반 반복이라 실패하지 않았지만 계획대로 execVote 분기를 추가했다.

## Verification

| 명령 | 결과 |
|---|---|
| `npm test` (unit·client·worker) | 83 파일 / 1939 통과 / 실패 0 |
| `npx tsc -p tsconfig.app.json --noEmit` | 종료 코드 0 |
| `npx tsc -p tsconfig.worker.json --noEmit` | 종료 코드 0 |
| `node --test scripts/e2e/lib.test.mjs` | 107 통과 / 실패 0 |
| `npx vitest run test/unit/handoff.test.ts` | 통과, HANDOFF 2939바이트 |

수용 기준 그렙: verdictDusk 다섯 행 scenes.ts 5·lib.mjs 5, `ended:` TestTools 1·RoomScreen 1, `case "` 11, `"90000/execVote/true"` 1, `"90000/night/true"` 0, `["execVote", 10_000]` 1 — 모두 충족. `git push`·배포는 실행하지 않았다(웨이브 push 는 04-05).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] skipPhase 반복에 execVote 를 넣지 않고 분기별 테스트로 대체**
- **Found during:** Task 2 (testTools 단위)
- **Issue:** 계획은 `SKIPPABLE` 에 execVote 를 더하라 했지만 그 반복은 `PHASE_DEFS[phase].next` 로 다음 단계를 기대한다. execVote 의 표 기본 next 는 candidateVote 인데 표가 없으면 night 로 가므로 반복 단언이 틀리다.
- **Fix:** execVote 를 반복에 넣지 않고 분기별(표 없음 → night, 과반 찬성 → candidateVote, discussion → execVote) 테스트를 따로 더했다. 단언을 느슨하게 하지 않고 더 구체적이다.
- **Files modified:** test/unit/testTools.test.ts
- **Commit:** d4d3411

**2. [Rule 1 - 계획 보완] "진입 훅 세 번째 인자 at" 단언 미작성**
- ON_ENTER 를 내보내지 않아 관찰이 어렵다. 계획이 허용한 대로 04-06 의 ended 만료 테스트가 대신한다(04-01 의 unit tick 연쇄 테스트가 마감이 이전 마감 + 길이로 이어짐은 이미 단언한다).

**Total deviations:** 2 (Rule 3 ×1, 계획 허용 대체 ×1). **Impact:** 범위 변화 없음, 단언은 더 구체적.

## Known Stubs

없음. 새 단계는 화면 부품이 없어 지금 `renderPhase` 가 `연결 중…` 으로 보인다 — 계획이 의도한 상태이며(D-26, 배포 금지) 화면 계획이 채운다. `ended` 장면 lobby 는 임시값.

## Threat Flags

없음. 새 표면 없음. T-04-06(회귀 이전 중 단언 약화)은 같은 강도 규칙과 grep(옛 `90000/night/true` 부재·새 단언 존재)로 닫았다.

## Next Phase Readiness

Ready for 04-03(결정 0036 문서, 파일 겹침 없음). 이어지는 서버 계획이 초록 위에서 시작한다. 주의: view.test.ts 의 PHASES·REVEALING_PHASES 전수 검사는 여덟 단계 그대로이며 새 단계 확장은 04-04 몫이다.

## Self-Check: PASSED

- 수정 파일 존재·커밋 존재 확인: 1f88a46, d4d3411, 3a84de5 모두 HEAD 의 조상.
