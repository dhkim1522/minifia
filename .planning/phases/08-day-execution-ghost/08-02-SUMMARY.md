---
phase: 08-day-execution-ghost
plan: "02"
subsystem: game-rules
tags: [tdd, nomination, verdict, discussion-end, pure-rules, wire-types]
status: complete

requires:
  - phase: 08-day-execution-ghost
    provides: 결정 0060 (낮 처형·유령 규칙 14항)
provides:
  - PhaseId nomination·verdict 와 PHASE_DEFS 행(NOMINATION_MS 15000 → defense, VERDICT_MS 10000 → execution)
  - shared/game/nomination.ts — majorityOf, castPoint, pointLinesOf, tallyPoints, resolveNomination
  - shared/game/verdict.ts — verdictVotersOf, castVerdict, verdictTallyOf, votedSeatsOf, resolveVerdict
  - shared/game/discussion.ts — toggleEnd, endCountOf, endReached, enterDiscussion
  - Player 서버 전용 키 nominate·verdictVote·endVote, DayView·MyInfo 새 공개·본인 필드 타입, PointLine
affects: [08-07 DO 배선, 08-11 흐름 전환, 08-13 화면 문구, 08-20 장면표 정리, 08-21 옛 단계 삭제]

actuals:
  tokens: 12500
  tasks: 3
  commits: 6
plan_head_before: 023a6dbb010fd4a085137743540275ab5749b4bc
plan_head_after: 56132fb16192155ffcc36bde93bb5f8cacd962f1

tech-stack:
  added: []
  patterns:
    - "v1.0 vote.ts 계약 복사: 검사 순서 = 계약, 같은 값이면 같은 객체, 입력 불변, 시각·난수 없음"
    - "개인 값은 마감 훅에서 구조 분해로 키째 제거 — 익명을 데이터가 없다는 사실로 지킨다"
    - "RED 커밋에 시험 + 이름만 있는 자리표시자 모듈을 함께 둔다(불러오기 실패가 아니라 단언 실패로 RED)"

key-files:
  created:
    - shared/game/nomination.ts
    - shared/game/verdict.ts
    - test/unit/nomination.test.ts
    - test/unit/verdictRule.test.ts
  modified:
    - shared/protocol.ts
    - shared/game/room.ts
    - shared/game/phases.ts
    - shared/game/discussion.ts
    - test/unit/discussion.test.ts
    - test/unit/tick.test.ts
    - test/unit/scenes.test.ts
    - test/client/phaseScreens.test.tsx
    - scripts/e2e/lib.mjs
    - src/game/scenes.ts
    - src/screens/RoomScreen.tsx
    - src/components/TestTools.tsx

key-decisions:
  - "찬반 분모는 던진 표가 아니라 유권자 수 E(변론자를 뺀 산 사람): 찬성 × 2 > E, 못 던진 사람은 기권이고 분모에 있다"
  - "resolveNomination 이 그날 voteLog 줄(exec 0/0/false + cand)을 항상 만들고, resolveVerdict 는 그 줄의 exec 만 채운다. 줄이 없으면 voteLog 를 건드리지 않는다"
  - "토론 끝내기·낮 시작 청소는 discussion.ts 한 곳, 과반 수는 majorityOf 한 곳(nomination.ts)"

requirements-completed: [DAY-03, DAY-04, DAY-05, DAY-06]

coverage:
  - id: D1
    description: "지목 규칙: castPoint 검사 순서·같은 값 재전송, tallyPoints 3:1:1·동률·0표, resolveNomination 이 그날 줄·변론자·night 분기·nominate 청소를 만든다"
    verification:
      - kind: unit
        ref: "test/unit/nomination.test.ts (17 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "찬반 규칙: 유권자 7 에서 찬성 4 통과·3 부결, 변론자·유령 BAD_MESSAGE, 기권은 분모에 포함, 집계 뒤 verdictVote 키 없음"
    verification:
      - kind: unit
        ref: "test/unit/verdictRule.test.ts (20 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "토론 끝내기 토글·과반 판정·낮 시작 청소(verdict·execution·개인 키 제거, voteLog 유지)"
    verification:
      - kind: unit
        ref: "test/unit/discussion.test.ts 토론 끝내기(DAY-03)·enterDiscussion 블록"
        status: pass
    human_judgment: false
  - id: D4
    description: "앱·워커 타입 검사와 단위·클라이언트·워커 시험 전체 통과, 화면 Record<PhaseId> 표 세 곳에 새 행"
    verification:
      - kind: command
        ref: "npm run typecheck; npx vitest run --project unit (1949 passed); --project client (1733 passed); --project worker (269 passed)"
        status: pass
    human_judgment: false
  - id: D5
    description: "지목 15초·찬반 10초 수치와 규칙의 체감"
    verification: []
    human_judgment: true
    rationale: "규칙 층만 만들었고 서버가 새 단계를 아직 만들지 않는다. 체감은 08-11 흐름 전환과 실기기 확인(개발 뒤 한꺼번에)에서 본다"

duration: 9min
completed: 2026-11-02
---

# Phase 8 Plan 2: 지목·찬반·토론 끝내기 순수 규칙 Summary

**v1.0 vote.ts 와 같은 계약으로 지목(최다 한 명이 변론자), 찬반(유권자 E 분모·기권·익명), 토론 끝내기(과반·낮 시작 청소) 세 규칙을 순수 함수와 단위 시험으로 고정했다.**

## Accomplishments

- `PhaseId` 에 `nomination`·`verdict` 를 더하고 `PHASE_DEFS` 에 `nomination → defense`(15초), `verdict → execution`(10초) 행을 더했다. 옛 단계와 `discussion.next` 는 그대로다(흐름 전환은 08-11).
- 와이어 타입: `PointLine`, `DayView.points·endCount·voted·verdict`, `MyInfo.endDiscussion·verdictVote`. Player 에 서버 전용 `nominate·verdictVote·endVote`(누가 지우는지 주석).
- `nomination.ts`: `majorityOf`(2→2, 5→3, 8→5), `castPoint`(단계 → 행위자 → 대상 → 자기 자신 → 같은 값 → 새 상태, 취소 없음), `pointLinesOf`, `tallyPoints`(최다 한 명일 때만 leader), `resolveNomination`(그날 voteLog 줄을 항상 쌓고 동률·0표면 next night, nominate 키 제거).
- `verdict.ts`: 유권자는 변론자를 뺀 산 사람, `찬성 × 2 > E`, 8명(E 7)에서 찬성 4 통과·3 부결, 변론자·유령은 BAD_MESSAGE, 집계 직후 `verdictVote` 키째 제거, 마감 시각은 읽지 않는다.
- `discussion.ts`: `toggleEnd`, `endCountOf`(산 사람만), `endReached`(`majorityOf`), `enterDiscussion`(verdict·execution 과 개인 키 세 개 제거, voteLog 유지).
- 화면 `Record<PhaseId>` 표 세 곳(`scenes.ts`·`RoomScreen.tsx`·`TestTools.tsx`)에 새 행.

## TDD Gate Compliance

세 작업 모두 RED(`test(08-02)`) → GREEN(`feat(08-02)`) 순서다. REFACTOR 커밋은 없다.

| 작업 | RED 커밋 | RED 증거(`gsd_run check tdd-red-evidence` = RED_EVIDENCE_OK) | GREEN 커밋 |
| --- | --- | --- | --- |
| 1 지목 | `38c2290` | nomination.test.ts 17개 중 14 실패. 대상 "최다 한 명이면 변론자로 정하고…" 가 `true undefined undefined` 로 실패(기대 `false undefined {passed:false,candidate:2}`) | `bbff8f7` |
| 2 찬반 | `258c8af` | verdictRule.test.ts 20개 중 15 실패. 대상 "유권자 7: 찬성 4 반대 0 은 통과, 찬성 3 반대 0 은 부결" 가 `false false` 로 실패(기대 `true false`) | `5890461` |
| 3 토론 끝내기 | `3e365d0` | discussion.test.ts 6 실패. 대상 "endReached: 산 4 · 누름 3 은 과반…" 이 `false false` 로 실패(기대 `true false`) | `56132fb` |

semanticAssessment: 세 RED 모두 이름만 있는 자리표시자 모듈(잘못된 값 반환)을 RED 커밋에 함께 두어, 불러오기 실패가 아니라 계획한 단언에서 실패했다. 몇몇 시험(입력 불변, 단계 틀림 등 자리표시자가 우연히 맞춘 것)은 RED 에서도 통과했지만 대상 시험은 계획한 이유로 실패했다.

트레이서 게이트: 작업 1 의 `<verify>` 를 다시 돌려 통과를 확인했고(`⚡ Tracer verified end-to-end — expanding`) 확장 작업으로 넘어갔다.

## Task Commits

1. Task 1 RED `38c2290` → GREEN `bbff8f7`
2. Task 2 RED `258c8af` → GREEN `5890461`
3. Task 3 RED `3e365d0` → GREEN `56132fb`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 단계 목록을 세는 기존 시험 기대값 갱신**
- **Found during:** Task 1 GREEN
- **Issue:** `tick.test.ts` 가 단계가 13개라고 단언한다. PHASE_DEFS 에 행 둘을 더하면 15개가 된다.
- **Fix:** 기대 문자열을 15개(nomination·verdict 포함)로 바꿨다.
- **Files modified:** test/unit/tick.test.ts
- **Commit:** bbff8f7

**2. [Rule 3 - Blocking] PhaseId 를 전수 도는 시험과 E2E 장면표에 새 행 추가**
- **Found during:** Task 3 (계획 3번 항목 "단위 시험 중 PhaseId 전수를 도는 것이 깨지면 기대값에 새 행")
- **Issue:** `scenes.test.ts`(PHASE_SCENE 표 두 단언, 이름 하나), `phaseScreens.test.tsx`(TEST_PHASE_LABEL 키 집합), `scripts/e2e/lib.mjs` 의 `EXPECTED_SCENE`(scenes.test 가 PHASE_SCENE 과 같은지 검사)이 새 단계 때문에 어긋났다. 계획의 files_modified 에는 없는 파일이다.
- **Fix:** 새 행 `nomination: "dusk"`·`verdict: "dusk"`(와 라벨)을 추가했다. 건너뛰기 없음.
- **Files modified:** test/unit/scenes.test.ts, test/client/phaseScreens.test.tsx, scripts/e2e/lib.mjs
- **Commit:** 56132fb

**3. [Rule 3 - Blocking] discussion 모듈 내보내기 목록 시험 갱신**
- **Found during:** Task 3 RED
- **Issue:** `discussion.test.ts` 가 "내보내는 것은 phaseDurationOf 하나다" 를 단언한다. 계획이 네 함수를 같은 모듈에 두라고 정했다.
- **Fix:** 단언을 `endCountOf,endReached,enterDiscussion,phaseDurationOf,toggleEnd` 로 바꾸고 연장 함수가 없다는 취지는 이름에 남겼다.
- **Files modified:** test/unit/discussion.test.ts
- **Commit:** 3e365d0

**4. [Rule 3 - 계획 순서 편차] Task 1 과 Task 3 사이 두 커밋은 앱 타입 검사가 빨갛다**
- 계획대로 화면 표 세 곳을 Task 3 에서 더했기 때문에, `bbff8f7`·`258c8af`·`5890461`·`3e365d0` 시점의 `tsconfig.app.json` 은 `Record<PhaseId>` 누락 오류가 있다(워커 쪽은 통과). 최종 `56132fb` 에서 `npm run typecheck` 가 통과한다.

**Total deviations:** 4 (모두 새 단계가 기존 전수 검사에 걸린 결과). **Impact:** 범위 확장 없음, 단언만 새 단계를 포함하도록 갱신했다.

## Verification

- `npx vitest run test/unit/nomination.test.ts` 17 passed, `verdictRule.test.ts` 20 passed, `discussion.test.ts` 19 passed.
- `npm run typecheck` 통과(앱·워커).
- `npx vitest run --project unit` 70 files / 1949 passed (1 skipped 는 이전부터 있던 것), `--project client` 1733 passed, `--project worker` 269 passed.
- 인수 기준: `"nomination"`·`NOMINATION_MS = 15_000`·`resolveNomination` 존재, `next: "execVote"` 그대로, `yes * 2 > `·`verdictVote: _` 존재, verdict.ts 에 `phaseEndsAt` 없음, `toggleEnd`·`enterDiscussion`·화면 새 행 존재, 시험에 `.skip(`·`.todo(` 없음 — 모두 통과.
- 위생: 저장소 위생 검사 이 계획이 건드린 코드·시험에서 0건.

## Known Stubs

None. (RED 커밋의 자리표시자는 같은 작업의 GREEN 커밋이 전부 구현으로 바꿨다. `PHASE_SCENE`·안내 문구의 nomination·verdict 행은 계획 가정 A3 대로 서버가 새 단계를 만들기 전까지 닿지 않는 값이며, 08-13·08-20 이 다시 본다.)

## Threat Flags

None. (T-08-04 단계 → 행위자 → 대상·변론자 → 값 검사 순서를 시험 표로 고정, T-08-15 `verdictVote` 집계 직후 제거와 `enterDiscussion` 의 세 키 제거를 시험으로 확인.)

## Next Phase Readiness

08-07 이 DO 에서 `castPoint`·`castVerdict`·`toggleEnd` 를 메시지에 배선하고, 08-11 이 tick 표(진입 훅 `enterDiscussion`, 마감 훅 `resolveNomination`·`resolveVerdict`)에 건다. `resolveNomination` 이 verdict 상태와 그날 voteLog 줄을 만들어야 `resolveVerdict` 가 같은 줄을 채우므로 두 훅의 순서(nomination → verdict)를 유지해야 한다.

## Self-Check: PASSED

- FOUND: shared/game/nomination.ts, shared/game/verdict.ts, test/unit/nomination.test.ts, test/unit/verdictRule.test.ts
- FOUND commits: 38c2290, bbff8f7, 258c8af, 5890461, 3e365d0, 56132fb
- 커밋 수 측정: `git rev-list --count 023a6db..HEAD` = 6
